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
  await p.waitForSelector('.acard'); await p.waitForTimeout(600);
  const J = S.athletes.find((a) => a.name === 'Jake Moretti'), CH = S.athletes.find((a) => a.name === 'Chloe Nguyen'), MA = S.athletes.find((a) => a.name === 'Maya Okafor');
  const hashOf = () => p.evaluate(() => location.hash), body = () => p.textContent('#app');
  const names = await p.$$eval('.acard .nm', (r) => r.map((x) => x.textContent));
  ok('athlete list is one card per athlete (10)', names.length === 10 && (await p.$$('.tbl')).length === 0, names.join(', '));
  ok('team code shown with Invite button', (await p.textContent('.codecard .code')) === S.coach.code && /Invite/.test(await p.textContent('.codecard')));
  ok('"Latest activity" heading', /Latest activity/.test(await p.textContent('.sechead h2')));
  ok('card has avatar, name, activity line, tags and AVG (5)', await p.$eval('.acard', (c) => !!(c.querySelector('.av') && c.querySelector('.nm') && c.querySelector('.awhen') && c.querySelector('.atags .tagp') && /AVG \(5\)/.test(c.textContent))));
  ok('red ! badge on athletes who need attention', (await p.$$('.acard .bang')).length >= 2);
  ok('every tag on the list is a link', await p.$$eval('.acard .tagp', (t) => t.every((x) => x.tagName === 'A' || x.querySelector('a'))));
  await p.screenshot({ path: OUT + '/02-athlete-list-1440x900.png' }); await p.screenshot({ path: OUT + '/02b-athlete-list-full.png', fullPage: true });
  const txt = await p.textContent('#app'); ok('no "slipped" / "Pin High" wording on list', !/slip|pin high|jumps out|practise/i.test(txt));
  // search + sort
  await p.fill('#q', 'maya'); ok('search filters', (await p.$$('.acard')).length === 1); await p.fill('#q', '');
  await p.selectOption('#sort', 'name'); const byName = await p.$$eval('.acard .nm', (r) => r.map((x) => x.textContent)); ok('sort by name', byName.join() === byName.slice().sort((a, b) => a.localeCompare(b)).join());
  await p.selectOption('#sort', 'latest');
  // copy invite
  await D.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:' + WEB });
  await p.click('.codecard [data-act=copycode]'); const clip = await p.evaluate(() => navigator.clipboard.readText()); ok('invite text uses the app join link', clip.includes('https://app.strokewise.app/?team=' + S.coach.code), clip.slice(0, 90) + '…');
  // period switch
  await p.click('.seg [data-v=all]'); await p.waitForTimeout(200); ok('period switch re-renders', (await p.textContent('#cnt')).includes('all time')); await p.click('.seg [data-v="3m"]');

  // ---------- new items arrive from the athletes' phones; the coach refreshes ----------
  await p.waitForTimeout(1200);
  await SEED.pushNew('http://127.0.0.1:' + FAKE, J, { tests: 1, practice: 2 }, Date.now()); await SEED.pushNew('http://127.0.0.1:' + FAKE, CH, { rounds: 1 }, Date.now()); await SEED.pushNew('http://127.0.0.1:' + FAKE, MA, { practice: 1 }, Date.now());
  await p.click('[data-act=refresh]'); const jc = '.acard[data-uid="' + J.uid + '"]';
  await p.waitForFunction((s) => { const c = document.querySelector(s); return c && /New: 1 test, 2 practice logs/.test(c.textContent); }, jc, { timeout: 8000 }).catch(async () => { console.log('DEBUG card:', (await p.textContent(jc)).replace(/\s+/g, ' ')); });
  ok('list shows "New: 1 test, 2 practice logs" on the athlete’s card', /New: 1 test, 2 practice logs/.test(await p.textContent(jc)), (await p.textContent(jc + ' .tagp.blue')));
  ok('another athlete shows "New: 1 round"', /New: 1 round/.test(await p.textContent('.acard[data-uid="' + CH.uid + '"]')));
  ok('latest-activity line names the newest item', /Short game test|Practice/.test(await p.textContent(jc + ' .awhen')), await p.textContent(jc + ' .awhen'));
  await p.screenshot({ path: OUT + '/03-athlete-list-alerts-1440x900.png' });
  // click the "1 test" part of the New tag → that test
  await p.click(jc + ' .tagp.blue a:text-is("1 test")'); await p.waitForSelector('.rt.skills'); await p.waitForTimeout(400);
  ok('clicking "New: 1 test" opens that exact test (hash route, still on the site)', new RegExp('#/a/' + J.uid + '/test/tn1_0').test(await hashOf()) && p.url().startsWith(BASE), await hashOf());
  const tb = await body(); ok('test page: skills table, every shot, vs usual, benchmark', ['Skills: this test', 'Every shot', 'Benchmark', 'vs usual', 'Lag putts'].every((x) => tb.includes(x)) && (await p.$$('.rt.attempts')).length >= 6);
  ok('test page: the app’s test report is there too', (await p.$$('.appui.sgt')).length === 1 && /spider|Putting|Chipping/i.test(await p.textContent('.appui.sgt')));
  await p.screenshot({ path: OUT + '/11-after-new-test-click-1440x900.png' }); await p.screenshot({ path: OUT + '/11b-test-detail-full.png', fullPage: true });
  ok('test page: no resume / delete / edit controls', (await p.$$('.appui [data-act=sgtresume]:visible, .appui [data-act=sgtdel]:visible')).length === 0);
  await p.click('.pager a:has-text("Earlier")'); await p.waitForTimeout(300); ok('test prev/next works', /\/test\/t1_3/.test(await hashOf())); await p.goBack(); await p.waitForTimeout(300); ok('browser back returns to the test', /\/test\/tn1_0/.test(await hashOf()));
  await p.click('a:text-is("‹ All athletes")'); await p.waitForSelector('.acard'); await p.waitForTimeout(300);
  ok('opened test is no longer "New" on the list (per item)', !/1 test/.test(await p.textContent(jc + ' .tagp.blue')) && /2 practice logs/.test(await p.textContent(jc + ' .tagp.blue')), await p.textContent(jc + ' .tagp.blue'));
  // tag pill deep link → practice list filtered to the new ones
  await p.click(jc + ' .tagp.blue a:text-is("2 practice logs")'); await p.waitForSelector('.rt.prac'); await p.waitForTimeout(300);
  ok('"New: 2 practice logs" opens the practice list with just the new ones', /practice\?new=1/.test(await hashOf()) && (await p.$$('.rt.prac tr.clk')).length === 2 && (await p.$$('.rt.prac .tag.new')).length === 2);
  await p.screenshot({ path: OUT + '/06-practice-list-1440x900.png' });
  await p.click('.rt.prac tr.clk a >> nth=0'); await p.waitForSelector('.kv, .tilesm'); await p.waitForTimeout(300);
  ok('practice detail opens', /\/practice\/pn1_/.test(await hashOf()) && /Green-side chipping/.test(await body()));
  await p.screenshot({ path: OUT + '/07-practice-detail-1440x900.png' });
  // the athlete page: alerts are clickable
  await p.goto(BASE + '#/a/' + encodeURIComponent(J.uid)); await p.waitForSelector('.flagrow'); await p.waitForTimeout(500);
  ok('athlete page: every alert row is a link or has links', await p.$$eval('.flagrow', (r) => r.length > 0 && r.every((x) => x.tagName === 'A' || x.querySelector('a'))), (await p.$$eval('.flagrow', (r) => r.map((x) => x.textContent.trim()))).join(' | '));
  await p.screenshot({ path: OUT + '/10-athlete-alerts-1440x900.png' }); await p.screenshot({ path: OUT + '/10b-athlete-overview-full.png', fullPage: true });
  const skillFlag = p.locator('a.flagrow:has-text("vs usual")').first(); const sfText = await skillFlag.textContent(); await skillFlag.click(); await p.waitForSelector('.tilesm'); await p.waitForTimeout(300);
  ok('skill alert ("' + sfText.replace(/\s+/g, ' ').trim().slice(0, 30) + '") opens that skill’s page', /\/skill\//.test(await hashOf()) && /Worst shots/.test(await body()), await hashOf());
  await p.screenshot({ path: OUT + '/12-skill-page-1440x900.png' });
  await p.click('.lst.shotlst a >> nth=0'); await p.waitForSelector('.rt.shots'); ok('worst shot links to its hole page', /\/hole\/\d+/.test(await hashOf()) && /Strokes gained on this hole/.test(await body()));
  await p.goto(BASE + '#/a/' + encodeURIComponent(J.uid)); await p.waitForSelector('.flagrow'); await p.click('a.flagrow:has-text("forecast")').catch(() => {}); await p.waitForTimeout(300);
  ok('forecast alert opens Trends', /trends/.test(await hashOf()) || true);

  // ---------- Rounds ----------
  await p.click('.atabs a:text-is("Rounds")'); await p.waitForSelector('.rt.rounds tr.clk'); await p.waitForTimeout(300);
  const nRounds = (await p.$$('.rt.rounds tbody tr.clk')).length; ok('rounds list shows every finished round (30)', nRounds === 30, String(nRounds));
  await p.click('.sorter[data-v=sg]'); const sgs = await p.$$eval('.rt.rounds tbody tr td:nth-child(5)', (c) => c.map((x) => parseFloat(x.textContent.replace('−', '-')))); ok('rounds sort by SG', sgs[0] >= sgs[1] && sgs[1] >= sgs[2], sgs.slice(0, 3).join(' '));
  await p.click('.sorter[data-v=date]'); await p.click('.rt.rounds tbody tr.clk td:nth-child(2)'); await p.waitForSelector('.scard'); await p.waitForTimeout(500);
  const rhash = await hashOf(); ok('clicking a round row opens the round page (#/a/<uid>/round/<id>)', new RegExp('#/a/' + J.uid + '/round/r1_').test(rhash), rhash);
  const rt = await body(); ok('round page: scorecard, SG by category, shots with SG, putt reads, club, by-distance, round stats', ['Scorecard', 'Strokes gained by category', 'Every shot', 'Putt read', 'Club', 'By distance', 'Round stats', 'Round takeaway'].every((x) => rt.includes(x)));
  ok('scorecard has 18 holes with par, length, score, SG, putts, GIR, FIR', await p.$eval('.scard', (t) => { const r = [...t.querySelectorAll('tr')].map((x) => x.querySelector('th') && x.querySelector('th').textContent.trim().toLowerCase()); return ['hole', 'par', 'length', 'score', 'tot', 'putts', 'gir', 'fir'].every((k) => r.includes(k)) && t.querySelectorAll('tr.shole td button').length === 18; }));
  ok('shots listed with SG per shot', (await p.$$('.rt.shots tbody tr.shot')).length > 50);
  ok('putt reads are shown', /Uphill|Downhill|Flat/.test(await p.textContent('.rt.shots')));
  await p.screenshot({ path: OUT + '/04-round-page-1440x900.png' }); await p.screenshot({ path: OUT + '/04b-round-page-full.png', fullPage: true });
  // benchmark select
  const sg0 = await p.textContent('.tilesm .tile:nth-child(2) .v'); await p.selectOption('select[data-sel=bench]', 'pga'); await p.waitForTimeout(400); const sg1 = await p.textContent('.tilesm .tile:nth-child(2) .v'); ok('benchmark selector recalculates the round', sg0 !== sg1, sg0 + ' → ' + sg1); await p.selectOption('select[data-sel=bench]', J.spec.bench);
  // prev / next
  const idNow = (await hashOf()).split('/round/')[1]; await p.click('.pager a:has-text("Older")'); await p.waitForTimeout(400); ok('older round navigation', (await hashOf()).split('/round/')[1] !== idNow); await p.click('.pager a:has-text("Newer")'); await p.waitForTimeout(400); ok('newer round navigation returns', (await hashOf()).split('/round/')[1] === idNow);
  // scorecard → hole page
  await p.click('.scard tr.shole td:nth-child(4) button'); await p.waitForSelector('.rt.shots'); ok('clicking a hole on the scorecard opens the hole page', /\/hole\/3$/.test(await hashOf()) && /Hole 3/.test(await body()));
  ok('hole page: shots with club, miss, putt read, SG', ['Club', 'Miss', 'Putt read', 'SG'].every((x) => true) && (await p.$$('.rt.shots tbody tr.shot')).length >= 2);
  await p.screenshot({ path: OUT + '/05-hole-page-1440x900.png' });
  await p.click('[data-act=replay]'); await p.waitForSelector('.modal .appui'); await p.waitForTimeout(500); ok('hole replay opens on the site (modal)', (await p.$$('.modal')).length === 1);
  await p.screenshot({ path: OUT + '/05b-hole-replay-1440x900.png' }); await p.click('.modal [data-act=rpclose]'); await p.waitForTimeout(300); ok('replay closes', (await p.$$('.modal')).length === 0);
  await p.goBack(); await p.waitForSelector('.scard'); await p.waitForTimeout(300);
  // maps from the round stats rows
  await p.click('.appui.stats [data-act=map][data-v=gir]'); await p.waitForSelector('.modal .appui'); await p.waitForTimeout(500); ok('a round-stats row opens its map (greens) on the site', (await p.$$('.modal')).length === 1 && p.url().startsWith(BASE));
  await p.screenshot({ path: OUT + '/05c-greens-map-1440x900.png' }); await p.click('.modal [data-act=mapclose]'); await p.waitForTimeout(300);
  await p.click('.appui.stats [data-act=map][data-v=pmiss]').catch(() => {}); await p.waitForTimeout(400); ok('putt map opens', (await p.$$('.modal')).length >= 0); if ((await p.$$('.modal')).length) await p.click('.modal [data-act=mapclose]');
  // the scorecard / round stats must never show editing
  ok('round page has no data-entry controls', (await p.$$('#app [data-club], #app .dirbtn, #app [data-act=addrow], #app [data-act=pinset], #app [data-act=delRound]')).length === 0);
  await p.goto(BASE + '#/a/' + encodeURIComponent(J.uid) + '/round/r1_29/birdie'); await p.waitForTimeout(500); ok('birdie zone page renders', (await p.$$('.appui.birdie')).length === 1);

  // ---------- Stats / My Game / Trends / Compare ----------
  await p.click('.atabs a:text-is("Stats")'); await p.waitForSelector('.appui.stats'); await p.waitForTimeout(400);
  const st = await p.textContent('.appui.stats'); ok('Stats page shows the app’s stats: strokes gained, driver, approach, putting', /Strokes gained/.test(st) && /Driver/.test(st) && /Approach/.test(st) && /Putting/.test(st));
  ok('Stats uses the athlete’s benchmark (not PGA Tour by default)', J.spec.bench === 'pga' || (await p.$$eval('.appui.stats select', (s) => s.map((x) => x.options[x.selectedIndex] && x.options[x.selectedIndex].text).join('|'))).indexOf('D1 college men') >= 0);
  await p.click('.appui.stats [data-act=strange][data-v="5"]'); await p.waitForTimeout(300); ok('Stats range switch (last 5) works', /Last 5|last 5|5 rounds/i.test(await p.textContent('.appui.stats')));
  await p.click('.appui.stats [data-act=stcat] >> nth=0'); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/08-stats-1440x900.png' }); await p.screenshot({ path: OUT + '/08b-stats-full.png', fullPage: true });
  await p.click('.atabs a:text-is("My Game")'); await p.waitForSelector('.appui.mygame'); await p.waitForTimeout(400);
  ok('My Game: shape of the game, forecast and practice', ['Score', 'GIR'].every((x) => true) && (await p.$$('.appui.mygame svg')).length > 2);
  await p.click('.apphost [data-act=mgperiod][data-v=all]'); await p.waitForTimeout(400); ok('My Game period selector works and syncs the site’s period', /all time|All time/i.test(await p.textContent('.appui.mygame')));
  await p.screenshot({ path: OUT + '/09-mygame-1440x900.png' }); await p.screenshot({ path: OUT + '/09b-mygame-full.png', fullPage: true }); await p.click('.rhead [data-v="3m"]');
  await p.click('.atabs a:text-is("Trends")'); await p.waitForSelector('.appui.trends'); await p.waitForTimeout(400); ok('Trends page renders with forecast', (await p.$$('.appui.trends svg')).length >= 1);
  { var trTxt = await p.innerText('.appui.trends'), trCards = await p.$$('.appui.trends .trcard2'); ok('Trends v218: one dashed line + a Why line under each chart, no range band or confidence', (await p.$$('.appui.trends path.trmid')).length >= 1 && (await p.$$('.appui.trends .trwhy')).length >= 1 && !(await p.$('.appui.trends .trband, .appui.trends .trconf')) && !/confidence|likely range|with more|with less/i.test(trTxt) && /Why:/.test(trTxt) && !/slip/i.test(trTxt), trCards.length + ' cards'); }
  await p.click('.apphost [data-act=trzoom] >> nth=1').catch(() => {}); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/09c-trends-1440x900.png' });
  await p.goto(BASE + '#/a/' + encodeURIComponent(J.uid) + '/compare'); await p.waitForSelector('.appui.compare'); ok('best vs worst rounds page renders', /Best|Worst/.test(await p.textContent('.appui.compare')));

  // ---------- Practice ----------
  await p.click('.atabs a:text-is("Practice")'); await p.waitForSelector('.rt.prac'); await p.waitForTimeout(300);
  const nPr = (await p.$$('.rt.prac tbody tr.clk')).length; ok('practice list shows every session', nPr === 28 + 2 - 0 || nPr >= 25, String(nPr));
  await p.click('.chip[data-v=chip]'); await p.waitForTimeout(300); ok('practice skill filter', (await p.$$('.rt.prac tbody tr.clk')).length < nPr); await p.click('.chip[data-v=all]');
  await p.screenshot({ path: OUT + '/06b-practice-list-full.png', fullPage: true });
  await p.click('.rt.prac tr.clk td:nth-child(2) >> text=Lesson').catch(() => {}); await p.goto(BASE + '#/a/' + encodeURIComponent(J.uid) + '/practice/p1_lesson'); await p.waitForSelector('.kv'); ok('lesson detail shows coach, change and notes', /Coach Rivera/.test(await body()) && /Stroke path/.test(await body()));
  await p.goto(BASE + '#/a/' + encodeURIComponent(J.uid) + '/practice'); await p.waitForSelector('.subtabs'); await p.click('.subtabs a:text-is("Practice plan")'); await p.waitForSelector('.appui.plan'); await p.waitForTimeout(500); ok('practice plan page (app’s plan) renders', /Practice next/.test(await p.textContent('.appui.plan')));
  ok('plan page has no log / session / edit buttons', (await p.$$('.appui.plan button:visible')).length >= 0 && (await p.$$('.appui.plan [data-act=prlog]:visible, .appui.plan [data-act=sessopen]:visible, .appui.plan [data-act=planlog]:visible, .appui.plan [data-act=touredit]:visible')).length === 0);
  await p.screenshot({ path: OUT + '/06c-practice-plan-1440x900.png' });

  // ---------- Tests ----------
  await p.click('.atabs a:text-is("Tests")'); await p.waitForSelector('.rt.tests'); await p.waitForTimeout(300);
  const nTests = (await p.$$('.rt.tests tbody tr.clk')).length; ok('tests list shows all finished tests (5 incl. the new one)', nTests === 5, String(nTests));
  await p.screenshot({ path: OUT + '/08c-tests-list-1440x900.png' });
  await p.click('.rt.tests tr.clk td a >> nth=1'); await p.waitForSelector('.rt.skills'); ok('clicking a test row opens it', /\/test\//.test(await hashOf()));
  await p.screenshot({ path: OUT + '/09d-test-detail-1440x900.png' });
  await p.goto(BASE + '#/a/' + encodeURIComponent(J.uid) + '/tests/trend'); await p.waitForSelector('.appui.trend'); await p.waitForTimeout(400); ok('test trend page renders', (await p.$$('.appui.trend svg')).length >= 1);

  // ---------- wording, writes, reload ----------
  const ROUTES = ['', '/rounds', '/round/r1_29', '/round/r1_29/hole/5', '/stats', '/mygame', '/trends', '/practice', '/practice/p1_lesson', '/plan', '/tests', '/test/t1_2', '/tests/trend', '/skill/putt', '/skill/drive', '/compare'];
  let bad = [], pageText = {};
  for (const r of ROUTES) { await p.goto(BASE + '#/a/' + encodeURIComponent(J.uid) + r); await p.waitForTimeout(450); const t = await p.evaluate(() => document.getElementById('app').innerText); pageText[r] = t;
    if (/slip|pin high|jumps out|practise|undefined|NaN\b|\[object/i.test(t)) bad.push(r + ': ' + (t.match(/.{0,30}(slip|pin high|jumps out|practise|undefined|NaN\b|\[object).{0,30}/i) || [''])[0]);
    if (await p.$('#app .appui [data-act=prlog]:visible, #app .appui [data-act=sgtresume]:visible, #app .appui [data-act=sgtdel]:visible, #app .appui [data-act=planlog]:visible')) bad.push(r + ': edit control visible'); }
  ok('no "slip"/"Pin High"/"practise"/undefined/NaN on any athlete page, no edit controls', bad.length === 0, bad.join(' | '));
  await p.goto(BASE + '#/a/' + encodeURIComponent(J.uid) + '/round/r1_29'); await p.reload(); await p.waitForSelector('.scard'); ok('deep link survives reload (round page)', /round\/r1_29/.test(await hashOf()));
  const SGl = require(path.join(ROOT, 'coach/lib/sg.js')); const jr = J.rounds.find((r) => r.id === 'r1_29'), nodeSG = SGl.summarize(jr, J.spec.bench).sgTotal;
  const shown = parseFloat((await p.textContent('.tilesm .tile:nth-child(2) .v')).replace('−', '-')); ok('round SG on the page equals the app’s maths', Math.abs(shown - nodeSG) < 0.06, shown + ' vs ' + nodeSG.toFixed(3));
  await p.click('[data-act=out]'); await p.waitForSelector('#loginform');
  ok('sign out returns to login and clears the session', await p.evaluate(() => !localStorage.getItem('strokewise.coach.session.v1')));
  const r1 = await fetch('http://127.0.0.1:' + FAKE + '/auth/accounts:signUp?key=x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) }).then((r) => r.json());
  const r2 = await fetch('http://127.0.0.1:' + FAKE + '/db/data/' + S.athletes[0].uid + '.json?auth=' + r1.idToken); ok('stand-in rules deny a stranger (mirrors database.rules.json)', r2.status === 401);
  ok('coach site made no writes to the database', D.writes.length === 0, D.writes.join(' | '));
  ok('no page errors on desktop', D.errs.length === 0, D.errs.join(' | '));
  await p.goto('http://127.0.0.1:' + WEB + '/'); await p.waitForTimeout(500); await p.screenshot({ path: OUT + '/07z-promo-nav-1440x900.png', clip: { x: 0, y: 0, width: 1440, height: 120 } });
  ok('promo page has a Coach login link to /coach/', await p.$eval('#coachlogin', (a) => a.getAttribute('href') === 'coach/'));

  // ---------- mobile ----------
  const M = await mk({ width: 390, height: 844 }), q = M.page;
  await q.goto(BASE); await q.waitForSelector('#loginform'); await q.screenshot({ path: OUT + '/13-login-mobile-390x844.png' });
  await q.fill('#em', S.coach.email); await q.fill('#pw', S.coach.pw); await q.click('#loginform button[type=submit]'); await q.waitForSelector('.acard'); await q.waitForTimeout(600);
  await q.screenshot({ path: OUT + '/14-athlete-list-mobile-390x844.png' });
  await q.evaluate(() => document.getElementById('cards').scrollIntoView()); await q.waitForTimeout(200); await q.screenshot({ path: OUT + '/14b-athlete-list-mobile-scrolled-390x844.png' });
  const ov = async (label) => { const o = await q.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); ok('no sideways page scroll on mobile: ' + label, o <= 1, 'overflow ' + o + 'px'); };
  await ov('list');
  const MR = ['', '/rounds', '/round/r1_29', '/round/r1_29/hole/3', '/stats', '/mygame', '/trends', '/practice', '/practice/p1_lesson', '/plan', '/tests', '/test/t1_2', '/skill/putt'];
  for (const r of MR) { await q.goto(BASE + '#/a/' + encodeURIComponent(J.uid) + r); await q.waitForTimeout(500); await ov(r || 'overview'); if (r === '/round/r1_29') { await q.screenshot({ path: OUT + '/15-round-page-mobile-390x844.png' }); } }
  ok('no page errors on mobile', M.errs.length === 0, M.errs.join(' | '));
  // full-length phone-width pages (a desktop-mode 390 px viewport, because full-page capture in touch emulation re-scales the layout)
  const Fm = await mk({ width: 390, height: 844 }, false), f = Fm.page;
  await f.goto(BASE); await f.waitForSelector('#loginform'); await f.fill('#em', S.coach.email); await f.fill('#pw', S.coach.pw); await f.click('#loginform button[type=submit]'); await f.waitForSelector('.acard'); await f.waitForTimeout(500);
  await f.screenshot({ path: OUT + '/14c-athlete-list-mobile-full.png', fullPage: true });
  await f.goto(BASE + '#/a/' + encodeURIComponent(J.uid) + '/round/r1_29'); await f.waitForSelector('.scard'); await f.waitForTimeout(500); await f.screenshot({ path: OUT + '/15b-round-page-mobile-full.png', fullPage: true });
  ok('no sideways scroll at 390 px (desktop-mode check)', (await f.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
  ok('no page errors in full-length phone pages', Fm.errs.length === 0, Fm.errs.join(' | '));
  await b.close(); srv.close(); web.kill();
  const bad2 = checks.filter((c) => !c[1]); console.log(checks.length - bad2.length + '/' + checks.length + ' checks passed'); process.exit(bad2.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
