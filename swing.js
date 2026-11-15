/*
 * Varrock Desk: análisis de oscilaciones.
 * Lo usan la página (window.Swing) y el cálculo nocturno (require).
 *
 * Entrada: puntos de precio cada 6 horas { t: ms, mid: gp, v: unidades }.
 * Piso y techo son los percentiles 20 y 80 de los últimos 90 días.
 * Una "vuelta" es entrar cuando el precio toca el piso y salir cuando toca el techo.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Swing = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var DAY = 864e5;

  function quantile(sorted, q) {
    if (!sorted.length) return null;
    var pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  function median(a) { return quantile(a.slice().sort(function (x, y) { return x - y; }), 0.5); }
  function defaultTax(price) { return Math.min(5e6, Math.floor(price * 0.02)); }

  // Puntos de la API de timeseries a { t, mid, v }.
  function fromApi(data) {
    return (data || []).map(function (p) {
      var hi = p.avgHighPrice, lo = p.avgLowPrice;
      return {
        t: p.timestamp * 1000,
        mid: hi != null && lo != null ? (hi + lo) / 2 : (hi != null ? hi : lo),
        v: (p.highPriceVolume || 0) + (p.lowPriceVolume || 0)
      };
    });
  }

  function analyze(points, opts) {
    opts = opts || {};
    var now = opts.now || Date.now(), tax = opts.tax || defaultTax;
    var win = points.filter(function (p) { return p.mid != null && p.mid > 0 && p.t >= now - 90 * DAY && p.t <= now; });
    if (win.length < 120) return null; // menos de 30 días de datos
    win.sort(function (a, b) { return a.t - b.t; });
    var sorted = win.map(function (p) { return p.mid; }).sort(function (a, b) { return a - b; });
    var floor = quantile(sorted, 0.2), ceil = quantile(sorted, 0.8);
    var net = ceil - tax(ceil) - floor;

    // Prueba histórica: comprar al tocar el piso, vender al tocar el techo.
    var trips = [], cur = null;
    for (var i = 0; i < win.length; i++) {
      var p = win[i];
      if (!cur) { if (p.mid <= floor) cur = { t: p.t, p: p.mid, min: p.mid }; continue; }
      if (p.mid < cur.min) cur.min = p.mid;
      if (p.mid >= ceil) { trips.push({ days: (p.t - cur.t) / DAY, dd: cur.min / cur.p - 1 }); cur = null; }
    }
    var open = cur ? { days: (now - cur.t) / DAY, dd: cur.min / cur.p - 1 } : null;
    var dds = trips.map(function (x) { return x.dd; });
    if (open) dds.push(open.dd);

    var recent = win.filter(function (p) { return p.t >= now - 30 * DAY; }).map(function (p) { return p.mid; });
    var older = win.filter(function (p) { return p.t < now - 30 * DAY; }).map(function (p) { return p.mid; });
    var trend30 = recent.length && older.length ? median(recent) / median(older) - 1 : 0;
    var vol30 = win.filter(function (p) { return p.t >= now - 30 * DAY; }).reduce(function (s, p) { return s + (p.v || 0); }, 0);
    var spanDays = Math.min(30, (now - win[0].t) / DAY);

    var s = {
      floor: floor, ceil: ceil, net: net, netRoi: net / floor,
      trips: trips.length, entries: trips.length + (open ? 1 : 0),
      medianDays: trips.length ? median(trips.map(function (x) { return x.days; })) : null,
      worstDrop: dds.length ? Math.min.apply(null, dds) : 0,
      openDays: open ? open.days : null,
      trend30: trend30,
      dailyUnits: vol30 / Math.max(1, spanDays),
      days: (now - win[0].t) / DAY
    };
    s.candidate = s.trips >= 2 && s.netRoi >= 0.03 && s.dailyUnits >= 3 && s.trend30 > -0.12;
    s.score = s.candidate ? s.netRoi * s.trips * (s.trips / s.entries) * (1 + s.worstDrop) : 0;
    return s;
  }

  // Dónde está el precio de hoy respecto a la oscilación.
  function zone(s, latestLow, latestHigh) {
    if (!s || !latestLow) return null;
    if (latestLow <= s.floor) return 'buy';
    if (latestHigh && latestHigh >= s.ceil) return 'sell';
    if (latestLow <= s.floor * 1.03) return 'near';
    return 'mid';
  }

  return { analyze: analyze, zone: zone, fromApi: fromApi, quantile: quantile };
});
