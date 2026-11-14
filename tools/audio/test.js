#!/usr/bin/env node
/* Astro Outpost — sound test. Opens the real game in headless Chrome, plays through the landing film and
   a few minutes of a mission, and checks that every recorded sound loads and is the one that plays.

     node tools/audio/test.js              test the Moon
     node tools/audio/test.js mars         test Mars
     CHROME=/path/to/chrome node tools/audio/test.js     when Chrome is not in its usual place

   Needs Node 22 or newer (for its built-in WebSocket) and Chrome. Nothing is installed.
   It cannot judge how a sound SOUNDS: for that, open tools/audio/soundboard.html and listen. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), { spawn } = require('child_process');
const M = require('./manifest.js');
const ROOT = path.resolve(__dirname, '..', '..');
const SITE = process.argv[2] === 'mars' ? 'mars' : 'moon';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const c = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return c.find((p) => p && fs.existsSync(p));
}
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      const buf = fs.readFileSync(file), range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
      const head = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
      if (range) {                                   // <audio> asks for byte ranges
        const a = +range[1], b = range[2] ? +range[2] : buf.length - 1;
        res.writeHead(206, { ...head, 'Content-Range': 'bytes ' + a + '-' + b + '/' + buf.length, 'Content-Length': b - a + 1 }); res.end(buf.subarray(a, b + 1));
      } else { res.writeHead(200, { ...head, 'Content-Length': buf.length }); res.end(buf); }
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function main() {
  const chromePath = findChrome();
  if (!chromePath) throw new Error('Chrome not found. Set the CHROME environment variable to its path.');
  if (typeof WebSocket === 'undefined') throw new Error('This test needs Node 22 or newer.');
  const srv = await serve(), base = 'http://127.0.0.1:' + srv.address().port + '/';
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-test-'));
  const chrome = spawn(chromePath, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--autoplay-policy=no-user-gesture-required',
    '--mute-audio', '--enable-unsafe-swiftshader', '--no-first-run', '--disable-extensions', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
  const fails = [], notes = [];
  const check = (ok, what) => { if (ok) notes.push('ok    ' + what); else fails.push(what); };
  let ws = null;
  try {
    let port = null;
    for (let i = 0; i < 100 && !port; i++) { await sleep(100); try { port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); } catch (e) { /* not up yet */ } }
    if (!port) throw new Error('Chrome did not start.');
    const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('could not connect to Chrome')); });
    let seq = 0; const waiting = {}, errors = [], missing = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && waiting[m.id]) { waiting[m.id](m); delete waiting[m.id]; return; }
      if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value || a.description).join(' '));
      if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) missing.push(m.params.response.status + ' ' + m.params.response.url.replace(base, ''));
    };
    const send = (method, params) => new Promise((res) => { const id = ++seq; waiting[id] = res; ws.send(JSON.stringify({ id, method, params: params || {} })); });
    // run a piece of code in the page and get its result back
    const page = async (fn, ...a) => {
      const r = await send('Runtime.evaluate', { expression: '(' + fn.toString() + ')(' + a.map((x) => JSON.stringify(x)).join(',') + ')', awaitPromise: true, returnByValue: true });
      if (r.result.exceptionDetails) throw new Error('in the page: ' + ((r.result.exceptionDetails.exception || {}).description || r.result.exceptionDetails.text));
      return r.result.result.value;
    };
    const until = async (fn, secs, what) => { for (let i = 0; i < secs * 10; i++) { if (await page(fn)) return true; await sleep(100); } fails.push('timed out waiting for ' + what); return false; };
    await send('Runtime.enable'); await send('Network.enable'); await send('Page.enable');
    await send('Page.navigate', { url: base + 'index.html' });
    if (!await until(() => !!(window.JA && JA.game && JA.audio && JA.audio.debug), 30, 'the game to load')) throw new Error('the game did not load');

    // ---- 1. every packed recording decodes
    await until(() => JA.audio.debug.pending().length === 0, 20, 'the sounds to decode');
    const packed = await page(() => ({ meta: JA.audio.debug.meta, ready: JA.audio.debug.ready(), voice: Object.keys(JA.VOICE || {}), music: Object.keys(JA.MUSIC || {}) }));
    const shots = Object.keys(packed.meta).filter((k) => !packed.meta[k].loop), loopsIn = Object.keys(packed.meta).filter((k) => packed.meta[k].loop);
    const undecoded = shots.filter((k) => !packed.ready.includes(k));
    check(!undecoded.length, shots.length + ' one-shot sounds decode' + (undecoded.length ? ' — failed: ' + undecoded.join(', ') : ''));
    const notPacked = M.SFX.filter((s) => !packed.meta[s.id]).map((s) => s.id);
    if (notPacked.length) notes.push('note  not recorded yet, so synthesized or silent: ' + notPacked.join(', '));

    // ---- 2. every voice line and music file loads
    const media = await page(async () => {
      const bad = [], long = [];
      const one = (src) => new Promise((res) => { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => res(a.duration); a.onerror = () => res(-1); a.src = src; setTimeout(() => res(-2), 8000); });
      for (const id of Object.keys(JA.VOICE || {})) { const d = await one('audio/voice/' + id + '.mp3'); if (!(d > 0.15)) bad.push('voice/' + id); else if (d > 14) long.push(id + ' ' + d.toFixed(1) + ' s'); }
      for (const id of Object.keys(JA.MUSIC || {})) { const d = await one('audio/music/' + id + '.mp3'); if (!(d > 1)) bad.push('music/' + id); }
      return { bad, long };
    });
    check(!media.bad.length, packed.voice.length + ' voice lines and ' + packed.music.length + ' music files load' + (media.bad.length ? ' — failed: ' + media.bad.join(', ') : ''));
    // one line is really spoken, start to finish (a clip that fails to play would end at once)
    if (packed.voice.length) {
      const spoke = await page(async (id) => {
        const len = await new Promise((res) => { const a = new Audio(); a.onloadedmetadata = () => res(a.duration); a.onerror = () => res(0); a.src = 'audio/voice/' + id + '.mp3'; });
        JA.audio.unlock();
        const ok = JA.audio.line(id), t0 = performance.now();
        while (JA.audio.voicePlaying() && performance.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 50));
        return { ok, len, took: (performance.now() - t0) / 1000 };
      }, packed.voice.includes('day-sleep') ? 'day-sleep' : packed.voice[0]);
      check(spoke.ok && spoke.took > spoke.len * 0.8 && spoke.took < spoke.len + 2, 'voice: a line is spoken from start to finish (' + spoke.took.toFixed(1) + ' s for a ' + spoke.len.toFixed(1) + ' s clip)');
    }
    const noVoice = M.VOICE.filter((v) => !packed.voice.includes(v.id)).length;
    if (noVoice) notes.push('note  ' + noVoice + ' of ' + M.VOICE.length + ' voice lines are not recorded yet (their words still show in the speech bubble)');

    // ---- 3. the landing film
    await page((site) => {
      document.getElementById('btn-start').click();
      const q = (s) => document.querySelector('#modal-root ' + s);
      q('[data-g="site"][data-v="' + site + '"]').click(); q('[data-g="sun"][data-v="archive"]').click(); q('[data-act="go"]').click();
    }, SITE);
    await until(() => JA.game.mode === 'intro', 20, 'the landing film to start');
    await page(() => { for (let i = 0; i < 4000 && JA.game.mode === 'intro'; i++) JA.game.advance(1 / 30); });
    await until(() => JA.game.mode === 'brief', 10, 'the film to end');
    let log = await page(() => JA.audio.debug.log.slice());
    const has = (x) => log.includes(x), any = (...xs) => xs.some(has);
    check(any('loop:descent', 'synth-loop:descent'), 'film: descent engine');
    check(any('touchdown', 'synth:touchdown'), 'film: touchdown');
    check(any('hiss', 'synth:hiss'), 'film: hatch hiss');
    check(any('step', 'synth:step') && any('breath', 'synth:breath'), 'film: footsteps and breathing');
    check(log.filter((x) => x.startsWith('voice:audio/landing/')).length === 14, 'film: 14 recorded lines (' + log.filter((x) => x.startsWith('voice:audio/landing/')).length + ' played)');
    check(any('music:vista', 'synth:pad'), 'film: music for the view');

    // ---- 4. a mission: every sound, played once, uses its recording
    await page(() => { document.querySelector('#modal-root [data-act="ok"]').click(); });
    await until(() => JA.game.mode === 'play', 10, 'the mission to start');
    const played = await page(async (ids, actionLoops) => {
      const G = JA.game, A = JA.actors, Au = JA.audio, step = (n, f) => { for (let i = 0; i < n; i++) { if (f) f(i); G.advance(1 / 30); } };
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));          // loops are decoded when first asked for: give them a moment
      const L = Au.debug.log, out = { synth: [], scene: {}, loops: {}, voice: {} };
      // walk and jump
      L.length = 0; G.keys.up = true; step(120); G.input.jump = true; step(170); G.keys.up = false;      // a Moon jump stays up for more than four seconds
      out.walk = L.slice();
      out.scene.out = Au.debug.scene(); out.loops.out = Au.debug.loops();
      // every sound in the list
      L.length = 0;
      ids.forEach((id) => { Au.play(id); });
      out.synth = L.filter((x) => x.startsWith('synth:')).map((x) => x.slice(6));
      // machines hum when they work
      const s = G.s; s.m.comms.on = true; s.m.air.power = 2; s.m.air.queue = 2; s.m.bag.pending = 12; s.m.lab.power = 2; s.m.lab.queue = [{ site: 0, n: 0, quality: 1 }]; s.m.food.lamp = 1;
      step(30); out.loops.work = Au.debug.loops();
      // the drill, the rover and the other loops that follow an action
      L.length = 0;
      // the game silences a dust devil that is far away, so on Mars one is brought close (none blow on the Moon)
      if (A.devils.length) A.devils.forEach((d) => { d.pos.set(A.astro.pos.x + 12, A.astro.pos.y, A.astro.pos.z); d.target.copy(d.pos); d.timer = 30; });
      else actionLoops = actionLoops.filter((id) => id !== 'devil');
      out.actionLoops = actionLoops;
      actionLoops.forEach((id) => { Au.loop(id, { f: 80, v: 0.01, rate: 1, keep: true }); });
      await wait(2500);
      out.loops.sounding = Au.debug.playing(); out.loops.synth = L.filter((x) => x.startsWith('synth-loop:')).map((x) => x.slice(11));
      actionLoops.forEach((id) => { Au.stopLoop(id); });
      // going inside the habitat
      A.astro.pos.copy(JA.base.spots.door); G.ePressed = true; step(2); out.mode = G.mode; step(40);
      await wait(1500);
      out.scene.inn = Au.debug.scene(); out.loops.inn = Au.debug.loops(); out.loops.innSounding = Au.debug.playing();
      // BOLT's lines: the words find their recording
      out.voice.exact = JA.voiceFor('The Solar Rack is full, so the panels are wasting sunshine. Use those power cells!');
      out.voice.changing = JA.voiceFor('The Air Maker is powered but hungry. Bring ice from the Shadow Crater!');
      out.voice.none = JA.voiceFor('These words are not a line.');
      return out;
    }, M.SFX.filter((s) => !s.loop).map((s) => s.id), ['drill', 'rover', 'devil', 'descent']);
    const w = played.walk; if (process.env.DEBUG) console.log('walk log:', JSON.stringify(w), 'loops', JSON.stringify(played.loops));
    check(w.some((x) => x === 'step' || x === 'synth:step') && w.some((x) => x === 'jump' || x === 'synth:jump') && w.some((x) => x === 'land' || x === 'synth:land'), 'mission: steps, jump and landing');
    check(played.scene.out.startsWith('out,' + SITE), 'mission: outside scene is "' + played.scene.out + '"');
    const recorded = M.SFX.filter((s) => !s.loop && packed.meta[s.id]).map((s) => s.id), fellBack = recorded.filter((id) => played.synth.includes(id));
    check(!fellBack.length, recorded.length + ' recorded one-shots play their recording' + (fellBack.length ? ' — fell back to the synthesizer: ' + fellBack.join(', ') : ''));
    const expect = (list, names, what) => { const want = names.filter((n) => packed.meta[n]), lost = want.filter((n) => !list.includes(n)); check(!lost.length, what + ' (' + want.length + ' recorded)' + (lost.length ? ' — not running: ' + lost.join(', ') : '')); };
    expect(played.loops.out, SITE === 'mars' ? ['amb-suit', 'amb-mars-wind'] : ['amb-suit'], 'mission: background bed outside');
    expect(played.loops.work, ['loop-air-maker', 'loop-greenhouse', 'loop-soil-bagger', 'loop-lab', 'loop-radio-dish'], 'mission: machine hums');
    check(played.mode === 'inside' && played.scene.inn.startsWith('in,'), 'mission: going inside switches the scene to "' + played.scene.inn + '"');
    const everyLoop = played.actionLoops.concat(['loop-air-maker', 'loop-greenhouse', 'loop-soil-bagger', 'loop-lab', 'loop-radio-dish', 'amb-suit'], SITE === 'mars' ? ['amb-mars-wind'] : []);
    expect(played.loops.sounding, everyLoop, 'mission: loops decode, join end to start and really sound');
    const loopFell = everyLoop.filter((n) => packed.meta[n] && played.loops.synth.includes(n));
    check(!loopFell.length, 'mission: recorded loops play their recording' + (loopFell.length ? ' — fell back to the synthesizer: ' + loopFell.join(', ') : ''));
    expect(played.loops.innSounding, ['amb-hab'], 'mission: habitat room tone');
    check(!played.loops.inn.includes('amb-suit'), 'mission: the suit bed stops inside');
    if (packed.voice.includes('rack-full')) check(played.voice.exact === 'rack-full' && played.voice.none === null, 'voice: words find their recorded line');
    if (packed.voice.includes('air-hungry')) check(played.voice.changing === 'air-hungry', 'voice: a bubble that changes still finds its line');

    check(!errors.length, 'no errors in the page' + (errors.length ? ': ' + [...new Set(errors)].slice(0, 5).join(' || ') : ''));
    const lost404 = [...new Set(missing)].filter((u) => !/favicon/.test(u));
    check(!lost404.length, 'no missing files' + (lost404.length ? ': ' + lost404.slice(0, 8).join(', ') : ''));
  } finally {
    try { if (ws) ws.close(); } catch (e) { /* closed */ }
    chrome.kill(); srv.close();
    await sleep(400);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* Chrome still holds it */ }
  }
  notes.forEach((n) => console.log(n));
  fails.forEach((f) => console.log('FAIL  ' + f));
  console.log('\n' + (fails.length ? fails.length + ' check(s) failed.' : 'All checks passed.') + ' (' + SITE + ')');
  process.exitCode = fails.length ? 1 : 0;
}
main().catch((e) => { console.error('Test could not run: ' + e.message); process.exitCode = 2; });
