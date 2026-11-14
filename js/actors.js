/* Astro Outpost — things that move: the astronaut, the robot buddy, the rover, dust devils,
   and every object you can pick up, carry and throw (with real Moon / Mars gravity). */
(function (JA) {
  'use strict';
  var T = window.THREE, W = JA.world, Tn = JA.terrain, B = JA.base;
  var A = JA.actors = { items: [], devils: [] };
  if (!T) return;
  var root, site, grav = 3.71, add, mat, soft, glow;
  var astro, buddy, rover;
  var v1 = new T.Vector3(), v2 = new T.Vector3(), v3 = new T.Vector3(), UP = new T.Vector3(0, 1, 0), q1 = new T.Quaternion();
  var THROW_ANGLE = 0.72, THROW_MIN = 3.2, THROW_MAX = 9.5;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function angLerp(a, b, t) { var d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; }

  // ---------- astronaut ----------
  function buildAstronaut(color) {
    var g = new T.Group(), body = new T.Group(); g.add(body);
    var white = soft(0xf5f6fa), accent = soft(color), grey = soft(0xcfd3de);
    add(body, new T.CapsuleGeometry(0.44, 0.46, 6, 14), white, 0, 1.08, 0);
    add(body, new T.BoxGeometry(0.7, 0.9, 0.38), grey, 0, 1.22, -0.46);
    add(body, new T.BoxGeometry(0.2, 0.14, 0.06), glow(0x4dff9a, 1.5), 0.18, 1.5, -0.66, true);
    add(body, new T.BoxGeometry(0.42, 0.26, 0.12), accent, 0, 1.22, 0.41);
    add(body, new T.TorusGeometry(0.4, 0.08, 8, 20), accent, 0, 1.6, 0).rotation.x = Math.PI / 2;
    add(body, new T.SphereGeometry(0.52, 22, 18), white, 0, 2.02, 0);
    var visor = add(body, new T.SphereGeometry(0.42, 22, 18), new T.MeshStandardMaterial({ color: 0xffc64a, metalness: 0.95, roughness: 0.12, emissive: 0x6b4a08, emissiveIntensity: 0.35 }), 0, 2.02, 0.21);
    visor.scale.set(1, 0.78, 0.92);
    add(body, new T.BoxGeometry(0.16, 0.12, 0.2), glow(0xdfeeff, 2), 0.36, 2.36, 0.26, true);       // helmet lamp
    add(body, new T.CylinderGeometry(0.02, 0.02, 0.5, 5), grey, 0.26, 1.9, -0.5);
    var tip = add(body, new T.SphereGeometry(0.06, 8, 8), glow(0xff5a5a, 2), 0.26, 2.17, -0.5, true);
    function limb(x, y, len, rad, endGeo, endY, endZ) {
      var p = new T.Group(); p.position.set(x, y, 0); body.add(p);
      add(p, new T.CapsuleGeometry(rad, len, 4, 10), white, 0, -len / 2 - rad * 0.4, 0);
      add(p, endGeo, accent, 0, endY, endZ);
      return p;
    }
    var armL = limb(-0.58, 1.48, 0.36, 0.13, new T.SphereGeometry(0.16, 10, 10), -0.58, 0);
    var armR = limb(0.58, 1.48, 0.36, 0.13, new T.SphereGeometry(0.16, 10, 10), -0.58, 0);
    var legL = limb(-0.22, 0.74, 0.3, 0.17, new T.BoxGeometry(0.32, 0.2, 0.46), -0.62, 0.06);
    var legR = limb(0.22, 0.74, 0.3, 0.17, new T.BoxGeometry(0.32, 0.2, 0.46), -0.62, 0.06);
    // the drill (only shown while drilling)
    var drill = new T.Group(); drill.position.set(0, 0.95, 0.7); body.add(drill); drill.visible = false;
    add(drill, new T.BoxGeometry(0.3, 0.5, 0.3), soft(0xffc533), 0, 0.2, 0);
    var bit = add(drill, new T.ConeGeometry(0.09, 0.9, 6), new T.MeshStandardMaterial({ color: 0xb8bcc8, metalness: 0.8, roughness: 0.3 }), 0, -0.45, 0); bit.rotation.x = Math.PI;
    g.scale.setScalar(0.84);
    root.add(g);
    return { group: g, body: body, armL: armL, armR: armR, legL: legL, legR: legR, tip: tip, drill: drill, bit: bit,
      pos: new T.Vector3(0, 0, 13), vel: new T.Vector3(), vy: 0, yaw: Math.PI, onGround: true, mode: 'walk', carrying: null,
      aim: false, phase: 0, moving: 0, squash: 0, throwT: 0, spin: 0, stepSide: 1, moved: 0, lastStep: 0 };
  }

  function buildBuddy() {
    var g = new T.Group(), white = soft(0xfafbff, { roughness: 0.4 });
    add(g, new T.SphereGeometry(0.38, 20, 16), white, 0, 0, 0);
    var face = add(g, new T.SphereGeometry(0.33, 20, 16), soft(0x131a2e, { roughness: 0.2 }), 0, 0.02, 0.11); face.scale.set(1, 0.7, 0.9);
    var eyeM = glow(0x5cf0ff, 2.2);
    var eL = add(g, new T.SphereGeometry(0.065, 10, 10), eyeM, -0.13, 0.05, 0.39, true), eR = add(g, new T.SphereGeometry(0.065, 10, 10), eyeM, 0.13, 0.05, 0.39, true);
    add(g, new T.CylinderGeometry(0.015, 0.015, 0.3, 5), white, 0, 0.48, 0);
    add(g, new T.SphereGeometry(0.055, 8, 8), glow(0xffd23f, 2.5), 0, 0.65, 0, true);
    var ring = add(g, new T.TorusGeometry(0.46, 0.035, 6, 24), glow(0x5cf0ff, 1.2), 0, -0.32, 0, true); ring.rotation.x = Math.PI / 2;
    root.add(g);
    return { group: g, eL: eL, eR: eR, ring: ring, pos: new T.Vector3(1.4, 2.4, 13) };
  }

  // ---------- rover ----------
  function buildRover() {
    var g = new T.Group(), body = new T.Group(); g.add(body);
    var white = soft(0xf2f3f7), dark = soft(0x2b3147), orange = soft(0xff8a3d);
    add(body, new T.BoxGeometry(2.3, 0.4, 4.6), white, 0, 0.95, 0);
    add(body, new T.BoxGeometry(2.1, 0.5, 1.5), orange, 0, 1.3, 1.3);
    add(body, new T.BoxGeometry(1.5, 0.12, 0.9), dark, 0, 1.25, 0.25);                      // seat
    add(body, new T.BoxGeometry(1.5, 0.9, 0.14), dark, 0, 1.7, -0.2);
    var wheel = add(body, new T.TorusGeometry(0.3, 0.05, 6, 16), dark, 0, 1.85, 1.0); wheel.rotation.x = -0.6;
    // roll bar + antenna + lights
    [-1.05, 1.05].forEach(function (x) { add(body, new T.CylinderGeometry(0.06, 0.06, 1.7, 6), white, x, 2.0, -0.3); });
    add(body, new T.BoxGeometry(2.2, 0.1, 0.12), white, 0, 2.85, -0.3);
    add(body, new T.CylinderGeometry(0.02, 0.02, 1.6, 5), white, 0.95, 3.6, -0.3);
    add(body, new T.SphereGeometry(0.07, 8, 8), glow(0xff5a5a, 2), 0.95, 4.42, -0.3, true);
    var hlM = glow(0xfff6d8, 2.2);
    [-0.75, 0.75].forEach(function (x) { add(body, new T.SphereGeometry(0.17, 10, 8), hlM, x, 1.3, 2.1, true); });
    // cargo bed
    add(body, new T.BoxGeometry(2.1, 0.12, 1.9), soft(0x8a8fa0), 0, 1.2, -1.3);
    [[-1.05, -1.3, 0.1, 1.9], [1.05, -1.3, 0.1, 1.9], [0, -2.25, 2.2, 0.1]].forEach(function (r) { add(body, new T.BoxGeometry(r[2], 0.5, r[3]), soft(0xffc533), r[0], 1.5, r[1]); });
    // power socket on the back
    add(body, new T.CylinderGeometry(0.45, 0.4, 0.4, 14), dark, 0, 1.25, -2.55);
    var ring = add(body, new T.TorusGeometry(0.46, 0.07, 8, 20), glow(0xffd23f, 1.4), 0, 1.46, -2.55, true); ring.rotation.x = Math.PI / 2;
    var wheels = [];
    [-1.6, 0, 1.6].forEach(function (z) { [-1.25, 1.25].forEach(function (x) {
      var w = new T.Group(); w.position.set(x, 0.62, z); g.add(w);
      var tire = add(w, new T.CylinderGeometry(0.62, 0.62, 0.42, 12), mat(0x22252f), 0, 0, 0); tire.rotation.z = Math.PI / 2;
      add(w, new T.CylinderGeometry(0.3, 0.3, 0.46, 8), soft(0xdfe2ea), 0, 0, 0).rotation.z = Math.PI / 2;
      add(w, new T.BoxGeometry(0.46, 0.14, 1.0), mat(0x3a3e4c), 0, 0, 0);
      wheels.push(w);
    }); });
    var lightL = new T.SpotLight(0xfff2cc, 0, 40, 0.7, 0.5, 1.3); lightL.position.set(0, 1.4, 2.2); body.add(lightL);
    lightL.target.position.set(0, 0, 14); body.add(lightL.target);
    root.add(g);
    var p = Tn.L.roverPark;
    return { group: g, body: body, wheels: wheels, ring: ring, light: lightL, pos: new T.Vector3(p[0], Tn.height(p[0], p[1]), p[1]),
      yaw: Math.PI / 2, speed: 0, vy: 0, lastGnd: 0, onGround: true, pitch: 0, roll: 0, bed: [null, null, null, null], trackD: 0, driver: false };
  }
  var BED = [[-0.5, 1.6, -0.85], [0.5, 1.6, -0.85], [-0.5, 1.6, -1.7], [0.5, 1.6, -1.7]];
  function roverLocal(x, y, z, out) {
    var s = Math.sin(rover.yaw), c = Math.cos(rover.yaw);
    return out.set(rover.pos.x + x * c + z * s, rover.pos.y + y, rover.pos.z - x * s + z * c);
  }
  A.roverSpot = function (name, out) {
    if (name === 'bed') return roverLocal(0, 1.7, -1.3, out);
    if (name === 'socket') return roverLocal(0, 1.7, -2.55, out);
    if (name === 'door') return roverLocal(-2.1, 0, 0.5, out);
    return roverLocal(0, 0, 0, out);
  };
  A.bedFree = function () { for (var i = 0; i < 4; i++) if (!rover.bed[i]) return i; return -1; };
  A.toBed = function (it) {
    var i = A.bedFree(); if (i < 0) return false;
    if (astro.carrying === it) astro.carrying = null;
    rover.bed[i] = it; it.state = 'bed'; it.slot = i; it.vel.set(0, 0, 0);
    return true;
  };

  // ---------- things you can carry ----------
  function itemMesh(type, data) {
    var g = new T.Group(), k;
    if (type === 'cell') {
      add(g, new T.CylinderGeometry(0.3, 0.3, 0.8, 14), glow(0xffe36a, 1.5), 0, 0, 0);
      add(g, new T.CylinderGeometry(0.32, 0.32, 0.14, 14), soft(0x2b3147), 0, 0.37, 0); add(g, new T.CylinderGeometry(0.32, 0.32, 0.14, 14), soft(0x2b3147), 0, -0.37, 0);
      add(g, new T.CylinderGeometry(0.12, 0.12, 0.1, 8), soft(0xdfe2ea), 0, 0.48, 0);
    } else if (type === 'ice') {
      add(g, new T.IcosahedronGeometry(0.42, 0), new T.MeshStandardMaterial({ color: 0xdff7ff, emissive: 0x58c8ff, emissiveIntensity: 0.9, roughness: 0.15, flatShading: true, transparent: true, opacity: 0.92 }), 0, 0, 0);
    } else if (type === 'bag') {
      var b = add(g, new T.SphereGeometry(0.5, 8, 6), mat(site === 'mars' ? 0xa9582f : 0x7b7c87), 0, 0, 0); b.scale.set(1.15, 0.6, 0.8);
      add(g, new T.TorusGeometry(0.3, 0.035, 5, 12), soft(0xf2e6c8), 0, 0, 0).rotation.y = Math.PI / 2;
    } else if (type === 'core') {
      add(g, new T.CylinderGeometry(0.13, 0.13, 0.7, 10), new T.MeshStandardMaterial({ color: 0xcfd3de, metalness: 0.8, roughness: 0.25 }), 0, 0, 0);
      add(g, new T.CylinderGeometry(0.15, 0.15, 0.16, 10), glow([0xc9824a, 0xdfe2ea, 0xffd23f][data ? data.quality : 1], 1.3), 0, 0.36, 0);
    } else if (type === 'crate') {
      add(g, new T.BoxGeometry(0.85, 0.5, 0.62), soft(0xc9965a), 0, 0, 0);
      for (k = 0; k < 5; k++) add(g, new T.SphereGeometry(0.16, 8, 6), k % 2 ? soft(0x4fd15a) : glow(0xff4a3a, 0.35), -0.27 + (k % 3) * 0.27, 0.3, k < 3 ? -0.13 : 0.14);
    } else if (type === 'inst') {
      var col = { seismo: 0x5cf0ff, beam: 0xffd23f, rad: 0xff6fb1 }[data.id] || 0xffffff;
      add(g, new T.BoxGeometry(0.8, 0.7, 0.8), soft(0xf2f3f7), 0, 0, 0);
      add(g, new T.BoxGeometry(0.84, 0.18, 0.84), glow(col, 0.9), 0, 0.05, 0);
      add(g, new T.TorusGeometry(0.2, 0.04, 6, 12), soft(0x2b3147), 0, 0.42, 0);
    } else {
      add(g, new T.BoxGeometry(1.0, 0.5, 0.7), soft(0xff8a3d), 0, 0, 0);
      add(g, new T.BoxGeometry(1.04, 0.1, 0.74), soft(0x2b3147), 0, 0.02, 0);
      add(g, new T.TorusGeometry(0.2, 0.04, 6, 12), soft(0x2b3147), 0, 0.3, 0);
    }
    return g;
  }
  var RADIUS = { cell: 0.4, ice: 0.4, bag: 0.32, core: 0.34, crate: 0.3, inst: 0.38, 'case': 0.28 };
  A.spawn = function (type, pos, data, state) {
    var it = { type: type, mesh: itemMesh(type, data), pos: pos.clone(), vel: new T.Vector3(), state: state || 'rest', r: RADIUS[type] || 0.35,
      data: data || null, spin: 0, from: null, slot: -1, tag: null, age: 0 };
    it.mesh.position.copy(it.pos);
    root.add(it.mesh);
    A.items.push(it);
    return it;
  };
  A.remove = function (it) {
    var i = A.items.indexOf(it); if (i >= 0) A.items.splice(i, 1);
    if (astro.carrying === it) astro.carrying = null;
    if (it.state === 'bed' && it.slot >= 0) rover.bed[it.slot] = null;
    root.remove(it.mesh);
  };
  A.pick = function (it) {
    if (it.state === 'bed' && it.slot >= 0) { rover.bed[it.slot] = null; it.slot = -1; }
    it.state = 'held'; it.vel.set(0, 0, 0); it.from = null; astro.carrying = it;
  };
  A.handPos = function (out) {
    var s = Math.sin(astro.yaw), c = Math.cos(astro.yaw);
    return out.set(astro.pos.x + s * 0.72, astro.pos.y + 1.15, astro.pos.z + c * 0.72);
  };
  A.setDown = function () {
    var it = astro.carrying; if (!it) return null;
    astro.carrying = null; it.state = 'fly'; it.from = null;
    it.vel.set(Math.sin(astro.yaw) * 1.2 + astro.vel.x, 0.6, Math.cos(astro.yaw) * 1.2 + astro.vel.z);
    return it;
  };
  function throwVel(power, out) {
    var v = lerp(THROW_MIN, THROW_MAX, power);
    W.forward(v1);
    return out.set(v1.x * Math.cos(THROW_ANGLE) * v, Math.sin(THROW_ANGLE) * v, v1.z * Math.cos(THROW_ANGLE) * v);
  }
  A.throwHeld = function (power) {
    var it = astro.carrying; if (!it) return null;
    A.handPos(it.pos); it.pos.y += 0.5;
    throwVel(power, it.vel); it.vel.x += astro.vel.x * 0.5; it.vel.z += astro.vel.z * 0.5;
    it.state = 'fly'; it.from = astro.pos.clone(); it.spin = 3 + power * 5;
    astro.carrying = null; astro.throwT = 0.35;
    return it;
  };
  // The arc a throw would follow — the same physics the real throw uses.
  A.trajectory = function (power, pts) {
    A.handPos(v2); v2.y += 0.5; throwVel(power, v3);
    var n = 0, dt = 0.09, x = v2.x, y = v2.y, z = v2.z, vy = v3.y;
    for (var i = 0; i < 110 && n < pts.length; i++) {
      x += v3.x * dt; z += v3.z * dt; vy -= grav * dt; y += vy * dt;
      if (i % 2 === 0) pts[n++].set(x, y, z);
      if (y <= Tn.height(x, z) + 0.2) break;
    }
    A.landing = v2.set(x, y, z);
    return n;
  };

  // ---------- dust devils (Mars) ----------
  function buildDevils() {
    A.devils = [];
    if (site !== 'mars') return;
    for (var i = 0; i < 2; i++) {
      var g = new T.Group(), m = new T.MeshBasicMaterial({ color: 0xe2b98c, transparent: true, opacity: 0.22, side: T.DoubleSide, depthWrite: false, fog: false });
      for (var k = 0; k < 6; k++) { var c = add(g, new T.CylinderGeometry(1.2 + k * 0.75, 0.6 + k * 0.6, 3.4, 10, 1, true), m, 0, 1.7 + k * 3.3, 0, true); c.userData.k = k; }
      root.add(g);
      A.devils.push({ group: g, pos: new T.Vector3(i ? 90 : -70, 0, i ? 60 : -40), dir: i * 2.5, target: new T.Vector3(), timer: 0, cool: 0, toBase: i === 0 });
    }
  }
  function updateDevils(dt) {
    for (var i = 0; i < A.devils.length; i++) {
      var d = A.devils[i];
      d.timer -= dt; d.cool -= dt;
      if (d.timer <= 0) {
        d.timer = 16 + Math.random() * 14;
        d.toBase = !d.toBase;
        if (d.toBase) d.target.set(Tn.L.solar[0] + (Math.random() - 0.5) * 8, 0, Tn.L.solar[1] + (Math.random() - 0.5) * 8);
        else { var a = Math.random() * 6.28; d.target.set(Math.cos(a) * 120, 0, Math.sin(a) * 120); }
      }
      var want = Math.atan2(d.target.x - d.pos.x, d.target.z - d.pos.z);
      d.dir = angLerp(d.dir, want + Math.sin(W.time * 0.7 + i) * 0.8, Math.min(1, dt * 0.8));
      d.pos.x += Math.sin(d.dir) * 6.5 * dt; d.pos.z += Math.cos(d.dir) * 6.5 * dt;
      d.pos.y = Tn.height(d.pos.x, d.pos.z);
      d.group.position.copy(d.pos);
      d.group.children.forEach(function (c) { c.rotation.y += dt * (5 - c.userData.k * 0.5); c.position.x = Math.sin(W.time * 2 + c.userData.k) * 0.3 * c.userData.k; });
      if (Math.random() < dt * 20) W.emit(d.pos.x + (Math.random() - 0.5) * 2, d.pos.y + 0.3, d.pos.z + (Math.random() - 0.5) * 2, { vx: (Math.random() - 0.5) * 6, vy: 3 + Math.random() * 5, vz: (Math.random() - 0.5) * 6, life: 2, size: 0.7, grow: 2.5, color: 0xdba878, alpha: 0.4 });
      if (d.cool <= 0 && Math.hypot(d.pos.x - Tn.L.solar[0], d.pos.z - Tn.L.solar[1]) < 9) { d.cool = 50; if (A.onDevil) A.onDevil('clean'); }
      if (astro.mode === 'walk' && Math.hypot(d.pos.x - astro.pos.x, d.pos.z - astro.pos.z) < 3) { astro.spin = 1.2; if (A.onDevil) A.onDevil('astro'); }
    }
  }

  // ---------- build ----------
  A.build = function (rootGroup, siteId, suitColor) {
    root = rootGroup; site = siteId; grav = JA.SITES[site].gravity;
    add = W.add; mat = W.mat; soft = W.soft; glow = W.glow;
    A.items = [];
    astro = A.astro = buildAstronaut(suitColor || 0xff7a3d);
    buddy = A.buddy = buildBuddy();
    rover = A.rover = buildRover();
    buildDevils();
    A.resetAstro();
  };
  A.resetAstro = function () {
    var d = B.spots.door;
    astro.pos.set(d.x, Tn.height(d.x, d.z + 2.4), d.z + 2.4); astro.vel.set(0, 0, 0); astro.vy = 0; astro.onGround = true; astro.yaw = 0; astro.mode = 'walk';
  };

  // ---------- movement ----------
  function collideCircle(p, r) {
    var C = B.colliders;
    for (var i = 0; i < C.length; i++) {
      var c = C[i], dx = p.x - c.x, dz = p.z - c.z, min = c.r + r;
      if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
      var d = Math.hypot(dx, dz);
      if (d < min && d > 0.0001) { p.x = c.x + dx / d * min; p.z = c.z + dz / d * min; return c; }
    }
    return null;
  }
  function inBounds(p) {
    var r = Math.hypot(p.x, p.z);
    if (r > Tn.PLAY_R) { p.x *= Tn.PLAY_R / r; p.z *= Tn.PLAY_R / r; return false; }
    return true;
  }

  function updateAstro(dt, input) {
    var a = astro, ix = 0, iz = 0, jump = false, sprint = false;
    a.group.visible = a.mode !== 'hidden';
    if (a.mode === 'hidden') return;
    if (a.mode === 'drive') {
      roverLocal(0, 1.3, 0.25, a.pos); a.yaw = rover.yaw;
      a.group.position.copy(a.pos); a.group.rotation.y = a.yaw;
      a.legL.rotation.x = a.legR.rotation.x = -1.45; a.armL.rotation.x = a.armR.rotation.x = -1.2;
      a.body.rotation.x = 0; a.drill.visible = false;
      return;
    }
    if (a.mode === 'walk' && input) { ix = input.x; iz = input.z; jump = input.jump; sprint = input.sprint; }
    var len = Math.hypot(ix, iz);
    if (len > 1) { ix /= len; iz /= len; len = 1; }
    W.forward(v1);
    var mx = -v1.z * ix - v1.x * iz, mz = v1.x * ix - v1.z * iz;         // camera-relative: right*ix + back*iz
    var speed = (sprint ? 8.8 : 5.8) * (a.carrying ? 0.93 : 1);
    var k = Math.min(1, dt * (a.onGround ? 11 : 1.6));
    a.vel.x += (mx * speed - a.vel.x) * k; a.vel.z += (mz * speed - a.vel.z) * k;
    a.pos.x += a.vel.x * dt; a.pos.z += a.vel.z * dt;
    a.moved += Math.hypot(a.vel.x, a.vel.z) * dt;
    if (!inBounds(a.pos) && A.onEdge) A.onEdge();
    if (collideCircle(a.pos, 0.5)) collideCircle(a.pos, 0.5);
    var ground = Tn.height(a.pos.x, a.pos.z), landed = false;
    if (a.onGround) {
      if (a.pos.y - ground > 0.35) a.onGround = false; else a.pos.y = ground;
      if (jump) { a.vy = 3.7; a.onGround = false; if (A.onJump) A.onJump(); }
    }
    if (!a.onGround) {
      a.vy -= grav * dt; a.pos.y += a.vy * dt;
      if (a.pos.y <= ground) { landed = a.vy < -1.2; a.pos.y = ground; a.vy = 0; a.onGround = true; if (landed) a.squash = 1; }
    }
    if (landed && A.onLand) A.onLand();
    a.moving = lerp(a.moving, len, Math.min(1, dt * 10));
    if (a.aim) a.yaw = angLerp(a.yaw, Math.atan2(v1.x, v1.z), Math.min(1, dt * 14));
    else if (len > 0.1) a.yaw = angLerp(a.yaw, Math.atan2(mx, mz), Math.min(1, dt * 12));
    if (a.spin > 0) { a.spin -= dt; a.yaw += dt * 9; }
    if (len > 0.1 && a.onGround) {
      a.phase += dt * (sprint ? 13 : 10);
      var step = Math.floor(a.phase / Math.PI);
      if (step !== a.lastStep) { a.lastStep = step; a.stepSide = -a.stepSide; if (A.onStep) A.onStep(a.pos, a.yaw, a.stepSide, sprint); }
    }
    a.squash = Math.max(0, a.squash - dt * 5); a.throwT = Math.max(0, a.throwT - dt);
    var sw = Math.sin(a.phase) * 0.85 * a.moving, air = a.onGround ? 0 : 1;
    a.legL.rotation.x = lerp(sw, 0.5, air); a.legR.rotation.x = lerp(-sw, -0.3, air);
    a.drill.visible = a.mode === 'busy';
    if (a.mode === 'busy') {
      a.armL.rotation.x = a.armR.rotation.x = -0.75 + Math.sin(W.time * 40) * 0.04;
      a.body.rotation.x = 0.16; a.bit.rotation.y += dt * 30;
    } else if (a.throwT > 0) {
      a.armL.rotation.x = a.armR.rotation.x = -2.6 * (a.throwT / 0.35); a.body.rotation.x = 0.2 * (a.throwT / 0.35);
    } else if (a.carrying) {
      a.armL.rotation.x = a.armR.rotation.x = a.aim ? -2.1 : -1.25; a.body.rotation.x = a.aim ? -0.18 : 0;
    } else {
      a.armL.rotation.x = lerp(-sw, -2.4, air); a.armR.rotation.x = lerp(sw, -2.4, air); a.body.rotation.x = sprint && len > 0.1 ? 0.14 : 0;
    }
    a.armL.rotation.z = a.carrying || a.mode === 'busy' ? 0.3 : -0.18; a.armR.rotation.z = a.carrying || a.mode === 'busy' ? -0.3 : 0.18;
    var bob = a.onGround ? Math.abs(Math.sin(a.phase)) * 0.1 * a.moving : 0;
    a.group.position.set(a.pos.x, a.pos.y + bob, a.pos.z);
    a.group.rotation.y = a.yaw;
    a.group.scale.set(0.84 * (1 + a.squash * 0.12), 0.84 * (1 - a.squash * 0.16), 0.84 * (1 + a.squash * 0.12));
    a.tip.material.emissiveIntensity = 1.2 + Math.sin(W.time * 6);
  }

  function updateRover(dt, input) {
    var r = rover, thr = 0, steer = 0;
    if (r.driver && input) { thr = -input.z; steer = input.x; }
    var stuck = !!(A.roverStuck && A.roverStuck());
    if (stuck) { thr = 0; r.speed *= Math.max(0, 1 - dt * 6); }
    r.sink = lerp(r.sink || 0, stuck ? 0.5 : 0, Math.min(1, dt * 2));
    var charged = !A.roverCharge || A.roverCharge() > 0;
    var max = thr >= 0 ? (charged ? 13.5 : 3) : 5;
    if (thr !== 0 && Math.abs(r.speed) < max) r.speed += thr * 9 * dt * (r.onGround ? 1 : 0.2);
    r.speed -= r.speed * (thr === 0 ? 1.6 : 0.25) * dt;
    if (Math.abs(r.speed) > max) r.speed = lerp(r.speed, Math.sign(r.speed) * max, Math.min(1, dt * 3));
    if (r.onGround) r.yaw -= steer * 1.7 * dt * clamp(r.speed / 4.5, -1, 1);
    var s = Math.sin(r.yaw), c = Math.cos(r.yaw);
    r.pos.x += s * r.speed * dt; r.pos.z += c * r.speed * dt;
    if (!inBounds(r.pos)) r.speed *= 0.5;
    if (collideCircle(r.pos, 1.9)) r.speed *= 0.86;
    var gnd = Tn.height(r.pos.x, r.pos.z);
    r.vy -= grav * dt; r.pos.y += r.vy * dt;
    if (r.pos.y <= gnd) {
      if (!r.onGround && r.vy < -3) { W.dust(r.pos.x, r.pos.z, 14, 3.5, 0.8); if (A.onLand) A.onLand(true); }
      r.vy = clamp((gnd - r.lastGnd) / Math.max(dt, 0.001), 0, 8);
      r.pos.y = gnd; r.onGround = true;
    } else r.onGround = r.pos.y - gnd < 0.12;
    r.lastGnd = gnd;
    var hf = Tn.height(r.pos.x + s * 1.8, r.pos.z + c * 1.8), hb = Tn.height(r.pos.x - s * 1.8, r.pos.z - c * 1.8);
    var hl = Tn.height(r.pos.x - c * 1.2, r.pos.z + s * 1.2), hr = Tn.height(r.pos.x + c * 1.2, r.pos.z - s * 1.2);
    var k = Math.min(1, dt * (r.onGround ? 8 : 1.5));
    r.pitch = lerp(r.pitch, r.onGround ? Math.atan2(hb - hf, 3.6) : r.pitch, k);
    r.roll = lerp(r.roll, r.onGround ? Math.atan2(hr - hl, 2.4) : r.roll, k);
    r.group.position.copy(r.pos); r.group.position.y -= r.sink;
    r.group.rotation.set(0, 0, 0); r.group.rotateY(r.yaw); r.group.rotateX(r.pitch + r.sink * 0.16); r.group.rotateZ(r.roll);
    for (var i = 0; i < r.wheels.length; i++) { r.wheels[i].rotation.x += r.speed * dt / 0.62; if (i >= 4) r.wheels[i].rotation.y = -steer * 0.35; }
    var mv = Math.abs(r.speed);
    if (r.onGround && mv > 2) {
      if (Math.random() < dt * mv * 2.2) W.dust(r.pos.x - s * 2 + (Math.random() - 0.5) * 2, r.pos.z - c * 2 + (Math.random() - 0.5) * 2, 1, 1.5, 0.7);
      r.trackD += mv * dt;
      if (r.trackD > 1.1) { r.trackD = 0; W.print(r.pos.x - c * 1.25, r.pos.z + s * 1.25, r.yaw, 0.42, 1.2); W.print(r.pos.x + c * 1.25, r.pos.z - s * 1.25, r.yaw, 0.42, 1.2); }
    }
    r.light.intensity = lerp(r.light.intensity, r.driver ? 0.6 + W.env.dark * 2.4 : 0, Math.min(1, dt * 4));
    r.ring.material.emissiveIntensity = charged ? 0.6 : 1 + Math.sin(W.time * 6);
    r.ring.material.color.set(charged ? 0x46ff8a : 0xffd23f); r.ring.material.emissive.copy(r.ring.material.color);
  }

  function updateItems(dt) {
    for (var i = 0; i < A.items.length; i++) {
      var it = A.items[i];
      it.age += dt;
      if (it.state === 'held') {
        A.handPos(it.pos);
        if (astro.aim) it.pos.y += 0.5;
        it.mesh.rotation.set(0, astro.yaw, 0);
      } else if (it.state === 'bed') {
        var b = BED[it.slot]; roverLocal(b[0], b[1], b[2], it.pos);
        it.mesh.rotation.set(0, rover.yaw, 0);
      } else if (it.state === 'fly') {
        it.vel.y -= grav * dt;
        it.pos.addScaledVector(it.vel, dt);
        it.mesh.rotation.x += it.spin * dt; it.mesh.rotation.z += it.spin * 0.6 * dt;
        var gnd = Tn.height(it.pos.x, it.pos.z) + it.r;
        if (it.pos.y - gnd < 3.4) {
          var c = collideCircle(it.pos, it.r);
          if (c) { var nx = (it.pos.x - c.x), nz = (it.pos.z - c.z), nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl; var vn = it.vel.x * nx + it.vel.z * nz; if (vn < 0) { it.vel.x -= 1.5 * vn * nx; it.vel.z -= 1.5 * vn * nz; } }
        }
        if (it.pos.y <= gnd) {
          it.pos.y = gnd;
          var hit = Math.abs(it.vel.y);
          if (hit > 1.1) { it.vel.y = hit * 0.3; it.vel.x *= 0.55; it.vel.z *= 0.55; it.spin *= 0.5; if (A.onBounce) A.onBounce(it, hit); }
          else { it.state = 'rest'; it.vel.set(0, 0, 0); it.from = null; it.mesh.rotation.set(0, it.mesh.rotation.y, 0); }
        }
        if (Math.hypot(it.pos.x, it.pos.z) > Tn.PLAY_R + 6) { it.vel.x *= -0.4; it.vel.z *= -0.4; inBounds(it.pos); }
      } else if (it.state === 'fixed') {
        it.mesh.rotation.y += dt * 0.8;
      }
      it.mesh.position.copy(it.pos);
    }
  }

  A.update = function (dt, input) {
    if (!astro) return;
    updateRover(dt, input);
    updateAstro(dt, rover.driver ? null : input);
    updateItems(dt);
    updateDevils(dt);
    // robot buddy
    var f = astro.mode === 'hidden' ? null : astro.pos;
    if (f) {
      buddy.group.visible = true;
      v1.set(f.x + Math.cos(astro.yaw) * 1.5, f.y + (astro.mode === 'drive' ? 3.2 : 2.5) + Math.sin(W.time * 2.2) * 0.16, f.z - Math.sin(astro.yaw) * 1.5);
      buddy.pos.lerp(v1, Math.min(1, dt * 4));
      buddy.group.position.copy(buddy.pos);
      buddy.group.lookAt(W.camera.position);
      buddy.ring.rotation.z += dt * 2;
      buddy.eL.scale.y = buddy.eR.scale.y = (W.time % 3.4) > 3.25 ? 0.1 : 1;
      W.setLamp(f.x, f.y + 2.1, f.z, Math.sin(astro.yaw), Math.cos(astro.yaw));
    } else buddy.group.visible = false;
  };

  A.enterRover = function () { rover.driver = true; astro.mode = 'drive'; astro.vel.set(0, 0, 0); };
  A.exitRover = function () {
    rover.driver = false; astro.mode = 'walk';
    A.roverSpot('door', astro.pos); astro.pos.y = Tn.height(astro.pos.x, astro.pos.z); astro.vy = 0; astro.onGround = true;
  };
  A.focus = function (out) {
    if (rover.driver) return out.set(rover.pos.x, rover.pos.y + 2.4, rover.pos.z);
    return out.set(astro.pos.x, astro.pos.y + 1.7, astro.pos.z);
  };
})(window.JA);
