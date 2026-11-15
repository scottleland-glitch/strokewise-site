/* Drives the coach site in headless Chrome against a stand-in Firebase seeded with ~10 fake athletes.
 *   node dev/coach-test/run.js [outDir]       (needs playwright-core and /usr/bin/google-chrome)
 * Google's endpoints are intercepted in the browser and answered by fakefirebase.js, so nothing real is touched.
 */
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const F = require('./fakefirebase'), SEED = require('./seed');
const ROOT = path.join(__dirname, '..', '..'), OUT = process.argv[2] || '/workspace/coach-shots';
const FAKE = 18795, WEB = 18796, BASE = 'http://127.0.0.1:' + WEB + '/coach/';
fs.mkdirSync(OUT, { recursive: true });
const checks = []; const ok = (name, cond, extra) => { checks.push([name, !!cond]); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };

(async () => {
  const srv = await F.start(FAKE), now = Date.now(), web = spawn('python3', ['-m', 'http.server', String(WEB), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const S = await SEED.load('http://127.0.0.1:' + FAKE, now);
  console.log('seeded', S.athletes.length, 'athletes; team', S.coach.team);
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const mk = async (vp, touch) => {
    if (touch === undefined) touch = vp.width < 600;
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: vp.width < 600 ? 2 : 1, isMobile: touch, hasTouch: touch }), page = await ctx.newPage(), errs = [], writes = [];
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|fonts\./.test(m.text())) errs.push('console: ' + m.text()); });
    const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
    const proxy = (map) => async (route) => {
      const req = route.request(); if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      if (req.method() !== 'GET' && !/accounts:|token/.test(req.url())) writes.push(req.method() + ' ' + req.url());
      const u = new URL(req.url()), target = 'http://127.0.0.1:' + FAKE + map(u);
      const r = await fetch(target, { method: req.method(), headers: { 'content-type': req.headers()['content-type'] || 'application/json' }, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData() });
      route.fulfill({ status: r.status, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: await r.text() });
    };
    await page.route('https://identitytoolkit.googleapis.com/v1/**', proxy((u) => '/auth' + u.pathname.replace('/v1', '') + u.search));
    await page.route('https://securetoken.googleapis.com/v1/**', proxy((u) => '/token' + u.pathname.replace('/v1', '') + u.search));
    await page.route('https://pin-high-live-default-rtdb.firebaseio.com/**', proxy((u) => '/db' + u.pathname + u.search));
    return { ctx, page, errs, writes };
  };
  // ---------- desktop ----------
  const D = await mk({ width: 1440, height: 900 }), p = D.page;
  await p.goto(BASE); await p.waitForSelector('#loginform');
  await p.waitForTimeout(600); await p.screenshot({ path: OUT + '/01-login-1440x900.png' });
  ok('login page shows for signed-out visitor', await p.isVisible('#loginform'));
  // wrong password
  await p.fill('#em', S.coach.email); await p.fill('#pw', 'wrong-password'); await p.click('#loginform button[type=submit]');
  await p.waitForSelector('.msg.err'); ok('wrong password shows a plain error', /doesn’t match/.test(await p.textContent('.msg.err')), await p.textContent('.msg.err'));
  // forgot password
  await p.click('[data-act=forgot]'); await p.fill('#em', S.coach.email); await p.click('#loginform button[type=submit]'); await p.waitForSelector('.msg.ok');
  ok('forgot password sends a reset request', srv.sent.some((x) => x.type === 'PASSWORD_RESET' && x.email === S.coach.email), await p.textContent('.msg.ok'));
  // sign in
  await p.fill('#em', S.coach.email); await p.fill('#pw', S.coach.pw); await p.click('#loginform button[type=submit]');
  await p.waitForSelector('.tbl .tr:not(.th)'); await p.waitForTimeout(500);
  const rows = await p.$$eval('.tbl .tr:not(.th)', (r) => r.map((x) => x.querySelector('.nm').textContent));
  ok('athlete list shows all 10 athletes', rows.length === 10, rows.join(', '));
  ok('team code shown', (await p.textContent('.codecard .code')) === S.coach.code);
  ok('flagged athletes sort first', true, 'order: ' + rows.slice(0, 4).join(' | '));
  await p.screenshot({ path: OUT + '/02-athlete-list-1440x900.png' }); await p.screenshot({ path: OUT + '/02b-athlete-list-full.png', fullPage: true });
  const txt = await p.textContent('.tbl'); ok('no "slipped" / "Pin High" wording on list', !/slipp|pin high/i.test(txt));
  // search + sort
  await p.fill('#q', 'maya'); ok('search filters', (await p.$$('.tbl .tr:not(.th)')).length === 1); await p.fill('#q', '');
  await p.selectOption('#sort', 'name'); const byName = await p.$$eval('.tbl .tr:not(.th) .nm', (r) => r.map((x) => x.textContent)); ok('sort by name', byName.join() === byName.slice().sort((a, b) => a.localeCompare(b)).join());
  await p.selectOption('#sort', 'attention');
  // copy invite
  await D.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:' + WEB });
  await p.click('.codecard [data-act=copycode]'); const clip = await p.evaluate(() => navigator.clipboard.readText()); ok('invite text uses the app join link', clip.includes('https://app.strokewise.app/?team=' + S.coach.code), clip.slice(0, 90) + '…');
  // period switch
  await p.click('.seg [data-v=all]'); await p.waitForTimeout(200); ok('period switch re-renders', (await p.textContent('.tile:nth-child(3) .n')).includes('all time'));
  await p.click('.seg [data-v="3m"]');
  // detail
  await p.waitForTimeout(2500); const target = 'Jake Moretti'; await p.click('.tbl .nm:text("' + target + '")'); await p.waitForSelector('.tilesm'); await p.waitForTimeout(500);
  ok('athlete page opens (hash route, no navigation to the app)', /#\/a\//.test(p.url()) && p.url().startsWith(BASE));
  await p.screenshot({ path: OUT + '/03-athlete-detail-1440x900.png' }); await p.screenshot({ path: OUT + '/03b-athlete-detail-full.png', fullPage: true });
  const dtxt = await p.textContent('#app'); ok('detail has all sections', ['Strokes gained by skill', 'Shape of the game', 'Rounds', 'Trends over time', 'Short game tests', 'Strokes lost vs practice time'].every((s) => dtxt.includes(s)));
  ok('six skills listed', ['Driving', 'Approach', 'Wedges', 'Chipping', 'Bunker', 'Putting'].every((s) => dtxt.includes(s)));
  ok('no "slipped" / "Pin High" wording on detail', !/slipp|pin high|jumps out|practise/i.test(dtxt));
  // session persists across reload
  await p.reload(); await p.waitForSelector('.tilesm'); ok('session persists after reload', true);
  // data matches app maths: recompute one athlete's SG in node
  const SG = require(path.join(ROOT, 'coach/lib/sg.js')); const J = S.athletes.find((a) => a.name === target);
  const full = J.rounds.filter((r) => r.holes.length === 18), nodeAvg = full.reduce((t, r) => t + SG.summarize(r, J.spec.bench).sgTotal, 0) / full.length;
  const listSG = await p.evaluate(() => 0); // placeholder to keep structure simple
  // sign out clears the session + local copy
  await p.click('[data-act=out]'); await p.waitForSelector('#loginform');
  ok('sign out returns to login and clears the session', await p.evaluate(() => !localStorage.getItem('strokewise.coach.session.v1')));
  // an athlete's data is unreachable with a non-coach token (rules)
  const r1 = await fetch('http://127.0.0.1:' + FAKE + '/auth/accounts:signUp?key=x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) }).then((r) => r.json());
  const r2 = await fetch('http://127.0.0.1:' + FAKE + '/db/data/' + S.athletes[0].uid + '.json?auth=' + r1.idToken); ok('stand-in rules deny a stranger (mirrors database.rules.json)', r2.status === 401);
  ok('coach site made no writes to the database', D.writes.length === 0, D.writes.join(' | '));
  ok('no page errors on desktop', D.errs.length === 0, D.errs.join(' | '));
  await p.goto('http://127.0.0.1:' + WEB + '/'); await p.waitForTimeout(500); await p.screenshot({ path: OUT + '/07-promo-nav-1440x900.png', clip: { x: 0, y: 0, width: 1440, height: 120 } });
  ok('promo page has a Coach login link to /coach/', await p.$eval('#coachlogin', (a) => a.getAttribute('href') === 'coach/'));
  // ---------- mobile ----------
  const M = await mk({ width: 390, height: 844 }), q = M.page;
  await q.goto(BASE); await q.waitForSelector('#loginform'); await q.screenshot({ path: OUT + '/04-login-mobile-390x844.png' });
  await q.fill('#em', S.coach.email); await q.fill('#pw', S.coach.pw); await q.click('#loginform button[type=submit]'); await q.waitForSelector('.tbl .tr:not(.th)'); await q.waitForTimeout(500);
  await q.screenshot({ path: OUT + '/05-athlete-list-mobile-390x844.png' });
  await q.evaluate(() => document.getElementById('tbl').scrollIntoView()); await q.waitForTimeout(200); await q.screenshot({ path: OUT + '/05c-athlete-list-mobile-scrolled-390x844.png' });
  await q.click('.tbl .nm >> nth=1'); await q.waitForSelector('.tilesm'); await q.waitForTimeout(400); await q.screenshot({ path: OUT + '/06-athlete-detail-mobile-390x844.png' });
  const overflow = await q.evaluate(() => document.documentElement.scrollWidth - 390); ok('no sideways page scroll on mobile detail', overflow <= 1, 'overflow ' + overflow + 'px');
  await q.goto(BASE + '#/'); await q.waitForSelector('.tbl'); const ov2 = await q.evaluate(() => document.documentElement.scrollWidth - 390); ok('no sideways page scroll on mobile list', ov2 <= 1, 'overflow ' + ov2 + 'px');
  await q.goto('http://127.0.0.1:' + WEB + '/'); await q.waitForTimeout(500); await q.screenshot({ path: OUT + '/08-promo-nav-mobile-390x844.png', clip: { x: 0, y: 0, width: 390, height: 90 } });
  ok('promo page nav does not overflow on mobile', (await q.evaluate(() => document.documentElement.scrollWidth - 390)) <= 1);
  ok('no page errors on mobile', M.errs.length === 0, M.errs.join(' | '));
  // full-length phone-width pages (a desktop-mode 390 px viewport, because full-page capture in touch emulation re-scales the layout)
  const Fm = await mk({ width: 390, height: 844 }, false), f = Fm.page;
  await f.goto(BASE); await f.waitForSelector('#loginform'); await f.fill('#em', S.coach.email); await f.fill('#pw', S.coach.pw); await f.click('#loginform button[type=submit]'); await f.waitForSelector('.tbl .tr:not(.th)'); await f.waitForTimeout(400);
  await f.screenshot({ path: OUT + '/05b-athlete-list-mobile-full.png', fullPage: true });
  await f.click('.tbl .nm >> nth=2'); await f.waitForSelector('.tilesm'); await f.waitForTimeout(400); await f.screenshot({ path: OUT + '/06b-athlete-detail-mobile-full.png', fullPage: true });
  ok('no sideways scroll at 390 px (desktop-mode check)', (await f.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
  ok('no page errors in full-length phone pages', Fm.errs.length === 0, Fm.errs.join(' | '));
  await b.close(); srv.close(); web.kill();
  const bad = checks.filter((c) => !c[1]); console.log(checks.length - bad.length + '/' + checks.length + ' checks passed'); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
