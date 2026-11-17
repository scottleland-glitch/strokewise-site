/* Screenshots of the athlete Practice tab (the app's Practice screen on the coach site), fake data only.
 *   node dev/coach-test/practice-shots.js [outDir]     (default /workspace/coach-practice; needs playwright-core and /usr/bin/google-chrome)
 */
const { chromium } = require('playwright-core'); const { spawn } = require('child_process'); const fs = require('fs'), path = require('path');
const F = require('./fakefirebase'), SEED = require('./seed'); const ROOT = path.join(__dirname, '..', '..'), OUT = process.argv[2] || '/workspace/coach-practice';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const srv = await F.start(18795), web = spawn('python3', ['-m', 'http.server', '18796', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 700));
  const S = await SEED.load('http://127.0.0.1:18795', Date.now()); const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errs = [];
  const open = async (W, Hh, mob) => {
    const ctx = await b.newContext({ viewport: { width: W, height: Hh }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob }), page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|fonts\./.test(m.text())) errs.push('console: ' + m.text()); });
    const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
    const proxy = (map) => async (route) => { const req = route.request(); if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS }); const u = new URL(req.url());
      const r = await fetch('http://127.0.0.1:18795' + map(u), { method: req.method(), headers: { 'content-type': req.headers()['content-type'] || 'application/json' }, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData() });
      route.fulfill({ status: r.status, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: await r.text() }); };
    await page.route('https://identitytoolkit.googleapis.com/v1/**', proxy((u) => '/auth' + u.pathname.replace('/v1', '') + u.search));
    await page.route('https://securetoken.googleapis.com/v1/**', proxy((u) => '/token' + u.pathname.replace('/v1', '') + u.search));
    await page.route('https://pin-high-live-default-rtdb.firebaseio.com/**', proxy((u) => '/db' + u.pathname + u.search));
    await page.goto('http://127.0.0.1:18796/coach/'); await page.waitForSelector('#loginform'); await page.fill('#em', S.coach.email); await page.fill('#pw', S.coach.pw); await page.click('#loginform button[type=submit]');
    await page.waitForSelector('.cards .acard, .tbl .tr', { timeout: 15000 });
    await page.evaluate((h) => { location.hash = h; }, '#/a/' + encodeURIComponent(S.athletes[0].uid) + '/practice'); await page.waitForSelector('.prgrid #weekcard'); await page.waitForTimeout(700);
    await page.addStyleTag({ content: 'header { position: static !important; }' }); // element shots without the sticky bar on top
    return { ctx, page };
  };
  const shot = async (page, sel, name) => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(250); await el.screenshot({ path: OUT + '/' + name }); console.log('shot', name); };
  const page1 = async (page, card, i) => { await page.click(card + ' .wkpdots i >> nth=' + i); await page.waitForTimeout(700); };
  // ---------- desktop ----------
  const D = await open(1440, 900, false), p = D.page;
  await p.screenshot({ path: OUT + '/01-practice-tab-desktop-1440x900-full.png', fullPage: true }); await p.screenshot({ path: OUT + '/01b-practice-tab-desktop-1440x900-first-screen.png' }); console.log('shot 01');
  await shot(p, '.appui.prc.week', '02-slider-1-this-week-by-area.png');
  await page1(p, '#weekcard', 1); await shot(p, '.appui.prc.week', '03-slider-2-each-day-by-group.png');
  await page1(p, '#weekcard', 2); await shot(p, '.appui.prc.week', '04-slider-3-last-3-months-rolling-7-days.png');
  await page1(p, '#weekcard', 1); await p.click('#weekcard [data-act=wkoff][data-k="1"]'); await p.waitForTimeout(700);
  console.log('after week arrow: label', await p.textContent('#weekcard .wknav b'), '| page kept', await p.evaluate(() => { const c = document.getElementById('wkpages'); return Math.round(c.scrollLeft / c.clientWidth); }));
  await shot(p, '.appui.prc.week', '03b-slider-2-each-day-last-week.png');
  await shot(p, '.appui.prc.gap', '05-your-game-and-your-training-strokes-lost-vs-practice.png');
  await shot(p, '.appui.prc.vs', '06-strokes-lost-vs-practice-time.png');
  for (let i = 0; i < 3; i++) { await page1(p, '#prcard', i); await shot(p, '.appui.prc.spider', '07' + 'abc'[i] + '-my-practice-page-' + (i + 1) + '.png'); }
  // tap a day on Each day → it opens in Recent practice
  await page1(p, '#weekcard', 1); const hit = p.locator('#weekcard .wkhit').first(); if (await hit.count()) { await hit.click({ force: true }); await p.waitForTimeout(900); }
  await shot(p, '.appui.prc.recent', '08-recent-practice-day-open.png');
  await shot(p, '.appui.prc.playing', '09-playing-and-practice-by-week.png');
  // ---------- Stats: Driver distance box (v231 Long rule, 450 yd guard) ----------
  await p.evaluate((h) => { location.hash = h; }, '#/a/' + encodeURIComponent(S.athletes[0].uid) + '/stats'); await p.waitForSelector('.appui.stats .stcath'); await p.waitForTimeout(500);
  if (!(await p.$('#st-drive:visible'))) { const cat = await p.evaluate(() => { const sec = document.querySelector('#st-drive') && document.querySelector('#st-drive').closest('.stcat'); return sec ? sec.getAttribute('data-cat') : null; }); await p.click(cat ? '.appui .stcath[data-v="' + cat + '"]' : '.appui.stats .stcath >> nth=0'); await p.waitForTimeout(700); }
  console.log('driver box:', (await p.textContent('#st-drive')).replace(/\s+/g, ' ').slice(0, 160));
  await shot(p, '#st-drive:visible', '13-driver-distance.png');
  // ---------- mobile 390 ----------
  const M = await open(390, 844, true), m = M.page;
  await m.screenshot({ path: OUT + '/11-practice-tab-mobile-390-full.png', fullPage: true }); console.log('shot 11');
  const over = await m.evaluate(() => { const W = document.documentElement.clientWidth; return { doc: document.documentElement.scrollWidth, W, wide: [...document.querySelectorAll('#app *')].filter((e) => { const r = e.getBoundingClientRect(); if (r.right <= W + 1) return false; for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return false; } return true; }).slice(0, 5).map((e) => e.tagName + '.' + e.className) }; });
  console.log('mobile overflow', JSON.stringify(over));
  await m.evaluate(() => { const c = document.getElementById('wkpages'); c.scrollLeft = c.clientWidth * 2; }); await m.waitForTimeout(600);
  await shot(m, '.appui.prc.week', '12-mobile-slider-swiped-to-3-months.png');
  console.log('errors', errs.length ? errs.join(' || ') : 'none');
  await b.close(); srv.close && srv.close(); web.kill(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
