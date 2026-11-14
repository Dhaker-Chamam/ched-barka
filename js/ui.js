/* Astro Outpost — on-screen interface: meters, goals, prompts, waypoints, mini-game gauges, pop-up cards. */
(function (JA) {
  'use strict';
  var R = JA.RULES, sim = JA.sim;
  var U = JA.ui = {};
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function show(el, on) { el.classList.toggle('hidden', !on); }
  U.$ = $; U.esc = esc; U.show = show;

  // ---------- pop-up cards (these pause the game) ----------
  var root = $('modal-root');
  U.modal = function (html, opts) {
    opts = opts || {};
    root.innerHTML = '<div class="modal ' + (opts.cls || '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    root.className = 'open';
    var acts = opts.actions || {};
    Array.prototype.forEach.call(root.querySelectorAll('[data-act]'), function (el) {
      el.addEventListener('click', function () { var fn = acts[el.getAttribute('data-act')]; if (fn) fn(el); });
    });
    var first = root.querySelector('.btn.primary') || root.querySelector('button');
    if (first && !opts.noFocus) { try { first.focus({ preventScroll: true }); } catch (e) { /* older browsers */ } }
    if (opts.speak) JA.audio.speak(opts.speak);
    return root.firstChild;
  };
  U.closeModal = function () { root.className = ''; root.innerHTML = ''; };
  U.modalOpen = function () { return root.classList.contains('open'); };
  U.fade = function (on) { $('fade').classList.toggle('on', !!on); };

  // ---------- top bar ----------
  var meters = {};
  Array.prototype.forEach.call(document.querySelectorAll('.meter'), function (m) {
    meters[m.getAttribute('data-res')] = { el: m, val: m.querySelector('.m-val'), bar: m.querySelector('.m-bar i'), note: m.querySelector('.m-note'), last: null, w: null, n: null };
  });
  function setMeter(id, value, low, note, bad) {
    var m = meters[id], v = Math.round(value);
    if (m.last !== v) {
      if (m.last !== null && Math.abs(v - m.last) >= 3) { m.el.classList.remove('bump'); void m.el.offsetWidth; m.el.classList.add('bump'); }
      m.last = v; m.val.textContent = v + (id === 'dose' ? '%' : '');
    }
    var w = Math.round(Math.max(0, Math.min(100, value)));
    if (m.w !== w) { m.w = w; m.bar.style.width = w + '%'; }
    m.el.classList.toggle('low', !!low);
    if (m.n !== note) { m.n = note; m.note.textContent = note || ''; }
    m.note.classList.toggle('bad', !!bad);
  }
  var lastSci = null, lastSol = '';
  U.setHud = function (s) {
    var L = s.level, left = Math.max(0, 1 - s.t / s.dayLength), last = s.sol >= s.totalSols;
    var solText = s.site.dayWord + ' ' + s.sol + ' of ' + s.totalSols;
    if (solText !== lastSol) { lastSol = solText; $('sol-text').textContent = solText; $('site-text').textContent = s.site.short + ' · ' + L.name; }
    var airNeed = L.airDrain * left, airBad = s.air < airNeed;
    var dinnerBad = !last && s.food < L.dinner;
    setMeter('air', s.air, s.air < 18 || airBad, airBad ? 'not enough for today!' : 'enough for today', airBad);
    setMeter('food', s.food, dinnerBad, last ? 'no dinner: launch day' : (dinnerBad ? 'dinner needs ' + L.dinner + '!' : 'dinner tonight −' + L.dinner), dinnerBad);
    setMeter('dose', s.dose, s.dose >= 75, 'home shield ' + Math.round(sim.shield(s) * 100) + '%', false);
    var sci = Math.round(s.sci);
    if (lastSci !== sci) {
      if (lastSci !== null) { var st = document.querySelector('.stars'); st.classList.remove('bump'); void st.offsetWidth; st.classList.add('bump'); }
      lastSci = sci; $('sci-val').textContent = sci;
    }
    var f = Math.min(1, s.t / s.dayLength);
    $('clock-fill').style.width = (f * 100) + '%'; $('clock-sun').style.left = (f * 100) + '%';
    var cs = $('clock-storm'), st2 = s.storm;
    if (st2 && st2.warned) { cs.classList.add('show'); cs.style.left = (st2.start / s.dayLength * 100) + '%'; cs.style.width = ((st2.end - st2.start) / s.dayLength * 100) + '%'; }
    else cs.classList.remove('show');
  };

  // ---------- goals ----------
  var goalKey = '';
  U.setGoals = function (title, list) {
    var key = title + '|' + list.map(function (g) { return g.text + (g.done ? 1 : 0) + (g.now ? 2 : 0); }).join('|');
    if (key === goalKey) return;
    goalKey = key;
    $('goals-title').textContent = title;
    $('goal-list').innerHTML = list.map(function (g) { return '<li class="' + (g.done ? 'done' : g.now ? 'now' : '') + '">' + esc(g.text) + '</li>'; }).join('');
  };

  // ---------- banner, buddy, prompt, hands ----------
  var bannerText = null;
  U.banner = function (text, cls) {
    var b = $('banner');
    if (!text) { if (bannerText !== null) { bannerText = null; b.classList.add('hidden'); } return; }
    if (bannerText === text + cls) return;
    bannerText = text + cls; b.className = cls || ''; b.textContent = text;
  };
  var lastSay = '';
  U.say = function (text, quiet) {
    if (!text || text === lastSay) return;
    lastSay = text;
    var b = $('bolt');
    b.classList.remove('hidden');
    $('bolt-text').textContent = text;
    b.classList.remove('say'); void b.offsetWidth; b.classList.add('say');
    if (!quiet) JA.audio.speak(text);
  };
  var promptKey = null;
  U.prompt = function (text, key, info) {
    var p = $('prompt'), k = text ? text + key + (info ? 1 : 0) : null;
    if (k === promptKey) return;
    promptKey = k;
    if (!text) { p.classList.add('hidden'); return; }
    p.className = info ? 'info' : '';
    $('prompt-key').textContent = key || 'E'; $('prompt-text').textContent = text;
  };
  var handsKey = null;
  U.hands = function (item, power, hint) {
    var h = $('hands');
    if (!item) { if (handsKey !== null) { handsKey = null; h.classList.add('hidden'); } return; }
    var def = JA.ITEMS[item.type], k = item.type + hint;
    if (k !== handsKey) {
      handsKey = k; h.classList.remove('hidden');
      $('hands-icon').textContent = def.icon; $('hands-name').textContent = item.data && item.data.name ? item.data.name : def.name; $('hands-hint').textContent = hint;
    }
    $('power-fill').style.width = Math.round((power || 0) * 100) + '%';
  };
  U.roverHud = function (charge, on) {
    var h = $('rover-hud');
    show(h, !!on); if (!on) return;
    $('rover-text').textContent = charge > 0 ? 'Rover battery · ' + Math.ceil(charge) + ' s' : 'Battery empty — crawling!';
    $('rover-fill').style.width = Math.round(Math.min(1, charge / R.roverMax) * 100) + '%';
  };

  // ---------- mini-games ----------
  U.drillUi = function (m) {
    var el = $('mini');
    if (!m) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    show($('mini-heat-row'), true); show($('mini-dial'), false); show($('mini-pips'), false);
    $('mini-depth').parentNode.parentNode.classList.remove('hidden');
    $('mini-title').textContent = m.title; $('mini-hint').textContent = m.hint;
    $('mini-depth').style.width = Math.round(m.depth * 100) + '%';
    $('mini-heat').style.width = Math.round(Math.min(1, m.heat) * 100) + '%';
    $('mini-heat').parentNode.classList.toggle('hot', m.heat > 0.75);
  };
  U.dialUi = function (m) {
    var el = $('mini');
    if (!m) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    show($('mini-heat-row'), false); $('mini-depth').parentNode.parentNode.classList.add('hidden');
    show($('mini-dial'), true); show($('mini-pips'), true);
    $('mini-title').textContent = m.title; $('mini-hint').textContent = m.hint;
    $('dial-zone').style.left = ((m.c - m.w / 2) * 100) + '%'; $('dial-zone').style.width = (m.w * 100) + '%';
    $('dial-needle').style.left = (m.needle * 100) + '%';
    var p = '';
    for (var i = 0; i < m.need; i++) p += '<i class="' + (i < m.hits ? 'on' : '') + '"></i>';
    if ($('mini-pips').getAttribute('data-k') !== p) { $('mini-pips').innerHTML = p; $('mini-pips').setAttribute('data-k', p); }
  };

  // ---------- discovery cards (do not pause the game) ----------
  var cardQ = [], cardTimer = null;
  function nextCard() {
    var c = $('card');
    cardTimer = null;
    if (!cardQ.length) { c.classList.add('hidden'); return; }
    var f = cardQ.shift(), src = JA.SOURCES[f.src];
    c.classList.remove('hidden'); c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
    $('card-icon').textContent = f.icon || '🧪';
    $('card-kicker').textContent = (f.kind === 'core' ? 'Discovery at ' + f.place : f.kind === 'inst' ? 'Instrument online' : 'Postcard') + ' · +' + f.pts + ' ⭐';
    $('card-title').textContent = f.title;
    $('card-text').textContent = f.text + (f.perk ? ' ' + f.perk : '');
    $('card-src').textContent = src ? 'Source: ' + src.name : '';
    JA.audio.speak(f.title + '. ' + f.text);
    cardTimer = setTimeout(nextCard, 11000);
  }
  U.card = function (find) { cardQ.push(find); if (!cardTimer) nextCard(); };
  U.clearCards = function () { cardQ = []; if (cardTimer) clearTimeout(cardTimer); cardTimer = null; $('card').classList.add('hidden'); };
  $('card').addEventListener('click', function () { if (cardTimer) clearTimeout(cardTimer); nextCard(); });

  // ---------- in-world tags and waypoint markers (re-used DOM nodes) ----------
  var tagPool = [], markPool = [];
  function pooled(pool, i, cls) {
    if (!pool[i]) { var el = document.createElement('div'); el.className = cls; $('tags').appendChild(el); pool[i] = { el: el, k: '' }; }
    return pool[i];
  }
  U.tags = function (list) {
    var i;
    for (i = 0; i < list.length; i++) {
      var t = list[i], p = pooled(tagPool, i, 'tag'), k = t.text + '|' + (t.cls || '');
      if (p.k !== k) { p.k = k; p.el.textContent = t.text; p.el.className = 'tag ' + (t.cls || ''); }
      p.el.style.display = '';
      p.el.style.transform = 'translate(-50%, -100%) translate(' + Math.round(t.x) + 'px,' + Math.round(t.y) + 'px)';
    }
    for (; i < tagPool.length; i++) tagPool[i].el.style.display = 'none';
  };
  U.marks = function (list) {
    var i;
    for (i = 0; i < list.length; i++) {
      var m = list[i], p = pooled(markPool, i, 'mark'), k = m.icon + '|' + m.label + '|' + (m.cls || '') + '|' + m.color;
      if (p.k !== k) { p.k = k; p.el.className = 'mark ' + (m.cls || ''); p.el.style.setProperty('--c', m.color || '#fff'); p.el.innerHTML = '<i>' + m.icon + '</i><span>' + esc(m.label) + '</span>'; }
      else if (m.label) p.el.lastChild.textContent = m.label;
      p.el.style.display = '';
      p.el.style.transform = 'translate(-50%, -50%) translate(' + Math.round(m.x) + 'px,' + Math.round(m.y) + 'px)';
    }
    for (; i < markPool.length; i++) markPool[i].el.style.display = 'none';
  };
  U.stormFx = function (mode) { var e = $('storm-fx'); if (e.className !== (mode || '')) e.className = mode || ''; };
  U.toast = function (text, x, y, color) {
    var t = document.createElement('div');
    t.className = 'toast'; t.textContent = text;
    t.style.left = x + 'px'; t.style.top = y + 'px'; t.style.color = color || '#fff';
    $('toasts').appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 1350);
  };

  // ---------- text helpers shared by the cards ----------
  U.dataTag = function (s) { return s.weatherSource === 'live' ? '<span class="tagline">Live NASA data</span>' : '<span class="tagline archive">NASA archive</span>'; };
  U.stormWords = function (level) { return level >= 3 ? 'A BIG solar storm' : level === 2 ? 'A medium solar storm' : 'A small solar storm'; };
  U.weatherRow = function (s, w, known, when) {
    var date = w && w.date ? JA.weather.prettyDate(w.date) : '';
    if (!known) {
      return '<div class="info-row"><span class="ic">❓</span><div><b>No space-weather forecast</b>' +
        '<p>The Radio Dish was off, so Earth could not send a forecast. BOLT\'s small sensor only gives a few seconds of warning.</p></div></div>';
    }
    if (!w || w.level === 0) {
      var what = w && w.cls ? 'only small flares (the strongest was class ' + esc(w.cls) + ')' : 'no solar flares at all';
      return '<div class="info-row good"><span class="ic">😎</span><div><b>Quiet Sun ' + when + '</b>' +
        '<p>' + U.dataTag(s) + 'On ' + date + ' NASA recorded ' + what + '. No radiation storm.</p></div></div>';
    }
    return '<div class="info-row alert"><span class="ic">🌩️</span><div><b>' + U.stormWords(w.level) + ' ' + when + '!</b>' +
      '<p>' + U.dataTag(s) + 'On ' + date + ' the real Sun fired a class <b>' + esc(w.cls) + '</b> flare' + (w.time ? ' at ' + w.time + ' UTC' : '') +
      '. Soil bags on the dome help — and do not get caught far from home!</p></div></div>';
  };
  U.findRow = function (f) {
    return '<div class="find"><em>' + (f.icon || '🧪') + '</em><div><b>' + esc(f.title) + '</b><span>' + esc(f.text) + '</span></div><i>+' + f.pts + ' ⭐</i></div>';
  };
})(window.JA);
