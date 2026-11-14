/* Astro Outpost — the helmet view.
   Press V (or the 👁 button) to see the outpost through your own visor instead of from behind.
   This file only draws the inside of the helmet: the dark rim, a compass and a line of suit
   readings. The camera itself lives in world.js and the astronaut's body in actors.js. */
(function (JA) {
  'use strict';
  var P = JA.pov = {};
  var el, strip, data, marks = [], home, goal, shown = false, breath = 2, dataAt = 0, heart = 78, lastData = '';
  var DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  var PX_PER_RAD = 150;      // how far a compass letter slides for each radian you turn

  function $(id) { return document.getElementById(id); }
  function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
  function mark(text, ang, cls) {
    var m = document.createElement('span');
    m.textContent = text; m.className = cls || '';
    strip.appendChild(m);
    m.style.display = 'none';
    return { el: m, ang: ang, k: null, text: text };
  }
  function init() {
    el = $('visor'); strip = $('visor-strip'); data = $('visor-data');
    if (!el || !strip || !data) { el = null; return; }
    DIRS.forEach(function (d, i) { marks.push(mark(d, i * Math.PI / 4, i % 2 ? 'minor' : '')); });
    home = mark('🏠', 0, 'pin'); goal = mark('🎯', 0, 'pin');
  }
  // Slide one compass mark to where it belongs. heading and ang are clockwise from north.
  function place(m, heading, ang, on) {
    var d = wrap(ang - heading), vis = on !== false && Math.abs(d) < 0.95, k = vis ? Math.round(d * PX_PER_RAD) : null;
    if (k === m.k) return;
    m.k = k;
    m.el.style.display = vis ? '' : 'none';
    if (vis) { m.el.style.transform = 'translateX(' + k + 'px)'; m.el.style.opacity = (1 - Math.abs(d) / 1.15).toFixed(2); }
  }
  function bearing(from, to) { return Math.atan2(to.x - from.x, -(to.z - from.z)); }      // north is -z on this map

  // Called every frame by the game.
  //   active: the helmet view is on and the astronaut is outside
  //   info:   { yaw, pos, home, goal, goalIcon, air, moving, effort }
  P.frame = function (dt, active, info) {
    if (el === undefined) init();
    if (!el) return;
    active = !!active;
    if (active !== shown) {
      shown = active;
      el.classList.toggle('hidden', !active);
      document.body.classList.toggle('pov', active);
    }
    if (!active || !info) return;
    var heading = -info.yaw, i, dHome = Math.hypot(info.home.x - info.pos.x, info.home.z - info.pos.z);
    for (i = 0; i < marks.length; i++) place(marks[i], heading, marks[i].ang);
    place(home, heading, bearing(info.pos, info.home), dHome > 8);
    if (info.goal && info.goalIcon && info.goalIcon !== goal.text) { goal.text = info.goalIcon; goal.el.textContent = info.goalIcon; }
    place(goal, heading, info.goal ? bearing(info.pos, info.goal) : 0, !!info.goal);
    // suit readings: your heart beats faster when you run
    heart += ((info.effort ? 132 : info.moving ? 98 : 76) - heart) * Math.min(1, dt * 0.45);
    dataAt -= dt;
    if (dataAt <= 0) {
      dataAt = 0.5;
      var deg = Math.round(((heading * 180 / Math.PI) % 360 + 360) % 360);
      var text = 'O₂ ' + Math.round(info.air) + '%   ·   ♥ ' + Math.round(heart) + '   ·   ' + ('00' + deg).slice(-3) + '° ' + DIRS[Math.round(deg / 45) % 8] +
        '   ·   HOME ' + Math.round(dHome) + ' m';
      if (text !== lastData) { lastData = text; data.textContent = text; }
    }
    // the sound of your own breathing, faster when you run
    breath -= dt * (info.effort ? 1.7 : 1);
    if (breath <= 0) { breath = 4.6; if (JA.audio) JA.audio.play('breath'); }
  };
})(window.JA);
