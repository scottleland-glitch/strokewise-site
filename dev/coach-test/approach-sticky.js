/* v276 Stats › Approach on the website: distance chips pinned under the site header; switching distance keeps the proximity chart in view.
 *   node dev/coach-test/approach-sticky.js <outDir>   (phone size 390x844) */
const { chromium } = require('playwright-core'); const { spawn } = require('child_process'); const fs = require('fs'), path = require('path');
const F = require('./fakefirebase'), SEED = require('./seed'); const ROOT = path.join(__dirname, '..', '..');
const OUT = process.argv[2] || '/tmp/approach-sticky', W = 390, Hh = 844; const assert = require('assert'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const srv = await F.start(18795), web = spawn('python3', ['-m', 'http.server', '18796', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 700));
  const S = await SEED.load('http://127.0.0.1:18795', Date.now()); const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const mob = W < 600 && !process.env.DESK, ctx = await b.newContext({ viewport: { width: W, height: Hh }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob }), page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message, (e.stack || '').split('\n').slice(0, 3).join(' | '))); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|fonts\./.test(m.text())) console.log('CONSOLE', m.text().slice(0, 300)); });
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
  const proxy = (map) => async (route) => { const req = route.request(); if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS }); const u = new URL(req.url());
    const r = await fetch('http://127.0.0.1:18795' + map(u), { method: req.method(), headers: { 'content-type': req.headers()['content-type'] || 'application/json' }, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData() });
    route.fulfill({ status: r.status, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: await r.text() }); };
  await page.route('https://identitytoolkit.googleapis.com/v1/**', proxy((u) => '/auth' + u.pathname.replace('/v1', '') + u.search));
  await page.route('https://securetoken.googleapis.com/v1/**', proxy((u) => '/token' + u.pathname.replace('/v1', '') + u.search));
  await page.route('https://pin-high-live-default-rtdb.firebaseio.com/**', proxy((u) => '/db' + u.pathname + u.search));
  await page.goto('http://127.0.0.1:18796/coach/'); await page.waitForSelector('#loginform'); await page.fill('#em', S.coach.email); await page.fill('#pw', S.coach.pw); await page.click('#loginform button[type=submit]');
  await page.waitForSelector('.cards .acard, .tbl .tr', { timeout: 15000 }); await page.waitForTimeout(500);
  const uid = S.athletes[0].uid; let errs = 0; page.on('pageerror', () => errs++);
  await page.evaluate((h) => { location.hash = h; }, '#/a/' + encodeURIComponent(uid) + '/stats'); await page.waitForSelector('#stcat-approach .stcath'); await page.click('#stcat-approach .stcath'); await page.waitForSelector('#stabseg');
  await page.$eval('#st-prox', (e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 260)); await page.waitForTimeout(300);
  const pin = await page.evaluate(() => ({ seg: document.getElementById('stabseg').getBoundingClientRect().top, hdr: document.querySelector('body > header').getBoundingClientRect().bottom }));
  assert.ok(pin.seg >= pin.hdr - 1 && pin.seg <= pin.hdr + 12, 'chips pinned under the header ' + JSON.stringify(pin)); console.log('PASS chips pinned under the site header', JSON.stringify(pin));
  for (const id of ['w60', 'o100', 'w30']) { await page.click('#stabseg button[data-v="' + id + '"]'); await page.waitForTimeout(400);
    const r = await page.evaluate((i) => { const c = document.getElementById('st-abp' + i).getBoundingClientRect(), s = document.getElementById('stabseg').getBoundingClientRect(); return { c: c.top, s: s.bottom, h: innerHeight }; }, id);
    assert.ok(r.c >= r.s - 1 && r.c < r.h * 0.6, id + ' proximity in view ' + JSON.stringify(r)); console.log('PASS ' + id + ' proximity chart in view', JSON.stringify(r)); }
  await page.screenshot({ path: OUT + '/web-approach-sticky.png' });
  const tc = await page.evaluate(() => { const a = document.querySelector('.appui'), b = document.createElement('button'); b.className = 'dspev sel'; b.innerHTML = '<b>Lakehouse</b><span>x</span>'; a.appendChild(b);
    const r = [getComputedStyle(b).backgroundColor, getComputedStyle(b.querySelector('b')).color]; b.remove(); return r; });
  assert.deepStrictEqual(tc, ['rgb(31, 45, 56)', 'rgb(255, 255, 255)']); console.log('PASS picked tournament: white name on the dark button', JSON.stringify(tc));
  const v = await page.$$eval('script[src], link[rel=stylesheet][href]', (L) => L.filter((e) => !/googleapis/.test(e.src || e.href)).map((e) => /\?v=\d+$/.test(e.src || e.href)));
  assert.ok(v.length > 20 && v.every(Boolean), 'every file versioned'); console.log('PASS ' + v.length + ' css/js files carry ?v='); assert.strictEqual(errs, 0, 'page errors'); console.log('PASS no page errors');
  await b.close(); srv.close && srv.close(); web.kill(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
