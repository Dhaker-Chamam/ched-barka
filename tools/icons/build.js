#!/usr/bin/env node
/* Astro Outpost — draws the UI icon set as SVG files in assets/icons/.
   One style for all: 64×64, bright gradient fills with a soft top highlight, made to read
   on the dark navy HUD panels. js/icons.js swaps the matching emoji for these images.
   Run: node tools/icons/build.js */
'use strict';
var fs = require('fs'), path = require('path');
var OUT = path.join(__dirname, '..', '..', 'assets', 'icons');
fs.mkdirSync(OUT, { recursive: true });

var uid = 0;
function grad(top, bottom) {
  var id = 'g' + (++uid);
  return { id: id, def: '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + top + '"/><stop offset="1" stop-color="' + bottom + '"/></linearGradient>', url: 'url(#' + id + ')' };
}
function svg(name, defs, body) {
  var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">' +
    (defs.length ? '<defs>' + defs.join('') + '</defs>' : '') + body + '</svg>\n';
  fs.writeFileSync(path.join(OUT, name + '.svg'), s);
  uid = 0;
}
var SHINE = 'fill="#fff" fill-opacity="0.28"';

// ---- resources ----
(function () {
  var g = grad('#b8f6ff', '#26b2e6');
  svg('air', [g.def],
    '<g fill="none" stroke="' + g.url + '" stroke-width="6" stroke-linecap="round">' +
    '<path d="M7 22h29a8 8 0 1 0-8-8"/><path d="M7 34h41a8 8 0 1 1-8 8"/><path d="M7 46h19a6 6 0 1 1-6 6"/></g>');
})();
(function () {
  var a = grad('#c4f7a8', '#3fb54a'), b = grad('#a8ef8a', '#2f9a3c');
  svg('food', [a.def, b.def],
    '<path d="M32 60V30" stroke="#2f8a35" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M32 40C17 42 6 31 6 15c15 0 26 9 26 25z" fill="' + a.url + '"/>' +
    '<path d="M32 33C33 17 44 6 59 7c1 17-11 27-27 26z" fill="' + b.url + '"/>' +
    '<path d="M30 38C22 32 16 26 12 19M34 31c6-6 12-12 19-19" stroke="#e9ffd9" stroke-opacity="0.6" stroke-width="2" fill="none" stroke-linecap="round"/>');
})();
(function () {
  var g = grad('#ffb3d6', '#ff4f9e');
  function sector(a0, a1, r0, r1) {
    function p(r, a) { return (32 + r * Math.cos(a)).toFixed(2) + ' ' + (32 + r * Math.sin(a)).toFixed(2); }
    return 'M' + p(r0, a0) + 'L' + p(r1, a0) + 'A' + r1 + ' ' + r1 + ' 0 0 1 ' + p(r1, a1) + 'L' + p(r0, a1) + 'A' + r0 + ' ' + r0 + ' 0 0 0 ' + p(r0, a0) + 'Z';
  }
  var d = '', k;
  for (k = 0; k < 3; k++) { var c = -Math.PI / 2 + k * 2 * Math.PI / 3; d += sector(c - Math.PI / 6, c + Math.PI / 6, 8.5, 23); }
  svg('radiation', [g.def],
    '<circle cx="32" cy="32" r="29" fill="' + g.url + '"/><path d="M8 26a25 25 0 0 1 48 0" ' + SHINE + '/>' +
    '<path d="' + d + '" fill="#2b0a1f"/><circle cx="32" cy="32" r="5" fill="#2b0a1f"/>');
})();
(function () {
  var g = grad('#fff1a6', '#ffb400'), pts = [], i;
  for (i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11.5 : 25; pts.push((32 + r * Math.cos(a)).toFixed(2) + ',' + (34 + r * Math.sin(a)).toFixed(2)); }
  svg('star', [g.def], '<polygon points="' + pts.join(' ') + '" fill="' + g.url + '" stroke="' + g.url + '" stroke-width="5" stroke-linejoin="round"/>');
})();
(function () {
  var g = grad('#fff3a8', '#ffb000'), rays = '', i;
  for (i = 0; i < 8; i++) rays += '<rect x="29.5" y="3" width="5" height="11" rx="2.5" transform="rotate(' + (i * 45) + ' 32 32)"/>';
  svg('sun', [g.def], '<g fill="#ffcf3a">' + rays + '</g><circle cx="32" cy="32" r="14" fill="' + g.url + '"/><circle cx="27" cy="27" r="5" ' + SHINE + '/>');
})();

// ---- machines ----
(function () {
  var g = grad('#e6d6ff', '#8e5cff');
  svg('shield', [g.def],
    '<path d="M32 5l23 8v17c0 15-10 25-23 29C19 55 9 45 9 30V13z" fill="' + g.url + '"/>' +
    '<path d="M32 12l16 5.5V30c0 10.5-7 17.5-16 20.5" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M20 40a12 12 0 0 1 24 0z" fill="#3b2470" fill-opacity="0.55"/>');
})();
(function () {
  var g = grad('#ffd89a', '#ff9a1f');
  svg('lab', [g.def],
    '<rect x="10" y="50" width="44" height="9" rx="4.5" fill="' + g.url + '"/>' +
    '<path d="M42 50V34a12 12 0 0 0-12-12" fill="none" stroke="#e98a12" stroke-width="7" stroke-linecap="round"/>' +
    '<rect x="17" y="40" width="22" height="5" rx="2.5" fill="#e98a12"/>' +
    '<g transform="rotate(-28 24 20)"><rect x="18" y="4" width="12" height="30" rx="4" fill="' + g.url + '"/><rect x="16" y="2" width="16" height="6" rx="3" fill="#ffe7bf"/><rect x="20" y="10" width="3" height="18" rx="1.5" ' + SHINE + '/></g>');
})();
(function () {
  var g = grad('#ffd0e2', '#ff6fa3');
  svg('dish', [g.def],
    '<path d="M24 46l-9 13h22l-9-13z" fill="#d9558a"/>' +
    '<g transform="rotate(-35 28 34)"><path d="M5 30a23 15 0 0 0 46 0z" fill="' + g.url + '"/><path d="M28 30V13" stroke="#ffd0e2" stroke-width="3" stroke-linecap="round"/><circle cx="28" cy="12" r="3.5" fill="#fff"/></g>' +
    '<path d="M44 9a12 12 0 0 1 11 11M43 2a19 19 0 0 1 19 18" fill="none" stroke="#ff8fb8" stroke-width="3" stroke-linecap="round"/>');
})();
(function () {
  var g = grad('#e2fbff', '#6fd3f0');
  svg('rover', [g.def],
    '<rect x="8" y="20" width="36" height="5" rx="2" fill="#3d6c96"/>' +
    '<path d="M48 26V12" stroke="#bfefff" stroke-width="4" stroke-linecap="round"/><rect x="42" y="6" width="13" height="8" rx="3" fill="#e2fbff"/><circle cx="51" cy="10" r="2" fill="#1d3550"/>' +
    '<rect x="6" y="26" width="52" height="15" rx="6" fill="' + g.url + '"/><rect x="10" y="29" width="30" height="3" rx="1.5" ' + SHINE + '/>' +
    '<g fill="#1d2c45" stroke="#9fe8ff" stroke-width="2.5"><circle cx="16" cy="48" r="7.5"/><circle cx="32" cy="48" r="7.5"/><circle cx="48" cy="48" r="7.5"/></g>' +
    '<g fill="#9fe8ff"><circle cx="16" cy="48" r="2.5"/><circle cx="32" cy="48" r="2.5"/><circle cx="48" cy="48" r="2.5"/></g>');
})();

// ---- carried items ----
(function () {
  var g = grad('#fff0a0', '#ffbe0a');
  svg('cell', [g.def],
    '<rect x="25" y="4" width="14" height="8" rx="2.5" fill="#d9a400"/>' +
    '<rect x="14" y="9" width="36" height="51" rx="9" fill="' + g.url + '"/><rect x="18" y="13" width="6" height="40" rx="3" ' + SHINE + '/>' +
    '<path d="M36 17L23 37h9l-4 15 14-22h-9z" fill="#5c3d00"/>');
})();
svg('ice', [],
  '<path d="M32 6l24 13-24 13L8 19z" fill="#eefaff"/><path d="M8 19l24 13v27L8 46z" fill="#9fdcf7"/><path d="M56 19v27L32 59V32z" fill="#5cb6e4"/>' +
  '<path d="M15 24l9 5v15" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="2.5" stroke-linecap="round"/><path d="M26 15l10-5" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>');
(function () {
  var g = grad('#e9c89c', '#b8865a');
  svg('bag', [g.def],
    '<path d="M15 22c0-6 8-5 17-5s17-1 17 5l5 28c0 6-6 9-22 9S10 56 10 50z" fill="' + g.url + '"/>' +
    '<path d="M24 18l-5-12 13 6 13-6-5 12z" fill="#9a6c42"/><rect x="21" y="15" width="22" height="5" rx="2.5" fill="#7a5232"/>' +
    '<path d="M18 30c9 3 19 3 28 0" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="2.5" stroke-dasharray="3 3" stroke-linecap="round"/>' +
    '<path d="M32 34l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9v-6z" fill="#8e5cff"/>');
})();
svg('core', ['<clipPath id="c"><rect x="18" y="10" width="28" height="46" rx="0"/></clipPath>'],
  '<g clip-path="url(#c)"><rect x="18" y="10" width="28" height="12" fill="#e8b878"/><rect x="18" y="22" width="28" height="9" fill="#b8643a"/>' +
  '<rect x="18" y="31" width="28" height="11" fill="#e0caa2"/><rect x="18" y="42" width="28" height="14" fill="#8c4a2a"/></g>' +
  '<ellipse cx="32" cy="56" rx="14" ry="5" fill="#8c4a2a"/><ellipse cx="32" cy="10" rx="14" ry="5" fill="#f6d6a6"/>' +
  '<rect x="21" y="14" width="4" height="40" rx="2" ' + SHINE + '/><circle cx="37" cy="27" r="2" fill="#7a3a1e"/><circle cx="30" cy="47" r="1.6" fill="#5a2a14"/>');
(function () {
  var g = grad('#eef3fa', '#a9b6c9');
  svg('inst', [g.def],
    '<path d="M44 22l6-14" stroke="#cfd8e6" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="8" r="3.5" fill="#ffd23f"/>' +
    '<rect x="8" y="22" width="48" height="34" rx="6" fill="' + g.url + '"/><rect x="8" y="22" width="48" height="7" rx="3" fill="#ffb84d"/>' +
    '<circle cx="24" cy="42" r="8" fill="#1d2c45"/><path d="M24 42l5-4" stroke="#4dff9a" stroke-width="2.5" stroke-linecap="round"/>' +
    '<rect x="37" y="36" width="13" height="3.5" rx="1.75" fill="#5a6a82"/><rect x="37" y="43" width="9" height="3.5" rx="1.75" fill="#5a6a82"/>');
})();
(function () {
  var g = grad('#f2f6fb', '#9fadc2');
  svg('case', [g.def],
    '<path d="M24 18v-5a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v5" fill="none" stroke="#7f8ea6" stroke-width="5"/>' +
    '<rect x="6" y="18" width="52" height="38" rx="7" fill="' + g.url + '"/><rect x="6" y="32" width="52" height="6" fill="#ff8a3d"/>' +
    '<rect x="27" y="29" width="10" height="12" rx="2.5" fill="#4b5a72"/><rect x="10" y="21" width="44" height="4" rx="2" ' + SHINE + '/>');
})();

// ---- places ----
(function () {
  var g = grad('#ffffff', '#c3cde0');
  svg('rocket', [g.def],
    '<path d="M26 50c0 6 3 10 6 13 3-3 6-7 6-13z" fill="#ffb03a"/><path d="M29 50c0 4 1.5 6.5 3 8.5 1.5-2 3-4.5 3-8.5z" fill="#fff3b0"/>' +
    '<path d="M22 38l-9 10v5l11-5zM42 38l9 10v5l-11-5z" fill="#ff5468"/>' +
    '<path d="M32 3c9 7 12 19 11 31l-3 16H24l-3-16C20 22 23 10 32 3z" fill="' + g.url + '"/>' +
    '<circle cx="32" cy="24" r="6" fill="#3fa8e6" stroke="#1d3550" stroke-width="2.5"/><path d="M26 8c-3 6-4 14-3 22" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>');
})();
(function () {
  var g = grad('#ffffff', '#b9c5da');
  svg('home', [g.def],
    '<rect x="4" y="50" width="56" height="7" rx="3.5" fill="#7d8ba3"/>' +
    '<path d="M8 50a24 24 0 0 1 48 0z" fill="' + g.url + '"/><path d="M14 40a19 19 0 0 1 14-15" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M27 50V40a5 5 0 0 1 10 0v10z" fill="#1d3550"/><circle cx="44" cy="38" r="4" fill="#ffd23f"/>' +
    '<path d="M32 26V14" stroke="#9aa8bf" stroke-width="2.5" stroke-linecap="round"/><circle cx="32" cy="12" r="3" fill="#ff8fb8"/>');
})();

// ---- life support: the water tank and the CO2 filter ----
(function () {
  var g = grad('#cfeaff', '#2f7fe6');
  svg('water', [g.def],
    '<path d="M32 5C22 19 11 30 11 42a21 21 0 0 0 42 0C53 30 42 19 32 5z" fill="' + g.url + '"/>' +
    '<path d="M21 41a11 11 0 0 0 9 11" fill="none" stroke="#fff" stroke-opacity="0.75" stroke-width="3.5" stroke-linecap="round"/>');
})();
(function () {
  var g = grad('#e2fff8', '#3db8a0');
  svg('filter', [g.def],
    '<circle cx="23" cy="40" r="16" fill="' + g.url + '"/><circle cx="46" cy="21" r="11" fill="' + g.url + '"/><circle cx="49" cy="48" r="7" fill="' + g.url + '"/>' +
    '<path d="M13 38a10 10 0 0 1 8-9M39 19a7 7 0 0 1 5-5" fill="none" stroke="#fff" stroke-opacity="0.8" stroke-width="3" stroke-linecap="round"/>');
})();

console.log('icons written to ' + OUT + ': ' + fs.readdirSync(OUT).join(', '));
