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
process.exit(bad ? 1 : 0);
