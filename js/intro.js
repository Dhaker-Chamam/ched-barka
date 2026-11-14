/* Astro Outpost — the landing film that opens a mission.
   Everything is seen through the astronaut's own eyes:
     1. the descent, watched through the lander window
     2. the hatch, and the first bootprint
     3. the walk across the dust
     4. sitting down on a rock and taking in the view
   It uses the real game world (no video), so the outpost you see is the one you will run.
   Sound: inside the lander everything is clear; once the hatch opens you hear the place itself
   (see the scenes in audio.js), and music joins for the last view. */
(function (JA) {
  'use strict';
  var T = window.THREE, W = JA.world, Tn = JA.terrain, B = JA.base, A = JA.actors, Au = JA.audio, U = JA.ui;
  var I = JA.intro = {};
  if (!T) return;
  var st = null;

  // when each shot starts (seconds)
  var TM = { descent: 3.4, land: 17.4, fade1: 20.6, step: 23.8, walk: 33.0, cut: 44.2, walk2: 45.4, sit: 52.0, vista: 57.4, title: 69.2, fade2: 72.6, end: 73.8 };
  var EYE = 1.72, SEAT_EYE = 0.72, STEP = 0.75;

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }
  function seg(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function near(a, ref) { return a + Math.PI * 2 * Math.round((ref - a) / (Math.PI * 2)); }
  function cls(name, on) { $('cine').classList.toggle(name, !!on); }

  // ---------- what is said, and when ----------
  // vo: the recorded line in audio/landing/ (each one fits before the next line starts).
  // Lines without a recording fall back to the read-aloud voice.
  var VO = 'audio/landing/';
  function script(s) {
    var moon = s.site.id === 'moon', dw = s.site.dayWord.toLowerCase() + 's';
    var home = (moon ? { 5: '13-home-5-days', 8: '14-home-8-days', 10: '15-home-10-days' } : { 5: '21-home-5-sols', 8: '22-home-8-sols', 10: '23-home-10-sols' })[s.totalSols];
    return [
      { t: 4.6, who: 'Mission Control', text: 'Outpost One, you are GO for landing.', dur: 3.0, radio: true, vo: '01-go-for-landing' },
      { t: 8.4, text: 'There it is. The robots finished building it last week.', dur: 3.4, vo: '05-there-it-is' },
      { t: 12.6, who: 'BOLT', text: 'Sixty metres… thirty… the engine is kicking up dust!', dur: 3.6, radio: true, vo: '02-sixty-metres' },
      { t: TM.land + 0.3, who: 'BOLT', text: 'Contact! Engines off.', dur: 2.3, radio: true, vo: '03-contact' },
      { t: TM.land + 2.8, text: 'We made it.', dur: 1.9, vo: '06-we-made-it' },
      { t: TM.step + 0.4, text: 'Here goes. My first step on ' + s.site.name + '.', dur: 2.6, vo: moon ? '09-first-step-moon' : '17-first-step-mars' },
      { t: TM.step + 3.7, text: moon ? 'My first bootprint. With no wind and no rain, it could stay here for a million years.'
        : 'My first bootprint. One day the wind will sweep it away. But not today.', dur: 4.2, vo: moon ? '10-bootprint-moon' : '18-bootprint-mars' },
      { t: TM.walk + 1.8, text: moon ? 'No air. No sound. Only my own breathing.' : 'Thin, cold air, and a sky the colour of butterscotch.', dur: 3.4, vo: moon ? '11-no-air-moon' : '19-thin-air-mars' },
      { t: TM.walk + 6.0, text: moon ? 'And gravity so gentle that every step is a little flight.' : 'And gravity so gentle that I weigh about a third of what I do on Earth.', dur: 3.8, vo: moon ? '12-gravity-moon' : '20-gravity-mars' },
      { t: TM.walk2 + 1.2, text: 'That rock looks like a good seat.', dur: 3.0, vo: '07-good-seat' },
      { t: TM.sit + 2.7, text: 'Stop. Sit. Breathe.', dur: 2.3, vo: '08-stop-sit-breathe' },
      { t: TM.vista + 2.6, text: 'That is the outpost. My home for the next ' + s.totalSols + ' ' + dw + '.', dur: 3.6, vo: home },
      { t: TM.vista + 6.8, text: moon ? 'And that is Earth. Everyone I have ever known is on that small blue ball.' : 'Somewhere in that sky, Earth is just a pale dot of light.', dur: 3.9, vo: moon ? '16-earth-moon' : '24-earth-mars' },
      { t: TM.vista + 11.0, who: 'BOLT', text: 'Ready when you are, Commander.', dur: 2.6, radio: true, vo: '04-ready-commander' }
    ];
  }
  function say(c) {
    var el = $('cine-line');
    el.innerHTML = (c.who ? '<b>' + U.esc(c.who) + '</b>' : '') + U.esc(c.text);
    el.className = 'show' + (c.who ? ' radio' : '');
    st.lineOff = c.t + c.dur;
    if (c.radio) Au.play('radio');
    // the recorded voice plays with sound on (or with read-aloud on, in place of the browser voice)
    if (c.vo && (Au.soundOn() || Au.readingOn())) Au.voice(VO + c.vo + '.mp3');
    else Au.speak(c.text);
  }
  function title(small, big, sub) {
    var el = $('cine-title');
    if (!small && !big) { el.className = ''; return; }
    el.children[0].textContent = small || ''; el.children[1].textContent = big || ''; el.children[2].textContent = sub || '';
    el.className = 'show' + (big ? '' : ' minor') + (st && st.t > TM.vista ? ' sky' : '');
  }

  // ---------- your own body, seen when you look down ----------
  function buildRig(color) {
    var g = new T.Group(), white = W.soft(0xf5f6fa), accent = W.soft(color), dark = W.soft(0x2b3147), grey = W.soft(0xcfd3de);
    function part(parent, geo, m, x, y, z) { var o = W.add(parent, geo, m, x, y, z, true); o.receiveShadow = true; return o; }
    function leg(x) {
      var hip = new T.Group(); hip.position.set(x, -0.8, 0.06); g.add(hip);
      part(hip, new T.CapsuleGeometry(0.125, 0.22, 4, 10), white, 0, -0.22, 0);
      var knee = new T.Group(); knee.position.set(0, -0.44, 0); hip.add(knee);
      part(knee, new T.SphereGeometry(0.135, 12, 10), grey, 0, 0, 0);
      part(knee, new T.CapsuleGeometry(0.115, 0.2, 4, 10), white, 0, -0.2, 0);
      part(knee, new T.BoxGeometry(0.25, 0.17, 0.42), accent, 0, -0.43, 0.08);
      part(knee, new T.BoxGeometry(0.27, 0.05, 0.44), dark, 0, -0.52, 0.08);
      return { hip: hip, knee: knee };
    }
    var hands = new T.Group(); g.add(hands);
    [-0.17, 0.17].forEach(function (x) { var h = part(hands, new T.SphereGeometry(0.085, 12, 10), accent, x, -0.6, 0.47); h.scale.set(1, 0.7, 1.25); });
    W.root.add(g);
    // an unseen body that still throws your shadow across the ground
    var ghost = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    var sh = new T.Group();
    [[new T.CapsuleGeometry(0.34, 0.9, 4, 8), 0, -0.85, -0.05], [new T.SphereGeometry(0.4, 10, 8), 0, 0.02, -0.05], [new T.BoxGeometry(0.6, 0.8, 0.34), 0, -0.6, -0.4]].forEach(function (p) {
      var m = new T.Mesh(p[0], ghost); m.position.set(p[1], p[2], p[3]); m.castShadow = true; sh.add(m);
    });
    W.root.add(sh);
    return { group: g, L: leg(-0.17), R: leg(0.17), hands: hands, shadow: sh };
  }
  function poseRig(dt) {
    var r = st.rig, e = st.eye, q = st.sitQ;
    r.group.visible = r.shadow.visible = st.body;
    if (!st.body) return;
    // when you bend to look at your feet, your eyes move ahead of your body
    r.group.position.set(e.x - Math.sin(st.bodyYaw) * st.lean, e.y, e.z - Math.cos(st.bodyYaw) * st.lean); r.group.rotation.y = st.bodyYaw;
    r.shadow.position.copy(r.group.position); r.shadow.rotation.y = st.bodyYaw;
    r.shadow.scale.y = lerp(1, 0.72, q);
    [r.L, r.R].forEach(function (l, i) {
      var a = i ? st.legR : st.legL;
      l.hip.position.y = lerp(-0.8, -0.7, q) + a.y;
      l.hip.rotation.x = lerp(a.rot, -1.42, q);
      l.knee.rotation.x = lerp(0, 1.38, q);
    });
    r.hands.visible = q > 0.55;
  }

  function setCam() {
    var c = W.cam.cine, e = st.eye, cp = Math.cos(e.pitch);
    c.pos.set(e.x, e.y, e.z);
    c.look.set(e.x + Math.sin(e.yaw) * cp * 10, e.y + Math.sin(e.pitch) * 10, e.z + Math.cos(e.yaw) * cp * 10);
    c.fov = e.fov; c.roll = e.roll;
  }
  function footfall(x, z, yaw, big) {
    W.print(x, z, yaw, 0.26, 0.5);
    W.dust(x, z, big ? 16 : 3, big ? 1.8 : 0.9, big ? 0.5 : 0.3);
    Au.play(big ? 'land' : 'step');
  }

  // ---------- shot 1: the descent, through the lander window ----------
  function shotDescent(t, dt) {
    var e = st.eye, p = st.pad, d = st.dir, rk = B.P.rocket, landed = t >= TM.land;
    var u = seg(t, TM.descent, TM.land), k = 1 - u, T1 = TM.land - TM.descent;
    var alt = landed ? 0 : 250 * Math.pow(k, 1.8), vel = landed ? 0 : 250 * 1.8 * Math.pow(k, 0.8) / T1;
    var back = 150 * k * k, side = 24 * k * k;
    var ox = -d.x * back + d.z * side, oz = -d.z * back - d.x * side;
    rk.group.position.set(ox, alt, oz);
    rk.flame.visible = !landed; rk.flame.scale.set(1, 0.7 + Math.random() * 0.8, 1);
    rk.light.intensity = landed ? 0 : 4 + Math.random() * 2;
    e.x = p.x + ox + d.x * 2.95; e.z = p.z + oz + d.z * 2.95; e.y = p.y + alt + 12.4;
    e.yaw = st.dirYaw + 0.3 * k * k + Math.sin(t * 0.5) * 0.04 * k;
    e.pitch = lerp(-1.0, -0.3, ease(u)) + ease(seg(t, TM.land + 0.2, TM.land + 2.6)) * 0.17;
    e.roll = Math.sin(t * 0.9) * 0.035 * k; e.fov = 58;
    if (!landed) {
      W.cam.shake = Math.max(W.cam.shake, 0.04 + 0.22 * u * u);
      Au.loop('descent', { f: 40 + u * 18, v: 0.07 + 0.06 * u, type: 'sawtooth', rate: 0.85 + u * 0.3, vol: 0.55 + 0.45 * u });
      st.rum -= dt; if (st.rum <= 0) { st.rum = 0.24; Au.play('rumble'); }
      if (alt < 60) {
        var n = W.rate((1 - alt / 60) * 9, dt), gy = Tn.height(p.x + ox, p.z + oz) + 0.4;
        for (var i = 0; i < n; i++) {
          var a = Math.random() * 6.283, r0 = 2 + Math.random() * 4, sp = 12 + Math.random() * 22;
          W.emit(p.x + ox + Math.cos(a) * r0, gy, p.z + oz + Math.sin(a) * r0, { vx: Math.cos(a) * sp, vy: 0.4 + Math.random() * 1.6, vz: Math.sin(a) * sp, life: 1.25, size: 1.5, grow: 3.6, color: st.dustCol, alpha: 0.42, grav: 0 });
        }
      }
    }
    $('cine-data').textContent = landed ? 'ALT 000 m   ·   ENGINE OFF   ·   ' + (st.moon ? 'MOON' : 'MARS') + ' SURFACE'
      : 'ALT ' + ('00' + Math.round(alt)).slice(-3) + ' m   ·   DESCENT ' + vel.toFixed(1) + ' m/s   ·   FUEL ' + Math.round(11 - 6 * u) + '%';
  }
  function touchdown() {
    var p = st.pad;
    Au.stopLoop('descent'); Au.play('touchdown'); W.cam.shake = 0.75;
    for (var i = 0; i < 90; i++) {
      var a = Math.random() * 6.283, sp = 6 + Math.random() * 16;
      W.emit(p.x + Math.cos(a) * 4, p.y + 0.5, p.z + Math.sin(a) * 4, { vx: Math.cos(a) * sp, vy: 1 + Math.random() * 3, vz: Math.sin(a) * sp, life: 2.2 + Math.random(), size: 1.3, grow: 3.6, color: st.dustCol, alpha: 0.34, grav: W.gravity * 0.1 });
    }
  }

  // ---------- shot 2: off the landing pad, the first bootprint ----------
  function shotStep(t) {
    var e = st.eye, tau = t - TM.step, S = st.S, f = st.e;
    // test the ground with one boot, pull it back to look at the print, then step out for real
    var a = ease(seg(tau, 1.3, 2.3)) * (1 - ease(seg(tau, 3.2, 4.1))) + ease(seg(tau, 6.0, 6.9)), b = ease(seg(tau, 6.9, 8.0));
    var up = ease(seg(tau, 7.6, 9.2));
    st.lean = 0.27 * (1 - up);
    e.x = S.x + f.x * (STEP * b + st.lean); e.z = S.z + f.z * (STEP * b + st.lean);
    e.y = lerp(st.pad.y + 0.3, Tn.height(S.x + f.x * STEP, S.z + f.z * STEP), b) + EYE - 0.06 * (1 - up) + Math.sin(t * 1.3) * 0.006;
    e.yaw = st.yawE + Math.sin(t * 0.6) * 0.02; st.bodyYaw = st.yawE;
    e.pitch = lerp(-1.34, -0.05, up);
    e.roll = 0; e.fov = 54;
    st.legR.rot = -0.45 * a * (1 - b); st.legR.y = -0.46 * a * (1 - b);
    st.legL.rot = 0.36 * Math.sin(Math.PI * b); st.legL.y = 0.14 * Math.sin(Math.PI * b);
    var fwd = STEP + 0.08;
    if (!st.fx.r && tau >= 2.3) { st.fx.r = 1; footfall(S.x + f.x * fwd + Math.cos(st.yawE) * 0.17, S.z + f.z * fwd - Math.sin(st.yawE) * 0.17, st.yawE, true); W.cam.shake = 0.07; }
    if (!st.fx.r2 && tau >= 6.9) { st.fx.r2 = 1; Au.play('land'); W.cam.shake = 0.05; }
    if (!st.fx.l && tau >= 8.0) { st.fx.l = 1; footfall(S.x + f.x * fwd - Math.cos(st.yawE) * 0.17, S.z + f.z * fwd + Math.sin(st.yawE) * 0.17, st.yawE, true); W.cam.shake = 0.05; }
  }

  // ---------- shots 3 and 4: walking, with a head that bobs and a little hop ----------
  function walk(dt, speed, x0, z0) {
    var e = st.eye, f = st.e, w = st.w;
    if (w.air) {                                    // a low-gravity hop, using the real gravity
      w.vy -= W.gravity * dt; w.hop += w.vy * dt;
      if (w.hop <= 0) { w.hop = 0; w.air = false; footfall(e.x, e.z, st.yawE, true); W.cam.shake = 0.16; }
    }
    w.dist += speed * dt * (w.air ? 1.25 : 1);
    if (!w.air) {
      w.phase += speed * dt * 4.2;
      var step = Math.floor(w.phase / Math.PI);
      if (step !== w.step) { w.step = step; w.sideSign = -w.sideSign; footfall(e.x - f.x * 0.4 + Math.cos(st.yawE) * 0.17 * w.sideSign, e.z - f.z * 0.4 - Math.sin(st.yawE) * 0.17 * w.sideSign, st.yawE, false); }
    }
    var m = clamp(speed / 2.2, 0, 1) * (w.air ? 0 : 1), sway = Math.sin(w.phase * 0.5);
    e.x = x0 + f.x * w.dist + Math.cos(st.yawE) * sway * 0.035 * m;
    e.z = z0 + f.z * w.dist - Math.sin(st.yawE) * sway * 0.035 * m;
    e.y = Tn.height(e.x, e.z) + EYE + Math.abs(Math.sin(w.phase)) * 0.055 * m + w.hop;
    e.roll = sway * 0.012 * m;
    st.bodyYaw = st.yawE;
  }
  function shotWalk(t, dt) {
    var e = st.eye, tau = t - TM.walk, speed = 2.3 * ease(seg(tau, 0, 1.4));
    if (!st.fx.hop && tau >= 6.4) { st.fx.hop = 1; st.w.air = true; st.w.vy = st.moon ? 1.9 : 2.7; Au.play('jump'); }
    walk(dt, speed, st.P1.x, st.P1.z);
    var glance = ease(seg(tau, 1.6, 4.2)) * (1 - ease(seg(tau, 7.4, 10.4)));
    e.yaw = st.yawE + glance * 0.62 + Math.sin(tau * 0.5) * 0.03;
    e.pitch = -0.05 + glance * 0.03 + (st.w.air ? 0.05 : 0) + Math.sin(tau * 0.7) * 0.012;
    e.fov = 54;
  }
  function speed2(tau) { var len = TM.sit - TM.walk2; return 2.35 * ease(seg(tau, -0.4, 0.8)) * (1 - ease(seg(tau, len - 1.5, len))); }
  function walk2Length() {                 // how far that walk covers, so it ends right at the rock
    var d = 0, h = 1 / 60;
    for (var x = TM.cut + 0.75 - TM.walk2; x < TM.sit - TM.walk2; x += h) d += speed2(Math.max(0, x)) * h;
    return d;
  }
  function shotWalk2(t, dt) {
    var e = st.eye, tau = t - TM.walk2, len = TM.sit - TM.walk2;
    var speed = speed2(tau);
    walk(dt, speed, st.P2.x, st.P2.z);
    e.yaw = st.yawE + Math.sin(tau * 0.6) * 0.03;
    e.pitch = -0.06 - 0.12 * ease(seg(tau, 1, len));
    e.fov = 54;
  }

  // ---------- shot 5: turn around and sit down ----------
  function shotSit(t) {
    var e = st.eye, tau = t - TM.sit, C = st.C;
    if (!st.fx.q) { st.fx.q = 1; st.Q = { x: e.x, z: e.z }; }      // start the turn from exactly where the walk ended
    var Q = st.Q, turn = ease(seg(tau, 0, 2.5)), back = ease(seg(tau, 1.6, 3.2)), down = ease(seg(tau, 2.2, 3.5));
    e.x = lerp(Q.x, C.x, back); e.z = lerp(Q.z, C.z, back);
    e.y = lerp(Tn.height(Q.x, Q.z) + EYE, st.seatY, down) + (tau > 3.5 ? Math.exp(-(tau - 3.5) * 5) * -0.05 * Math.cos((tau - 3.5) * 14) : 0);
    e.yaw = lerp(st.yawE, st.yawSit, turn); st.bodyYaw = e.yaw;
    e.pitch = lerp(-0.18, 0.02, ease(seg(tau, 0, 1.6))) + lerp(0, -0.84, ease(seg(tau, 2.5, 3.8)));
    e.roll = Math.sin(turn * Math.PI) * -0.03; e.fov = 54;
    st.sitQ = down;
    if (!st.fx.sit && tau >= 3.4) { st.fx.sit = 1; Au.play('land'); W.cam.shake = 0.08; W.dust(C.x, C.z, 6, 1, 0.35); }
  }

  // ---------- shot 6: the view ----------
  function shotVista(t) {
    var e = st.eye, tau = t - TM.vista, C = st.C;
    e.x = C.x; e.z = C.z; e.y = st.seatY + Math.sin(t * 1.1) * 0.006;
    e.pitch = lerp(-0.82, st.pitchEnd, ease(seg(tau, 0.3, 3.2)));
    e.yaw = lerp(st.yawSit, st.yawEnd, ease(seg(tau, 1.8, 10.6)));
    e.fov = lerp(54, 44, ease(seg(tau, 2, 14))); e.roll = 0;
    st.bodyYaw = st.yawSit; st.sitQ = 1;
    // BOLT drifts into the corner of your eye
    var bud = A.buddy, k = ease(seg(tau, 9.6, 12.0));
    if (k > 0) {
      var by = st.yawEnd - lerp(1.0, 0.46, k), bd = 6.4;
      bud.group.visible = true;
      bud.group.position.set(e.x + Math.sin(by) * bd, e.y - 0.25 + Math.sin(t * 2.2) * 0.09, e.z + Math.cos(by) * bd);
      bud.group.lookAt(W.camera.position);
      bud.ring.rotation.z += 0.035;
    }
  }

  // ---------- the running order ----------
  function events(s) {
    return [
      { t: 0.05, fn: function () { title(s.site.place, s.site.id === 'moon' ? 'The Moon' : 'Mars', s.site.id === 'moon' ? '384,400 km from home' : 'Seven months from home'); } },
      { t: TM.descent - 0.5, fn: function () { title(); cls('win', true); cls('data', true); U.fade(false); } },
      { t: TM.land, fn: touchdown },
      { t: TM.fade1, fn: function () { U.fade(true); } },
      { t: TM.fade1 + 0.9, fn: function () { cls('win', false); cls('data', false); title('Hatch open', '', ''); Au.play('hiss'); } },
      { t: TM.step - 0.7, fn: function () { title(); cls('visor', true); cls('data', true); st.body = true; U.fade(false); Au.scene({ place: 'out', site: s.site.id, dust: W.env.dust }); } },
      { t: TM.cut, fn: function () { U.fade(true); } },
      { t: TM.cut + 0.75, fn: function () { st.w.dist = 0; st.w.hop = 0; st.w.air = false; U.fade(false); } },
      { t: TM.vista + 0.4, fn: function () { cls('bars', true); cls('soft', true); cls('data', false); if (!Au.music('vista')) Au.play('pad'); } },
      { t: TM.title, fn: function () { title(s.site.dayWord + ' 1 · ' + s.site.place, 'Astro Outpost', 'Your mission begins'); } },
      { t: TM.fade2, fn: function () { U.fade(true); } }
    ];
  }

  I.play = function (site, done) {
    var s = JA.game.s, L = Tn.L, pad = { x: L.rocket[0], z: L.rocket[1] }, R = { x: L.seat[0], z: L.seat[1] };
    pad.y = Tn.height(pad.x, pad.z);
    var hl = Math.hypot(pad.x, pad.z), dir = { x: -pad.x / hl, z: -pad.z / hl };          // the rocket faces the habitat
    var el = Math.hypot(R.x - pad.x, R.z - pad.z), e = { x: (R.x - pad.x) / el, z: (R.z - pad.z) / el };   // the way you walk
    var yawE = Math.atan2(e.x, e.z);
    var S = { x: pad.x + e.x * 11.35, z: pad.z + e.z * 11.35 };                     // standing at the very edge of the landing pad
    var C = { x: R.x - e.x * 0.6, z: R.z - e.z * 0.6 };
    var yawRocket = Math.atan2(pad.x - C.x, pad.z - C.z), yawSit = near(yawRocket, yawE + Math.PI);
    var yawHab = near(Math.atan2(-C.x, -C.z), yawSit), moon = site === 'moon';
    var yawEarth = near(Math.atan2(-0.5, -0.84), yawSit);
    st = {
      t: 0, done: done, moon: moon, pad: pad, dir: dir, dirYaw: Math.atan2(dir.x, dir.z), e: e, yawE: yawE, S: S, R: R, C: C,
      P1: { x: S.x + e.x * STEP, z: S.z + e.z * STEP }, P2: { x: R.x - e.x * (1.75 + walk2Length()), z: R.z - e.z * (1.75 + walk2Length()) }, Q: null,
      seatY: Tn.height(R.x, R.z) + (Tn.seatTop || 0.65) + SEAT_EYE,
      yawSit: yawSit, yawEnd: moon ? yawHab * 0.45 + yawEarth * 0.55 : yawHab - 0.42, pitchEnd: moon ? 0.1 : 0.07,
      eye: { x: pad.x, y: pad.y + 260, z: pad.z, yaw: 0, pitch: -1, roll: 0, fov: 58 },
      w: { phase: 0, step: 0, sideSign: 1, dist: 0, hop: 0, vy: 0, air: false },
      legL: { rot: 0, y: 0 }, legR: { rot: 0, y: 0 }, sitQ: 0, lean: 0, body: false, bodyYaw: yawE, fx: {}, rum: 0, lineOff: 0,
      dustCol: moon ? 0xb8b9c4 : 0xd9a070, cues: script(s), ci: 0, ev: events(s), ei: 0, breath: 2
    };
    st.rig = buildRig(JA.game.opts.suit);
    Au.music(null); Au.scene({ place: 'cabin', site: site });
    st.cues.forEach(function (c) { if (c.vo) Au.preloadVoice(VO + c.vo + '.mp3'); });   // this film's lines, ready before they are needed
    A.astro.mode = 'hidden';
    W.env.t = moon ? 0.12 : 0.2;
    W.cam.mode = 'cine';
    $('cine').className = ''; $('cine-line').className = ''; title();
    document.body.classList.add('cine');
    U.fade(true);
    shotDescent(TM.descent, 0); setCam(); poseRig(0);
  };

  I.step = function (dt) {
    if (!st || st.finished) return;
    var t = st.t += dt;
    while (st.ei < st.ev.length && t >= st.ev[st.ei].t) st.ev[st.ei++].fn();
    while (st.ci < st.cues.length && t >= st.cues[st.ci].t) say(st.cues[st.ci++]);
    if (st.lineOff && t >= st.lineOff && !Au.voicePlaying()) { st.lineOff = 0; $('cine-line').className = ''; }   // keep the words up while they are spoken
    if (t < TM.fade1 + 0.9) shotDescent(Math.max(t, TM.descent), dt);
    else if (t < TM.step - 0.7) { /* darkness, and the hiss of the hatch */ }
    else if (t < TM.walk) shotStep(t);
    else if (t < TM.cut + 0.75) shotWalk(t, dt);
    else if (t < TM.sit) shotWalk2(Math.max(t, TM.walk2), dt);
    else if (t < TM.vista) shotSit(t);
    else shotVista(t);
    if (st.body) { st.breath -= dt; if (st.breath <= 0) { st.breath = 3.6; Au.play('breath'); } }
    setCam(); poseRig(dt);
    if (st.body && t < TM.vista) $('cine-data').textContent = 'O₂ ' + Math.round(100 - (t - TM.step) * 0.05) + '%   ·   SUIT 21°C   ·   ♥ ' + Math.round(88 + Math.sin(t * 0.4) * 6);
    if (t >= TM.end) finish();
  };

  function finish() {
    if (!st || st.finished) return;
    st.finished = true;
    var done = st.done, rk = B.P.rocket;
    rk.group.position.set(0, 0, 0); rk.flame.visible = false; rk.light.intensity = 0;
    W.root.remove(st.rig.group); W.root.remove(st.rig.shadow);
    A.buddy.group.visible = false;
    Au.stopAll();
    $('cine').className = 'hidden'; $('cine-line').className = ''; title();
    document.body.classList.remove('cine');
    W.cam.shake = 0; W.cam.cine.roll = 0;
    st = null;
    done();
  }
  I.time = function () { return st ? st.t : -1; };      // lets tests step through the film
  I.skip = function () {
    if (!st || st.skipping) return;
    st.skipping = true; U.fade(true);
    setTimeout(finish, 420);
  };
})(window.JA);
