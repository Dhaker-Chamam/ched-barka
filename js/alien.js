/* Astro Outpost — the secret space disco.
   A goofy, friendly green alien dances in a hidden corner of the map: on top of the flat mesa
   on Mars, and at the bottom of the far crater on the Moon. Walk close and your radio picks up
   its beat (on the Moon there is no air to carry sound, so it has to come over the radio!).
   Press E next to it and a short dance party starts: a disco saucer with coloured beams and a
   mirror ball, confetti, and a little rhythm game where you copy the alien's moves.
   It is only for fun. It never changes air, food, points or anything else in the mission.
   The alien, its moves and its beat are all made up for this game. */
(function (JA) {
  'use strict';
  function noop() {}
  var AL = JA.alien = { build: noop, update: noop, offer: noop, start: noop, step: function () { return false; }, stop: noop };
  var T = window.THREE;
  if (!T) return;
  var W = JA.world, Tn = JA.terrain, A = JA.actors, B = JA.base;

  // ---------- timing: one bar = 4 beats ----------
  var BPM = 116, BEAT = 60 / BPM, BAR = BEAT * 4, SIX = BEAT / 4;
  var ROUNDS = 10, INTRO_BARS = 2, FIN_BAR = INTRO_BARS + ROUNDS;
  var ENTER = 1.0, END_T = (FIN_BAR + 1) * BAR, OUT_T = END_T + 2.3;      // about 29 seconds in all
  var HINT_R = 35, REACH = 4, MASTER = 0.25;
  var DIRS = ['left', 'up', 'right', 'down'];
  var NAMES = { left: 'Wave to the left!', right: 'Wave to the right!', up: 'Moon hop!', down: 'The robot!' };
  var KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
  var IDLE = ['groove', 'left', 'groove', 'right', 'up', 'groove', 'down', 'spin'];
  var CONFETTI = [0xff4fd8, 0x4fd8ff, 0xffe14f, 0x8dff5a, 0xff8a3d, 0xb18cff];
  // the robot: four stiff poses, one per half beat [arm L forward, arm L out, arm R forward, arm R out, turn, dip]
  var ROBOT = [[-1.57, -0.15, 0, 0.2, 0.35, -0.05], [0, -0.2, -1.57, 0.15, -0.35, -0.05], [-1.57, -0.12, -1.57, 0.12, 0, -0.1], [0, -1.5, 0, 1.5, 0, -0.02]];
  var ARROW = '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="M50 6 L93 50 H66 V94 H34 V50 H7 Z"/></svg>';
  var BYE_QUIT = '👽 Bye-bye, Earthling! Come back and dance any time!';

  var al = null;          // the alien and its disco in the current world
  var st = null;          // the dance in progress
  var idle = { t: 0, on: false, k: 0, muted: false };
  var v1 = new T.Vector3(), v2 = new T.Vector3(), DOWN = new T.Vector3(0, -1, 0), ZAX = new T.Vector3(0, 0, 1);

  function lerp(a, b, t) { return a + (b - a) * t; }
  var mix = lerp;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }
  function angDiff(a, b) { var d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
  function angLerp(a, b, t) { return a - angDiff(a, b) * t; }
  function now() { return window.performance && performance.now ? performance.now() : Date.now(); }
  function warn(e) { if (window.console) console.warn('Astro Outpost alien:', e); }
  function safe(fn) { return function (a, b, c) { try { return fn(a, b, c); } catch (e) { warn(e); return undefined; } }; }
  function soundOn() { return !!(JA.audio && JA.audio.soundOn && JA.audio.soundOn()); }
  function flags(s) { if (!s) return null; if (!s.flags) s.flags = {}; return s.flags; }

  // =====================================================================
  //  WHERE IT HIDES
  // =====================================================================
  function clearAt(x, z, pad) {
    var bs = Tn.boulders || [], cs = (B && B.colliders) || [], co = Tn.L.colony, i;
    for (i = 0; i < bs.length; i++) if (Math.hypot(bs[i].x - x, bs[i].z - z) < bs[i].r + pad) return false;
    for (i = 0; i < cs.length; i++) if (Math.hypot(cs[i].x - x, cs[i].z - z) < cs[i].r + pad) return false;
    return !(co && Math.hypot(co[0] - x, co[1] - z) < 40);          // the colony site stays clear
  }
  function pickSpot(site) {
    var L = Tn.L, list = site === 'mars'
      ? [[L.mesa[0], L.mesa[1]], [L.mesa[0] - 2.5, L.mesa[1] + 1.5], [L.mesa[0] + 2, L.mesa[1] - 2.5]]       // the flat top of the mesa
      : [[-96, -112], [-98.5, -114.5], [-99, -109], [-93, -115]];                                          // the floor of the far crater
    for (var i = 0; i < list.length; i++) if (clearAt(list[i][0], list[i][1], 4.5)) return list[i];
    return list[0];
  }

  // =====================================================================
  //  BUILDING IT (simple shapes, a few small painted textures)
  // =====================================================================
  function textures() {
    var floor = W.canvasTex(256, function (g, s) {
      var c = s / 2, R = [0.17, 0.43, 0.67, 0.88], k, i, a0, a1;
      g.clearRect(0, 0, s, s);
      g.lineWidth = 4; g.strokeStyle = 'rgba(24, 10, 48, 0.95)';
      for (k = 0; k < 3; k++) for (i = 0; i < 12; i++) {
        a0 = i / 12 * Math.PI * 2; a1 = (i + 1) / 12 * Math.PI * 2;
        g.beginPath(); g.arc(c, c, R[k + 1] * c, a0, a1); g.arc(c, c, R[k] * c, a1, a0, true); g.closePath();
        g.fillStyle = 'hsl(' + ((i * 30 + k * 70) % 360) + ', 95%, ' + (i % 2 ? 63 : 52) + '%)';
        g.fill(); g.stroke();
      }
      g.beginPath(); g.arc(c, c, R[0] * c, 0, Math.PI * 2); g.fillStyle = '#fff4c2'; g.fill(); g.stroke();
      var gr = g.createRadialGradient(c, c, R[3] * c, c, c, c);
      gr.addColorStop(0, 'rgba(141, 255, 90, 0)'); gr.addColorStop(0.4, 'rgba(141, 255, 90, 1)'); gr.addColorStop(1, 'rgba(141, 255, 90, 0)');
      g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.arc(c, c, R[3] * c, 0, Math.PI * 2, true); g.fillStyle = gr; g.fill();
    });
    floor.center.set(0.5, 0.5);
    var beam = W.canvasTex(64, function (g, s) {
      var gr = g.createLinearGradient(0, 0, 0, s);
      gr.addColorStop(0, 'rgba(255, 255, 255, 1)'); gr.addColorStop(1, 'rgba(255, 255, 255, 0.12)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    });
    var spot = W.canvasTex(64, function (g, s) {
      var gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(255, 255, 255, 1)'); gr.addColorStop(0.5, 'rgba(255, 255, 255, 0.45)'); gr.addColorStop(1, 'rgba(255, 255, 255, 0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    });
    var note = W.canvasTex(128, function (g) {
      g.clearRect(0, 0, 128, 128);
      g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 10; g.lineCap = 'round';
      g.shadowColor = 'rgba(255, 255, 255, 0.9)'; g.shadowBlur = 8;
      g.beginPath(); g.ellipse(46, 94, 22, 16, -0.45, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(64, 90); g.lineTo(64, 18); g.stroke();
      g.beginPath(); g.moveTo(64, 20); g.quadraticCurveTo(100, 30, 96, 64); g.stroke();
    });
    return { floor: floor, beam: beam, spot: spot, note: note };
  }

  // A round, chubby alien with one big eye, two bobbly antennae, tiny legs and a bow tie. Feet at y = 0, it faces +z.
  function buildAlien(home, sph, moon) {
    var gl = moon ? 0.55 : 0.22;          // a soft glow of its own, so it shows up in the shadow of the crater
    var green = W.soft(0x78d64b, { emissive: 0x2f7a1c, emissiveIntensity: gl });
    var light = W.soft(0xa6ee7a, { emissive: 0x3c8a26, emissiveIntensity: gl });
    var spotM = W.soft(0x4ba834, { emissive: 0x1f5a12, emissiveIntensity: gl });
    var white = W.soft(0xffffff, { roughness: 0.3, emissive: 0x555555, emissiveIntensity: moon ? 0.5 : 0.15 });
    var iris = W.soft(0x8e5bff, { roughness: 0.3, emissive: 0x3a1a90, emissiveIntensity: 0.6 });
    var dark = W.soft(0x1c1030, { roughness: 0.3 });
    var pink = W.soft(0xff9cc6, { emissive: 0xff6aa8, emissiveIntensity: 0.25 });
    var bowM = W.soft(0xff3fa4, { emissive: 0x80104a, emissiveIntensity: 0.4 });
    var gold = W.soft(0xffd23f, { emissive: 0x8a6400, emissiveIntensity: 0.4 });
    var shoe = W.soft(0x7c4dff, { emissive: 0x2a1080, emissiveIntensity: 0.4 });
    var tipM = W.glow(0xff5ad1, 1.6);
    var g = new T.Group(), bod = new T.Group(); g.add(bod);
    function part(par, geo, m, x, y, z, sx, sy, sz, ns) {
      var o = W.add(par, geo, m, x, y, z, ns);
      o.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz);
      return o;
    }
    part(bod, sph, green, 0, 1.12, 0, 0.92, 0.84, 0.88);
    // darker spots on its back, lying flat on the skin
    [[0.45, 0.7, -0.55, 0.14], [-0.55, 0.35, -0.7, 0.17], [0.15, 0.0, -1, 0.12], [-0.25, 0.9, -0.3, 0.1]].forEach(function (q) {
      var l = Math.hypot(q[0], q[1], q[2]), dx = q[0] / l, dy = q[1] / l, dz = q[2] / l;
      var m = part(bod, sph, spotM, dx * 0.92, 1.12 + dy * 0.84, dz * 0.88, q[3], q[3], 0.03, true);
      m.quaternion.setFromUnitVectors(ZAX, v1.set(dx / 0.92, dy / 0.84, dz / 0.88).normalize());
    });
    // one big eye
    var eye = new T.Group(); eye.position.set(0, 1.38, 0.6); bod.add(eye);
    part(eye, sph, white, 0, 0, 0, 0.36);
    var look = new T.Group(); eye.add(look);
    part(look, sph, iris, 0, 0, 0.3, 0.2, 0.2, 0.1);
    part(look, sph, dark, 0, 0, 0.385, 0.1, 0.1, 0.05);
    part(look, sph, W.glow(0xffffff, 1.2), 0.075, 0.085, 0.43, 0.045, 0.045, 0.02, true);
    // a wide smile, pink cheeks and a bow tie
    var mouth = W.add(bod, new T.TorusGeometry(0.19, 0.042, 6, 14, Math.PI), dark, 0, 1.0, 0.85);
    mouth.rotation.set(0.2, 0, Math.PI);
    [-1, 1].forEach(function (s) { part(bod, sph, pink, s * 0.45, 1.1, 0.75, 0.11, 0.07, 0.035, true).rotation.y = s * 0.5; });
    var bow = new T.Group(); bow.position.set(0, 0.7, 0.79); bow.rotation.x = 0.45; bod.add(bow);
    var wing = new T.ConeGeometry(0.13, 0.24, 4);
    [-1, 1].forEach(function (s) { var w = W.add(bow, wing, bowM, s * 0.12, 0, 0); w.rotation.z = s * Math.PI / 2; w.scale.set(1, 1, 0.45); });
    part(bow, sph, gold, 0, 0, 0.02, 0.065);
    // two bobbly antennae with glowing tips
    var stalk = new T.CylinderGeometry(0.025, 0.04, 0.56, 6);
    var ants = [-1, 1].map(function (s) {
      var pv = new T.Group(); pv.position.set(s * 0.3, 1.84, 0.02); bod.add(pv);
      W.add(pv, stalk, green, 0, 0.28, 0);
      part(pv, sph, tipM, 0, 0.6, 0, 0.11, 0.11, 0.11, true);
      pv.rotation.z = -s * 0.32;
      return { p: pv, s: s, ax: 0, vx: 0, az: 0, vz: 0 };
    });
    // short arms and tiny legs (pivots: rotation.x swings forward and back, rotation.z spreads out to the side)
    var armGeo = new T.CapsuleGeometry(0.1, 0.3, 4, 8), legGeo = new T.CapsuleGeometry(0.11, 0.12, 4, 8);
    function limb(x, y, geo, len, rad, endM, ey, ez, es) {
      var pv = new T.Group(); pv.position.set(x, y, 0); bod.add(pv);
      W.add(pv, geo, green, 0, -len / 2 - rad * 0.4, 0);
      part(pv, sph, endM, 0, ey, ez, es[0], es[1], es[2]);
      return pv;
    }
    var armL = limb(-0.84, 1.2, armGeo, 0.3, 0.1, light, -0.56, 0, [0.15, 0.15, 0.15]);
    var armR = limb(0.84, 1.2, armGeo, 0.3, 0.1, light, -0.56, 0, [0.15, 0.15, 0.15]);
    var legL = limb(-0.32, 0.42, legGeo, 0.12, 0.11, shoe, -0.34, 0.07, [0.17, 0.09, 0.25]);
    var legR = limb(0.32, 0.42, legGeo, 0.12, 0.11, shoe, -0.34, 0.07, [0.17, 0.09, 0.25]);
    g.scale.setScalar(0.88);
    home.add(g);
    return { g: g, bod: bod, eye: eye, look: look, mouth: mouth, ants: ants, armL: armL, armR: armR, legL: legL, legR: legR, tipM: tipM,
      px: 0, py: 0, pyaw: 0, vx: 0, vy: 0, blink: 0, blinkT: 2 };
  }

  // The alien's little disco saucer: chasing lights round the rim and a mirror ball on a string.
  function buildSaucer(home, sph, moon) {
    var g = new T.Group(), i; home.add(g);
    var hull = W.add(g, sph, W.soft(0xcfd5ea, { metalness: 0.45, roughness: 0.32, emissive: 0x30364a, emissiveIntensity: moon ? 0.6 : 0.25 }), 0, 0, 0);
    hull.scale.set(1.5, 0.3, 1.5);
    var glass = new T.MeshStandardMaterial({ color: 0x8ff0ff, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.1, emissive: 0x1a7a90, emissiveIntensity: 0.7 });
    W.add(g, new T.SphereGeometry(0.72, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 0.12, 0, true);
    var bulbs = new T.InstancedMesh(new T.SphereGeometry(0.1, 8, 6), new T.MeshBasicMaterial({ color: 0xffffff }), 10), d = new T.Object3D(), col = new T.Color();
    for (i = 0; i < 10; i++) {
      var a = i / 10 * Math.PI * 2;
      d.position.set(Math.cos(a) * 1.44, 0.02, Math.sin(a) * 1.44); d.updateMatrix();
      bulbs.setMatrixAt(i, d.matrix); bulbs.setColorAt(i, col.setHSL(i / 10, 1, 0.6));
    }
    bulbs.frustumCulled = false; g.add(bulbs);
    var belly = W.add(g, new T.CircleGeometry(0.62, 20), new T.MeshBasicMaterial({ color: 0x9dfcff, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }), 0, -0.3, 0, true);
    belly.rotation.x = Math.PI / 2;
    var str = W.add(g, new T.CylinderGeometry(0.014, 0.014, 1, 4), W.soft(0x9aa0b8), 0, -0.5, 0, true);
    var mirror = new T.MeshStandardMaterial({ color: 0xe6ecfa, metalness: 0.35, roughness: 0.18, flatShading: true, emissive: 0x506080, emissiveIntensity: 0.4 });
    var ball = W.add(g, new T.IcosahedronGeometry(0.34, 1), mirror, 0, -1, 0);
    return { g: g, bulbs: bulbs, str: str, ball: ball, mirror: mirror, col: col };
  }

  // A round dance floor of coloured tiles that hugs the ground.
  function buildFloor(home, c, tx) {
    var geo = new T.RingGeometry(0.02, 3.7, 48, 6), p, i;
    geo.rotateX(-Math.PI / 2); p = geo.attributes.position;
    for (i = 0; i < p.count; i++) p.setY(i, Tn.height(c.x + p.getX(i), c.z + p.getZ(i)) - c.y + 0.05);
    var m = new T.MeshBasicMaterial({ map: tx.floor, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    m.color.setScalar(0.35);
    var f = new T.Mesh(geo, m); f.renderOrder = 2; home.add(f);
    al.floor = f; al.floorMat = m;
  }

  // Four coloured spotlight beams (see-through cones, not real lights) and the bright spots where they land.
  function buildBeams(home, tx) {
    var cone = new T.ConeGeometry(1, 1, 18, 1, true), disc = new T.CircleGeometry(1, 20);
    cone.translate(0, -0.5, 0); disc.rotateX(-Math.PI / 2);         // the tip of the cone is at its origin, and it shines down -y
    al.beams = [0xff4fd8, 0x4fd8ff, 0xffe14f, 0x8dff5a].map(function (col) {
      var b = new T.Mesh(cone, new T.MeshBasicMaterial({ color: col, map: tx.beam, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
      var s = new T.Mesh(disc, new T.MeshBasicMaterial({ color: col, map: tx.spot, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      b.visible = s.visible = false; b.renderOrder = 6; s.renderOrder = 3;
      home.add(b); home.add(s);
      return { b: b, s: s };
    });
  }
  function buildNotes(home, tx) {
    al.notes = [0, 1, 2].map(function () {
      var s = new T.Sprite(new T.SpriteMaterial({ map: tx.note, transparent: true, depthWrite: false, opacity: 0 }));
      s.scale.set(0.5, 0.5, 1); s.visible = false; home.add(s);
      return s;
    });
  }

  AL.build = safe(function (root, site) {
    if (st) finish(true);
    al = null;
    if (!root) return;
    var sp = pickSpot(site), c = { x: sp[0], z: sp[1], y: Tn.height(sp[0], sp[1]) };
    var home = new T.Group(); home.position.set(c.x, c.y, c.z); home.visible = false; root.add(home);
    var tx = textures(), sph = new T.SphereGeometry(1, 20, 14), hl = Math.hypot(c.x, c.z) || 1, rest = Math.atan2(-c.x, -c.z);
    al = { root: root, site: site, c: c, home: home, tx: tx, away: { x: c.x / hl, z: c.z / hl },
      ax: c.x, az: c.z, yaw: rest, restYaw: rest, party: 0, glance: 0, glanceT: 1 };
    al.rig = buildAlien(home, sph, site === 'moon');
    al.saucer = buildSaucer(home, sph, site === 'moon');
    buildFloor(home, c, tx);
    buildBeams(home, tx);
    buildNotes(home, tx);
    if (B && B.colliders) B.colliders.push({ x: c.x, z: c.z, r: 0.8 });       // you walk around it, not through it
    idle.t = 0; idle.on = false; idle.k = 0; idle.muted = false;
    idlePose(0, null, 999); scenery(0, 0, 0, 0);
  });
  AL.info = function () {        // for tests and the curious: where it hides, and how the dance is going
    return { spot: al ? { x: al.c.x, y: al.c.y, z: al.c.z, site: al.site } : null, dancing: !!st,
      t: st ? st.t : 0, hits: st ? st.hits : 0, moves: st ? st.seq.slice() : null };
  };

  // =====================================================================
  //  DANCE MOVES (shared by the alien and the astronaut)
  // =====================================================================
  // A pose: side step (dx, metres along the dancer's right), hop (dy), extra turn, body nod / lean / squash, arms and legs.
  function newPose() { return { dx: 0, dy: 0, yaw: 0, nod: 0, lean: 0, sq: 0, smile: 1, aLx: 0, aLz: 0, aRx: 0, aRz: 0, lLx: 0, lLz: 0, lRx: 0, lRz: 0 }; }
  var PA = newPose(), PM = newPose();
  // the basic groove: sway every two beats, dip on every beat, arms pumping
  function groove(o, beat, amt) {
    var ph = beat - Math.floor(beat), sw = Math.sin(beat * Math.PI), bob = 0.5 - 0.5 * Math.cos(ph * Math.PI * 2);
    o.dx = sw * 0.1 * amt; o.dy = bob * 0.07 * amt; o.yaw = sw * 0.12 * amt;
    o.nod = ((1 - bob) * 0.12 - 0.04) * amt; o.lean = -sw * 0.07 * amt; o.sq = (bob - 0.5) * 0.05 * amt; o.smile = 1;
    o.aLx = -0.25 - 0.5 * Math.max(0, sw) * amt; o.aRx = -0.25 - 0.5 * Math.max(0, -sw) * amt;
    o.aLz = -0.35 - 0.15 * bob * amt; o.aRz = 0.35 + 0.15 * bob * amt;
    o.lLx = 0.22 * Math.max(0, sw) * amt; o.lRx = 0.22 * Math.max(0, -sw) * amt; o.lLz = 0; o.lRz = 0;
  }
  // u runs from 0 to 1 through the move. side: which way to spin, or which arm waves (+1 right, -1 left).
  function applyMove(o, mv, u, tm, side) {
    u = clamp(u, 0, 1);
    var e = Math.sin(Math.PI * u), s, k, w, n;
    if (mv === 'left' || mv === 'right') {                 // side step and a big wave over the head
      s = mv === 'right' ? 1 : -1; w = Math.sin(u * Math.PI * 6) * 0.35;
      o.dx += s * 0.6 * e; o.lean = mix(o.lean, -s * 0.2, e); o.yaw = mix(o.yaw, s * 0.25, e);
      if (s > 0) { o.aRz = mix(o.aRz, 2.6 + w, e); o.aRx = mix(o.aRx, -0.15, e); o.aLz = mix(o.aLz, -0.8, e); o.aLx = mix(o.aLx, 0.35, e); o.lRz = mix(o.lRz, 0.38, e); }
      else { o.aLz = mix(o.aLz, -2.6 - w, e); o.aLx = mix(o.aLx, -0.15, e); o.aRz = mix(o.aRz, 0.8, e); o.aRx = mix(o.aRx, 0.35, e); o.lLz = mix(o.lLz, -0.38, e); }
    } else if (mv === 'up') {                             // moon hop: crouch, a star jump in low gravity, land
      var air = clamp((u - 0.2) / 0.62, 0, 1), flying = u > 0.2 && u < 0.82;
      var crouch = u <= 0.2 ? Math.sin(Math.PI * u / 0.2) : u >= 0.82 ? Math.sin(Math.PI * (u - 0.82) / 0.18) : 0;
      var star = flying ? Math.sin(Math.PI * air) : 0, up = Math.max(star, crouch * 0.35);
      o.dx *= 1 - up; o.dy = flying ? 0.8 * 4 * air * (1 - air) : -0.07 * crouch;
      o.sq = flying ? 0.07 : -0.14 * crouch;
      o.aLz = mix(o.aLz, -2.55, up); o.aRz = mix(o.aRz, 2.55, up); o.aLx = mix(o.aLx, 0, up); o.aRx = mix(o.aRx, 0, up);
      o.lLz = mix(o.lLz, -0.42, star); o.lRz = mix(o.lRz, 0.42, star); o.lLx *= 1 - up; o.lRx *= 1 - up;
      o.nod = mix(o.nod, -0.12, star); o.lean *= 1 - up; o.smile = mix(o.smile, 1.4, star);
    } else if (mv === 'down') {                           // the robot: stiff poses that snap on the half beats
      k = Math.min(3, Math.floor(u * 4));
      var q = ROBOT[k], q0 = k ? ROBOT[k - 1] : null, f = clamp((u * 4 - k) * 6, 0, 1), g = Math.min(1, u * 12, (1 - u) * 8), vals = [];
      for (n = 0; n < 6; n++) vals[n] = q0 ? mix(q0[n], q[n], f) : q[n];
      o.aLx = mix(o.aLx, vals[0], g); o.aLz = mix(o.aLz, vals[1], g); o.aRx = mix(o.aRx, vals[2], g); o.aRz = mix(o.aRz, vals[3], g);
      o.yaw = mix(o.yaw, vals[4], g); o.dy = mix(o.dy, vals[5], g); o.dx *= 1 - g; o.nod *= 1 - g; o.lean *= 1 - g; o.sq *= 1 - g;
      o.lLz = mix(o.lLz, -0.14, g); o.lRz = mix(o.lRz, 0.14, g); o.lLx *= 1 - g; o.lRx *= 1 - g;
    } else if (mv === 'spin') {
      k = (1 - Math.cos(Math.PI * u)) / 2;
      o.yaw += k * Math.PI * 2 * (side || 1);
      o.aLz = mix(o.aLz, -1.45, e); o.aRz = mix(o.aRz, 1.45, e); o.aLx = mix(o.aLx, 0, e); o.aRx = mix(o.aRx, 0, e);
      o.dy += 0.12 * e; o.dx *= 1 - e; o.lean *= 1 - e; o.lLz = mix(o.lLz, -0.16, e); o.lRz = mix(o.lRz, 0.16, e);
    } else if (mv === 'wobble') {                         // a miss: a funny dizzy wobble
      w = 1 - u; var f1 = Math.sin(u * Math.PI * 7), f2 = Math.sin(u * Math.PI * 11 + 1);
      o.lean = 0.38 * f1 * w; o.yaw += 0.35 * Math.sin(u * Math.PI * 5) * w; o.nod = 0.18 * f2 * w;
      o.aLz = mix(o.aLz, -1.3 - 0.7 * f2, w); o.aRz = mix(o.aRz, 1.3 + 0.7 * f1, w); o.aLx = mix(o.aLx, -0.8 * f1, w); o.aRx = mix(o.aRx, 0.8 * f2, w);
      o.lLz = mix(o.lLz, -0.25 * Math.max(0, f1), w); o.lRz = mix(o.lRz, 0.25 * Math.max(0, -f1), w);
      o.dx += 0.14 * f1 * w; o.dy *= 1 - w; o.sq = 0.06 * f2 * w;
    } else if (mv === 'cheer') {
      o.dy += 0.35 * e; o.aLz = mix(o.aLz, -2.7, e); o.aRz = mix(o.aRz, 2.7, e); o.aLx = mix(o.aLx, 0, e); o.aRx = mix(o.aRx, 0, e);
      o.sq += 0.06 * e; o.smile = mix(o.smile, 1.6, e);
    } else if (mv === 'giggle') {
      o.dy += 0.05 * Math.abs(Math.sin(u * Math.PI * 8)) * e; o.yaw += 0.15 * Math.sin(u * Math.PI * 10) * e;
      o.aLx = mix(o.aLx, -1.2, e); o.aRx = mix(o.aRx, -1.2, e); o.aLz = mix(o.aLz, -0.55, e); o.aRz = mix(o.aRz, 0.55, e); o.smile = mix(o.smile, 1.4, e);
    } else if (mv === 'point') {                          // "your turn!": the alien points at the astronaut
      o.aRz = mix(o.aRz, 1.45, e); o.aRx = mix(o.aRx, -0.45, e); o.lean = mix(o.lean, -0.1, e); o.yaw = mix(o.yaw, 0.3, e);
    } else if (mv === 'wave') {
      k = Math.min(1, u * 4, (1 - u) * 4); w = Math.sin(tm * 10) * 0.4;
      if ((side || 1) > 0) { o.aRz = mix(o.aRz, 2.55 + w, k); o.aRx = mix(o.aRx, -0.25, k); }
      else { o.aLz = mix(o.aLz, -2.55 - w, k); o.aLx = mix(o.aLx, -0.25, k); }
      o.smile = mix(o.smile, 1.3, k);
    }
  }
  function finale(o, t, side) {           // the big finish: a spin, then a moon hop, both together
    var u = (t - FIN_BAR * BAR) / BEAT;
    if (u < 2) applyMove(o, 'spin', u / 2, t, side);
    else if (u < 4) applyMove(o, 'up', (u - 2) / 2, t, side);
  }

  // ---------- putting a pose on the alien ----------
  function springs(dt, P, yaw) {
    // the antennae lag behind the body: hops make them flop out, side steps make them swing, spins fling them wide
    var r = al.rig, h = Math.max(dt, 1 / 240), i, j;
    var vy = (P.dy - r.py) / h, vx = (P.dx - r.px) / h, wy = angDiff(yaw, r.pyaw) / h;
    var ay = clamp((vy - r.vy) / h, -60, 60), ax = clamp((vx - r.vx) / h, -60, 60);
    r.py = P.dy; r.px = P.dx; r.pyaw = yaw; r.vy = vy; r.vx = vx;
    if (dt <= 0) return;
    var steps = Math.min(8, Math.ceil(h / 0.016)), sd = h / steps;
    for (i = 0; i < r.ants.length; i++) {
      var n = r.ants[i], fz = ax * 4 - n.s * ay * 2.5 - n.s * Math.min(12, Math.abs(wy)) * 2, fx = -ay * 1.2 + Math.sin((W.time || 0) * 2.3 + n.s) * 3;
      for (j = 0; j < steps; j++) {
        n.vz += (-90 * n.az - 5 * n.vz + fz) * sd; n.az += n.vz * sd;
        n.vx += (-90 * n.ax - 5 * n.vx + fx) * sd; n.ax += n.vx * sd;
      }
      n.az = clamp(n.az, -0.9, 0.9); n.ax = clamp(n.ax, -0.9, 0.9);
      n.p.rotation.set(n.ax, 0, -n.s * 0.32 + n.az);
    }
  }
  function applyAlien(P, dt, x, z, yaw, t, party, lookY) {
    var r = al.rig, cy = Math.cos(yaw), sy = Math.sin(yaw), gx = x + cy * P.dx, gz = z - sy * P.dx;
    r.g.position.set(gx - al.c.x, Tn.height(gx, gz) - al.c.y + P.dy, gz - al.c.z);
    r.g.rotation.set(0, yaw + P.yaw, 0);
    r.bod.rotation.set(P.nod, 0, P.lean);
    r.bod.scale.set(1 - P.sq * 0.5, 1 + P.sq, 1 - P.sq * 0.5);
    r.armL.rotation.set(P.aLx, 0, P.aLz); r.armR.rotation.set(P.aRx, 0, P.aRz);
    r.legL.rotation.set(P.lLx * 0.7, 0, P.lLz * 0.8); r.legR.rotation.set(P.lRx * 0.7, 0, P.lRz * 0.8);
    springs(dt, P, yaw + P.yaw);
    r.blinkT -= dt;
    if (r.blinkT <= 0) { r.blinkT = 2.2 + Math.random() * 2.8; r.blink = 0.13; }
    r.blink -= dt; r.eye.scale.y = r.blink > 0 ? 0.12 : 1;
    r.look.rotation.y += (lookY - r.look.rotation.y) * Math.min(1, dt * 10);
    r.mouth.scale.set(1, P.smile, 1);
    var beat = t / BEAT, pulse = Math.exp(-(beat - Math.floor(beat)) * 4);
    r.tipM.color.setHSL((t * (0.05 + 0.25 * party) + 0.88) % 1, 1, 0.6); r.tipM.emissive.copy(r.tipM.color);
    r.tipM.emissiveIntensity = 1.1 + pulse * (0.5 + party);
  }

  // ---------- the disco: saucer, beams, floor, floating notes ----------
  function scenery(dt, t, beat, party) {
    var sc = al.saucer, c = al.c, i, pulse = Math.exp(-(beat - Math.floor(beat)) * 4);
    al.party += (party - al.party) * Math.min(1, dt * 2.2);
    var p = al.party, sp = sc.g.position;
    sp.set(mix(al.away.x * 2.6, 0, p), mix(3.6 + Math.sin(t * 1.3) * 0.15, 4.75 + Math.sin(t * 0.9) * 0.1, p), mix(al.away.z * 2.6, 0, p));
    sc.g.rotation.y += dt * (0.4 + 1.6 * p);
    var sl = 0.35 + 0.65 * p;                            // the mirror ball comes down on its string for the party
    sc.str.scale.y = sl; sc.str.position.y = -0.3 - sl / 2; sc.ball.position.y = -0.64 - sl;
    sc.ball.rotation.y += dt * (0.6 + 1.5 * p); sc.ball.rotation.x = Math.sin(t * 0.7) * 0.2;
    sc.mirror.emissiveIntensity = 0.3 + p * (0.4 + 0.9 * pulse);
    var flip = Math.floor(beat * 2) % 2;
    for (i = 0; i < 10; i++) sc.bulbs.setColorAt(i, sc.col.setHSL((i / 10 + t * (0.08 + 0.5 * p)) % 1, 1, 0.45 + 0.25 * ((i + flip) % 2 ? p : 0.4)));
    if (sc.bulbs.instanceColor) sc.bulbs.instanceColor.needsUpdate = true;
    var show = p > 0.03;
    for (i = 0; i < al.beams.length; i++) {
      var bm = al.beams[i];
      bm.b.visible = bm.s.visible = show;
      if (!show) continue;
      var a = t * 0.85 * (i % 2 ? 1 : -1) + i * Math.PI / 2, rad = 0.6 + 2.2 * (0.5 + 0.5 * Math.sin(t * 0.63 + i * 1.7));
      var tx = Math.cos(a) * rad, tz = Math.sin(a) * rad, ty = Tn.height(c.x + tx, c.z + tz) - c.y + 0.05, oa = sc.g.rotation.y + i * Math.PI / 2;
      v1.set(sp.x + Math.cos(oa) * 0.55, sp.y - 0.28, sp.z + Math.sin(oa) * 0.55);
      v2.set(tx, ty, tz).sub(v1);
      var len = v2.length() || 1;
      v2.multiplyScalar(1 / len);
      bm.b.position.copy(v1); bm.b.quaternion.setFromUnitVectors(DOWN, v2); bm.b.scale.set(0.72, len, 0.72);
      bm.b.material.opacity = p * (0.2 + 0.12 * pulse);
      bm.s.position.set(tx, ty + 0.02, tz); bm.s.scale.setScalar(0.8); bm.s.material.opacity = p * (0.55 + 0.3 * pulse);
    }
    al.floorMat.color.setScalar(0.3 + 0.25 * idle.k * pulse + p * (0.4 + 0.3 * pulse));
    al.tx.floor.rotation += dt * (0.12 + 0.5 * p);
  }
  function notes(t, show) {
    var r = al.rig.g.position, i, n, ph, s;
    for (i = 0; i < al.notes.length; i++) {
      n = al.notes[i]; n.visible = show;
      if (!show) continue;
      ph = (t * 0.42 + i / al.notes.length) % 1; s = 0.38 + ph * 0.2;
      n.position.set(r.x + Math.sin(ph * 5 + i * 2.1) * 0.6, r.y + 2.5 + ph * 2.2, r.z + Math.cos(ph * 4 + i) * 0.25);
      n.material.opacity = Math.sin(Math.PI * ph) * 0.9;
      n.material.color.setHSL((i * 0.33 + t * 0.05) % 1, 0.9, 0.65);
      n.scale.set(s, s, 1);
    }
  }

  // =====================================================================
  //  WHILE YOU EXPLORE: it dances on its own and its beat leaks out over the radio
  // =====================================================================
  function idlePose(dt, p, d) {
    var t = idle.t, beat = t / BEAT, bar = Math.floor(beat / 4), inBar = beat - bar * 4, mv = IDLE[bar % IDLE.length];
    groove(PA, beat, 1);
    if (mv !== 'groove' && inBar < 2) applyMove(PA, mv, inBar / 2, t, 1);
    var want = p && d < 16 ? Math.atan2(p.x - al.ax, p.z - al.az) : al.restYaw;
    al.yaw = angLerp(al.yaw, want, Math.min(1, dt * 2.5));
    var k = Math.min(1, dt * 1.5);
    al.ax = lerp(al.ax, al.c.x, k); al.az = lerp(al.az, al.c.z, k);
    al.glanceT -= dt;
    if (al.glanceT <= 0) { al.glanceT = 1.4 + Math.random() * 2; al.glance = d < 16 ? 0 : (Math.random() - 0.5) * 0.7; }
    applyAlien(PA, dt, al.ax, al.az, al.yaw, t, 0, al.glance);
  }
  function hint(dt, d, ctx) {
    if (idle.muted && d > HINT_R + 12) idle.muted = false;            // after a dance it stays quiet until you have walked away
    var on = !idle.muted && soundOn() && d < (idle.on ? HINT_R + 4 : HINT_R);
    idle.on = on;
    idle.k = on ? 1 - Tn.smooth(4, HINT_R, d) : 0;                    // louder (and less muffled) as you get closer
    if (on && audioInit()) {
      wake();
      setOut(MASTER * 0.7 * idle.k); setCut(450 + 2600 * idle.k * idle.k);
      schedule(idle.t, 'hint');
    } else hintOff(dt);
    if (!idle.muted && ctx && typeof ctx.tip === 'function') {
      if (d < 32) ctx.tip('alien-radio', al.site === 'mars' ? '📻 The radio is picking up a funny beat... It seems to come from up on top of the mesa!'
        : '📻 The radio is picking up a funny beat... It seems to come from down inside that big crater!');
      if (d < 9) ctx.tip('alien-hello', '👽 Blip-blop! Hello, Earthling! I love to dance. Do you want to dance with me?');
    }
  }
  function hintOff(dt) {
    idle.on = false; idle.k = 0;
    if (!au.ctx || st) return;
    setOut(0);
    au.quiet += dt || 0;
    if (au.quiet > 1.5) nap();
  }

  AL.update = safe(function (dt, ctx) {
    if (!al || al.root !== W.root) return;
    dt = clamp(dt || 0, 0, 0.1);
    var mode = ctx && ctx.mode, show = mode === 'play' || mode === 'dance' || !!st;
    al.home.visible = show;
    if (!show) { hintOff(dt); return; }
    if (st) return;                                    // the dance drives everything itself (see step)
    idle.t += dt;
    var p = ctx.pos, d = p ? Math.hypot(p.x - al.c.x, p.z - al.c.z) : 999;
    if (d < 150) { idlePose(dt, p, d); scenery(dt, idle.t, idle.t / BEAT, 0); notes(idle.t, d < 70); }
    hint(dt, d, ctx);
  });

  AL.offer = safe(function (pos, offer, run) {
    if (!al || st || !al.home.visible || !pos || typeof offer !== 'function') return;
    var a = A.astro;
    if ((a && a.mode !== 'walk') || (A.rover && A.rover.driver)) return;
    if (Math.abs((pos.y || 0) - al.c.y) > 3) return;
    offer(Math.hypot(pos.x - al.ax, pos.z - al.az) - 0.9, REACH, { label: 'Dance with the alien 👽', run: run });
  });

  // =====================================================================
  //  THE DANCE PARTY
  // =====================================================================
  function makeSeq() {               // ten moves, every arrow at least twice, never the same one twice in a row
    var bag = DIRS.concat(DIRS), out = [], i, j, tmp, last, opts;
    bag.push(DIRS[(Math.random() * 4) | 0], DIRS[(Math.random() * 4) | 0]);
    for (i = bag.length - 1; i > 0; i--) { j = (Math.random() * (i + 1)) | 0; tmp = bag[i]; bag[i] = bag[j]; bag[j] = tmp; }
    while (bag.length) {
      last = out[out.length - 1]; opts = [];
      for (i = 0; i < bag.length; i++) if (bag[i] !== last) opts.push(i);
      j = opts.length ? opts[(Math.random() * opts.length) | 0] : 0;
      out.push(bag.splice(j, 1)[0]);
    }
    return out;
  }
  function openT(r) { return (INTRO_BARS + r) * BAR + BEAT; }                 // you may answer from the second beat of the bar...
  function closeT(r) { return (INTRO_BARS + r + 1) * BAR + 0.3 * BEAT; }      // ...until just after the next bar starts

  AL.start = function (ctx) {
    try {
      if (st) finish(true);
      var a = A.astro;
      if (!al || al.root !== W.root || !a || (A.rover && A.rover.driver)) return false;      // false: the game ends 'dance' at once
      ctx = ctx || {};
      // the show faces the camera you have now, so the move into the film is short
      var c = al.c, cp = W.cam.pos, fx = cp.x - c.x, fz = cp.z - c.z, fl = Math.hypot(fx, fz);
      if (fl < 1) { fx = a.pos.x - c.x; fz = a.pos.z - c.z; fl = Math.hypot(fx, fz); }
      if (fl < 0.01) { fx = -c.x; fz = -c.z; fl = Math.hypot(fx, fz) || 1; }
      fx /= fl; fz /= fl;
      var R = { x: fz, z: -fx }, fyaw = Math.atan2(fx, fz);           // R: screen right, as seen from the camera
      st = {
        t: 0, wall: now(), ctx: ctx, s: ctx.s || (JA.game && JA.game.s) || null, astro: a, fyaw: fyaw,
        aSpot: { x: c.x - R.x * 1.25, z: c.z - R.z * 1.25 }, mSpot: { x: c.x + R.x * 1.3, z: c.z + R.z * 1.3 },
        aFrom: { x: al.ax, z: al.az }, aYaw0: al.yaw, aYaw: fyaw + 0.22,
        mFrom: { x: a.pos.x, z: a.pos.z }, mYaw0: a.yaw, mYaw: fyaw - 0.15, R: R,
        camFrom: W.cam.pos.clone(), lookFrom: W.cam.look.clone(), fovFrom: (W.camera && W.camera.fov) || 52,
        seq: makeSeq(), res: [], checked: 0, hits: 0, me: { mv: null, t0: 0, dur: 0 }, react: null,
        fp: !!A.fp, held: a.carrying || null, quit: false, ended: false, fx: {}, ov: null, practiced: false
      };
      a.mode = 'dance'; a.vel.set(0, 0, 0); a.vy = 0; a.aim = false;
      A.pose = posePlayer;
      W.cam.mode = 'cine';
      if (st.fp && A.setFirstPerson) A.setFirstPerson(false);          // you need to see yourself dance
      if (st.held && st.held.mesh) st.held.mesh.visible = false;
      var f = flags(st.s);
      if (f) f.alienDance = (f.alienDance || 0) + 1;
      idle.muted = true;
      try { st.ov = overlay(); } catch (e) { warn(e); }
      window.addEventListener('keydown', onKey, true);
      startMusic();
      if (typeof ctx.say === 'function') ctx.say('👽 Zib-zab! A dance partner! Watch my moves, then copy me!');
      camera(0, 0);
      return true;
    } catch (e) {
      warn(e);
      try { finish(true); } catch (e2) { warn(e2); }
      return false;
    }
  };

  AL.step = function (dt) {
    if (!st) return false;
    try {
      return stepDance(clamp(dt || 0, 0, 0.1));
    } catch (e) {
      warn(e);
      try { finish(true); } catch (e2) { warn(e2); }
      return false;
    }
  };
  function stepDance(dt) {
    if (st.quit) {
      var bye = !st.ended && st.ctx && typeof st.ctx.say === 'function' ? st.ctx : null;
      finish(false);
      if (bye) bye.say(BYE_QUIT);
      return false;
    }
    st.t += dt; st.wall = now();
    var t = st.t, beat = t / BEAT, bar = Math.floor(t / BAR), inBar = (t - bar * BAR) / BEAT;
    judge(t);
    if (t >= END_T && !st.ended) endShow();
    danceAlien(dt, t, beat, bar, inBar);
    scenery(dt, t, beat, 1);
    notes(t, true);
    party(dt, t);
    camera(t, beat);
    music(t);
    ui(t, bar, inBar);
    if (t >= OUT_T) { finish(false); return false; }
    return true;
  }

  AL.stop = function () { try { finish(true); } catch (e) { warn(e); } };

  // ---------- the rhythm game ----------
  function judge(t) {                 // a bar with no answer at all counts as a miss
    while (st.checked < ROUNDS && t > closeT(st.checked)) {
      if (!st.res[st.checked]) result(st.checked, 'late');
      st.checked++;
    }
  }
  function press(dir) {
    if (!st || st.ended || st.quit) return;
    wake();
    flashKey(dir);
    var t = st.t + clamp((now() - st.wall) / 1000, 0, 0.06), r = -1, k;
    for (k = Math.max(0, st.checked - 1); k < ROUNDS; k++) if (!st.res[k] && t >= openT(k) && t <= closeT(k)) { r = k; break; }
    if (r < 0) {
      var rr = Math.floor(t / BAR) - INTRO_BARS;
      if (t < INTRO_BARS * BAR) {                       // before the first move: try the arrows for fun
        st.me = { mv: dir, t0: st.t, dur: 1.7 * BEAT };
        if (!st.practiced) { st.practiced = true; pop('Practice! 🎶', 'info'); }
      } else if (rr >= 0 && rr < ROUNDS && !st.res[rr] && t < openT(rr)) pop('Watch first! 👀', 'info');
      else if (t < FIN_BAR * BAR) st.me = { mv: dir, t0: st.t, dur: 1.7 * BEAT };     // extra moves just for fun, no score
      return;
    }
    if (dir === st.seq[r]) {
      var b3 = (INTRO_BARS + r) * BAR + 2 * BEAT, off = Math.min(Math.abs(t - b3), Math.abs(t - b3 - BEAT));
      result(r, off < 0.12 ? 'perfect' : off < 0.24 ? 'great' : 'good');
    } else result(r, 'oops');
  }
  function result(r, kind) {
    var hit = kind === 'perfect' || kind === 'great' || kind === 'good', a = A.astro;
    st.res[r] = kind;
    if (hit) {
      st.hits++;
      st.me = { mv: st.seq[r], t0: st.t, dur: 1.7 * BEAT };          // you do the move too
      st.react = { mv: 'cheer', t0: st.t, dur: 1.3 * BEAT, r: r };
      if (a) {
        var p = a.group.position, i;
        for (i = 0; i < (kind === 'perfect' ? 4 : 2); i++) W.burst(p.x, p.y + 1.4, p.z, kind === 'perfect' ? 12 : 9, 3.4, CONFETTI[(i + st.hits) % CONFETTI.length], { life: 0.8, size: 0.16, grow: 0.6, grav: 0, up: 1, alpha: 1 });
      }
      sfx(kind === 'perfect' ? 'perfect' : 'hit');
      pop(kind === 'perfect' ? 'Perfect! ✨' : kind === 'great' ? 'Great!' : 'Nice!', kind === 'perfect' ? 'best' : 'good');
    } else {
      st.me = { mv: 'wobble', t0: st.t, dur: 1.6 * BEAT };
      st.react = { mv: 'giggle', t0: st.t, dur: 1.3 * BEAT, r: r };
      sfx('miss');
      pop(kind === 'late' ? 'Whoops! 💫' : 'Oops! 💫', 'bad');
    }
    markStar(r, hit);
  }
  function endShow() {
    st.ended = true;
    var f = flags(st.s), n = st.hits;
    if (f) f.alienBest = Math.max(f.alienBest || 0, n);
    var line = n >= 9 ? '👽 Zibba-zoo! You are the best dancer in the whole galaxy! Come back and dance again soon!'
      : n >= 6 ? '👽 Blip-blop-WOW! Great moves, Earthling! See you at the next space disco!'
      : n >= 3 ? '👽 Wheee! That was so much fun. Keep practising those moves! Bye-bye!'
      : '👽 Hee hee! Dancing is all about having fun, and we did! Bye-bye, Earthling!';
    document.body.classList.add('alien-bye');           // lets BOLT's speech bubble show again for the goodbye
    if (st.ctx && typeof st.ctx.say === 'function') st.ctx.say(line);
    showFinal();
  }

  // ---------- the two dancers ----------
  function danceAlien(dt, t, beat, bar, inBar) {
    var P = PA, x = st.aSpot.x, z = st.aSpot.z, yaw = st.aYaw, r = bar - INTRO_BARS, look = 0;
    groove(P, beat, 1);
    if (t < ENTER) {                                    // hop over to its place on the floor
      var k = ease(t / ENTER);
      x = lerp(st.aFrom.x, x, k); z = lerp(st.aFrom.z, z, k); yaw = angLerp(st.aYaw0, yaw, k); P.dy += Math.sin(Math.PI * k) * 0.5;
    } else if (t >= END_T) applyMove(P, 'wave', Math.min(0.5, (t - END_T) / BEAT), t, -1);
    else if (bar >= FIN_BAR) finale(P, t, -1);
    else if (r < 0) { if (bar === 1 && inBar < 2.6) applyMove(P, 'wave', inBar / 2.6, t, -1); }
    else if (st.react && st.react.r === r && t - st.react.t0 < st.react.dur) { applyMove(P, st.react.mv, (t - st.react.t0) / st.react.dur, t, 1); look = 0.5; }
    else if (inBar < 2) applyMove(P, st.seq[r], inBar / 2, t, 1);           // the alien shows the move
    else { if (inBar < 3.6) applyMove(P, 'point', (inBar - 2) / 1.6, t, 1); look = 0.5; }   // and then watches you
    al.ax = x; al.az = z; al.yaw = yaw;
    applyAlien(P, dt, x, z, yaw, t, 1, look);
  }
  // A.pose: actors.js calls this every frame while the astronaut is in 'dance' mode
  function posePlayer(a, dt) {
    try {
      if (!st) { a.group.position.copy(a.pos); a.group.rotation.y = a.yaw; return; }
      var t = st.t, beat = t / BEAT, P = PM, x = st.mSpot.x, z = st.mSpot.z, yaw = st.mYaw, hop = 0, m = st.me;
      var bar = Math.floor(t / BAR), inBar = (t - bar * BAR) / BEAT, r = bar - INTRO_BARS;
      groove(P, beat, 1);
      if (t < ENTER) {
        var k = ease(t / ENTER);
        x = lerp(st.mFrom.x, x, k); z = lerp(st.mFrom.z, z, k); yaw = angLerp(st.mYaw0, yaw, k); hop = Math.sin(Math.PI * k) * 0.6;
      } else if (t >= END_T) applyMove(P, 'wave', Math.min(0.5, (t - END_T) / BEAT), t, 1);
      else if (bar >= FIN_BAR) finale(P, t, 1);
      else if (m.mv && t - m.t0 < m.dur) applyMove(P, m.mv, (t - m.t0) / m.dur, t, 1);
      else if (r >= 0 && inBar < 2) P.yaw = mix(P.yaw, -0.25, Math.sin(Math.PI * inBar / 2));     // a glance at the alien
      a.pos.set(x, Tn.height(x, z), z); a.yaw = yaw;
      var cy = Math.cos(yaw), sy = Math.sin(yaw), gx = x + cy * P.dx, gz = z - sy * P.dx, s = 0.84;
      a.group.position.set(gx, Tn.height(gx, gz) + P.dy + hop, gz);
      a.group.rotation.set(0, yaw + P.yaw, 0);
      a.body.rotation.set(P.nod, 0, P.lean);
      a.armL.rotation.set(P.aLx, 0, P.aLz); a.armR.rotation.set(P.aRx, 0, P.aRz);
      a.legL.rotation.set(P.lLx, 0, P.lLz); a.legR.rotation.set(P.lRx, 0, P.lRz);
      a.group.scale.set(s * (1 - P.sq * 0.5), s * (1 + P.sq), s * (1 - P.sq * 0.5));
    } catch (e) { warn(e); }
  }
  function party(dt, t) {
    var c = al.c, i, n, a;
    if (t > 0.6 && t < END_T + 1.5) {                   // confetti drifting down from the saucer
      n = W.rate(W.lite ? 0.7 : 1.2, dt);
      for (i = 0; i < n; i++) {
        a = Math.random() * 6.283; var rd = Math.sqrt(Math.random()) * 3.6;
        W.emit(c.x + Math.cos(a) * rd, c.y + 4.6, c.z + Math.sin(a) * rd, { vx: (Math.random() - 0.5) * 0.8, vy: -0.6 - Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.8,
          life: 4.2, size: 0.1, grow: 1, color: CONFETTI[(Math.random() * CONFETTI.length) | 0], alpha: 0.95, grav: W.gravity * 0.06 });
      }
    }
    n = W.rate(1.2, dt);                               // glints off the mirror ball
    if (n) {
      al.saucer.ball.getWorldPosition(v1);
      for (i = 0; i < n; i++) {
        v2.set(Math.random() - 0.5, Math.random() - 0.7, Math.random() - 0.5).normalize();
        W.emit(v1.x + v2.x * 0.36, v1.y + v2.y * 0.36, v1.z + v2.z * 0.36, { vx: v2.x * 5, vy: v2.y * 5, vz: v2.z * 5, life: 0.3, size: 0.1, grow: 0.3, color: 0xffffff, alpha: 1, grav: 0 });
      }
    }
    var me = A.astro;
    if (me && st.me.mv === 'wobble' && t - st.me.t0 < st.me.dur && t < FIN_BAR * BAR) {     // dizzy stars round your helmet
      var hp = me.group.position, ang = t * 9;
      if (Math.random() < 0.6) W.emit(hp.x + Math.cos(ang) * 0.5, hp.y + 2.2, hp.z + Math.sin(ang) * 0.5, { life: 0.4, size: 0.14, grow: 0.5, color: 0xffe14f, alpha: 1, grav: 0 });
    }
    if (!st.fx.land && t >= ENTER) { st.fx.land = 1; W.dust(st.mSpot.x, st.mSpot.z, 8, 1.6, 0.4); W.dust(st.aSpot.x, st.aSpot.z, 8, 1.6, 0.4); }
    if (!st.fx.fin && t >= FIN_BAR * BAR) { st.fx.fin = 1; boom(30); }
    if (!st.fx.hop && t >= FIN_BAR * BAR + 3.65 * BEAT) { st.fx.hop = 1; W.dust(st.mSpot.x, st.mSpot.z, 10, 2, 0.45); W.dust(st.aSpot.x, st.aSpot.z, 10, 2, 0.45); }
    if (!st.fx.end && t >= END_T) { st.fx.end = 1; boom(50); }
  }
  function boom(n) {
    var c = al.c;
    for (var i = 0; i < 3; i++) W.burst(c.x, c.y + 4.3, c.z, n, 5, CONFETTI[(i * 2 + (st ? st.hits : 0)) % CONFETTI.length], { life: 2.4, size: 0.16, grow: 1, grav: W.gravity * 0.3, up: 0.3, alpha: 1 });
  }
  function camera(t, beat) {
    var c = al.c, cine = W.cam.cine, asp = (W.camera && W.camera.aspect) || 1.6, fb = FIN_BAR * BAR;
    var fin = t >= fb ? Tn.smooth(fb, fb + BEAT, t) * (1 - Tn.smooth(END_T, END_T + BEAT * 2, t)) : 0;
    var az = st.fyaw + Math.sin(t * 0.21) * 0.3 + fin * Math.sin((t - fb) * 1.1) * 0.5;
    var dist = (7.4 + Math.sin(t * 0.37) * 0.45 - fin * 1.2 - 0.8 * Tn.smooth(END_T, END_T + 2, t)) * clamp(1.15 / asp, 1, 1.9);
    var h = 2.0 + Math.sin(t * 0.29) * 0.3 + fin * 0.4;
    // when the move card sits at the right of the screen, slide the view so the dancers stay clear of it
    var sh = st.ov && st.ov.side ? 0.6 : 0, ox = st.R.x * sh, oz = st.R.z * sh;
    var px = c.x + ox + Math.sin(az) * dist, pz = c.z + oz + Math.cos(az) * dist, py = Math.max(c.y + h, Tn.height(px, pz) + 1.1);
    var going = t < END_T ? 1 : 0, pulse = Math.exp(-(beat - Math.floor(beat)) * 5) * going;
    var k = ease(t / 1.4);
    cine.pos.set(lerp(st.camFrom.x, px, k), lerp(st.camFrom.y, py, k), lerp(st.camFrom.z, pz, k));
    cine.look.set(lerp(st.lookFrom.x, c.x + ox, k), lerp(st.lookFrom.y, c.y + 1.75, k), lerp(st.lookFrom.z, c.z + oz, k));
    cine.fov = lerp(st.fovFrom, 50 - pulse * 1.4, k);          // a tiny zoom punch on every beat
    cine.roll = Math.sin(beat * Math.PI * 0.5) * 0.018 * going * k;
  }

  // ---------- the end: put everything back (safe to call more than once) ----------
  function finish() {
    if (!st) return;
    var s = st, steps, i;
    st = null;
    idle.muted = true;
    steps = [
      function () { window.removeEventListener('keydown', onKey, true); },
      function () { if (s.ov && s.ov.el && s.ov.el.parentNode) s.ov.el.parentNode.removeChild(s.ov.el); document.body.classList.remove('alien-on', 'alien-bye'); },
      function () { musicOff(); },
      function () { restoreAstro(s); },
      function () {
        if (W.cam.mode === 'cine') W.cam.mode = 'play';
        W.cam.cine.roll = 0; W.cam.cine.fov = 52;
        var cp = W.cam.pos;                            // carry on looking from about where the film camera was
        W.cam.yaw = Math.atan2(cp.x - s.mSpot.x, cp.z - s.mSpot.z);
      },
      function () { var f = flags(s.s); if (f) f.alienBest = Math.max(f.alienBest || 0, s.hits); },
      function () { if (al && al.root === W.root) { al.ax = s.aSpot.x; al.az = s.aSpot.z; al.yaw = s.aYaw; } }
    ];
    for (i = 0; i < steps.length; i++) { try { steps[i](); } catch (e) { warn(e); } }
  }
  function restoreAstro(s) {
    if (A.pose === posePlayer) A.pose = null;
    var a = s.astro;
    if (!a || a !== A.astro) return;                  // the world was rebuilt: that astronaut is gone
    if (a.mode === 'dance') a.mode = 'walk';
    a.pos.set(s.mSpot.x, Tn.height(s.mSpot.x, s.mSpot.z), s.mSpot.z);
    a.vel.set(0, 0, 0); a.vy = 0; a.onGround = true; a.spin = 0; a.squash = 0; a.yaw = s.mYaw;
    [a.armL, a.armR, a.legL, a.legR, a.body].forEach(function (o) { if (o) o.rotation.set(0, 0, 0); });
    a.group.scale.setScalar(0.84); a.group.rotation.set(0, a.yaw, 0); a.group.position.copy(a.pos);
    if (s.held && s.held.mesh) s.held.mesh.visible = true;
    if (s.fp && A.setFirstPerson) A.setFirstPerson(true);
  }

  // =====================================================================
  //  CONTROLS AND THE ON-SCREEN PARTY PANEL
  // =====================================================================
  function blocked() {               // a pause card or the help is open: the keys belong to the game
    if (JA.ui && JA.ui.modalOpen && JA.ui.modalOpen()) return true;
    var info = document.getElementById('info-root');
    return !!(info && info.classList.contains('open'));
  }
  function quit() { if (st) { st.quit = true; wake(); } }
  function onKey(e) {
    try {
      if (!st || blocked()) return;
      var code = e.code || e.key || '', dir = KEYS[code];
      if (dir) { e.preventDefault(); e.stopPropagation(); if (!e.repeat) press(dir); return; }
      if (code === 'Escape' || code === 'Space' || code === ' ') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) quit(); }
    } catch (err) { warn(err); }
  }

  function overlay() {
    var touch = document.body.classList.contains('touch'), el = document.createElement('div'), stars = '', pad = '', i;
    var side = !touch && window.innerWidth > 700;      // wide screens: the move card sits at the right
    el.className = 'alien-party' + (touch ? ' alien-touch' : '') + (side ? ' alien-side' : '');
    el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Space disco dance game');
    for (i = 0; i < ROUNDS; i++) stars += '<i>★</i>';
    if (touch) for (i = 0; i < 4; i++) pad += '<button type="button" class="alien-key" data-dir="' + DIRS[i] + '" aria-label="' + DIRS[i] + ' arrow">' + ARROW + '</button>';
    el.innerHTML =
      '<div class="alien-head"><div class="alien-title"><span class="alien-title-icon" aria-hidden="true">👽</span> <span class="alien-title-text">SPACE DISCO!</span></div>' +
        '<div class="alien-stars" aria-hidden="true">' + stars + '<b class="alien-score">0</b></div></div>' +
      '<button type="button" class="alien-close" aria-label="Stop dancing" title="Stop dancing (Esc)">✕</button>' +
      '<div class="alien-card"><div class="alien-who">Get ready!</div><div class="alien-arrow alien-none">' + ARROW + '</div>' +
        '<div class="alien-move">Copy the alien\'s moves</div><div class="alien-beats"><i class="alien-b-a"></i><i class="alien-b-a"></i><i class="alien-b-y"></i><i class="alien-b-y"></i></div></div>' +
      '<div class="alien-pop" aria-live="polite"></div>' +
      (touch ? '<div class="alien-pad">' + pad + '</div>' : '<div class="alien-help">Copy the moves with the arrow keys or W A S D · Esc to stop</div>') +
      '<div class="alien-final" aria-live="polite"><small>👽 What a party!</small><b></b><span></span></div>';
    document.body.appendChild(el);
    document.body.classList.add('alien-on');
    var o = { el: el, card: el.querySelector('.alien-card'), who: el.querySelector('.alien-who'), arrow: el.querySelector('.alien-arrow'),
      move: el.querySelector('.alien-move'), dots: el.querySelectorAll('.alien-beats i'), stars: el.querySelectorAll('.alien-stars i'),
      score: el.querySelector('.alien-score'), pop: el.querySelector('.alien-pop'), fin: el.querySelector('.alien-final'), keys: {}, phase: '', beat: -1, touch: touch, side: side };
    el.querySelector('.alien-close').addEventListener('click', function (e) { e.preventDefault(); quit(); });
    var ks = el.querySelectorAll('.alien-key');
    for (i = 0; i < ks.length; i++) (function (b) {
      var d = b.getAttribute('data-dir');
      o.keys[d] = b;
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); press(d); });
    })(ks[i]);
    placeHead(o);
    return o;
  }
  function placeHead(o) {            // the title sits just under the game's top bar (measured again if the window changes size)
    var hud = document.getElementById('hud'), hb = hud && hud.getBoundingClientRect();
    o.vw = window.innerWidth; o.vh = window.innerHeight;
    if (hb && hb.bottom > 0 && hb.bottom < o.vh * 0.6) o.el.style.setProperty('--alien-top', Math.round(hb.bottom + 8) + 'px');
    else o.el.style.removeProperty('--alien-top');
  }
  function flashKey(dir) {
    var b = st && st.ov && st.ov.keys[dir];
    if (!b) return;
    b.classList.add('alien-down');
    setTimeout(function () { b.classList.remove('alien-down'); }, 140);
  }
  function pop(text, kind) {
    var p = st && st.ov && st.ov.pop;
    if (!p) return;
    p.textContent = text; p.className = 'alien-pop';
    void p.offsetWidth;                                 // restart the animation
    p.className = 'alien-pop alien-go alien-p-' + kind;
  }
  function markStar(r, hit) {
    var o = st && st.ov;
    if (!o) return;
    var s = o.stars[r];
    if (s) { s.classList.remove('alien-now'); s.classList.add(hit ? 'alien-hit' : 'alien-miss'); }
    o.score.textContent = String(st.hits);
    if (o.phase === 'yours' + r || o.phase === 'watch' + r) {         // a late miss must not tint the next move's card
      o.card.classList.remove('alien-yours');
      o.card.classList.add(hit ? 'alien-good' : 'alien-bad');
    }
  }
  function showFinal() {
    var o = st && st.ov, n = st ? st.hits : 0;
    if (!o) return;
    o.card.classList.add('alien-gone');
    o.fin.querySelector('b').textContent = 'Groove score ' + n + ' / ' + ROUNDS;
    o.fin.querySelector('span').textContent = n >= 10 ? 'Disco legend! 🏆' : n >= 8 ? 'Superstar dancer! 🌟' : n >= 5 ? 'Great grooving! 🎉' : n >= 2 ? 'Nice moves! 😄' : 'Thanks for dancing! 💚';
    o.fin.classList.add('alien-show');
  }
  function ui(t, bar, inBar) {
    var o = st.ov;
    if (!o) return;
    var r = bar - INTRO_BARS, phase, b = Math.floor(inBar), i;
    if (window.innerWidth !== o.vw || window.innerHeight !== o.vh) placeHead(o);
    if (t >= END_T) phase = 'end';
    else if (bar >= FIN_BAR) phase = 'fin';
    else if (r >= 0) phase = (inBar < 2 ? 'watch' : 'yours') + r;
    else phase = 'intro' + bar;
    if (phase !== o.phase) {
      o.phase = phase;
      var c = o.card, dir = r >= 0 && r < ROUNDS ? st.seq[r] : null, done = dir && st.res[r];
      c.classList.remove('alien-yours', 'alien-good', 'alien-bad', 'alien-fin');
      if (phase.indexOf('intro') === 0) {
        o.who.textContent = 'Get ready!';
        o.move.textContent = bar === 0 ? 'Copy the alien\'s moves' : o.touch ? 'Then tap the same arrow' : 'Then press the same arrow';
        o.arrow.classList.add('alien-none');
      } else if (phase.indexOf('watch') === 0) {
        o.who.textContent = '👽 Watch me!';
        o.move.textContent = NAMES[dir];
        o.arrow.setAttribute('data-dir', dir); o.arrow.classList.remove('alien-none');
        if (o.stars[r] && !done) o.stars[r].classList.add('alien-now');
      } else if (phase.indexOf('yours') === 0) {
        o.who.textContent = '⭐ Your turn!';
        c.classList.add(!done ? 'alien-yours' : /perfect|great|good/.test(done) ? 'alien-good' : 'alien-bad');
      } else if (phase === 'fin') {
        o.who.textContent = '🎉 Big finish!';
        o.move.textContent = 'Spin and jump together!';
        o.arrow.classList.add('alien-none'); c.classList.add('alien-fin');
      }
    }
    if (b !== o.beat) {
      o.beat = b;
      for (i = 0; i < o.dots.length; i++) o.dots[i].classList.toggle('alien-lit', i === b && t < END_T);
    }
  }

  // =====================================================================
  //  SOUND: an original upbeat "space disco" loop made with the Web Audio API
  //  (four-on-the-floor kick, claps, hi-hats, an octave bass and a sparkly arpeggio in F major)
  // =====================================================================
  var au = { ctx: null, out: null, lp: null, bus: null, arp: null, noise: null, live: [], off: 0, synced: false, next: 0, mode: '', vol: -1, cut: -1, quiet: 0 };
  // one chord per bar: F, C, D minor, B flat. b = bass note, a = bottom of the arpeggio (MIDI numbers)
  var CHORDS = [{ b: 41, a: 77, m: false }, { b: 36, a: 72, m: false }, { b: 38, a: 74, m: true }, { b: 34, a: 70, m: false }];
  var ARP = [0, 2, 1, 3, 2, 1, 0, 1, 0, 2, 1, 3, 2, 3, 1, 2];
  function chordNote(ch, i) { return ch.a + [0, ch.m ? 3 : 4, 7, 12][i]; }
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function audioInit() {
    if (au.ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      var c = new AC(), comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      au.out = c.createGain(); au.out.gain.value = 0;
      au.lp = c.createBiquadFilter(); au.lp.type = 'lowpass'; au.lp.frequency.value = 900; au.lp.Q.value = 0.8;
      au.bus = c.createGain();
      au.bus.connect(au.lp); au.lp.connect(au.out); au.out.connect(comp); comp.connect(c.destination);
      au.arp = c.createGain(); au.arp.connect(au.bus);          // the arpeggio gets a little echo
      var dl = c.createDelay(1), fb = c.createGain(), wet = c.createGain();
      dl.delayTime.value = SIX * 3; fb.gain.value = 0.3; wet.gain.value = 0.45;
      au.arp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(au.bus);
      var n = Math.floor(c.sampleRate * 2), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0), i;
      for (i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      au.noise = buf; au.ctx = c; au.vol = 0; au.cut = 900;
    } catch (e) { au.ctx = null; return false; }
    return true;
  }
  function wake() {
    au.quiet = 0;
    var c = au.ctx;
    if (c && (c.state === 'suspended' || c.state === 'interrupted')) { try { var p = c.resume(); if (p && p.catch) p.catch(noop); } catch (e) { /* not allowed yet */ } }
  }
  function nap() {
    var c = au.ctx;
    if (c && c.state === 'running') { try { var p = c.suspend(); if (p && p.catch) p.catch(noop); } catch (e) { /* ignore */ } }
  }
  function setOut(v) {
    if (!au.ctx || Math.abs(v - au.vol) < 0.001) return;
    au.vol = v; au.out.gain.setTargetAtTime(v, au.ctx.currentTime, 0.1);
  }
  function setCut(f) {
    if (!au.ctx || Math.abs(f - au.cut) < 20) return;
    au.cut = f; au.lp.frequency.setTargetAtTime(f, au.ctx.currentTime, 0.12);
  }
  function track(n, end) {
    au.live.push({ n: n, e: end });
    if (au.live.length > 64) {
      var t = au.ctx.currentTime, keep = [], i;
      for (i = 0; i < au.live.length; i++) if (au.live[i].e > t) keep.push(au.live[i]);
      au.live = keep;
    }
  }
  function envGain(t, a, peak, d, dest) {
    var g = au.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(dest || au.bus);
    return g;
  }
  function tone(type, f, t, a, d, peak, dest) {
    var o = au.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t);
    o.connect(envGain(t, a, peak, d, dest));
    o.start(t); o.stop(t + a + d + 0.03); track(o, t + a + d + 0.03);
    return o;
  }
  function hiss(t, d, peak, type, f, q) {
    var c = au.ctx, s = c.createBufferSource(), flt = c.createBiquadFilter();
    s.buffer = au.noise; flt.type = type; flt.frequency.value = f; if (q) flt.Q.value = q;
    s.connect(flt); flt.connect(envGain(t, 0.002, peak, d));
    s.start(t, Math.random() * 0.4); s.stop(t + d + 0.05); track(s, t + d + 0.05);
  }
  var V = {
    kick: function (t, v) { tone('sine', 150, t, 0.003, 0.28, v).frequency.exponentialRampToValueAtTime(42, t + 0.12); },
    clap: function (t, v) { hiss(t, 0.012, v * 0.7, 'bandpass', 1500, 0.9); hiss(t + 0.011, 0.012, v * 0.7, 'bandpass', 1500, 0.9); hiss(t + 0.022, 0.15, v, 'bandpass', 1400, 0.9); },
    hat: function (t, v, open) { hiss(t, open ? 0.1 : 0.03, v, 'highpass', 7500); },
    bass: function (t, m, d, v) {
      var c = au.ctx, o = c.createOscillator(), f = c.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(hz(m), t);
      f.type = 'lowpass'; f.Q.value = 6; f.frequency.setValueAtTime(1500, t); f.frequency.exponentialRampToValueAtTime(260, t + d);
      o.connect(f); f.connect(envGain(t, 0.004, v, d));
      o.start(t); o.stop(t + d + 0.03); track(o, t + d + 0.03);
    },
    pluck: function (t, m, v) { tone('square', hz(m), t, 0.002, 0.13, v, au.arp); },
    chime: function (t, m, v) { tone('sine', hz(m), t, 0.004, 0.55, v); tone('sine', hz(m + 19), t, 0.004, 0.3, v * 0.4); tone('triangle', hz(m + 12), t + 0.07, 0.004, 0.4, v * 0.5); },
    boing: function (t, v) {
      var c = au.ctx, o = tone('sine', 520, t, 0.005, 0.42, v), lfo = c.createOscillator(), lg = c.createGain();
      o.frequency.exponentialRampToValueAtTime(150, t + 0.4);
      lfo.frequency.value = 17; lg.gain.value = 35; lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t); lfo.stop(t + 0.47); track(lfo, t + 0.47);
    },
    chirp: function (t, up, v) {          // the alien's little "watch me" / "your turn" voice
      tone('triangle', up ? 520 : 1100, t, 0.004, 0.09, v).frequency.exponentialRampToValueAtTime(up ? 1250 : 520, t + 0.09);
      tone('triangle', up ? 780 : 900, t + 0.11, 0.004, 0.1, v).frequency.exponentialRampToValueAtTime(up ? 1560 : 380, t + 0.21);
    },
    zap: function (t, v) { tone('square', 1700, t, 0.004, 0.36, v).frequency.exponentialRampToValueAtTime(140, t + 0.36); },
    stab: function (t, ch, v) { [0, ch.m ? 3 : 4, 7, 12].forEach(function (k) { tone('sawtooth', hz(ch.a - 12 + k), t, 0.006, 0.9, v); }); },
    crash: function (t, v) { hiss(t, 1.5, v, 'highpass', 4800); }
  };
  // one sixteenth note of the loop
  function playStep(i, t, mode) {
    var j = i % 16, bar = Math.floor(i / 16), ch = CHORDS[bar % 4], on4 = j % 4 === 0;
    if (mode === 'hint') {                              // the faint version you hear from far away
      if (on4) V.kick(t, 0.5);
      if (j % 4 === 2) V.hat(t, 0.08, true);
      if (j % 2 === 0) V.bass(t, ch.b + (j % 4 === 2 ? 12 : 0), SIX * 1.5, 0.14);
      else V.pluck(t, chordNote(ch, ARP[j]), 0.025);
      return;
    }
    if (bar > FIN_BAR + 1) return;
    if (bar === FIN_BAR + 1) {                         // the last hit: back home on F
      if (j === 0) { V.kick(t, 0.45); V.stab(t, CHORDS[0], 0.045); V.crash(t, 0.08); }
      return;
    }
    var full = bar >= 1, round = bar >= INTRO_BARS && bar < FIN_BAR;
    if (on4) V.kick(t, 0.45);
    if (full && (j === 4 || j === 12)) V.clap(t, 0.24);
    if (bar === FIN_BAR && j >= 8 && j !== 12) V.clap(t, 0.06 + (j - 8) * 0.02);     // a drum roll into the finish
    if (j % 4 === 2) V.hat(t, 0.075, true); else if (full && j % 2 === 1) V.hat(t, 0.03, false);
    if (j % 2 === 0) V.bass(t, ch.b + (j % 4 === 2 ? 12 : 0), SIX * 1.6, 0.15);
    if (full) V.pluck(t, chordNote(ch, ARP[j]), round ? 0.035 : 0.022);
    if (round && j === 0) V.chirp(t, false, 0.05);
    if (round && j === 8) V.chirp(t, true, 0.045);
  }
  // Notes are booked a moment ahead on the audio clock, which follows the game clock (so pausing pauses the music).
  function schedule(clockT, mode) {
    var c = au.ctx;
    if (!c || c.state !== 'running') return;
    if (au.mode !== mode) { au.mode = mode; au.next = Math.max(0, Math.ceil(clockT / SIX - 0.001)); au.synced = false; }
    var want = c.currentTime - clockT + 0.03;
    if (!au.synced || Math.abs(want - au.off) > 0.08) { au.off = want; au.synced = true; } else au.off += (want - au.off) * 0.03;
    if (au.next * SIX < clockT - 0.06) au.next = Math.ceil(clockT / SIX);      // we fell behind (a pause or a slow frame): skip, do not pile up
    var n = 0, tnow = c.currentTime, when;
    while (au.next * SIX < clockT + 0.2 && n < 8) {
      when = au.next * SIX + au.off;
      if (when > tnow - 0.005) playStep(au.next, Math.max(when, tnow + 0.005), mode);
      au.next++; n++;
    }
  }
  function startMusic() {
    if (!soundOn() || !audioInit()) return;
    wake();
    var c = au.ctx, n = c.currentTime, f = au.lp.frequency;
    try { f.cancelScheduledValues(n); f.setValueAtTime(Math.max(200, f.value || 700), n); f.exponentialRampToValueAtTime(15000, n + 1.3); } catch (e) { /* ignore */ }
    au.cut = 15000;
    setOut(MASTER);
    au.mode = 'dance'; au.next = 0; au.synced = false;
    V.zap(n + 0.02, 0.07);
  }
  function music(t) {
    if (soundOn()) {
      if (!audioInit()) return;
      wake(); setOut(MASTER); setCut(15000);
      schedule(t, 'dance');
    } else if (au.ctx) setOut(0);
  }
  function sfx(kind) {
    var c = au.ctx;
    if (!c || !soundOn() || c.state !== 'running' || au.mode !== 'dance') return;
    var t = c.currentTime + 0.01, ch = CHORDS[Math.floor((st ? st.t : 0) / BAR) % 4];
    if (kind === 'miss') V.boing(t, 0.1);
    else { V.chime(t, chordNote(ch, 2), 0.09); if (kind === 'perfect') V.chime(t + 0.09, chordNote(ch, 3), 0.07); }
  }
  function musicOff() {
    au.mode = '';
    if (!au.ctx) return;
    var c = au.ctx, n = c.currentTime, g = au.out.gain, i;
    try { g.cancelScheduledValues(n); g.setValueAtTime(g.value, n); g.linearRampToValueAtTime(0, n + 0.06); } catch (e) { /* ignore */ }
    au.vol = 0;
    for (i = 0; i < au.live.length; i++) { try { au.live[i].n.stop(n + 0.07); } catch (e) { /* already stopped */ } }
    au.live = [];
    setTimeout(function () { if (!st && !idle.on) nap(); }, 400);
  }
})(window.JA);
