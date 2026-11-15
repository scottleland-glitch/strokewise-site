/* StrokeWise coach site – small SVG charts (strings, no libraries). */
(function (root) {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function niceStep(span, n) { var raw = span / n, p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
  // o: { w, h, series: [{ pts: [{ t, v, tip }], dots, line, color, width }], zero: bool (draw a line at 0), yFmt, label, small }
  function line(o) {
    var w = o.w || 640, h = o.h || 230, small = !!o.small, P = small ? { l: 4, r: 4, t: 6, b: 4 } : { l: 40, r: 12, t: 12, b: 26 };
    var all = []; o.series.forEach(function (s) { s.pts.forEach(function (p) { if (p.v != null) all.push(p); }); });
    if (all.length < 2) return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(o.label || 'chart') + '"><text x="' + w / 2 + '" y="' + h / 2 + '" text-anchor="middle" font-size="14" fill="#4a5d50">Not enough rounds yet</text></svg>';
    var t0 = Math.min.apply(null, all.map(function (p) { return p.t; })), t1 = Math.max.apply(null, all.map(function (p) { return p.t; })); if (t1 === t0) t1 = t0 + 864e5;
    var lo = Math.min.apply(null, all.map(function (p) { return p.v; })), hi = Math.max.apply(null, all.map(function (p) { return p.v; }));
    if (o.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    var step = niceStep((hi - lo) || 1, 4); lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step; if (hi === lo) hi = lo + step;
    var X = function (t) { return P.l + (t - t0) / (t1 - t0) * (w - P.l - P.r); }, Y = function (v) { return P.t + (hi - v) / (hi - lo) * (h - P.t - P.b); };
    var s = '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(o.label || 'chart') + '">';
    if (!small) {
      for (var v = lo; v <= hi + step / 2; v += step) { var y = Y(v); s += '<line x1="' + P.l + '" y1="' + y + '" x2="' + (w - P.r) + '" y2="' + y + '" stroke="#e2e6df"/><text x="' + (P.l - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11.5" fill="#4a5d50">' + esc(o.yFmt ? o.yFmt(v) : Math.round(v * 10) / 10) + '</text>'; }
      var d = new Date(t0); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); var ticks = 0;
      while (d.getTime() < t1 && ticks < 14) { var x = X(d.getTime()); s += '<line x1="' + x + '" y1="' + P.t + '" x2="' + x + '" y2="' + (h - P.b) + '" stroke="#eef0ec"/><text x="' + x + '" y="' + (h - 8) + '" text-anchor="middle" font-size="11.5" fill="#4a5d50">' + MON[d.getMonth()] + '</text>'; d = new Date(d.getFullYear(), d.getMonth() + 1, 1); ticks++; }
    }
    if (o.zero) s += '<line x1="' + P.l + '" y1="' + Y(0) + '" x2="' + (w - P.r) + '" y2="' + Y(0) + '" stroke="#14271a" stroke-width="' + (small ? 1 : 1.5) + '" stroke-dasharray="4 4" opacity=".6"/>';
    o.series.forEach(function (S) {
      var pts = S.pts.filter(function (p) { return p.v != null; });
      if (S.line !== false && pts.length > 1) s += '<polyline points="' + pts.map(function (p) { return X(p.t).toFixed(1) + ',' + Y(p.v).toFixed(1); }).join(' ') + '" fill="none" stroke="' + S.color + '" stroke-width="' + (S.width || 2.5) + '" stroke-linejoin="round" stroke-linecap="round"/>';
      if (S.dots) pts.forEach(function (p) { s += '<circle cx="' + X(p.t).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="' + (small ? 2 : 3.5) + '" fill="' + S.color + '"' + (p.tip ? '><title>' + esc(p.tip) + '</title></circle>' : '/>'); });
    });
    return s + '</svg>';
  }
  root.COACHCHARTS = { line: line, esc: esc };
})(typeof self !== 'undefined' ? self : this);
