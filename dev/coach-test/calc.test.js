// node dev/coach-test/calc.test.js – the coach numbers against the app's own maths (lib/ is the app's code, copied unchanged)
global.self = global; const path = require('path'), C = path.join(__dirname, '..', '..', 'coach') + '/';
const SG = require(C + 'lib/sg.js'), MYGAME = require(C + 'lib/mygame.js'), TRENDS = require(C + 'lib/trends.js'), SGTEST = require(C + 'lib/shortgame.js'), CALC = require(C + 'analyze.js'), SEED = require('./seed.js');
const L = { SG, MYGAME, TRENDS, SGTEST }, now = Date.now(); let bad = 0; const t = (n, c, x) => { if (!c) bad++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); };
const out = SEED.build(now);
out.forEach((a) => {
  const A = { uid: a.name, name: a.name, rounds: a.rounds, tests: a.tests, practice: a.practice, profile: a.profile, member: { at: now }, stamp: 1 };
  const P = CALC.prepare(A, L);
  const worst = P.rows.reduce((m, r) => Math.max(m, Math.abs(Object.keys(r.cats).reduce((s, k) => s + r.cats[k].sg, 0) - r.sg)), 0);
  t(a.name + ': six skills add up to each round\'s SG', worst < 1e-9, 'max diff ' + worst.toExponential(1));
  const D = CALC.detail(A, L, { now, period: 'all' }), direct = MYGAME.build(P.rows.map((r) => r.round), SG, { period: 'all', baseline: P.bl, now }).cur.tiles.sg;
  t(a.name + ': all-time SG matches MYGAME.build', (D.tiles.sg == null && direct == null) || Math.abs(D.tiles.sg - direct) < 1e-9);
  const full = P.rows.filter((r) => r.full); if (full.length) t(a.name + ': round score = rows + penalties', full.every((r) => r.strokes === r.round.holes.reduce((s, h) => s + SG.rowStrokes(h.rows), 0)));
});
// seen model, flag targets, latest activity, skill pages
{
  const a = out.find((x) => x.name === 'Jake Moretti'), A = { uid: 'j', name: a.name, rounds: a.rounds, tests: a.tests, practice: a.practice, profile: a.profile, member: { at: now }, stamp: 1 };
  const newest = (k) => A[k].map((x) => ({ x, t: CALC.itemT(x) })).sort((p, q) => q.t - p.t)[0].x;
  const base = CALC.itemT(newest('tests')) - 1, doneTests = A.tests.filter((x) => x.done);
  const s0 = CALC.summary(A, L, { now, period: '3m', seen: { base, ids: {} } }), nf = s0.flags.find((f) => f.kind === 'new');
  t('New tag: counts only items newer than the first look', !!nf && nf.parts.every((p) => p.n >= 1) && nf.to.length > 0, nf && nf.text);
  t('New tag with one test links straight to that test', !nf || !nf.parts.find((p) => p.kind === 'tests' && p.n === 1) || /^test\//.test(nf.parts.find((p) => p.kind === 'tests').to));
  const ids = {}; CALC.freshOf(A, { base, ids: {} }).tests.forEach((x) => { ids[x.id] = 1; });
  const s1 = CALC.summary(A, L, { now, period: '3m', seen: { base, ids } }), nf1 = s1.flags.find((f) => f.kind === 'new');
  t('opening an item clears just that item from New', !nf1 || !nf1.parts.some((p) => p.kind === 'tests'));
  t('an unfinished test is never New', CALC.freshOf({ tests: [{ id: 'x', done: false, updated: new Date(now).toISOString() }] }, { base: 0, ids: {} }).tests.length === 0);
  t('every flag has a link target', s0.flags.every((f) => typeof f.to === 'string' && f.to.length > 0), JSON.stringify(s0.flags.map((f) => f.to)));
  t('latest activity names the newest item', !!s0.latest && ['rounds', 'tests', 'practice'].includes(s0.latest.kind) && s0.latest.t === Math.max(...['rounds', 'tests', 'practice'].flatMap((k) => A[k].filter((x) => k !== 'tests' || x.done).map(CALC.itemT))));
  ['drive', 'irons', 'wedges', 'chip', 'bunker', 'putt'].forEach((k) => { const d = CALC.skillDetail(A, L, k, { now }); t('skill page ' + k + ' builds', !!d && Array.isArray(d.rows)); });
  t('unknown skill gives null', CALC.skillDetail(A, L, 'nope', { now }) === null);
}
// v231 Long rule (coach/lib/sg.js = the app's sg.js): Long + rough / bunker / trees with 60 yd or less left is past the green
{
  const R = (dist, loc, dir) => ({ dist, loc, dir: dir || '', pen: false }), drive = (rows) => SG.analyzeHole({ par: 4, finished: true, rows }, 'pga').shots[0];
  const lr = drive([R(400, 'tee'), R(30, 'rough', 'long'), R(8, 'green'), R(2, 'holed')]);
  t('Long drive into the rough, 30 yd left on a 400 yd hole = 430 yd', lr.hit === 430 && lr.dir === 'long', String(lr.hit));
  t('Long + bunker / trees close to the green also adds', drive([R(400, 'tee'), R(30, 'bunker', 'long'), R(8, 'green'), R(2, 'holed')]).hit === 430 && drive([R(400, 'tee'), R(30, 'trees', 'long'), R(8, 'green'), R(2, 'holed')]).hit === 430);
  const fw = drive([R(400, 'tee'), R(30, 'fairway', 'long'), R(8, 'green'), R(2, 'holed')]);
  t('Long + fairway is ignored (400 − 30 = 370, no Long stored)', fw.hit === 370 && fw.dir === '', fw.hit + ' ' + JSON.stringify(fw.dir));
  t('Long + rough far from the green is not added (458 − 284 = 174)', SG.analyzeHole({ par: 5, finished: true, rows: [R(458, 'tee'), R(284, 'rough', 'long'), R(20, 'green'), R(2, 'holed')] }, 'pga').shots[0].hit === 174);
  t('450 yd / 40 yd guard still drops 320 + 50 past the hole', drive([R(320, 'tee'), R(50, 'rough', 'long'), R(8, 'green'), R(2, 'holed')]).hit === null);
  t('coach sg.js is the app\'s v235 engine', SG.VERSION === 'v235' && SG.LONG_PAST_MAX_YD === 60);
}
// the app's Practice screen cards (lib/appviews.js, generated) – built in node with a do-nothing document, read-only
{
  global.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { classList: { toggle() {}, add() {}, remove() {} } }, addEventListener() {}, createElement: () => ({ style: {} }) };
  const vm = require('vm'), fs = require('fs'); let AV = null, err = ''; // the browser scripts, in page order, as the coach page loads them (they attach to the global object)
  try { ['sg', 'mygame', 'trends', 'shortgame', 'shortgame-ui', 'bag', 'birdie', 'insights', 'plan', 'weekahead', 'appviews'].forEach((f) => vm.runInThisContext(fs.readFileSync(C + 'lib/' + f + '.js', 'utf8'), { filename: f + '.js' })); AV = global.APPVIEWS; } catch (e) { err = e.message; }
  t('appviews.js loads and has the Practice cards', !!(AV && AV.practice && ['week', 'gap', 'spider', 'vs', 'recent', 'playing', 'plan'].every((k) => typeof AV.practice[k] === 'function')), err);
  if (AV && AV.practice) {
    const a = out.find((x) => x.name === 'Maya Okafor') || out[0], A = { uid: 'm', name: a.name, rounds: a.rounds, tests: a.tests, practice: a.practice, profile: a.profile };
    AV.enter(A, a.profile.bench); const v = AV.view; v.wkOff = 0; v.wkPage = 0; v.prPage = 0; v.mgPeriod = '3m';
    const H = {}; ['ahead', 'week', 'gap', 'spider', 'vs', 'recent', 'playing', 'plan'].forEach((k) => { try { H[k] = AV.practice[k](); } catch (e) { H[k] = 'ERR ' + e.message; } });
    Object.keys(H).forEach((k) => t('practice card ' + k + ' builds', typeof H[k] === 'string' && !/^ERR/.test(H[k]) && !/undefined|NaN|\[object/.test(H[k].replace(/<[^>]+>/g, ' ')), /^ERR/.test(H[k]) ? H[k] : ''));
    const logs = MYGAME.validPractice(a.practice), DAY = 864e5, mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const wkMin = logs.filter((e) => Date.parse(e.date) >= mon.getTime() && e.min > 0).reduce((s, e) => s + e.min, 0), hmS = AV.data.hmS;
    t('This week total = the practice logged since Monday', new RegExp('id="wktot">' + hmS(wkMin).replace(/ /g, ' ') + ' of ').test(H.week), hmS(wkMin) + ' | ' + (H.week.match(/id="wktot">[^<]*/) || [''])[0]);
    t('week slider has 3 pages: by area, each day, fading average (fitted span)', (H.week.match(/class="wkpage"/g) || []).length === 3 && /Each day, by group/.test(H.week) && /Last \d+ (days|weeks|months) · fading average/.test(H.week));
    const iso = (t0) => { const d = new Date(t0); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }, today = iso(Date.now());
    // v238: fading average (half-life 3 days, minutes a week, averaged over the days logged – at least 3); tournament / practice-round days
    // (and one day between two of them) hold it flat – recomputed here from the logs and rounds to check the chart's data-last
    const addD = (s0, n) => { const d = new Date(Date.parse(s0 + 'T12:00:00')); d.setDate(d.getDate() + n); return iso(d.getTime()); };
    const first = logs.filter((e) => e.min > 0).map((e) => iso(Date.parse(e.date))).filter((d) => d <= today).sort()[0];
    const golf = {}; A.rounds.filter((r) => { const S0 = SG.summarize(r); return r.holes.length > 0 && S0.holesDone === r.holes.length; }).forEach((r) => { if (MYGAME.playOf(r)) golf[iso(Date.parse(r.date))] = 1; });
    const sv = H.week.match(/data-from="([\d-]+)"/), from0 = sv ? sv[1] : today; let from = from0; if (first) { const f0 = first > addD(from0, -30) ? first : addD(from0, -30); if (f0 < from) from = f0; }
    const ds = []; for (let d = from; d <= today; d = addD(d, 1)) ds.push(d);
    const held = {}; ds.forEach((d, i) => { if (golf[d] || (i && i < ds.length - 1 && golf[ds[i - 1]] && golf[ds[i + 1]])) held[d] = 1; });
    const perDay = {}; logs.forEach((e) => { if (e.min > 0) { const d = iso(Date.parse(e.date)); perDay[d] = (perDay[d] || 0) + e.min; } });
    const AF = Math.pow(0.5, 1 / 3); let ew = 0, kd = first && first < from ? 99 : 0;
    ds.forEach((d) => { if (first && d >= first && !(held[d] && kd)) { ew = ew * AF + (perDay[d] || 0) * (1 - AF); kd++; } });
    const fadeNow = kd ? ew / (1 - Math.pow(AF, Math.max(kd, 3))) * 7 : 0;
    const dl = +((H.week.match(/data-last="(\d+)"/) || [])[1]); t('fading-average chart ends on today\'s fading average (rounds held)', Math.abs(dl - fadeNow) <= 2, dl + ' vs ' + Math.round(fadeNow));
    const tots = ((H.week.match(/data-tots="([\d,]+)"/) || [])[1] || '').split(',').map(Number);
    t('chart data-tots ends on data-last', tots.length > 0 && tots[tots.length - 1] === dl);
    t('round days are not shaded (wkhold hidden)', !/class="wkhold"/.test(H.week));
    t('rolling chart groups: Putting, Short game, Wedges, Irons, Woods', /Putting[\s\S]*Short game[\s\S]*Wedges[\s\S]*Irons[\s\S]*Woods/.test(H.week.replace(/<[^>]+>/g, ' ')));
    t('game vs training: one row per skill (7)', (H.gap.match(/class="gaprow"/g) || []).length === 7);
    const sh = (H.vs.match(/<em>(\d+)%<\/em>/g) || []).map((x) => +x.replace(/\D/g, '')); const lost = sh.filter((x, i) => i % 2 === 0), time = sh.filter((x, i) => i % 2 === 1), sum = (L) => L.reduce((s0, x) => s0 + x, 0);
    t('strokes lost vs practice time: both shares add up to about 100%', sh.length >= 4 && Math.abs(sum(lost) - 100) <= 4 && Math.abs(sum(time) - 100) <= 4, sum(lost) + '% / ' + sum(time) + '%');
    t('Strokes lost vs practice time card has no Recent practice in it', !/id="prlist"/.test(H.vs) && /id="prlist"/.test(H.recent));
    const days = AV.data.byDay(logs); t('Recent practice: newest day first, 10 days, then Show earlier days', (H.recent.match(/class="prday( open)?"/g) || []).length === Math.min(10, days.length) && H.recent.indexOf('data-v="' + days[0].k + '"') > 0 && (days.length <= 10 || /prmoredays/.test(H.recent)));
    t('My Practice: three swipe pages (this week, 30 days, 3 months)', (H.spider.match(/class="wkpage prpage"/g) || []).length === 3);
    t('Playing and practice by week: no Tournament vs practice (that is on Stats)', /id="plcard"/.test(H.playing) && !/Tournament vs practice/i.test(H.playing));
    const acts = Object.values(H).join('').match(/data-act="([^"]+)"/g) || [], EDIT = /"(prdelask|prdelyes|predit|predsave|sessopen|tourdel|toursave|setlog|setrecs)"/;
    t('no edit or delete actions in the Practice cards (coach view)', !acts.some((x) => EDIT.test(x)), acts.filter((x) => EDIT.test(x)).join(' '));
    AV.leave();
  }
}
process.exit(bad ? 1 : 0);
