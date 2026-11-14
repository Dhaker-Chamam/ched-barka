/* Astro Outpost — inside the habitat and inside the rocket.
   Walk through the airlock and you are really inside: bunks, a galley table, plants under pink
   grow lights, the control console, an exercise bike, spare spacesuits, a water tank, and windows
   and a skylight that look out at the real sky. The rocket has a small cockpit with two crew seats
   and an instrument panel under its window. Each thing you walk up to tells a real fact about
   living in space.
   game.js decides when you go in or out; this file builds the rooms and tells the game where the
   floor, walls, ceiling and furniture are. The rooms sit inside the real buildings, so the windows
   show the real outpost outside. */
(function (JA) {
  'use strict';
  var T = window.THREE, W = JA.world, B = JA.base;
  var I = JA.interior = { current: null };
  if (!T) return;

  var HAB_R = 4.6, HAB_FLOOR = 1.3;                  // inner radius of the dome; floor height above the ground
  var RK_R = 2.3, RK_FLOOR = 9.9, RK_TOP = 14.6;      // the rocket cabin, in the rocket's own coordinates
  var HAB_WINDOWS = [-1.25, -0.55, 0.55, 2.4, 3.6];   // the same angles as the dome's windows in base.js
  var rooms = {}, light = null, blob = null, site = 'moon', clock = 0, redrawAt = 0, used = {};
  var v1 = new T.Vector3(), v2 = new T.Vector3();

  // Real facts, one for each thing you can walk up to.
  var FACTS = {
    bed: 'On the Moon and Mars there is gravity, so a bed works. On the Space Station astronauts sleep in sleeping bags tied to the wall, so they do not float around in the night.',
    plants: 'Astronauts on the Space Station have grown lettuce, radishes and even chilli peppers under pink LED lights. Plants only need the red and blue parts of light, so that is all the lamps give them.',
    bike: 'Astronauts exercise about two hours every day. In low gravity muscles and bones get weaker if you do not use them, so exercise is part of the job.',
    suits: 'A spacesuit is like a tiny spaceship you wear. It gives you air, keeps you warm or cool, and protects you from dust and from the Sun\'s rays.',
    water: 'On the Space Station about 98 out of every 100 drops of water are recycled, even sweat and urine, and cleaned until they are drinking water again. Water is too heavy to ship from Earth every day.',
    table: 'Space food comes in pouches and cans. Astronauts add water to dried food, and they eat tortillas instead of bread because tortillas make no crumbs.',
    window: 'Look up! The skylight and windows show the real sky. On the Moon the sky is black even in daytime, because there is no air to scatter the sunlight.',
    seat: 'Astronauts launch lying on their backs, in seats shaped to fit their bodies, so the huge push of the rocket spreads over their whole back.',
    panel: 'A spacecraft has several computers that check each other\'s work. If one makes a mistake, the others notice and take over.',
    plush: 'Crews often bring a small soft toy. When it starts to float, everyone knows they have reached space! It is called a zero-g indicator.'
  };
  I.fact = function (id) { return FACTS[id] || ''; };

  // ---------- small helpers ----------
  function lerp(a, b, t) { return a + (b - a) * t; }
  function tex(w, h, draw) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d'); draw(ctx, w, h);
    var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4;
    t.userData = { canvas: c, ctx: ctx };
    return t;
  }
  function std(color, o) { return new T.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.65, metalness: 0.05 }, o || {})); }
  function add(parent, geo, m, x, y, z) { return W.add(parent, geo, m, x, y, z, true); }
  function box(w, h, d) { return new T.BoxGeometry(w, h, d); }
  function cyl(a, b, h, n) { return new T.CylinderGeometry(a, b, h, n || 16); }
  function ball(r, a, b) { return new T.SphereGeometry(r, a || 14, b || 10); }
  function ellipse(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  var FONT = "'Exo 2', 'Lexend', 'Trebuchet MS', sans-serif";   // the game's title font (assets/fonts)

  // A round window cut out of a wall texture, with a frame around it.
  function porthole(ctx, cx, cy, rx, ry, w) {
    [-w, 0, w].forEach(function (dx) {
      ctx.fillStyle = '#6f7891'; ellipse(ctx, cx + dx, cy, rx + 14, ry + 16); ctx.fill();
      ctx.fillStyle = '#b4bccd'; ellipse(ctx, cx + dx, cy, rx + 6, ry + 7); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ellipse(ctx, cx + dx, cy, rx, ry); ctx.fill(); ctx.restore();
    });
  }

  // ---------- the habitat ----------
  function habWall(ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h), k, x;
    g.addColorStop(0, '#f6f8fc'); g.addColorStop(0.75, '#e2e7f0'); g.addColorStop(1, '#cfd5e2');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(110, 124, 156, 0.4)'; ctx.lineWidth = 3;
    for (k = 0; k < 24; k++) { x = k / 24 * w; ctx.beginPath(); ctx.moveTo(x, h * 0.12); ctx.lineTo(x, h * 0.88); ctx.stroke(); }
    [0.32, 0.52, 0.74].forEach(function (v) { ctx.beginPath(); ctx.moveTo(0, v * h); ctx.lineTo(w, v * h); ctx.stroke(); });
    ctx.fillStyle = 'rgba(110, 124, 156, 0.5)';                      // little rivets where the seams cross
    for (k = 0; k < 24; k++) [0.32, 0.52, 0.74].forEach(function (v) { ellipse(ctx, k / 24 * w, v * h, 3, 3); ctx.fill(); });
    ctx.fillStyle = '#3d7dff'; ctx.fillRect(0, h * 0.875, w, h * 0.028);
    ctx.fillStyle = '#c0c7d6'; ctx.fillRect(0, h * 0.903, w, h * 0.097);
    ctx.fillStyle = 'rgba(70, 80, 104, 0.35)';                       // vents along the floor
    for (k = 0; k < 12; k++) { x = (k + 0.5) / 12 * w; for (var j = 0; j < 4; j++) ctx.fillRect(x - 22, h * 0.93 + j * 7, 44, 3); }
    HAB_WINDOWS.forEach(function (a) {
      var u = (((a + Math.PI / 2) / (Math.PI * 2)) % 1 + 1) % 1;
      porthole(ctx, u * w, h * 0.6, 34, 56, w);
    });
    // the skylight at the very top
    ctx.fillStyle = '#6f7891'; ctx.fillRect(0, h * 0.075, w, h * 0.04);
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillRect(0, 0, w, h * 0.08); ctx.restore();
  }
  function habFloor(ctx, w) {
    var c = w / 2, k, a;
    ctx.fillStyle = '#394155'; ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = 'rgba(120, 136, 172, 0.35)'; ctx.lineWidth = 2;
    for (k = -12; k <= 12; k++) {
      for (var j = -12; j <= 12; j++) {                              // hexagon tiles
        var x = c + k * 44 + (j % 2 ? 22 : 0), y = c + j * 38;
        ctx.beginPath();
        for (a = 0; a < 6; a++) { var t = a / 6 * Math.PI * 2 + Math.PI / 6; ctx.lineTo(x + Math.cos(t) * 24, y + Math.sin(t) * 24); }
        ctx.closePath(); ctx.stroke();
      }
    }
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 10; ellipse(ctx, c, c, w * 0.17, w * 0.17); ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 210, 63, 0.45)'; ctx.lineWidth = 4; ellipse(ctx, c, c, w * 0.2, w * 0.2); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.font = '700 30px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ASTRO OUTPOST', c, c);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; ctx.fillRect(0, 0, w, 6);
  }
  function patchTex(ctx, w) {
    var c = w / 2;
    ctx.fillStyle = '#1b2350'; ellipse(ctx, c, c, c - 6, c - 6); ctx.fill();
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 12; ellipse(ctx, c, c, c - 12, c - 12); ctx.stroke();
    ctx.fillStyle = site === 'mars' ? '#d9774a' : '#b9bac6'; ellipse(ctx, c, w * 0.95, w * 0.62, w * 0.3); ctx.fill();
    ctx.fillStyle = '#4aa3ff'; ellipse(ctx, w * 0.72, w * 0.3, 26, 26); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(c, w * 0.18); ctx.lineTo(c + 28, w * 0.5); ctx.lineTo(c - 28, w * 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff5f6d'; ctx.fillRect(c - 28, w * 0.5, 56, 50);
    ctx.fillStyle = '#ffd23f'; ctx.font = '700 34px ' + FONT; ctx.textAlign = 'center';
    ctx.fillText('ASTRO OUTPOST', c, w * 0.8);
  }
  function screen(parent, w, h, x, y, z, ry) {
    var t = tex(512, 320, function () {}), m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: t, toneMapped: false }));
    m.position.set(x, y, z); m.rotation.y = ry || 0; parent.add(m);
    add(parent, box(w + 0.08, h + 0.08, 0.04), std(0x232a3d), x - Math.sin(ry || 0) * 0.03, y, z - Math.cos(ry || 0) * 0.03).rotation.y = ry || 0;
    return t;
  }
  function suit(parent, x, y, z, color) {
    var white = std(0xf2f3f7), g = new T.Group(); g.position.set(x, y, z); parent.add(g);
    add(g, new T.CapsuleGeometry(0.28, 0.5, 4, 10), white, 0, 0.75, 0);
    add(g, ball(0.27), white, 0, 1.38, 0);
    var v = add(g, ball(0.21), std(0xffc64a, { metalness: 0.9, roughness: 0.15 }), 0, 1.38, 0.1); v.scale.set(1, 0.8, 0.8);
    add(g, new T.TorusGeometry(0.24, 0.05, 6, 16), std(color), 0, 1.1, 0).rotation.x = Math.PI / 2;
    [-0.36, 0.36].forEach(function (s) { add(g, new T.CapsuleGeometry(0.09, 0.42, 4, 8), white, s, 0.72, 0); });
    [-0.13, 0.13].forEach(function (s) { add(g, new T.CapsuleGeometry(0.1, 0.4, 4, 8), white, s, 0.12, 0); });
    return g;
  }

  function buildHab(parentG) {
    var g = new T.Group(), F = HAB_FLOOR, room = { id: 'hab', group: g, screens: [], spin: [] };
    g.visible = false; parentG.add(g);
    var wallM = new T.MeshStandardMaterial({ map: tex(1024, 512, habWall), side: T.BackSide, alphaTest: 0.5, roughness: 0.85 });
    add(g, new T.SphereGeometry(HAB_R, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), wallM, 0, F, 0);
    var floor = add(g, new T.CircleGeometry(HAB_R, 48), std(0xffffff, { map: tex(512, 512, habFloor), roughness: 0.8 }), 0, F + 0.01, 0);
    floor.rotation.x = -Math.PI / 2;
    // a ring of light under the skylight
    add(g, new T.TorusGeometry(1.35, 0.07, 8, 44), W.glow(0xfff4dc, 1.6), 0, F + 3.95, 0).rotation.x = Math.PI / 2;
    [0, 1, 2, 3].forEach(function (k) { var a = k * Math.PI / 2; add(g, cyl(0.012, 0.012, 0.3, 4), std(0x8a93a8), Math.sin(a) * 1.35, F + 4.1, Math.cos(a) * 1.35); });
    // ---- the airlock door (south)
    var dark = std(0x4c5468), steel = std(0x8d96aa, { metalness: 0.4 }), yellow = std(0xffd23f);
    add(g, box(1.9, 2.6, 0.22), steel, 0, F + 1.3, 3.95);
    add(g, box(1.4, 2.2, 0.12), dark, 0, F + 1.12, 3.86);
    var port = add(g, cyl(0.24, 0.24, 0.05, 20), W.glow(0x9fe8ff, 0.8), 0, F + 1.6, 3.79); port.rotation.x = Math.PI / 2;
    add(g, box(1.6, 0.1, 0.06), yellow, 0, F + 0.2, 3.8); add(g, box(1.6, 0.1, 0.06), yellow, 0, F + 2.1, 3.8);
    room.doorLight = add(g, box(0.9, 0.12, 0.08), W.glow(0x4dff9a, 2), 0, F + 2.3, 3.8);
    var sign = tex(256, 64, function (ctx, w, h) { ctx.fillStyle = '#1c2236'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#4dff9a'; ctx.font = '700 38px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('AIRLOCK', w / 2, h / 2 + 2); });
    var sg = add(g, new T.PlaneGeometry(0.9, 0.22), new T.MeshBasicMaterial({ map: sign, toneMapped: false }), 0, F + 2.55, 3.66); sg.rotation.y = Math.PI;
    // ---- bunk beds (west)
    var frame = std(0xdfe3ec), mattress = std(0x5d6b8c), pillow = std(0xffffff);
    [[-0.55, 0xff8a3d], [0.55, 0x3dd6c4]].forEach(function (b, i) {
      [0.45, 1.55].forEach(function (y, j) {
        add(g, box(0.95, 0.12, 1.0), frame, -3.05, F + y - 0.1, b[0]);
        add(g, box(0.86, 0.14, 0.96), mattress, -3.05, F + y + 0.03, b[0]);
        add(g, box(0.88, 0.08, 0.62), std(j ? b[1] : (i ? 0xff8a3d : 0x3dd6c4)), -3.05, F + y + 0.13, b[0] + 0.15);
        add(g, box(0.5, 0.1, 0.24), pillow, -3.15, F + y + 0.15, b[0] - 0.33);
      });
    });
    [[-3.55, -1.05], [-2.55, -1.05], [-3.55, 1.05], [-2.55, 1.05]].forEach(function (p) { add(g, cyl(0.04, 0.04, 1.9, 6), frame, p[0], F + 0.95, p[1]); });
    add(g, box(0.12, 0.08, 0.12), W.glow(0xffe59a, 2), -2.6, F + 1.95, -0.9);       // a reading light
    // ---- control console (north)
    var desk = std(0x2e3650), top = std(0xdfe3ec);
    add(g, box(2.5, 0.8, 0.7), desk, 0, F + 0.4, -3.6);
    add(g, box(2.6, 0.06, 0.8), top, 0, F + 0.82, -3.55);
    room.screens.push({ id: 'status', t: screen(g, 0.95, 0.6, -0.95, F + 1.35, -3.62, 0.32) });
    room.screens.push({ id: 'earth', t: screen(g, 0.95, 0.6, 0, F + 1.42, -3.82, 0) });
    room.screens.push({ id: 'sun', t: screen(g, 0.95, 0.6, 0.95, F + 1.35, -3.62, -0.32) });
    var lights = std(0x1a2033), k;
    add(g, box(2.2, 0.04, 0.3), lights, 0, F + 0.86, -3.35);
    for (k = 0; k < 10; k++) add(g, box(0.09, 0.03, 0.06), W.glow([0x4dff9a, 0xffd23f, 0x4fd8ff, 0xff6fb1][k % 4], 1.6), -0.9 + k * 0.2, F + 0.89, -3.3);
    var chair = new T.Group(); chair.position.set(0, F, -2.55); g.add(chair);
    add(chair, cyl(0.05, 0.05, 0.45, 8), steel, 0, 0.22, 0);
    add(chair, cyl(0.3, 0.3, 0.08, 18), std(0x3d7dff), 0, 0.48, 0);
    add(chair, box(0.55, 0.55, 0.08), std(0x3d7dff), 0, 0.8, 0.27);
    add(g, cyl(0.32, 0.36, 0.05, 20), W.glow(0x5cf0ff, 0.9), 1.85, F + 0.03, -2.9);   // BOLT's charging pad
    // ---- plants under grow lights (east)
    var shelf = std(0xeceff5), pot = std(0xc77b4a), leaf = std(0x4fd15a), leaf2 = std(0x2fa84a);
    [0.5, 1.15, 1.8].forEach(function (y, row) {
      add(g, box(0.45, 0.05, 2.1), shelf, 3.72, F + y, 0);
      add(g, box(0.06, 0.03, 1.9), W.glow(0xff58d8, 1.8), 3.62, F + y + 0.55, 0);
      for (var p = 0; p < 4; p++) {
        var z = -0.75 + p * 0.5;
        add(g, cyl(0.13, 0.1, 0.18, 10), pot, 3.72, F + y + 0.12, z);
        var bush = add(g, ball(0.17 + ((p + row) % 3) * 0.03, 8, 6), (p + row) % 2 ? leaf : leaf2, 3.72, F + y + 0.3, z);
        bush.scale.y = 0.8; room.spin.push({ m: bush, k: p + row * 4 });
        if ((p + row) % 3 === 0) add(g, ball(0.045, 6, 5), W.glow(0xff4a3a, 0.4), 3.62, F + y + 0.36, z + 0.08);
      }
    });
    [-1.05, 1.05].forEach(function (z) { add(g, box(0.06, 1.9, 0.06), shelf, 3.72, F + 0.95, z); });
    // ---- exercise bike (south-east, by a window)
    var bike = new T.Group(); bike.position.set(2.1, F, 2.05); bike.rotation.y = -Math.PI * 0.75; g.add(bike);
    add(bike, box(0.12, 0.08, 1.1), steel, 0, 0.1, 0);
    add(bike, box(0.08, 0.75, 0.08), steel, 0, 0.45, 0.35);
    add(bike, box(0.32, 0.08, 0.2), std(0x2b3147), 0, 0.85, 0.35);
    add(bike, box(0.08, 0.7, 0.08), steel, 0, 0.45, -0.35);
    add(bike, box(0.5, 0.06, 0.06), std(0x2b3147), 0, 0.82, -0.38);
    var wheel = add(bike, new T.TorusGeometry(0.26, 0.05, 8, 20), std(0xff8a3d), 0, 0.32, -0.15); wheel.rotation.y = Math.PI / 2;
    room.wheel = wheel;
    // ---- spare spacesuits and lockers (north-west)
    var lockers = std(0xc9cfdc);
    add(g, box(1.3, 1.9, 0.5), lockers, -2.85, F + 0.95, -2.05).rotation.y = -Math.PI / 4;
    var s1 = suit(g, -1.85, F, -3.05, 0xff7a3d), s2 = suit(g, -1.1, F, -3.45, 0x3d9bff);
    s1.rotation.y = 0.55; s2.rotation.y = 0.3;
    // ---- water tank and food store (south-west)
    var tank = std(0x3d7dff, { metalness: 0.3, roughness: 0.35 });
    add(g, cyl(0.42, 0.42, 1.9, 20), tank, -2.55, F + 0.95, 2.35);
    add(g, cyl(0.07, 0.07, 1.4, 8), W.glow(0x4fd8ff, 1.4), -2.2, F + 0.9, 2.1);
    add(g, box(0.8, 1.1, 0.4), shelf, -1.6, F + 0.55, 3.15).rotation.y = 0.55;
    for (k = 0; k < 6; k++) add(g, box(0.16, 0.22, 0.1), std([0xff8a3d, 0x7be36a, 0xffd23f][k % 3]), -1.82 + (k % 3) * 0.2, F + 0.55 + Math.floor(k / 3) * 0.4, 3.0 + (k % 3) * 0.1).rotation.y = 0.55;
    // ---- galley table (north-east, by a window)
    var tg = new T.Group(); tg.position.set(1.55, F, -1.35); g.add(tg);
    add(tg, cyl(0.65, 0.65, 0.06, 28), top, 0, 0.78, 0);
    add(tg, cyl(0.07, 0.12, 0.76, 10), steel, 0, 0.38, 0);
    [0, 2.1, 4.2].forEach(function (a) {
      add(tg, cyl(0.2, 0.2, 0.06, 14), std(0xff8a3d), Math.sin(a) * 0.95, 0.48, Math.cos(a) * 0.95);
      add(tg, cyl(0.04, 0.04, 0.45, 6), steel, Math.sin(a) * 0.95, 0.24, Math.cos(a) * 0.95);
      add(tg, box(0.26, 0.04, 0.2), std(0x8fd6ff), Math.sin(a) * 0.42, 0.83, Math.cos(a) * 0.42);       // food trays
    });
    add(tg, cyl(0.06, 0.05, 0.12, 10), std(0xffffff), 0.1, 0.87, 0.1);
    // ---- a mission patch on the wall, and a little rug
    var patch = add(g, new T.PlaneGeometry(0.85, 0.85), new T.MeshBasicMaterial({ map: tex(256, 256, patchTex), transparent: true }), -3.62, F + 2.1, -1.55);
    patch.lookAt(parentG.position.x, parentG.position.y + F + 2.1, parentG.position.z - 1.55);
    var rug = add(g, new T.CircleGeometry(1.0, 36), std(0x6a4fd8, { roughness: 0.95 }), 0, F + 0.02, 0.9); rug.rotation.x = -Math.PI / 2;

    room.colliders = [[-3.05, -0.55, 0.62], [-3.05, 0.55, 0.62], [0, -3.6, 1.15], [0, -2.55, 0.33], [3.75, 0, 1.0],
      [2.1, 2.05, 0.55], [-2.8, -2.1, 0.75], [-1.85, -3.05, 0.35], [-2.55, 2.35, 0.55], [-1.6, 3.15, 0.5], [1.55, -1.35, 0.75]];
    room.spots = [
      { id: 'door', label: 'Go outside', x: 0, z: 3.05, reach: 1.4 },
      { id: 'bed', label: 'Go to sleep (end the day)', x: -2.2, z: 0, reach: 1.3 },
      { id: 'console', label: 'Check the console and Sun Watch', x: 0, z: -2.2, reach: 1.3 },
      { id: 'plants', label: 'Look at the plants', x: 2.8, z: 0, reach: 1.2 },
      { id: 'bike', label: 'Ride the exercise bike', x: 1.45, z: 1.45, reach: 1.0 },
      { id: 'suits', label: 'Look at the spare spacesuits', x: -1.75, z: -2.2, reach: 1.1 },
      { id: 'water', label: 'Check the water tank', x: -1.9, z: 1.75, reach: 1.0 },
      { id: 'table', label: 'Look at the space food', x: 0.75, z: -0.65, reach: 1.0 },
      { id: 'window', label: 'Look up at the sky', x: 0, z: 0, reach: 1.1 }
    ];
    room.spawn = [0, 2.35]; room.face = Math.PI;      // just inside the airlock, facing north into the room
    return room;
  }

  // ---------- the rocket ----------
  function rocketWall(ctx, w, h) {
    var k, x;
    ctx.fillStyle = '#e9edf4'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(110, 124, 156, 0.4)'; ctx.lineWidth = 3;
    for (k = 0; k < 16; k++) { x = k / 16 * w; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    [0.2, 0.46, 0.86].forEach(function (v) { ctx.beginPath(); ctx.moveTo(0, v * h); ctx.lineTo(w, v * h); ctx.stroke(); });
    // switch panels on both side walls
    [0.25, 0.75].forEach(function (u) {
      ctx.fillStyle = '#20273c'; rr(ctx, u * w - 90, h * 0.5, 180, 120, 10); ctx.fill();
      for (var r = 0; r < 4; r++) for (var c = 0; c < 6; c++) {
        ctx.fillStyle = ['#4dff9a', '#ffd23f', '#4fd8ff', '#ff6fb1', '#ffffff'][(r * 6 + c) % 5];
        ctx.fillRect(u * w - 76 + c * 26, h * 0.5 + 14 + r * 26, 14, 10);
      }
    });
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, h * 0.4, w, 10);           // a handrail stripe
    ctx.fillStyle = '#ff5f6d'; ctx.font = '700 22px ' + FONT; ctx.textAlign = 'center';
    ctx.fillText('STOWAGE', w * 0.25, h * 0.15); ctx.fillText('LIFE SUPPORT', w * 0.75, h * 0.15);
    porthole(ctx, w * 0.5, h * (1 - 0.319), 40, 58, w);
    porthole(ctx, w * 0.5, h * (1 - 0.745), 40, 58, w);
  }
  function rocketPanel(ctx, w, h, info) {
    ctx.fillStyle = '#141a2e'; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [[0.18, 'FUEL'], [0.5, 'COURSE HOME'], [0.82, 'CREW']].forEach(function (s, i) {
      var x = s[0] * w;
      ctx.fillStyle = '#0a1a2a'; rr(ctx, x - 150, 26, 300, 190, 14); ctx.fill();
      ctx.strokeStyle = '#4fd8ff'; ctx.lineWidth = 3; rr(ctx, x - 150, 26, 300, 190, 14); ctx.stroke();
      ctx.fillStyle = '#4fd8ff'; ctx.font = '700 26px ' + FONT; ctx.fillText(s[1], x, 54);
      if (i === 0) {
        ctx.fillStyle = '#233149'; ctx.fillRect(x - 110, 110, 220, 40);
        ctx.fillStyle = '#4dff9a'; ctx.fillRect(x - 110, 110, 220, 40);
        ctx.fillStyle = '#fff'; ctx.font = '700 34px ' + FONT; ctx.fillText('100%', x, 182);
      } else if (i === 1) {
        ctx.strokeStyle = '#ffd23f'; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(x - 110, 170); ctx.quadraticCurveTo(x, 60, x + 110, 150); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = info.site === 'mars' ? '#d9774a' : '#b9bac6'; ellipse(ctx, x - 110, 170, 16, 16); ctx.fill();
        ctx.fillStyle = '#4aa3ff'; ellipse(ctx, x + 110, 150, 20, 20); ctx.fill();
      } else {
        ctx.fillStyle = '#fff'; ctx.font = '600 26px ' + FONT;
        ctx.fillText(info.ready ? 'READY TO FLY' : 'LAUNCH ON', x, 110);
        ctx.fillStyle = info.ready ? '#4dff9a' : '#ffd23f'; ctx.font = '700 40px ' + FONT;
        ctx.fillText(info.ready ? 'GO!' : info.dayWord + ' ' + info.last, x, 166);
      }
    });
    for (var k = 0; k < 22; k++) {                                          // a row of buttons
      ctx.fillStyle = ['#4dff9a', '#ffd23f', '#ff6fb1', '#4fd8ff'][k % 4];
      ctx.fillRect(40 + k * (w - 80) / 22, 250, 26, 18);
    }
    ctx.fillStyle = '#ff3b4d'; ellipse(ctx, w / 2, 320, 30, 30); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 18px ' + FONT; ctx.fillText('ABORT', w / 2, 362);
  }
  function rocketFloor(ctx, w) {
    var c = w / 2, k;
    ctx.fillStyle = '#4a5068'; ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = 'rgba(20, 24, 36, 0.55)'; ctx.lineWidth = 3;
    for (k = 0; k < w; k += 24) { ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k, w); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, k); ctx.lineTo(w, k); ctx.stroke(); }
    ctx.fillStyle = '#2b3147'; ellipse(ctx, c, c, 92, 92); ctx.fill();
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 12; ellipse(ctx, c, c, 92, 92); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.font = '700 32px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('HATCH', c, c);
  }
  function rocketCeiling(ctx, w) {
    var c = w / 2;
    ctx.fillStyle = '#dfe3ec'; ctx.fillRect(0, 0, w, w);
    ctx.fillStyle = '#ffffff'; [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]].forEach(function (p) { rr(ctx, p[0] * w - 50, p[1] * w - 20, 100, 40, 10); ctx.fill(); });
    ctx.strokeStyle = '#6f7891'; ctx.lineWidth = 10; ellipse(ctx, c, c * 1.55, 64, 64); ctx.stroke();
  }

  function buildRocket(rk) {
    var g = new T.Group(), F = RK_FLOOR, room = { id: 'rocket', group: g, screens: [], spin: [] };
    g.visible = false; rk.add(g);
    var wall = new T.MeshStandardMaterial({ map: tex(1024, 512, rocketWall), side: T.BackSide, alphaTest: 0.5, roughness: 0.8 });
    add(g, new T.CylinderGeometry(RK_R, RK_R, RK_TOP - F, 40, 1, true, Math.PI), wall, 0, (F + RK_TOP) / 2, 0);
    var fl = add(g, new T.CircleGeometry(RK_R, 40), std(0xffffff, { map: tex(512, 512, rocketFloor) }), 0, F + 0.01, 0); fl.rotation.x = -Math.PI / 2;
    var ce = add(g, new T.CircleGeometry(RK_R, 40), new T.MeshBasicMaterial({ map: tex(512, 512, rocketCeiling), toneMapped: false, color: 0xd8dde8 }), 0, RK_TOP - 0.01, 0); ce.rotation.x = Math.PI / 2;
    // two crew seats facing the window and the instrument panel
    var seatM = std(0x2b3a6b), strap = std(0xff8a3d), steel = std(0x8d96aa, { metalness: 0.4 });
    [-0.72, 0.72].forEach(function (x) {
      var s = new T.Group(); s.position.set(x, F, -0.95); g.add(s);
      add(s, box(0.62, 0.14, 0.75), seatM, 0, 0.5, 0.05);
      var back = add(s, box(0.62, 1.0, 0.14), seatM, 0, 0.98, -0.32); back.rotation.x = -0.35;
      add(s, box(0.4, 0.22, 0.12), seatM, 0, 1.55, -0.52).rotation.x = -0.35;
      [-0.18, 0.18].forEach(function (sx) { var st = add(s, box(0.07, 0.85, 0.02), strap, sx, 0.98, -0.24); st.rotation.x = -0.35; });
      add(s, box(0.1, 0.42, 0.1), steel, 0, 0.22, 0);
    });
    // the instrument panel under the window
    var panelTex = tex(1024, 384, function () {});
    room.panelTex = panelTex;
    add(g, box(2.4, 0.7, 0.5), std(0x232a3d), 0, F + 0.35, 1.85);
    var face = new T.Mesh(new T.PlaneGeometry(2.3, 0.86), new T.MeshBasicMaterial({ map: panelTex, toneMapped: false }));
    face.position.set(0, F + 0.86, 1.62); face.rotation.order = 'YXZ'; face.rotation.set(-0.55, Math.PI, 0); g.add(face);
    // a ladder up to the nose, on the back wall
    [-0.3, 0.3].forEach(function (x) { add(g, box(0.06, RK_TOP - F, 0.06), steel, x, (F + RK_TOP) / 2, -2.12); });
    for (var y = F + 0.4; y < RK_TOP - 0.2; y += 0.4) add(g, box(0.6, 0.04, 0.05), steel, 0, y, -2.12);
    // the zero-g indicator: a little plush astronaut-bear on a string
    var plush = new T.Group(); plush.position.set(0.3, RK_TOP - 1.2, 0.4); g.add(plush);
    add(plush, cyl(0.005, 0.005, 1.0, 4), std(0xffffff), 0, 0.5, 0);
    add(plush, ball(0.13, 10, 8), std(0xc89060), 0, 0, 0);
    add(plush, ball(0.1, 10, 8), std(0xc89060), 0, 0.17, 0);
    [-0.07, 0.07].forEach(function (x) { add(plush, ball(0.04, 6, 5), std(0xc89060), x, 0.26, 0); });
    add(plush, ball(0.07, 8, 6), std(0xffd23f), 0, 0.01, 0.1);
    room.plush = plush;
    // a ceiling light
    add(g, new T.TorusGeometry(0.7, 0.05, 6, 30), W.glow(0xfff4dc, 1.5), 0, RK_TOP - 0.08, 0).rotation.x = Math.PI / 2;

    room.colliders = [[-0.72, -0.95, 0.45], [0.72, -0.95, 0.45], [0, 1.95, 0.62], [0, -2.0, 0.35]];
    room.spots = [
      { id: 'hatch', label: 'Climb down the hatch', x: 0, z: 0.1, reach: 0.75 },
      { id: 'seat', label: 'Sit in the commander\'s seat', x: -0.72, z: -0.35, reach: 0.7 },
      { id: 'panel', label: 'Look at the instrument panel', x: 0, z: 1.05, reach: 0.75 },
      { id: 'plush', label: 'Look at the little bear', x: 0.6, z: 0.3, reach: 0.6 }
    ];
    room.spawn = [0, 0.35]; room.face = 0;          // standing on the hatch, facing the window
    return room;
  }

  // ---------- build ----------
  I.build = function (root, siteId) {
    site = siteId; rooms = {}; I.current = null; used = {};
    var P = B.P;
    if (!P || !P.hab || !P.hab.group || !P.rocket || !P.rocket.group) return;
    root.updateMatrixWorld(true);
    rooms.hab = buildHab(P.hab.group);
    rooms.rocket = buildRocket(P.rocket.group);
    light = new T.PointLight(0xfff1dd, 0, 11, 1); root.add(light);
    blob = new T.Mesh(new T.CircleGeometry(0.5, 20), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.visible = false; root.add(blob);
  };

  // world position of a point given in a room's own coordinates
  function toWorld(room, x, y, z, out) { return room.group.parent.localToWorld(out.set(x, y, z)); }

  // Go in. Returns everything the game needs: the walking room, the camera room, where to stand, which way to face.
  I.enter = function (id) {
    var room = rooms[id]; if (!room) return null;
    var P = B.P, parent = room.group.parent, i;
    parent.updateMatrixWorld(true);
    I.current = room;
    room.group.visible = true;
    (id === 'hab' ? P.hab.windows : P.rocket.windows).forEach(function (w) { w.visible = false; });
    var F = id === 'hab' ? HAB_FLOOR : RK_FLOOR, R = id === 'hab' ? HAB_R : RK_R;
    var c = toWorld(room, 0, F, 0, new T.Vector3());
    var cols = room.colliders.map(function (k) { toWorld(room, k[0], F, k[1], v1); return { x: v1.x, z: v1.z, r: k[2] }; });
    var walk = { cx: c.x, cz: c.z, r: id === 'hab' ? 4.0 : 1.95, floor: c.y, colliders: cols };
    if (id === 'hab') walk.ceil = function (x, z) { var d = Math.hypot(x - c.x, z - c.z); return c.y + Math.sqrt(Math.max(0, R * R - d * d)) - 2.1; };
    else walk.ceil = function () { return c.y + (RK_TOP - RK_FLOOR) - 2.1; };
    var cam = id === 'hab' ? { type: 'dome', cx: c.x, cy: c.y, cz: c.z, r: R - 0.35, floor: c.y + 0.35 }
      : { type: 'cyl', cx: c.x, cz: c.z, r: RK_R - 0.3, floor: c.y + 0.35, top: c.y + (RK_TOP - RK_FLOOR) - 0.3 };
    var spawn = toWorld(room, room.spawn[0], F, room.spawn[1], new T.Vector3());
    // which way "facing into the room" is, in the world
    var ahead = toWorld(room, room.spawn[0], F, room.spawn[1] + (room.face === Math.PI ? -1 : 1), new T.Vector3()).sub(spawn);
    var yaw = Math.atan2(ahead.x, ahead.z);
    light.position.copy(c); light.position.y += id === 'hab' ? 3.9 : 3.8;
    light.intensity = id === 'hab' ? 1.25 : 0.95; light.distance = id === 'hab' ? 11 : 6;
    // BOLT waits on his charging pad in the habitat, and up by the ceiling in the cockpit, out of your view
    var buddy = id === 'hab' ? toWorld(room, 1.85, F + 0.62, -2.9, new T.Vector3()) : toWorld(room, 1.35, F + 3.7, -1.1, new T.Vector3());
    for (i = 0; i < room.screens.length; i++) room.screens[i].drawn = -1;
    redrawAt = 0;
    return { walk: walk, cam: cam, spawn: spawn, yaw: yaw, center: c, buddy: buddy };
  };
  I.leave = function () {
    var P = B.P;
    Object.keys(rooms).forEach(function (k) { rooms[k].group.visible = false; });
    if (P && P.hab && P.hab.windows) P.hab.windows.forEach(function (w) { w.visible = true; });
    if (P && P.rocket && P.rocket.windows) P.rocket.windows.forEach(function (w) { w.visible = true; });
    if (light) light.intensity = 0;
    if (blob) blob.visible = false;
    I.current = null;
  };

  // The things you can walk up to in the room you are in, in world coordinates.
  I.spots = function () {
    var room = I.current; if (!room) return [];
    var F = room.id === 'hab' ? HAB_FLOOR : RK_FLOOR;
    return room.spots.map(function (s) { toWorld(room, s.x, F, s.z, v1); return { id: s.id, label: s.label, x: v1.x, z: v1.z, reach: s.reach }; });
  };
  // Something to do when you use a spot (the bike pedals, the bear spins).
  I.poke = function (id) {
    var room = I.current; if (!room) return;
    if (id === 'bike') room.pedal = 3;
    if (id === 'plush' && room.plush) room.plushSpin = 2.5;
    used[id] = true;
  };

  // ---------- the screens on the console ----------
  function drawStatus(ctx, w, h, s) {
    ctx.fillStyle = '#0b1424'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#4fd8ff'; ctx.font = '700 30px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('OUTPOST STATUS', 24, 34);
    ctx.fillStyle = '#b3bde0'; ctx.font = '600 24px ' + FONT; ctx.textAlign = 'right';
    ctx.fillText(s.site.dayWord + ' ' + s.sol + ' of ' + s.totalSols, w - 24, 34);
    [['AIR', s.air, '#4fd8ff'], ['FOOD', s.food, '#7be36a'], ['RADIATION', s.dose, '#ff6fb1']].forEach(function (r, i) {
      var y = 96 + i * 72, v = Math.max(0, Math.min(100, r[1]));
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '600 24px ' + FONT; ctx.fillText(r[0], 24, y);
      ctx.textAlign = 'right'; ctx.fillText(Math.round(r[1]) + (i === 2 ? '%' : ''), w - 24, y);
      ctx.fillStyle = '#1e2a44'; rr(ctx, 24, y + 18, w - 48, 18, 9); ctx.fill();
      ctx.fillStyle = r[2]; rr(ctx, 24, y + 18, Math.max(18, (w - 48) * v / 100), 18, 9); ctx.fill();
    });
  }
  function drawEarth(ctx, w, h, s) {
    ctx.fillStyle = '#020611'; ctx.fillRect(0, 0, w, h);
    for (var k = 0; k < 60; k++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + (k * 37 % 7) / 10) + ')'; ctx.fillRect((k * 97) % w, (k * 53) % h, 2, 2); }
    var cx = w * 0.32, cy = h * 0.55, r = h * 0.3;
    var g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
    g.addColorStop(0, '#7cc4ff'); g.addColorStop(1, '#1d4fa8');
    ctx.fillStyle = g; ellipse(ctx, cx, cy, r, r); ctx.fill();
    ctx.fillStyle = '#5fbf6a'; ellipse(ctx, cx - r * 0.25, cy - r * 0.1, r * 0.35, r * 0.22); ctx.fill(); ellipse(ctx, cx + r * 0.3, cy + r * 0.3, r * 0.25, r * 0.18); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ellipse(ctx, cx + r * 0.1, cy - r * 0.55, r * 0.5, r * 0.12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 30px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('EARTH', w * 0.6, h * 0.36);
    ctx.fillStyle = '#b3bde0'; ctx.font = '600 22px ' + FONT;
    var info = JA.sim && JA.sim.commInfo ? JA.sim.commInfo(s) : null;
    ctx.fillText('radio: ' + (info ? info.oneWay : '?'), w * 0.6, h * 0.52);
    ctx.fillText(s.m.comms.on ? 'dish ON' : 'dish off', w * 0.6, h * 0.66);
  }
  function drawSun(ctx, w, h, s) {
    ctx.fillStyle = '#1a0b16'; ctx.fillRect(0, 0, w, h);
    var cx = w * 0.26, cy = h * 0.55, r = h * 0.24;
    var g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.6);
    g.addColorStop(0, '#fff6c8'); g.addColorStop(0.45, '#ffb347'); g.addColorStop(1, 'rgba(255,90,40,0)');
    ctx.fillStyle = g; ellipse(ctx, cx, cy, r * 1.6, r * 1.6); ctx.fill();
    var wx = JA.sim && JA.sim.weather ? JA.sim.weather(s) : null, ph = JA.sim ? JA.sim.stormPhase(s) : 'none';
    ctx.fillStyle = '#ffd23f'; ctx.font = '700 28px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('SPACE WEATHER', w * 0.48, h * 0.24);
    ctx.fillStyle = '#fff'; ctx.font = '600 24px ' + FONT;
    var known = s.forecast || ph !== 'none';
    ctx.fillText(ph === 'active' ? 'STORM NOW!' : ph === 'warning' ? 'STORM COMING' : known ? (wx && wx.level ? 'flare ' + wx.cls + ' today' : 'quiet Sun') : 'no forecast', w * 0.48, h * 0.48);
    ctx.fillStyle = '#b3bde0'; ctx.font = '600 20px ' + FONT;
    ctx.fillText('Use me: Sun Watch', w * 0.48, h * 0.72);
  }

  // ---------- every frame ----------
  // ctx: { s, astro }
  I.update = function (dt, ctx) {
    var room = I.current; if (!room) return;
    clock += dt;
    var a = ctx && ctx.astro, s = ctx && ctx.s;
    if (a && blob) {
      var F = room.id === 'hab' ? HAB_FLOOR : RK_FLOOR, floorY = toWorld(room, 0, F, 0, v2).y, up = Math.max(0, a.pos.y - floorY);
      blob.visible = a.mode !== 'hidden';
      blob.position.set(a.pos.x, floorY + 0.025, a.pos.z);
      blob.scale.setScalar(Math.max(0.35, 1 - up * 0.25));
      blob.material.opacity = Math.max(0.08, 0.32 - up * 0.08);
    }
    if (room.wheel) { room.pedal = Math.max(0, (room.pedal || 0) - dt); room.wheel.rotation.x += dt * (room.pedal > 0 ? 9 : 0); }
    room.spin.forEach(function (p) { p.m.rotation.z = Math.sin(clock * 0.8 + p.k) * 0.05; });
    if (room.plush) {
      room.plushSpin = Math.max(0, (room.plushSpin || 0) - dt);
      room.plush.rotation.z = Math.sin(clock * 1.3) * 0.06; room.plush.rotation.y += dt * (room.plushSpin > 0 ? 6 : 0.2);
    }
    if (room.doorLight) room.doorLight.material.emissiveIntensity = 1.6 + Math.sin(clock * 3) * 0.4;
    if (!s || clock < redrawAt) return;
    redrawAt = clock + 1;
    room.screens.forEach(function (sc) {
      var u = sc.t.userData, c = u.canvas;
      if (sc.id === 'status') drawStatus(u.ctx, c.width, c.height, s);
      else if (sc.id === 'earth') { if (sc.drawn === s.sol + (s.m.comms.on ? 0.5 : 0)) return; sc.drawn = s.sol + (s.m.comms.on ? 0.5 : 0); drawEarth(u.ctx, c.width, c.height, s); }
      else drawSun(u.ctx, c.width, c.height, s);
      sc.t.needsUpdate = true;
    });
    if (room.panelTex) {
      var key = s.sol + '/' + s.totalSols;
      if (room.panelKey !== key) {
        room.panelKey = key;
        var pu = room.panelTex.userData;
        rocketPanel(pu.ctx, pu.canvas.width, pu.canvas.height, { site: s.site.id, ready: s.sol >= s.totalSols, dayWord: s.site.dayWord, last: s.totalSols });
        room.panelTex.needsUpdate = true;
      }
    }
  };
})(window.JA);
