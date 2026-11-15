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
process.exit(bad ? 1 : 0);
