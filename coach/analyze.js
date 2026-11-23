/* StrokeWise coach site – per-athlete numbers. Pure (no DOM): takes what api.js pulled and returns what the screens show.
 * All strokes-gained maths is the app's own (lib/sg.js, lib/mygame.js, lib/trends.js, lib/shortgame.js, copied unchanged),
 * so a number here matches the same number in the app. Six skills: the app's seven spokes with lag + short putts joined as Putting.
 */
(function (root) {
  'use strict';
  var DAY = 864e5, MEMO = typeof WeakMap !== 'undefined' ? new WeakMap() : null; // per-athlete work kept off the athlete object
  var LINE_N = 3; // v240 (Scott): trend lines = the average of the last 3 rounds
  var CATS = [
    { k: 'drive', name: 'Driving', sub: 'Tee shots', spokes: ['drive'] },
    { k: 'irons', name: 'Approach', sub: 'From 100+ yd', spokes: ['irons'] },
    { k: 'wedges', name: 'Wedges', sub: '30–100 yd', spokes: ['wedges'] },
    { k: 'chip', name: 'Chipping', sub: 'Within 30 yd', spokes: ['chip'] },
    { k: 'bunker', name: 'Bunker', sub: 'Greenside sand', spokes: ['bunker'] },
    { k: 'putt', name: 'Putting', sub: 'All putts', spokes: ['lag', 'short'] }
  ];
  var TEST_CATS = [{ k: 'putting', name: 'Putting' }, { k: 'chipping', name: 'Chipping' }, { k: 'bunker', name: 'Bunker' }, { k: 'wedge', name: 'Wedges' }];
  var PERIODS = [{ id: '30d', name: '30 days' }, { id: '3m', name: '3 months' }, { id: '1y', name: 'Year' }, { id: 'all', name: 'All time' }];

  function lib(L) { return { SG: L.SG, MG: L.MYGAME, TR: L.TRENDS, T: L.SGTEST }; }
  function tOf(x) { return Date.parse(x && (x.date || '')) || 0; }
  function itemT(x) { return Date.parse((x && x.updated) || '') || Date.parse((x && x.date) || '') || 0; }
  function mean(a) { return a.length ? a.reduce(function (t, x) { return t + x; }, 0) / a.length : null; }

  // the benchmark: the athlete's own pick, else the one most of their rounds use, else the PGA Tour
  function benchOf(A, SG) {
    var b = A.profile && A.profile.bench;
    if (b && SG.BASELINES.some(function (x) { return x.id === b; })) return b;
    var c = {}; (A.rounds || []).forEach(function (r) { var id = SG.baseline(r && r.baseline).id; c[id] = (c[id] || 0) + 1; });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0] || 'pga';
  }
  // the six skills from one MYGAME shape (cur or prev)
  function catsOf(shape) {
    return CATS.map(function (C) {
      var sp = C.spokes.map(function (k) { return shape.spokes.filter(function (s) { return s.k === k; })[0]; }), n = 0, v = null, solid = true;
      sp.forEach(function (s) { n += s.n; if (s.value != null) v = (v || 0) + s.value; if (!s.solid) solid = false; });
      return { k: C.k, name: C.name, sub: C.sub, n: n, value: v, solid: n > 0 && solid };
    });
  }
  // strokes gained in each skill for ONE round (raw totals – the six add up to the round's total)
  function roundCats(S, MG) {
    var acc = {}; CATS.forEach(function (C) { acc[C.k] = { sg: 0, n: 0 }; });
    S.holes.forEach(function (h) { if (!h.done) return; h.shots.forEach(function (s) { if (s.layup) return;
      for (var i = 0; i < MG.SPOKES.length; i++) if (MG.SPOKES[i].test(s)) { var sp = MG.SPOKES[i].k, C = CATS.filter(function (c) { return c.spokes.indexOf(sp) >= 0; })[0]; acc[C.k].sg += s.sg; acc[C.k].n++; break; } }); });
    return acc;
  }

  // Everything that does not depend on the time frame: the athlete's finished rounds, newest first. Cached on the athlete by stamp.
  function prepare(A, L) {
    var X = lib(L), bl = benchOf(A, X.SG);
    var hit = MEMO && MEMO.get(A); if (hit && hit.bl === bl && hit.stamp === A.stamp && hit.nr === (A.rounds || []).length) return hit;
    var rows = [];
    (A.rounds || []).forEach(function (r) {
      if (!r || !r.holes || !r.holes.length) return;
      var S = X.SG.summarize(r, bl); if (!S.holesDone || S.holesDone !== r.holes.length) return;
      var per18 = 18 / S.holesDone, cats = roundCats(S, X.MG);
      rows.push({ id: r.id, date: r.date, t: tOf(r), course: r.course || 'Round', strokes: S.strokes, par: S.par, toPar: S.strokes - S.par, holes: S.holesDone, full: S.holesDone === 18,
        sg: S.sgTotal, sg18: S.sgTotal * per18, cats: cats, play: X.MG.playOf(r), putts: S.putts, gir: S.girHoles ? 100 * S.gir / S.girHoles : null, round: r });
    });
    rows.sort(function (a, b) { return b.t - a.t; });
    var out = { bl: bl, stamp: A.stamp, nr: (A.rounds || []).length, rows: rows }; if (MEMO) MEMO.set(A, out);
    return out;
  }

  // the athlete's numbers for one time frame (period id: 30d | 3m | 1y | all)
  function shapeFor(A, L, period, now) {
    var X = lib(L), P = prepare(A, L), list = P.rows.map(function (x) { return x.round; });
    var B = X.MG.build(list, X.SG, { period: period, baseline: P.bl, now: now });
    return { build: B, cur: B.cur, prev: B.prev, cats: catsOf(B.cur), prevCats: B.prev ? catsOf(B.prev) : null, tiles: B.cur.tiles, rounds: B.cur.rounds };
  }

  // v253 (Scott): score trend = a trendline through the last 10 full rounds (was last-5 avg vs the 5 before, which flipped
  // when a round slid from one side to the other). Least-squares line, rounds evenly spaced.
  // Strokes per round: + = scores going up (worse), - = going down (better). Within ±0.25 a round it is steady.
  var LAST_LOSS = 1; // v254: a skill costing 1+ stroke in the latest round is flagged amber, 2+ red
  var TREND_N = 10, TREND_MIN = 6, TREND_FLAT = 0.25, TREND_ALERT = 0.5;
  function trendOf(P) {
    var full = P.rows.filter(function (r) { return r.full; }).map(function (r) { return r.strokes; });
    var a5 = full.length ? mean(full.slice(0, 5)) : null, n = full.length;
    if (n < TREND_MIN) return { a5: a5, slope: null, dir: null, diff: 0, n: n, used: n };
    var y = full.slice(0, TREND_N).reverse(), mx = (y.length - 1) / 2, my = mean(y), num = 0, den = 0; // oldest first
    y.forEach(function (v, i) { num += (i - mx) * (v - my); den += (i - mx) * (i - mx); });
    var m = num / den;
    return { a5: a5, slope: m, diff: Math.abs(m), dir: m < -TREND_FLAT ? 'better' : m > TREND_FLAT ? 'worse' : 'flat', n: n, used: y.length };
  }
  function trendWord(tr) { return !tr || !tr.dir ? '' : tr.dir === 'better' ? 'decreasing' : tr.dir === 'worse' ? 'increasing' : 'steady'; }
  function trendRate(tr) { var r = Math.round(tr.slope * 10) / 10; return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(1) + '/round'; }

  function testsOf(A, L, P) {
    var X = lib(L), done = X.T.validTests(A.tests || []).filter(function (t) { return t.done; }).sort(function (a, b) { return tOf(b) - tOf(a); });
    var scored = done.map(function (t) { var s = X.T.score(t, X.SG, P.bl), o = { id: t.id, date: t.date, t: tOf(t), cats: {} };
      TEST_CATS.forEach(function (c) { var x = s.cats[c.k]; o.cats[c.k] = x && x.sg != null ? x.sg : null; }); return o; });
    return scored;
  }

  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function fmtSG(v, d) { if (v == null) return '–'; var s = Math.abs(v).toFixed(d == null ? 1 : d); return (Math.abs(v) < Math.pow(10, -(d == null ? 1 : d)) / 2 ? '' : v > 0 ? '+' : '−') + s; }

  // what needs a look: [{ tone: 'red' | 'amber' | 'blue', text }] – red first
  // seen = { base, ids } – an item is New when it is newer than the first look (base) and has not been opened yet (ids)
  function seenOf(o) { var s = o && o.seen; if (s) return { base: s.base || 0, ids: s.ids || {} }; return { base: (o && o.seenAt) || 0, ids: {} }; }
  function freshOf(A, seen) { var out = { rounds: [], tests: [], practice: [] };
    ['rounds', 'tests', 'practice'].forEach(function (k) { (A[k] || []).forEach(function (x) { if (k === 'tests' && x && !x.done) return; if (x && x.id && itemT(x) > seen.base && !seen.ids[x.id]) out[k].push(x); }); });
    Object.keys(out).forEach(function (k) { out[k].sort(function (a, b) { return itemT(b) - itemT(a); }); }); return out; }
  function flagsOf(A, L, P, trend, tests, now, seenIn) {
    var X = lib(L), F = [], rows = P.rows, last = rows[0];
    var S3 = shapeFor(A, L, '3m', now), named = {};
    // a skill clearly below the athlete's usual (their 20 rounds before this window; at least 6 of them, so a thin history can't trigger it)
    if (S3.prevCats && S3.prev.rounds >= 6 && S3.cur.rounds >= 4) S3.cats.forEach(function (c, i) { var p = S3.prevCats[i];
      if (c.solid && p.value != null && (p.solid || (S3.prev.usual && p.n >= 4)) && c.value - p.value <= -0.75) { named[c.k] = 1; F.push({ tone: 'red', kind: 'skill', text: c.name + ' ' + fmtSG(c.value - p.value) + ' vs usual', to: 'skill/' + c.k }); } });
    // v254 (Scott): the latest round's biggest strokes-gained loss (per 18), so the coach sees what drove a score – shown for 7 days
    if (last && now - last.t <= 7 * DAY) { var k0 = null, v0 = 0, f18 = 18 / last.holes;
      CATS.forEach(function (c) { var x = last.cats[c.k]; if (x && x.n && x.sg * f18 < v0) { v0 = x.sg * f18; k0 = c; } });
      if (k0 && v0 <= -LAST_LOSS && !named[k0.k]) F.push({ tone: v0 <= -2 * LAST_LOSS ? 'red' : 'amber', kind: 'lastround', text: 'Last round: ' + k0.name + ' ' + fmtSG(v0) + ' strokes gained (biggest loss)', to: 'round/' + last.id }); }
    var practiceOn = !(A.profile && A.profile.mode === 'stats');
    try {
      var TD = X.TR.build(rows.map(function (r) { return r.round; }), practiceOn ? X.MG.validPractice(A.practice || []) : [], X.SG, X.MG, { bl: P.bl, weeks: 26, tests: [], roundsOnly: !practiceOn, now: now });
      var w = TD && TD.areas.filter(function (a) { return a.ok && a.heading && !named[a.k]; })[0]; // v218: the dashed line starts after 3 rounds (the app dropped the confidence levels)
      if (w) F.push({ tone: 'amber', kind: 'trend', text: CATS.filter(function (c) { return c.k === w.k; })[0].name + ' forecast: trending worse', to: 'trends' });
    } catch (e) {}
    if (trend.dir === 'worse' && trend.diff >= TREND_ALERT) F.push({ tone: 'red', kind: 'score', text: 'Score trend increasing ' + trendRate(trend) + ' (last ' + trend.used + ' rounds)', to: 'rounds' });
    if (!rows.length) F.push({ tone: 'amber', kind: 'none', text: (A.rounds || []).length ? 'No finished rounds yet' : 'No rounds shared yet', to: 'rounds' });
    else if (now - last.t > 21 * DAY) F.push({ tone: 'amber', kind: 'quiet', text: 'No rounds in ' + Math.floor((now - last.t) / (7 * DAY)) + ' weeks', to: 'round/' + last.id });
    if (rows.length && practiceOn && (!tests.length || now - tests[0].t > 35 * DAY)) F.push({ tone: 'amber', kind: 'test', text: tests.length ? 'Short game test due' : 'No short game test yet', to: tests.length ? 'test/' + tests[0].id : 'tests' });
    // lesson homework (as on the app's athlete card): a lesson in the last 2 weeks (4 for a big change) that still has days left
    var les = X.MG.validPractice(A.practice || []).filter(function (e) { return e.kind === 'lesson'; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })[0];
    if (les && practiceOn) { var left = (les.change === 'big' ? 28 : 14) - Math.floor((now - Date.parse(les.date)) / DAY);
      if (left > 0) F.push({ tone: 'amber', kind: 'lesson', text: 'Lesson homework: ' + (left >= 7 ? Math.round(left / 7) + ' wk' + (Math.round(left / 7) === 1 ? '' : 's') : left + ' day' + (left === 1 ? '' : 's')) + ' left', to: 'practice/' + les.id }); }
    var seen = seenOf({ seen: seenIn && seenIn.ids ? seenIn : null, seenAt: typeof seenIn === 'number' ? seenIn : 0 }), fresh = freshOf(A, seen), parts = [];
    var KIND = [['rounds', 'round', 'round'], ['tests', 'test', 'test'], ['practice', 'practice log', 'practice']];
    KIND.forEach(function (k) { var L2 = fresh[k[0]]; if (!L2.length) return; parts.push({ kind: k[0], n: L2.length, text: k[0] === 'practice' ? 'practice' : plural(L2.length, k[1]), /* Scott: "New practice", not "8 practice logs" */ to: L2.length === 1 ? k[2] + '/' + L2[0].id : (k[0] === 'rounds' ? 'rounds' : k[0] === 'tests' ? 'tests' : 'practice') + '?new=1' }); });
    if (parts.length && (seen.base || seen.ids && Object.keys(seen.ids).length)) F.push({ tone: 'blue', kind: 'new', text: newLead(parts) + parts.map(function (p) { return p.text; }).join(', '), parts: parts, to: parts[0].to });
    var order = { red: 0, amber: 1, blue: 2 }; F.sort(function (a, b) { return order[a.tone] - order[b.tone]; });
    return F;
  }

  // "New practice" when it's only practice; "New: 1 round, practice" otherwise
  function newLead(parts) { return parts.length === 1 && parts[0].kind === 'practice' ? 'New ' : 'New: '; }
  // one row of the athlete list
  function summary(A, L, o) {
    o = o || {}; var now = o.now == null ? Date.now() : +o.now, period = o.period || '3m', X = lib(L);
    var P = prepare(A, L), sh = shapeFor(A, L, period, now), trend = trendOf(P), tests = testsOf(A, L, P);
    var flags = flagsOf(A, L, P, trend, tests, now, o.seen || o.seenAt), last = P.rows[0] || null;
    var lastAct = 0, latest = null; ['rounds', 'tests', 'practice'].forEach(function (k) { (A[k] || []).forEach(function (x) { var t = itemT(x); if (k === 'tests' && !x.done) return; lastAct = Math.max(lastAct, t); if (!latest || t > latest.t) latest = { kind: k, id: x.id, t: t, item: x }; }); });
    if (latest) { var it = latest.item; delete latest.item;
      if (latest.kind === 'rounds') { var rr = P.rows.filter(function (q) { return q.id === latest.id; })[0]; latest.row = rr ? { strokes: rr.strokes, toPar: rr.toPar, full: rr.full, holes: rr.holes, sg: rr.sg18 } : null; }
      else if (latest.kind === 'practice') { var pe = X.MG.validPractice([it])[0]; latest.min = pe ? pe.min : 0; latest.focus = pe ? pe.focus || pe.spoke : ''; } }
    var reds = flags.filter(function (f) { return f.tone === 'red'; }).length, ambers = flags.filter(function (f) { return f.tone === 'amber'; }).length;
    return { uid: A.uid, name: A.name, bl: P.bl, blName: X.SG.baseline(P.bl).name, joined: A.member && A.member.at || 0, stamp: A.stamp,
      n: P.rows.length, last: last, lastAct: lastAct, latest: latest, sg: sh.rounds ? sh.tiles.sg : null, periodRounds: sh.rounds, score: sh.tiles.score,
      trend: trend, flags: flags, attention: reds * 10 + ambers * 3, reds: reds, ambers: ambers, mode: A.profile && A.profile.mode || 'full' };
  }

  // the detail page
  function detail(A, L, o) {
    o = o || {}; var now = o.now == null ? Date.now() : +o.now, period = o.period || '3m', X = lib(L);
    var P = prepare(A, L), sh = shapeFor(A, L, period, now), s = summary(A, L, o), tests = testsOf(A, L, P);
    var cats = sh.cats.map(function (c, i) { var p = sh.prevCats && sh.prevCats[i]; return Object.assign({}, c, { prev: p && p.value != null && (p.solid || (sh.prev && sh.prev.usual && p.n >= 4)) ? p.value : null, delta: p && c.value != null && p.value != null && c.solid && (p.solid || (sh.prev && sh.prev.usual && p.n >= 4)) ? c.value - p.value : null }); });
    var logs = X.MG.validPractice(A.practice || []), prac = null, vs = null, lessons = logs.filter(function (e) { return e.kind === 'lesson'; }).length;
    var pb = X.MG.practiceBuild(logs, { period: period, now: now });
    if (pb.cur.total) {
      var raw = X.MG.practiceVsGame(sh.cur, pb.cur);
      prac = { total: pb.cur.total, sessions: pb.cur.sessions, hm: X.MG.hm(pb.cur.total), prevTotal: pb.prev ? pb.prev.total : null, lessons: lessons };
      if (raw) { // join lag + short putts into Putting
        var rows = CATS.map(function (C) { var rs = raw.rows.filter(function (r) { return C.spokes.indexOf(r.k) >= 0; }); var ls = 0, ts = 0, lo = 0, mi = 0; rs.forEach(function (r) { ls += r.lostShare; ts += r.timeShare; lo += r.lost; mi += r.min; });
          return { k: C.k, name: C.name, lostShare: ls, timeShare: ts, lost: lo, min: mi }; });
        var gap = rows.slice().sort(function (a, b) { return (b.lostShare - b.timeShare) - (a.lostShare - a.timeShare); })[0];
        vs = { rows: rows, gap: gap.lostShare - gap.timeShare >= 0.15 ? gap : null };
      }
    }
    // chart series, oldest → newest
    var asc = P.rows.slice().reverse();
    var series = asc.map(function (r, i) { return { t: r.t, id: r.id, course: r.course, strokes: r.full ? r.strokes : null, toPar: r.toPar, sg18: r.sg18, holes: r.holes,
      cats: CATS.reduce(function (o2, C) { o2[C.k] = r.cats[C.k].n ? r.cats[C.k].sg * 18 / r.holes : null; return o2; }, {}) }; });
    // v240 (Scott): the trend lines are the average of the last 3 rounds that have a number (was 5); a point on every such round
    function roll(key, n) { var seen = []; return series.map(function (p) { var v = key(p); if (v == null) return null; seen.push(v); return mean(seen.slice(-n)); }); } // v244 (Scott): the line starts at the first round – the first two points average the rounds so far
    return { summary: s, tiles: sh.tiles, rounds: sh.rounds, cats: cats, usual: sh.prev ? (sh.prev.usual ? 'your usual (' + sh.prev.rounds + ' rounds before)' : 'the year before') : '', allRounds: P.rows,
      tests: tests, prac: prac, vs: vs, series: series, scoreAvg: roll(function (q) { return q.strokes; }, LINE_N), sgAvg: roll(function (q) { return q.sg18; }, LINE_N), catAvg: CATS.reduce(function (o2, C) { o2[C.k] = roll(function (q) { return q.cats[C.k]; }, LINE_N); return o2; }, {}), lineN: LINE_N, radar: sh };
  }


  // ---- one skill (Driving, Approach, Wedges, Chipping, Bunker, Putting): every round's number, the worst shots, practice minutes, the test ----
  var TEST_OF = { chip: 'chipping', bunker: 'bunker', putt: 'putting', wedges: 'wedge' };
  function dtxt(lie, d) { return lie === 'holed' ? 'holed' : (lie === 'green' ? Math.round(d) + ' ft' : Math.round(d) + ' yd'); }
  var LIE = { tee: 'tee', fairway: 'fairway', rough: 'rough', deep: 'deep rough', bunker: 'bunker', green: 'green', hazard: 'hazard', trees: 'trees', ob: 'OB', holed: 'hole', recovery: 'trees', sand: 'bunker' };
  function shotText(s) { return (LIE[s.start.lie] || s.start.lie) + ' ' + dtxt(s.start.lie, s.start.dist) + ' → ' + (s.end.lie === 'holed' ? 'holed' : (LIE[s.end.lie] || s.end.lie) + ' ' + dtxt(s.end.lie, s.end.dist)); }
  function skillDetail(A, L, catKey, o) {
    o = o || {}; var now = o.now == null ? Date.now() : +o.now, X = lib(L), P = prepare(A, L), C = CATS.filter(function (c) { return c.k === catKey; })[0]; if (!C) return null;
    var rows = P.rows.map(function (r) { var c = r.cats[C.k]; return { id: r.id, date: r.date, t: r.t, course: r.course, holes: r.holes, n: c.n, sg: c.n ? c.sg : null, sg18: c.n ? c.sg * 18 / r.holes : null, round: r.round }; });
    var have = rows.filter(function (r) { return r.sg18 != null; }), last5 = have.slice(0, 5).map(function (r) { return r.sg18; }), before = have.slice(5, 25).map(function (r) { return r.sg18; });
    var avg5 = mean(last5), usual = before.length >= 4 ? mean(before) : null;
    var shots = [], Q = rows.slice(0, 20);
    Q.forEach(function (r) { var S = X.SG.summarize(r.round, P.bl);
      S.holes.forEach(function (h, hi) { if (!h.done) return; h.shots.forEach(function (s) { if (s.layup) return;
        for (var i = 0; i < X.MG.SPOKES.length; i++) if (X.MG.SPOKES[i].test(s)) { if (C.spokes.indexOf(X.MG.SPOKES[i].k) >= 0) shots.push({ rid: r.id, t: r.t, course: r.course, hole: hi + 1, n: s.n, sg: s.sg, text: shotText(s), club: s.club || '', pen: s.pen !== 'none' }); break; } }); }); });
    var worst = shots.slice().sort(function (a, b) { return a.sg - b.sg; }).slice(0, 12), best = shots.slice().sort(function (a, b) { return b.sg - a.sg; }).slice(0, 5);
    var logs = X.MG.validPractice(A.practice || []).filter(function (e) { return C.spokes.indexOf(e.spoke) >= 0; }).sort(function (a, b) { return Date.parse(b.date) - Date.parse(a.date); });
    var m30 = 0, m90 = 0; logs.forEach(function (e) { var d = now - Date.parse(e.date); if (d <= 30 * DAY) m30 += e.min; if (d <= 90 * DAY) m90 += e.min; });
    var tcat = TEST_OF[C.k] || null, tests = tcat ? testsOf(A, L, P).map(function (t) { return { id: t.id, date: t.date, t: t.t, sg: t.cats[tcat] }; }) : [];
    var asc = rows.slice().reverse().map(function (r) { return { t: r.t, id: r.id, course: r.course, v: r.sg18 }; });
    return { cat: C, rows: rows, series: asc, avg5: avg5, usual: usual, delta: avg5 != null && usual != null ? avg5 - usual : null, shots: shots.length, worst: worst, best: best, logs: logs, m30: m30, m90: m90, tests: tests, testCat: tcat };
  }

  var API = { skillDetail: skillDetail, testsOf: testsOf, freshOf: freshOf, seenOf: seenOf, shotText: shotText, dtxt: dtxt, tOf: tOf, CATS: CATS, TEST_CATS: TEST_CATS, PERIODS: PERIODS, summary: summary, detail: detail, prepare: prepare, benchOf: benchOf, fmtSG: fmtSG, itemT: itemT, trendWord: trendWord, trendRate: trendRate };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.COACHCALC = API;
})(typeof self !== 'undefined' ? self : this);
