/* Astro Outpost — the game itself: controls, what the E key does, throwing, mini-games,
   storms, days and nights, and the rocket ride home. */
(function (JA) {
  'use strict';
  var sim = JA.sim, W = JA.world, B = JA.base, A = JA.actors, U = JA.ui, Au = JA.audio, R = JA.RULES, Tn = JA.terrain, T = window.THREE;
  var $ = U.$, esc = U.esc;

  var G = JA.game = {
    opts: { site: 'mars', level: 'cadet', sun: 'live', suit: 0xff7a3d },
    s: null, weather: null, mode: 'title',
    input: { x: 0, z: 0, jump: false, sprint: false }, keys: {}, stick: { x: 0, z: 0 },
    ePressed: false, eHeld: false, fHeld: false, charge: null, mini: null, fast: false, lookIdle: 9, zoom: 11,
    action: null, zones: [], tips: {}, tut: {}, tutStep: 0, dt: 0, clock: 0, sayAt: 0, hintAt: 0, goalAt: 0, goal: null,
    lastWarn: -1, geiger: 0, ending: null, launchT: 0, bannerUntil: 0, caseItem: null
  };
  var SUITS = [0xff7a3d, 0x3d9bff, 0x4cd97b, 0xff5fa8, 0xb07cff];
  var touch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);
  var v1 = T ? new T.Vector3() : null, v2 = T ? new T.Vector3() : null, v3 = T ? new T.Vector3() : null;

  function fatal(msg) { var f = $('fatal'); f.textContent = msg; f.classList.remove('hidden'); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function d2(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
  function dayWord() { return G.s.site.dayWord; }
  function dustFor(kind) { return { clear: 0, dusty: 0.4, storm: 1, sun: 0, lowsun: 0.3, shadow: 0.8 }[kind] || 0; }
  function say(text, force) {
    if (!text) return;
    if (!force && G.clock < G.sayAt) return;
    G.sayAt = G.clock + 3.5; U.say(text);
  }
  function tip(id, text) { if (G.tips[id]) return false; G.tips[id] = 1; say(text, true); return true; }
  function toastAt(pos, text, color) { var p = W.project(pos); if (!p.hidden) U.toast(text, clamp(p.x, 60, W.w - 60), clamp(p.y, 120, W.h - 120), color); }
  function me() { return A.rover.driver ? A.rover.pos : A.astro.pos; }

  // ---------- info overlay (opens on top of anything) ----------
  var infoRoot = document.createElement('div');
  infoRoot.id = 'info-root';
  document.body.appendChild(infoRoot);
  function infoOpen() { return infoRoot.classList.contains('open'); }
  function openInfo(html) {
    infoRoot.innerHTML = '<div class="modal wide" role="dialog" aria-modal="true">' + html + '<div class="modal-actions"><button class="btn primary" id="info-close">Got it</button></div></div>';
    infoRoot.className = 'open';
    $('info-close').addEventListener('click', closeInfo);
    $('info-close').focus();
  }
  function closeInfo() { infoRoot.className = ''; infoRoot.innerHTML = ''; Au.play('tap'); }

  // ---------- best scores (saved only in this browser) ----------
  function bestKey() { return G.opts.site + '-' + G.opts.level + '-' + G.opts.sun; }
  function loadBest() { try { return JSON.parse(localStorage.getItem('ja-best2') || '{}'); } catch (e) { return {}; } }
  function saveBest(score) {
    var b = loadBest(), k = bestKey(), isNew = !(b[k] >= score);
    if (isNew) { b[k] = score; try { localStorage.setItem('ja-best2', JSON.stringify(b)); } catch (e) { /* ignore */ } }
    return isNew;
  }
  function showBest() { var b = loadBest(), top = 0; for (var k in b) top = Math.max(top, b[k]); $('best').textContent = top ? 'Your best mission: ⭐ ' + top : ''; }

  // =====================================================================
  //  TITLE + SETUP
  // =====================================================================
  function hideHud() {
    ['hud', 'goals', 'banner', 'bolt', 'prompt', 'hands', 'rover-hud', 'mini', 'inside', 'stick', 'touch-btns'].forEach(function (id) { U.show($(id), false); });
    U.tags([]); U.marks([]); U.stormFx(''); U.clearCards();
  }
  function titleScene() {
    G.mode = 'title'; G.s = null;
    if (A.astro) A.astro.mode = 'hidden';
    W.cam.mode = 'title'; W.env.t = 0.3; W.env.dust = 0; W.env.storm = 0;
    hideHud(); U.show($('title'), true); U.fade(false);
    Au.stopAll(); showBest();
  }

  function setupModal() {
    var o = G.opts;
    function card(g, v, emoji, title, text) {
      return '<button class="pick' + (String(o[g]) === String(v) ? ' sel' : '') + '" data-act="pick" data-g="' + g + '" data-v="' + v + '" aria-pressed="' + (String(o[g]) === String(v)) + '">' +
        '<em>' + emoji + '</em><b>' + title + '</b><span>' + text + '</span></button>';
    }
    var html = '<h2>Plan your mission</h2><p class="sub">Three quick choices, Commander.</p>' +
      '<h3>1 · Where will you build your outpost?</h3><div class="cards">' +
      card('site', 'moon', '🌙', 'The Moon', esc(JA.SITES.moon.blurb)) + card('site', 'mars', '🔴', 'Mars', esc(JA.SITES.mars.blurb)) + '</div>' +
      '<h3>2 · How long is the mission?</h3><div class="cards">' +
      card('level', 'cadet', '🎒', 'Cadet · 3 days', 'Ages 7–9. ' + esc(JA.LEVELS.cadet.blurb)) +
      card('level', 'commander', '🧑‍🚀', 'Commander · 5 days', 'Ages 10–12. ' + esc(JA.LEVELS.commander.blurb)) + '</div>' +
      '<h3>3 · Which Sun do you want to face?</h3><div class="cards">' +
      card('sun', 'live', '☀️', 'The real Sun, right now', 'Solar flares from the last 30 days, fetched live from NASA.') +
      card('sun', 'archive', '🌩️', 'The great storms of May 2024', 'A famous stormy month from NASA\'s records. Much harder!') + '</div>' +
      '<h3>Your spacesuit colour</h3><div class="swatches">' +
      SUITS.map(function (c) { return '<button class="swatch' + (o.suit === c ? ' sel' : '') + '" style="--c:#' + ('00000' + c.toString(16)).slice(-6) + '" data-act="suit" data-v="' + c + '" aria-label="Suit colour"></button>'; }).join('') +
      '</div><div class="modal-actions"><button class="btn ghost" data-act="back">Back</button><button class="btn primary" data-act="go">Launch 🚀</button></div>';
    var keep = document.querySelector('#modal-root .modal'), scroll = keep ? keep.scrollTop : 0;
    var m = U.modal(html, { cls: 'wide', noFocus: !!keep, actions: {
      pick: function (el) { o[el.getAttribute('data-g')] = el.getAttribute('data-v'); Au.play('tap'); setupModal(); },
      suit: function (el) { o.suit = parseInt(el.getAttribute('data-v'), 10); Au.play('tap'); setupModal(); },
      back: function () { Au.play('tap'); U.closeModal(); titleScene(); },
      go: launch
    } });
    m.scrollTop = scroll; m.style.animation = keep ? 'none' : '';
  }

  function launch() {
    Au.play('swish');
    U.modal('<div class="loading"><div class="spinner"></div><h2>Calling NASA…</h2><p class="sub">' +
      (G.opts.sun === 'live' ? 'Fetching the last 30 days of real solar flares.' : 'Opening the May 2024 storm records.') + '</p></div>');
    var t0 = Date.now();
    JA.weather.load(G.opts.sun).then(function (data) { setTimeout(function () { startMission(data); }, Math.max(0, 700 - (Date.now() - t0))); });
  }

  function startMission(data) {
    G.weather = data;
    W.build(G.opts.site, G.opts.suit);
    var s = G.s = sim.newGame({ site: G.opts.site, level: G.opts.level, weather: data });
    G.tips = {}; G.tut = {}; G.tutStep = 0; G.mini = null; G.charge = null; G.ending = null; G.caseItem = null; G.fast = false; G.clock = 0; G.sayAt = 0;
    buildZones(); buildAim();
    JA.INSTRUMENTS[s.site.id].forEach(function (def, i) { A.spawn('inst', B.spots.pallet[i], { id: def.id, name: def.name }, 'fixed'); });
    A.roverCharge = function () { return G.s ? G.s.m.rover.charge : 1; };
    U.show($('title'), false);
    G.mode = 'brief'; W.cam.mode = 'title'; W.env.t = 0.1; W.env.dust = dustFor(sim.env(s).kind);
    var d1 = JA.weather.prettyDate(s.weather[0].date), dN = JA.weather.prettyDate(s.weather[s.weather.length - 1].date), wx;
    if (s.weatherFallback) wx = '<div class="info-row"><span class="ic">📼</span><div><b>Using saved NASA records</b><p><span class="tagline archive">NASA archive</span>We could not reach NASA just now, so the solar storms replay the real Sun from ' + d1 + ' to ' + dN + ' instead. This is not live data.</p></div></div>';
    else wx = '<div class="info-row"><span class="ic">🛰️</span><div><b>The real Sun is in this game</b><p>' + U.dataTag(s) + 'Solar storms replay the real Sun from ' + d1 + ' to ' + dN + (s.weatherSource === 'live' ? ', fetched just now from NASA\'s space-weather database.' : ' — one of the stormiest times in 20 years.') + '</p></div></div>';
    var n = s.totalSols, dw = dayWord().toLowerCase() + 's';
    U.modal('<h2>Welcome to ' + esc(s.site.name) + ', Commander!</h2>' +
      '<p class="sub">' + esc(s.site.place) + ' · I am BOLT, your robot buddy.</p>' +
      '<div class="info-row"><span class="ic">🎯</span><div><b>Your mission</b><p>Keep the crew alive for ' + n + ' ' + dw + (s.site.id === 'mars' ? ' (a sol is one Mars day)' : '') + ', do real science, then ride the rocket home. ' + esc(s.site.why) + '</p></div></div>' +
      '<div class="info-row"><span class="ic">🔋</span><div><b>You do everything by hand</b><p>The Sun charges only a few power cells a day. YOU carry each one to the machine that needs it most — air, food, shield, science or radio. There is never enough for all of them.</p></div></div>' +
      wx +
      '<div class="info-row"><span class="ic">📡</span><div><b>Talking to Earth</b><p>' + esc(s.site.commText) + '</p></div></div>' +
      '<div class="modal-actions"><button class="btn ghost" data-act="how">How to play</button><button class="btn primary" data-act="ok">Step outside ▶</button></div>',
      { speak: 'Welcome to ' + s.site.name + ', Commander! I am BOLT, your robot buddy. Keep the crew alive for ' + n + ' ' + dw + ', do real science, then ride the rocket home.',
        actions: { how: howInfo, ok: function () { Au.play('door'); U.closeModal(); beginSol(); } } });
  }

  // =====================================================================
  //  MORNING
  // =====================================================================
  function syncRack() {
    var s = G.s, have = A.items.filter(function (it) { return it.tag === 'rack'; }), i;
    while (have.length > s.rack.cells) A.remove(have.pop());
    for (i = have.length; i < s.rack.cells; i++) {
      var used = A.items.filter(function (it) { return it.tag === 'rack'; }).map(function (it) { return it.slot2; });
      var slot = 0; while (used.indexOf(slot) >= 0) slot++;
      var it = A.spawn('cell', B.spots.rackSlots[slot % R.rackMax], null, 'fixed');
      it.tag = 'rack'; it.slot2 = slot;
      W.burst(it.pos.x, it.pos.y, it.pos.z, 8, 2, 0xffe36a, { life: 0.5, size: 0.25, grav: 0 });
    }
  }

  function beginSol() {
    var s = G.s, env = sim.env(s), look = s.site.env[env.kind], w = sim.weather(s), last = s.sol >= s.totalSols;
    if (A.rover.driver) A.exitRover();
    A.resetAstro();
    G.mode = 'play'; G.mini = null; G.charge = null; G.fast = false; A.astro.aim = false;
    W.cam.mode = 'play'; W.cam.focus = A.focus; W.cam.yaw = 0.45; W.cam.pitch = 0.36; G.zoom = 11;
    W.env.dust = dustFor(env.kind); W.env.storm = 0; W.env.t = 0.06;
    G.lastWarn = -1; G.hintAt = G.clock + 14;
    syncRack();
    if (last && !G.caseItem) { G.caseItem = A.spawn('case', B.spots.caseSpawn, { name: 'sample case' }, 'rest'); }
    U.show($('hud'), true); U.show($('goals'), true); U.show($('inside'), false); U.fade(false);
    if (touch) { document.body.classList.add('touch'); U.show($('stick'), true); U.show($('touch-btns'), true); }
    U.banner(dayWord() + ' ' + s.sol + ' · ' + look.icon + ' ' + look.label + ' · about ' + Math.round(s.cellsToday) + ' power cells today', 'info');
    G.bannerUntil = G.clock + 7;
    var line;
    if (s.sol === 1) line = touch ? 'Welcome outside! Use the stick to walk and drag the screen to look around.' : 'Welcome outside! Walk with W A S D, drag the mouse to look around, and press Space to jump.';
    else line = look.label + ' today. ' + (s.forecast ? (w.level ? U.stormWords(w.level) + ' is coming today. Stay ready to run home!' : 'The Sun is quiet today.') : 'The dish was off, so there is no storm forecast. Keep an eye on me!') + (last ? ' Last day: load the sample case and board the rocket!' : '');
    say(line, true);
  }

  // =====================================================================
  //  CAPTURE ZONES: where carried or thrown things can go
  // =====================================================================
  function buildZones() {
    var sp = B.spots, Z = G.zones = [];
    function zone(o) { Z.push(o); }
    ['air', 'food', 'bag', 'lab', 'comms'].forEach(function (id) {
      zone({ id: 'sock-' + id, pos: sp.sockets[id], r: 1.5, type: 'cell', name: JA.MACHINES[id].name, fn: function () { return plugCell(id, sp.sockets[id]); } });
    });
    zone({ id: 'sock-rover', dyn: function (o) { return A.roverSpot('socket', o); }, r: 1.3, type: 'cell', name: 'rover', fn: function () { return plugCell('rover', A.roverSpot('socket', v3)); } });
    zone({ id: 'hop-air', pos: sp.hoppers.air, r: 1.9, type: 'ice', name: 'Air Maker', fn: function () { var r = sim.feedIce(G.s, 'air'); if (r.ok) { G.tut.ice = true; Au.play('ice'); } return r; } });
    zone({ id: 'hop-water', pos: sp.hoppers.water, r: 1.7, type: 'ice', name: 'water tank', fn: function () { var r = sim.feedIce(G.s, 'food'); if (r.ok) Au.play('ice'); return r; } });
    zone({ id: 'hop-lab', pos: sp.hoppers.lab, r: 1.7, type: 'core', name: 'Lab', fn: function (it) { var r = sim.submitCore(G.s, it.data); if (r.ok) { Au.play('score'); if (G.s.m.lab.power === 0) say('Core loaded! The Lab needs a power cell to study it.', true); } return r; } });
    zone({ id: 'pantry', pos: sp.hoppers.pantry, r: 1.9, type: 'crate', name: 'food hatch', fn: function () { var r = sim.storeCrate(G.s); Au.play('score'); toastAt(sp.hoppers.pantry, '+' + R.foodPerCrate + ' 🥬', '#7be36a'); return r; } });
    zone({ id: 'dome', pos: sp.hoppers.dome, r: 7.4, flat: true, top: 9, type: 'bag', name: 'dome', fn: function () {
      var r = sim.addBag(G.s);
      if (r.ok) { Au.play('thud'); toastAt(sp.hoppers.dome, '🛡️ ' + Math.round(sim.shield(G.s) * 100) + '%', '#c9a6ff'); if (G.s.bags === R.shieldSlots) say('The dome is fully covered. Maximum shielding!', true); }
      return r;
    } });
    zone({ id: 'cargo', pos: sp.hoppers.cargo, r: 2.1, type: 'case', name: 'rocket', fn: function () { G.s.caseLoaded = true; Au.play('swish'); say('Samples loaded! Scientists on Earth will study them for years.', true); return { ok: true }; } });
    Object.keys(sp.inst).forEach(function (id) {
      zone({ id: 'inst-' + id, pos: sp.inst[id], r: 2.8, flat: true, top: 5, type: 'inst', name: 'marked spot', match: function (it) { return it.data.id === id; }, fn: function () {
        var f = sim.deploy(G.s, id); if (!f) return { ok: false, msg: '' };
        Au.play('discovery'); U.card(f); W.burst(sp.inst[id].x, sp.inst[id].y + 0.5, sp.inst[id].z, 24, 4, 0x5cf0ff, { life: 0.9, size: 0.3, grav: 0 });
        return { ok: true };
      } });
    });
    zone({ id: 'bed', dyn: function (o) { return A.roverSpot('bed', o); }, r: 1.5, type: '*', name: 'rover', keep: true, fn: function (it) {
      if (!A.toBed(it)) return { ok: false, msg: 'The rover bed is full. It holds four things.' };
      Au.play('drop'); return { ok: true };
    } });
  }
  function zonePos(z, out) { return z.dyn ? z.dyn(out) : out.copy(z.pos); }
  function zoneTakes(z, it) { return (z.type === '*' || z.type === it.type) && (!z.match || z.match(it)); }
  function plugCell(id, pos) {
    var r = sim.plug(G.s, id);
    if (r.ok) {
      Au.play('plug'); W.burst(pos.x, pos.y, pos.z, 16, 3, 0xffe36a, { life: 0.6, size: 0.26, grav: 0 });
      if (id === 'air') G.tut.airCell = true;
      if (id === 'comms') tip('comms', 'Radio Dish on! Earth will warn us early about solar storms, and can help with repairs today.');
      if (id === 'bag') tip('bagger', 'The Soil Bagger is filling bags. Grab them and throw them onto the dome!');
      if (id === 'rover') tip('roverCell', 'Rover charged! Walk to its side and press E to drive.');
    }
    return r;
  }
  function capture(it, z) {
    var from = it.from, res = z.fn(it);
    if (!res.ok) return res;
    zonePos(z, v1);
    if (from && z.id !== 'bed') {
      var dist = Math.hypot(from.x - v1.x, from.z - v1.z);
      if (dist > 7) { sim.trick(G.s, dist); Au.play('swish'); toastAt(v1, '🎯 ' + Math.round(dist) + ' m shot! +' + R.trickPts + ' ⭐', '#ffd23f'); tip('trick', 'What a throw! In low gravity things fly much farther than on Earth.'); }
    }
    if (!z.keep) { W.burst(it.pos.x, it.pos.y, it.pos.z, 10, 2.5, 0xffffff, { life: 0.5, size: 0.22, grav: 0 }); if (G.caseItem === it) G.caseItem = null; A.remove(it); }
    return res;
  }
  function checkZones() {
    for (var i = A.items.length - 1; i >= 0; i--) {
      var it = A.items[i];
      if (it.state !== 'fly' && it.state !== 'rest') continue;
      if (it.hold && G.clock < it.hold) continue;
      var msg = null;
      for (var k = 0; k < G.zones.length; k++) {
        var z = G.zones[k];
        if (!zoneTakes(z, it)) continue;
        zonePos(z, v1);
        var inside = z.flat ? (Math.hypot(it.pos.x - v1.x, it.pos.z - v1.z) < z.r && it.pos.y < v1.y + z.top) : it.pos.distanceTo(v1) < z.r;
        if (!inside) continue;
        var res = capture(it, z);
        if (res.ok) { msg = null; break; }
        if (!msg) msg = res.msg;
      }
      if (msg !== null && A.items[i] === it) { it.hold = G.clock + 3; if (msg) { say(msg, true); Au.play('deny'); } if (it.state === 'fly') { it.vel.x *= -0.4; it.vel.z *= -0.4; it.vel.y = 2; } }
    }
  }

  // =====================================================================
  //  WHAT "E" DOES RIGHT NOW
  // =====================================================================
  function findAction() {
    var s = G.s, a = A.astro, p = a.pos, sp = B.spots, best = null, i, d;
    function offer(dist, reach, o) { if (dist < reach && (!best || dist < best.d)) { o.d = dist; best = o; } }
    if (A.rover.driver) return { label: 'Get out of the rover', run: function () { A.exitRover(); Au.stopLoop('rover'); Au.play('drop'); } };
    var c = a.carrying;
    if (c) {
      for (i = 0; i < G.zones.length; i++) {
        var z = G.zones[i]; if (!zoneTakes(z, c)) continue;
        zonePos(z, v1);
        (function (z) {
          offer(z.id === 'bed' ? d2(p, A.rover.pos) - 1.6 : d2(p, v1) - (z.flat ? z.r - 1 : 0), z.flat ? 2.6 : 3.6, { label: (z.type === 'cell' ? 'Plug into the ' : z.id === 'bed' ? 'Load into the ' : z.type === 'inst' ? 'Set up here' : z.id === 'dome' ? 'Put on the ' : 'Put in the ') + (z.type === 'inst' ? '' : z.name), run: function () {
            var res = capture(c, z);
            if (!res.ok) { if (res.msg) say(res.msg, true); Au.play('deny'); }
          } });
        })(z);
      }
      return best || { label: 'Put down', run: function () { A.setDown(); Au.play('drop'); } };
    }
    for (i = 0; i < A.items.length; i++) {
      var it = A.items[i]; if (it.state === 'held') continue;
      (function (it) { offer(d2(p, it.pos), 3.3, { label: 'Pick up the ' + (it.data && it.data.name ? it.data.name : JA.ITEMS[it.type].name), run: function () { pickUp(it); } }); })(it);
    }
    for (i = 0; i < sp.ice.length; i++) (function (i) { offer(d2(p, sp.ice[i]) - 0.9, 2.4, { label: 'Mine ice (hold)', hold: true, run: function () { startDrill('ice', i); } }); })(i);
    for (i = 0; i < sp.drill.length; i++) (function (i) {
      if (sim.coresLeft(s, i) > 0) offer(d2(p, sp.drill[i]) - 0.6, 2.4, { label: 'Drill a rock core (hold)', hold: true, run: function () { startDrill('geo', i); } });
    })(i);
    for (i = 0; i < sp.beds.length; i++) (function (i) {
      var bed = s.m.food.beds[i]; d = d2(p, sp.beds[i]);
      if (bed.state === 'empty') offer(d, 2.3, { label: 'Plant seeds', run: function () { sim.plant(s, i); Au.play('pop'); W.dust(sp.beds[i].x, sp.beds[i].z - 1.7, 4, 1, 0.3); checkGrow(); } });
      else if (bed.state === 'ripe') offer(d, 2.3, { label: 'Pick the veggies', run: function () { if (sim.harvest(s, i)) { var cr = A.spawn('crate', A.handPos(v1), { name: 'veggie crate' }, 'rest'); A.pick(cr); Au.play('grab'); tip('crate', 'Fresh veggies! Carry the crate to the green food hatch on the dome — or throw it in.'); } } });
      else offer(d, 2.0, { label: 'Growing… ' + Math.round(bed.g * 100) + '%' + (s.m.food.lamp <= 0 ? ' · needs light' : s.m.food.water <= 0 ? ' · needs water' : '') });
    })(i);
    for (i = 0; i < sp.panels.length; i++) (function (i) {
      if (s.rack.eff[i] < 0.86) offer(d2(p, sp.panels[i]), 2.8, { label: s.site.id === 'mars' ? 'Brush the dust off' : 'Turn the panel to the Sun', run: function () { sim.servicePanel(s, i); Au.play('pop'); W.dust(sp.panels[i].x, sp.panels[i].z - 1.4, 10, 2.5, 0.5); toastAt(sp.panels[i], '☀️ 100%', '#ffd23f'); } });
    })(i);
    var g = s.glitch;
    if (g && (g.state === 'broken' || g.state === 'asked' || g.state === 'advised')) {
      d = d2(p, B.repair[g.machine]);
      if (g.state === 'asked') offer(d, 4, { label: 'Waiting for Earth\'s answer… ' + Math.ceil(g.replyAt - s.t) + ' s' });
      else offer(d, 4, { label: g.state === 'advised' ? 'Fix it with Earth\'s instructions' : 'Fix the ' + JA.MACHINES[g.machine].name, run: function () { if (g.state === 'advised') startRepair(true); else repairModal(); } });
    }
    A.roverSpot('door', v1); var dr = Math.min(d2(p, v1), d2(p, A.rover.pos) - 1.4);
    offer(dr, 2.6, { label: 'Drive the rover', run: function () { A.enterRover(); Au.play('grab'); tip('drive', touch ? 'Push the stick up to drive and sideways to steer. Tap ✋ to get out.' : 'W drives forward, S brakes, A and D steer. Press E to get out.'); } });
    offer(d2(p, sp.door), 2.4, { label: 'Go inside the habitat', run: enterHab });
    if (s.sol >= s.totalSols) offer(d2(p, sp.rocketDoor), 4, { label: 'Board the rocket and fly home', run: boardModal });
    for (i = 0; i < sp.photo.length; i++) (function (i) {
      if (!s.photos[i]) offer(d2(p, sp.photo[i]), 2.6, { label: 'Take a postcard photo', run: function () { var f = sim.photo(s, i); if (f) { Au.play('photo'); U.fade(true); setTimeout(function () { U.fade(false); }, 140); U.card(f); } } });
    })(i);
    return best;
  }
  function pickUp(it) {
    if (it.tag === 'rack') { if (!sim.takeCell(G.s)) return; it.tag = null; }
    it.tag = null;
    A.pick(it); Au.play('grab');
    tip('throw', touch ? 'Got it! Tap ✋ next to a machine to use it, or hold 🎯 to aim a throw and let go.' : 'Got it! Press E next to a machine to use it — or hold F to aim a throw, and let go to throw.');
  }
  function checkGrow() { var f = G.s.m.food; if (f.lamp > 0 && f.water > 0 && f.beds.some(function (b) { return b.state !== 'empty'; })) G.tut.grow = true; }

  // =====================================================================
  //  THROWING
  // =====================================================================
  var aim = null, PTS = [];
  function buildAim() {
    aim = { dots: [], ring: null, n: 0 };
    var m = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false, depthTest: false });
    aim.mat = m; PTS = [];
    for (var i = 0; i < 36; i++) { var dot = W.add(W.root, new T.SphereGeometry(0.11, 6, 6), m, 0, -99, 0, true); dot.visible = false; dot.renderOrder = 8; aim.dots.push(dot); PTS.push(new T.Vector3()); }
    aim.ring = W.add(W.root, new T.TorusGeometry(0.9, 0.09, 6, 22), m, 0, -99, 0, true); aim.ring.rotation.x = Math.PI / 2; aim.ring.visible = false; aim.ring.renderOrder = 8;
  }
  function hideAim() { if (!aim) return; aim.dots.forEach(function (d) { d.visible = false; }); aim.ring.visible = false; }
  function updateThrow(dt) {
    var a = A.astro, c = a.carrying;
    if (!c || A.rover.driver) { if (G.charge) { G.charge = null; a.aim = false; hideAim(); } return; }
    if (G.fHeld && !G.charge) { G.charge = { t: 0, power: 0 }; a.aim = true; }
    if (!G.charge) return;
    var ch = G.charge;
    if (G.fHeld) {
      ch.t += dt;
      ch.power = 1 - Math.abs(((ch.t / 1.25) % 2) - 1);
      var n = A.trajectory(ch.power, PTS), ok = false, i, k;
      for (k = 0; k < G.zones.length && !ok; k++) {
        var z = G.zones[k]; if (!zoneTakes(z, c)) continue;
        zonePos(z, v1);
        if (z.flat) ok = Math.hypot(A.landing.x - v1.x, A.landing.z - v1.z) < z.r;
        else for (i = 0; i < n && !ok; i++) ok = PTS[i].distanceTo(v1) < z.r * 0.9;
      }
      aim.mat.color.set(ok ? 0x4dff9a : 0xffffff);
      for (i = 0; i < aim.dots.length; i++) { aim.dots[i].visible = i < n; if (i < n) aim.dots[i].position.copy(PTS[i]); }
      aim.ring.visible = true; aim.ring.position.set(A.landing.x, Tn.height(A.landing.x, A.landing.z) + 0.15, A.landing.z);
      Au.loop('aim', 200 + ch.power * 500, 0.03, 'sine');
    } else {
      Au.stopLoop('aim'); hideAim();
      var it = A.throwHeld(Math.max(0.05, ch.power));
      if (it) { Au.play('throw'); it.hold = G.clock + 0.12; }
      G.charge = null; a.aim = false;
    }
  }

  // =====================================================================
  //  MINI-GAMES: drilling (heat) and repairs (timing)
  // =====================================================================
  function startDrill(kind, idx) {
    var ease = G.s.level.ease, ice = kind === 'ice';
    G.mini = { type: 'drill', kind: kind, idx: idx, depth: 0, heat: 0, jams: 0, lock: 0,
      rate: ice ? 0.55 : 0.27, heatRate: (ice ? 0.5 : 0.46) / ease, cool: 0.6,
      title: ice ? 'Mining ice' : 'Drilling a rock core at ' + JA.GEO[G.s.site.id][idx].name,
      hint: touch ? 'Hold ✋ to drill. Let go before it overheats!' : 'Hold E to drill. Let go before it overheats! (Space = stop)' };
    A.astro.mode = 'busy'; A.astro.vel.set(0, 0, 0);
    var t = ice ? B.spots.ice[idx] : B.spots.drill[idx];
    A.astro.yaw = Math.atan2(t.x - A.astro.pos.x, t.z - A.astro.pos.z);
    tip('drill', 'Drills get hot! Drill in bursts and let it cool, just like real space drills do.');
  }
  function endMini() {
    G.mini = null; Au.stopLoop('drill'); U.drillUi(null);
    if (A.astro.mode === 'busy') A.astro.mode = 'walk';
  }
  function stepMini(dt) {
    var m = G.mini, s = G.s, a = A.astro;
    if (m.type === 'drill') {
      if (G.input.jump) { endMini(); return; }
      var hp = A.handPos(v1);
      m.lock = Math.max(0, m.lock - dt);
      if (G.eHeld && m.lock <= 0) {
        m.depth += m.rate * dt; m.heat += m.heatRate * dt;
        Au.loop('drill', 90 + m.heat * 160, 0.07);
        if (Math.random() < dt * 30) W.emit(hp.x, a.pos.y + 0.3, hp.z, { vx: (Math.random() - 0.5) * 4, vy: 1 + Math.random() * 3, vz: (Math.random() - 0.5) * 4, life: 0.6, size: 0.2, grow: 1.5, color: m.kind === 'ice' ? 0xbff4ff : (s.site.id === 'mars' ? 0xd9a070 : 0xc8c9d4), alpha: 0.8, grav: W.gravity * 0.5 });
        W.cam.shake = Math.max(W.cam.shake, 0.03 + m.heat * 0.05);
      } else { m.heat = Math.max(0, m.heat - m.cool * dt); Au.stopLoop('drill'); }
      if (m.heat >= 1) {
        m.jams++; m.heat = 0.4; m.depth = Math.max(0, m.depth - 0.25); m.lock = 0.9;
        Au.stopLoop('drill'); Au.play('bad'); W.cam.shake = 0.35;
        W.burst(hp.x, a.pos.y + 0.5, hp.z, 14, 4, 0xff7a4d, { life: 0.5, size: 0.22 });
        say('Too hot — the drill jammed! Let it cool between bursts.', true);
      }
      if (m.depth >= 1) {
        var q = m.jams === 0 ? 2 : m.jams === 1 ? 1 : 0, kind = m.kind, idx = m.idx;
        endMini();
        if (kind === 'ice') { A.pick(A.spawn('ice', A.handPos(v1), null, 'rest')); Au.play('ice'); tip('ice', 'A chunk of ice! The Air Maker can split it into oxygen. The rover bed carries four at a time.'); }
        else {
          var core = sim.drillCore(s, idx, q);
          A.pick(A.spawn('core', A.handPos(v1), core, 'rest')); Au.play('hit');
          toastAt(B.spots.drill[idx], ['Rough core', 'Good core!', 'Perfect core! ✨'][q], '#ffd23f');
          tip('core', 'A rock core! Take it to the Science Lab to find out what it is made of.');
        }
        return;
      }
      U.drillUi(m);
    } else {
      if (G.input.jump) { endMini(); U.dialUi(null); return; }
      m.lock = Math.max(0, m.lock - dt);
      if (m.lock <= 0) { m.needle += m.dir * m.speed * dt; if (m.needle > 1) { m.needle = 1; m.dir = -1; } if (m.needle < 0) { m.needle = 0; m.dir = 1; } }
      if (G.ePressed && m.lock <= 0) {
        if (Math.abs(m.needle - m.c) <= m.w / 2) {
          m.hits++; Au.play('hit'); m.lock = 0.25;
          m.c = 0.15 + Math.random() * 0.7;
          if (m.hits >= m.need) {
            sim.repairDone(s); Au.play('good'); U.dialUi(null); G.mini = null; a.mode = 'walk';
            say('Fixed! The ' + JA.MACHINES[m.machine].name + ' is running again.', true);
            return;
          }
        } else {
          sim.repairMiss(s); Au.play('spark'); m.lock = 0.7; W.cam.shake = 0.25;
          var rp = B.repair[m.machine]; W.burst(rp.x, rp.y + 0.6, rp.z, 16, 5, 0xffe36a, { life: 0.5, size: 0.2 });
          say('Zap! A short circuit wasted some solar charge.', true);
        }
      }
      U.dialUi(m);
    }
  }
  function startRepair(advised) {
    var s = G.s, g = s.glitch, ease = s.level.ease;
    G.mini = { type: 'dial', machine: g.machine, needle: 0, dir: 1, hits: 0, need: 3, lock: 0, c: 0.3 + Math.random() * 0.4,
      speed: advised ? 0.75 : 1.5 / Math.sqrt(ease), w: advised ? 0.34 : 0.13 * ease,
      title: (advised ? '📡 Earth\'s instructions: ' : '🔧 ') + 'Fixing the ' + JA.MACHINES[g.machine].name,
      hint: (touch ? 'Tap ✋' : 'Press E') + ' when the white line is in the green zone. Three times!' };
    A.astro.mode = 'busy'; A.astro.vel.set(0, 0, 0);
  }
  function repairModal() {
    var s = G.s, g = s.glitch, def = JA.REPAIRS[g.machine], info = sim.commInfo(s), dish = s.m.comms.on;
    U.modal('<div class="big-icon">🔧</div><h2>' + esc(def.title) + '</h2><p>' + esc(def.text) + '</p>' +
      '<button class="opt" data-act="self"><b>🔧 Fix it myself, right now</b><span>Tricky without instructions: the green zone is small. Every slip wastes half a power cell of charge.</span></button>' +
      '<button class="opt" data-act="ask"' + (dish ? '' : ' disabled') + '><b>📡 Ask Mission Control for the steps</b><span>' +
      (dish ? 'With their instructions the fix is easy. But a radio message takes ' + esc(info.oneWay) + ' each way' + (info.minutes ? ' — ' + esc(info.round) + ' there and back. The machine stays broken while you wait (' + Math.round(info.wait) + ' seconds of game time).' : ' — almost no wait at all!')
        : 'The Radio Dish has no power today, so you cannot call Earth.') + '</span></button>' +
      '<div class="modal-actions"><button class="btn ghost" data-act="later">Later</button></div>',
      { noFocus: true, speak: def.title + ' ' + def.text, actions: {
        self: function () { Au.play('tap'); U.closeModal(); startRepair(false); },
        later: function () { Au.play('tap'); U.closeModal(); },
        ask: function () {
          var r = sim.askEarth(s);
          if (!r.ok) { Au.play('deny'); return; }
          Au.play('page'); U.closeModal();
          say(s.site.id === 'moon' ? 'Message sent! The Moon is only 1.3 light-seconds away. The answer will be here in a moment.'
            : 'Message sent! It takes ' + r.info.oneWay + ' to reach Earth, and the answer takes just as long to come back. Keep working — I will call you.', true);
        }
      } });
  }

  // =====================================================================
  //  EVENTS FROM THE MISSION RULES
  // =====================================================================
  function spawnBag() {
    var n = A.items.filter(function (it) { return it.tag === 'tray'; }).length, sl = B.spots.bagTray[n % 4];
    var it = A.spawn('bag', v1.set(sl.x, sl.y + Math.floor(n / 4) * 0.45, sl.z), { name: 'soil bag' }, 'fixed');
    it.tag = 'tray'; Au.play('pop');
  }
  function handleEvents(ev) {
    var s = G.s;
    for (var i = 0; i < ev.length; i++) {
      var e = ev[i];
      if (e.type === 'cell') { syncRack(); if (d2(me(), B.spots.rack) < 40) Au.play('ding'); }
      else if (e.type === 'air') { Au.play('air'); toastAt(B.pos.air, '+' + e.amount + ' 💨', '#4fd8ff'); }
      else if (e.type === 'bag') spawnBag();
      else if (e.type === 'ripe') { tip('ripe' + s.sol, 'The veggies are ripe! Pick them at the Greenhouse.'); Au.play('good'); }
      else if (e.type === 'empty') {
        if (e.machine === 'air' && s.m.air.queue > 0) say('The Air Maker used up its power cell, and there is still ice waiting.', true);
        else if (e.machine === 'lab' && s.m.lab.queue.length) say('The Lab used up its power cell, and cores are still waiting.', true);
        else if (e.machine === 'food') say('The grow lamps ran out of power. Plants stop growing in the dark.', true);
      }
      else if (e.type === 'discovery') { Au.play('discovery'); U.card(e.find); toastAt(B.pos.lab, '+' + e.find.pts + ' ⭐', '#ffd23f'); }
      else if (e.type === 'break') { Au.play('bad'); say(JA.REPAIRS[e.machine].title + ' Look for the sparks.', true); }
      else if (e.type === 'advice') { Au.play('page'); say('Mission Control\'s answer has arrived! Go back to the ' + JA.MACHINES[e.machine].name + ' to finish the repair.', true); }
      else if (e.type === 'storm') {
        var inside = G.mode === 'inside';
        if (e.phase === 'warning') say(inside ? 'A solar storm is on its way. Good thing we are inside!' : s.m.comms.on ? 'Mission Control spotted a solar flare! A radiation storm is coming. Head for the airlock!' : 'My sensor just caught a solar storm! The dish is off, so there was no early warning. RUN for the airlock!', true);
        else if (e.phase === 'active') { if (!inside) say('Radiation storm! You cannot see it or feel it, but my sensor can. Get inside!', true); }
        else { Au.play('good'); say('The storm has passed. All clear!', true); }
      }
      else if (e.type === 'fail') { failNow(e.reason); return; }
      else if (e.type === 'dayEnd') { onDayEnd(); return; }
    }
  }
  function stormFrame(outside) {
    var s = G.s, st = s.storm, ph = sim.stormPhase(s);
    if (ph === 'warning') {
      var secs = Math.ceil(st.start - s.t);
      if (outside) { U.stormFx('warn'); U.banner('⚠️ Solar storm in ' + secs + ' s — get to the airlock!', ''); if (secs !== G.lastWarn) { G.lastWarn = secs; Au.play('warn'); } }
      else U.banner('⚠️ A solar storm is coming — you are safe inside', '');
      G.bannerUntil = G.clock + 1;
    } else if (ph === 'active') {
      W.env.storm = 1; U.stormFx(outside ? 'active' : 'inside');
      U.banner(outside ? '☢️ RADIATION STORM! Get inside!' : '☢️ Storm outside — home shield blocks ' + Math.round(sim.shield(s) * 100) + '%', outside ? 'active' : '');
      G.bannerUntil = G.clock + 1;
      G.geiger -= G.dt;
      if (G.geiger <= 0) { Au.play('click'); G.geiger = outside ? 0.03 + Math.random() * 0.09 : 0.15 + Math.random() * 0.3; }
    } else {
      if (W.env.storm) { W.env.storm = 0; U.banner('✅ The storm has passed', 'safe'); G.bannerUntil = G.clock + 4; }
      U.stormFx('');
      if (G.clock > G.bannerUntil) U.banner(null);
    }
  }

  // =====================================================================
  //  PLAYING OUTSIDE
  // =====================================================================
  function stepPlay(dt) {
    var s = G.s, a = A.astro, r = A.rover;
    W.env.t = 0.06 + 0.88 * (s.t / s.dayLength);
    var moving = Math.hypot(G.input.x, G.input.z) > 0.2;
    var ev = sim.tick(s, dt, { outside: true, sprint: G.input.sprint && moving && !r.driver, driving: r.driver && Math.abs(r.speed) > 0.6 });
    handleEvents(ev);
    if (G.mode !== 'play') return;
    G.lookIdle += dt;
    if (r.driver) {
      if (G.lookIdle > 1.2) { var want = r.yaw + Math.PI, df = want - W.cam.yaw; while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2; W.cam.yaw += df * Math.min(1, dt * 2.4); }
      Au.loop('rover', 46 + Math.abs(r.speed) * 9, 0.035 + Math.abs(r.speed) * 0.003, 'sawtooth');
    } else if (G.lookIdle > 0.7 && !G.charge && !G.mini) W.cam.yaw -= G.input.x * 1.0 * dt;
    W.cam.dist += ((r.driver ? G.zoom * 1.45 : G.zoom) - W.cam.dist) * Math.min(1, dt * 3);
    if (!G.tut.moved && a.moved > 10 && G.tut.jumped) G.tut.moved = true;
    if (G.mini) { G.action = null; stepMini(dt); }
    else {
      updateThrow(dt);
      G.action = G.charge ? null : findAction();
      if (G.ePressed && G.action && G.action.run) G.action.run();
      if (G.qPressed && a.carrying && !G.charge) { A.setDown(); Au.play('drop'); }
    }
    stormFrame(true);
  }

  // =====================================================================
  //  INSIDE THE HABITAT
  // =====================================================================
  function enterHab() {
    var s = G.s;
    if (A.astro.carrying) A.setDown();
    Au.play('door'); Au.stopAll();
    A.astro.mode = 'hidden'; G.mode = 'inside'; G.fast = false; G.charge = null; hideAim();
    W.cam.mode = 'inside';
    U.show($('inside'), true); U.show($('prompt'), false); U.hands(null); U.roverHud(0, false);
    U.show($('btn-sleep'), s.sol < s.totalSols);
    $('btn-fast').classList.remove('on');
    var ph = sim.stormPhase(s);
    say(ph === 'warning' || ph === 'active' ? 'Phew — inside! The walls and the soil bags are soaking up the storm.' : 'Back inside. Take a breather — the machines keep working.', true);
  }
  function exitHab() {
    Au.play('door');
    A.resetAstro(); G.mode = 'play'; G.fast = false;
    W.cam.mode = 'play'; W.cam.yaw = 0.45;
    U.show($('inside'), false);
    if (sim.stormPhase(G.s) === 'active') say('Careful! The storm is still going.', true);
  }
  function stepInside(dt) {
    var s = G.s;
    var ev = sim.tick(s, dt * (G.fast ? 8 : 1), { outside: false });
    W.env.t = 0.06 + 0.88 * (s.t / s.dayLength);
    handleEvents(ev);
    if (G.mode !== 'inside') return;
    stormFrame(false);
    var left = Math.max(0, Math.ceil(s.dayLength - s.t)), ph = sim.stormPhase(s);
    $('inside-text').textContent = (ph === 'active' ? 'A solar storm is raging outside. The home shield is blocking ' + Math.round(sim.shield(s) * 100) + '% of it.'
      : ph === 'warning' ? 'A solar storm is about to hit. Stay in!' : 'Safe inside. The home shield blocks ' + Math.round(sim.shield(s) * 100) + '% of radiation.') +
      ' Shift time left: ' + left + ' s.' + (s.sol >= s.totalSols ? ' Launch day — board the rocket before time runs out!' : '');
  }
  function sleepAsk() {
    var s = G.s;
    if (s.t > s.dayLength * 0.6) { endDay({}); return; }
    U.modal('<div class="big-icon">😴</div><h2>End the day now?</h2><p>There are still ' + Math.ceil(s.dayLength - s.t) + ' seconds of working time left. The machines will keep running, but you will not be able to do anything else today.</p>' +
      '<div class="modal-actions"><button class="btn ghost" data-act="no">Keep working</button><button class="btn primary" data-act="yes">Go to sleep</button></div>',
      { actions: { no: function () { Au.play('tap'); U.closeModal(); }, yes: function () { Au.play('tap'); U.closeModal(); endDay({}); } } });
  }

  // =====================================================================
  //  NIGHT
  // =====================================================================
  function onDayEnd() {
    var s = G.s;
    if (s.sol >= s.totalSols) { say('Time is up — BOLT is flying you to the rocket!', true); launchHome(); return; }
    if (G.mode === 'play') { say('The shift is over! I am towing you home. That rush used extra air.', true); endDay({ late: true }); }
    else endDay({});
  }
  function endDay(info) {
    var s = G.s;
    if (G.mode === 'night') return;
    G.mode = 'night'; G.mini = null; G.charge = null; hideAim(); Au.stopAll();
    if (A.rover.driver) A.exitRover();
    if (A.astro.carrying) A.setDown();
    A.astro.mode = 'hidden';
    U.fade(true);
    ['goals', 'prompt', 'hands', 'rover-hud', 'mini', 'inside', 'bolt'].forEach(function (id) { U.show($(id), false); });
    U.banner(null); U.stormFx(''); U.tags([]); U.marks([]); U.clearCards(); W.env.storm = 0;
    setTimeout(function () {
      var report = sim.endSol(s, info);
      syncRack();
      W.cam.mode = 'inside'; W.env.t = 0.99;
      U.setHud(s);
      nightModal(report);
    }, 650);
  }
  function nightModal(r) {
    var s = G.s, dw = dayWord();
    var names = { air: 'Air', food: 'Food', dose: 'Radiation badge', sci: 'Mission points' };
    var rows = r.lines.map(function (l) {
      var b = r.before[l.res], a = r.after[l.res], unit = l.res === 'dose' ? '%' : '';
      var better = l.res === 'dose' ? a < b : a > b, same = Math.round(a) === Math.round(b);
      return '<div class="rep"><span class="ic">' + l.icon + '</span><span class="nm">' + names[l.res] + '</span>' +
        '<span class="chg"><small>' + Math.round(b) + unit + ' → </small><span class="' + (same ? '' : better ? 'up' : 'down') + '">' + Math.round(a) + unit + '</span></span>' +
        '<ul>' + l.parts.map(function (p) {
          var good = l.res === 'dose' ? p.v < 0 : p.v > 0;
          return '<li><span>' + esc(p.text) + '</span>' + (p.v ? '<b class="' + (good ? 'up' : 'down') + '">' + (p.v > 0 ? '+' : '') + p.v + unit + '</b>' : '') + '</li>';
        }).join('') + '</ul></div>';
    }).join('');
    var finds = r.finds.length ? '<h3>🔬 What you discovered today</h3>' + r.finds.map(U.findRow).join('') : '';
    var rep = '';
    if (r.repair) rep = '<p class="sub">🔧 ' + (r.repair.overnight ? 'The crew fixed the ' + JA.MACHINES[r.repair.machine].name + ' overnight, but it was out of action for the rest of the day.'
      : 'You fixed the ' + JA.MACHINES[r.repair.machine].name + (r.repair.asked ? ' with help from Earth' : ' on your own') + (r.repair.misses ? ' (' + r.repair.misses + ' slip' + (r.repair.misses > 1 ? 's' : '') + ').' : ' without a single slip!')) + '</p>';
    var fc = '';
    if (!r.fail) {
      if (r.forecast) {
        var e = s.site.env[r.forecast.env.kind];
        fc = '<h3>📡 Tomorrow\'s forecast</h3><div class="info-row"><span class="ic">' + e.icon + '</span><div><b>' + esc(e.label) + ' · about ' + Math.round(r.forecast.env.cells) + ' power cells</b><p>' + esc(e.why) + '</p></div></div>' +
          (r.forecast.full ? U.weatherRow(s, r.forecast.weather, true, 'tomorrow') : '');
      } else fc = '<div class="info-row"><span class="ic">📡</span><div><b>No forecast for tomorrow</b><p>The Radio Dish had no power today, so Earth could not tell you what is coming.</p></div></div>';
    }
    var src = JA.SOURCES[r.fact.src];
    var fact = '<div class="fact"><b>🛰️ Real space fact</b><p>' + esc(r.fact.text) + '</p><small>Source: ' + esc(src.name) + '</small></div>';
    Au.play(r.fail ? 'bad' : 'good');
    U.modal('<h2>🌙 Night report · ' + dw + ' ' + r.sol + '</h2><p class="sub">Here is how the day added up.</p>' + rows + rep + finds + fc + fact +
      '<div class="modal-actions"><button class="btn primary" data-act="next">' + (r.fail ? 'See what happened' : 'Next ' + dw.toLowerCase() + ' ▶') + '</button></div>',
      { speak: 'Night report. ' + r.fact.text, actions: { next: function () {
        Au.play('page'); U.closeModal();
        if (r.fail) { G.ending = { fail: r.fail }; startLaunchScene(); }
        else { sim.startSol(s); beginSol(); }
      } } });
  }

  // =====================================================================
  //  THE ROCKET
  // =====================================================================
  function boardModal() {
    var s = G.s;
    U.modal('<div class="big-icon">🚀</div><h2>Ready to fly home?</h2><p>' + (s.caseLoaded ? 'The sample case is on board.' : 'The sample case is NOT on board yet. It is worth ' + R.casePts + ' mission points.') +
      ' Anything left undone stays undone!</p><div class="modal-actions"><button class="btn ghost" data-act="no">Not yet</button><button class="btn primary" data-act="yes">Launch! 🚀</button></div>',
      { actions: { no: function () { Au.play('tap'); U.closeModal(); }, yes: function () { Au.play('tap'); U.closeModal(); launchHome(); } } });
  }
  function launchHome() {
    var s = G.s;
    if (G.mode === 'launch') return;
    sim.endSol(s, {}); sim.finish(s);
    G.ending = { win: true };
    startLaunchScene();
  }
  function failNow(reason) {
    var s = G.s;
    s.over = { type: 'fail', reason: reason };
    G.ending = { fail: reason };
    say(reason === 'air' ? 'The air tanks are empty! Everyone to the rocket!' : 'The radiation badges are full! Everyone to the rocket!', true);
    startLaunchScene();
  }
  function startLaunchScene() {
    G.mode = 'launch'; G.launchT = 0; G.mini = null; G.charge = null; hideAim(); Au.stopAll();
    if (A.rover.driver) A.exitRover();
    A.astro.mode = 'hidden';
    ['goals', 'prompt', 'hands', 'rover-hud', 'mini', 'inside'].forEach(function (id) { U.show($(id), false); });
    U.tags([]); U.marks([]); U.stormFx(''); U.clearCards(); U.fade(false);
    W.env.storm = 0;
    var p = B.rocketPos(v1);
    W.cam.mode = 'fixed';
    W.cam.fixed = { pos: new T.Vector3(p.x + 34, Tn.height(p.x + 34, p.z + 30) + 4, p.z + 30), look: p.clone() };
    B.startLaunch(); Au.play('launch');
  }
  function stepLaunch(dt) {
    G.launchT += dt;
    B.rocketPos(W.cam.fixed.look);
    var t = G.launchT;
    U.banner(t < 0.8 ? '3…' : t < 1.6 ? '2…' : t < 2.4 ? '1…' : t < 6 ? '🚀 LIFTOFF!' : null, 'safe');
    if (t > 9.5 && G.ending) {
      var e = G.ending; G.ending = null; G.mode = 'end';
      U.fade(true);
      setTimeout(function () { if (e.win) winModal(); else failModal(e.fail); }, 700);
    }
  }

  function learned(s) {
    var out = [];
    out.push('Power is limited: every cell you carried to one machine was a cell another machine did not get.');
    if (s.site.id === 'mars') out.push('Mars is so far away that Earth cannot help quickly. Crews there must often decide for themselves.');
    else out.push('The Moon has no air to block solar storms, so thick soil shielding really matters.');
    out.push(s.stats.storms ? 'You lived through ' + s.stats.storms + ' solar storm' + (s.stats.storms > 1 ? 's' : '') + ' that really happened on the Sun.' : 'The real Sun stayed calm for your mission. Astronauts get lucky sometimes too!');
    out.push('Ice is treasure: with electricity it becomes oxygen to breathe, and water for plants.');
    if (s.stats.bestThrow > 7) out.push('Your longest throw flew ' + Math.round(s.stats.bestThrow) + ' m. On Earth the same throw would only go about ' + Math.max(1, Math.round(s.stats.bestThrow * s.site.gravity / 9.81)) + ' m.');
    return '<ul class="learned">' + out.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
  }
  function endButtons() {
    return '<div class="modal-actions"><button class="btn ghost" data-act="science">📚 The real science</button><button class="btn ghost" data-act="change">Change mission</button><button class="btn primary" data-act="again">Play again ▶</button></div>';
  }
  function endActions() {
    return { science: function () { Au.play('tap'); scienceInfo(); },
      change: function () { Au.play('tap'); U.closeModal(); titleScene(); U.show($('title'), false); setupModal(); },
      again: function () { U.fade(false); launch(); } };
  }
  function winModal() {
    var s = G.s, rank = sim.rankFor(s), next = sim.nextRank(s), badges = sim.badges(s), isBest = saveBest(Math.round(s.sci));
    hideHud(); Au.play('win');
    var finds = s.finds.length ? '<h3>🔬 Your discoveries (' + s.finds.length + ')</h3>' + s.finds.map(U.findRow).join('') : '';
    U.modal('<div class="rank"><span class="big-icon">' + rank.icon + '</span><h2>' + esc(rank.name) + '</h2>' +
      '<p>Mission complete! The crew is on the way home after ' + s.totalSols + ' ' + dayWord().toLowerCase() + 's on ' + esc(s.site.name) + '.</p>' +
      '<p style="font-size:1.5rem;font-weight:700">⭐ ' + Math.round(s.sci) + ' mission points' + (isBest ? ' · new best!' : '') + '</p>' +
      '<p class="sub">' + s.over.bonus.map(function (b) { return esc(b.text) + ' +' + b.v; }).join(' · ') + '. ' + esc(rank.line) + (next ? ' ' + (next.need - Math.round(s.sci)) + ' more points next time for ' + esc(next.rank.name) + '.' : '') + '</p></div>' +
      (badges.length ? '<div class="badges">' + badges.map(function (b) { return '<div class="badge"><em>' + b.icon + '</em><div><b>' + esc(b.name) + '</b><span>' + esc(b.text) + '</span></div></div>'; }).join('') + '</div>' : '') +
      '<h3>What you just practised</h3>' + learned(s) + finds + endButtons(),
      { cls: 'wide', actions: endActions(), speak: 'Mission complete! You are a ' + rank.name + ' with ' + Math.round(s.sci) + ' mission points.' });
  }
  function failModal(reason) {
    var s = G.s, f = JA.FAIL[reason];
    hideHud();
    U.modal('<div class="rank"><span class="big-icon">' + f.icon + '</span><h2>' + esc(f.title) + '</h2></div>' +
      '<p>' + esc(f.text) + ' You made it to ' + dayWord().toLowerCase() + ' ' + s.sol + ' of ' + s.totalSols + ' and earned ⭐ ' + Math.round(s.sci) + '.</p>' +
      '<div class="fact"><b>💡 BOLT\'s tip</b><p>' + esc(f.tip) + '</p><small>Real astronauts practise in simulators for years — and they fail there a lot. That is how they learn.</small></div>' +
      (s.finds.length ? '<h3>🔬 Your discoveries (' + s.finds.length + ')</h3>' + s.finds.map(U.findRow).join('') : '') + endButtons(),
      { actions: endActions(), speak: f.title + '. ' + f.text + ' ' + f.tip });
  }

  // =====================================================================
  //  INFO CARDS
  // =====================================================================
  function howInfo() {
    var keys = touch
      ? '<div class="keys"><span>🕹️</span><div>Left stick: walk (push all the way to run) · drive the rover</div><span>👆</span><div>Drag anywhere to look around</div><span>✋</span><div>Use, pick up, plug in, drill (hold)</div><span>🎯</span><div>Hold to aim a throw, let go to throw</div><span>⤴</span><div>Jump</div></div>'
      : '<div class="keys"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><div>Walk · drive the rover (arrow keys work too)</div><span><kbd>Mouse</kbd></span><div>Drag to look around · wheel to zoom</div><span><kbd>E</kbd></span><div>Use, pick up, plug in, drill (hold)</div><span><kbd>F</kbd></span><div>Hold to aim a throw, let go to throw</div><span><kbd>Space</kbd></span><div>Jump</div><span><kbd>Shift</kbd></span><div>Run (uses more air)</div><span><kbd>Q</kbd></span><div>Put down what you are holding</div></div>';
    openInfo('<h2>How to play</h2>' + keys +
      '<div class="info-row"><span class="ic">🔋</span><div><b>Power cells</b><p>The Solar Rack charges a few cells each day. Carry or throw each one into a machine\'s socket: Air Maker, Greenhouse, Soil Bagger, Lab, Radio Dish or Rover.</p></div></div>' +
      '<div class="info-row"><span class="ic">🧊</span><div><b>Ice = air and water</b><p>Mine ice at the far crater. Drop it in the Air Maker to make oxygen, or in the Greenhouse tank to water the plants. The rover bed carries four things.</p></div></div>' +
      '<div class="info-row"><span class="ic">🛡️</span><div><b>Shield and storms</b><p>Throw soil bags onto the dome to block radiation. The solar storms are real ones from NASA records — when the alarm sounds, get inside!</p></div></div>' +
      '<div class="info-row"><span class="ic">🧪</span><div><b>Science</b><p>Drill rock cores at the glowing orange sites and study them in the Lab. Carry the instruments from the rocket pad to the blue rings. On the last day, load the sample case and board the rocket.</p></div></div>');
  }
  function scienceInfo() {
    var s = G.s, mission = '';
    if (s && s.weather.length) mission = '<p><b>This mission:</b> ' + (s.weatherSource === 'live' ? 'live data' : 'archived data' + (s.weatherFallback ? ' (NASA could not be reached, so this is not live)' : '')) + ', real dates ' + JA.weather.prettyDate(s.weather[0].date) + ' to ' + JA.weather.prettyDate(s.weather[s.weather.length - 1].date) + '.</p>';
    var links = Object.keys(JA.SOURCES).map(function (k) { var x = JA.SOURCES[k]; return '<li><a href="' + x.url + '" target="_blank" rel="noopener">' + esc(x.name) + '</a></li>'; }).join('');
    openInfo('<h2>The real science</h2><p class="sub">For curious kids, parents, teachers and judges.</p>' +
      '<h3>Real data inside the game</h3><ul class="src-list">' +
      '<li><b>Solar flares — NASA DONKI.</b> Every storm is a real flare from NASA\'s Space Weather Database of Notifications, Knowledge, Information. “Live” mode downloads the last 30 days when the mission starts. “May 2024” mode uses records saved inside the game (22 April – 20 May 2024) and is labelled as an archive. Each mission day replays one real calendar day; the strongest flare that day sets the storm: class M1–M4 small, M5–M9 medium, X big.</li>' +
      '<li><b>Gravity.</b> Jumps, throws and the rover use the real surface gravity: 1.62 m/s² on the Moon, 3.71 m/s² on Mars. The dotted throwing arc is the real parabola.</li>' +
      '<li><b>Everyday radiation.</b> Mars: about 0.67 mSv per day (RAD instrument on NASA\'s Curiosity rover). Moon: about 1.4 mSv per day (LND instrument, Zhang et al. 2020). The Moon value is about twice the Mars value, and the game keeps that ratio.</li>' +
      '<li><b>Radio delay.</b> Moon: 1.3 seconds. Mars: worked out from where Earth and Mars were on the mission\'s real dates (an estimate, good to a few percent).</li>' +
      '<li><b>Discoveries and facts</b> describe real findings from NASA missions (Apollo, LCROSS, LRO, Curiosity, Opportunity, Phoenix, InSight, Perseverance) and NASA\'s Open Science Data Repository.</li></ul>' + mission +
      '<h3>What is simplified</h3><ul class="src-list">' +
      '<li>Time is squeezed: a working day lasts three minutes, plants grow in a day, and a 20-minute radio wait becomes about half a minute.</li>' +
      '<li>The radiation badge (0–100%) is a game scale, not a medical dose. Storm strength is set from the flare class. In real life only some flares send a radiation storm to the Moon or Mars, and it can arrive minutes or hours later.</li>' +
      '<li>Dust storms (Mars) and shadow days (Moon) are simulated, inspired by the 2018 global dust storm and the low Sun at the lunar south pole.</li>' +
      '<li>The rock sites are invented places. Each discovery describes what a real mission found somewhere on the Moon or Mars, not at this exact spot.</li>' +
      '<li>Power cells, air, food and points are game units, tuned so that no choice is free.</li>' +
      '<li>Radiation is invisible. The pink glow is BOLT\'s “sensor view” so you can tell a storm is happening.</li></ul>' +
      '<h3>Sources</h3><ul class="src-list">' + links + '</ul>');
  }

  // =====================================================================
  //  GOALS, WAYPOINTS, TAGS
  // =====================================================================
  function goalsFor(s) {
    var g = [], a = A.astro, c = a.carrying, sp = B.spots, m = s.m, L = s.level, last = s.sol >= s.totalSols, left = Math.max(0, 1 - s.t / s.dayLength);
    function has(type) { return c && c.type === type; }
    function add(text, done, target, icon, optional) { g.push({ text: text, done: !!done, target: target || null, icon: icon, optional: optional }); }
    var roverIce = A.rover.bed.some(function (it) { return it && it.type === 'ice'; });
    var rackOrCell = has('cell') ? null : sp.rack;
    var airT = has('ice') || roverIce ? sp.hoppers.air : has('cell') ? sp.sockets.air : (m.air.power === 0 && m.air.queue > 0 ? sp.rack : sp.ice[0]);
    if (s.sol === 1) {
      add(touch ? 'Walk with the stick, drag to look, and try a jump' : 'Walk (W A S D), drag the mouse to look, jump (Space)', G.tut.moved, null, '👟');
      add('Carry a power cell from the Solar Rack to the Air Maker', G.tut.airCell, has('cell') ? sp.sockets.air : sp.rack, '🔋');
      add('Fetch ice from the ' + s.site.iceName + ' for the Air Maker (the rover is faster!)', G.tut.ice, airT, '🧊');
      add('Greenhouse: a power cell, ice for water, then plant seeds', G.tut.grow, has('cell') ? sp.sockets.food : has('ice') ? sp.hoppers.water : sp.beds[1], '🥬');
    } else {
      add('Air for today: feed the Air Maker ice and power', s.air >= L.airDrain * left + 3, airT, '💨');
      if (!last) {
        var ripe = -1; m.food.beds.forEach(function (b, i) { if (b.state === 'ripe' && ripe < 0) ripe = i; });
        add('Dinner tonight needs ' + L.dinner + ' food', s.food >= L.dinner, has('crate') ? sp.hoppers.pantry : ripe >= 0 ? sp.beds[ripe] : sp.beds[1], '🥬');
      }
    }
    var trayBag = A.items.filter(function (it) { return it.tag === 'tray'; })[0];
    add('Shield: throw soil bags onto the dome (' + s.bags + '/' + R.shieldSlots + ')', s.bags >= R.shieldSlots, has('bag') ? sp.hoppers.dome : trayBag ? trayBag.pos : has('cell') ? sp.sockets.bag : rackOrCell, '🛡️', true);
    var studied = s.finds.filter(function (f) { return f.kind === 'core'; }).length, geoT = null, bd = 1e9;
    sp.drill.forEach(function (p, i) { if (sim.coresLeft(s, i) > 0) { var d = d2(me(), p); if (d < bd) { bd = d; geoT = p; } } });
    var coreOnMe = has('core') || A.rover.bed.some(function (it) { return it && it.type === 'core'; });
    add('Science: drill rock cores and study them in the Lab (' + studied + '/8)', studied >= 8, coreOnMe ? sp.hoppers.lab : (m.lab.queue.length && m.lab.power === 0 ? (has('cell') ? sp.sockets.lab : sp.rack) : geoT), '🧪', true);
    var ni = Object.keys(sp.inst).filter(function (id) { return s.inst[id]; }).length;
    var instItem = A.items.filter(function (it) { return it.type === 'inst' && it.state !== 'held'; })[0];
    add('Set up the science instruments (' + ni + '/3)', ni >= 3, has('inst') ? sp.inst[c.data.id] : instItem ? instItem.pos : null, '📦', true);
    if (last) {
      add('Load the sample case into the rocket', s.caseLoaded, has('case') ? sp.hoppers.cargo : G.caseItem ? G.caseItem.pos : null, '🧳');
      add('Board the rocket before the shift ends', false, sp.rocketDoor, '🚀');
    } else add('Be inside before the shift ends', false, left < 0.2 ? sp.door : null, '🏠');
    // which one is "now": on day 1 the lesson steps come first; later, survival first, then whatever you are carrying for
    var now = -1, i;
    for (i = 0; i < g.length; i++) if (!g[i].done && !g[i].optional && (g[i].target || g[i].icon === '👟')) { now = i; break; }
    if (c) for (i = 0; i < g.length; i++) if (!g[i].done && g[i].target && ((c.type === 'bag' && g[i].icon === '🛡️') || (c.type === 'core' && g[i].icon === '🧪') || (c.type === 'inst' && g[i].icon === '📦') || (c.type === 'case' && g[i].icon === '🧳') || (c.type === 'crate' && g[i].icon === '🥬'))) { now = i; break; }
    if (now < 0 || (g[now].icon === '🏠' || g[now].icon === '🚀') && left > 0.25) for (i = 0; i < g.length; i++) if (!g[i].done && g[i].optional && g[i].target) { now = i; break; }
    if (now >= 0) g[now].now = true;
    return { list: g, now: now >= 0 ? g[now] : null };
  }
  var TUT_LINES = [null,
    'Power cells charge on the Solar Rack. Walk up to one and grab it, then carry it to the Air Maker\'s socket.',
    'Now the Air Maker needs ice to turn into oxygen. The ice is far away — plug a cell into the back of the rover and drive there!',
    'Next: food. The Greenhouse needs light from a power cell, water from ice, and seeds in the beds.',
    'You have got the basics! Now you choose: soil bags for the shield, rock cores for science, or the instruments by the rocket. There is not enough power for everything!'];
  function tutorialTalk() {
    var t = G.tut, step = !t.moved ? 0 : !t.airCell ? 1 : !t.ice ? 2 : !t.grow ? 3 : 4;
    if (step > G.tutStep) { G.tutStep = step; if (TUT_LINES[step]) { say(TUT_LINES[step], true); Au.play('good'); } }
  }

  function placeMark(list, pos, icon, label, cls, color) {
    var p = W.project(pos), cx = W.w / 2, cy = W.h / 2, x = p.x, y = p.y - 26, mx = 44, top = 150, bot = 130;
    var dx = x - cx, dy = y - cy;
    if (p.hidden) { dx = -dx; dy = -dy; if (Math.abs(dy) < 40) dy = 200; }
    var off = p.hidden || x < mx || x > W.w - mx || y < top || y > W.h - bot;
    if (off) {
      var sx = dx === 0 ? 1e9 : (dx > 0 ? (W.w - mx - cx) : (cx - mx)) / Math.abs(dx);
      var sy = dy === 0 ? 1e9 : (dy > 0 ? (W.h - bot - cy) : (cy - top)) / Math.abs(dy);
      var k = Math.min(sx, sy); if (p.hidden) k = Math.min(sx, sy);
      x = cx + dx * k; y = cy + dy * k;
    }
    list.push({ x: x, y: y, icon: icon, label: label, cls: cls, color: color });
  }
  function hudFrame() {
    var s = G.s, a = A.astro, sp = B.spots, pos = me(), i;
    if (!s || G.mode === 'title' || G.mode === 'brief' || G.mode === 'end' || G.mode === 'night') return;
    U.setHud(s);
    if (G.mode !== 'play') { U.tags([]); U.marks([]); return; }
    // prompt + hands
    var keyLabel = touch ? '✋' : 'E';
    if (G.mini || G.charge) U.prompt(null);
    else if (G.action) U.prompt(G.action.label, keyLabel, !G.action.run);
    else U.prompt(null);
    if (a.carrying && !A.rover.driver) U.hands(a.carrying, G.charge ? G.charge.power : 0, G.charge ? 'Let go to throw!' : touch ? 'Hold 🎯 to aim a throw' : 'Hold F to aim a throw · Q puts it down');
    else U.hands(null);
    U.roverHud(s.m.rover.charge, A.rover.driver);
    // goals + BOLT
    if (G.clock > G.goalAt) {
      G.goalAt = G.clock + 0.3;
      var gl = goalsFor(s);
      G.goal = gl.now;
      U.setGoals(s.sol === 1 ? 'First day' : s.sol >= s.totalSols ? 'Launch day' : 'Today', gl.list);
      if (s.sol === 1) tutorialTalk();
      if (G.clock > G.hintAt && (s.sol > 1 || G.tutStep >= 4)) { G.hintAt = G.clock + 9; var h = sim.hint(s); if (h) say(h); }
    }
    // tags over machines
    var tags = [], m = s.m;
    function tag(p, text, cls) { if (d2(pos, p) > 62) return; var q = W.project(p); if (q.hidden || q.x < 40 || q.x > W.w - 40 || q.y < 110 || q.y > W.h - 60) return; tags.push({ x: q.x, y: q.y, text: text, cls: cls }); }
    var br = function (o) { return o.broken ? 'bad' : ''; };
    tag(B.pos.rack, '☀️ Solar Rack · ' + s.rack.cells + ' 🔋' + (s.rack.broken ? ' · BROKEN' : ''), br(s.rack) || (s.rack.cells >= R.rackMax ? 'warn' : ''));
    tag(B.pos.air, '💨 Air Maker · ⚡' + m.air.power + ' 🧊' + m.air.queue + (m.air.broken ? ' · BROKEN' : ''), br(m.air) || (m.air.power === 0 || m.air.queue === 0 ? 'warn' : ''));
    tag(B.pos.food, '🥬 Greenhouse · 💡' + (m.food.lamp > 0 ? 'on' : 'off') + ' 💧' + (m.food.water > 0 ? 'ok' : 'dry') + (m.food.broken ? ' · BROKEN' : ''), br(m.food));
    tag(B.pos.bag, '🛡️ Soil Bagger' + (m.bag.pending ? ' · making ' + m.bag.pending : ''), '');
    tag(B.pos.lab, '🔬 Lab · ⚡' + m.lab.power + ' 🧪' + m.lab.queue.length + (m.lab.broken ? ' · BROKEN' : ''), br(m.lab) || (m.lab.queue.length && !m.lab.power ? 'warn' : ''));
    tag(B.pos.comms, '📡 Radio Dish · ' + (m.comms.on ? 'on' : 'off'), '');
    tag(B.pos.hab, '🏠 Shield ' + Math.round(sim.shield(s) * 100) + '% · ' + s.bags + '/' + R.shieldSlots + ' bags', '');
    if (!A.rover.driver) { v2.copy(A.rover.pos); v2.y += 5; tag(v2, '🚙 Rover · ' + Math.ceil(m.rover.charge) + ' s', m.rover.charge <= 0 ? 'warn' : ''); }
    if (s.sol >= s.totalSols) tag(B.pos.rocket, '🚀 Rocket' + (s.caseLoaded ? ' · samples on board' : ''), '');
    U.tags(tags);
    // waypoints
    var marks = [], ph = sim.stormPhase(s), alarm = ph === 'warning' || ph === 'active', gt = G.goal && G.goal.target;
    function far(p, min) { return d2(pos, p) > min && (!gt || d2(gt, p) > 5); }
    function label(p) { return Math.round(d2(pos, p)) + ' m'; }
    if (gt && d2(pos, gt) > 4) { v2.copy(gt); v2.y += 2.2; placeMark(marks, v2, G.goal.icon || '⭐', label(gt), 'goal', '#ffd23f'); }
    if (alarm || far(sp.door, 34)) { v2.copy(sp.door); v2.y += 6; placeMark(marks, v2, '🏠', label(sp.door), alarm ? 'alarm' : '', '#4dff9a'); }
    if (!A.rover.driver && far(A.rover.pos, 22)) { v2.copy(A.rover.pos); v2.y += 4; placeMark(marks, v2, '🚙', label(A.rover.pos), '', '#9fe8ff'); }
    v3.set(Tn.L.ice[0], Tn.height(Tn.L.ice[0], Tn.L.ice[1]) + 6, Tn.L.ice[1]);
    if (far(v3, 36)) placeMark(marks, v3, '🧊', label(v3), 'small', '#4fd8ff');
    for (i = 0; i < sp.drill.length; i++) if (sim.coresLeft(s, i) > 0 && far(sp.drill[i], 14)) { v2.copy(sp.drill[i]); v2.y += 4; placeMark(marks, v2, JA.GEO[s.site.id][i].icon, '', 'small', '#ffb84d'); }
    Object.keys(sp.inst).forEach(function (id) { if (!s.inst[id] && far(sp.inst[id], 14)) { v2.copy(sp.inst[id]); v2.y += 4; placeMark(marks, v2, '📍', '', 'small', '#5cf0ff'); } });
    for (i = 0; i < sp.photo.length; i++) if (!s.photos[i] && far(sp.photo[i], 14)) { v2.copy(sp.photo[i]); v2.y += 4; placeMark(marks, v2, '📸', '', 'small', '#ffd23f'); }
    U.marks(marks);
  }

  // =====================================================================
  //  INPUT + MAIN LOOP
  // =====================================================================
  var KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
  function bind() {
    window.addEventListener('keydown', function (e) {
      if (U.modalOpen() || infoOpen()) { if (e.code === 'Escape' && infoOpen()) closeInfo(); return; }
      var k = KEYMAP[e.code];
      if (k) { G.keys[k] = true; e.preventDefault(); }
      if (e.code === 'Space') { if (!e.repeat) G.input.jump = true; e.preventDefault(); }
      if (e.code === 'KeyE' || e.code === 'Enter') { if (!e.repeat) G.ePressed = true; G.eHeld = true; e.preventDefault(); }
      if (e.code === 'KeyF') { G.fHeld = true; e.preventDefault(); }
      if (e.code === 'KeyQ' && !e.repeat) G.qPressed = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.keys.shift = true;
      if (e.code === 'Escape' || e.code === 'KeyH') { if (G.mode === 'play' || G.mode === 'inside') howInfo(); }
    });
    window.addEventListener('keyup', function (e) {
      var k = KEYMAP[e.code]; if (k) G.keys[k] = false;
      if (e.code === 'KeyE' || e.code === 'Enter') G.eHeld = false;
      if (e.code === 'KeyF') G.fHeld = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.keys.shift = false;
    });
    window.addEventListener('blur', function () { G.keys = {}; G.eHeld = false; G.fHeld = false; });
    document.addEventListener('pointerdown', function () { Au.unlock(); }, { once: true });

    // drag to look, wheel to zoom
    var canvas = $('scene'), drag = null;
    canvas.addEventListener('pointerdown', function (e) { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag || drag.id !== e.pointerId || G.mode !== 'play') return;
      W.lookBy((e.clientX - drag.x) * 0.0055, (e.clientY - drag.y) * 0.004);
      drag.x = e.clientX; drag.y = e.clientY; G.lookIdle = 0;
    });
    function endDrag(e) { if (drag && drag.id === e.pointerId) drag = null; }
    canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('wheel', function (e) { G.zoom = clamp(G.zoom * (1 + (e.deltaY > 0 ? 0.1 : -0.1)), 6, 22); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // touch controls
    var stick = $('stick'), nub = stick.querySelector('i'), sid = null;
    function moveStick(e) {
      var r = stick.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      var len = Math.hypot(dx, dy), max = r.width / 2;
      if (len > max) { dx *= max / len; dy *= max / len; }
      G.stick.x = dx / max; G.stick.z = dy / max;
      nub.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    }
    stick.addEventListener('pointerdown', function (e) { sid = e.pointerId; stick.setPointerCapture(sid); moveStick(e); e.preventDefault(); });
    stick.addEventListener('pointermove', function (e) { if (e.pointerId === sid) moveStick(e); });
    function endStick(e) { if (e.pointerId !== sid) return; sid = null; G.stick.x = G.stick.z = 0; nub.style.transform = ''; }
    stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);
    function hold(id, down, up) {
      var el = $(id);
      el.addEventListener('pointerdown', function (e) { try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } down(); e.preventDefault(); });
      el.addEventListener('pointerup', function () { if (up) up(); }); el.addEventListener('pointercancel', function () { if (up) up(); });
    }
    hold('t-jump', function () { G.input.jump = true; });
    hold('t-use', function () { G.ePressed = true; G.eHeld = true; }, function () { G.eHeld = false; });
    hold('t-throw', function () { G.fHeld = true; }, function () { G.fHeld = false; });

    $('btn-start').addEventListener('click', function () { Au.unlock(); Au.play('tap'); U.show($('title'), false); setupModal(); });
    $('btn-how').addEventListener('click', function () { Au.play('tap'); howInfo(); });
    $('btn-science').addEventListener('click', function () { Au.play('tap'); scienceInfo(); });
    $('btn-info').addEventListener('click', function () { Au.play('tap'); howInfo(); });
    $('btn-out').addEventListener('click', exitHab);
    $('btn-sleep').addEventListener('click', sleepAsk);
    $('btn-fast').addEventListener('click', function () { G.fast = !G.fast; this.classList.toggle('on', G.fast); Au.play('tap'); });
    $('btn-sound').addEventListener('click', function () { Au.setSound(!Au.soundOn()); this.textContent = Au.soundOn() ? '🔊' : '🔇'; this.classList.toggle('off', !Au.soundOn()); Au.play('tap'); });
    var read = $('btn-read');
    if (!Au.canRead()) read.classList.add('hidden');
    read.classList.add('off');
    read.addEventListener('click', function () { Au.setReading(!Au.readingOn()); this.classList.toggle('off', !Au.readingOn()); this.classList.toggle('on', Au.readingOn()); if (Au.readingOn()) Au.speak('Read aloud is on. I will read the messages to you.'); });

    // little moments from the physics
    A.onJump = function () { Au.play('jump'); G.tut.jumped = true; if (G.s) tip('jump', G.s.site.id === 'moon' ? 'Wheee! The Moon\'s gravity is only one-sixth of Earth\'s, so you jump six times higher.' : 'Boing! Mars gravity is about 38% of Earth\'s, so you jump more than twice as high.'); };
    A.onLand = function (rover) { Au.play(rover ? 'thud' : 'land'); if (!rover) W.dust(A.astro.pos.x, A.astro.pos.z, 8, 2, 0.45); };
    A.onStep = function (p, yaw, side, sprint) {
      var c = Math.cos(yaw), sn = Math.sin(yaw);
      W.print(p.x + c * 0.2 * side, p.z - sn * 0.2 * side, yaw, 0.24, 0.46);
      if (sprint || Math.random() < 0.5) W.dust(p.x, p.z, sprint ? 3 : 1, 0.9, 0.3);
      Au.play('step');
    };
    A.onBounce = function (it, hit) { if (hit > 2) Au.play('thud'); W.dust(it.pos.x, it.pos.z, 4, 1.4, 0.35); };
    A.onEdge = function () { say('That is as far as my radio can reach. Let us turn back!'); };
    A.onDevil = function (kind) {
      if (!G.s) return;
      if (kind === 'clean') { sim.cleanAllPanels(G.s); toastAt(B.pos.solar, '🌪️ Dust devil cleaned the panels!', '#ffd23f'); tip('devil', 'A dust devil just blew the dust off the solar panels! That really happened to the Spirit and Opportunity rovers.'); }
      else tip('devil2', 'Whee! A dust devil! Mars air is so thin that it feels like a gentle breeze.');
    };
  }

  var last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    advance(dt);
  }
  function advance(dt) {
    G.dt = dt;
    var paused = U.modalOpen() || infoOpen(), k = G.keys;
    G.input.x = clamp((k.right ? 1 : 0) - (k.left ? 1 : 0) + G.stick.x, -1, 1);
    G.input.z = clamp((k.down ? 1 : 0) - (k.up ? 1 : 0) + G.stick.z, -1, 1);
    G.input.sprint = !!k.shift || Math.hypot(G.stick.x, G.stick.z) > 0.93;
    if (!paused) {
      G.clock += dt;
      if (G.mode === 'play') stepPlay(dt);
      else if (G.mode === 'inside') stepInside(dt);
      else if (G.mode === 'launch') stepLaunch(dt);
      if (A.astro) A.update(dt, G.mode === 'play' && !G.mini ? G.input : null);
      if (G.s && (G.mode === 'play' || G.mode === 'inside')) checkZones();
    }
    B.update(dt, G.mode === 'title' ? null : G.s);
    W.update(dt);
    if (!paused) hudFrame();
    G.input.jump = false; G.ePressed = false; G.qPressed = false;
  }
  G.advance = advance;   // lets tests step the game without waiting for the screen

  function boot() {
    if (!window.THREE) { fatal('The 3D engine could not load. Please check your internet connection and reload the page.'); return; }
    if (!W.init($('scene'))) { fatal('Sorry — this browser cannot show 3D graphics (WebGL is turned off).'); return; }
    W.build('mars', G.opts.suit);
    A.astro.mode = 'hidden';
    titleScene();
    W.snapCamera();
    bind();
    requestAnimationFrame(frame);
  }
  boot();
})(window.JA);
