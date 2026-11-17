/* StrokeWise coach site – the screens. Sign in with the coach account made in the app, see every athlete on the team, open one for the detail.
 * Read-only: nothing here writes to the database. Hash routes: #/ (athletes) and #/a/<athlete id> (one athlete).
 */
(function () {
  'use strict';
  var CFG = window.COACH_CONFIG || {}, API = COACHAPI.create({ cfg: CFG }), CALC = COACHCALC, CH = COACHCHARTS, E = CH.esc;
  var LIBS = { SG: window.SG, MYGAME: window.MYGAME, TRENDS: window.TRENDS, SGTEST: window.SGTEST };
  var $app = document.getElementById('app'), $nav = document.getElementById('topnav');
  var LS = { period: 'strokewise.coach.period', mgPeriod: 'strokewise.coach.mgperiod', sort: 'strokewise.coach.sort', seen: 'strokewise.coach.seen.v1', seen2: 'strokewise.coach.seen.v2' };
  var ST = { team: null, athletes: {}, loaded: false, busy: false, err: '', last: 0, period: lsGet(LS.period) || '3m', mgPeriod: lsGet(LS.mgPeriod) || '', sort: lsGet(LS.sort) || 'latest', q: '', login: { msg: '', err: '', busy: false, reset: false, email: '' }, sums: {}, showAll: false, bl: {} };
  if (!CALC.PERIODS.some(function (p) { return p.id === ST.period; })) ST.period = '3m';
  if (ST.mgPeriod && !CALC.PERIODS.some(function (p) { return p.id === ST.mgPeriod; }) && !/^r[1-4]$/.test(ST.mgPeriod)) ST.mgPeriod = '';
  var CUR = '';
  var DAY = 864e5, MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  // What is "New": an item that arrived after the coach first saw the athlete and has not been opened yet. { <coach uid>: { <athlete uid>: { base: time, ids: { <item id>: 1 } } } }
  function seenMap() { try { return JSON.parse(lsGet(LS.seen2) || '{}') || {}; } catch (e) { return {}; } }
  function seenKey() { var s = API.session(); return s ? s.uid : ''; }
  function seenSave(m) { lsSet(LS.seen2, JSON.stringify(m)); }
  function seenFor(uid) { var m = seenMap(), e = (m[seenKey()] || {})[uid]; if (e) return e;
    try { var old = JSON.parse(lsGet(LS.seen) || '{}') || {}, t = (old[seenKey()] || {})[uid]; if (t) return { base: t, ids: {} }; } catch (e2) {} return { base: 0, ids: {} }; }
  function seenPut(uid, f) { var m = seenMap(), k = seenKey(); m[k] = m[k] || {}; var e = m[k][uid] || seenFor(uid); f(e); e.ids = e.ids || {}; m[k][uid] = e; seenSave(m); ST.sums = {}; }
  function markItem(uid, id) { if (!id) return; var e = seenFor(uid); if (e.ids && e.ids[id]) return; seenPut(uid, function (x) { x.ids = x.ids || {}; x.ids[id] = 1; }); }
  function isNewItem(uid, kind, id) { var sn = seenFor(uid), it = (ST.athletes[uid][kind] || []).filter(function (x) { return x.id === id; })[0]; return !!(it && sn.base && CALC.itemT(it) > sn.base && !(sn.ids || {})[id]); }
  function markAll(uid) { seenPut(uid, function (x) { x.base = Date.now(); x.ids = {}; }); }

  // ---------- helpers ----------
  function fd(t, withYear) { if (!t) return '–'; var d = new Date(t); return MON[d.getMonth()] + ' ' + d.getDate() + (withYear || d.getFullYear() !== new Date().getFullYear() ? ', ' + d.getFullYear() : ''); }
  function ago(t) { var m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) === 1 ? 'yesterday' : Math.round(m / 1440) + ' days ago'; }
  function par(n) { return n === 0 ? 'E' : (n > 0 ? '+' : '−') + Math.abs(n); }
  function sgHTML(v, d) { if (v == null) return '<span class="muted">–</span>'; return '<span class="sgv ' + (v > 0.049 ? 'pos' : v < -0.049 ? 'neg' : '') + '">' + CALC.fmtSG(v, d) + '</span>'; }
  function arrowHTML(tr) {
    if (!tr || !tr.dir) return '<span class="muted" title="Needs 6 full rounds">–</span>';
    var a = tr.dir === 'better' ? '↓' : tr.dir === 'worse' ? '↑' : '→';
    return '<span title="Average of the last 5 rounds (' + tr.a5.toFixed(1) + ') vs the 5 before (' + tr.p5.toFixed(1) + ')"><span class="arrow ' + tr.dir + '">' + a + '</span> <span class="sgv ' + (tr.dir === 'flat' ? '' : tr.dir === 'better' ? 'pos' : 'neg') + '">' + tr.diff.toFixed(1) + '</span></span>';
  }
  function H(uid, rest) { return '#/a/' + encodeURIComponent(uid) + (rest ? '/' + rest : ''); }
  function hm(min) { min = Math.round(min || 0); var h = Math.floor(min / 60), m = min % 60; return h ? h + 'h' + (m ? ' ' + m + 'm' : '') : m + 'm'; }
  // one tag: red / amber / blue / green. Every tag is a link to the thing it is about. A "New" tag links each part (1 test, 2 practice logs) on its own.
  function tagHTML(f, uid) {
    if (f.parts) return '<span class="tagp blue">New: ' + f.parts.map(function (p) { return '<a href="' + H(uid, p.to) + '">' + E(p.text) + '</a>'; }).join(', ') + '</span>';
    return '<a class="tagp ' + f.tone + '" href="' + H(uid, f.to || '') + '">' + E(f.text) + '</a>'; }
  function tagsHTML(s, max) { var F = s.flags.slice().sort(function (a, b) { return (b.kind === 'new') - (a.kind === 'new'); }); if (!F.length) return '<a class="tagp green" href="' + H(s.uid) + '">Holding steady</a>';
    var out = F.slice(0, max || 3).map(function (f) { return tagHTML(f, s.uid); }); if (F.length > (max || 3)) out.push('<a class="tagp more" href="' + H(s.uid) + '">+' + (F.length - (max || 3)) + ' more</a>'); return out.join(''); }
  function flagsHTML(flags, uid) {
    return '<div class="flags">' + flags.map(function (f) { var ic = '<i>' + (f.tone === 'red' ? '!' : f.tone === 'amber' ? '•' : '+') + '</i>';
      if (f.parts) return '<div class="flagrow ' + f.tone + '">' + ic + 'New: ' + f.parts.map(function (p) { return '<a href="' + H(uid, p.to) + '">' + E(p.text) + '</a>'; }).join(', ') + '<span class="sp"></span><button class="linkbtn" data-act="markall" data-uid="' + E(uid) + '">Mark all as seen</button></div>';
      return '<a class="flagrow ' + f.tone + '" href="' + H(uid, f.to || '') + '">' + ic + E(f.text) + '<span class="go">View ›</span></a>'; }).join('') + '</div>'; }
  function avColor(name) { var hs = 0, id = String(name).toLowerCase(); for (var q = 0; q < id.length; q++) hs = (hs * 7 + id.charCodeAt(q)) % 6007; return ['#7a5ab0', '#3f7fbf', '#d39b2a', '#3f9a63', '#b0505a', '#2f8f8f', '#c0662b'][hs % 7]; }
  function periodName(id) { return CALC.PERIODS.filter(function (p) { return p.id === id; })[0].name; }
  function authMsg(e) { var m = String(e && (e.message || e.code) || '');
    return /INVALID_LOGIN|INVALID_PASSWORD|EMAIL_NOT_FOUND|INVALID_CREDENTIAL/.test(m) ? 'Email or password doesn’t match.' : /INVALID_EMAIL|MISSING_EMAIL/.test(m) ? 'That email doesn’t look right.' : /MISSING_PASSWORD/.test(m) ? 'Type your password.' :
      /TOO_MANY/.test(m) ? 'Too many tries. Wait a few minutes and try again.' : /USER_DISABLED/.test(m) ? 'This account is disabled.' : e && e.code === 'offline' ? 'No connection. Try again with a signal.' : /API_KEY|referer|REFERER/i.test(m) ? 'Sign-in isn’t set up for this address yet.' : 'Something went wrong: ' + m; }

  // ---------- local copy of the athletes (IndexedDB), so a return visit shows data straight away ----------
  function idb() { return new Promise(function (ok, no) { try { var r = indexedDB.open('strokewise-coach', 1); r.onupgradeneeded = function () { r.result.createObjectStore('kv'); }; r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; } catch (e) { no(e); } }); }
  function idbGet(k) { return idb().then(function (d) { return new Promise(function (ok) { var q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = function () { ok(q.result || null); }; q.onerror = function () { ok(null); }; }); }).catch(function () { return null; }); }
  function idbSet(k, v) { return idb().then(function (d) { return new Promise(function (ok) { var t = d.transaction('kv', 'readwrite'); if (v == null) t.objectStore('kv').delete(k); else t.objectStore('kv').put(v, k); t.oncomplete = ok; t.onerror = ok; }); }).catch(function () {}); }
  function cacheKey() { var s = API.session(); return s ? 'athletes:' + s.uid : null; }

  // ---------- data ----------
  function signedOut(msg) { API.signOut(); var k = cacheKey(); ST.team = null; ST.athletes = {}; ST.sums = {}; ST.loaded = false; ST.login.err = msg || ''; ST.login.msg = ''; route(); }
  function start() {
    if (!API.session()) { route(); return; }
    ST.loaded = false; route();
    var key = cacheKey();
    API.team().then(function (team) {
      ST.team = team || false;
      if (!team) { ST.loaded = true; route(); return; }
      return idbGet(key).then(function (c) { if (c && c.team === team.team) { ST.athletes = c.athletes || {}; ST.last = c.at || 0; ST.loaded = true; route(); } return pull(); });
    }).catch(function (e) { if (e.code === 'signedout' || e.code === 'denied') signedOut('Please sign in again.'); else { ST.err = authMsg(e); ST.loaded = true; route(); } });
  }
  function pull(quiet) {
    if (ST.busy || !ST.team) return Promise.resolve(); ST.busy = true; if (!quiet) route();
    return API.pull(ST.team.team, ST.athletes).then(function (P) {
      ST.busy = false; ST.err = ''; ST.last = Date.now(); ST.athletes = P.athletes; ST.loaded = true; ST.sums = {};
      var m = seenMap(), k = seenKey(); m[k] = m[k] || {}; Object.keys(P.athletes).forEach(function (u) { if (!m[k][u]) { var o = seenFor(u); m[k][u] = o.base ? o : { base: Date.now(), ids: {} }; } }); seenSave(m); // "New" counts from the first look
      idbSet(cacheKey(), { team: ST.team.team, athletes: ST.athletes, at: ST.last }); route();
    }, function (e) { ST.busy = false; if (e.code === 'signedout' || e.code === 'denied') { signedOut('Please sign in again.'); return; } ST.err = e.code === 'offline' ? 'No signal. Showing what was here last time.' : authMsg(e); ST.loaded = true; route(); });
  }
  function sums() { // one summary per athlete for the chosen time frame
    return Object.keys(ST.athletes).map(function (u) { var key = u + '|' + ST.period, A = ST.athletes[u];
      if (!ST.sums[key]) { try { ST.sums[key] = CALC.summary(A, LIBS, { period: ST.period, seen: seenFor(u) }); } catch (e) { if (window.console) console.error(e); ST.sums[key] = { uid: u, name: A.name, bl: 'pga', blName: '', n: 0, last: null, flags: [], attention: 0, reds: 0, ambers: 0, trend: { dir: null }, sg: null, periodRounds: 0, lastAct: 0, joined: 0 }; } }
      return ST.sums[key]; });
  }
  function needs(s) { return s.reds > 0 || s.flags.some(function (f) { return f.kind === 'quiet'; }); } // red tags, or no rounds in 3+ weeks

  // ---------- views ----------
  function setNav() {
    var s = API.session();
    $nav.innerHTML = s ? '<span class="who" title="' + E(s.email) + '">' + E(s.email) + '</span><button class="btn sec sm" data-act="out">Sign out</button>' : '<a href="../">Home</a>';
  }
  function route() {
    setNav();
    if (!API.session()) { document.title = 'Coach sign in – Strokewise'; return loginView(); }
    if (!ST.loaded) { document.title = 'Coach dashboard – Strokewise'; $app.innerHTML = '<div class="wrap dash"><div class="skel" style="height:90px"></div><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>'; return; }
    if (ST.team === false) return noTeamView();
    var m = /^#\/a\/([^/?]+)(?:\/([^?]*))?(?:\?(.*))?$/.exec(location.hash || '');
    if (m && ST.athletes[decodeURIComponent(m[1])]) { var uid = decodeURIComponent(m[1]), parts = (m[2] || '').split('/').filter(Boolean);
      if (!parts.length || parts[0] === 'overview') return athleteView(uid); return athletePage(uid, parts, m[3] || ''); }
    document.title = (ST.team ? ST.team.name + ' – ' : '') + 'Coach dashboard – Strokewise';
    return listView();
  }
  function loginView() {
    var L = ST.login;
    $app.innerHTML = '<div class="login"><div class="wrap"><div>' +
      '<span class="eyebrow">For coaches</span><h1>Every athlete’s game, <em style="font-style:normal;color:var(--green)">in one place.</em></h1>' +
      '<p class="lede">Sign in to see your whole team: strokes gained, rounds, trends and short game tests.</p>' +
      '<ol class="flow"><li><b>Set up</b> your team in the Strokewise app and share your team code.</li><li><b>Athletes join</b> from their phones. Their rounds arrive on their own.</li><li><b>Sign in here</b> with the same email and password.</li></ol></div>' +
      '<form class="card signin" id="loginform" novalidate><h2>' + (L.reset ? 'Reset your password' : 'Coach sign in') + '</h2>' +
      (L.err ? '<p class="msg err" role="alert">' + E(L.err) + '</p>' : '') + (L.msg ? '<p class="msg ok" role="status">' + E(L.msg) + '</p>' : '') +
      '<label for="em">Email</label><input type="email" id="em" autocomplete="username" inputmode="email" value="' + E(L.email) + '" required>' +
      (L.reset ? '' : '<label for="pw">Password</label><input type="password" id="pw" autocomplete="current-password" required>') +
      '<button class="btn pri" type="submit"' + (L.busy ? ' disabled' : '') + '>' + (L.busy ? 'One moment…' : L.reset ? 'Send reset link' : 'Sign in') + '</button>' +
      '<div class="alt">' + (L.reset ? '<button type="button" class="linkbtn" data-act="back">Back to sign in</button>' : '<button type="button" class="linkbtn" data-act="forgot">Forgot password?</button>') + '</div>' +
      '<p class="newcoach">New coach? Create your team in the Strokewise app (Settings, then “I’m a coach”). Then sign in here with the same email and password.</p></form></div></div>';
    var em = document.getElementById('em'); if (em && !em.value) em.focus(); else { var pw = document.getElementById('pw'); if (pw) pw.focus(); }
  }
  function noTeamView() {
    document.title = 'Coach dashboard – Strokewise';
    $app.innerHTML = '<div class="wrap dash"><div class="card empty"><h2>No team on this account yet</h2><p class="muted">Create your team in the Strokewise app, then come back and refresh this page.</p><p><button class="btn pri" data-act="reload">Refresh</button></p></div></div>';
  }
  function copyTxt() { var T = ST.team; return 'Join ' + (T.name || 'my team') + ' on Strokewise so I can see your rounds: ' + (CFG.inviteBase || '') + encodeURIComponent(T.code) + ' (or open the app, go to Settings, Connect to a coach, and enter ' + T.code + ').'; }
  function footer() { return '<footer class="cf"><div class="wrap">Read-only view of what your athletes choose to share. An athlete can stop sharing any time in the app, and then disappears from this list. <a href="../privacy.html">Privacy</a> · <a href="../support.html">Support</a></div></footer>'; }

  function sorted(S) {
    var q = ST.q.trim().toLowerCase(), L = S.filter(function (s) { return !q || s.name.toLowerCase().indexOf(q) >= 0; }), by = {
      latest: function (a, b) { return b.lastAct - a.lastAct || a.name.localeCompare(b.name); },
      attention: function (a, b) { return b.attention - a.attention || a.name.localeCompare(b.name); },
      name: function (a, b) { return a.name.localeCompare(b.name); },
      last: function (a, b) { return (b.last ? b.last.t : 0) - (a.last ? a.last.t : 0) || a.name.localeCompare(b.name); },
      sg: function (a, b) { return (b.sg == null ? -99 : b.sg) - (a.sg == null ? -99 : a.sg) || a.name.localeCompare(b.name); },
      rounds: function (a, b) { return b.n - a.n || a.name.localeCompare(b.name); } };
    return L.sort(by[ST.sort] || by.latest);
  }
  function whenTxt(s) {
    var l = s.latest; if (!l) return s.joined ? 'Joined ' + ago(s.joined) : 'No activity yet';
    if (l.kind === 'rounds') { var r = l.row; return 'Round · ' + ago(l.t) + (r ? ', ' + r.strokes + (r.full ? ' (' + par(r.toPar) + ')' : ' · ' + r.holes + ' holes') + (r.sg != null ? ' · SG ' + CALC.fmtSG(r.sg) : '') : ''); }
    if (l.kind === 'tests') return 'Short game test · ' + ago(l.t);
    return 'Practice · ' + ago(l.t) + (l.min ? ', ' + l.min + ' min' + (l.focus ? ' ' + String(l.focus).toLowerCase() : '') : '');
  }
  function whenLink(s) { var l = s.latest; if (!l) return H(s.uid); return H(s.uid, (l.kind === 'rounds' ? 'round/' : l.kind === 'tests' ? 'test/' : 'practice/') + encodeURIComponent(l.id)); }
  function cardHTML(s) {
    var tr = s.trend, a5 = tr && tr.a5, ar = !tr || !tr.dir ? '' : '<small class="' + (tr.dir === 'better' ? 'cmup' : tr.dir === 'worse' ? 'cmdn' : 'cmflat') + '">' + (tr.dir === 'better' ? '↓' : tr.dir === 'worse' ? '↑' : '→') + ' ' + tr.diff.toFixed(1) + '</small>';
    var hot = needs(s), u = encodeURIComponent(s.uid);
    return '<article class="acard' + (hot ? ' hot' : '') + '" data-act="open" data-uid="' + E(s.uid) + '">' +
      '<a class="av" href="#/a/' + u + '" style="background:' + avColor(s.name) + '" aria-hidden="true" tabindex="-1">' + E(String(s.name).charAt(0).toUpperCase()) + '</a>' +
      '<div class="amain"><div class="aname"><a class="nm" href="#/a/' + u + '">' + E(s.name) + '</a>' + (hot ? '<span class="bang" title="Needs attention" aria-label="Needs attention">!</span>' : '') + '</div>' +
      '<a class="awhen" href="' + whenLink(s) + '">' + E(whenTxt(s)) + '</a></div>' +
      '<div class="ascore" title="Average score of the last 5 full rounds, arrow against the 5 before">' + (a5 != null ? '<b>' + a5.toFixed(1) + '</b>' + ar : '<b>–</b>') + '<em>AVG (5)</em></div>' +
      '<div class="atags">' + tagsHTML(s, 3) + '</div></article>';
  }
  function listView() {
    var T = ST.team, S = sums(), rows = sorted(S), n = S.length, hot = S.filter(needs).length, rd = S.reduce(function (t, s) { return t + s.periodRounds; }, 0);
    var h = '<div class="wrap dash"><div class="head"><div class="t"><span class="eyebrow">Coach dashboard</span><h1>' + E(T.name || 'My team') + '</h1><div class="sub">' + (T.coachName ? 'Coach ' + E(T.coachName) + ' · ' : '') + n + ' athlete' + (n === 1 ? '' : 's') + ' · <span id="upd">' + (ST.busy ? 'Updating…' : ST.err ? E(ST.err) : ST.last ? 'Updated ' + ago(ST.last) : '') + '</span></div></div>' +
      '<div class="codecard"><div><div class="lab">Team code</div><div class="code">' + E(T.code || '–') + '</div></div><div class="btns"><button class="btn sec sm" data-act="copycode">Invite</button></div></div></div>';
    if (!n) {
      h += '<div class="card empty"><h2>No athletes yet</h2><p class="muted">Athletes appear here after their first sync.</p><ol class="flow"><li><b>Send</b> athletes your invite: <b>' + E(T.code) + '</b></li><li><b>They join</b> in the app: Settings, then Connect to a coach.</li><li><b>Rounds arrive</b> on their own.</li></ol><p><button class="btn pri" data-act="copycode">Invite</button> <button class="btn sec" data-act="refresh">Refresh</button></p></div>';
    } else {
      h += '<div class="bar"><div class="seg" role="group" aria-label="Time frame">' + CALC.PERIODS.map(function (p) { return '<button data-act="period" data-v="' + p.id + '" class="' + (p.id === ST.period ? 'on' : '') + '" aria-pressed="' + (p.id === ST.period) + '">' + p.name + '</button>'; }).join('') + '</div>' +
        '<input type="search" id="q" placeholder="Search athletes" aria-label="Search athletes" value="' + E(ST.q) + '">' +
        '<select id="sort" aria-label="Sort">' + [['latest', 'Latest activity'], ['attention', 'Needs attention first'], ['name', 'Name'], ['last', 'Last round'], ['sg', 'SG per round'], ['rounds', 'Most rounds']].map(function (o) { return '<option value="' + o[0] + '"' + (ST.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
        '<span class="grow"></span><button class="btn sec sm" data-act="csv">CSV</button><button class="btn sec sm" data-act="refresh"' + (ST.busy ? ' disabled' : '') + '>Refresh</button></div>';
      h += '<div class="sechead"><h2>Latest activity</h2><span class="muted" id="cnt">' + (hot ? hot + ' need attention · ' : '') + rd + ' round' + (rd === 1 ? '' : 's') + ', ' + periodName(ST.period).toLowerCase() + '</span></div>' +
        '<div class="cards" id="cards">' + (rows.length ? rows.map(cardHTML).join('') : '<div class="card empty"><p class="muted">No athlete matches “' + E(ST.q) + '”.</p></div>') + '</div>' +
        '<p class="note">AVG (5) is the average score of the last 5 full rounds. The arrow is against the 5 before: <span class="arrow better">↓</span> green is lower (better), <span class="arrow worse">↑</span> red is higher (worse). Click a tag to open what it is about. SG per round is against each athlete’s own benchmark.</p>';
    }
    $app.innerHTML = h + '</div>' + footer();
  }

  // ----- one athlete -----
  function catBars(D) {
    var max = Math.max(1.5, Math.max.apply(null, D.cats.map(function (c) { return c.value == null ? 0 : Math.abs(c.value); }))); max = Math.ceil(max * 2) / 2;
    var rows = D.cats.map(function (c) {
      var w = c.value == null ? 0 : Math.min(50, Math.abs(c.value) / max * 50), side = c.value != null && c.value < 0 ? 'right:50%;width:' + w + '%' : 'left:50%;width:' + w + '%';
      var bar = c.value == null ? '' : '<u class="' + (c.solid ? (c.value < 0 ? 'n' : 'p') : 'l') + '" style="' + side + '"></u>';
      var dl = c.delta == null ? '' : '<small class="' + (c.delta >= 0.25 ? 'pos' : c.delta <= -0.25 ? 'neg' : 'muted') + '">' + CALC.fmtSG(c.delta) + ' vs usual</small>';
      return '<a class="catrow" href="' + H(CUR, 'skill/' + c.k) + '"><div class="nm"><b>' + c.name + '</b><span>' + c.sub + '</span></div><div class="track" role="img" aria-label="' + c.name + ' ' + (c.value == null ? 'no shots' : CALC.fmtSG(c.value) + ' strokes per round') + '">' + bar + '</div>' +
        '<div class="val">' + (c.value == null ? '<span class="muted">no shots</span>' : sgHTML(c.value) + (c.solid ? '' : '<small class="muted">few shots</small>') + dl) + '</div></a>'; }).join('');
    return rows + '<div class="axis"><span>−' + max + '</span><span>benchmark</span><span>+' + max + '</span></div>';
  }
  function practiceHTML(D, A) {
    if (A.profile && A.profile.mode === 'stats') return '<p class="muted">This athlete turned practice logging off.</p>';
    if (!D.prac) return '<p class="muted">No practice logged in this time frame.</p><p class="note"><a href="' + H(CUR, 'practice') + '">Practice log ›</a></p>';
    var P = D.prac, h = '';
    if (!D.vs) return '<p class="headline">' + P.hm + ' in ' + P.sessions + ' session' + (P.sessions === 1 ? '' : 's') + '</p><p class="muted">No strokes lost to the benchmark in this time frame, so there is nothing to compare.</p>';
    var g = D.vs.gap;
    h += '<p class="headline">' + (g ? E(g.name) + ' is ' + Math.round(g.lostShare * 100) + '% of strokes lost but ' + Math.round(g.timeShare * 100) + '% of practice time.' : 'Practice time is close to where the strokes go.') + '</p>';
    h += '<p class="sub">' + P.hm + ' in ' + P.sessions + ' session' + (P.sessions === 1 ? '' : 's') + (P.lessons ? ' · ' + P.lessons + ' lesson' + (P.lessons === 1 ? '' : 's') + ' logged' : '') + '.</p>';
    h += D.vs.rows.map(function (r) { var l = Math.round(r.lostShare * 100), t = Math.round(r.timeShare * 100);
      return '<div class="pvrow' + (g && g.k === r.k ? ' gap' : '') + '"><span>' + r.name + '</span><div class="pvbars"><div class="pvb l"><u style="width:' + l + '%"></u></div><div class="pvb t"><u style="width:' + t + '%"></u></div></div><em><b class="lo">' + l + '%</b> · <b class="ti">' + t + '%</b></em></div>'; }).join('');
    return h + '<div class="radarwrap"><div class="legend"><span><i style="background:#e2705c"></i>Share of strokes lost</span><span><i style="background:#2f6fc9"></i>Share of practice time</span></div></div><p class="note"><a href="' + H(CUR, 'practice') + '">Practice log ›</a> · <a href="' + H(CUR, 'plan') + '">Practice plan ›</a></p>';
  }
  function testsHTML(D, A) {
    if (!D.tests.length) return '<p class="muted">No short game test finished yet.</p>';
    var T = D.tests.slice(0, 6), cols = CALC.TEST_CATS;
    var h = '<div class="scroll"><table class="rt tests"><thead><tr><th>Date</th>' + cols.map(function (c) { return '<th>' + c.name + '</th>'; }).join('') + '</tr></thead><tbody>';
    T.forEach(function (t, i) { var prev = D.tests[i + 1];
      var u = H(CUR, 'test/' + encodeURIComponent(t.id)); h += '<tr class="clk" data-href="' + u + '"><td><a href="' + u + '">' + fd(t.t, true) + '</a>' + (isNewItem(CUR, 'tests', t.id) ? '<span class="tag new">New</span>' : '') + '</td>' + cols.map(function (c) { var v = t.cats[c.k], p = prev && prev.cats[c.k], dv = v != null && p != null ? v - p : null;
        return '<td>' + (v == null ? '<span class="muted">–</span>' : sgHTML(v, 2) + (dv != null && Math.abs(dv) >= 0.03 ? ' <small class="' + (dv > 0 ? 'pos' : 'neg') + '">' + (dv > 0 ? '▲' : '▼') + '</small>' : '')) + '</td>'; }).join('') + '</tr>'; });
    return h + '</tbody></table></div><p class="note">Strokes gained per shot against the benchmark. The same shots every test. ▲ better and ▼ worse than the test before. <a href="' + H(CUR, 'tests') + '">All tests ›</a></p>';
  }
  function roundsHTML(D) {
    var all = D.allRounds, rows = ST.showAll ? all.slice(0, 40) : all.slice(0, 12), C = CALC.CATS;
    if (!all.length) return '<p class="muted">No finished rounds yet.</p>';
    var h = '<div class="scroll"><table class="rt"><thead><tr><th>Date</th><th class="l">Course</th><th>Score</th><th>To par</th><th>SG</th>' + C.map(function (c) { return '<th>' + c.name + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) { var u = H(CUR, 'round/' + encodeURIComponent(r.id)); h += '<tr class="clk" data-href="' + u + '"><td><a href="' + u + '">' + fd(r.t, true) + '</a></td><td class="l" title="' + E(r.course) + '">' + E(r.course) + (r.play === 'tournament' ? '<span class="tag">Tournament</span>' : '') + (isNewItem(CUR, 'rounds', r.id) ? '<span class="tag new">New</span>' : '') + '</td><td><b>' + r.strokes + '</b>' + (r.full ? '' : ' <small class="muted">' + r.holes + ' holes</small>') + '</td><td>' + par(r.toPar) + '</td><td>' + sgHTML(r.sg) + '</td>' +
      C.map(function (c) { return '<td>' + (r.cats[c.k].n ? sgHTML(r.cats[c.k].sg) : '<span class="muted">–</span>') + '</td>'; }).join('') + '</tr>'; });
    h += '</tbody></table></div>';
    h += '<p class="note"><a href="' + H(CUR, 'rounds') + '">Open all ' + all.length + ' rounds ›</a>' + (all.length > 12 ? ' · <button class="linkbtn" data-act="showall">' + (ST.showAll ? 'Show the latest 12' : 'Show 12 more') + '</button>' : '') + '</p>';
    return h + '<p class="note">Strokes gained per round, by skill. The six skills add up to the round’s total.</p>';
  }
  function trendsHTML(D) {
    var S = D.series; if (S.length < 2) return '<p class="muted">Charts start after two finished rounds.</p>';
    var tip = function (p, v) { return fd(p.t, true) + ' · ' + p.course + ' · ' + v; };
    var score = CH.line({ label: 'Score per round', yFmt: function (v) { return Math.round(v); }, series: [
      { pts: S.map(function (p) { return { t: p.t, v: p.strokes, tip: tip(p, p.strokes) }; }), dots: true, line: false, color: '#9bb7a5' },
      { pts: S.map(function (p, i) { return { t: p.t, v: D.scoreAvg[i] }; }), color: '#0b5d1e' }] });
    var sg = CH.line({ label: 'Strokes gained per round', zero: true, yFmt: function (v) { return CALC.fmtSG(v); }, series: [
      { pts: S.map(function (p) { return { t: p.t, v: p.sg18, tip: tip(p, CALC.fmtSG(p.sg18)) }; }), dots: true, line: false, color: '#9bb7a5' },
      { pts: S.map(function (p, i) { return { t: p.t, v: D.sgAvg[i] }; }), color: '#0b5d1e' }] });
    var minis = CALC.CATS.map(function (c) {
      var pts = S.map(function (p) { return { t: p.t, v: p.cats[c.k], tip: tip(p, CALC.fmtSG(p.cats[c.k])) }; }), vals = pts.filter(function (p) { return p.v != null; }).slice(-5).map(function (p) { return p.v; });
      var avg = vals.length ? vals.reduce(function (t, x) { return t + x; }, 0) / vals.length : null;
      return '<div class="mini"><b>' + c.name + '</b><span>' + (avg == null ? '–' : sgHTML(avg)) + '</span>' + CH.line({ small: true, w: 300, h: 70, zero: true, label: c.name + ' per round', series: [{ pts: pts, dots: true, color: '#1f6f4a', width: 2 }] }) + '</div>'; }).join('');
    return '<div class="charts"><div><h3>Score</h3><p class="sub">Lower is better. Dots are rounds (18 holes), the line is the average of the last 5.</p>' + score + '</div><div><h3>Strokes gained</h3><p class="sub">Per 18 holes. Above the dashed line beats the benchmark.</p>' + sg + '</div></div>' +
      '<h3 style="margin-top:22px">By skill</h3><p class="sub">Strokes gained per 18 holes. The number is the average of the last 5 rounds with shots in that skill.</p><div class="minis">' + minis + '</div>';
  }
  var TABS = [['overview', 'Overview', ''], ['rounds', 'Rounds', 'rounds'], ['stats', 'Stats', 'stats'], ['mygame', 'My Game', 'mygame'], ['trends', 'Trends', 'trends'], ['practice', 'Practice', 'practice'], ['tests', 'Tests', 'tests']];
  function chrome(uid, tab, s, extra) {
    var A = ST.athletes[uid], order = sorted(sums()).map(function (x) { return x.uid; }), i = order.indexOf(uid), prev = order[i - 1], next = order[i + 1], to = (TABS.filter(function (t) { return t[0] === tab; })[0] || [0, 0, ''])[2];
    return '<div class="crumb"><a href="#/">‹ All athletes</a><span class="sp"></span>' +
      (prev ? '<a href="' + H(prev, to) + '">‹ ' + E(ST.athletes[prev].name) + '</a>' : '') + (next ? '<a href="' + H(next, to) + '">' + E(ST.athletes[next].name) + ' ›</a>' : '') + '</div>' +
      '<div class="head"><div class="t"><span class="eyebrow">Athlete</span><h1>' + E(A.name) + (needs(s) ? ' <span class="bang" title="Needs attention">!</span>' : '') + '</h1><div class="sub">Benchmark ' + E(s.blName) + ' · ' + s.n + ' round' + (s.n === 1 ? '' : 's') + ' shared' + (s.last ? ' · last round ' + fd(s.last.t, true) : '') + (s.trend.dir ? ' · ' + arrowHTML(s.trend) + ' score trend' : '') + '</div></div>' + (extra || '') + '</div>' +
      '<nav class="atabs" aria-label="Athlete sections">' + TABS.map(function (t) { return '<a href="' + H(uid, t[2]) + '" class="' + (t[0] === tab ? 'on' : '') + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + t[1] + '</a>'; }).join('') + '</nav>';
  }
  var pages = null;
  function athletePage(uid, parts, query) {
    var A = ST.athletes[uid], s = sums().filter(function (x) { return x.uid === uid; })[0], R;
    if (!pages) pages = window.COACHPAGES({ ST: ST, CALC: CALC, CH: CH, E: E, LIBS: LIBS, fd: fd, par: par, sgHTML: sgHTML, hm: hm, seenFor: seenFor, markItem: markItem, detail: function (u) { return CALC.detail(ST.athletes[u], LIBS, { period: 'all', seen: seenFor(u) }); }, trendsHTML: trendsHTML });
    try { R = pages.render(uid, parts, query); } catch (e) { if (window.console) console.error(e); $app.innerHTML = '<div class="wrap dash"><p class="msg err">Couldn’t show this page.</p><p><a href="' + H(uid) + '">Back to ' + E(A.name) + '</a></p></div>'; return; }
    if (!R) { location.hash = H(uid); return; }
    var title = { rounds: 'Rounds', stats: 'Stats', mygame: 'My Game', trends: 'Trends', practice: 'Practice', tests: 'Tests', overview: 'Overview' }[R.tab] || '';
    document.title = A.name + ' · ' + title + ' – ' + (ST.team.name || 'Coach dashboard') + ' – Strokewise';
    var y = ST.keepY; ST.keepY = null;
    $app.innerHTML = '<div class="wrap dash">' + chrome(uid, R.tab, s) + '<div class="apage" data-uid="' + E(uid) + '">' + R.html + '</div></div>' + pages.overlay(uid) + footer();
    pages.after($app, uid);
    if (y != null) window.scrollTo(0, y);
  }
  function athleteView(uid) {
    var A = ST.athletes[uid], D, s;
    try { D = CALC.detail(A, LIBS, { period: ST.period, seen: seenFor(uid) }); } catch (e) { if (window.console) console.error(e); $app.innerHTML = '<div class="wrap dash"><p class="msg err">Couldn’t read this athlete’s data.</p><p><a href="#/">Back to all athletes</a></p></div>'; return; }
    CUR = uid; s = D.summary; document.title = A.name + ' – ' + (ST.team.name || 'Coach dashboard') + ' – Strokewise';
    var T = D.tiles, h = '<div class="wrap dash">' + chrome(uid, 'overview', s, '<div class="seg" role="group" aria-label="Time frame">' + CALC.PERIODS.map(function (p) { return '<button data-act="period" data-v="' + p.id + '" class="' + (p.id === ST.period ? 'on' : '') + '" aria-pressed="' + (p.id === ST.period) + '">' + p.name + '</button>'; }).join('') + '</div>');
    if (s.flags.length) h += '<div class="sec">' + flagsHTML(s.flags, uid) + '</div>';
    h += '<div class="tilesm"><div class="tile"><div class="k">Average score</div><div class="v">' + (T.score == null ? '–' : T.score.toFixed(1)) + '</div><div class="n">18-hole rounds</div></div>' +
      '<div class="tile"><div class="k">Strokes gained</div><div class="v">' + (D.rounds ? sgHTML(T.sg) : '–') + '</div><div class="n">per 18 holes</div></div>' +
      '<div class="tile"><div class="k">Greens in regulation</div><div class="v">' + (T.gir == null ? '–' : Math.round(T.gir) + '%') + '</div><div class="n">of holes</div></div>' +
      '<div class="tile"><div class="k">Putts</div><div class="v">' + (T.putts == null ? '–' : T.putts.toFixed(1)) + '</div><div class="n">per 18 holes</div></div>' +
      '<div class="tile"><div class="k">Rounds</div><div class="v">' + D.rounds + '</div><div class="n">' + periodName(ST.period).toLowerCase() + '</div></div></div>';
    h += '<div class="grid2"><div class="card"><h3>Strokes gained by skill</h3><p class="sub">Per 18 holes, ' + periodName(ST.period).toLowerCase() + ', against ' + E(s.blName) + '.' + (D.usual ? ' Compared with ' + E(D.usual) + '.' : '') + '</p>' + (D.rounds ? catBars(D) : '<p class="muted">No finished rounds in this time frame.</p>') + '</div>' +
      '<div class="card"><h3>Shape of the game</h3><p class="sub">Further out is better. The dashed ring is the benchmark.</p><div class="radarwrap">' + (D.rounds ? LIBS.MYGAME.radarSVG(D.radar.cur, D.radar.prev, { R: 96, aria: 'Shape of ' + A.name + '’s game' }) : '<p class="muted">Needs a finished round.</p>') +
      '<div class="legend"><span><i style="background:#1f9d55"></i>Now</span>' + (D.radar.prev ? '<span><i style="background:#8a9a8f"></i>' + (D.radar.prev.usual ? 'Usual' : 'Year before') + '</span>' : '') + '</div></div></div></div>';
    h += '<div class="sec"><div class="card"><h3>Rounds</h3><p class="sub">Every finished round, newest first.</p>' + roundsHTML(D) + '</div></div>';
    h += '<div class="sec"><div class="card"><h3>Trends over time</h3><p class="sub">All finished rounds.</p>' + trendsHTML(D) + '</div></div>';
    h += '<div class="grid2 even"><div class="card"><h3>Short game tests</h3><p class="sub">A fixed check of putting, chipping, bunker play and wedges.</p>' + testsHTML(D, A) + '</div>' +
      '<div class="card"><h3>Strokes lost vs practice time</h3><p class="sub">' + periodName(ST.period) + '. Where the strokes go next to where the time goes.</p>' + practiceHTML(D, A) + '</div></div>';
    $app.innerHTML = h + '</div>' + footer();
  }

  // ---------- actions ----------
  function copy(text, done) { var ok = function () { toast(done); }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { window.prompt('Copy this:', text); }); else window.prompt('Copy this:', text); }
  function toast(t) { var d = document.createElement('div'); d.setAttribute('role', 'status'); d.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#14271a;color:#fff;padding:10px 18px;border-radius:999px;font:600 14px Inter,sans-serif;z-index:50'; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2200); }
  function csv() {
    var S = sorted(sums()), q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rows = [['Athlete', 'Benchmark', 'Rounds', 'Last round', 'Last score', 'SG per round (' + periodName(ST.period) + ')', 'Score trend', 'Attention']].concat(S.map(function (s) {
      return [s.name, s.blName, s.n, s.last ? new Date(s.last.t).toISOString().slice(0, 10) : '', s.last ? s.last.strokes : '', s.sg == null ? '' : s.sg.toFixed(2), s.trend.dir ? (s.trend.dir === 'better' ? 'down ' : s.trend.dir === 'worse' ? 'up ' : 'flat ') + s.trend.diff.toFixed(1) : '', s.flags.map(function (f) { return f.text; }).join('; ')]; }));
    var blob = new Blob([rows.map(function (r) { return r.map(q).join(','); }).join('\n')], { type: 'text/csv' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'strokewise-athletes-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function curUid() { var m = /^#\/a\/([^/?]+)/.exec(location.hash || ''); return m ? decodeURIComponent(m[1]) : null; }
  function curRound() { var m = /\/round\/([^/?]+)/.exec(location.hash || ''); return m ? decodeURIComponent(m[1]) : null; }
  function rerender() { ST.keepY = window.scrollY; route(); }
  if (window.APPVIEWS) { window.APPVIEWS.hooks.render = rerender; window.APPVIEWS.hooks.toast = function (t) { toast(t); }; }
  // the app's own screens hand their taps to the app's view-only code; anything that would edit is ignored
  function avAct(uid, act, v, b) {
    var AV = window.APPVIEWS, rid = curRound();
    pages.withAV(uid, function () { if (rid) AV.setRound(rid); var k = +b.getAttribute('data-k'); if (/^(wkday|wkdayclose|prday|prmoredays)$/.test(act)) AV.prDayAct(act, v); else AV.act(act, v, b, k); });
  }
  function appClick(ev, el, act, v) {
    var uid = curUid(), rid = curRound(); if (!uid || !pages) return;
    ev.preventDefault();
    if (el.hasAttribute('data-na') || el.disabled) return;
    if (act === 'goHole') { if (rid) location.hash = H(uid, 'round/' + encodeURIComponent(rid) + '/hole/' + (+el.getAttribute('data-i') + 1)); return; }
    if (act === 'setbl') { ST.bl[uid] = v; rerender(); return; }
    if (act === 'sgtview') { location.hash = H(uid, 'test/' + encodeURIComponent(v)); return; }
    if (act === 'sgttrend') { location.hash = H(uid, 'tests/trend'); return; }
    if (act === 'sgthub') { location.hash = H(uid, 'tests'); return; }
    if (act === 'sgtrow') { pages.withAV(uid, function () { window.APPVIEWS.sgt.act(act, v, el); }); return; }
    if (!pages.ALLOWED[act]) return;
    if (act === 'mgperiod') { ST.mgPeriod = v; lsSet(LS.mgPeriod, v); if (CALC.PERIODS.some(function (p) { return p.id === v; })) { ST.period = v; lsSet(LS.period, v); } }
    avAct(uid, act, v, el);
  }
  document.addEventListener('click', function (ev) {
    var row = ev.target.closest('tr.clk[data-href]'); if (row && !ev.target.closest('a, button, select, input, label')) { location.hash = row.getAttribute('data-href'); return; }
    var el = ev.target.closest('[data-act]'); if (!el) return; var act = el.getAttribute('data-act'), v = el.getAttribute('data-v');
    if (el.closest('.appui')) { appClick(ev, el, act, v); return; }
    if (act === 'open') { if (ev.target.closest('a')) return; location.hash = '#/a/' + encodeURIComponent(el.getAttribute('data-uid')); return; }
    var uid = curUid();
    if (act === 'period') { ST.period = v; lsSet(LS.period, v); route(); }
    else if (act === 'copycode') copy(copyTxt(), 'Invite copied');
    else if (act === 'refresh') pull();
    else if (act === 'reload') start();
    else if (act === 'csv') csv();
    else if (act === 'showall') { ST.showAll = !ST.showAll; route(); }
    else if (act === 'markall') { markAll(el.getAttribute('data-uid')); route(); }
    else if (act === 'rsort' && pages) { var R = pages.RS; if (R.sort === v) R.dir = -R.dir; else { R.sort = v; R.dir = v === 'course' ? 1 : -1; } rerender(); }
    else if (act === 'rsplay' && pages) { pages.RS.play = v; rerender(); }
    else if (act === 'prskill' && pages) { pages.PS.skill = v; rerender(); }
    else if (act === 'prnew' && pages) { pages.PS.fresh = false; location.hash = H(uid, 'practice'); rerender(); }
    else if (act === 'shotcat' && pages) { pages.SHOTS.cat = v; rerender(); }
    else if (act === 'shotworst' && pages) { pages.SHOTS.worst = !pages.SHOTS.worst; rerender(); }
    else if (act === 'setbl' && uid) { ST.bl[uid] = v; rerender(); }
    else if (act === 'replay' && uid && pages) { ev.preventDefault(); avAct(uid, act, v, el); }
    else if (act === 'out') { var k = cacheKey(); API.signOut(); if (k) idbSet(k, null); ST.team = null; ST.athletes = {}; ST.sums = {}; ST.loaded = false; ST.login = { msg: 'You’re signed out.', err: '', busy: false, reset: false, email: '' }; location.hash = ''; route(); }
    else if (act === 'forgot') { ST.login.reset = true; ST.login.err = ''; ST.login.msg = ''; ST.login.email = (document.getElementById('em') || {}).value || ST.login.email; route(); }
    else if (act === 'back') { ST.login.reset = false; ST.login.err = ''; ST.login.msg = ''; ST.login.email = (document.getElementById('em') || {}).value || ST.login.email; route(); }
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && ev.target.matches && ev.target.matches('.acard[data-act=open]')) { location.hash = '#/a/' + encodeURIComponent(ev.target.getAttribute('data-uid')); } });
  document.addEventListener('input', function (ev) { if (ev.target.id === 'q') { ST.q = ev.target.value; var pos = ev.target.selectionStart; listView(); var q = document.getElementById('q'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (e) {} } } });
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (t.id === 'sort') { ST.sort = t.value; lsSet(LS.sort, ST.sort); route(); return; }
    var uid = curUid(); if (!uid || !pages) return;
    if (t.getAttribute('data-sel') === 'bench') { ST.bl[uid] = t.value; rerender(); return; }
    if (t.closest && t.closest('.appui')) { var f = t.getAttribute('data-f'), AV = window.APPVIEWS;
      if (f === 'proxbench') AV.view.proxBench = t.value; else if (f === 'baseline' && t.id === 'stbl') { AV.view.stBl = t.value || ''; AV.view.stSel = null; } else if (f === 'baseline' && t.id === 'histbl') AV.view.histBl = t.value || ''; else if (f === 'baseline' && t.id === 'mgbl') ST.bl[uid] = t.value; else return;
      rerender(); }
  });
  document.addEventListener('input', function (ev) { if (ev.target.id === 'bzslider' && pages && curUid()) pages.withAV(curUid(), function () { window.APPVIEWS.data.bzUpdate(+ev.target.value); }); });
  document.addEventListener('submit', function (ev) {
    if (ev.target.id !== 'loginform') return; ev.preventDefault();
    var L = ST.login, em = (document.getElementById('em').value || '').trim(), pwEl = document.getElementById('pw'), pw = pwEl ? pwEl.value : ''; L.email = em; L.err = ''; L.msg = '';
    if (!em) { L.err = 'Type your email.'; route(); return; }
    if (L.reset) { L.busy = true; route(); API.reset(em).then(function () { L.busy = false; L.reset = false; L.msg = 'If that email has a coach account, a link to set a new password is on its way.'; route(); }, function (e) { L.busy = false; L.err = authMsg(e); route(); }); return; }
    if (!pw) { L.err = 'Type your password.'; route(); return; }
    L.busy = true; route();
    API.signIn(em, pw).then(function () { L.busy = false; L.email = ''; ST.loaded = false; start(); }, function (e) { L.busy = false; L.err = authMsg(e); route(); });
  });
  window.addEventListener('hashchange', function () { ST.keepY = null; route(); if (!ST.keepY) window.scrollTo(0, 0); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && API.session() && ST.team && Date.now() - ST.last > 60000) pull(true); });
  setInterval(function () { if (document.visibilityState === 'visible' && API.session() && ST.team) { pull(true); var u = document.getElementById('upd'); if (u && ST.last) u.textContent = 'Updated ' + ago(ST.last); } }, 120000);
  setInterval(function () { var u = document.getElementById('upd'); if (u && ST.last && !ST.busy && !ST.err) u.textContent = 'Updated ' + ago(ST.last); }, 30000);
  if (!API.ready()) { $app.innerHTML = '<div class="wrap"><p class="pad">The coach dashboard isn’t set up yet.</p></div>'; return; }
  start();
})();
