/* Astro Outpost — sound made with the Web Audio API (no audio files), plus optional
   read-aloud for younger players using the browser's speech voice. */
(function (JA) {
  'use strict';
  var ctx = null, master = null, on = true, reading = false, loops = {};

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); } catch (e) { ctx = null; return false; }
    return true;
  }
  function tone(freq, dur, type, vol, delay, slide) {
    if (!on || !ensure()) return;
    var t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol, delay, freq) {
    if (!on || !ensure()) return;
    var t = ctx.currentTime + (delay || 0), n = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = ctx.createBufferSource(); s.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1800;
    var g = ctx.createGain(); g.gain.value = vol || 0.2;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }

  var S = {
    tap: function () { tone(520, 0.07, 'triangle', 0.14); },
    grab: function () { tone(330, 0.07, 'triangle', 0.16); tone(495, 0.09, 'triangle', 0.16, 0.05); },
    drop: function () { tone(300, 0.08, 'triangle', 0.12, 0, 200); },
    deny: function () { tone(160, 0.16, 'sawtooth', 0.12); },
    jump: function () { tone(300, 0.2, 'sine', 0.14, 0, 620); },
    land: function () { noise(0.12, 0.18, 0, 300); },
    thud: function () { noise(0.1, 0.22, 0, 220); tone(90, 0.12, 'sine', 0.2, 0, 50); },
    step: function () { noise(0.05, 0.05, 0, 500); },
    throw: function () { noise(0.22, 0.14, 0, 900); tone(420, 0.2, 'sine', 0.08, 0, 760); },
    plug: function () { tone(220, 0.08, 'square', 0.12); tone(440, 0.1, 'square', 0.12, 0.07); tone(880, 0.22, 'triangle', 0.16, 0.14); },
    score: function () { tone(880, 0.09, 'triangle', 0.2); tone(1320, 0.16, 'triangle', 0.2, 0.07); },
    swish: function () { [660, 880, 1100, 1320, 1760].forEach(function (f, i) { tone(f, 0.14, 'triangle', 0.2, i * 0.06); }); },
    ice: function () { tone(1400, 0.1, 'sine', 0.18); tone(2100, 0.2, 'sine', 0.14, 0.06); },
    ding: function () { tone(1046, 0.25, 'sine', 0.18); },
    air: function () { noise(0.5, 0.12, 0, 2400); tone(600, 0.4, 'sine', 0.1, 0, 900); },
    pop: function () { tone(500, 0.08, 'sine', 0.16, 0, 900); },
    warn: function () { tone(740, 0.16, 'square', 0.14); tone(560, 0.16, 'square', 0.14, 0.18); },
    click: function () { noise(0.03, 0.3, 0, 3200); },
    spark: function () { noise(0.08, 0.2, 0, 4200); tone(1800, 0.05, 'square', 0.06); },
    door: function () { tone(220, 0.25, 'sine', 0.2, 0, 110); noise(0.25, 0.1, 0.05, 500); },
    page: function () { tone(660, 0.08, 'sine', 0.12); tone(880, 0.12, 'sine', 0.12, 0.07); },
    good: function () { [523, 659, 784].forEach(function (f, i) { tone(f, 0.14, 'triangle', 0.18, i * 0.09); }); },
    hit: function () { tone(784, 0.1, 'triangle', 0.2); tone(1175, 0.16, 'triangle', 0.2, 0.08); },
    bad: function () { tone(330, 0.22, 'sawtooth', 0.1); tone(247, 0.34, 'sawtooth', 0.1, 0.18); },
    photo: function () { noise(0.05, 0.3, 0, 5000); noise(0.08, 0.2, 0.09, 2500); },
    discovery: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.22, 'triangle', 0.2, i * 0.1); }); },
    win: function () { [523, 659, 784, 1047, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.2, 'triangle', 0.2, i * 0.12); }); },
    launch: function () { tone(60, 6, 'sawtooth', 0.22, 0, 240); noise(6, 0.3, 0, 400); },
    beep: function () { tone(880, 0.12, 'square', 0.12); },
    alarm: function () { [0, 0.3, 0.6].forEach(function (d) { tone(880, 0.2, 'square', 0.16, d); tone(660, 0.1, 'square', 0.12, d + 0.14); }); },
    // sounds for the landing film
    breath: function () { noise(1.5, 0.045, 0, 420); },
    hiss: function () { noise(1.6, 0.16, 0, 3200); tone(140, 0.5, 'sine', 0.16, 0.2, 70); },
    rumble: function () { noise(0.5, 0.2, 0, 170); },
    touchdown: function () { noise(0.6, 0.4, 0, 150); tone(70, 0.5, 'sine', 0.3, 0, 36); noise(1.8, 0.1, 0.2, 900); },
    radio: function () { tone(2525, 0.16, 'sine', 0.05); noise(0.12, 0.05, 0.16, 2600); },
    pad: function () { [130.8, 196, 261.6, 329.6, 493.9].forEach(function (f, i) { tone(f, 9, 'sine', 0.06, i * 0.7); tone(f * 2.005, 9, 'sine', 0.018, i * 0.7 + 0.3); }); }
  };

  // Continuous sounds (drill, rover motor): start once, then steer pitch and loudness.
  function loop(name, freq, vol, type) {
    if (!on || !ensure()) { stopLoop(name); return; }
    var L = loops[name];
    if (!L) {
      L = loops[name] = { o: ctx.createOscillator(), g: ctx.createGain() };
      L.o.type = type || 'sawtooth'; L.g.gain.value = 0.0001;
      L.o.connect(L.g); L.g.connect(master); L.o.start();
    }
    L.o.frequency.setTargetAtTime(freq, ctx.currentTime, 0.05);
    L.g.gain.setTargetAtTime(vol, ctx.currentTime, 0.05);
  }
  function stopLoop(name) {
    var L = loops[name]; if (!L) return;
    try { L.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04); L.o.stop(ctx.currentTime + 0.25); } catch (e) { /* already stopped */ }
    delete loops[name];
  }

  function speak(text) {
    if (!reading || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(text).replace(/[\u{1F000}-\u{1FFFF}☀-➿️]/gu, ''));
      u.rate = 0.95; u.pitch = 1.15; u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    } catch (e) { /* speech not available */ }
  }

  JA.audio = {
    play: function (name) { if (S[name]) S[name](); },
    loop: loop, stopLoop: stopLoop,
    stopAll: function () { Object.keys(loops).forEach(stopLoop); },
    unlock: ensure,
    setSound: function (v) { on = v; if (!v) Object.keys(loops).forEach(stopLoop); },
    soundOn: function () { return on; },
    setReading: function (v) { reading = v; if (!v && window.speechSynthesis) window.speechSynthesis.cancel(); },
    readingOn: function () { return reading; },
    canRead: function () { return !!window.speechSynthesis; },
    speak: speak
  };
})(window.JA);
