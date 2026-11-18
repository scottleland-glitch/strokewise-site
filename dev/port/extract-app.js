/* Builds coach/lib/appviews.js from the StrokeWise app's own app.js (read-only reference copy, e.g. /tmp/gst at v216).
 *   NODE_PATH=<dir with acorn + acorn-walk> node dev/port/extract-app.js /path/to/app/app.js > coach/lib/appviews.js
 * It does NOT rewrite the app's screens. It copies the app's own top-level functions and variables (found with a real JS parser) that the
 * read-only coach screens need, unchanged, in the app's order, behind a small shim (shim.js here) that stands in for the phone (localStorage,
 * sync, PDF, editing). Only a few named statements are patched (PATCH below). Everything else is the app's code.
 */
const fs = require('fs'), path = require('path'), acorn = require('acorn'), walk = require('acorn-walk');
const file = process.argv[2] || '/tmp/gst/app.js', src = fs.readFileSync(file, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 2020, locations: true });
const body = ast.body[0].expression.callee.body.body;
const decl = new Map();
body.forEach((st, i) => {
  const add = (n) => { if (!decl.has(n)) decl.set(n, []); decl.get(n).push(i); };
  if (st.type === 'FunctionDeclaration') add(st.id.name);
  else if (st.type === 'VariableDeclaration') st.declarations.forEach((d) => { if (d.id.type === 'Identifier') add(d.id.name); });
});
const refs = body.map((st) => { const s = new Set(); walk.full(st, (n) => { if (n.type === 'Identifier') s.add(n.name); }); return s; });

// the screens a coach can open on an athlete, and the helpers the web pages call
const ROOTS = ['myGameHTML', 'statsHTML', 'trendsHTML', 'practicePageHTML', 'practiceCardHTML', 'recentDaysHTML', 'mapHTML', 'replayHTML', 'compareHTML2', 'birdieHTML',
  'scorecardData', 'scorecardHTML', 'rsTopHTML', 'quickViewHTML', 'takeawayHTML', 'statTilesHTML', 'roundParCurvesHTML', 'rsPuttBrkHTML', 'compareHTML', 'applyHeat', 'legendNotes', 'infoize',
  'stListScroll', 'prDayAct', 'statsData', 'statsRound', 'mgData', 'trendsData', 'planData', 'finishedRoundsOf', 'courseVsTest', 'bzUpdate', 'byDay', 'prWords', 'prTitle', 'spokeOf', 'dayLabel', 'dayKey', 'pgOf', 'hmS',
  // v230 Practice tab (coach site): the Practice page's cards one by one, so the web can lay them out on a wide screen
  'weekCardHTML', 'gapCardHTML', 'practiceCardHTML', 'playingCardHTML', 'recentDaysHTML', 'prLegend', 'planCardHTML', 'dayBarHTML', 'weekAheadHTML'];
// things that are the phone's business (editing, PDF, backup, sync, sign-in): replaced by the shim's do-nothing versions
const STUBS = ['render', 'toast', 'pdfHTML', 'grSheetHTML', 'storyHTML', 'storyFullHTML', 'storyClose', 'storyAct', 'makeGameReport', 'mvBarHTML', 'mvSheetHTML', 'addSheetHTML', 'sendSheetHTML',
  'gdCardHTML', 'backupDirty', 'prSheetHTML', 'sessSheetHTML', 'typicalCardHTML', 'playPickHTML', 'notMineHTML', 'syncSnap', 'syncDirty', 'syncNow', 'shareStatus', 'SYNCX', 'syncOn',
  'save', 'saveBag', 'savePractice', 'saveSgTests', 'saveWedges', 'setMyBench', 'setTour', 'setMode', 'setTypical', 'modeRowHTML', 'quickRowHTML', 'tabBarHTML', 'pageBarHTML', 'prOpen',
  'loadJsPDF', 'svgToPng', 'pdfWrap', 'pdfLines', 'radarPng', 'pdfMyGamePages', 'GDX', 'gdOn', 'gdState', 'gdSoon', 'live', 'LIVE_DB', 'coAct', 'coDecorate', 'coSearch', 'coSheets', 'prSheets',
  'wkStart', 'bagHTML', 'wedgesHTML', 'weekCardSwipe'];
const stub = new Set(STUBS), seen = new Set(), q = [];
const add = (n) => { if (stub.has(n)) return; (decl.get(n) || []).forEach((i) => { if (!seen.has(i)) { seen.add(i); q.push(i); } }); };
ROOTS.forEach(add); while (q.length) { const i = q.pop(); refs[i].forEach(add); }

// the few statements that are patched (everything else is copied byte for byte)
const PATCH = [
  // one benchmark for the whole page: the athlete's, chosen on the coach site (view.coBl), else the round's own
  [/function blOf\(r\) \{ return SG\.baseline\(r && r\.baseline\)\.id; \}/, 'function blOf(r) { return view.coBl || SG.baseline(r && r.baseline).id; }'],
];
const parts = []; let patched = 0;
[...seen].sort((a, b) => a - b).forEach((i) => {
  const st = body[i]; let t = src.slice(st.start, st.end);
  PATCH.forEach(([re, rep]) => { if (re.test(t)) { t = t.replace(re, rep); patched++; } });
  parts.push(t);
});

// the app's click handler, cut down to the cases that only change what is shown (view state). Nothing here writes data.
let handler = null; // the top-level document.addEventListener('click', …) (found by shape, so it survives line moves)
body.forEach((st) => { const e = st.type === 'ExpressionStatement' && st.expression; if (e && e.type === 'CallExpression' && e.callee.type === 'MemberExpression' && src.slice(e.callee.object.start, e.callee.object.end) === 'document' && e.callee.property.name === 'addEventListener' && e.arguments[0] && e.arguments[0].value === 'click' && !handler) handler = st; });
if (!handler) throw new Error('click handler not found – line moved?');
let sw = null; walk.simple(handler.expression.arguments[1].body, { SwitchStatement(n) { if (!sw || n.cases.length > sw.cases.length) sw = n; } });
const VIEW_ONLY = ['info', 'mgperiod', 'mgknow', 'trzoom', 'trwk', 'strange', 'stpick', 'stpickev', 'stpickclr', 'stround', 'stcmp', 'stcat', 'stpmb', 'stcur', 'stpt', 'blminest', 'blminehist', 'tkknow', 'stx',
  'map', 'mapscope', 'mapclose', 'pinseg', 'proxb', 'proxlie', 'clubsel', 'heat', 'pmg', 'puttn', 'cmpn', 'cmpkind', 'cmpgrp', 'cmpside', 'bzscope', 'replay', 'rpgreen', 'rpgreenback', 'rphole', 'rpclose',
  'wkoff', 'wkspan', 'wkfull', 'wkclose', 'prfull', 'prclose', 'plweek', 'plbench', 'sgtoggle', 'prplan'];
const cases = []; let pend = [];
sw.cases.forEach((c) => { pend.push(c); if (c.consequent.length) { if (pend.some((x) => x.test && VIEW_ONLY.includes(x.test.value))) cases.push(src.slice(pend[0].start, c.end)); pend = []; } });
const acts = []; sw.cases.forEach((c) => { if (c.test && VIEW_ONLY.includes(c.test.value)) acts.push(c.test.value); });
const missing = VIEW_ONLY.filter((a) => !acts.includes(a)); if (missing.length) throw new Error('missing cases: ' + missing);
const actFn = 'function appAct(act, v, b, k) {\n    var r = round(), h = r && r.holes[view.hole];\n    switch (act) {\n      ' + cases.join('\n      ') + '\n      default: return false;\n    }\n    render(); return true;\n  }';
const ID = 'APPACT'; // referenced names from the cases join the closure
const extra = new Set(); cases.forEach((t) => { const tree = acorn.parse('(function(){' + t.replace(/^(case [^:]+:\s*)+/, '') + '})', { ecmaVersion: 2020 }); walk.full(tree, (n) => { if (n.type === 'Identifier') extra.add(n.name); }); });
extra.forEach(add); while (q.length) { const i = q.pop(); refs[i].forEach(add); }
parts.length = 0; patched = 0;
[...seen].sort((a, b) => a - b).forEach((i) => { const st = body[i]; let t = src.slice(st.start, st.end); PATCH.forEach(([re, rep]) => { if (re.test(t)) { t = t.replace(re, rep); patched++; } }); parts.push(t); });

const shim = fs.readFileSync(path.join(__dirname, 'shim.js'), 'utf8');
let appVer = ''; try { appVer = (fs.readFileSync(path.join(path.dirname(file), 'sg.js'), 'utf8').match(/VERSION: '(v\d+)'/) || [])[1] || ''; } catch (e) {}
const hdr = '/* GENERATED by dev/port/extract-app.js from the StrokeWise app (' + path.basename(path.dirname(file)) + '/app.js, ' + appVer + '). Do not edit by hand.\n' +
  ' * The app\'s own screen code for what a coach can see on an athlete (My Game, Stats, Trends, Practice, round panels, maps, replay), copied unchanged and in the app\'s order\n' +
  ' * (' + parts.length + ' statements, ' + patched + ' patched: blOf). The shim at the top stands in for the phone. appAct() is the app\'s click handler cut down to the ' + acts.length + ' cases that only change what is shown. */\n';
process.stdout.write(hdr + shim.replace('/*@@APP@@*/', parts.join('\n  ') + '\n  ' + actFn));
process.stderr.write('statements ' + parts.length + ', patched ' + patched + ', actions ' + acts.length + '\n');
