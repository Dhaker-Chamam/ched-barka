/* Astro Outpost — swaps emoji in the interface for the drawn icon set (assets/icons/*.svg,
   made by tools/icons/build.js). The game data keeps using emoji as names (the goal logic
   compares them), and this file turns them into pictures wherever they appear on screen:
   HUD, markers, banners, toasts, cards and every modal. Emoji without a drawing stay as they are. */
(function (JA) {
  'use strict';
  var MAP = {
    '💨': 'air', '🥬': 'food', '☢': 'radiation', '☀': 'sun',
    '🛡': 'shield', '🔬': 'lab', '📡': 'dish', '🚙': 'rover',
    '🔋': 'cell', '🧊': 'ice', '🧱': 'bag', '🧪': 'core', '📦': 'inst', '🧳': 'case',
    '🚀': 'rocket', '🏠': 'home', '💧': 'water', '🫧': 'filter'
  };
  var NAMES = { air: 'air', food: 'food', radiation: 'radiation', sun: 'sun', shield: 'shield', lab: 'science lab',
    dish: 'radio dish', rover: 'rover', cell: 'power cell', ice: 'ice', bag: 'soil bag', core: 'rock core', inst: 'instrument',
    'case': 'sample case', rocket: 'rocket', home: 'habitat', water: 'water', filter: 'air filter' };
  var keys = Object.keys(MAP).sort(function (a, b) { return b.length - a.length; });
  // each emoji, optionally followed by the "show as emoji" selector U+FE0F
  var RE = new RegExp('(' + keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')️?', 'g');
  var SKIP = { SCRIPT: 1, STYLE: 1, TITLE: 1, TEXTAREA: 1, INPUT: 1, OPTION: 1 };

  function img(name) {
    var el = document.createElement('img');
    el.className = 'ico'; el.src = 'assets/icons/' + name + '.svg'; el.alt = NAMES[name] || name;
    el.draggable = false;
    return el;
  }
  JA.iconHTML = function (emoji) {
    var n = MAP[String(emoji).replace(/️/g, '')];
    return n ? '<img class="ico" src="assets/icons/' + n + '.svg" alt="' + (NAMES[n] || n) + '" draggable="false">' : emoji;
  };

  function swapText(node) {
    var t = node.nodeValue;
    if (!t || t.length > 600) return;
    RE.lastIndex = 0;
    if (!RE.test(t)) return;
    var p = node.parentNode;
    if (!p || SKIP[p.nodeName] || (p.closest && p.closest('[data-noicon]'))) return;
    var frag = document.createDocumentFragment(), last = 0, m;
    RE.lastIndex = 0;
    while ((m = RE.exec(t))) {
      if (m.index > last) frag.appendChild(document.createTextNode(t.slice(last, m.index)));
      frag.appendChild(img(MAP[m[1]]));
      last = m.index + m[0].length;
    }
    if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
    p.replaceChild(frag, node);
  }
  function scan(root) {
    if (root.nodeType === 3) { swapText(root); return; }
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), list = [], n;
    while ((n = w.nextNode())) list.push(n);
    for (var i = 0; i < list.length; i++) swapText(list[i]);
  }

  // preload so the first swap does not flash empty
  Object.keys(NAMES).forEach(function (n) { new Image().src = 'assets/icons/' + n + '.svg'; });

  function start() {
    scan(document.body);
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'characterData') swapText(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) scan(m.addedNodes[j]);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})(window.JA = window.JA || {});
