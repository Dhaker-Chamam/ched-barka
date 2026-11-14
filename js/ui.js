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
  // Tab stays inside the open card instead of wandering to the buttons behind it
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var info = $('info-root'), box = info && info.classList.contains('open') ? info : U.modalOpen() ? root : null;
    if (!box) return;
    var f = box.querySelectorAll('button:not([disabled]), a[href], input, select, textarea, [tabindex="0"]'), a = document.activeElement;
    if (!f.length) { e.preventDefault(); return; }
    var first = f[0], last = f[f.length - 1], inside = box.contains(a);
    if (e.shiftKey && (!inside || a === first)) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && (!inside || a === last)) { first.focus(); e.preventDefault(); }
  });
  U.modalOpen = function () { return root.classList.contains('open'); };
  U.fade = function (on) { $('fade').classList.toggle('on', !!on); };

  // ---------- top bar ----------
  // Everything here runs every frame, so each part remembers what it shows and only
  // touches the page when that changes.
  // A one-shot CSS animation is restarted by swapping between two copies of it (pop-a / pop-b),
  // which does not force the browser to lay the page out again.
  function pop(o, el) { o.flip = !o.flip; el.classList.toggle('pop-a', o.flip); el.classList.toggle('pop-b', !o.flip); }
  var meters = {};
  Array.prototype.forEach.call(document.querySelectorAll('.meter'), function (m) {
    meters[m.getAttribute('data-res')] = { el: m, val: m.querySelector('.m-val'), bar: m.querySelector('.m-bar i'), note: m.querySelector('.m-note'),
      last: null, w: null, n: null, low: null, bad: null, dir: '', flip: false };
  });
  function setMeter(id, value, low, note, bad) {
    var m = meters[id], v = Math.round(value);
    if (m.last !== v) {
      if (m.last !== null && Math.abs(v - m.last) >= 3) {
        // the number pops green when things get better, pink when worse (more radiation is worse)
        var dir = (id === 'dose' ? v < m.last : v > m.last) ? 'good' : 'bad';
        if (m.dir !== dir) { m.dir = dir; m.el.setAttribute('data-dir', dir); }
        pop(m, m.el);
      }
      m.last = v; m.val.textContent = v + (id === 'dose' ? '%' : '');
    }
    var w = Math.round(Math.max(0, Math.min(100, value)));
    if (m.w !== w) { m.w = w; m.bar.style.width = w + '%'; }
    low = !!low; bad = !!bad;
    if (m.low !== low) { m.low = low; m.el.classList.toggle('low', low); }
    if (m.n !== note) { m.n = note; m.note.textContent = note || ''; }
    if (m.bad !== bad) { m.bad = bad; m.note.classList.toggle('bad', bad); }
  }
  var hud = { sol: $('sol-text'), site: $('site-text'), fill: $('clock-fill'), sun: $('clock-sun'), storm: $('clock-storm'), left: $('time-left'), sci: $('sci-val') };
  var stars = document.querySelector('#hud .stars'), plus = stars.querySelector('.sci-plus'), starPop = { flip: false }, plusPop = { flip: false };
  var lastSol = '', lastTime = '', lastF = -1, lastStorm = '', stormNow = false;
  // mission points count up to the new score instead of jumping
  var sciTo = null, sciShown = 0, sciFrom = 0, sciT0 = 0;
  function clock() { return window.performance && performance.now ? performance.now() : Date.now(); }
  U.setHud = function (s) {
    var L = s.level, left = Math.max(0, 1 - s.t / s.dayLength), last = s.sol >= s.totalSols;
    var solText = s.site.dayWord + ' ' + s.sol + ' of ' + s.totalSols;
    if (solText !== lastSol) {
      lastSol = solText;
      hud.sol.innerHTML = '<small>' + esc(s.site.dayWord) + '</small> <span class="n">' + s.sol + '</span> <span class="of">of ' + s.totalSols + '</span>';
      hud.site.textContent = s.site.short + ' · ' + L.name;
    }
    var airNeed = (sim.airDrain(s) * s.stale + s.leak) * left, airBad = s.air < airNeed, dinner = sim.dinner(s);
    var dinnerBad = !last && s.food < dinner;
    var airNote = s.leak > 0 ? 'leaking!' : s.stale > 1 ? 'stale air: draining fast' : airBad ? 'not enough for today!' : 'enough for today';
    setMeter('air', s.air, s.air < 18 || airBad || s.leak > 0, airNote, airBad || s.leak > 0 || s.stale > 1);
    setMeter('food', s.food, dinnerBad, last ? 'no dinner: launch day' : (dinnerBad ? 'dinner needs ' + dinner + '!' : 'dinner tonight −' + dinner), dinnerBad);
    var secs = Math.max(0, Math.ceil(s.dayLength - s.t)), tl = Math.floor(secs / 60) + ':' + ('0' + (secs % 60)).slice(-2) + ' left';
    if (tl !== lastTime) { lastTime = tl; hud.left.textContent = tl; hud.left.classList.toggle('low', left < 0.15); }
    setMeter('dose', s.dose, s.dose >= 75, 'home shield ' + Math.round(sim.shield(s) * 100) + '%', false);
    // points: count up, pop the gold pill and float a "+5" under it
    var sci = Math.round(s.sci), t = clock();
    if (sci !== sciTo) {
      if (sciTo !== null && sci > sciTo) {
        sciFrom = sciShown; sciT0 = t;
        plus.textContent = '+' + (sci - sciTo); pop(plusPop, plus); pop(starPop, stars);
      } else { sciShown = sciFrom = sci; hud.sci.textContent = sci; }
      sciTo = sci;
    }
    if (sciShown !== sciTo) {
      var k = Math.min(1, (t - sciT0) / 700), shown;
      k = 1 - (1 - k) * (1 - k) * (1 - k);
      shown = Math.round(sciFrom + (sciTo - sciFrom) * k);
      if (shown !== sciShown) { sciShown = shown; hud.sci.textContent = shown; }
    }
    // the shift bar moves in steps of 0.1%, so it is written a few times a second, not every frame
    var f = Math.round(Math.min(1, s.t / s.dayLength) * 1000) / 10;
    if (f !== lastF) { lastF = f; hud.fill.style.width = f + '%'; hud.sun.style.left = f + '%'; }
    var st = s.storm, sk = st && st.warned ? (st.start / s.dayLength * 100).toFixed(2) + '|' + ((st.end - st.start) / s.dayLength * 100).toFixed(2) : '';
    if (sk !== lastStorm) {
      lastStorm = sk;
      hud.storm.classList.toggle('show', !!sk);
      if (sk) { hud.storm.style.left = sk.split('|')[0] + '%'; hud.storm.style.width = sk.split('|')[1] + '%'; }
    }
    var inStorm = !!sk && s.t >= st.start && s.t < st.end;
    if (inStorm !== stormNow) { stormNow = inStorm; hud.storm.classList.toggle('now', inStorm); }
  };

  // ---------- goals ----------
  // Must-do jobs first, then the bonus jobs (optional: the ⭐ challenge, shield, science...).
  // Rows are kept and updated in place (found again by their emoji), so when a job gets done
  // its tick can animate instead of the whole list being redrawn.
  var goalKey = '', goalTitle = null, goalRows = {}, goalBox = $('goals'), goalUl = $('goal-list');
  var goalCount = goalBox.querySelector('.g-count'), goalProg = goalBox.querySelector('.g-prog i'), goalSep = document.createElement('li');
  goalSep.className = 'g-sep'; goalSep.textContent = 'Bonus jobs';
  function goalRow() {
    var li = document.createElement('li');
    li.innerHTML = '<span class="g-ic"></span><span class="g-tx"><span></span></span><em class="g-now">Now</em>';
    return { el: li, ic: li.firstChild, tx: li.childNodes[1].firstChild, cls: null, icon: null, text: null };
  }
  U.setGoals = function (title, list) {
    var key = title + '|' + list.map(function (g) { return g.icon + g.text + (g.done ? 1 : 0) + (g.now ? 2 : 0) + (g.optional ? 4 : 0); }).join('|');
    if (key === goalKey) return;
    goalKey = key;
    if (title !== goalTitle) { goalTitle = title; $('goals-title').textContent = title; }
    var must = list.filter(function (g) { return !g.optional; }), extra = list.filter(function (g) { return g.optional; });
    var done = must.filter(function (g) { return g.done; }).length, seen = {}, rows = [], i;
    goalCount.textContent = done + '/' + must.length;
    goalProg.style.width = (must.length ? Math.round(done / must.length * 100) : 0) + '%';
    goalBox.classList.toggle('empty', !list.some(function (g) { return g.now; }));
    must.concat(extra).forEach(function (g) {
      if (g === extra[0] && must.length) rows.push(goalSep);
      var id = g.icon || '•', n = 1;
      while (seen[id + n]) n++;
      id += n; seen[id] = true;
      var r = goalRows[id] || (goalRows[id] = goalRow());
      var cls = 'goal' + (g.optional ? ' g-opt' : '') + (g.done ? ' done' : g.now ? ' now' : '');
      if (r.cls !== cls) { r.cls = cls; r.el.className = cls; }
      if (r.icon !== g.icon) { r.icon = g.icon; r.ic.textContent = g.icon || '•'; }
      if (r.text !== g.text) { r.text = g.text; r.tx.textContent = g.text; }
      rows.push(r.el);
    });
    // put the rows in order, moving only the ones that are out of place
    for (i = 0; i < rows.length; i++) if (goalUl.children[i] !== rows[i]) goalUl.insertBefore(rows[i], goalUl.children[i] || null);
    while (goalUl.children.length > rows.length) goalUl.removeChild(goalUl.lastChild);
    Object.keys(goalRows).forEach(function (id) { if (!seen[id]) delete goalRows[id]; });
  };

  // ---------- banner, buddy, prompt, hands ----------
  var bannerText = null;
  U.banner = function (text, cls) {
    var b = $('banner');
    if (!text) { if (bannerText !== null) { bannerText = null; b.classList.add('hidden'); document.body.classList.remove('has-banner'); } return; }
    if (bannerText === text + cls) return;
    document.body.classList.add('has-banner');
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
  // The card's time on screen is counted in game time (see tickCards), so a card is never
  // used up behind a pause, a crisis or a hidden tab.
  var cardQ = [], cardOn = false, cardLeft = 0;
  function nextCard() {
    var c = $('card');
    cardOn = false; cardLeft = 0;
    if (!cardQ.length) { c.classList.add('hidden'); return; }
    var f = cardQ.shift(), src = JA.SOURCES[f.src];
    c.classList.remove('hidden'); c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
    c.className = f.kind === 'conseq' ? 'conseq ' + (f.tone || 'mixed') : '';
    $('card-icon').textContent = f.icon || '🧪';
    $('card-kicker').textContent = f.kind === 'conseq' ? 'What your choice led to'
      : (f.kind === 'core' ? 'Discovery at ' + f.place : f.kind === 'inst' ? 'Instrument online' : f.kind === 'meteor' ? 'A rock from space' : 'Postcard') + ' · +' + f.pts + ' ⭐';
    $('card-title').textContent = f.title;
    $('card-text').textContent = f.text + (f.perk ? ' ' + f.perk : '');
    $('card-src').textContent = src ? 'Source: ' + src.name : f.kind === 'conseq' ? 'Tap to close' : '';
    JA.audio.speak(f.kind === 'conseq' ? f.text : f.title + '. ' + f.text);
    cardOn = true; cardLeft = f.kind === 'conseq' ? 14 : 11;
  }
  U.card = function (find) { cardQ.push(find); if (!cardOn) nextCard(); };
  U.clearCards = function () { cardQ = []; cardOn = false; cardLeft = 0; $('card').classList.add('hidden'); };
  U.tickCards = function (dt) { if (cardOn && (cardLeft -= dt) <= 0) nextCard(); };
  $('card').addEventListener('click', nextCard);

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
  // floating "+12 💨" pills over the world; --c tints the pill's ring and glow
  U.toast = function (text, x, y, color) {
    var t = document.createElement('div');
    t.className = 'toast'; t.textContent = text;
    t.style.left = x + 'px'; t.style.top = y + 'px'; t.style.color = color || '#fff'; t.style.setProperty('--c', color || '#fff');
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
      '<p>' + U.dataTag(s) + 'On ' + date + ' the real Sun fired a class <b>' + esc(w.cls) + '</b> flare' + (w.time ? ' at ' + esc(w.time) + ' UTC' : '') +
      '. Soil bags on the dome help — and do not get caught far from home!</p></div></div>';
  };
  U.findRow = function (f) {
    return '<div class="find"><em>' + (f.icon || '🧪') + '</em><div><b>' + esc(f.title) + '</b><span>' + esc(f.text) + '</span></div><i>+' + f.pts + ' ⭐</i></div>';
  };
})(window.JA);
