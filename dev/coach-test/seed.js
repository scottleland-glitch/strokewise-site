/* Test data for the coach site: ~10 athletes with realistic simulated rounds, short game tests and practice logs.
 * Fake names and fake data only. Deterministic (seeded random). Rounds use the app's row model (see sg.js), so the
 * real strokes-gained maths runs over them. load() writes it through the stand-in Firebase the same way the app does
 * (coach signs up, makes a team; each athlete signs up quietly, joins with the code and sends their data).
 */
const path = require('path');
const LIB = path.join(__dirname, '..', '..', 'coach', 'lib');
const SGTEST = require(path.join(LIB, 'shortgame.js'));
const DAY = 864e5;

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

// skill levels: 1.0 = about a good college player; bigger = worse for 'prox' style numbers, smaller = better
const TEAM = [
  { name: 'Maya Okafor',    bench: 'd1w', sk: { dist: 232, fwy: .66, gir: 1.1, prox: .9,  chip: .9,  bunk: 1.0, putt: 1.0, lag: .9 }, rounds: 26, gap: 6,  drift: {} },
  { name: 'Jake Moretti',   bench: 'd1m', sk: { dist: 276, fwy: .56, gir: 1.0, prox: 1.0, chip: 1.0, bunk: 1.1, putt: 1.0, lag: 1.0 }, rounds: 30, gap: 6,  drift: { putt: [1.05, .62] } },   // putting fades
  { name: 'Priya Raman',    bench: 'scw', sk: { dist: 218, fwy: .70, gir: .8,  prox: 1.35, chip: 1.2, bunk: 1.5, putt: .9, lag: 1.1 }, rounds: 18, gap: 9,  drift: { gir: [.75, 1.05], prox: [1.45, 1.0] } }, // approach improves
  { name: 'Liam Hendricks', bench: 'scm', sk: { dist: 262, fwy: .50, gir: .9,  prox: 1.2, chip: 1.4, bunk: 1.4, putt: 1.1, lag: 1.2 }, rounds: 22, gap: 7,  drift: {} },
  { name: 'Sofia Alvarez',  bench: 'd1w', sk: { dist: 240, fwy: .62, gir: 1.05, prox: .95, chip: .8, bunk: .9,  putt: 1.15, lag: .85 }, rounds: 28, gap: 6, drift: { dist: [236, 252] } },
  { name: 'Ethan Brooks',   bench: 'pga', sk: { dist: 292, fwy: .48, gir: 1.1, prox: 1.1, chip: 1.0, bunk: 1.0, putt: .95, lag: 1.0 }, rounds: 30, gap: 5, drift: { fwy: [.58, .40] } },  // driving fades
  { name: 'Hannah Kim',     bench: 'scw', sk: { dist: 226, fwy: .68, gir: .9, prox: 1.2, chip: 1.0, bunk: 1.2, putt: .85, lag: .9 }, rounds: 14, gap: 12, drift: {}, quiet: 36 },          // no rounds in 5 weeks
  { name: 'Marcus Webb',    bench: 'scm', sk: { dist: 270, fwy: .60, gir: 1.0, prox: 1.05, chip: 1.1, bunk: 1.3, putt: 1.05, lag: 1.05 }, rounds: 20, gap: 8, drift: {} },
  { name: 'Chloe Nguyen',   bench: 'd1w', sk: { dist: 234, fwy: .64, gir: .95, prox: 1.1, chip: 1.5, bunk: 1.2, putt: 1.0, lag: 1.0 }, rounds: 26, gap: 6, drift: { chip: [1.2, 1.75] } },     // chipping fades
  { name: 'Owen Fitzgerald', bench: 'd1m', sk: { dist: 268, fwy: .54, gir: 1.0, prox: 1.05, chip: 1.0, bunk: 1.0, putt: 1.0, lag: 1.0 }, rounds: 0, gap: 0, drift: {}, joinedDaysAgo: 3 } // just joined
];
const PARS = [4, 5, 3, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4];
const YDS = [396, 531, 172, 378, 405, 158, 541, 366, 388, 372, 165, 515, 384, 418, 142, 352, 502, 399];
const COURSES = ['Lakeridge', 'Wolf Run', 'Somersett', 'Arcade Creek', 'Red Hawk'];

// One simulated hole in the app's row model: each row is where the ball is when a stroke is hit (tee, fairway, green…);
// the last row is the stroke that goes in ('holed'). Score = number of rows.
function simHole(r, i, form) {
  const g = (k) => form[k], par = PARS[i];
  const norm = () => { let u = 0; for (let k = 0; k < 6; k++) u += r(); return (u - 3) / 0.7071; }, ln = (s) => Math.exp(norm() * s);
  const Y = Math.round(YDS[i] + (r() - 0.5) * 16), rows = [{ dist: Y, loc: 'tee', dir: '', pen: false }];
  const add = (dist, loc, dir, extra) => rows.push(Object.assign({ dist: Math.max(1, Math.round(dist)), loc, dir: dir || '', pen: false }, extra || {}));
  const dirs = ['left', 'right', 'longleft', 'longright', 'shortleft', 'shortright', 'short', 'long'];
  let pos; // 'green' | 'miss'
  const approach = (from, fromLie) => {
    const gir = clamp((0.80 - Math.max(0, from - 100) * 0.0023) * g('gir') * (fromLie === 'rough' ? .8 : 1), .08, .93);
    if (r() < gir) { add(clamp(from * 0.27 * g('prox') * ln(.55), 3, 90), 'green', pick(r, ['', 'short', 'long', 'left', 'right'])); return 'green'; }
    add(4 + r() * 20, r() < .17 ? 'bunker' : r() < .15 ? 'fairway' : 'rough', pick(r, dirs)); return 'miss';
  };
  if (par === 3) pos = approach(Y, 'tee');
  else {
    const D = clamp(g('dist') + norm() * 18, 160, 340), fw = r() < g('fwy'); let lie = fw ? 'fairway' : 'rough', remain = Y - D;
    if (par === 5 && remain > 255) { add(remain, lie, fw ? '' : pick(r, ['left', 'right'])); remain = Math.max(60, remain - (130 + r() * 150)); lie = r() < .7 ? 'fairway' : 'rough'; }
    add(remain, lie, fw ? '' : pick(r, ['left', 'right']));
    // the row just added is the ball position after the tee shot; the approach goes from there
    const from = rows[rows.length - 1]; pos = approach(from.dist, from.loc);
  }
  if (pos === 'miss') {
    const last = rows[rows.length - 1], sand = last.loc === 'bunker';
    if (r() < .03) { last.holeOut = true; return { par, rows, finished: true }; }
    if (sand && r() < .1 * g('bunk')) add(last.dist * .6 + 2, 'bunker', pick(r, dirs));
    const l2 = rows[rows.length - 1], sd = l2.loc === 'bunker';
    add(clamp((sd ? 17 * g('bunk') : 11 * g('chip')) * (1 + l2.dist / 40) * ln(.6), 2, 60), 'green', pick(r, ['', 'short', 'long', 'left', 'right']));
  }
  // putting: the last row is the green row (distance = first putt); each miss adds a row; the stroke that goes in is the final 'holed' row
  let d = rows[rows.length - 1].dist, n = 0;
  for (;;) {
    n++;
    const pm = 1 / (1 + Math.pow(d / (10 * g('putt')), 2.3));
    if (r() < pm || n >= 4) { rows[rows.length - 1].loc = n === 1 && rows[rows.length - 1].loc === 'green' ? 'holed' : rows[rows.length - 1].loc; break; }
    const left = d > 12 ? clamp(d * 0.1 * g('lag') * ln(.55) + .8, 1, 14) : clamp(1.2 + r() * 3.4 * g('putt'), 1, 7);
    add(left, 'green', pick(r, ['short', 'long', 'left', 'right', 'shortleft', 'longright'])); d = left;
  }
  if (rows[rows.length - 1].loc !== 'holed') rows[rows.length - 1].loc = 'holed';
  // what the athlete would also enter: the club for each full shot, the read of each putt, the pin spot
  const IRON = [[215, '4H'], [195, '5H'], [180, '5i'], [168, '6i'], [157, '7i'], [145, '8i'], [132, '9i'], [118, 'PW'], [100, '52'], [80, '56'], [0, '60']];
  rows.forEach((row, k) => { if (row.loc === 'tee') row.club = par === 3 ? (IRON.find((x) => row.dist >= x[0]) || IRON[IRON.length - 1])[1] : (g('dist') > 255 || r() < .8 ? 'Driver' : '3W');
    else if (row.loc === 'green' || row.loc === 'holed') { if (k > 0 && r() < .9) row.rd = pick(r, ['up', 'flat', 'down']) + '-' + pick(r, ['l', 's', 'r']); }
    else if (row.loc !== 'green') row.club = (IRON.find((x) => row.dist >= x[0]) || IRON[IRON.length - 1])[1]; });
  const PINS = ['backleft', 'backcenter', 'backright', 'midleft', 'center', 'midright', 'frontleft', 'frontcenter', 'frontright'];
  return { par, rows, finished: true, pin: r() < .8 ? pick(r, PINS) : '' };
}

function formAt(sk, drift, f) { // f: 0 (oldest round) → 1 (newest); a drifting skill moves from its start to its end value
  const o = Object.assign({}, sk); Object.keys(drift).forEach((k) => { o[k] = drift[k][0] + (drift[k][1] - drift[k][0]) * f; }); return o;
}

function buildAthlete(spec, idx, now) {
  const r = rng(1000 + idx * 77), uidTag = idx;
  const rounds = [], practice = [], tests = [];
  const last = now - (spec.quiet || (1 + Math.floor(r() * 6))) * DAY;
  for (let k = 0; k < spec.rounds; k++) {
    const f = spec.rounds > 1 ? k / (spec.rounds - 1) : 1, t = last - (spec.rounds - 1 - k) * spec.gap * DAY * (0.7 + r() * 0.6);
    const form = formAt(spec.sk, spec.drift, f), holes = roundHoles(r, form);
    const nine = k % 9 === 4; // an occasional 9-hole round
    const iso = new Date(t).toISOString();
    rounds.push({ v: 3, dv: 2, id: 'r' + idx + '_' + k, date: iso, updated: iso, course: pick(r, COURSES), baseline: spec.bench, player: spec.name, play: r() < .25 ? 'tournament' : 'practice', holes: nine ? holes.slice(0, 9) : holes });
  }
  // practice logs: minutes by skill, weighted away from where the athlete is weak (so the comparison has a story)
  const FOC = { drive: 'Mechanics', irons: 'Distance control', wedges: 'Distance control', chip: 'Green-side chipping', bunker: 'Bunker shots', lag: 'Lag putting', short: 'Short putts' };
  const weights = { drive: 3, irons: 3, wedges: 1.5, chip: 1, bunker: .4, lag: 1.2, short: 1.2 };
  if (idx === 7 || idx === 8) weights.chip = 3; if (idx === 1) { weights.short = .3; weights.lag = .3; } if (idx === 8) weights.chip = 0.3;
  if (spec.rounds) for (let d = 70; d >= 0; d -= 2) { if (r() < .35) continue; const keys = Object.keys(weights), tot = keys.reduce((s, k) => s + weights[k], 0); let x = r() * tot, sp = keys[0];
    for (const k of keys) { x -= weights[k]; if (x <= 0) { sp = k; break; } }
    const iso = new Date(now - d * DAY).toISOString().slice(0, 10) + 'T12:00:00'; practice.push({ id: 'p' + idx + '_' + d, date: iso, player: spec.name, spoke: sp, focus: FOC[sp], min: pick(r, [20, 30, 30, 45, 60, 75]), type: pick(r, ['reps', 'mixed', 'game']), feel: pick(r, ['off', 'ok', 'ok', 'great']) }); }
  // Practice tab (v230 port): a second area on some days so "Each day, by group" and the rolling chart stack several groups.
  // Its own random stream, so the rounds, tests and first-pass practice above are unchanged.
  if (spec.rounds) { const r2 = rng(5000 + idx * 13), XS = ['lag', 'short', 'chip', 'wedges', 'irons', 'drive', 'bunker'];
    for (let d = 70; d >= 0; d--) { if (r2() < .6) continue; const sp = pick(r2, XS);
      practice.push({ id: 'p' + idx + '_x' + d, date: new Date(now - d * DAY).toISOString().slice(0, 10) + 'T17:00:00', player: spec.name, spoke: sp, focus: FOC[sp], min: pick(r2, [15, 20, 30, 30, 45]), type: pick(r2, ['reps', 'mixed', 'game']), feel: pick(r2, ['ok', 'ok', 'great']) }); } }
  if (spec.rounds && idx <= 4) { const ds = [6, 24, 52][idx % 3], big = idx === 4; practice.push({ id: 'p' + idx + '_lesson', date: new Date(now - (idx === 0 ? 6 : ds) * DAY).toISOString().slice(0, 10) + 'T10:00:00', player: spec.name, spoke: idx === 1 ? 'short' : 'chip', focus: idx === 1 ? 'Putting stroke' : 'Chipping setup', min: 60, kind: 'lesson', change: big ? 'big' : 'tune', coach: 'Coach Rivera', what: idx === 1 ? 'Stroke path' : 'Ball position', lesson: 'Narrow stance, weight forward', type: 'mixed', feel: 'great' }); }
  // short game tests: monthly
  const nT = spec.rounds ? (idx === 6 ? 1 : idx === 1 ? 4 : 2 + (idx % 3)) : 0;
  for (let k = 0; k < nT; k++) { const age = idx === 6 ? 55 : (nT - 1 - k) * 28 + 6 + idx;
    const t = SGTEST.blank('t' + idx + '_' + k, new Date(now - age * DAY).toISOString(), spec.name, spec.bench); t.done = true;
    SGTEST.STATIONS.forEach((st, si) => { if (!SGTEST.inTest(t, st)) return; const q = formAt(spec.sk, spec.drift, 0.4 + 0.6 * (k / Math.max(1, nT - 1)));
      t.shots[st.id] = st.shots.map((spec2) => testShot(r, st, spec2, q)); });
    tests.push(t); }
  const profile = { bench: spec.bench, mode: idx === 3 ? 'log' : 'full', typical: { h: 3, r: 4 } };
  return { name: spec.name, rounds, tests, practice, profile };
}
function roundHoles(r, form) { const h = []; for (let i = 0; i < 18; i++) h.push(simHole(r, i, form)); return h; }
function testShot(r, st, sp, q) {
  const norm = () => { let u = 0; for (let k = 0; k < 6; k++) u += r(); return (u - 3) / 0.7071; }, ln = (s) => Math.exp(norm() * s);
  if (st.kind === 'lag') return { ft: Math.round(clamp(sp.dist * .1 * q.lag * ln(.5) + 1, 1, 30) * 10) / 10, dir: r() < .55 ? 'short' : 'long' };
  if (st.kind === 'ladder') return { n: 2 + Math.floor(r() * 3) };
  if (st.kind === 'compass') { const made = r() < clamp(1 / (1 + Math.pow(sp.dist / (10 * q.putt), 2.3)), .1, .97); return made ? { made: true } : { made: false, miss: pick(r, ['short', 'long', 'left', 'right']) }; }
  if (st.kind === 'updown') return { n: clamp(Math.round(10 * clamp(.5 / q.chip + .08, .1, .9) + norm()), 0, 10) };
  if (st.kind === 'bunker') { if (r() < .12 * q.bunk) return { res: 'sand' }; return { ft: Math.round(clamp(st.dist * .9 * q.bunk * ln(.55) + 4, 2, 60)) }; }
  if (st.kind === 'wedge') return { ft: Math.round(clamp(sp.dist * .26 * q.prox * ln(.5), 3, 80)), dir: pick(r, ['', 'short', 'long', 'left', 'right']) };
  return { ft: Math.round(clamp(st.dist * .45 * q.chip * ln(.55) + 3, 2, 45) * 10) / 10 }; // chips: leave in ft
}

// v246: launch-monitor sessions for the first two athletes – 24 shots at 150 (short and right for Jake), 12 at 120
function simFor(a, now) {
  const idx = TEAM.findIndex((t) => t.name === a.name); if (idx > 1) return [];
  const r = rng(7100 + idx), g = () => { let u = 0; for (let k = 0; k < 6; k++) u += r(); return (u - 3) / 0.7071; }, shots = [];
  for (let i = 0; i < 24; i++) shots.push({ club: '8i', target: 150, carry: Math.round((150 - (idx ? 1 : 5) + g() * 5) * 10) / 10, total: null, offline: Math.round(((idx ? -1 : 3) + g() * 6) * 10) / 10 });
  for (let i = 0; i < 12; i++) shots.push({ club: 'PW', target: 120, carry: Math.round((119 + g() * 3) * 10) / 10, total: null, offline: Math.round(g() * 4 * 10) / 10 });
  return [{ id: 'sim' + idx, date: new Date(now - 3 * DAY).toISOString(), source: 'csv', name: 'GCQuad session', shots }];
}
function build(now) { return TEAM.map((s, i) => Object.assign({ spec: s }, buildAthlete(s, i, now))); }

// write it through the stand-in server the way the app does
async function load(base, now) {
  const A = base + '/auth/', DB = base + '/db/', J = { 'Content-Type': 'application/json' };
  const post = async (op, body) => (await fetch(A + 'accounts:' + op + '?key=x', { method: 'POST', headers: J, body: JSON.stringify(body) })).json();
  const put = async (m, p, tok, body) => { const r = await fetch(DB + p + '.json?auth=' + tok, { method: m, headers: J, body: JSON.stringify(body) }); if (!r.ok) throw new Error(m + ' ' + p + ' ' + r.status); };
  const coach = { email: 'coach@strokewise.test', pw: 'coach-demo-pw1', name: 'Dana Rivera', team: 'Lakeridge High Golf', code: 'QK7-4MZ' };
  const cj = await post('signUp', { email: coach.email, password: coach.pw, returnSecureToken: true });
  const teamId = 'teamLakeridge0001abcd', info = { name: coach.team, coachName: coach.name, coach: cj.localId, code: coach.code, created: now - 200 * DAY };
  await put('PUT', 'teams/' + teamId + '/info', cj.idToken, info); await put('PUT', 'codes/' + coach.code, cj.idToken, teamId); await put('PUT', 'coaches/' + cj.localId, cj.idToken, { team: teamId });
  const out = build(now);
  for (const a of out) {
    const aj = await post('signUp', { returnSecureToken: true }), tok = aj.idToken, uid = aj.localId, joined = a.spec.joinedDaysAgo ? now - a.spec.joinedDaysAgo * DAY : now - 150 * DAY;
    await put('PUT', 'teams/' + teamId + '/members/' + uid, tok, { name: a.name, at: joined, parentOk: false });
    const up = { team: teamId, name: a.name, joined, stamp: now - 3600e3, profile: { j: JSON.stringify(a.profile) } };
    a.sim = simFor(a, now); // v246 sim dispersion sessions (their own random stream, so nothing else changes)
    ['rounds', 'tests', 'practice', 'sim'].forEach((k) => (a[k] || []).forEach((it) => { it.player = a.name; up[k + '/' + it.id] = { j: JSON.stringify(it), u: Date.parse(it.updated || it.date) || now }; }));
    // PATCH keys with slashes set nested paths
    await put('PATCH', 'data/' + uid, tok, up); a.uid = uid; a.tok = tok;
  }
  return { coach, teamId, athletes: out };
}
// new items arriving from an athlete's phone after the coach has looked: { tests: n, practice: n, rounds: n }. Returns what it wrote.
async function pushNew(base, a, kinds, now) {
  const idx = TEAM.findIndex((t) => t.name === a.name), r = rng(9000 + idx * 31 + (kinds.salt || 0)), spec = a.spec, out = { rounds: [], tests: [], practice: [] }, iso = new Date(now).toISOString(), up = {};
  for (let k = 0; k < (kinds.rounds || 0); k++) { const holes = roundHoles(r, formAt(spec.sk, spec.drift, 1)); out.rounds.push({ v: 3, dv: 2, id: 'rn' + idx + '_' + k + '_' + (kinds.salt || 0), date: iso, updated: iso, course: 'Lakeridge', baseline: spec.bench, player: spec.name, play: 'practice', holes }); }
  for (let k = 0; k < (kinds.tests || 0); k++) { const t = SGTEST.blank('tn' + idx + '_' + k + '_' + (kinds.salt || 0), iso, spec.name, spec.bench); t.done = true; t.updated = iso;
    SGTEST.STATIONS.forEach((st) => { if (!SGTEST.inTest(t, st)) return; const q = formAt(spec.sk, Object.assign({}, spec.drift, { lag: [spec.sk.lag, spec.sk.lag * 1.9] }), 1); t.shots[st.id] = st.shots.map((sp) => testShot(r, st, sp, q)); }); out.tests.push(t); }
  for (let k = 0; k < (kinds.practice || 0); k++) out.practice.push({ id: 'pn' + idx + '_' + k + '_' + (kinds.salt || 0), date: iso.slice(0, 10) + 'T12:00:00', updated: iso, player: spec.name, spoke: 'chip', focus: 'Green-side chipping', min: 45, type: 'mixed', feel: 'ok' });
  ['rounds', 'tests', 'practice'].forEach((k) => out[k].forEach((it) => { up[k + '/' + it.id] = { j: JSON.stringify(it), u: now }; })); up.stamp = now;
  const r2 = await fetch(base + '/db/data/' + a.uid + '.json?auth=' + a.tok, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(up) }); if (!r2.ok) throw new Error('pushNew ' + r2.status);
  return out;
}
module.exports = { build, load, pushNew, TEAM, DAY };
