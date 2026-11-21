/* v246 Dispersion tab on the coach site: an athlete's sim shots (app v245 screens, read-only).
 *   node dev/coach-test/dispersion.js [outDir]
 */
const { chromium } = require('playwright-core'); const { spawn } = require('child_process'); const fs = require('fs'), path = require('path'), assert = require('assert');
const F = require('./fakefirebase'), SEED = require('./seed');
const ROOT = path.join(__dirname, '..', '..'), OUT = process.argv[2] || '/tmp/coach-disp'; fs.mkdirSync(OUT, { recursive: true });
const FAKE = 18895, WEB = 18896, BASE = 'http://127.0.0.1:' + WEB + '/coach/';
(async () => {
  const srv = await F.start(FAKE), now = Date.now(), web = spawn('python3', ['-m', 'http.server', String(WEB), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800)); const S = await SEED.load('http://127.0.0.1:' + FAKE, now);
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
  const mk = async (vp) => { const touch = vp.width < 600, ctx = await b.newContext({ viewport: vp, deviceScaleFactor: touch ? 2 : 1, isMobile: touch, hasTouch: touch }), page = await ctx.newPage(), errs = [], writes = [];
    page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|fonts\./.test(m.text())) errs.push(m.text()); });
    const proxy = (map) => async (route) => { const req = route.request(); if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      if (req.method() !== 'GET' && !/accounts:|token/.test(req.url())) writes.push(req.method() + ' ' + req.url());
      const u = new URL(req.url()), r = await fetch('http://127.0.0.1:' + FAKE + map(u), { method: req.method(), headers: { 'content-type': 'application/json' }, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData() });
      route.fulfill({ status: r.status, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: await r.text() }); };
    await page.route('https://identitytoolkit.googleapis.com/v1/**', proxy((u) => '/auth' + u.pathname.replace('/v1', '') + u.search));
    await page.route('https://securetoken.googleapis.com/v1/**', proxy((u) => '/token' + u.pathname.replace('/v1', '') + u.search));
    await page.route('https://pin-high-live-default-rtdb.firebaseio.com/**', proxy((u) => '/db' + u.pathname + u.search));
    await page.goto(BASE); await page.waitForSelector('#loginform'); await page.fill('#em', S.coach.email); await page.fill('#pw', S.coach.pw); await page.click('#loginform button[type=submit]'); await page.waitForSelector('.acard');
    return { page, errs, writes }; };
  try {
    const A0 = S.athletes[0], A2 = S.athletes[2];
    for (const [vp, tag] of [[{ width: 1440, height: 900 }, 'desktop'], [{ width: 390, height: 844 }, 'phone']]) {
      const { page: p, errs, writes } = await mk(vp);
      await p.evaluate((u) => { location.hash = '#/a/' + encodeURIComponent(u); }, A0.uid); await p.waitForSelector('.atabs');
      assert.ok(await p.$('.atabs a[href$="/dispersion"]'), 'Dispersion tab'); await p.click('.atabs a[href$="/dispersion"]'); await p.waitForSelector('.appui.disp #dspcv');
      assert.strictEqual(await p.textContent('.atabs a.on'), 'Dispersion'); assert.strictEqual(await p.$('.appui .dsppage .topbar'), null, 'no phone top bar');
      assert.strictEqual(await p.$('#dspfile'), null, 'no import'); assert.strictEqual(await p.$('[data-act="dspmanual"]'), null, 'no enter shots'); assert.strictEqual(await p.$('.dspdel'), null, 'no delete');
      assert.deepStrictEqual(await p.$$eval('#dspyds .dspyd b', (e) => e.map((x) => x.textContent)), ['PW', '8i']); assert.strictEqual(await p.textContent('#dspyds .dspyd.sel b'), '8i');
      assert.match(await p.textContent('.dspstrat .dspsub'), /click a pin/);
      await p.waitForTimeout(400); await p.screenshot({ path: OUT + '/01-' + tag + '.png', fullPage: true });
      await p.click('[data-act="dsppin"][data-v="frontright"]'); await p.waitForTimeout(700); await p.locator('.dspstrat').screenshot({ path: OUT + '/02-' + tag + '-pin-hop.png' });
      await p.waitForTimeout(1600); await p.locator('.dspstrat').screenshot({ path: OUT + '/03-' + tag + '-pin.png' }); assert.match(await p.textContent('#dspbest'), /Front right/);
      await p.click('[data-act="dspaim"][data-v="gir"]'); await p.waitForTimeout(1200); assert.match(await p.textContent('#dspbest'), /most greens: aim/); await p.locator('.dspstrat').screenshot({ path: OUT + '/06-' + tag + '-aim.png' }); await p.click('[data-act="dspaim"][data-v="flag"]');
      await p.click('#dspgo'); await p.waitForTimeout(1500); await p.locator('.dspplay').screenshot({ path: OUT + '/04-' + tag + '-flight.png' });
      await p.click('[data-act="dspclub"][data-v="pw"]'); await p.waitForSelector('.dspyd.sel'); assert.strictEqual(await p.textContent('#dspyds .dspyd.sel b'), 'PW');
      // benchmark switch recalculates
      const before = await p.textContent('#dspbest'); await p.selectOption('select[data-sel="bench"]', 'd1m'); await p.waitForTimeout(300); assert.notStrictEqual(await p.textContent('#dspbest'), before, 'benchmark changes the numbers');
      // v247 rounds, by distance (the athlete's real rounds)
      await p.click('[data-act="dspsrc"][data-v="rounds"]'); await p.waitForSelector('#dspactual, #dspfew'); assert.ok(await p.$('#dspactual'), 'round dispersion shows'); await p.waitForTimeout(300); await p.screenshot({ path: OUT + '/05-' + tag + '-rounds.png', fullPage: true });
      assert.ok(await p.$('#dsprgrid'), 'pin grid'); const c1 = await p.$('#dsprgrid .dspcell[data-act="dsprpin"]'); if (c1) { await c1.click(); await p.waitForTimeout(2600); assert.match(await p.textContent('#dspactual, #dspfew'), /pins/); await p.screenshot({ path: OUT + '/07-' + tag + '-rounds-pin.png', fullPage: true }); }
      await p.click('[data-act="dspsrc"][data-v="sim"]'); await p.waitForSelector('#dspgrid');
      // an athlete with no sim shots
      await p.evaluate((u) => { location.hash = '#/a/' + encodeURIComponent(u) + '/dispersion'; }, A2.uid); await p.waitForSelector('#dspempty'); assert.match(await p.textContent('#dspempty'), /No sim shots shared yet/);
      assert.deepStrictEqual(errs, []); assert.deepStrictEqual(writes, [], 'read-only: nothing written'); console.log('PASS ' + tag);
    }
  } finally { await b.close(); web.kill(); srv.close && srv.close(); }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
