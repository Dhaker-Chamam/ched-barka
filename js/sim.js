/* Astro Outpost — mission rules (no graphics here, so they are easy to read and test).
   The 3D game calls these functions when the astronaut physically does something:
   plugs in a power cell, drops ice in a hopper, throws a soil bag on the dome... */
(function (JA) {
  'use strict';
  var R = JA.RULES;

  function rng32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function no(msg) { return { ok: false, msg: msg }; }
  var OK = { ok: true };

  function makeEnv(site, level, rng) {
    var n = level.sols, mars = site.id === 'mars', kinds = [];
    var calm = mars ? 'clear' : 'sun', mid = mars ? 'dusty' : 'lowsun', bad = mars ? 'storm' : 'shadow';
    for (var i = 0; i < n; i++) kinds.push(calm);
    if (n <= 3) { kinds[1] = bad; kinds[2] = mid; }
    else {
      var b = 3 + Math.floor(rng() * 2);          // the bad day is day 3 or 4
      kinds[b - 2] = mid; kinds[b - 1] = bad;
      kinds[b] = b === 3 && rng() < 0.6 ? bad : mid;
    }
    return kinds.map(function (k) { return { kind: k, cells: site.env[k].cells + level.cellBonus }; });
  }

  function newGame(opts) {
    var site = JA.SITES[opts.site], level = JA.LEVELS[opts.level];
    var seed = opts.seed || Math.floor(Math.random() * 1e9), rng = rng32(seed);
    var s = {
      seed: seed, rng: rng, site: site, level: level, dayLength: R.dayLength,
      weatherSource: opts.weather.source, weatherFallback: !!opts.weather.fallback,
      weather: JA.weather.pickWindow(opts.weather, level.sols, level.id, rng),
      env: makeEnv(site, level, rng),
      sol: 0, totalSols: level.sols, t: 0,
      air: level.id === 'cadet' ? 50 : 60, food: level.id === 'cadet' ? 28 : 45, dose: 0, sci: 0, bags: 0,
      rack: { charge: 0, cells: 0, eff: [1, 1, 1], broken: false },
      m: {
        air: { power: 0, queue: 0, prog: 0, broken: false },
        food: { lamp: 0, water: 0, broken: false, beds: [] },
        bag: { pending: 0, timer: 0, broken: false },
        lab: { power: 0, queue: [], prog: 0, broken: false },
        comms: { on: false, broken: false },
        rover: { charge: 60 }
      },
      cores: [0, 0, 0, 0], finds: [], inst: {}, photos: {}, caseLoaded: false,
      stats: { storms: 0, stormOut: 0, cells: 0, ice: 0, crates: 0, cores: 0, repairs: 0, tricks: 0, bestThrow: 0, drive: 0 },
      glitchPlan: {}, forecast: true, night: false, over: null, log: [], seenFacts: {}
    };
    for (var i = 0; i < R.beds; i++) s.m.food.beds.push({ state: 'empty', g: 0 });
    var pool = ['air', 'food', 'lab', 'rack'];
    level.glitchSols.forEach(function (sol) {
      s.glitchPlan[sol] = { machine: pool.splice(Math.floor(rng() * pool.length), 1)[0], at: s.dayLength * (0.2 + rng() * 0.28) };
    });
    startSol(s);
    return s;
  }

  function startSol(s) {
    s.sol++; s.t = 0; s.night = false; s.dayDone = false;
    var env = s.env[s.sol - 1];
    s.cellsToday = env.cells;
    s.effDecay = { clear: 0.25, dusty: 0.5, storm: 0.9, sun: 0.4, lowsun: 0.4, shadow: 0.4 }[env.kind];
    s.rack.charge += R.morningCells; s.rack.broken = false;
    s.m.comms.on = false; s.m.air.broken = s.m.food.broken = s.m.lab.broken = false;
    var w = s.weather[s.sol - 1];
    s.storm = null;
    if (w && w.level > 0) {
      var start = s.dayLength * (0.3 + s.rng() * 0.36);
      s.storm = { start: start, end: start + R.stormDuration, level: w.level, cls: w.cls, warned: false, active: false, over: false,
        strength: w.strength * 3 * s.site.stormMult * s.level.stormScale };
      s.stats.storms++;
    }
    var gp = s.glitchPlan[s.sol];
    s.glitch = gp ? { machine: gp.machine, at: gp.at, state: 'pending', replyAt: 0, misses: 0, asked: false } : null;
    s.today = { breath: 0, airMade: 0, ice: 0, crates: 0, doseBase: 0, doseStorm: 0, sci: [], cells: {}, bags: 0, late: false, repair: null };
    s.morning = { air: s.air, food: s.food, dose: s.dose, sci: s.sci };
  }

  function env(s) { return s.env[s.sol - 1]; }
  function weather(s) { return s.weather[s.sol - 1] || { level: 0, cls: null, date: null }; }
  function shield(s) { return Math.min(0.9, R.wallBlock + s.bags * R.bagBlock); }
  function warnLead(s) { return (s.m.comms.on ? R.warnDish : R.warnNoDish) + (s.inst.rad ? R.radWarn : 0) + s.level.warnBonus; }
  function stormPhase(s) {
    var st = s.storm; if (!st) return 'none';
    if (st.over) return 'over'; if (st.active) return 'active'; if (st.warned) return 'warning';
    return 'none';
  }
  function machine(s, id) { return id === 'rack' ? s.rack : s.m[id]; }
  function addSci(s, v, text) {
    s.sci += v;
    var list = s.today.sci;
    for (var i = 0; i < list.length; i++) if (list[i].text === text) { list[i].v += v; list[i].n++; return; }
    list.push({ text: text, v: v, n: 1 });
  }

  // ---------- one slice of time ----------
  // ctx: { outside, sprint, driving }. Returns a list of things that just happened.
  function tick(s, dt, ctx) {
    var ev = [];
    if (s.over || s.night || s.dayDone) return ev;
    var D = s.dayLength, m = s.m, t0 = s.t;
    s.t = Math.min(D, s.t + dt); dt = s.t - t0;

    var breath = s.level.airDrain / D * dt * (ctx.outside && ctx.sprint ? R.sprintAir : 1);
    s.air = Math.max(0, s.air - breath); s.today.breath += breath;

    var sf = shield(s);
    var base = s.site.doseDay / D * dt * (ctx.outside ? 1 : 1 - sf);
    s.dose += base; s.today.doseBase += base;

    var st = s.storm;
    if (st) {
      if (!st.warned && s.t >= st.start - warnLead(s)) { st.warned = true; ev.push({ type: 'storm', phase: 'warning' }); }
      var o = Math.max(0, Math.min(s.t, st.end) - Math.max(t0, st.start));
      if (o > 0) {
        if (!st.active) { st.active = true; ev.push({ type: 'storm', phase: 'active' }); }
        var got = st.strength / R.stormDuration * o * (ctx.outside ? 1 : 1 - sf);
        s.dose += got; s.today.doseStorm += got;
        if (ctx.outside) s.stats.stormOut += o;
      }
      if (!st.over && s.t >= st.end) { st.over = true; st.active = false; ev.push({ type: 'storm', phase: 'over' }); }
    }

    // solar rack: the panels fill one power cell after another
    var rk = s.rack, i;
    if (!rk.broken && s.t <= D * R.chargeSpan) {
      rk.charge += Math.max(0, s.cellsToday - R.morningCells) / (D * R.chargeSpan) * ((rk.eff[0] + rk.eff[1] + rk.eff[2]) / 3) * dt;
    }
    while (rk.charge >= 1 && rk.cells < R.rackMax) { rk.charge -= 1; rk.cells++; ev.push({ type: 'cell' }); }
    if (rk.cells >= R.rackMax) rk.charge = Math.min(rk.charge, 0.98);
    for (i = 0; i < 3; i++) rk.eff[i] = Math.max(R.effMin, rk.eff[i] - s.effDecay / D * dt);

    // air maker: electricity splits melted ice into oxygen
    var a = m.air;
    if (!a.broken && a.queue > 0 && a.power > 0) {
      a.prog += dt / R.iceTime;
      if (a.prog >= 1) {
        a.prog = 0; a.queue--; a.power--;
        s.air = Math.min(100, s.air + R.airPerIce); s.today.airMade += R.airPerIce;
        ev.push({ type: 'air', amount: R.airPerIce });
        if (a.power === 0) ev.push({ type: 'empty', machine: 'air' });
      }
    }

    // greenhouse: plants need light AND water
    var f = m.food, growing = false;
    var lit = f.lamp > 0;
    f.lamp = Math.max(0, f.lamp - dt / D);
    if (lit && f.lamp === 0) ev.push({ type: 'empty', machine: 'food' });
    if (!f.broken && lit && f.water > 0) {
      for (i = 0; i < f.beds.length; i++) {
        var b = f.beds[i];
        if (b.state !== 'growing') continue;
        growing = true;
        b.g += dt / (R.growSols * D);
        if (b.g >= 1) { b.g = 1; b.state = 'ripe'; ev.push({ type: 'ripe', bed: i }); }
      }
      if (growing) f.water = Math.max(0, f.water - dt / (D * R.waterSols));
    }

    var bg = m.bag;
    if (!bg.broken && bg.pending > 0) {
      bg.timer -= dt;
      if (bg.timer <= 0) { bg.timer = R.bagInterval; bg.pending--; ev.push({ type: 'bag' }); }
    }

    var lab = m.lab;
    if (!lab.broken && lab.queue.length && lab.power > 0) {
      lab.prog += dt / R.analyzeTime;
      if (lab.prog >= 1) {
        lab.prog = 0; lab.power--;
        ev.push({ type: 'discovery', find: discover(s, lab.queue.shift()) });
        if (lab.power === 0) ev.push({ type: 'empty', machine: 'lab' });
      }
    }

    if (ctx.driving) { m.rover.charge = Math.max(0, m.rover.charge - dt); s.stats.drive += dt; }

    var g = s.glitch;
    if (g && g.state === 'pending' && s.t >= g.at) { g.state = 'broken'; machine(s, g.machine).broken = true; ev.push({ type: 'break', machine: g.machine }); }
    if (g && g.state === 'asked' && s.t >= g.replyAt) { g.state = 'advised'; ev.push({ type: 'advice', machine: g.machine }); }

    if (s.air <= 0) ev.push({ type: 'fail', reason: 'air' });
    else if (s.dose >= 100) ev.push({ type: 'fail', reason: 'dose' });
    else if (s.t >= D) { s.dayDone = true; ev.push({ type: 'dayEnd' }); }
    return ev;
  }

  // ---------- things the astronaut does ----------
  function takeCell(s) { if (s.rack.cells <= 0) return false; s.rack.cells--; return true; }
  function plug(s, id) {
    var m = s.m;
    if (id === 'air') { if (m.air.power > R.airCharges) return no('The Air Maker is already charged up.'); m.air.power += R.airCharges; }
    else if (id === 'food') { if (m.food.lamp > 1) return no('The grow lamps are already charged up.'); m.food.lamp += 1; }
    else if (id === 'bag') {
      if (s.bags + m.bag.pending >= R.shieldSlots) return no('The dome is fully covered. No more bags needed!');
      m.bag.pending += R.bagsPerCell; m.bag.timer = 0.8;
    }
    else if (id === 'lab') { if (m.lab.power > R.labCharges) return no('The Lab is already charged up.'); m.lab.power += R.labCharges; }
    else if (id === 'comms') { if (m.comms.on) return no('The Radio Dish is already on today.'); m.comms.on = true; }
    else if (id === 'rover') { if (m.rover.charge > R.roverMax - 30) return no('The rover battery is full.'); m.rover.charge = Math.min(R.roverMax, m.rover.charge + R.roverPerCell); }
    else return no('That does not fit there.');
    s.today.cells[id] = (s.today.cells[id] || 0) + 1; s.stats.cells++;
    return OK;
  }
  function feedIce(s, id) {
    if (id === 'air') { if (s.m.air.queue >= R.hopperMax) return no('The Air Maker hopper is full. Give it a power cell so it can work!'); s.m.air.queue++; }
    else { if (s.m.food.water > 1.6) return no('The water tank is full.'); s.m.food.water += 1; }
    s.today.ice++; s.stats.ice++;
    return OK;
  }
  function addBag(s) {
    if (s.bags >= R.shieldSlots) return no('The dome is fully covered!');
    s.bags++; s.today.bags++;
    return OK;
  }
  function plant(s, i) { var b = s.m.food.beds[i]; if (b.state !== 'empty') return false; b.state = 'growing'; b.g = 0; return true; }
  function harvest(s, i) { var b = s.m.food.beds[i]; if (b.state !== 'ripe') return false; b.state = 'empty'; b.g = 0; return true; }
  function storeCrate(s) { s.food = Math.min(100, s.food + R.foodPerCrate); s.today.crates++; s.stats.crates++; return OK; }
  function coresLeft(s, i) { return 2 - s.cores[i]; }
  function drillCore(s, i, quality) { var core = { site: i, n: s.cores[i], quality: quality }; s.cores[i]++; s.stats.cores++; return core; }
  function submitCore(s, core) { if (s.m.lab.queue.length >= R.labQueue) return no('The Lab tray is full. It needs a power cell to study the cores.'); s.m.lab.queue.push(core); return OK; }
  function discover(s, core) {
    var site = JA.GEO[s.site.id][core.site], f = site.finds[core.n] || site.finds[0];
    var pts = R.corePts[core.quality];
    var find = { title: f.title, text: f.text, src: f.src, pts: pts, quality: core.quality, place: site.name, icon: site.icon, sol: s.sol, kind: 'core' };
    s.finds.push(find);
    addSci(s, pts, 'Rock core studied');
    return find;
  }
  function deploy(s, id) {
    if (s.inst[id]) return null;
    var def = JA.INSTRUMENTS[s.site.id].filter(function (x) { return x.id === id; })[0];
    s.inst[id] = true;
    addSci(s, R.instPts, 'Instrument set up');
    var find = { title: def.name + ' is working!', text: def.text, src: def.src, pts: R.instPts, perk: def.perk, icon: def.icon, sol: s.sol, kind: 'inst' };
    s.finds.push(find);
    return find;
  }
  function photo(s, i) {
    if (s.photos[i]) return null;
    var def = JA.PHOTOS[s.site.id][i];
    s.photos[i] = true;
    addSci(s, R.photoPts, 'Postcard photo');
    var find = { title: 'Postcard: ' + def.name, text: def.text, src: def.src, pts: R.photoPts, icon: '📸', sol: s.sol, kind: 'photo' };
    s.finds.push(find);
    return find;
  }
  function trick(s, dist) { s.stats.tricks++; s.stats.bestThrow = Math.max(s.stats.bestThrow, dist); addSci(s, R.trickPts, 'Trick shots'); }
  function servicePanel(s, i) { s.rack.eff[i] = 1; }
  function cleanAllPanels(s) { s.rack.eff = [1, 1, 1]; }

  // ---------- repairs and the radio delay ----------
  function commInfo(s) {
    if (s.site.id === 'moon') return { oneWay: '1.3 seconds', round: 'about 3 seconds', wait: 3, minutes: 0 };
    var date = weather(s).date || new Date().toISOString().slice(0, 10);
    var one = JA.weather.marsDelayMin(date), round = one * 2;
    return { oneWay: 'about ' + Math.round(one) + ' minutes', round: 'about ' + Math.round(round) + ' minutes', wait: clamp(round * 1.4, 14, 60), minutes: Math.round(round) };
  }
  function askEarth(s) {
    var g = s.glitch;
    if (!g || g.state !== 'broken') return no('');
    if (!s.m.comms.on) return no('The Radio Dish has no power today, so you cannot call Earth.');
    var info = commInfo(s);
    g.state = 'asked'; g.asked = true; g.replyAt = s.t + info.wait;
    return { ok: true, info: info };
  }
  function repairMiss(s) { s.glitch.misses++; s.rack.charge = Math.max(0, s.rack.charge - 0.5); }
  function repairDone(s) {
    var g = s.glitch;
    machine(s, g.machine).broken = false;
    g.state = 'fixed'; s.stats.repairs++;
    s.today.repair = { machine: g.machine, misses: g.misses, asked: g.asked };
  }

  // ---------- night ----------
  function endSol(s, info) {
    info = info || {};
    var L = s.level, t = s.today, ev = [], last = s.sol >= s.totalSols;
    if (info.late) { s.air = Math.max(0, s.air - R.lateAir); t.late = true; }
    // if you turned in early, the rest of the day still passes (safely indoors)
    var guard = 0;
    while (s.t < s.dayLength && !s.dayDone && guard++ < 2000) ev = ev.concat(tick(s, 0.5, { outside: false }));
    s.dayDone = true;
    var sf = shield(s), dinner = 0, night = 0;
    if (!last) {
      dinner = L.dinner; s.food -= dinner;
      night = s.site.doseNight * (1 - sf); s.dose += night;
      if (s.glitch && s.glitch.state !== 'fixed' && s.glitch.state !== 'pending') { machine(s, s.glitch.machine).broken = false; s.glitch.state = 'fixed'; t.repair = { machine: s.glitch.machine, overnight: true }; }
    }
    var lines = [];
    lines.push({ res: 'air', icon: '💨', parts: [
      t.airMade ? { text: 'Air Maker turned ice into oxygen', v: t.airMade } : { text: 'Air Maker made nothing', v: 0 },
      { text: 'Crew breathing', v: -Math.round(t.breath) },
      t.late ? { text: 'Late rush home', v: -R.lateAir } : null
    ].filter(Boolean) });
    lines.push({ res: 'food', icon: '🥬', parts: [
      t.crates ? { text: t.crates + ' veggie crate' + (t.crates > 1 ? 's' : '') + ' stored', v: t.crates * R.foodPerCrate } : { text: 'No harvest today', v: 0 },
      dinner ? { text: 'Crew dinner', v: -dinner } : null
    ].filter(Boolean) });
    lines.push({ res: 'dose', icon: '☢️', parts: [
      { text: 'Everyday radiation', v: r1(t.doseBase) },
      t.doseStorm >= 0.05 ? { text: 'Solar storm', v: r1(t.doseStorm) } : null,
      night ? { text: 'Night (shield blocked ' + Math.round(sf * 100) + '%)', v: r1(night) } : null
    ].filter(Boolean) });
    lines.push({ res: 'sci', icon: '⭐', parts: t.sci.length ? t.sci.map(function (x) { return { text: x.text + (x.n > 1 ? ' ×' + x.n : ''), v: x.v }; }) : [{ text: 'No mission points today', v: 0 }] });

    var fail = null;
    if (s.air <= 0) fail = 'air'; else if (s.food < 0) fail = 'food'; else if (s.dose >= 100) fail = 'dose';
    s.food = clamp(s.food, 0, 100);
    var report = {
      sol: s.sol, lines: lines, before: s.morning, after: { air: s.air, food: s.food, dose: s.dose, sci: s.sci },
      fail: fail, last: last, events: ev, fact: pickFact(s), repair: t.repair,
      finds: s.finds.filter(function (f) { return f.sol === s.sol; }), forecast: null, shield: sf
    };
    if (!fail && !last) {
      var e2 = s.env[s.sol], w2 = s.weather[s.sol] || null;
      if (s.m.comms.on) report.forecast = { env: e2, weather: w2, full: true };
      else if (s.inst.beam && s.site.id === 'mars') report.forecast = { env: e2, weather: null, full: false };
    }
    s.forecast = s.m.comms.on;
    s.night = true;
    s.log.push(report);
    if (fail) s.over = { type: 'fail', reason: fail };
    return report;
  }

  // The crew lifts off. Bonus points for a healthy crew and for bringing the samples home.
  function finish(s) {
    var bonus = [];
    if (s.caseLoaded) { s.sci += R.casePts; bonus.push({ text: 'Rock samples on their way to Earth', v: R.casePts }); }
    var health = Math.max(0, Math.round((100 - s.dose) / 4));
    s.sci += health; bonus.push({ text: 'Healthy crew bonus', v: health });
    s.over = { type: 'win', bonus: bonus };
    return bonus;
  }

  function pickFact(s) {
    var tags = [], t = s.today, e = env(s).kind;
    if (t.repair) tags.push('repair');
    if (weather(s).level > 0) tags.push('storm');
    if (e === 'storm' || e === 'dusty') tags.push('dust');
    if (e === 'shadow' || e === 'lowsun') tags.push('power');
    if (t.ice) tags.push('ice');
    if (t.bags) tags.push('shield');
    if (t.cells.rover) tags.push('rover');
    if (t.sci.length) tags.push('science');
    if (t.cells.comms) tags.push('comms');
    if (t.crates || t.cells.food) tags.push('food');
    if (t.airMade) tags.push('air');
    tags.push('dose', 'any');
    for (var i = 0; i < tags.length; i++) {
      var list = JA.FACTS.filter(function (f) { return !s.seenFacts[f.id] && (f.site === 'any' || f.site === s.site.id) && f.tags.indexOf(tags[i]) >= 0; });
      if (list.length) { var f = list[Math.floor(s.rng() * list.length)]; s.seenFacts[f.id] = 1; return f; }
    }
    return JA.FACTS[0];
  }

  function rankFor(s) { var best = JA.RANKS[0]; JA.RANKS.forEach(function (r, i) { if (s.sci >= s.level.rankMins[i]) best = r; }); return best; }
  function nextRank(s) {
    for (var i = 0; i < JA.RANKS.length; i++) if (s.sci < s.level.rankMins[i]) return { rank: JA.RANKS[i], need: s.level.rankMins[i] };
    return null;
  }
  function badges(s) {
    var b = [];
    if (s.stats.storms && s.stats.stormOut < 1) b.push({ icon: '⚡', name: 'Storm Dodger', text: 'Never caught outside in a solar storm' });
    if (s.bags >= R.shieldSlots) b.push({ icon: '🛡️', name: 'Shield Master', text: 'Covered the whole dome in soil bags' });
    if (s.stats.crates >= 4) b.push({ icon: '🥕', name: 'Space Farmer', text: 'Harvested ' + s.stats.crates + ' veggie crates' });
    if (s.stats.cores >= 6) b.push({ icon: '🪨', name: 'Rock Hound', text: 'Drilled ' + s.stats.cores + ' rock cores' });
    if (s.inst.seismo && s.inst.beam && s.inst.rad) b.push({ icon: '🛰️', name: 'Science Station', text: 'Set up all three instruments' });
    if (s.stats.bestThrow >= 15) b.push({ icon: '🎯', name: 'Sharpshooter', text: 'Landed a throw from ' + Math.round(s.stats.bestThrow) + ' m away' });
    if (s.stats.drive >= 150) b.push({ icon: '🚙', name: 'Road Tripper', text: 'Drove the rover for ' + Math.round(s.stats.drive) + ' seconds' });
    if (s.dose < 40) b.push({ icon: '💚', name: 'Healthy Crew', text: 'Kept radiation under 40%' });
    return b;
  }

  // BOLT's advice: the most urgent thing right now.
  function hint(s) {
    var m = s.m, L = s.level, left = (s.dayLength - s.t) / s.dayLength;
    var airNeed = L.airDrain * left;
    if (s.glitch && s.glitch.state === 'broken') return 'Something is broken! Look for the sparks and fix it.';
    if (s.air < airNeed + 8) {
      if (m.air.queue > 0 && m.air.power === 0) return 'The Air Maker has ice but no power. Bring it a power cell!';
      if (m.air.power > 0 && m.air.queue === 0) return 'The Air Maker is powered but hungry. Bring ice from the ' + s.site.iceName + '!';
      if (m.air.power === 0) return 'Air is running low. The Air Maker needs a power cell and ice.';
    }
    var beds = m.food.beds, planted = beds.filter(function (b) { return b.state !== 'empty'; }).length;
    var ripe = beds.filter(function (b) { return b.state === 'ripe'; }).length;
    if (ripe) return 'Veggies are ripe! Pick them and carry the crate to the food hatch on the dome.';
    if (s.food < L.dinner * 2 && s.sol < s.totalSols) {
      if (!planted) return 'Food is getting low. Plant seeds in the Greenhouse beds.';
      if (m.food.lamp <= 0) return 'The plants are in the dark. The Greenhouse needs a power cell for its lamps.';
      if (m.food.water <= 0) return 'The plants are thirsty. Drop an ice chunk in the Greenhouse water tank.';
    }
    if (s.storm && !s.storm.warned && s.forecast && s.bags < 8 && s.storm.level >= 2) return 'A solar storm is forecast today. Soil bags on the dome will protect the crew!';
    if (s.dose > 55 && s.bags < R.shieldSlots) return 'The radiation badge is filling up. More soil bags on the dome would slow it down.';
    if (s.rack.cells >= R.rackMax) return 'The Solar Rack is full, so the panels are wasting sunshine. Use those power cells!';
    if (Math.min(s.rack.eff[0], s.rack.eff[1], s.rack.eff[2]) < 0.7) return s.site.id === 'mars' ? 'Dust is covering the solar panels. Brush them off to charge faster.' : 'The Sun has moved. Turn the solar panels to face it again.';
    if (left < 0.14) return 'The shift is almost over. Head back to the airlock!';
    return '';
  }

  JA.sim = {
    rng32: rng32, newGame: newGame, startSol: startSol, env: env, weather: weather, shield: shield, warnLead: warnLead, stormPhase: stormPhase,
    tick: tick, takeCell: takeCell, plug: plug, feedIce: feedIce, addBag: addBag, plant: plant, harvest: harvest, storeCrate: storeCrate,
    coresLeft: coresLeft, drillCore: drillCore, submitCore: submitCore, deploy: deploy, photo: photo, trick: trick,
    servicePanel: servicePanel, cleanAllPanels: cleanAllPanels, commInfo: commInfo, askEarth: askEarth, repairMiss: repairMiss, repairDone: repairDone,
    endSol: endSol, finish: finish, rankFor: rankFor, nextRank: nextRank, badges: badges, hint: hint, addSci: addSci
  };
})(window.JA);
