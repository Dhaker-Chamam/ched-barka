/* Astro Outpost — the outpost models made in Blender (packed in js/models-data.js by
   assets/blender/scripts/export_js.py). The rest of the game asks for them by name:

     if (JA.models.has('habitat')) { var hab = JA.models.make('habitat'); ... hab.getObjectByName('hab_doorLight') ... }

   Every make() returns a fresh copy with its own materials (so the game can recolour one copy),
   while the geometry is decoded once and shared. Without models-data.js, has() is false and the
   game keeps drawing its own simple shapes. */
(function (JA) {
  'use strict';
  var T = window.THREE, D = window.JA_MODELS || null;
  var M = JA.models = { has: function () { return false; } };
  if (!T || !D || !D.models) return;

  var LIN = new Float32Array(256);                       // sRGB byte -> linear
  for (var i = 0; i < 256; i++) { var c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  var geos = {};                                         // model name -> per node -> per primitive BufferGeometry
  var env = null;

  function bytes(s) {
    var bin = atob(s), n = bin.length, u8 = new Uint8Array(n);
    for (var k = 0; k < n; k++) u8[k] = bin.charCodeAt(k);
    return u8.buffer;
  }

  function decode(pr, s) {
    var p = new Int16Array(bytes(pr.P)), n = new Int8Array(bytes(pr.N)), cnt = p.length / 3, k;
    var pos = new Float32Array(p.length), nrm = new Float32Array(n.length);
    for (k = 0; k < p.length; k++) { pos[k] = p[k] * s; nrm[k] = n[k] / 127; }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.BufferAttribute(nrm, 3));
    if (pr.C) {
      var c8 = new Uint8Array(bytes(pr.C)), col = new Float32Array(cnt * 3);
      for (k = 0; k < c8.length; k++) col[k] = LIN[c8[k]];
      g.setAttribute('color', new T.BufferAttribute(col, 3));
    }
    g.setIndex(new T.BufferAttribute(pr.w === 4 ? new Uint32Array(bytes(pr.I)) : new Uint16Array(bytes(pr.I)), 1));
    g.computeBoundingSphere();
    return g;
  }

  function geometry(name) {
    if (geos[name]) return geos[name];
    var m = D.models[name];
    return (geos[name] = m.nodes.map(function (nd) { return nd.g.map(function (pr) { return decode(pr, m.s); }); }));
  }

  function material(name) {
    var d = D.materials[name] || { c: [1, 1, 1], r: 0.6, m: 0, vc: 1 };
    var o = { color: new T.Color(d.c[0], d.c[1], d.c[2]), roughness: d.r, metalness: d.m, vertexColors: !!d.vc };
    if (d.e) { o.emissive = new T.Color(d.e[0], d.e[1], d.e[2]); o.emissiveIntensity = d.ei; }
    var mt = new T.MeshStandardMaterial(o);
    mt.name = name;
    if (env && d.m > 0 && !d.e) { mt.envMap = env; mt.envMapIntensity = 0.55 + d.m * 0.5; }
    return mt;
  }

  M.has = function (name) { return !!D.models[name]; };

  // A copy of a model: an Object3D tree with the node names from Blender. A node with one material is
  // the Mesh itself (so node.material works); a node with several holds one Mesh per material.
  M.make = function (name, opts) {
    var m = D.models[name], gs = geometry(name), mats = {}, objs = [];
    opts = opts || {};
    function mat(n) { return mats[n] || (mats[n] = material(n)); }
    m.nodes.forEach(function (nd, k) {
      var o, list = gs[k];
      if (list.length === 1) o = new T.Mesh(list[0], mat(nd.g[0].m));
      else {
        o = new T.Group();
        list.forEach(function (g, j) { var me = new T.Mesh(g, mat(nd.g[j].m)); me.name = nd.n + '_' + nd.g[j].m; o.add(me); });
      }
      o.name = nd.n;
      o.position.set(nd.t[0], nd.t[1], nd.t[2]);
      objs.push(o);
      if (nd.p >= 0) objs[nd.p].add(o);
    });
    var root = objs[0];
    root.traverse(function (o) {
      if (!o.isMesh) return;
      var glow = !!(D.materials[o.material.name] || {}).e;
      o.castShadow = opts.shadow !== false && !glow;
      o.receiveShadow = opts.shadow !== false;
    });
    root.userData.materials = mats;
    return root;
  };

  // Every material of one name inside a copy (for recolouring: suit, solar glass, sample caps...).
  M.mat = function (obj, name) {
    var found = null;
    obj.traverse(function (o) { if (!found && o.isMesh && o.material.name === name) found = o.material; });
    return found;
  };

  // A small reflection map so the metal reads as metal (only model materials use it). Built per site
  // from that site's sky and ground colours; W.build calls this before the outpost is built.
  M.prepare = function (renderer, look) {
    if (env) { env.dispose(); env = null; }
    if (!renderer || !look || !T.PMREMGenerator) return;
    try {
      var sc = new T.Scene(), g = new T.SphereGeometry(50, 32, 16), col = [], p = g.attributes.position;
      var top = new T.Color(look.hemiSky), hor = new T.Color(look.horizon).lerp(new T.Color(0xffffff), 0.35), bot = new T.Color(look.ground).multiplyScalar(0.7), c = new T.Color();
      for (var k = 0; k < p.count; k++) {
        var y = p.getY(k) / 50;
        if (y > 0) c.copy(hor).lerp(top, Math.pow(y, 0.6)); else c.copy(hor).lerp(bot, Math.pow(-y, 0.4));
        col.push(c.r, c.g, c.b);
      }
      g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      sc.add(new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
      var pm = new T.PMREMGenerator(renderer);
      env = pm.fromScene(sc, 0.04).texture;
      pm.dispose(); g.dispose();
    } catch (e) { env = null; }
  };
})(window.JA);
