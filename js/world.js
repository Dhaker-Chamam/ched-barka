/* Astro Outpost — the 3D world: ground, sky, light, dust, camera. Built from simple
   shapes in code, so there are no model or texture files to download. */
(function (JA) {
  'use strict';
  var T = window.THREE, Tn = JA.terrain;
  var W = JA.world = { ready: false, T: T };
  if (!T) return;

  var renderer, scene, camera, root = null, look = null, siteId = 'mars';
  var sun, hemi, sunSprite, skyMesh, skyU, stars = null, earth = null, phobos = null, lamp = null;
  var time = 0;
  var sunDir = W.sunDir = new T.Vector3(0.4, 0.5, 0.7).normalize();
  var env = W.env = { t: 0.25, dust: 0, dustShown: 0, storm: 0, stormShown: 0, dark: 0 };
  var cam = W.cam = { yaw: 0, pitch: 0.4, dist: 11, mode: 'title', pos: new T.Vector3(0, 24, 60), look: new T.Vector3(0, 3, 0),
    target: new T.Vector3(0, 2, 8), shake: 0, focus: null, fixed: null };
  var v1 = new T.Vector3(), v2 = new T.Vector3(), c1 = new T.Color(), c2 = new T.Color(), c3 = new T.Color();

  var LOOKS = {
    moon: { ground: 0x8b8c96, ground2: 0x5f606b, rock: 0x70717b, mountain: 0x4d4e58, sunColor: 0xffffff, sunInt: 1.65,
      hemiSky: 0x9fb2d8, hemiGround: 0x34353f, hemiInt: 0.4, fog: null, zenith: 0x000003, horizon: 0x04050a, glow: 0xffffff, sunSize: 330 },
    mars: { ground: 0xc8703f, ground2: 0x9a4a2a, rock: 0x8c4a30, mountain: 0x8a4526, sunColor: 0xfff1df, sunInt: 1.25,
      hemiSky: 0xf5d1a8, hemiGround: 0x7a3b22, hemiInt: 0.66, fog: 0xdcab78, zenith: 0xa8734a, horizon: 0xe6bc8c, glow: 0xfff0d0, sunSize: 210 }
  };

  // ---------- helpers shared with the other 3D files ----------
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  var smooth = Tn.smooth;
  W.mat = function (color, o) { return new T.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.85, metalness: 0.05, flatShading: true }, o || {})); };
  W.soft = function (color, o) { return new T.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.6, metalness: 0.05 }, o || {})); };
  W.glow = function (color, i) { return new T.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: i == null ? 1 : i, roughness: 0.4 }); };
  W.add = function (parent, geo, material, x, y, z, noShadow) {
    var m = new T.Mesh(geo, material);
    m.position.set(x || 0, y || 0, z || 0);
    if (!noShadow) { m.castShadow = true; m.receiveShadow = true; }
    parent.add(m);
    return m;
  };
  W.canvasTex = function (size, draw) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    draw(c.getContext('2d'), size);
    var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
    return t;
  };

  // ---------- ground ----------
  function groundColor(x, z, h, out) {
    var n = clamp(Tn.noise(x * 0.06 + 9, z * 0.06 + 3) * 0.75 + Tn.noise(x * 0.33, z * 0.33) * 0.4, 0, 1);
    out.set(look.ground).lerp(c2.set(look.ground2), n);
    var L = Tn.L, d, i;
    var r = Math.hypot(x, z);
    out.multiplyScalar(1 - (1 - smooth(26, 34, r)) * 0.1);                      // packed-down base area
    var di = Math.hypot(x - L.ice[0], z - L.ice[1]) / Tn.iceR;
    if (siteId === 'moon') {
      for (i = 1; i < Tn.craters.length; i++) {
        var c = Tn.craters[i]; d = Math.hypot(x - c.x, z - c.z) / c.r;
        if (d < 1) out.multiplyScalar(0.82 + 0.18 * d); else if (d < 1.5) out.multiplyScalar(1 + (1.5 - d) * 0.16);
      }
      if (di < 1) {
        out.lerp(c2.set(0x39445c), (1 - di) * 0.9);
        if (di < 0.55) out.lerp(c2.set(0xc4dcf2), clamp(Tn.noise(x * 0.3, z * 0.3) * 1.7 - 0.75, 0, 1) * 0.8);
      }
      d = Math.hypot(x - L.geo[1][0], z - L.geo[1][1]);
      if (d < 11) out.lerp(c2.set(0xd98a3a), (1 - d / 11) * clamp(Tn.noise(x * 0.5, z * 0.5) * 1.6 - 0.2, 0, 1));
    } else {
      d = Math.hypot(x - L.mesa[0], z - L.mesa[1]);
      if (d < 22 && h > Tn.height(L.geo[0][0], L.geo[0][1]) + 1.2) {
        var band = Math.floor(h * 1.15 + Tn.noise(x * 0.1, z * 0.1) * 1.2) % 3;
        out.set(band === 0 ? 0xdba878 : band === 1 ? 0xa3522c : 0xecd0a8);
      }
      if (di < 0.8) out.lerp(c2.set(0xd9eef7), clamp(Tn.noise(x * 0.25, z * 0.25) * 1.8 - 0.6, 0, 1) * (1 - di / 0.8) * 1.2);
      d = Math.hypot(x - L.geo[1][0], z - L.geo[1][1]);
      if (d < 12) out.lerp(c2.set(0xe6c49c), (1 - d / 12) * 0.85);
      var cz = -132 + Math.sin(x * 0.021) * 24, dc = Math.abs(z - cz);
      if (dc < 14) out.multiplyScalar(0.8 + 0.2 * dc / 14);
      var dune = smooth(40, 110, z) * smooth(20, -60, x);
      out.lerp(c2.set(0xdc9258), dune * 0.5);
    }
    return out;
  }

  function buildGround() {
    var size = 800, seg = 250;
    var g = new T.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    var p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (var k = 0; k < p.count; k++) {
      var x = p.getX(k), z = p.getZ(k), h = Tn.height(x, z);
      p.setY(k, h);
      groundColor(x, z, h, c1);
      col[k * 3] = c1.r; col[k * 3 + 1] = c1.g; col[k * 3 + 2] = c1.b;
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    var ground = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true }));
    ground.receiveShadow = true;
    root.add(ground);
    var skirt = W.add(root, new T.RingGeometry(392, 3400, 48, 1), new T.MeshStandardMaterial({ color: look.ground2, roughness: 1 }), 0, 23, 0, true);
    skirt.rotation.x = -Math.PI / 2;

    var rnd = JA.sim.rng32(siteId === 'mars' ? 99 : 11), mm = W.mat(look.mountain), i;
    for (i = 0; i < 34; i++) {
      var a = (i / 34) * Math.PI * 2 + rnd() * 0.15, mr = 470 + rnd() * 160, mh = 45 + rnd() * 110;
      var cone = W.add(root, new T.ConeGeometry(mh * (1 + rnd() * 1.1), mh, 5 + Math.floor(rnd() * 4)), mm, Math.cos(a) * mr, 20 + mh * 0.42, Math.sin(a) * mr, true);
      cone.rotation.y = rnd() * 3;
    }
    if (siteId === 'mars') W.add(root, new T.ConeGeometry(640, 190, 24), mm, 300, 100, -1250, true);   // a giant volcano on the horizon

    // pebbles and rocks
    var count = 900, inst = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), W.mat(look.rock), count), dummy = new T.Object3D();
    for (i = 0; i < count; i++) {
      var ra = rnd() * Math.PI * 2, rd = i < 160 ? 30 + rnd() * 34 : 60 + Math.pow(rnd(), 1.3) * 300;
      var rx = Math.cos(ra) * rd, rz = Math.sin(ra) * rd, sc = i < 160 ? 0.08 + rnd() * 0.22 : 0.15 + Math.pow(rnd(), 2.2) * 0.8;
      dummy.position.set(rx, Tn.height(rx, rz) + sc * 0.2, rz);
      dummy.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      dummy.scale.set(sc, sc * (0.5 + rnd() * 0.6), sc);
      dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix);
    }
    inst.castShadow = true; inst.receiveShadow = true;
    root.add(inst);
    // boulders (these block your way)
    var bm = W.mat(look.rock), bm2 = W.mat(siteId === 'mars' ? 0x6e3a26 : 0x9a9ba6);
    Tn.boulders.forEach(function (b, k) {
      var m = W.add(root, new T.DodecahedronGeometry(b.r * 1.08, 0), k % 3 ? bm : bm2, b.x, Tn.height(b.x, b.z) + b.r * b.sy * 0.45, b.z);
      m.scale.y = b.sy; m.rotation.set(b.tilt, b.rot, b.tilt * 0.5);
    });
  }

  // ---------- sky ----------
  function buildSky() {
    scene.fog = look.fog ? new T.FogExp2(look.fog, 0.0026) : null;
    skyU = { uZenith: { value: new T.Color(look.zenith) }, uHorizon: { value: new T.Color(look.horizon) },
      uGlow: { value: new T.Color(look.glow) }, uSun: { value: sunDir }, uGlowAmt: { value: 1 } };
    skyMesh = new T.Mesh(new T.SphereGeometry(2600, 32, 16), new T.ShaderMaterial({
      uniforms: skyU, side: T.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uSun; uniform float uGlowAmt; varying vec3 vDir;' +
        'void main(){ vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0); vec3 c = mix(uHorizon, uZenith, pow(h, 0.45));' +
        ' float s = max(dot(d, normalize(uSun)), 0.0); c += uGlow * (pow(s, 40.0) * 0.5 + pow(s, 5.0) * 0.14) * uGlowAmt;' +
        ' gl_FragColor = vec4(c, 1.0);\n #include <encodings_fragment>\n }'
    }));
    skyMesh.renderOrder = -10; skyMesh.frustumCulled = false;
    root.add(skyMesh);

    hemi = new T.HemisphereLight(look.hemiSky, look.hemiGround, look.hemiInt);
    root.add(hemi);
    sun = new T.DirectionalLight(look.sunColor, look.sunInt);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera;
    sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 20; sc.far = 700;
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.06;
    root.add(sun); root.add(sun.target);

    var tex = W.canvasTex(256, function (ctx, s) {
      var g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.1, 'rgba(255,252,235,1)');
      g.addColorStop(0.2, 'rgba(255,230,170,0.45)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    });
    sunSprite = new T.Sprite(new T.SpriteMaterial({ map: tex, blending: T.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
    sunSprite.scale.set(look.sunSize, look.sunSize, 1);
    root.add(sunSprite);

    var n = 1800, pos = new Float32Array(n * 3), rnd = JA.sim.rng32(77);
    for (var i = 0; i < n; i++) {
      var u = rnd() * 0.98 + 0.02, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      pos[i * 3] = r * Math.cos(a) * 2300; pos[i * 3 + 1] = u * 2300; pos[i * 3 + 2] = r * Math.sin(a) * 2300;
    }
    var sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(pos, 3));
    stars = new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.9, fog: false, depthWrite: false }));
    stars.frustumCulled = false; stars.renderOrder = -9;
    root.add(stars);

    earth = null; phobos = null;
    if (siteId === 'moon') {
      var et = W.canvasTex(256, function (ctx, s) {
        ctx.fillStyle = '#2466cf'; ctx.fillRect(0, 0, s, s);
        var rr = JA.sim.rng32(5), k;
        ctx.fillStyle = '#3aa655';
        for (k = 0; k < 18; k++) { ctx.beginPath(); ctx.ellipse(rr() * s, rr() * s, 12 + rr() * 34, 8 + rr() * 22, rr() * 3, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#c9a868';
        for (k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(rr() * s, rr() * s, 8 + rr() * 16, 5 + rr() * 9, rr() * 3, 0, 7); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        for (k = 0; k < 34; k++) { ctx.beginPath(); ctx.ellipse(rr() * s, rr() * s, 10 + rr() * 42, 3 + rr() * 7, rr() * 0.6 - 0.3, 0, 7); ctx.fill(); }
      });
      earth = W.add(root, new T.SphereGeometry(95, 36, 24), new T.MeshStandardMaterial({ map: et, roughness: 0.75, emissive: 0x12305c, emissiveIntensity: 0.5, fog: false }), 0, 0, 0, true);
      earth.rotation.z = 0.41;
    } else {
      phobos = W.add(root, new T.DodecahedronGeometry(16, 1), new T.MeshStandardMaterial({ color: 0x8d8478, roughness: 1, flatShading: true, fog: false }), 0, 0, 0, true);
      phobos.scale.set(1.3, 1, 1.05);
    }
    // the astronaut's helmet lamp
    lamp = new T.SpotLight(0xdfeeff, 0, 34, 0.62, 0.55, 1.2);
    root.add(lamp); root.add(lamp.target);
  }

  // ---------- particles (dust, sparks, exhaust, storm specks) ----------
  var PN = 1600, pGeo, pPos, pCol, pAlpha, pSize, pMesh, pUni, pNext = 0;
  var pv = new Float32Array(PN * 3), pLife = new Float32Array(PN), pMax = new Float32Array(PN), pGrav = new Float32Array(PN),
    pS0 = new Float32Array(PN), pS1 = new Float32Array(PN), pA0 = new Float32Array(PN);
  function buildParticles() {
    pGeo = new T.BufferGeometry();
    pPos = new T.BufferAttribute(new Float32Array(PN * 3), 3); pCol = new T.BufferAttribute(new Float32Array(PN * 3), 3);
    pAlpha = new T.BufferAttribute(new Float32Array(PN), 1); pSize = new T.BufferAttribute(new Float32Array(PN), 1);
    pGeo.setAttribute('position', pPos); pGeo.setAttribute('aColor', pCol); pGeo.setAttribute('aAlpha', pAlpha); pGeo.setAttribute('aSize', pSize);
    pUni = { uScale: { value: 600 } };
    pMesh = new T.Points(pGeo, new T.ShaderMaterial({
      uniforms: pUni, transparent: true, depthWrite: false, fog: false,
      vertexShader: 'attribute vec3 aColor; attribute float aAlpha; attribute float aSize; varying vec3 vC; varying float vA; uniform float uScale;' +
        'void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); if (r > 0.25) discard;' +
        ' gl_FragColor = vec4(vC, vA * smoothstep(0.25, 0.04, r));\n #include <encodings_fragment>\n }'
    }));
    pMesh.frustumCulled = false; pMesh.renderOrder = 5;
    for (var i = 0; i < PN; i++) pLife[i] = 0;
    root.add(pMesh);
  }
  // o: { vx, vy, vz, life, size, grow, color (hex), alpha, grav }
  W.emit = function (x, y, z, o) {
    var i = pNext; pNext = (pNext + 1) % PN;
    pPos.setXYZ(i, x, y, z);
    pv[i * 3] = o.vx || 0; pv[i * 3 + 1] = o.vy || 0; pv[i * 3 + 2] = o.vz || 0;
    pLife[i] = pMax[i] = o.life || 1; pGrav[i] = o.grav == null ? 0 : o.grav;
    pS0[i] = o.size || 0.4; pS1[i] = (o.size || 0.4) * (o.grow == null ? 1.6 : o.grow); pA0[i] = o.alpha == null ? 0.8 : o.alpha;
    c3.set(o.color == null ? 0xffffff : o.color);
    pCol.setXYZ(i, c3.r, c3.g, c3.b);
  };
  W.burst = function (x, y, z, n, speed, color, o) {
    o = o || {};
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, e = Math.random() * (o.up == null ? 1 : o.up), s = speed * (0.4 + Math.random() * 0.6);
      W.emit(x, y, z, { vx: Math.cos(a) * s * (1 - e * 0.5), vy: e * s + (o.lift || 0), vz: Math.sin(a) * s * (1 - e * 0.5),
        life: (o.life || 0.9) * (0.6 + Math.random() * 0.6), size: o.size || 0.4, grow: o.grow, color: color, alpha: o.alpha, grav: o.grav == null ? W.gravity * 0.4 : o.grav });
    }
  };
  W.dust = function (x, z, n, speed, size) {
    W.burst(x, Tn.height(x, z) + 0.15, z, n, speed || 1.6, siteId === 'mars' ? 0xd9a070 : 0xb8b9c4, { life: 1.3, size: size || 0.5, grow: 2.6, alpha: 0.45, up: 0.6, grav: W.gravity * 0.12 });
  };
  function updateParticles(dt) {
    var changed = false;
    for (var i = 0; i < PN; i++) {
      if (pLife[i] <= 0) continue;
      changed = true;
      pLife[i] -= dt;
      if (pLife[i] <= 0) { pAlpha.array[i] = 0; pSize.array[i] = 0; continue; }
      var k = 1 - pLife[i] / pMax[i], j = i * 3;
      pv[j + 1] -= pGrav[i] * dt;
      pPos.array[j] += pv[j] * dt; pPos.array[j + 1] += pv[j + 1] * dt; pPos.array[j + 2] += pv[j + 2] * dt;
      pAlpha.array[i] = pA0[i] * (1 - k) * Math.min(1, k * 8);
      pSize.array[i] = lerp(pS0[i], pS1[i], k);
    }
    if (changed) { pPos.needsUpdate = true; pAlpha.needsUpdate = true; pSize.needsUpdate = true; pCol.needsUpdate = true; }
  }

  // ---------- bootprints and wheel tracks ----------
  var FN = 500, fMesh, fNext = 0, fDummy = new T.Object3D();
  function buildPrints() {
    var g = new T.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    fMesh = new T.InstancedMesh(g, new T.MeshBasicMaterial({ color: siteId === 'mars' ? 0x6e3418 : 0x3e3f48, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), FN);
    fDummy.position.set(0, -500, 0); fDummy.updateMatrix();
    for (var i = 0; i < FN; i++) fMesh.setMatrixAt(i, fDummy.matrix);
    fMesh.frustumCulled = false;
    root.add(fMesh);
  }
  W.print = function (x, z, yaw, w, l) {
    fDummy.position.set(x, Tn.height(x, z) + 0.04, z);
    fDummy.rotation.set(0, yaw, 0); fDummy.scale.set(w, 1, l); fDummy.updateMatrix();
    fMesh.setMatrixAt(fNext, fDummy.matrix); fNext = (fNext + 1) % FN;
    fMesh.instanceMatrix.needsUpdate = true;
  };

  // ---------- set-up ----------
  W.init = function (canvas) {
    try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = W.scene = new T.Scene();
    scene.background = new T.Color(0x000000);
    camera = W.camera = new T.PerspectiveCamera(52, 16 / 9, 0.4, 6000);
    W.w = 1280; W.h = 720;
    W.resize();
    window.addEventListener('resize', W.resize);
    W.ready = true;
    return true;
  };
  W.resize = function () {
    if (!renderer) return;
    var w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) return;                    // hidden or minimised window: keep the last good size
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    W.w = w; W.h = h;
    if (pUni) pUni.uScale.value = h * 0.5 / Math.tan(camera.fov * Math.PI / 360);
  };

  W.build = function (site, suitColor) {
    if (root) { scene.remove(root); root.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); }
    siteId = W.site = site; look = LOOKS[site]; W.gravity = JA.SITES[site].gravity;
    Tn.setSite(site);
    root = W.root = new T.Group(); scene.add(root);
    buildGround(); buildSky(); buildParticles(); buildPrints();
    JA.base.build(root, site);
    JA.actors.build(root, site, suitColor);
    env.dust = env.dustShown = env.storm = env.stormShown = 0;
    W.resize();
  };

  W.project = function (v) {
    v1.copy(v).project(camera);
    return { x: (v1.x * 0.5 + 0.5) * W.w, y: (-v1.y * 0.5 + 0.5) * W.h, hidden: v1.z > 1, dist: camera.position.distanceTo(v) };
  };
  // direction vectors on the ground for "forward" and "right" as seen by the camera
  W.forward = function (out) { return out.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)); };
  W.lookBy = function (dx, dy) { cam.yaw -= dx; cam.pitch = clamp(cam.pitch + dy, 0.06, 1.25); };
  W.zoomBy = function (d) { cam.dist = clamp(cam.dist * (1 + d), 5.5, 26); };

  // ---------- every frame ----------
  function updateSky(dt) {
    var t = clamp(env.t, 0, 1), az, el;
    if (siteId === 'moon') { az = lerp(1.05, -1.05, t); el = 0.15 + Math.sin(Math.PI * t) * 0.06; }
    else { az = lerp(1.75, -1.75, t); el = 0.13 + Math.sin(Math.PI * t) * 0.9; }
    sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
    var f = cam.target;
    sun.target.position.set(f.x, f.y, f.z);
    sun.position.set(f.x + sunDir.x * 260, f.y + sunDir.y * 260, f.z + sunDir.z * 260);
    sunSprite.position.copy(camera.position).addScaledVector(sunDir, 2400);
    skyMesh.position.copy(camera.position); stars.position.copy(camera.position);

    env.dustShown = lerp(env.dustShown, env.dust, Math.min(1, dt * 0.8));
    env.stormShown = lerp(env.stormShown, env.storm, Math.min(1, dt * 3));
    var d = env.dustShown;
    var day = siteId === 'moon' ? 1 : smooth(0, 0.14, t) * (1 - smooth(0.86, 1, t));
    if (siteId === 'mars') {
      skyU.uHorizon.value.set(look.horizon).lerp(c1.set(0x5b6f92), (1 - day) * 0.8).lerp(c1.set(0x7d4a2a), d * 0.8);
      skyU.uZenith.value.set(look.zenith).lerp(c1.set(0x2c3246), (1 - day) * 0.85).lerp(c1.set(0x6a3d22), d * 0.85);
      skyU.uGlow.value.set(look.glow).lerp(c1.set(0x86bcff), 1 - day);
      skyU.uGlowAmt.value = (1 + (1 - day) * 1.6) * (1 - d * 0.8);
      scene.fog.color.copy(skyU.uHorizon.value);
      scene.fog.density = 0.0026 + d * 0.02;
      sun.intensity = look.sunInt * (0.4 + 0.6 * day) * (1 - d * 0.66);
      hemi.intensity = look.hemiInt * (0.62 + 0.38 * day) * (1 - d * 0.3);
      sun.color.set(look.sunColor).lerp(c1.set(0xa5c8ff), (1 - day) * 0.6);
      sunSprite.material.color.set(0xffffff).lerp(c1.set(0x9fc8ff), (1 - day) * 0.8);
      sunSprite.material.opacity = 1 - d * 0.8;
      stars.material.opacity = (1 - day) * 0.7 * (1 - d);
      var pt = (time * 0.006 + 0.2) % 1, pa = lerp(-1.9, 1.9, pt), pe = 0.25 + Math.sin(Math.PI * pt) * 0.7;
      phobos.position.copy(camera.position).add(v1.set(Math.sin(pa) * Math.cos(pe), Math.sin(pe), -Math.cos(pa) * Math.cos(pe) * 0.6 - 0.3).normalize().multiplyScalar(2300));
      phobos.rotation.y += dt * 0.05;
      env.dark = clamp((1 - day) * 0.8 + d * 0.5, 0, 1);
    } else {
      sun.intensity = look.sunInt * (1 - d * 0.86);
      hemi.intensity = look.hemiInt * (1 - d * 0.3);
      sunSprite.material.opacity = 1 - d;
      earth.position.copy(camera.position).add(v1.set(-0.5, 0.2, -0.84).normalize().multiplyScalar(2350));
      earth.rotation.y += dt * 0.008;
      var inIce = 1 - smooth(0.55, 1.0, Math.hypot(f.x - Tn.L.ice[0], f.z - Tn.L.ice[1]) / Tn.iceR);
      env.dark = clamp(d * 0.9 + inIce * 0.8 + 0.25, 0, 1);
    }
    lamp.intensity = lerp(lamp.intensity, cam.mode === 'play' ? env.dark * 2.4 : 0, Math.min(1, dt * 3));
  }

  function ambientParticles(dt) {
    var f = cam.target, i, n;
    if (env.stormShown > 0.03) {
      n = Math.round(env.stormShown * 26);
      for (i = 0; i < n; i++) {
        W.emit(f.x + (Math.random() - 0.5) * 70 + sunDir.x * 20, f.y + Math.random() * 26 + 6, f.z + (Math.random() - 0.5) * 70 + sunDir.z * 20,
          { vx: -sunDir.x * 46, vy: -sunDir.y * 46 - 10, vz: -sunDir.z * 46, life: 0.9, size: 0.34, grow: 0.6, color: 0xff48c8, alpha: 0.9 });
      }
    }
    if (siteId === 'mars' && env.dustShown > 0.03) {
      n = Math.round(env.dustShown * 12);
      for (i = 0; i < n; i++) {
        W.emit(f.x - 40 + Math.random() * 30, f.y + Math.random() * 14 - 1, f.z + (Math.random() - 0.5) * 80,
          { vx: 16 + Math.random() * 14, vy: (Math.random() - 0.5) * 2, vz: 3, life: 3, size: 0.9, grow: 2.4, color: 0xe2b98c, alpha: 0.28 });
      }
    }
  }

  function updateCamera(dt) {
    var want = v1, lookAt = v2, sp;
    if (cam.mode === 'title') {
      var a = time * 0.05 + 0.5, rad = camera.aspect < 1 ? 92 : 64;
      want.set(Math.sin(a) * rad, 15 + Math.sin(time * 0.11) * 4, Math.cos(a) * rad);
      lookAt.set(-6, 5, 4); sp = Math.min(1, dt * 1.5);
    } else if (cam.mode === 'inside') {
      var b = time * 0.09;
      want.set(Math.sin(b) * 30, 13, Math.cos(b) * 30 + 2);
      lookAt.set(0, 3.5, 0); sp = Math.min(1, dt * 1.6);
    } else if (cam.mode === 'fixed' && cam.fixed) {
      want.copy(cam.fixed.pos); lookAt.copy(cam.fixed.look); sp = Math.min(1, dt * 2.2);
    } else {
      if (cam.focus) cam.focus(cam.target);
      var cp = Math.cos(cam.pitch), dist = cam.dist * (camera.aspect < 1 ? 1.25 : 1);
      want.set(cam.target.x + Math.sin(cam.yaw) * cp * dist, cam.target.y + Math.sin(cam.pitch) * dist, cam.target.z + Math.cos(cam.yaw) * cp * dist);
      lookAt.copy(cam.target); sp = Math.min(1, dt * 12);
    }
    var floor = Tn.height(want.x, want.z) + 0.7;
    if (want.y < floor) want.y = floor;
    cam.pos.lerp(want, sp); cam.look.lerp(lookAt, Math.min(1, sp * 1.4));
    if (isNaN(cam.pos.x + cam.pos.y + cam.pos.z)) cam.pos.copy(want);
    if (isNaN(cam.look.x + cam.look.y + cam.look.z)) cam.look.copy(lookAt);
    camera.position.copy(cam.pos);
    if (cam.shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * cam.shake; camera.position.y += (Math.random() - 0.5) * cam.shake; camera.position.z += (Math.random() - 0.5) * cam.shake;
      cam.shake *= Math.max(0, 1 - dt * 4);
    }
    camera.lookAt(cam.look);
  }
  W.snapCamera = function () { updateCamera(100); };
  W.setLamp = function (x, y, z, dx, dz) { if (!lamp) return; lamp.position.set(x, y, z); lamp.target.position.set(x + dx * 8, y - 2.4, z + dz * 8); };

  W.update = function (dt) {
    if (!W.ready || !root) return;
    if (window.innerWidth !== W.w || window.innerHeight !== W.h) W.resize();
    time += dt; W.time = time;
    updateCamera(dt);
    updateSky(dt);
    ambientParticles(dt);
    updateParticles(dt);
    if (window.innerWidth && window.innerHeight) renderer.render(scene, camera);
  };
})(window.JA);
