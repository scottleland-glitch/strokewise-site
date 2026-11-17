(function (root) {
  'use strict';
  // ---- the shim: stands in for the phone. The app's code below reads its data through these. Nothing here can write anywhere. ----
  var SG = root.SG, MYGAME = root.MYGAME, TRENDS = root.TRENDS, SGTEST = root.SGTEST, INSIGHTS = root.INSIGHTS, PLAN = root.PLAN, BZ = root.BZ, FUN = root.FUN, COURSES = root.COURSES, BAG = root.BAG, WEDGES = root.WEDGES, STORY = root.STORY, NEAR = root.NEAR, WA = root.WA;
  var window = root, document = root.document, hooks = { render: function () {}, toast: function () {} };
  var mem = {}, localStorage = { getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; }, setItem: function () {}, removeItem: function () {} }; // the athlete's phone data is not here: always empty
  var CFG = {}, SYNCX = null, live = null, LIVE_DB = '', gdOn = false, gdState = {}, GDX = null;
  function render() { hooks.render(); }
  function toast(m) { hooks.toast(m); }
  function html0() { return ''; }
  var pdfHTML = html0, grSheetHTML = html0, storyHTML = html0, storyFullHTML = html0, mvBarHTML = html0, mvSheetHTML = html0, addSheetHTML = html0, sendSheetHTML = html0, gdCardHTML = html0, prSheetHTML = html0, sessSheetHTML = html0,
    typicalCardHTML = html0, playPickHTML = html0, notMineHTML = html0, modeRowHTML = html0, quickRowHTML = html0, tabBarHTML = html0, pageBarHTML = html0, coDecorate = html0, coSearch = html0, coSheets = html0, prSheets = html0, wkStart = html0;
  function storyClose() {} function storyAct() {} function makeGameReport() { return Promise.reject(new Error('not on the web')); } function backupDirty() {} function syncSnap() {} function syncDirty() {} function syncNow() {} function shareStatus() { return ''; } function syncOn() { return false; }
  function save() {} function saveBag() {} function savePractice() {} function saveSgTests() {} function saveWedges() {} function setMyBench() {} function setTour() {} function setMode() {} function setTypical() {} function prOpen() {} function gdSoon() {} function coAct() { return false; }
  function loadJsPDF() { return Promise.reject(new Error('no pdf')); } function svgToPng() { return Promise.reject(new Error('no pdf')); } function pdfWrap() {} function pdfLines() {} function radarPng() {} function pdfMyGamePages() {}
  /*@@APP@@*/
  // ---- what the web pages call ----
  // enter(A): look at one athlete with the app's own maths – their rounds stand in for the phone's (the same trick as the app's withAthlete)
  function enter(A, bl) { mem[PN] = A.name; view.stPlayer = A.name; view.histPlayer = A.name; CO.view = A.uid; CO.ctx = A; rounds = (A.rounds || []).slice(); view.mgPlayer = A.name; view.trWho = A.name; view.coBl = bl || null; view.coSw = false; return A; }
  function leave() { delete mem[PN]; view.stPlayer = null; view.histPlayer = null; CO.view = null; CO.ctx = null; rounds = []; view.mgPlayer = null; view.trWho = null; view.coBl = null; }
  root.APPVIEWS = { view: view, hooks: hooks, enter: enter, leave: leave, act: function (a, v, b, k) { return appAct(a, v, b, k); }, prDayAct: function (a, v) { return prDayAct(a, v); },
    html: { myGame: myGameHTML, stats: statsHTML, trends: trendsHTML, practice: practicePageHTML, compare: compareHTML2, birdie: birdieHTML, map: mapHTML, replay: replayHTML,
      rsTop: rsTopHTML, scorecard: scorecardHTML, quick: quickViewHTML, takeaway: takeawayHTML, tiles: statTilesHTML, curves: roundParCurvesHTML, puttBrk: rsPuttBrkHTML, cmp: compareHTML, sgtResult: function () { return SGTUI.html(); } },
    post: { heat: applyHeat, legend: legendNotes, infoize: infoize, stScroll: stListScroll },
    data: { bzUpdate: bzUpdate, byDay: byDay, prWords: prWords, prTitle: prTitle, spokeOf: spokeOf, dayLabel: dayLabel, dayKey: dayKey, pgOf: pgOf, PRG: PRG, hmS: hmS, CAT_NAME: CAT_NAME, scorecard: scorecardData, statsRound: statsRound, statsData: statsData, mgData: mgData, trendsData: trendsData, planData: planData, rounds: function () { return rounds; }, round: round },
    // the Practice page's cards one at a time (coach Practice tab), each built exactly as the app's practicePageHTML builds it
    practice: {
      week: function () { var who = mgWho(), P = planData(who); return recsOn(who) ? weekCardHTML(who, P) : weekCardHTML(who, P, true); },
      ahead: function () { var who = mgWho(); return recsOn(who) ? weekAheadHTML(who, planData(who)) : ''; }, // v232: a coach always sees the week-ahead summary
      gap: function () { return gapCardHTML(mgWho()); },
      spider: function () { var who = mgWho(); return practiceOn(who) ? practiceCardHTML(who, mgData(who), 'spider') : ''; },
      vs: function () { var who = mgWho(), rec = recentDaysHTML(practiceOf(who)); return practiceCardHTML(who, mgData(who), 'rest').replace(rec, ''); },
      recent: function () { return recentDaysHTML(practiceOf(mgWho())); },
      playing: function () { var who = mgWho(); return playingCardHTML(who, mgData(who), true); },
      plan: function () { var who = mgWho(); return recsOn(who) ? planCardHTML(who, planData(who)) : ''; },
      on: function () { return practiceOn(mgWho()); }, recs: function () { return recsOn(mgWho()); }
    },
    // a view-only preference held in this page's memory (never saved, never sent): e.g. Playing and practice "Compare with …"
    pref: function (k, v) { if (v === undefined) return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; mem[k] = String(v); },
    sgt: SGTUI, setRound: function (id) { view.roundId = id; } };
})(typeof self !== 'undefined' ? self : this);
