/* StrokeWise coach site – one athlete, every screen the app's coach review shows, read-only.
 * Native pages (rounds, a round, a hole, a skill, practice, tests) are built here. The app's own busy screens
 * (Stats, My Game, Trends, the practice plan, maps, replay, short game test results) come from lib/appviews.js,
 * which is generated from the app's code (dev/port/extract-app.js), so they match the app exactly.
 * Routes (after #/a/<athlete>): overview · rounds · round/<id> · round/<id>/hole/<n> · round/<id>/birdie · stats · mygame · trends ·
 * compare · skill/<k> · practice · practice/<id> · plan · tests · test/<id> · tests/trend
 */
(function (root) {
  'use strict';
  root.COACHPAGES = function (X) {
    var ST = X.ST, CALC = X.CALC, CH = X.CH, E = X.E, LIBS = X.LIBS, AV = root.APPVIEWS, SG = root.SG, MG = root.MYGAME, T = root.SGTEST;
    var fd = X.fd, par = X.par, sgHTML = X.sgHTML, DAY = 864e5, CATS = CALC.CATS;
    var H = function (uid, rest) { return '#/a/' + encodeURIComponent(uid) + (rest ? '/' + rest : ''); };
    var RS = { sort: 'date', dir: -1, play: 'all' }, PS = { skill: 'all', fresh: false }, SHOTS = { cat: 'all', worst: false };
    var LINE_OF = {}; (T.LINES || []).forEach(function (l) { LINE_OF[l.k] = l; });
    var CAT_NAME = { tee: 'Off the tee', approach: 'Approach', short: 'Short game', bunker: 'Bunker', putting: 'Putting' };
    var READ = { up: 'Uphill', flat: 'Flat', down: 'Downhill' }, BRK = { l: 'breaks left', s: 'straight', r: 'breaks right' };
    var DIRW = { left: 'Left', right: 'Right', long: 'Long', short: 'Short', longleft: 'Long left', longright: 'Long right', shortleft: 'Short left', shortright: 'Short right' };

    // ---------- shared ----------
    function sgv(v, d) { return sgHTML(v, d); }
    function mark(uid, id) { X.markItem(uid, id); }
    function isNew(uid, kind, id) { var s = X.seenFor(uid), A = ST.athletes[uid], it = (A[kind] || []).filter(function (x) { return x.id === id; })[0]; return !!(it && s.base && CALC.itemT(it) > s.base && !s.ids[id]); }
    function newTag(uid, kind, id) { return isNew(uid, kind, id) ? '<span class="tag new">New</span>' : ''; }
    function ctx(uid) { var A = ST.athletes[uid], P = CALC.prepare(A, LIBS); return { A: A, P: P }; }
    function benchId(uid, P) { return ST.bl[uid] || P.bl; }
    var depth = 0;
    function withAV(uid, fn) { var c = ctx(uid), bl = benchId(uid, c.P); if (depth++ === 0) AV.enter(c.A, bl); try { return fn(c.A, c.P, bl); } finally { if (--depth === 0) AV.leave(); } }
    // the app's wording, for the web: no "slip", no phone-only hints. Only text between tags and in labels is touched, never class names.
    function webText(html) {
      var fix = function (t) { return t.replace(/\bSlipping\b/g, 'Trending down').replace(/\bSlipped\b/g, 'Dropped').replace(/\bslipping\b/g, 'trending down').replace(/\bslipped\b/g, 'dropped').replace(/\bslips\b/g, 'drops').replace(/\bslip\b/g, 'drop').replace(/tap a hole to edit · swipe for more/g, 'click a hole for its shots').replace(/\bTap a row to use it\b/g, 'Click a row to use it').replace(/\bpractise\b/g, 'practice'); };
      return String(html).replace(/>([^<]+)</g, function (m, t) { return '>' + fix(t) + '<'; }).replace(/(aria-label|title)="([^"]*)"/g, function (m, a, t) { return a + '="' + fix(t) + '"'; });
    }
    function panel(html, cls) { return '<div class="appui ap ' + (cls || '') + '">' + webText(html) + '</div>'; }
    function tile(k, v, n, cls) { return '<div class="tile ' + (cls || '') + '"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="n">' + (n || '') + '</div></div>'; }
    function empty(msg) { return '<div class="card empty"><p class="muted">' + msg + '</p></div>'; }
    function arrowSG(d) { if (d == null || Math.abs(d) < 0.05) return '<span class="muted">→</span>'; return '<span class="arrow ' + (d > 0 ? 'better' : 'worse') + '">' + (d > 0 ? '↑' : '↓') + '</span>'; }
    function ftTxt(v) { return v == null ? '–' : Math.round(v) + ' ft'; }
    function lieName(l) { return CALC.lieName ? CALC.lieName(l) : ({ tee: 'Tee', fairway: 'Fairway', rough: 'Rough', deep: 'Deep rough', bunker: 'Bunker', green: 'Green', hazard: 'Hazard', trees: 'Trees', ob: 'Out of bounds', holed: 'Holed', recovery: 'Trees', sand: 'Bunker' }[l] || l); }
    function dist(lie, d) { return CALC.dtxt(lie, d); }
    function benchSelect(uid, P, id) { var cur = benchId(uid, P);
      return '<label class="inl">Benchmark <select data-sel="bench" data-uid="' + E(uid) + '" aria-label="Benchmark">' + SG.BASELINES.map(function (b) { return '<option value="' + b.id + '"' + (b.id === cur ? ' selected' : '') + '>' + E(b.name) + (b.id === P.bl ? ' (athlete’s)' : '') + '</option>'; }).join('') + '</select></label>'; }
    function pager(prev, next, mid) { return '<div class="pager">' + (prev ? '<a class="btn sec sm" href="' + prev.href + '">‹ ' + prev.label + '</a>' : '<span></span>') + (mid ? '<span class="mid">' + mid + '</span>' : '') + (next ? '<a class="btn sec sm" href="' + next.href + '">' + next.label + ' ›</a>' : '<span></span>') + '</div>'; }
    function periodSeg() { return '<div class="seg" role="group" aria-label="Time frame">' + CALC.PERIODS.map(function (p) { return '<button data-act="period" data-v="' + p.id + '" class="' + (p.id === ST.period ? 'on' : '') + '" aria-pressed="' + (p.id === ST.period) + '">' + p.name + '</button>'; }).join('') + '</div>'; }
    function back(uid, to, label) { return '<div class="subnav"><a href="' + H(uid, to) + '">‹ ' + label + '</a></div>'; }
    var sumMemo = {};
    function sumOf(uid, row, bl) { var k = uid + '|' + row.id + '|' + bl; return sumMemo[k] || (sumMemo[k] = SG.summarize(row.round, bl)); }

    // ---------- Rounds ----------
    function playName(k) { return k === 'tournament' ? 'Tournament' : 'Practice round'; }
    function roundsPage(uid) {
      var c = ctx(uid), P = c.P, bl = benchId(uid, P), rows = P.rows.slice(); if (!rows.length) return empty('No finished rounds yet.');
      var tour = rows.filter(function (r) { return r.play === 'tournament'; }).length;
      if (RS.play !== 'all') rows = rows.filter(function (r) { return r.play === RS.play; });
      var val = { date: function (r) { return r.t; }, course: function (r) { return r.course.toLowerCase(); }, score: function (r) { return r.strokes; }, topar: function (r) { return r.toPar; }, sg: function (r) { return r.sg18; }, putts: function (r) { return r.putts * 18 / r.holes; }, gir: function (r) { return r.gir == null ? -1 : r.gir; }, fir: function (r) { var S = sumOf(uid, r, bl); return S.fwTotal ? S.fwHit / S.fwTotal : -1; } };
      CATS.forEach(function (k) { val[k.k] = function (r) { return r.cats[k.k].n ? r.cats[k.k].sg * 18 / r.holes : -99; }; });
      var f = val[RS.sort] || val.date; rows.sort(function (a, b) { var x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * RS.dir || b.t - a.t; });
      var th = function (k, label, cls) { return '<th class="' + (cls || '') + '"><button class="sorter' + (RS.sort === k ? ' on' : '') + '" data-act="rsort" data-v="' + k + '" aria-label="Sort by ' + label + '">' + label + (RS.sort === k ? (RS.dir < 0 ? ' ↓' : ' ↑') : '') + '</button></th>'; };
      var h = '<div class="card"><div class="cardhead"><div><h3>Rounds</h3><p class="sub">' + P.rows.length + ' finished rounds. Click a round for the scorecard and every shot. Strokes gained against ' + E(SG.baseline(bl).name) + '.</p></div>' +
        '<div class="seg" role="group" aria-label="Round type">' + [['all', 'All ' + P.rows.length], ['tournament', 'Tournament ' + tour], ['practice', 'Practice ' + (P.rows.length - tour)]].map(function (o) { return '<button data-act="rsplay" data-v="' + o[0] + '" class="' + (RS.play === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
        '<div class="scroll"><table class="rt rounds"><thead><tr>' + th('date', 'Date') + th('course', 'Course', 'l') + th('score', 'Score') + th('topar', 'To par') + th('sg', 'SG') + CATS.map(function (k) { return th(k.k, k.name); }).join('') + th('putts', 'Putts') + th('gir', 'GIR') + th('fir', 'FIR') + '</tr></thead><tbody>';
      rows.forEach(function (r) { var S = sumOf(uid, r, bl), url = H(uid, 'round/' + encodeURIComponent(r.id));
        h += '<tr class="clk" data-href="' + url + '"><td><a href="' + url + '">' + fd(r.t, true) + '</a></td><td class="l" title="' + E(r.course) + '">' + E(r.course) + (r.play === 'tournament' ? '<span class="tag">Tournament</span>' : '') + newTag(uid, 'rounds', r.id) + '</td>' +
          '<td><b>' + r.strokes + '</b>' + (r.full ? '' : ' <small class="muted">' + r.holes + ' holes</small>') + '</td><td>' + par(r.toPar) + '</td><td>' + sgv(r.sg18) + '</td>' +
          CATS.map(function (k) { return '<td>' + (r.cats[k.k].n ? sgv(r.cats[k.k].sg * 18 / r.holes) : '<span class="muted">–</span>') + '</td>'; }).join('') +
          '<td>' + r.putts + '</td><td>' + (r.gir == null ? '–' : Math.round(r.gir) + '%') + '</td><td>' + (S.fwTotal ? Math.round(100 * S.fwHit / S.fwTotal) + '%' : '–') + '</td></tr>'; });
      h += '</tbody></table></div><p class="note">SG is per 18 holes; the six skills add up to it. Putts is per round. FIR is fairways hit. <a href="' + H(uid, 'compare') + '">Compare best and worst rounds</a></p></div>';
      var D = X.detail(uid); h += '<div class="card"><h3>Score and strokes gained over time</h3>' + X.trendsHTML(D) + '</div>';
      return h;
    }

    // ---------- one round ----------
    function plays(r) { return r.play === 'tournament' ? '<span class="tag">Tournament</span>' : ''; }
    function roundPage(uid, id, query) {
      var c = ctx(uid), P = c.P, bl = benchId(uid, P), i = -1; P.rows.forEach(function (r, k) { if (r.id === id) i = k; });
      if (i < 0) return empty('That round isn’t in this athlete’s shared rounds. <a href="' + H(uid, 'rounds') + '">Back to rounds</a>');
      mark(uid, id);
      var row = P.rows[i], r = row.round, S = SG.summarize(r, bl), older = P.rows[i + 1], newer = P.rows[i - 1], B = SG.baseline(bl);
      var h = back(uid, 'rounds', 'All rounds') + pager(older ? { href: H(uid, 'round/' + encodeURIComponent(older.id)), label: 'Older · ' + fd(older.t) } : null, newer ? { href: H(uid, 'round/' + encodeURIComponent(newer.id)), label: 'Newer · ' + fd(newer.t) } : null, 'Round ' + (P.rows.length - i) + ' of ' + P.rows.length);
      var yds = 0; r.holes.forEach(function (x) { yds += SG.holeYards(x) || 0; });
      h += '<div class="rhead"><div><h2>' + E(row.course) + '</h2><div class="sub">' + fd(row.t, true) + ' · ' + row.holes + ' holes ' + plays(row) + newTag(uid, 'rounds', id) + '</div></div>' + benchSelect(uid, P) + '</div>';
      h += '<div class="tilesm">' + tile('Score', '<b>' + S.strokes + '</b> <small>' + (row.full ? par(row.toPar) : row.holes + ' holes') + '</small>', yds ? yds + ' yd' : '') +
        tile('Strokes gained', sgv(S.sgTotal), 'vs ' + E(B.name)) + tile('Putts', S.putts, (S.putts / S.holesDone).toFixed(1) + ' per hole') +
        tile('Greens in regulation', S.girHoles ? Math.round(100 * S.gir / S.girHoles) + '%' : '–', S.gir + ' / ' + S.girHoles) + tile('Fairways hit', S.fwTotal ? Math.round(100 * S.fwHit / S.fwTotal) + '%' : '–', S.fwHit + ' / ' + S.fwTotal) +
        tile('Penalties', S.penalties, 'strokes') + '</div>';
      h += withAV(uid, function () { AV.setRound(id);
        var out = '<div class="card"><h3>Scorecard</h3><p class="sub">Hole by hole: par, length, score, strokes gained, putts, greens and fairways. Click a hole for its shots.</p>' + panel(AV.html.scorecard(r, S), 'sc') +
          '<p><button class="btn sec" data-act="replay" data-v="0">▶ Hole replay</button> <a class="btn sec" href="' + H(uid, 'round/' + encodeURIComponent(id) + '/birdie') + '">Birdie zone</a></p></div>';
        out += '<div class="grid2"><div class="card"><h3>Strokes gained by category</h3><p class="sub">This round, against ' + E(B.name) + '. Plus is better.</p>' + sgTable(S, uid, row) + '</div>' +
          '<div class="card"><h3>Same round, every benchmark</h3><p class="sub">Click a row to use that benchmark on this page.</p>' + cmpTable(r, bl, uid) + '</div></div>';
        out += '<div class="grid2 even"><div class="card"><h3>Round takeaway</h3>' + panel(AV.html.takeaway(r), 'tk') + '</div>' +
          '<div class="col"><div class="card"><h3>Quick view</h3>' + panel(AV.html.quick(S), 'qv') + '<div style="height:10px"></div>' + puttBrk(r) + '</div>' +
          '<div class="card"><h3>Round stats</h3><p class="sub">Click a row for the detail. Rows with a map open it: miss patterns, greens, putt reads, club numbers.</p>' + panel(AV.html.tiles(S) + AV.html.curves(r, bl, S), 'stats') + '</div></div></div>';
        out += '<div class="card"><h3>By distance</h3><p class="sub">Shots, strokes gained and where the ball finished, by distance from the hole.</p>' + byDist(S) + '</div>';
        return out; });
      h += shotsCard(uid, row, S);
      return h;
    }
    function puttBrk(r) { var x = AV.html.puttBrk(r); return x ? panel(x, 'pb') : ''; }
    function sgTable(S, uid, row) {
      var max = Math.max(1, Math.max.apply(null, ['tee', 'approach', 'short', 'bunker', 'putting'].map(function (k) { return Math.abs(S.cats[k].sg); })));
      var h = '<table class="rt cats"><thead><tr><th class="l">Category</th><th>Shots</th><th>SG</th><th class="barcol"></th></tr></thead><tbody>';
      ['tee', 'approach', 'short', 'bunker', 'putting'].forEach(function (k) { var c = S.cats[k], w = Math.min(50, Math.abs(c.sg) / max * 50);
        h += '<tr><td class="l">' + CAT_NAME[k] + '</td><td>' + c.n + '</td><td>' + (c.n ? sgv(c.sg, 2) : '<span class="muted">–</span>') + '</td><td class="barcol"><div class="track sm">' + (c.n ? '<u class="' + (c.sg < 0 ? 'n' : 'p') + '" style="' + (c.sg < 0 ? 'right' : 'left') + ':50%;width:' + w + '%"></u>' : '') + '</div></td></tr>'; });
      return h + '<tr class="tot"><td class="l"><b>Total</b></td><td>' + ['tee', 'approach', 'short', 'bunker', 'putting'].reduce(function (t, k) { return t + S.cats[k].n; }, 0) + '</td><td>' + sgv(S.sgTotal, 2) + '</td><td></td></tr></tbody></table>';
    }
    function cmpTable(r, bl, uid) {
      var h = '<div class="scroll"><table class="rt cmp"><thead><tr><th class="l">Benchmark</th><th>Tee</th><th>App</th><th>Short</th><th>Sand</th><th>Putt</th><th>Total</th></tr></thead><tbody>';
      SG.BASELINES.forEach(function (b) { var S = SG.summarize(r, b.id);
        h += '<tr class="clk' + (b.id === bl ? ' cur' : '') + '" data-act="setbl" data-v="' + b.id + '" tabindex="0"><td class="l">' + E(b.name) + (b.status === 'estimated' ? '<sup>est</sup>' : '') + '</td>' + ['tee', 'approach', 'short', 'bunker', 'putting'].map(function (k) { return '<td>' + sgv(S.cats[k].sg) + '</td>'; }).join('') + '<td><b>' + sgv(S.sgTotal) + '</b></td></tr>'; });
      return h + '</tbody></table></div><p class="note"><sup>est</sup> estimated benchmark.</p>';
    }
    function byDist(S) {
      var groups = [['Approach', SG.APPR_BUCKETS.map(function (b) { return b.id; })], ['Short game', [SG.SHORT_BUCKET]], ['Bunker', [SG.BUNKER_BUCKET]], ['Putting', ['0-5 ft', '5-15 ft', '15-30 ft', '30+ ft']]];
      var h = '<div class="scroll"><table class="rt bydist"><thead><tr><th class="l">From</th><th>Shots</th><th>SG</th><th>Avg to pin after</th></tr></thead><tbody>';
      groups.forEach(function (g) { h += '<tr class="grp"><td colspan="4">' + g[0] + '</td></tr>'; g[1].forEach(function (b) { var c = S.buckets[b], ap = g[0] === 'Approach';
        h += '<tr><td class="l">' + b + '</td><td>' + c.n + '</td><td>' + (c.n ? sgv(c.sg, 2) : '<span class="muted">–</span>') + '</td><td>' + (ap ? (c.proxN ? Math.round(c.proxFt) + ' ft' : '–') : '') + '</td></tr>'; }); });
      return h + '</tbody></table></div><p class="note">Approach is every shot from more than 30 yd off the green. Short game is off the green from 30 yd and in. Avg to pin after: feet on the green, yards × 3 off it.</p>';
    }
    function readTxt(rd) { var m = /^(up|flat|down)-(l|s|r)$/.exec(rd || ''); return m ? READ[m[1]] + ', ' + BRK[m[2]] : ''; }
    function shotRow(uid, rid, hi, s, bl) {
      var res = s.end.lie === 'holed' ? 'Holed' : lieName(s.end.lie) + ' ' + dist(s.end.lie, s.end.dist), put = s.start.lie === 'green';
      var miss = s.pen !== 'none' ? (s.ob ? 'OB' : 'Penalty') + (s.penStrokes > 1 ? ' +' + s.penStrokes : ' +1') : s.dir ? (DIRW[s.dir] || s.dir) : '';
      return '<tr class="shot c-' + s.cat + '"><td>' + s.n + '</td><td class="l">' + lieName(s.start.lie) + ' ' + dist(s.start.lie, s.start.dist) + '</td><td class="l">' + res + '</td><td class="l">' + E(s.club || (put ? 'Putter' : '')) + '</td><td class="l">' + E(miss) + '</td><td class="l">' + E(put ? readTxt(s.rd) : '') + '</td><td class="l">' + CAT_NAME[s.cat] + '</td><td>' + sgv(s.sg, 2) + '</td></tr>';
    }
    var SHOT_HEAD = '<thead><tr><th>#</th><th class="l">From</th><th class="l">To</th><th class="l">Club</th><th class="l">Miss</th><th class="l">Putt read</th><th class="l">Category</th><th>SG</th></tr></thead>';
    function shotsCard(uid, row, S) {
      var r = row.round, rid = encodeURIComponent(row.id), cats = ['all', 'tee', 'approach', 'short', 'bunker', 'putting'];
      var h = '<div class="card"><div class="cardhead"><div><h3>Every shot</h3><p class="sub">Strokes gained on each shot. Click a hole for its page.</p></div><div class="seg" role="group" aria-label="Shot filter">' +
        cats.map(function (k) { return '<button data-act="shotcat" data-v="' + k + '" class="' + (SHOTS.cat === k ? 'on' : '') + '">' + (k === 'all' ? 'All' : CAT_NAME[k]) + '</button>'; }).join('') + '</div></div>';
      if (SHOTS.worst) {
        var all = []; S.holes.forEach(function (hh, hi) { hh.shots.forEach(function (s) { if (!s.layup && (SHOTS.cat === 'all' || s.cat === SHOTS.cat)) all.push({ hi: hi, s: s }); }); }); all.sort(function (a, b) { return a.s.sg - b.s.sg; });
        h += '<p><button class="linkbtn" data-act="shotworst">Show in hole order</button></p><div class="scroll"><table class="rt shots"><thead><tr><th class="l">Hole</th>' + SHOT_HEAD.replace('<thead><tr>', '') + '<tbody>' + all.map(function (x) { return shotRow(uid, rid, x.hi, x.s).replace('<td>' + x.s.n + '</td>', '<td class="l"><a href="' + H(uid, 'round/' + rid + '/hole/' + (x.hi + 1)) + '">Hole ' + (x.hi + 1) + '</a> · shot ' + x.s.n + '</td>'); }).join('') + '</tbody></table></div>';
      } else {
        h += '<p><button class="linkbtn" data-act="shotworst">Show worst shots first</button></p><div class="scroll"><table class="rt shots">' + SHOT_HEAD + '<tbody>';
        S.holes.forEach(function (hh, hi) { var hole = r.holes[hi], list = hh.shots.filter(function (s) { return SHOTS.cat === 'all' || s.cat === SHOTS.cat; }); if (!hh.done || !list.length) return;
          h += '<tr class="hole"><td colspan="8"><a href="' + H(uid, 'round/' + rid + '/hole/' + (hi + 1)) + '"><b>Hole ' + (hi + 1) + '</b> · par ' + hole.par + (SG.holeYards(hole) ? ' · ' + SG.holeYards(hole) + ' yd' : '') + ' · score ' + hh.strokes + '</a><span class="hsg">' + sgv(hh.sg, 2) + '</span></td></tr>';
          list.forEach(function (s) { h += shotRow(uid, rid, hi, s); }); });
        h += '</tbody></table></div>';
      }
      return h + '</div>';
    }

    // ---------- one hole ----------
    function holePage(uid, id, n) {
      var c = ctx(uid), P = c.P, bl = benchId(uid, P), row = P.rows.filter(function (r) { return r.id === id; })[0], hi = n - 1;
      if (!row || !row.round.holes[hi]) return empty('That hole isn’t in this round. <a href="' + H(uid, 'rounds') + '">Back to rounds</a>');
      var r = row.round, S = SG.summarize(r, bl), hh = S.holes[hi], hole = r.holes[hi], rid = encodeURIComponent(id), N = r.holes.length;
      var pin = hole.pin && SG.PIN_NAME ? SG.PIN_NAME[hole.pin] : '';
      var h = back(uid, 'round/' + rid, E(row.course) + ' · ' + fd(row.t)) + pager(hi > 0 ? { href: H(uid, 'round/' + rid + '/hole/' + hi), label: 'Hole ' + hi } : null, hi < N - 1 ? { href: H(uid, 'round/' + rid + '/hole/' + (hi + 2)), label: 'Hole ' + (hi + 2) } : null, 'Hole ' + n + ' of ' + N);
      h += '<div class="rhead"><div><h2>Hole ' + n + '</h2><div class="sub">Par ' + hole.par + (SG.holeYards(hole) ? ' · ' + SG.holeYards(hole) + ' yd' : '') + (pin ? ' · pin ' + E(pin.toLowerCase()) : '') + '</div></div>' + benchSelect(uid, P) + '</div>';
      if (!hh.done) return h + empty('This hole wasn’t finished.');
      var sc = hh.strokes - hole.par, putts = hh.putts;
      h += '<div class="tilesm">' + tile('Score', '<b>' + hh.strokes + '</b> <small>' + (sc === 0 ? 'par' : par(sc)) + '</small>', '') + tile('Strokes gained', sgv(hh.sg, 2), 'this hole') + tile('Putts', putts, '') +
        tile('Green in regulation', hh.gir ? 'Yes' : 'No', '') + tile('Fairway', hole.par >= 4 ? (hh.fairway == null ? '–' : hh.fairway ? 'Hit' : 'Missed') : 'Par 3', '') + tile('Penalties', hh.shots.reduce(function (t, s) { return t + (s.penStrokes || 0); }, 0), '') + '</div>';
      h += '<div class="card"><h3>Shots</h3><div class="scroll"><table class="rt shots">' + SHOT_HEAD + '<tbody>' + hh.shots.map(function (s) { return shotRow(uid, rid, hi, s); }).join('') + '</tbody></table></div>' +
        '<p>' + withAV(uid, function () { AV.setRound(id); return '<button class="btn sec" data-act="replay" data-v="' + hi + '">▶ Replay this hole on the map</button>'; }) + '</p></div>';
      var byCat = {}; hh.shots.forEach(function (s) { if (s.layup) return; byCat[s.cat] = (byCat[s.cat] || 0) + s.sg; });
      h += '<div class="card"><h3>Strokes gained on this hole</h3><div class="scroll"><table class="rt cats"><tbody>' + Object.keys(byCat).map(function (k) { return '<tr><td class="l">' + CAT_NAME[k] + '</td><td>' + sgv(byCat[k], 2) + '</td></tr>'; }).join('') + '<tr class="tot"><td class="l"><b>Total</b></td><td>' + sgv(hh.sg, 2) + '</td></tr></tbody></table></div></div>';
      return h;
    }

    // ---------- the app's screens (Stats, My Game, Trends, plan, compare, birdie) ----------
    function pageHead(title, sub, right) { return '<div class="rhead"><div><h2>' + title + '</h2><div class="sub">' + sub + '</div></div>' + (right || '') + '</div>'; }
    function appPage(uid, key, title, sub, inner, withPeriod) {
      return pageHead(title, sub, withPeriod ? periodSeg() : '') + '<div class="apphost">' + withAV(uid, function (A, P, bl) { if (withPeriod) AV.view.mgPeriod = ST.mgPeriod || ST.period; return panel(inner(A, P, bl), 'full ' + key); }) + '</div>'; // v230: Last rounds r1–r4 stay on ST.mgPeriod so a rerender doesn't wipe them
    }
    function statsPage(uid) { return appPage(uid, 'stats', 'Stats', 'The app’s Stats screen: pick one round, the last 5 or all of them. Maps, putts, clubs, benchmarks.', function () { return AV.html.stats(); }); }
    function mygamePage(uid) { return appPage(uid, 'mygame', 'My Game', 'Shape of the game, benchmarks, forecasts with ranges, miss patterns. Same screen as the app.', function () { return AV.html.myGame(); }, true); }
    function trendsPage(uid) { return appPage(uid, 'trends', 'Trends', 'Your athlete\'s score and each skill by week, with one dashed line for the next 3 weeks. Same screen as the app.', function () { return AV.html.trends(); }); }
    function planPage(uid) { return practiceNav(uid, 'plan') + appPage(uid, 'plan', 'Practice plan', 'What the app would have this athlete practice next, ranked by strokes lost. Same page as the app.', function () { return AV.html.practice(); }); }
    function comparePage(uid) { return appPage(uid, 'compare', 'Best and worst rounds', 'Two rounds side by side, or the best 5 against the worst 5.', function () { return AV.html.compare(); }); }
    function birdiePage(uid, id) { return back(uid, 'round/' + encodeURIComponent(id), 'Round') + pageHead('Birdie zone', 'How many more birdies a longer hole-out range would make.', '') + withAV(uid, function () { AV.setRound(id); var v = AV.view; if (!v.bz || v.bz.rid !== id) { v.bz = { scope: 'round', rid: id, from: 'summary', R: 0 }; v.bzD = null; } return '<div class="apphost">' + panel(AV.html.birdie(), 'full birdie') + '</div>'; }); }

    // ---------- Skills ----------
    function skillPage(uid, k) {
      var c = ctx(uid), D = CALC.skillDetail(c.A, LIBS, k, {}); if (!D) return empty('Unknown skill.');
      var C = D.cat, h = back(uid, '', 'Overview') + pageHead(C.name, C.sub, periodSeg());
      var series = D.series.filter(function (p) { return p.v != null; });
      h += '<div class="tilesm">' + tile('Last 5 rounds', D.avg5 == null ? '–' : sgv(D.avg5), 'SG per 18 holes') + tile('Usual', D.usual == null ? '–' : sgv(D.usual), 'the 20 rounds before') +
        tile('Change', D.delta == null ? '–' : arrowSG(D.delta) + ' ' + sgv(D.delta), 'vs usual') + tile('Shots', D.shots, 'last 20 rounds') + tile('Practice', MG && D.m30 ? X.hm(D.m30) : '0m', 'last 30 days · ' + X.hm(D.m90) + ' in 90') + '</div>';
      h += '<div class="card"><h3>' + C.name + ' per round</h3><p class="sub">Strokes gained per 18 holes. Click a round in the table for its shots.</p>' + CH.line({ label: C.name + ' per round', zero: true, yFmt: function (v) { return CALC.fmtSG(v); }, series: [{ pts: series.map(function (p) { return { t: p.t, v: p.v, tip: fd(p.t, true) + ' · ' + p.course + ' · ' + CALC.fmtSG(p.v) }; }), dots: true, color: '#1f6f4a', width: 2 }] }) + '</div>';
      h += '<div class="grid2 even"><div class="card"><h3>Worst shots</h3><p class="sub">The 12 costliest ' + C.name.toLowerCase() + ' shots in the last 20 rounds.</p>' + shotList(uid, D.worst) + '</div><div class="card"><h3>Best shots</h3><p class="sub">The 5 best.</p>' + shotList(uid, D.best) + '</div></div>';
      h += '<div class="card"><h3>Rounds</h3><div class="scroll"><table class="rt"><thead><tr><th>Date</th><th class="l">Course</th><th>Shots</th><th>SG</th><th>SG per 18</th></tr></thead><tbody>' + D.rows.slice(0, 30).map(function (r) { var u = H(uid, 'round/' + encodeURIComponent(r.id));
        return '<tr class="clk" data-href="' + u + '"><td><a href="' + u + '">' + fd(r.t, true) + '</a></td><td class="l">' + E(r.course) + '</td><td>' + r.n + '</td><td>' + (r.sg == null ? '<span class="muted">–</span>' : sgv(r.sg, 2)) + '</td><td>' + (r.sg18 == null ? '<span class="muted">–</span>' : sgv(r.sg18)) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
      h += '<div class="grid2 even"><div class="card"><h3>Practice on ' + C.name.toLowerCase() + '</h3>' + (D.logs.length ? '<ul class="lst">' + D.logs.slice(0, 8).map(function (e) { return '<li><a href="' + H(uid, 'practice/' + encodeURIComponent(e.id)) + '">' + fd(Date.parse(e.date), true) + ' · ' + E(AV.data.prTitle(e)) + ' · ' + e.min + ' min</a>' + newTag(uid, 'practice', e.id) + '</li>'; }).join('') + '</ul>' : '<p class="muted">No practice logged for this skill.</p>') + '</div>' +
        '<div class="card"><h3>Short game test</h3>' + (D.testCat ? (D.tests.length ? '<ul class="lst">' + D.tests.slice(0, 6).map(function (t) { return '<li><a href="' + H(uid, 'test/' + encodeURIComponent(t.id)) + '">' + fd(t.t, true) + '</a> · ' + sgv(t.sg, 2) + ' a shot' + newTag(uid, 'tests', t.id) + '</li>'; }).join('') + '</ul>' : '<p class="muted">No short game test yet.</p>') : '<p class="muted">The short game test doesn’t cover this skill.</p>') + '</div></div>';
      return h;
    }
    function shotList(uid, L) { if (!L.length) return '<p class="muted">No shots yet.</p>';
      return '<ul class="lst shotlst">' + L.map(function (s) { return '<li><a href="' + H(uid, 'round/' + encodeURIComponent(s.rid) + '/hole/' + s.hole) + '">' + fd(s.t) + ' · hole ' + s.hole + '</a> <span class="mut">' + E(s.text) + '</span> ' + sgv(s.sg, 2) + '</li>'; }).join('') + '</ul>'; }

    // ---------- Practice ----------
    function practiceNav(uid, on) { return '<div class="subtabs"><a class="' + (on === 'log' ? 'on' : '') + '" href="' + H(uid, 'practice') + '">Practice log</a><a class="' + (on === 'plan' ? 'on' : '') + '" href="' + H(uid, 'plan') + '">Practice plan</a></div>'; }
    function spokeName(k) { return AV.data.CAT_NAME && false ? '' : (MG.SPOKES.filter(function (s) { return s.k === k; })[0] || { name: k }).name; }
    function logsOf(uid) { var A = ST.athletes[uid]; return MG.validPractice(A.practice || []).sort(function (a, b) { return Date.parse(b.date) - Date.parse(a.date) || (a.id < b.id ? 1 : -1); }); }
    function practicePage(uid, query) {
      var A = ST.athletes[uid], logs = logsOf(uid);
      if (A.profile && A.profile.mode === 'stats') return practiceNav(uid, 'log') + empty('This athlete turned practice logging off.');
      var now = Date.now(), sel = PS.skill, onlyNew = query && /(^|&)new=1/.test(query) || PS.fresh;
      var s = X.seenFor(uid), isFresh = function (e) { return isNew(uid, 'practice', e.id); };
      var shown = logs.filter(function (e) { return (sel === 'all' || e.spoke === sel) && (!onlyNew || isFresh(e)); });
      var m30 = 0, m90 = 0, n30 = 0, les = 0; logs.forEach(function (e) { var d = now - Date.parse(e.date); if (d <= 30 * DAY) { m30 += e.min; n30++; } if (d <= 90 * DAY) m90 += e.min; if (e.kind === 'lesson') les++; });
      var h = practiceNav(uid, 'log') + pageHead('Practice', logs.length + ' sessions logged. Click one for the detail.', '');
      h += '<div class="tilesm">' + tile('Last 30 days', X.hm(m30), n30 + ' sessions') + tile('Last 90 days', X.hm(m90), (m90 ? Math.round(m90 / 13) : 0) + ' min a week') + tile('Lessons', les, 'logged in total') + tile('Sessions', logs.length, 'all time') + tile('New', logs.filter(isFresh).length, 'since you last looked') + '</div>';
      var skills = [['all', 'All skills']].concat(MG.SPOKES.map(function (x) { return [x.k, x.name]; }));
      h += '<div class="card"><div class="cardhead"><div><h3>Sessions</h3></div><div class="chips" role="group" aria-label="Skill">' + skills.map(function (o) { return '<button data-act="prskill" data-v="' + o[0] + '" class="chip' + (sel === o[0] ? ' on' : '') + '">' + E(o[1]) + '</button>'; }).join('') + (onlyNew ? '<button class="chip on" data-act="prnew">New only ✕</button>' : '') + '</div></div>';
      if (!shown.length) return h + '<p class="muted">Nothing matches.</p></div>';
      var days = AV.data.byDay(shown);
      h += '<div class="scroll"><table class="rt prac"><thead><tr><th>Date</th><th class="l">Skill</th><th class="l">Focus</th><th>Minutes</th><th class="l">Kind</th><th class="l">Feel</th></tr></thead><tbody>';
      days.forEach(function (d) { h += '<tr class="grp"><td colspan="6">' + E(AV.data.dayLabel(d.k, true)) + ' · ' + AV.data.hmS(d.tot) + '</td></tr>';
        d.list.forEach(function (e) { var u = H(uid, 'practice/' + encodeURIComponent(e.id));
          h += '<tr class="clk" data-href="' + u + '"><td><a href="' + u + '">' + fd(Date.parse(e.date), true) + '</a></td><td class="l">' + E(spokeName(e.spoke)) + '</td><td class="l">' + E(e.focus || '') + (e.kind === 'lesson' ? '<span class="tag">Lesson</span>' : '') + newTag(uid, 'practice', e.id) + '</td><td>' + e.min + '</td><td class="l">' + E(prKind(e)) + '</td><td class="l">' + E(feelTxt(e)) + '</td></tr>'; }); });
      return h + '</tbody></table></div></div>';
    }
    var FEEL = { off: 'Off day', ok: 'Okay', great: 'Great' }, KIND = { reps: 'Reps', mixed: 'Mixed', game: 'Game-like' };
    function feelTxt(e) { return FEEL[e.feel] || ''; } function prKind(e) { return KIND[e.type] || ''; }
    function practiceDetail(uid, id) {
      var logs = logsOf(uid), i = -1; logs.forEach(function (e, k) { if (e.id === id) i = k; });
      if (i < 0) return practiceNav(uid, 'log') + empty('That practice session isn’t in this athlete’s log. <a href="' + H(uid, 'practice') + '">Back to practice</a>');
      mark(uid, id); var e = logs[i], older = logs[i + 1], newer = logs[i - 1], t = Date.parse(e.date), key = AV.data.dayKey(e);
      var same = logs.filter(function (x) { return x.id !== id && AV.data.dayKey(x) === key; });
      var wk = logs.filter(function (x) { var d = Math.abs(Date.parse(x.date) - t); return d <= 3.5 * DAY; }), wkMin = wk.reduce(function (s, x) { return s + x.min; }, 0);
      var sk = CATS.filter(function (c) { return c.spokes.indexOf(e.spoke) >= 0; })[0], c = ctx(uid), D = sk ? CALC.skillDetail(c.A, LIBS, sk.k, {}) : null;
      var h = back(uid, 'practice', 'All practice') + pager(older ? { href: H(uid, 'practice/' + encodeURIComponent(older.id)), label: 'Earlier · ' + fd(Date.parse(older.date)) } : null, newer ? { href: H(uid, 'practice/' + encodeURIComponent(newer.id)), label: 'Later · ' + fd(Date.parse(newer.date)) } : null, 'Session ' + (logs.length - i) + ' of ' + logs.length);
      h += '<div class="rhead"><div><h2>' + E(AV.data.prTitle(e)) + (e.kind === 'lesson' ? ' <span class="tag">Lesson</span>' : '') + newTag(uid, 'practice', id) + '</h2><div class="sub">' + E(AV.data.dayLabel(key, true)) + ' · ' + E(spokeName(e.spoke)) + '</div></div></div>';
      h += '<div class="tilesm">' + tile('Time', e.min + ' min', AV.data.hmS(e.min)) + tile('Skill', E(spokeName(e.spoke)), '') + tile('Kind', E(prKind(e)) || '–', 'reps, mixed or game-like') + tile('Feel', E(feelTxt(e)) || '–', 'how it went') + tile('That week', X.hm(wkMin), wk.length + ' sessions') + '</div>';
      if (e.kind === 'lesson') h += '<div class="card"><h3>Lesson</h3><dl class="kv">' + (e.coach ? '<dt>Coach</dt><dd>' + E(e.coach) + '</dd>' : '') + '<dt>Change</dt><dd>' + (e.change === 'big' ? 'Big change. The app resets the trend for this area.' : 'Fine tune') + '</dd>' + (e.what ? '<dt>Worked on</dt><dd>' + E(e.what) + '</dd>' : '') + (e.lesson ? '<dt>Notes</dt><dd>' + E(e.lesson) + '</dd>' : '') + '</dl></div>';
      if (same.length) h += '<div class="card"><h3>Same day</h3><ul class="lst">' + same.map(function (x) { return '<li><a href="' + H(uid, 'practice/' + encodeURIComponent(x.id)) + '">' + E(AV.data.prTitle(x)) + '</a> · ' + x.min + ' min · ' + E(spokeName(x.spoke)) + '</li>'; }).join('') + '</ul></div>';
      if (D) h += '<div class="card"><h3>How ' + sk.name.toLowerCase() + ' is going on the course</h3><p class="sub">Last 5 rounds ' + (D.avg5 == null ? 'have no shots yet' : sgv(D.avg5) + ' per 18 holes') + (D.usual != null ? ', usual ' + sgv(D.usual) : '') + (D.delta != null ? ' ' + arrowSG(D.delta) : '') + '. ' + X.hm(D.m90) + ' of practice in the last 90 days.</p><p><a class="btn sec sm" href="' + H(uid, 'skill/' + sk.k) + '">Open ' + sk.name + '</a> <a class="btn sec sm" href="' + H(uid, 'plan') + '">Practice plan</a></p></div>';
      return h;
    }

    // ---------- Tests ----------
    function testRows(uid) { var c = ctx(uid), P = c.P, L = CALC.testsOf(c.A, LIBS, P), A = c.A; return L.map(function (t, i) { var full = (A.tests || []).filter(function (x) { return x.id === t.id; })[0]; return { t: t, full: full, i: i }; }); }
    function testsPage(uid) {
      var c = ctx(uid), rows = testRows(uid), cols = CALC.TEST_CATS, bl = benchId(uid, c.P);
      var h = pageHead('Short game tests', rows.length + ' finished. Click one for every shot, the score against the last test and against the benchmark.', rows.length > 1 ? '<a class="btn sec sm" href="' + H(uid, 'tests/trend') + '">Trend over time</a>' : '');
      if (!rows.length) return h + empty('No short game test finished yet.');
      h += '<div class="card"><div class="scroll"><table class="rt tests"><thead><tr><th>Date</th>' + cols.map(function (k) { return '<th>' + k.name + '</th>'; }).join('') + '<th>Shots</th><th class="l">Notes</th></tr></thead><tbody>';
      rows.forEach(function (x) { var t = x.t, prev = rows[x.i + 1] && rows[x.i + 1].t, u = H(uid, 'test/' + encodeURIComponent(t.id)); var ent = x.full ? T.entered(x.full) : 0;
        h += '<tr class="clk" data-href="' + u + '"><td><a href="' + u + '">' + fd(t.t, true) + '</a>' + newTag(uid, 'tests', t.id) + '</td>' + cols.map(function (k) { var v = t.cats[k.k], p = prev && prev.cats[k.k], dv = v != null && p != null ? v - p : null;
          return '<td>' + (v == null ? '<span class="muted">–</span>' : sgv(v, 2) + (dv != null && Math.abs(dv) >= 0.03 ? ' ' + arrowSG(dv) : '')) + '</td>'; }).join('') + '<td>' + ent + ' of ' + (x.full ? T.totalOf(x.full) : '–') + '</td><td class="l">' + (prev ? 'vs ' + fd(prev.t) : 'First test') + '</td></tr>'; });
      return h + '</tbody></table></div><p class="note">Strokes gained per shot against ' + E(SG.baseline(bl).name) + '. Same shots every test. Green up arrow: better than the test before. Red down arrow: worse.</p></div>';
    }
    function testPage(uid, id) {
      var rows = testRows(uid), x = rows.filter(function (r) { return r.t.id === id; })[0];
      if (!x) return back(uid, 'tests', 'All tests') + empty('That test isn’t in this athlete’s finished tests.');
      mark(uid, id); var older = rows[x.i + 1], newer = rows[x.i - 1], test = x.full, c = ctx(uid), bl = benchId(uid, c.P);
      var h = back(uid, 'tests', 'All tests') + pager(older ? { href: H(uid, 'test/' + encodeURIComponent(older.t.id)), label: 'Earlier · ' + fd(older.t.t) } : null, newer ? { href: H(uid, 'test/' + encodeURIComponent(newer.t.id)), label: 'Later · ' + fd(newer.t.t) } : null, 'Test ' + (rows.length - x.i) + ' of ' + rows.length);
      h += '<div class="rhead"><div><h2>Short game test</h2><div class="sub">' + fd(x.t.t, true) + newTag(uid, 'tests', id) + '</div></div>' + benchSelect(uid, c.P) + '</div>';
      h += testTable(uid, test, rows.slice(x.i + 1).map(function (r) { return r.full; }), bl);
      h += '<div class="card"><h3>The app’s test report</h3><p class="sub">Spider chart, bars against your usual and the coaching notes, as the athlete sees them.</p>' + withAV(uid, function () { var v = AV.view; v.sgt = { mode: 'result', id: id, who: c.A.name }; v.screen = 'sgtest'; return panel(AV.html.sgtResult(), 'full sgt'); }) + '</div>';
      return h;
    }
    function skillKey(st, spec) { return st.id === 'compass' ? (LINE_OF[spec.line] && LINE_OF[spec.line].straight ? 'short' : 'brk') : st.id; }
    function shotSG(st, spec, e, bl, i) { try { if (st.kind === 'ladder' || st.kind === 'updown') return null; var b = T.blank('x', '2020-01-01', '', bl); if (!b.shots[st.id]) return null; b.shots[st.id][i] = e; var s = T.score(b, SG, bl).skills[skillKey(st, spec)]; return s ? s.sg : null; } catch (er) { return null; } }
    function entryTxt(st, e) { if (!e) return '<span class="muted">not taken</span>'; if (st.kind === 'ladder' || st.kind === 'updown') return e.n + (st.kind === 'updown' ? ' of ' + T.UD_BALLS : ' balls'); if (st.kind === 'compass') return e.made ? 'Holed' : 'Missed' + (e.miss ? ' ' + e.miss : '');
      if (e.res === 'sand') return 'Still in the sand'; if (e.res === 'over') return 'Over the green'; if (e.res === 'short') return 'Didn’t reach the green'; return (e.ft === 0 ? 'Holed' : Math.round(e.ft * 10) / 10 + ' ft away') + (e.dir ? ', ' + (DIRW[e.dir] || e.dir).toLowerCase() : ''); }
    function testTable(uid, test, prevTests, bl) {
      var cur = T.score(test, SG, bl), ps = prevTests.map(function (t) { return T.score(t, SG, bl); }), cmp = T.compare(cur, ps), h = '';
      h += '<div class="card"><h3>Skills: this test, last test, benchmark</h3><p class="sub">Compared with the average of the last ' + Math.min(6, ps.length) + ' tests' + (ps.length ? '' : ' (none yet)') + ' and the benchmark ' + E(SG.baseline(bl).name) + '. Strokes gained is per shot.</p><div class="scroll"><table class="rt skills"><thead><tr><th class="l">Skill</th><th class="l">Area</th><th>This test</th><th>Usual</th><th>vs usual</th><th>Benchmark</th><th>SG a shot</th><th>Index</th></tr></thead><tbody>';
      T.SKILLS.forEach(function (sk) { var s = cur.skills[sk.k], cc = cmp.skills[sk.k]; if (!s || s.n === 0) return; var good = cc.status === 'better', bad = cc.status === 'worse';
        var of = s.of || sk.of, un = function (v) { return sk.unit === 'made' ? T.fmtNum(sk, v) + ' of ' + of : sk.unit === 'ft' ? T.fmtNum(sk, v) + ' ft' : T.fmtNum(sk, v) + ' balls'; };
        var bench = s.bench != null ? un(s.bench) : '<span class="muted">–</span>';
        h += '<tr><td class="l">' + E(sk.name) + '</td><td class="l">' + E((T.CATS.filter(function (q) { return q.k === sk.cat; })[0] || {}).name || sk.cat) + '</td><td><b>' + T.fmtVal(sk, s) + '</b></td><td>' + (cc.usual == null ? '<span class="muted">–</span>' : un(cc.usual)) + '</td><td>' + (cc.delta == null ? '<span class="muted">–</span>' : '<span class="arrow ' + (good ? 'better' : bad ? 'worse' : '') + '">' + (good ? '↑' : bad ? '↓' : '→') + '</span> ' + (good ? 'better' : bad ? 'worse' : 'same')) + '</td><td>' + bench + '</td><td>' + (s.sg == null ? '<span class="muted">–</span>' : sgv(s.sg, 2)) + '</td><td>' + (s.index == null ? '–' : Math.round(s.index)) + '</td></tr>'; });
      h += '</tbody></table></div></div>';
      h += '<div class="card"><h3>Every shot</h3><p class="sub">Each attempt, its result and strokes gained.</p>';
      T.STATIONS.forEach(function (st) { var arr = test.shots[st.id]; if (!arr || !T.inTest(test, st) || !arr.some(Boolean)) return;
        h += '<h4 class="stn">' + E(st.name) + '</h4><div class="scroll"><table class="rt attempts"><thead><tr><th>#</th><th class="l">Shot</th><th class="l">Result</th><th>SG</th></tr></thead><tbody>' + arr.map(function (e, i) { var spec = st.shots ? st.shots[i] : null, sg = e ? shotSG(st, spec || {}, e, bl, i) : null;
          return '<tr><td>' + (i + 1) + '</td><td class="l">' + E(spec && spec.label ? spec.label : st.dist ? st.dist + ' yd' : st.kind === 'updown' ? 'Up and down' : st.name) + '</td><td class="l">' + entryTxt(st, e) + '</td><td>' + (sg == null ? '<span class="muted">–</span>' : sgv(sg, 2)) + '</td></tr>'; }).join('') + '</tbody></table></div>'; });
      return h + '</div>';
    }
    function testTrendPage(uid) { return back(uid, 'tests', 'All tests') + pageHead('Test trend', 'Every finished test, oldest to newest.', '') + withAV(uid, function (A) { var v = AV.view; v.sgt = { mode: 'trend', who: A.name }; v.screen = 'sgtest'; return '<div class="apphost">' + panel(AV.html.sgtResult(), 'full sgt trend') + '</div>'; }); }

    // ---------- routing ----------
    var lastKey = '';
    function render(uid, parts, query) {
      var p = parts[0] || '', a = decodeURIComponent(parts[1] || '');
      var key = uid + '|' + (p === 'round' ? a : ''); if (key !== lastKey) { AV.view.map = null; AV.view.replay = null; AV.view.sgt = null; AV.view.stx = {}; lastKey = key; }
      if (p === 'rounds') return { tab: 'rounds', html: roundsPage(uid) };
      if (p === 'round') { if (parts[2] === 'hole') return { tab: 'rounds', html: holePage(uid, a, +parts[3] || 1) }; if (parts[2] === 'birdie') return { tab: 'rounds', html: birdiePage(uid, a) }; return { tab: 'rounds', html: roundPage(uid, a, query) }; }
      if (p === 'stats') return { tab: 'stats', html: statsPage(uid) };
      if (p === 'mygame') return { tab: 'mygame', html: mygamePage(uid) };
      if (p === 'trends') return { tab: 'trends', html: trendsPage(uid) };
      if (p === 'compare') return { tab: 'rounds', html: comparePage(uid) };
      if (p === 'skill') return { tab: 'overview', html: skillPage(uid, a) };
      if (p === 'practice') return { tab: 'practice', html: parts[1] ? practiceDetail(uid, a) : practicePage(uid, query) };
      if (p === 'plan') return { tab: 'practice', html: planPage(uid) };
      if (p === 'tests') return { tab: 'tests', html: parts[1] === 'trend' ? testTrendPage(uid) : testsPage(uid) };
      if (p === 'test') return { tab: 'tests', html: testPage(uid, a) };
      return null;
    }
    // overlays (map, replay) belong to the page that opened them: drawn on top, closed with ✕
    function overlay(uid) {
      var v = AV.view; if (v.map == null && v.replay == null) return '';
      var m = /\/round\/([^/?]+)/.exec(location.hash || ''); var id = m ? decodeURIComponent(m[1]) : null; if (!id) { v.map = null; v.replay = null; return ''; }
      return withAV(uid, function () { AV.setRound(id); return '<div class="modal" role="dialog" aria-modal="true"><div class="appui ap">' + webText((v.map != null ? AV.html.map() : '') + (v.replay != null ? AV.html.replay() : '')) + '</div></div>'; });
    }
    // after the page is in the DOM: the app's own tidy-up passes (info buttons, legend notes, heat colours)
    function after(root2, uid) {
      withAV(uid, function () { [].forEach.call(root2.querySelectorAll('.appui'), function (el) { try { AV.post.legend(el); AV.post.infoize(el); } catch (e) { if (window.console) console.error(e); } });
        try { AV.post.heat(); } catch (e) {} try { AV.post.stScroll(); } catch (e) {} });
      [].forEach.call(root2.querySelectorAll('.appui [data-act]'), function (el) { if (!ALLOWED[el.getAttribute('data-act')]) el.setAttribute('data-na', '1'); });
    }
    var NAV = { goHole: 1, setbl: 1 }, ALLOWED = {};
    ('info mgperiod mgknow trzoom trwk strange stpick stpickev stpickclr stround stcmp stcat stpmb stcur stpt blminest blminehist tkknow stx map mapscope mapclose pinseg proxb proxlie clubsel heat pmg puttn cmpn cmpkind cmpgrp cmpside bzscope replay rpgreen rpgreenback rpghole rpclose wkoff wkfull wkclose prfull prclose plweek plbench sgtoggle prplan sgtrow sgttrend sgthub setbl goHole wkday wkdayclose prday prmoredays').split(' ').forEach(function (k) { ALLOWED[k] = 1; });
    function renderWeb(uid, parts, query) { var r = render(uid, parts, query); if (r && r.html) r.html = webText(r.html); return r; }
    return { render: renderWeb, overlay: overlay, after: after, RS: RS, PS: PS, SHOTS: SHOTS, withAV: withAV, ALLOWED: ALLOWED, H: H };
  };
})(window);
