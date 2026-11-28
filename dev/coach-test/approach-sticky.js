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
  assert.deepStrictEqual(tc, ['rgb(31, 45, 56)', 'rgb(255, 255, 255)']);
  const te = await page.evaluate(() => { const a = document.querySelector('.appui .statspage') || document.querySelector('.appui'), b = document.createElement('button'); b.className = 'stevent sel'; b.innerHTML = '<b>Lakehouse</b><span>x</span>'; a.appendChild(b);
    const r = [getComputedStyle(b).backgroundColor, getComputedStyle(b.querySelector('b')).color]; b.remove(); return r; });
  assert.deepStrictEqual(te, ['rgb(230, 239, 255)', 'rgb(31, 45, 56)']); console.log('PASS picked event on Stats: dark name on light blue', JSON.stringify(te)); console.log('PASS picked tournament: white name on the dark button', JSON.stringify(tc));
  const v = await page.$$eval('script[src], link[rel=stylesheet][href]', (L) => L.filter((e) => !/googleapis/.test(e.src || e.href)).map((e) => /\?v=\d+$/.test(e.src || e.href)));
  assert.ok(v.length > 20 && v.every(Boolean), 'every file versioned'); console.log('PASS ' + v.length + ' css/js files carry ?v='); assert.strictEqual(errs, 0, 'page errors'); console.log('PASS no page errors');
  // every selected button on the athlete pages: its text must stand out from its own background (no white on light, no dark on dark)
  const sweep = async (label) => { const bad = await page.evaluate(() => { const lum = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; const a = m.length > 3 ? +m[3] : 1; if (a < 0.5) return null;
      return m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((t, v, i) => t + v * [0.2126, 0.7152, 0.0722][i], 0); };
    const bgOf = (e) => { for (; e; e = e.parentElement) { const L = lum(getComputedStyle(e).backgroundColor); if (L != null) return L; } return 1; }; const out = [];
    document.querySelectorAll('.appui button.sel, .appui [aria-pressed="true"]').forEach((bt) => { if (!bt.offsetParent) return; [bt].concat([...bt.querySelectorAll('b, span, strong')]).forEach((t) => {
      if (!t.textContent.trim() || !t.offsetParent) return; const f = lum(getComputedStyle(t).color), g = bgOf(t); if (f == null) return; const r = (Math.max(f, g) + 0.05) / (Math.min(f, g) + 0.05);
      if (r < 3) out.push((bt.className || bt.tagName) + ' "' + t.textContent.trim().slice(0, 20) + '" ' + r.toFixed(1)); }); }); return out; });
    console.log(bad.length ? 'FAIL ' + label + ': ' + bad.join(' | ') : 'PASS ' + label + ': selected buttons readable'); return bad.length; };
  let fails = 0; const go = async (r) => { await page.evaluate((h) => { location.hash = h; }, '#/a/' + encodeURIComponent(uid) + r); await page.waitForTimeout(900); };
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const m of ['5', 'sel', 'pick']) { await page.click('#strange [data-v="' + m + '"]'); await page.waitForTimeout(400); if (m === 'pick' && await page.$('#stevents .stevent')) { await page.click('#stevents .stevent'); await page.waitForTimeout(400); } fails += await sweep('stats ' + m); }
  for (const r of ['', '/rounds', '/mygame', '/trends', '/practice', '/plan', '/tests', '/dispersion']) { await go(r); fails += await sweep('page ' + (r || 'overview'));
    for (const sel of ['.dspsrc button:not(.sel)', '[data-act="dsprall"]', '[data-act="dsprev"]']) { const e = await page.$(sel); if (e) { await e.click().catch(() => {}); await page.waitForTimeout(500); fails += await sweep('page ' + r + ' after ' + sel); } } }
  assert.strictEqual(fails, 0, 'unreadable selected buttons');
  // v277 Dispersion › Rounds › Choose folds up once a tournament (or Done) is picked; a distance with 1–2 approaches keeps the map
  await go('/dispersion'); await page.click('[data-act="dspsrc"][data-v="rounds"]'); await page.waitForTimeout(500); await page.click('[data-act="dsprplay"][data-v="pick"]'); await page.waitForSelector('#dsppick .dsprds');
  if (await page.$('#dsppick .dspev')) { await page.click('#dsppick .dspev'); await page.waitForSelector('#dsppick.dsppickc'); console.log('PASS Choose: tournament picked, list folded –', (await page.textContent('#dsppick')).replace(/\s+/g, ' ').trim()); }
  else { await page.click('#dsppick .dsppickdone'); await page.waitForSelector('#dsppick.dsppickc'); console.log('PASS Choose: Done folds the list –', (await page.textContent('#dsppick')).replace(/\s+/g, ' ').trim()); }
  const sumSt = await page.$eval('#dsppick .dsppicksum', (e) => { const c = getComputedStyle(e); return [c.backgroundColor, getComputedStyle(e.querySelector('b')).color, e.getBoundingClientRect().height]; });
  assert.ok(/^rgb\((\d|[1-5]\d), (\d|[1-5]\d), (\d|[1-6]\d)\)$/.test(sumSt[1]) && sumSt[2] < 80, 'folded line looks right ' + JSON.stringify(sumSt)); await page.screenshot({ path: OUT + '/web-pick-folded.png' });
  await page.click('#dsppick .dsppicksum'); await page.waitForSelector('#dsppick .dsprds'); console.log('PASS Change opens the list again');
  await page.click('[data-act="dsprplay"][data-v="all"]'); await page.waitForTimeout(500);
  const fewC = await page.$$eval('#dspyds .dspyd', (L) => L.map((e) => [e.getAttribute('data-v'), +e.querySelector('span').textContent]).filter((x) => x[1] < 3).map((x) => x[0]));
  if (fewC.length) { await page.click('#dspyds [data-v="' + fewC[0] + '"]'); await page.waitForTimeout(500); assert.ok(await page.$('#dspcvwrap canvas') && await page.$('#dspfew'), 'few: map + note');
    console.log('PASS ' + fewC[0] + ' yd (few): map stays with "' + (await page.textContent('#dspfew')) + '"'); await page.screenshot({ path: OUT + '/web-few.png' }); } else console.log('(no 1–2 shot distance in the seed data)');
  assert.strictEqual(errs, 0, 'page errors after dispersion');
  await b.close(); srv.close && srv.close(); web.kill(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
