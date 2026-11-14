/* Astro Outpost — real space weather.
   Loads real solar flares from NASA DONKI (live, last 30 days) or from the embedded
   NASA archive (22 Apr – 20 May 2024), and maps one real day onto each mission day. */
(function (JA) {
  'use strict';

  var DONKI_URL = 'https://ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR';
  var DAY = 86400000;

  function iso(d) { return d.toISOString().slice(0, 10); }

  function slim(list) {
    return list
      .filter(function (f) { return f.classType && f.peakTime; })
      .map(function (f) { return { t: f.peakTime, c: f.classType, ar: f.activeRegionNum, link: f.link }; });
  }

  // Flare class -> game storm. Level: 0 calm · 1 small (M1–M4.9) · 2 medium (M5–M9.9) · 3 big (X).
  function classify(cls) {
    if (!cls) return { level: 0, strength: 0 };
    var letter = cls.charAt(0).toUpperCase();
    var num = parseFloat(cls.slice(1)) || 1;
    if (letter === 'X') return { level: 3, strength: Math.round(20 + Math.min(10, num)) };
    if (letter === 'M' && num >= 5) return { level: 2, strength: 12 };
    if (letter === 'M') return { level: 1, strength: 6 };
    return { level: 0, strength: 0 };
  }

  function rank(cls) {
    var order = 'ABCMX'.indexOf(cls.charAt(0).toUpperCase());
    return order * 100 + (parseFloat(cls.slice(1)) || 0);
  }

  function archive() {
    var a = window.JA_ARCHIVE_FLARES;
    return { source: 'archive', start: a.start, end: a.end, flares: a.flares, downloaded: a.downloaded };
  }

  // Returns a promise of { source: 'live'|'archive', start, end, flares, fallback? }
  function load(mode) {
    if (mode !== 'live') return Promise.resolve(archive());
    var end = new Date();
    var start = new Date(end.getTime() - 30 * DAY);
    var key = 'ja-donki-' + iso(end);
    try {
      var cached = sessionStorage.getItem(key);
      if (cached) return Promise.resolve(JSON.parse(cached));
    } catch (e) { /* storage may be blocked */ }

    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 9000);
    var url = DONKI_URL + '?startDate=' + iso(start) + '&endDate=' + iso(end);
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (list) {
        clearTimeout(timer);
        var data = { source: 'live', start: iso(start), end: iso(end), flares: slim(list || []), fetchedAt: new Date().toISOString() };
        try { sessionStorage.setItem(key, JSON.stringify(data)); } catch (e) { /* ignore */ }
        return data;
      })
      .catch(function () {
        clearTimeout(timer);
        var a = archive();
        a.fallback = true;   // UI must say clearly that this is NOT live data
        return a;
      });
  }

  // One entry per real calendar day in the data range.
  function byDay(data) {
    var days = [];
    var t0 = Date.parse(data.start + 'T00:00:00Z');
    var t1 = Date.parse(data.end + 'T00:00:00Z');
    var index = {};
    for (var t = t0; t <= t1; t += DAY) {
      var d = { date: iso(new Date(t)), cls: null, level: 0, strength: 0, link: null, time: null, count: 0 };
      index[d.date] = d;
      days.push(d);
    }
    data.flares.forEach(function (f) {
      var d = index[f.t.slice(0, 10)];
      if (!d) return;
      d.count++;
      if (!d.cls || rank(f.c) > rank(d.cls)) {
        d.cls = f.c; d.link = f.link; d.time = f.t.slice(11, 16);
        var k = classify(f.c);
        d.level = k.level; d.strength = k.strength;
      }
    });
    return days;
  }

  // Choose a run of consecutive real days for the mission. The level sets how stormy
  // a window we look for; rng picks among the matching windows so replays differ.
  function pickWindow(data, nSols, levelId, rng) {
    var days = byDay(data);
    if (days.length < nSols) return days;
    var lv = JA.LEVELS[levelId] || {};
    var target = (data.source === 'archive' ? lv.stormsArchive : lv.storms) || [2, 6];
    var wins = [];
    for (var i = 0; i + nSols <= days.length; i++) {
      var score = 0;
      for (var j = 0; j < nSols; j++) score += days[i + j].level;
      wins.push({ i: i, score: score });
    }
    var good = wins.filter(function (w) { return w.score >= target[0] && w.score <= target[1]; });
    if (!good.length) {
      var mid = (target[0] + target[1]) / 2, best = Infinity;
      wins.forEach(function (w) { best = Math.min(best, Math.abs(w.score - mid)); });
      good = wins.filter(function (w) { return Math.abs(w.score - mid) === best; });
    }
    var pick = good[Math.floor(rng() * good.length)];
    return days.slice(pick.i, pick.i + nSols);
  }

  // Estimated one-way radio delay Earth <-> Mars, in minutes, for a real date.
  // Uses the planets' mean orbits plus a first-order correction for their oval shape.
  // Good to a few percent — always shown to players as "about".
  function marsDelayMin(dateStr) {
    var d = (Date.parse(dateStr + 'T12:00:00Z') - Date.UTC(2000, 0, 1, 12)) / DAY;
    function planet(L0, rate, peri, a, e) {
      var L = (L0 + rate * d) * Math.PI / 180;
      var M = L - peri * Math.PI / 180;
      var v = M + 2 * e * Math.sin(M);
      var r = a * (1 - e * e) / (1 + e * Math.cos(v));
      var lon = v + peri * Math.PI / 180;
      return { x: r * Math.cos(lon), y: r * Math.sin(lon) };
    }
    var E = planet(100.46, 0.98564736, 102.94, 1.0, 0.0167);
    var Mx = planet(355.45, 0.52402075, 336.04, 1.5237, 0.0934);
    var au = Math.hypot(E.x - Mx.x, E.y - Mx.y);
    return au * 8.3167;
  }

  function prettyDate(dateStr) {
    var m = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var p = dateStr.split('-');
    return parseInt(p[2], 10) + ' ' + m[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }

  JA.weather = { load: load, pickWindow: pickWindow, classify: classify, marsDelayMin: marsDelayMin, prettyDate: prettyDate, byDay: byDay };
})(window.JA);
