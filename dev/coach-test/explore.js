/* Scratch helper: log in against the fake backend, open routes, screenshot them, print page errors.
 *   node dev/coach-test/explore.js <outDir> <WxH> <route> [route…]      e.g. node explore.js /tmp/x 1440x900 '#/' '#/a/<uid>/rounds'  (use @N for the Nth athlete)
 */
const { chromium } = require('playwright-core'); const { spawn } = require('child_process'); const fs = require('fs'), path = require('path');
const F = require('./fakefirebase'), SEED = require('./seed'); const ROOT = path.join(__dirname, '..', '..');
const [OUT, VP, ...ROUTES] = process.argv.slice(2), [W, Hh] = VP.split('x').map(Number); fs.mkdirSync(OUT, { recursive: true });
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
  const uids = S.athletes.map((a) => a.uid); let i = 0;
  for (const r0 of ROUTES) { let r = r0.replace(/@(\d+)/g, (_, n) => encodeURIComponent(uids[+n])); await page.evaluate((h) => { location.hash = h; }, r); await page.waitForTimeout(900);
    const name = OUT + '/' + String(++i).padStart(2, '0') + '-' + r0.replace(/[^a-z0-9]+/gi, '_').slice(0, 50) + '.png'; await page.screenshot({ path: name, fullPage: !!process.env.FULL }); if (process.env.ACTS) console.log('ACTS', r0, JSON.stringify(await page.$$eval('.appui [data-act]', (e) => [...new Set(e.map((x) => x.getAttribute('data-act') + (x.hasAttribute('data-na') ? '*' : '')))])));
    if (process.env.OVER) console.log('overflow', await page.evaluate(() => { var W = document.documentElement.clientWidth, o = []; document.querySelectorAll('#app *').forEach((e) => { var r = e.getBoundingClientRect(); var c = false; for (var a = e.parentElement; a && a !== document.body; a = a.parentElement) { var ox = getComputedStyle(a).overflowX; if (ox !== 'visible') { c = true; break; } } if (!c && r.right > W + 1 && r.width > 0) o.push(e.tagName + '.' + String(e.className).slice(0, 30) + ' ' + Math.round(r.right)); }); return document.documentElement.scrollWidth + '/' + W + ' ' + o.slice(0, 12).join(', '); }));
    if (process.env.GREP) console.log('grep', await page.evaluate((g) => { var t = document.querySelector('#app').innerText, i = t.search(new RegExp(g)); return i < 0 ? 'none' : t.slice(Math.max(0, i - 80), i + 80).replace(/\n/g, ' | '); }, process.env.GREP));
    console.log('shot', name, '| title:', await page.title(), '| h2/h3:', (await page.$$eval('h2,h3', (e) => e.slice(0, 5).map((x) => x.textContent.trim()))).join(' / ')); }
  console.log('uids', uids.slice(0, 3).join(' ')); await b.close(); srv.close && srv.close(); web.kill(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
