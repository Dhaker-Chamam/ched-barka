/* Astro Outpost — the camera.
   Everything the 3D world draws passes through here on its way to the screen, the way light
   passes through a real lens and lands on film:
     - bright things glow and spread (bloom, with the warm "halation" of real film)
     - the Sun throws lens flares and streaks; on Mars its light makes shafts in the dusty air
       (on the Moon there is no air, so there are no shafts: only the lens reacts)
     - each world has its own colours; the title screen is shot like a tiny model (tilt-shift)
     - the picture reacts to the mission: a solar storm peppers the camera sensor with sparkles
       and streaks (charged particles really do that to cameras in space), low air narrows and
       greys your view, a meteorite strike flashes and jolts the lens
     - a solar storm also lights an aurora glow round the edges; in the cold and dark, frost
       creeps in from the edges of the visor; Mars dust drifts across as sheets of haze
     - the films have a little gate weave and warm light leaks; a postcard photo gets the
       cross marks of an Apollo Hasselblad camera
     - camera filters let you see the way real space cameras do (key L)
   Key X switches between full, lite and off (so does ?fx=2, 1 or 0 in the address).
   Two cameras were written for this game on the same day and merged here: the glow, flare,
   grading, filters and pulses from one; the aurora, radiation streaks, frost, haze, weave, light
   leaks, postcard crosses and reduced-motion care from the other (Dexter's).
   If the graphics card cannot do any of this, the game simply draws the plain picture.
   world.js calls F.render() once per frame; game.js tells us what is going on through F.state. */
(function (JA) {
  'use strict';
  var T = window.THREE, W = JA.world;
  var F = JA.fx = { on: true, ready: false, failed: false, tier: 'high', filter: 0,
    state: { mode: 'title', site: 'mars', room: '', pov: false, air: 100 } };
  if (!T) return;

  F.FILTERS = [
    { id: 'natural', icon: '🎥', name: 'Natural', note: 'Camera filter off: natural colours.' },
    { id: 'apollo', icon: '🎞️', name: 'Apollo film', note: 'Apollo film! The astronauts\' Moon cameras printed little crosses on every photo, so scientists could measure things in them.' },
    { id: 'rover', icon: '🤖', name: 'Rover eye', note: 'Rover eye! The hazard cameras on the Curiosity rover see in black and white through a fisheye lens, to spot rocks near the wheels.' },
    { id: 'false', icon: '🌈', name: 'False colour', note: 'False colour! Scientists stretch the colours in space photos so that different rocks and soils stand out.' },
    { id: 'heat', icon: '🌡️', name: 'Heat view', note: 'Heat view (pretend)! Sunlit ground is hot and shadows are freezing. Real orbiters use heat cameras to map this.' }
  ];

  var quad, fsScene, fsCam, mats = {}, rts = null, size = new T.Vector2(), hdr = true, msaa = 4, dirtTex = null;
  var frames = 0, checked = 0, time = 0, lastReal = 0, slow = 0, ema = 0.016;
  var pulse = { flash: 0, shock: 0, glitch: 0, glow: 0 }, lowAir = 0, v3 = new T.Vector3(), v2 = new T.Vector2();
  // people who asked their device for less motion get a still picture: no tearing, no weave, no flicker
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var live = { storm: 0, warn: 0, cold: 0, cine: 0, leak: 0, haze: 0 }, snapT = 0, userSet = false;
  // the look right now (it glides toward the look the scene asks for)
  var P = { bloom: 0.5, wide: 0.35, flare: 0.4, rays: 0, ca: 0.0012, vig: 0.28, grain: 0.035, sat: 1, con: 1.05, tilt: 0, tiltY: 0.5,
    halo: 0.5, dirt: 0.5, exp: 1, barrel: 0, lr: 0, lg: 0, lb: 0, gr: 1, gg: 1, gb: 1 };

  var VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  // shrink a picture to half size (four samples, averaged)
  var DOWN = 'uniform sampler2D tMap; uniform vec2 uTexel; varying vec2 vUv;' +
    'void main(){ vec3 c = texture2D(tMap, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(tMap, vUv + uTexel * vec2(0.5, -0.5)).rgb' +
    ' + texture2D(tMap, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(tMap, vUv + uTexel * vec2(0.5, 0.5)).rgb;' +
    ' gl_FragColor = vec4(min(c * 0.25, vec3(12.0)), 1.0); }';
  // keep only what is bright enough to glow
  var BRIGHT = 'uniform sampler2D tMap; uniform vec2 uTexel; uniform float uThresh; uniform float uKnee; varying vec2 vUv;' +
    'void main(){ vec3 c = texture2D(tMap, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(tMap, vUv + uTexel * vec2(0.5, -0.5)).rgb' +
    ' + texture2D(tMap, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(tMap, vUv + uTexel * vec2(0.5, 0.5)).rgb; c *= 0.25;' +
    // "bright" is judged half by how light it is and half by its strongest colour, so coloured lamps glow but sunlit ground does not
    ' float br = 0.5 * dot(c, vec3(0.2126, 0.7152, 0.0722)) + 0.5 * max(c.r, max(c.g, c.b)); float soft = clamp(br - uThresh + uKnee, 0.0, 2.0 * uKnee); soft = soft * soft / (4.0 * uKnee + 0.0001);' +
    ' gl_FragColor = vec4(c * max(soft, br - uThresh) / max(br, 0.0001), 1.0); }';
  // a soft blur, done once sideways and once up-and-down
  var BLUR = 'uniform sampler2D tMap; uniform vec2 uDir; varying vec2 vUv;' +
    'void main(){ vec3 c = texture2D(tMap, vUv).rgb * 0.227027;' +
    ' c += (texture2D(tMap, vUv + uDir * 1.384615).rgb + texture2D(tMap, vUv - uDir * 1.384615).rgb) * 0.316216;' +
    ' c += (texture2D(tMap, vUv + uDir * 3.230769).rgb + texture2D(tMap, vUv - uDir * 3.230769).rgb) * 0.070270;' +
    ' gl_FragColor = vec4(c, 1.0); }';
  // what a lens does with bright light: ghosts mirrored through its middle, a wide blue streak, and (in dusty air) shafts from the Sun
  var FLARE = 'uniform sampler2D tBright; uniform sampler2D tWide; uniform vec2 uSun; uniform float uSunOn; uniform float uRays; uniform vec2 uTexel; varying vec2 vUv;' +
    'vec3 pick(vec2 uv){ vec2 m = step(vec2(0.0), uv) * step(uv, vec2(1.0)); return texture2D(tBright, uv).rgb * m.x * m.y; }' +
    'void main(){ vec3 col = vec3(0.0); vec2 flip = vec2(1.0) - vUv; vec2 gv = (vec2(0.5) - flip) * 0.46;' +
    ' for (int i = 1; i < 4; i++) { vec2 o = flip + gv * float(i); float w = pow(max(0.0, 1.0 - length(vec2(0.5) - o) / 0.7071), 5.0);' +
    '  vec3 tint = i == 1 ? vec3(1.0, 0.62, 0.38) : (i == 2 ? vec3(0.42, 0.7, 1.0) : vec3(0.72, 0.5, 1.0)); col += pick(o) * w * tint * 0.55; }' +
    ' vec3 st = vec3(0.0); for (int j = -7; j <= 7; j++) { float f = float(j); st += texture2D(tWide, vUv + vec2(f * uTexel.x * 9.0, 0.0)).rgb * (1.0 - abs(f) / 8.0); }' +
    ' col += st * vec3(0.34, 0.5, 1.0) * 0.11;' +
    ' if (uSunOn > 0.001 && uRays > 0.001) { vec2 stp = (uSun - vUv) / 24.0 * 0.92; vec2 p = vUv; float decay = 1.0; vec3 acc = vec3(0.0);' +
    '  for (int k = 0; k < 24; k++) { p += stp; acc += pick(p) * decay; decay *= 0.955; }' +
    '  col += acc / 24.0 * vec3(1.0, 0.84, 0.6) * uRays * uSunOn * 2.2; }' +
    ' gl_FragColor = vec4(col, 1.0); }';
  // the last step: lens, film, colour, and whatever the mission is doing to the picture
  var FINAL = [
    'uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tWide; uniform sampler2D tFlare; uniform sampler2D tSoft; uniform sampler2D tDirt;',
    'uniform vec2 uRes; uniform float uTime;',
    'uniform float uBloom; uniform float uWide; uniform float uFlare; uniform float uCA; uniform float uVig; uniform float uGrain; uniform float uSat; uniform float uCon;',
    'uniform float uSoft; uniform float uTilt; uniform float uTiltY; uniform float uStorm; uniform float uLowAir; uniform float uBarrel; uniform float uFlash; uniform float uShock;',
    'uniform float uGlitch; uniform float uFilter; uniform float uDirt; uniform float uHalo; uniform float uExp;',
    'uniform float uMotion; uniform float uWarn; uniform float uCold; uniform float uCine; uniform float uLeak; uniform float uSnap; uniform float uHaze; uniform float uKick; uniform float uSite;',
    'uniform vec3 uLift; uniform vec3 uGain;',
    'varying vec2 vUv;',
    'float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    'float rnd(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'vec3 toSRGB(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }',
    'float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }',
    'float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y); }',
    'float fbm(vec2 p){ float a = 0.5; float s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }',
    'float inv(float a, float b, float x){ return 1.0 - smoothstep(a, b, x); }',
    'float seg(vec2 p, vec2 a, vec2 b, float w){ vec2 pa = p - a; vec2 ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return inv(0.0, w, length(pa - ba * h)); }',
    'float disc(vec2 p, vec2 c, float r, float soft){ return inv(r * (1.0 - soft), r, length(p - c)); }',
    // the little crosses a Moon camera burned into every photo
    'float crosses(vec2 uv, float aspect){ vec2 cell = abs(fract(vec2(uv.x * aspect, uv.y) * 4.0 + 0.5) - 0.5) / 4.0; return step(min(cell.x, cell.y), 0.0013) * step(max(cell.x, cell.y), 0.017); }',
    'vec3 heat(float t){ vec3 a = vec3(0.02, 0.0, 0.14); vec3 b = vec3(0.46, 0.02, 0.6); vec3 c = vec3(0.95, 0.26, 0.2); vec3 e = vec3(1.0, 0.76, 0.12); vec3 f = vec3(1.0, 1.0, 0.92);',
    '  return t < 0.25 ? mix(a, b, t / 0.25) : (t < 0.5 ? mix(b, c, (t - 0.25) / 0.25) : (t < 0.75 ? mix(c, e, (t - 0.5) / 0.25) : mix(e, f, (t - 0.75) / 0.25))); }',
    'void main(){',
    '  vec2 uv = vUv; float aspect = uRes.x / uRes.y;',
    '  vec2 cq = vec2((vUv.x - 0.5) * aspect, vUv.y - 0.5); float rr = length(cq);',
    // the film weaves a little in the gate during the films
    '  uv += uCine * uMotion * (vec2(noise(vec2(uTime * 7.0, 1.3)), noise(vec2(2.1, uTime * 6.0))) - 0.5) * 0.0018;',
    // the picture tears sideways for a moment
    '  if (uGlitch > 0.001) { float band = floor(uv.y * 34.0 + uTime * 9.0); float r = hash(vec2(band, floor(uTime * 22.0))); if (r > 0.78) uv.x += (r - 0.89) * 0.5 * uGlitch * uMotion; }',
    // the curve of a visor or a fisheye lens
    '  vec2 d = uv - 0.5; vec2 da = d * vec2(aspect, 1.0); float r2 = dot(da, da);',
    '  if (uBarrel > 0.001) { d *= (1.0 + uBarrel * r2) / (1.0 + uBarrel * 0.25 * (aspect * aspect + 1.0)); uv = d + 0.5; }',
    // colours split a little toward the edges, as they do in a real lens
    '  vec2 dir = d * dot(d, d) * 4.0; float ca = uCA + uShock * 0.012 + uKick * 0.004 + uCine * 0.0006;',
    '  vec3 col = vec3(texture2D(tScene, uv + dir * ca).r, texture2D(tScene, uv).g, texture2D(tScene, uv - dir * ca).b);',
    '  if (uShock > 0.001) { vec3 acc = col; for (int i = 1; i < 6; i++) acc += texture2D(tScene, uv - d * uShock * 0.035 * float(i)).rgb; col = acc / 6.0; }',
    // out-of-focus parts (the tiny-model look, or eyes short of air)
    '  float blur = uSoft * (uTilt * smoothstep(0.14, 0.5, abs(vUv.y - uTiltY)) + uLowAir * 0.7 * smoothstep(0.12, 0.7, length(d) * 1.6));',
    '  if (blur > 0.001) col = mix(col, texture2D(tSoft, uv).rgb, clamp(blur, 0.0, 1.0));',
    // glow
    '  vec3 dirt = texture2D(tDirt, vUv).rgb;',
    '  col += texture2D(tBloom, uv).rgb * uBloom * mix(vec3(1.0), vec3(1.0, 0.6, 0.4), uHalo);',
    '  col += texture2D(tWide, uv).rgb * uWide * (1.0 + dirt * uDirt * 3.0);',
    '  col += texture2D(tFlare, uv).rgb * uFlare * (1.0 + dirt * uDirt * 4.0);',
    '  col = col * uExp + uFlash;',
    // very bright parts roll off gently instead of burning out to flat white
    '  float m = max(col.r, max(col.g, col.b));',
    '  if (m > 0.6) { float mm = 0.6 + 0.4 * (1.0 - exp(-(m - 0.6) / 0.4)); col *= mm / m; col = mix(col, vec3(mm), smoothstep(1.2, 4.5, m) * 0.9); }      // and the very brightest turn white-hot',
    '  col = toSRGB(col);',
    // colour: each world has its own
    '  float l = luma(col); col = mix(vec3(l), col, uSat); col = (col - 0.5) * uCon + 0.5; col = col * uGain + uLift * (1.0 - col);',
    // camera filters
    '  if (uFilter > 0.5 && uFilter < 1.5) {',
    '    float g = luma(col); col = mix(col, vec3(g), 0.5); col = col * vec3(1.03, 1.0, 0.93) + vec3(0.0, 0.014, 0.034) * (1.0 - g); col = (col - 0.5) * 1.14 + 0.5;',
    '    col = mix(col, vec3(0.03), crosses(vUv, aspect) * 0.85);',
    '  } else if (uFilter > 1.5 && uFilter < 2.5) {',
    '    float g2 = (luma(col) - 0.5) * 1.3 + 0.52; col = vec3(g2) * (1.0 - smoothstep(0.6, 0.72, sqrt(r2))) * (0.95 + 0.05 * sin(vUv.y * uRes.y * 1.4));',
    '  } else if (uFilter > 2.5 && uFilter < 3.5) {',
    '    float g3 = luma(col); col = g3 + (col - g3) * 2.7; col = (col - 0.5) * 1.1 + 0.5;',
    '  } else if (uFilter > 3.5) { col = heat(clamp(luma(col) * 1.08, 0.0, 1.0)); }',
    // Mars dust: sheets of haze drift across
    '  if (uHaze > 0.001) { float hz = fbm(vec2(vUv.x * 2.4 * aspect - uTime * 0.22 * uMotion, vUv.y * 3.0 + uTime * 0.03));',
    '    col = mix(col, vec3(0.9, 0.72, 0.55) * (0.6 + 0.5 * luma(col)), uHaze * (0.1 + 0.34 * hz) * (0.6 + 0.4 * (1.0 - vUv.y))); }',
    // a solar storm: an aurora glow round the edges, and charged particles hitting the camera (and your eyes)
    '  if (uStorm + uWarn > 0.001) {',
    '    float edge = smoothstep(0.2, 0.75, rr);',
    '    float au = fbm(vec2(atan(cq.y, cq.x) * 2.5 + uTime * 0.25 * uMotion, rr * 5.0 - uTime * 0.9 * uMotion));',
    '    col += vec3(1.0, 0.22, 0.72) * edge * au * uStorm * 0.5;',
    '    col += vec3(0.25, 1.0, 0.75) * edge * edge * (1.0 - au) * uStorm * 0.16;',
    '    col += vec3(1.0, 0.25, 0.65) * edge * edge * uWarn * (0.1 + 0.08 * sin(uTime * 6.0) * uMotion);',
    '  }',
    '  if (uStorm > 0.001) {',
    '    float tick = floor(uTime * 30.0 * uMotion); float sn = rnd(mod(floor(vUv * uRes / 3.0), 613.0) + vec2(mod(tick * 1.37, 97.0), mod(tick * 2.11, 89.0)));',
    '    col += vec3(1.0, 0.78, 0.96) * step(1.0 - 0.0035 * uStorm, sn) * 0.9 * uMotion;',
    '    if (uMotion > 0.5) {',
    '      for (int i = 0; i < 9; i++) {',
    '        float fi = float(i); float ph = uTime * 7.0 + fi * 0.37; float slot = floor(ph); float age = fract(ph);',
    '        if (hash(vec2(slot, fi)) < uStorm * 0.6) {',
    '          vec2 p0 = vec2((hash(vec2(slot + 1.3, fi)) - 0.5) * aspect, hash(vec2(slot + 7.1, fi)) - 0.5);',
    '          float an = hash(vec2(slot, fi + 3.0)) * 6.2832; float ln = 0.01 + 0.07 * hash(vec2(fi, slot + 2.0));',
    '          col += vec3(1.0, 0.92, 1.0) * pow(1.0 - age, 4.0) * (seg(cq, p0, p0 + vec2(cos(an), sin(an)) * ln, 0.0022) * 1.4 + disc(cq, p0, 0.012, 1.0) * 0.45);',
    '        }',
    '      }',
    '    }',
    '    col = mix(col, col * vec3(1.07, 0.9, 1.03), uStorm * 0.5);',
    '  }',
    // cold and dark: frost creeps in from the edges of the visor
    '  if (uCold > 0.001) { float fr = fbm(cq * 7.0 + 3.0); float ridge = 1.0 - abs(fbm(cq * 16.0) * 2.0 - 1.0);',
    '    float fm = smoothstep(0.42, 0.85, rr + (fr - 0.5) * 0.4) * uCold;',
    '    col = mix(col, vec3(0.8, 0.9, 0.99) * (0.42 + 0.7 * luma(col)), fm * (0.25 + 0.5 * pow(ridge, 5.0))); }',
    // not enough air: colours drain and the edges close in, in time with your pulse
    '  if (uLowAir > 0.001) { float g4 = luma(col); col = mix(col, vec3(g4) * vec3(0.92, 0.96, 1.05), uLowAir * 0.7);',
    '    col *= 1.0 - uLowAir * (0.35 + 0.2 * (0.5 + 0.5 * sin(uTime * 4.2) * uMotion)) * smoothstep(0.2, 0.75, length(d) * 1.5); }',
    // warm light leaks drift across the title and the films
    '  if (uLeak > 0.001) {',
    '    vec2 lp = vec2(-0.75 * aspect + 0.25 * sin(uTime * 0.11), 0.45 + 0.1 * sin(uTime * 0.07));',
    '    col += mix(vec3(1.0, 0.42, 0.18), vec3(1.0, 0.6, 0.25), uSite) * inv(0.0, 1.1, length(cq - lp)) * 0.07 * uLeak;',
    '    vec2 lq = vec2(0.8 * aspect, -0.5 + 0.1 * cos(uTime * 0.09));',
    '    col += vec3(0.3, 0.45, 1.0) * inv(0.0, 0.9, length(cq - lq)) * 0.05 * uLeak;',
    '  }',
    // a postcard photo: the cross marks of an Apollo Hasselblad camera, for a moment
    '  if (uSnap > 0.001) col = mix(col, vec3(0.03), crosses(vUv, aspect) * min(1.0, uSnap * 1.5) * 0.85);',
    // dark corners and film grain
    '  col *= 1.0 - uVig * smoothstep(0.32, 0.92, length(d * vec2(mix(1.0, aspect, 0.5), 1.0)));',
    '  col += (hash(vUv * uRes + fract(uTime) * 311.7 * uMotion) - 0.5) * uGrain * (1.0 - 0.5 * luma(col));',
    '  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  function mat(frag, uniforms) {
    return new T.ShaderMaterial({ uniforms: uniforms, vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false, toneMapped: false });
  }
  function u(v) { return { value: v }; }
  function target(w, h, o) {
    return new T.WebGLRenderTarget(Math.max(2, Math.round(w)), Math.max(2, Math.round(h)), Object.assign({
      minFilter: T.LinearFilter, magFilter: T.LinearFilter, type: hdr ? T.HalfFloatType : T.UnsignedByteType, depthBuffer: false, stencilBuffer: false, generateMipmaps: false
    }, o || {}));
  }
  // smudges and specks on the lens: they only show where bright light crosses them
  function makeDirt() {
    var c = document.createElement('canvas'); c.width = 512; c.height = 288;
    var x = c.getContext('2d'), i, seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    x.fillStyle = '#000'; x.fillRect(0, 0, 512, 288);
    for (i = 0; i < 90; i++) {
      var px = rnd() * 512, py = rnd() * 288, r = 4 + Math.pow(rnd(), 2.2) * 58, a = 0.03 + rnd() * 0.13;
      var g = x.createRadialGradient(px, py, r * 0.15, px, py, r);
      g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(0.8, 'rgba(255,255,255,' + (a * 0.7) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
    }
    x.strokeStyle = 'rgba(255,255,255,0.05)'; x.lineWidth = 1;
    for (i = 0; i < 14; i++) { var sx = rnd() * 512, sy = rnd() * 288; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + (rnd() - 0.5) * 140, sy + (rnd() - 0.5) * 30); x.stroke(); }
    var t = new T.CanvasTexture(c); t.encoding = T.LinearEncoding;
    return t;
  }

  function build(renderer) {
    quad = new T.Mesh(new T.PlaneGeometry(2, 2), null); quad.frustumCulled = false;
    fsScene = new T.Scene(); fsScene.add(quad);
    fsCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    dirtTex = makeDirt();
    if (W.lite && !userSet) F.tier = 'low';            // phones and tablets: glow, colour and grain only
    mats.down = mat(DOWN, { tMap: u(null), uTexel: u(new T.Vector2()) });
    mats.bright = mat(BRIGHT, { tMap: u(null), uTexel: u(new T.Vector2()), uThresh: u(1.0), uKnee: u(0.2) });
    mats.blur = mat(BLUR, { tMap: u(null), uDir: u(new T.Vector2()) });
    mats.flare = mat(FLARE, { tBright: u(null), tWide: u(null), uSun: u(new T.Vector2(0.5, 0.5)), uSunOn: u(0), uRays: u(0), uTexel: u(new T.Vector2()) });
    mats.final = mat(FINAL, { tScene: u(null), tBloom: u(null), tWide: u(null), tFlare: u(null), tSoft: u(null), tDirt: u(dirtTex), uRes: u(new T.Vector2(1, 1)), uTime: u(0),
      uBloom: u(0), uWide: u(0), uFlare: u(0), uCA: u(0), uVig: u(0), uGrain: u(0), uSat: u(1), uCon: u(1), uTilt: u(0), uTiltY: u(0.5), uSoft: u(0), uStorm: u(0), uLowAir: u(0),
      uBarrel: u(0), uFlash: u(0), uShock: u(0), uGlitch: u(0), uFilter: u(0), uDirt: u(0.5), uHalo: u(0.5), uExp: u(1), uLift: u(new T.Vector3()), uGain: u(new T.Vector3(1, 1, 1)),
      uMotion: u(reduce ? 0 : 1), uWarn: u(0), uCold: u(0), uCine: u(0), uLeak: u(0), uSnap: u(0), uHaze: u(0), uKick: u(0), uSite: u(1) });
  }
  function buffers(renderer) {
    var w = size.x, h = size.y, k;
    if (rts) for (k in rts) rts[k].dispose();
    rts = {
      scene: target(w, h, { depthBuffer: true, samples: renderer.capabilities.isWebGL2 ? msaa : 0 }),
      half: target(w / 2, h / 2), qa: target(w / 4, h / 4), qb: target(w / 4, h / 4),
      ea: target(w / 8, h / 8), eb: target(w / 8, h / 8), flare: target(w / 4, h / 4),
      sa: target(w / 4, h / 4), sb: target(w / 4, h / 4)
    };
  }
  function draw(renderer, m, to) { quad.material = m; renderer.setRenderTarget(to); renderer.render(fsScene, fsCam); }
  function blur(renderer, a, b) {          // blur what is in a (using b as scratch paper); the result ends up back in a
    var m = mats.blur;
    m.uniforms.tMap.value = a.texture; m.uniforms.uDir.value.set(1 / a.width, 0); draw(renderer, m, b);
    m.uniforms.tMap.value = b.texture; m.uniforms.uDir.value.set(0, 1 / a.height); draw(renderer, m, a);
  }

  // ---------- which look does this moment ask for? ----------
  function wanted() {
    var s = F.state, mars = s.site === 'mars', env = W.env || {}, dust = env.dustShown || 0, f = F.FILTERS[F.filter].id;
    var t = mars ? { bloom: 0.5, wide: 0.3, flare: 0.36, rays: 0.5 + dust * 0.7, ca: 0.0012, vig: 0.3, grain: 0.04, sat: 1.1, con: 1.04, halo: 0.5, lr: 0, lg: 0.006, lb: 0.016, gr: 1.01, gg: 0.99, gb: 0.95 }
      : { bloom: 0.5, wide: 0.28, flare: 0.6, rays: 0, ca: 0.0012, vig: 0.28, grain: 0.035, sat: 0.96, con: 1.08, halo: 0.15, lr: 0, lg: 0.004, lb: 0.02, gr: 1, gg: 1, gb: 1.03 };
    t.tilt = 0; t.tiltY = 0.52; t.dirt = 0.5; t.exp = 1; t.barrel = 0;
    if (dust > 0.02) { t.sat -= dust * 0.22; t.lr += dust * 0.035; t.lg += dust * 0.016; t.grain += dust * 0.02; t.wide += dust * 0.2; }
    if (s.mode === 'title' || s.mode === 'end') { t.tilt = 0.42; t.sat += 0.1; t.bloom += 0.12; t.vig += 0.08; t.exp = 0.96; }
    else if (s.mode === 'vision') { t.tilt = 0.7; t.sat += 0.1; t.bloom += 0.1; }
    else if (s.mode === 'intro') { t.grain += 0.03; t.ca += 0.0008; t.vig += 0.1; t.bloom += 0.15; t.flare += 0.25; t.dirt = 0.8; }
    else if (s.mode === 'dance') { t.sat += 0.3; t.bloom += 0.45; t.ca += 0.0016; t.wide += 0.2; }
    else if (s.mode === 'night' || s.mode === 'brief') { t.gr *= 0.93; t.gg *= 0.97; t.gb *= 1.07; t.sat -= 0.06; t.vig += 0.08; t.tilt = 0.5; }
    else if (s.mode === 'launch') { t.bloom += 0.4; t.flare += 0.3; t.wide += 0.25; }
    if (s.room) { t.gr *= 1.02; t.gb *= 0.96; t.bloom = 0.2; t.wide = 0.08; t.flare = 0.12; t.exp = 0.86; t.vig += 0.08; t.rays = 0; t.sat += 0.06; }      // white walls indoors: less glow, a little darker
    if (s.pov) { t.barrel = 0.1; t.ca += 0.0007; t.dirt = 0.9; }
    if (f === 'apollo') { t.grain = 0.085; t.vig += 0.12; }
    else if (f === 'rover') { t.barrel = 0.95; t.grain = 0.06; t.ca = 0; }
    else if (f === 'false' || f === 'heat') { t.grain *= 0.5; }
    return t;
  }

  // Does the picture really come out? (A graphics card that cannot do this would give a black screen.)
  function works(renderer) {
    var gl = renderer.getContext(), k, px = new Uint8Array(4), sum = 0, i, j;
    for (k in mats) {
      var pr = renderer.properties.get(mats[k]).currentProgram;
      if (pr && !gl.getProgramParameter(pr.program, gl.LINK_STATUS)) return false;
    }
    for (i = 1; i <= 4; i++) for (j = 1; j <= 4; j++) {
      gl.readPixels(Math.floor(size.x * i / 5), Math.floor(size.y * j / 5), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      sum += px[0] + px[1] + px[2];
    }
    return sum > 0;
  }
  function glide(key, want, dt, speed) { live[key] += (want - live[key]) * Math.min(1, dt * speed); }
  // tell the page whether the camera is drawing (the flat storm overlay steps back when it is)
  function mark() { if (document.body) document.body.classList.toggle('fx-on', F.on && !F.failed); }
  function giveUp(why) {
    F.failed = true; F.ready = false; mark();
    if (window.console) console.warn('Astro Outpost: camera effects are off (' + why + '). The game draws the plain picture instead.');
  }

  // ---------- one frame ----------
  // Returns true when it has drawn the frame; false means "draw it the plain way".
  F.render = function (renderer, scene, camera, dt) {
    if (!F.on || F.failed) return false;
    try {
      if (!quad) {
        if (!renderer.capabilities.isWebGL2) { giveUp('this browser has no WebGL 2'); return false; }
        build(renderer);
      }
      renderer.getDrawingBufferSize(v2);
      if (!rts || v2.x !== size.x || v2.y !== size.y) { size.copy(v2); buffers(renderer); }
      var low = F.tier === 'low', env = W.env || {}, st = F.state, k;
      time += dt;

      // --- is this computer keeping up? If not, do less; if still not, stop.
      var now = window.performance ? performance.now() : Date.now(), real = (now - lastReal) / 1000;
      lastReal = now;
      if (real > 0.004 && real < 0.25 && !document.hidden && !userSet && (st.mode === 'play' || st.mode === 'inside')) {
        ema += (real - ema) * 0.05;
        slow = ema > 0.036 ? slow + real : Math.max(0, slow - real * 2);
        if (slow > 5) { slow = 0; ema = 0.02; if (!low) F.tier = 'low'; else { F.on = false; mark(); renderer.setRenderTarget(null); return false; } }
      }

      // --- glide toward the look this moment asks for
      var want = wanted(), ease = Math.min(1, dt * 2.6);
      for (k in want) P[k] += (want[k] - P[k]) * (frames < 2 ? 1 : ease);
      pulse.flash *= Math.exp(-dt * 6); pulse.shock *= Math.exp(-dt * 4.5); pulse.glitch *= Math.exp(-dt * 5); pulse.glow *= Math.exp(-dt * 2.4);
      var needAir = (st.mode === 'play' || st.mode === 'inside') ? Math.max(0, Math.min(1, (16 - st.air) / 16)) : 0;
      lowAir += (needAir - lowAir) * Math.min(1, dt * 1.5);
      var out = st.mode === 'play', mars = st.site === 'mars', phase = '', G = JA.game;
      try { if (G && G.s && JA.sim && JA.sim.stormPhase) phase = JA.sim.stormPhase(G.s); } catch (e0) { phase = ''; }
      var cineOn = st.mode === 'intro' || st.mode === 'launch' || st.mode === 'vision';
      glide('storm', (env.stormShown || 0) * (out ? 1 : st.mode === 'inside' ? 0.15 : 0.6), dt, 4);
      glide('warn', out && phase === 'warning' ? 1 : 0, dt, 3);
      glide('cold', out && !st.room ? Math.max(0, Math.min(1, ((env.dark || 0) - 0.55) / 0.4)) * (mars ? 0.7 : 0.8) : 0, dt, 0.6);
      glide('cine', cineOn ? 1 : 0, dt, 2);
      glide('leak', st.mode === 'title' || st.mode === 'brief' ? 1 : cineOn ? 0.6 : 0, dt, 2);
      glide('haze', mars && !st.room ? (env.dustShown || 0) : 0, dt, 2);
      snapT = Math.max(0, snapT - dt);

      // --- 1. the world itself, with the Sun as bright as it really is
      var sp = W.sunSprite, boost = 5;
      if (sp) sp.material.color.multiplyScalar(boost);
      renderer.setRenderTarget(rts.scene); renderer.render(scene, camera);
      if (sp) sp.material.color.multiplyScalar(1 / boost);

      // --- 2. find the glow
      var m, soft = !low && (P.tilt > 0.01 || lowAir > 0.01);
      if (low) {
        m = mats.bright; m.uniforms.tMap.value = rts.scene.texture; m.uniforms.uTexel.value.set(2 / size.x, 2 / size.y); draw(renderer, m, rts.qa);
      } else {
        m = mats.down; m.uniforms.tMap.value = rts.scene.texture; m.uniforms.uTexel.value.set(1 / size.x, 1 / size.y); draw(renderer, m, rts.half);
        m = mats.bright; m.uniforms.tMap.value = rts.half.texture; m.uniforms.uTexel.value.set(1 / rts.half.width, 1 / rts.half.height); draw(renderer, m, rts.qa);
      }
      blur(renderer, rts.qa, rts.qb);
      if (!low) {
        m = mats.down; m.uniforms.tMap.value = rts.qa.texture; m.uniforms.uTexel.value.set(1 / rts.qa.width, 1 / rts.qa.height); draw(renderer, m, rts.ea);
        blur(renderer, rts.ea, rts.eb);
        // where is the Sun on the screen?
        var on = 0;
        if (W.sunDir && !st.room) {
          v3.copy(camera.position).addScaledVector(W.sunDir, 1000).project(camera);
          if (v3.z < 1) { var ox = Math.max(0, Math.abs(v3.x) - 1), oy = Math.max(0, Math.abs(v3.y) - 1); on = Math.max(0, 1 - Math.hypot(ox, oy) * 2.2); }
          mats.flare.uniforms.uSun.value.set(v3.x * 0.5 + 0.5, v3.y * 0.5 + 0.5);
        }
        m = mats.flare; m.uniforms.tBright.value = rts.qa.texture; m.uniforms.tWide.value = rts.ea.texture; m.uniforms.uSunOn.value = on;
        m.uniforms.uRays.value = P.rays; m.uniforms.uTexel.value.set(1 / rts.qa.width, 1 / rts.qa.height); draw(renderer, m, rts.flare);
      }
      if (soft) {
        m = mats.down; m.uniforms.tMap.value = rts.half.texture; m.uniforms.uTexel.value.set(1 / rts.half.width, 1 / rts.half.height); draw(renderer, m, rts.sa);
        blur(renderer, rts.sa, rts.sb); blur(renderer, rts.sa, rts.sb);
      }

      // --- 3. put it together
      var U = mats.final.uniforms;
      U.tScene.value = rts.scene.texture; U.tBloom.value = rts.qa.texture; U.tWide.value = low ? rts.qa.texture : rts.ea.texture;
      U.tFlare.value = low ? rts.qa.texture : rts.flare.texture; U.tSoft.value = soft ? rts.sa.texture : rts.qa.texture;
      U.uRes.value.set(size.x, size.y); U.uTime.value = time % 1000;
      U.uBloom.value = P.bloom + pulse.glow * 0.8; U.uWide.value = low ? 0 : P.wide + pulse.glow * 0.5; U.uFlare.value = low ? 0 : P.flare;
      U.uCA.value = low ? 0 : P.ca; U.uVig.value = P.vig; U.uGrain.value = P.grain; U.uSat.value = P.sat; U.uCon.value = P.con;
      U.uSoft.value = soft ? 1 : 0; U.uTilt.value = P.tilt; U.uTiltY.value = P.tiltY; U.uStorm.value = Math.min(1, live.storm); U.uLowAir.value = lowAir;
      U.uWarn.value = live.warn; U.uCold.value = live.cold; U.uCine.value = live.cine; U.uLeak.value = live.leak; U.uHaze.value = live.haze;
      U.uSnap.value = Math.min(1, snapT / 1.6); U.uSite.value = mars ? 1 : 0;
      U.uKick.value = reduce ? 0 : Math.max(0, Math.min(1, (W.cam && W.cam.shake ? W.cam.shake : 0) * 2.2));
      U.uBarrel.value = P.barrel; U.uFlash.value = pulse.flash; U.uShock.value = pulse.shock; U.uGlitch.value = pulse.glitch;
      U.uFilter.value = F.filter; U.uDirt.value = P.dirt; U.uHalo.value = P.halo; U.uExp.value = P.exp;
      U.uLift.value.set(P.lr, P.lg, P.lb); U.uGain.value.set(P.gr, P.gg, P.gb);
      draw(renderer, mats.final, null);

      // --- the first few frames: make sure a picture really came out
      frames++;
      if (checked < 2 && (frames === 3 || frames === 12)) {
        if (works(renderer)) { checked = 2; F.ready = true; }
        else if (hdr || msaa) { hdr = false; msaa = 0; buffers(renderer); frames = 0; checked++; }      // try once more the simple way
        else { giveUp('the graphics card cannot draw them'); renderer.setRenderTarget(null); return false; }
        if (checked >= 2 && !F.ready) { giveUp('the graphics card cannot draw them'); renderer.setRenderTarget(null); return false; }
      }
      return true;
    } catch (e) {
      giveUp(e && e.message ? e.message : 'an error');
      try { renderer.setRenderTarget(null); } catch (e2) { /* nothing more to do */ }
      return false;
    }
  };

  // ---------- what the game can ask for ----------
  // a short jolt: 'flash' (white), 'shock' (the lens is shaken), 'glitch' (the picture tears), 'glow' (a warm swell)
  F.pulse = function (kind, amount) {
    if (pulse[kind] == null || (reduce && (kind === 'shock' || kind === 'glitch'))) return;
    pulse[kind] = Math.max(pulse[kind], amount == null ? 1 : amount);
  };
  F.snap = function () { snapT = 1.6; };          // a postcard photo was taken
  F.setFilter = function (i) { F.filter = ((i % F.FILTERS.length) + F.FILTERS.length) % F.FILTERS.length; return F.FILTERS[F.filter]; };
  F.nextFilter = function () { return F.setFilter(F.filter + 1); };
  F.current = function () { return F.FILTERS[F.filter]; };
  F.available = function () { return !F.failed; };
  // level: 2 = full, 1 = lite, 0 = off
  F.LEVELS = ['Off', 'Lite', 'Full'];
  function getLevel() { return !F.on || F.failed ? 0 : (F.tier === 'low' ? 1 : 2); }
  function apply(n) { F.on = n > 0 && !F.failed; if (n > 0) F.tier = n === 1 ? 'low' : 'high'; slow = 0; ema = 0.016; mark(); }
  try { Object.defineProperty(F, 'level', { get: getLevel }); } catch (e) { F.level = 2; }
  F.setLevel = function (n) {
    apply(((n % 3) + 3) % 3); userSet = true;
    try { localStorage.setItem('ja-fx', String(getLevel())); } catch (e) { /* storage may be blocked */ }
    return getLevel();
  };
  F.nextLevel = function () { return F.setLevel(getLevel() === 0 ? 2 : getLevel() - 1); };      // full, lite, off, full...
  F.setOn = function (v) { return F.setLevel(v ? (W.lite ? 1 : 2) : 0) > 0; };
  (function () {
    var saved = null, q = /[?&]fx=([0-2])/.exec(location.search);      // ?fx=0|1|2 forces a level for this visit
    try { saved = localStorage.getItem('ja-fx'); } catch (e) { saved = null; }
    if (q) { apply(+q[1]); userSet = true; }
    else if (saved === 'off' || saved === '0') { apply(0); userSet = true; }
    else if (saved === '1') { apply(1); userSet = true; }
    else if (saved === '2' || saved === 'on') { apply(2); userSet = true; }
    else mark();
  })();
})(window.JA);
