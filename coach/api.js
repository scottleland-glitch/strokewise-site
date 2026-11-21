/* StrokeWise coach site – Firebase over plain REST (no SDK), the same calls the app's sync.js makes for a coach.
 *   Authentication: accounts:signInWithPassword, accounts:sendOobCode (password reset), securetoken refresh.
 *   Realtime Database (read only here): /coaches/<uid> · /teams/<id>/info · /teams/<id>/members · /data/<uid>
 *   Items in /data/<uid>/{rounds,tests,practice,sim}/<key> are stored as { j: JSON text, u: updated }.
 * The session (uid, email, refresh + id token) is kept in localStorage on this site, so a coach stays signed in.
 * Everything takes fetch / storage / time from options so tests can run it against a stand-in server.
 */
(function (root) {
  'use strict';
  var KEY = 'strokewise.coach.session.v1';
  function fkey(k) { return String(k || '').replace(/[.#$\[\]\/]/g, '_') || '_'; }
  function create(O) {
    O = O || {};
    var F = O.fetch || root.fetch.bind(root), ST = O.storage || root.localStorage, now = O.now || function () { return Date.now(); };
    var C = O.cfg || {}, KEYP = C.firebaseKey || '', DB = String(C.db || '').replace(/\/+$/, '');
    var AUTH = 'https://identitytoolkit.googleapis.com/v1', TOK = 'https://securetoken.googleapis.com/v1';
    var S = null;
    try { S = JSON.parse(ST.getItem(KEY) || 'null'); } catch (e) { S = null; }
    if (!S || !S.refresh || !S.uid) S = null;
    function persist() { try { if (S) ST.setItem(KEY, JSON.stringify(S)); else ST.removeItem(KEY); } catch (e) {} }
    function err(code, msg) { var e = new Error(msg || code); e.code = code; return e; }
    function call(url, opt) {
      return F(url, opt).then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
          if (!r.ok) { var m = (j && j.error && (j.error.message || j.error)) || ('HTTP ' + r.status);
            throw err(r.status === 401 || r.status === 403 || /permission/i.test(m) ? 'denied' : String(m), String(m)); }
          return j;
        });
      }, function () { throw err('offline', 'No connection'); });
    }
    function post(path, body) { return call(AUTH + '/' + path + '?key=' + encodeURIComponent(KEYP), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    function take(j, email) {
      S = S || {}; S.uid = j.localId || j.user_id; S.id = j.idToken || j.id_token; S.refresh = j.refreshToken || j.refresh_token;
      S.exp = now() + (Number(j.expiresIn || j.expires_in) || 3600) * 1000; if (email || j.email) S.email = email || j.email; persist();
    }
    function token() {
      if (!S) return Promise.reject(err('signedout', 'Signed out'));
      if (S.id && S.exp > now() + 60000) return Promise.resolve(S.id);
      return call(TOK + '/token?key=' + encodeURIComponent(KEYP), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(S.refresh) })
        .then(function (j) { take(j); return S.id; }, function (e) { if (/INVALID_REFRESH_TOKEN|TOKEN_EXPIRED|USER_DISABLED|USER_NOT_FOUND/.test(e.message)) { S = null; persist(); throw err('signedout', 'Please sign in again'); } throw e; });
    }
    function db(path, q) { return token().then(function (t) { return call(DB + '/' + path + '.json?auth=' + encodeURIComponent(t) + (q || ''), { method: 'GET' }); }); }
    var api = { fkey: fkey, KEY: KEY };
    api.ready = function () { return !!(KEYP && DB); };
    api.session = function () { return S ? { uid: S.uid, email: S.email || '' } : null; };
    api.signIn = function (email, pw) {
      email = String(email || '').trim();
      return post('accounts:signInWithPassword', { email: email, password: pw, returnSecureToken: true }).then(function (j) { S = null; take(j, email); return api.session(); });
    };
    api.reset = function (email) { return post('accounts:sendOobCode', { requestType: 'PASSWORD_RESET', email: String(email || '').trim() }); };
    api.signOut = function () { S = null; persist(); };
    // The coach's team: { team, name, coachName, code } or null when this account has no team yet.
    api.team = function () {
      return db('coaches/' + S.uid).then(function (c) {
        if (!c || !c.team) return null;
        return db('teams/' + fkey(c.team) + '/info').then(function (info) { return info ? { team: c.team, name: info.name || '', coachName: info.coachName || '', code: info.code || '' } : null; });
      });
    };
    // Every athlete on the team. cache = { <uid>: athlete } from last time; an athlete's data is fetched again only when their stamp moved.
    api.pull = function (team, cache) {
      cache = cache || {};
      return db('teams/' + fkey(team) + '/members').then(function (M) {
        M = M || {}; var out = {}, changed = [];
        return Promise.all(Object.keys(M).map(function (uid) {
          var old = cache[uid];
          return db('data/' + uid + '/stamp').then(function (stamp) {
            if (old && old.stamp === stamp && stamp != null) { old.member = M[uid]; out[uid] = old; return; }
            return db('data/' + uid).then(function (d) {
              d = d || {};
              var A = { uid: uid, stamp: d.stamp == null ? null : d.stamp, name: d.name || (M[uid] && M[uid].name) || 'Athlete', member: M[uid] || {}, profile: {}, rounds: [], tests: [], practice: [], sim: [] };
              try { A.profile = d.profile && d.profile.j ? JSON.parse(d.profile.j) : {}; } catch (e) {}
              ['rounds', 'tests', 'practice', 'sim'].forEach(function (kind) { Object.keys(d[kind] || {}).forEach(function (k) { try { A[kind].push(JSON.parse(d[kind][k].j)); } catch (e) {} }); });
              out[uid] = A; changed.push(uid);
            });
          }).catch(function (e) { if (e.code === 'offline' || e.code === 'signedout') throw e; if (old) out[uid] = old; });
        })).then(function () { return { athletes: out, changed: changed }; });
      });
    };
    return api;
  }
  var API = { create: create, fkey: fkey, KEY: KEY };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.COACHAPI = API;
})(typeof self !== 'undefined' ? self : this);
