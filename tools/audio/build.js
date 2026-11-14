#!/usr/bin/env node
/* Astro Outpost — turns the raw ElevenLabs takes into the game's sound files.

     node tools/audio/build.js prep      make one folder per sound to generate into, and list what is still missing
     node tools/audio/build.js           process every take, then pack and list (the usual command)
     node tools/audio/build.js pack      only re-pack audio/sfx and re-list audio/voice and audio/music
                                         (after replacing an mp3 in audio/ by hand)
     node tools/audio/build.js landing   put the landing film's Mission Control clips through the radio filter
                                         (originals in <raw>/landing/<id>/, list in manifest LANDING_RADIO)

   Options:  --raw <folder>   where the raw takes are (default: ../audio-raw, next to the repo)
             --only <id,id>   process just these sounds

   Raw takes live outside the repo:
     <raw>/sfx/<id>/          one-shot or loop          (the newest file in the folder is the one used)
     <raw>/sfx/<id>.<k>/      take k of a sound with several variants, joined takes or parts
     <raw>/voice/<id>/        a voice line
     <raw>/music/<id>/        a piece of music
     <raw>/landing/<id>/      the original of a landing-film clip that is heard over the radio

   What processing does: cuts the silence at both ends, brings every sound to a matched loudness (the raw takes
   differ by up to 40 dB), adds a tiny fade so nothing clicks, and saves an mp3. Voices from Earth (CAST radio: true)
   also go through a radio filter first. Needs ffmpeg on the PATH. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const M = require('./manifest.js');

const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : null; };
const cmd = args[0] && !args[0].startsWith('--') ? args[0] : 'all';
const RAW = path.resolve(opt('raw') || path.join(ROOT, '..', 'audio-raw'));
const ONLY = opt('only') ? opt('only').split(',') : null;
const OUT = { sfx: path.join(ROOT, 'audio', 'sfx'), voice: path.join(ROOT, 'audio', 'voice'), music: path.join(ROOT, 'audio', 'music'), landing: path.join(ROOT, 'audio', 'landing') };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-audio-'));
const AUDIO_EXT = /\.(mp3|wav|ogg|opus|flac|m4a)$/i;

// ---------- the jobs: one ElevenLabs generation each ----------
function sfxJobs(s) {
  const n = s.parts ? s.parts.length : s.takes || s.n || 1;
  const jobs = [];
  for (let k = 1; k <= n; k++) {
    const part = s.parts ? s.parts[k - 1] : s;
    jobs.push({ kind: 'sfx', id: s.id, key: n > 1 ? s.id + '.' + k : s.id, prompt: part.prompt, sec: part.sec, loop: !!s.loop });
  }
  return jobs;
}
function allJobs() {
  const jobs = [];
  M.VOICE.forEach((v) => jobs.push({ kind: 'voice', id: v.id, key: v.id, who: v.who, text: v.text }));
  M.SFX.forEach((s) => jobs.push(...sfxJobs(s)));
  M.MUSIC.forEach((m) => jobs.push({ kind: 'music', id: m.id, key: m.id, prompt: m.prompt, sec: m.sec }));
  jobs.forEach((j) => { j.dir = path.join(RAW, j.kind, j.key); });
  return jobs;
}
function newest(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => AUDIO_EXT.test(f)).map((f) => path.join(dir, f));
  if (!files.length) return null;
  return files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

// ---------- ffmpeg helpers ----------
function run(bin, a) {
  const r = spawnSync(bin, a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(bin + ' could not start: ' + r.error.message + ' (is ffmpeg on the PATH?)');
  return r;
}
function ff(a) {
  const r = run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a]);
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + (r.stderr || '').trim().split('\n').slice(-2).join(' | '));
}
const dB = (x) => 20 * Math.log10(Math.max(x, 1e-9));
// Measure a file, in seconds and dB: its length, its loudest sample (max), its loudest tenth of a second (loud:
// what a short sound's loudness is judged by) and its level over the whole length (mean).
function measure(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', '22050', '-'], { maxBuffer: 512 * 1024 * 1024 });
  if (r.error) throw new Error('ffmpeg could not start: ' + r.error.message + ' (is ffmpeg on the PATH?)');
  if (r.status !== 0) throw new Error('could not read ' + path.basename(file));
  const b = r.stdout, d = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + (b.length & ~3))), W = 2205;
  let pk = 0, sum = 0, win = 0;
  for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; sum += v * v; }
  for (let i = 0; i + W <= d.length; i += W >> 1) { let s = 0; for (let k = i; k < i + W; k++) s += d[k] * d[k]; if (s > win) win = s; }
  const mean = Math.sqrt(sum / Math.max(1, d.length));
  return { sec: d.length / 22050, max: dB(pk), loud: d.length < W ? dB(mean) : dB(Math.sqrt(win / W)), mean: dB(mean) };
}
let tmpN = 0;
const tmp = () => path.join(TMP, 't' + (++tmpN) + '.wav');
const WAV = ['-c:a', 'pcm_f32le'];         // working files keep full precision, so a boost never clips
// Cut the silence off both ends, keeping `lead` and `tail` seconds of it. ElevenLabs takes come at very different
// levels, so the take is first brought up to full level: "silence" then means the same for a quiet take and a loud one.
function trim(src, ch, lead, tail, startOnly, endOnly) {
  const raw = measure(src);
  if (raw.max < -70) throw new Error('the take is silent');
  if (raw.max < -40) problems.push(path.basename(path.dirname(src)) + ': a very quiet take (peak ' + raw.max.toFixed(0) + ' dB), boosted a lot, so it may sound noisy');
  const head = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=' + lead + ':detection=peak';
  const foot = 'areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=' + tail + ':detection=peak,areverse';
  const out = tmp();
  ff(['-i', src, '-af', ['volume=' + (-1 - raw.max).toFixed(2) + 'dB', endOnly ? null : head, startOnly ? null : foot].filter(Boolean).join(','), '-ac', String(ch), '-ar', '44100', ...WAV, out]);
  return out;
}
function level(src, mean) {       // set the overall level, so takes that are joined do not jump in loudness
  const out = tmp();
  ff(['-i', src, '-af', 'volume=' + (mean - measure(src).mean).toFixed(2) + 'dB', ...WAV, out]);
  return out;
}
function join(a, b, d) {          // one after the other, with a cross-fade of d seconds
  const out = tmp();
  ff(['-i', a, '-i', b, '-filter_complex', '[0][1]acrossfade=d=' + d + ':c1=qsin:c2=qsin', ...WAV, out]);
  return out;
}
// The radio: Mission Control talks from Earth. A space radio only carries the middle of a voice (about 300 to
// 3,400 Hz, like an old telephone), squeezes it so it stays clear over the noise, clips the loudest bits a
// little, and leaves a soft hiss underneath. The game then adds the Quindar beeps around each message.
const RADIO = ['highpass=f=300:poles=2', 'highpass=f=300:poles=2', 'lowpass=f=3400:poles=2', 'lowpass=f=3400:poles=2',
  'equalizer=f=1800:t=q:w=1.2:g=5', 'acompressor=threshold=0.08:ratio=8:attack=2:release=80:makeup=4', 'asoftclip=type=atan:param=1.6'].join(',');
const HISS_DB = -36;            // the hiss, against the voice's loudest moments
function radio(src) {
  const sec = measure(src).sec, out = tmp();
  ff(['-i', src, '-f', 'lavfi', '-i', 'anoisesrc=color=white:amplitude=1:seed=7:sample_rate=44100:d=' + (sec + 0.5).toFixed(2),
    '-filter_complex', '[0]aformat=channel_layouts=mono,' + RADIO + ',alimiter=limit=0.89:level=0[v];' +
      '[1]highpass=f=1500,lowpass=f=6000,volume=' + HISS_DB + 'dB[n];[v][n]amix=inputs=2:duration=first:normalize=0',
    '-ac', '1', '-ar', '44100', ...WAV, out]);
  return out;
}

// Set the level, fade the edges, save as mp3.
//   o.loud: match the loudest tenth of a second (one-shot sounds). A spiky sound would stay quiet if only its peak
//           counted, so it may lean up to 8 dB into a limiter.
//   o.mean: match the level over the whole length (voices, loops, music).
//   o.ceil: the loudest sample allowed.
function finish(src, dst, o) {
  const st = measure(src), ceil = o.ceil == null ? -2 : o.ceil, room = ceil - st.max;
  if (!(st.sec > 0.03)) throw new Error('nothing left after trimming (a silent take?)');
  const gain = o.loud != null ? Math.min(o.loud - st.loud, room + 8) : Math.min(o.mean - st.mean, room);
  const fo = Math.min(o.fadeOut || 0.03, st.sec / 3), fi = Math.min(o.fadeIn || 0.004, st.sec / 4);
  const af = ['volume=' + gain.toFixed(2) + 'dB'];
  if (gain > room + 0.05) af.push('alimiter=limit=' + Math.pow(10, ceil / 20).toFixed(3) + ':attack=1:release=40:level=0:latency=1');
  if (!o.loop) af.push('afade=t=in:st=0:d=' + fi, 'afade=t=out:st=' + (st.sec - fo).toFixed(3) + ':d=' + fo);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  ff(['-i', src, '-af', af.join(','), '-ac', String(o.ch), '-ar', '44100', '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', o.rate, dst]);
  return measure(dst);
}

// ---------- processing ----------
// the levels everything is brought to (dB): the game's mix (vol in the manifest) starts from these
const LOUD = { shot: -15, big: -11, loop: -24, voice: -21, music: -20 };
const rows = [], problems = [];
function report(kind, name, st, note) { rows.push({ kind, name, st, note: note || '' }); }
function wanted(id) { return !ONLY || ONLY.includes(id); }

function buildSfx(s) {
  const jobs = sfxJobs(s).map((j) => ({ ...j, src: newest(path.join(RAW, 'sfx', j.key)) }));
  const ch = s.stereo ? 2 : 1, rate = s.stereo ? '128k' : '96k', asLoop = { mean: LOUD.loop, ceil: -2, ch, rate, loop: true };
  if (s.parts || s.takes) {                                     // several takes joined into one file
    if (jobs.some((j) => !j.src)) { if (jobs.some((j) => j.src)) problems.push(s.id + ': only some of its ' + jobs.length + ' takes exist'); return; }
    let cur = null;
    jobs.forEach((j, i) => {
      const last = i === jobs.length - 1;
      const t = s.parts ? trim(j.src, ch, 0.01, 0.05, !last && i === 0, last && i > 0) : level(trim(j.src, ch, 0, 0), LOUD.loop);
      cur = cur ? join(cur, t, s.parts ? 0.8 : 1.0) : t;
    });
    const st = finish(cur, path.join(OUT.sfx, s.id + '.mp3'), s.loop ? asLoop : { loud: LOUD.big, ceil: -1.5, ch, rate, fadeOut: 1.5 });
    report('sfx', s.id, st, jobs.length + ' takes joined');
    return;
  }
  jobs.forEach((j, i) => {                                      // one file per take: step.mp3, step-2.mp3 …
    if (!j.src) return;
    const name = s.id + (i ? '-' + (i + 1) : '');
    const t = s.loop ? trim(j.src, ch, 0, 0) : trim(j.src, ch, 0.003, 0.02);
    const st = finish(t, path.join(OUT.sfx, name + '.mp3'), s.loop ? asLoop : { loud: LOUD.shot, ceil: -2, ch, rate });
    report('sfx', name, st, s.loop ? 'loop' : '');
  });
}
function buildVoice(v) {
  const src = newest(path.join(RAW, 'voice', v.id));
  if (!src) return;
  const onRadio = !!(M.CAST[v.who] || {}).radio, t = trim(src, 1, 0.03, 0.12);
  const st = finish(onRadio ? radio(t) : t, path.join(OUT.voice, v.id + '.mp3'), { mean: LOUD.voice, ceil: -2, ch: 1, rate: '64k', fadeIn: 0.008, fadeOut: 0.06 });
  let note = onRadio ? 'radio' : '';
  // a line spoken much faster or slower than normal speech was probably cut short, or has something added
  const rate = v.text.replace(/[^A-Za-z0-9]/g, '').length / st.sec;
  if (v.text.length > 25 && (rate > 21 || rate < 9)) { note = (note ? note + ', ' : '') + 'unusual pace (' + rate.toFixed(0) + ' letters a second): listen to it'; problems.push(v.id + ': ' + note); }
  if (/^launch-[123]$/.test(v.id) && st.sec > 0.78) { note = 'longer than the 0.8 s between countdown numbers'; problems.push(v.id + ': ' + st.sec.toFixed(2) + ' s is ' + note); }
  report('voice', v.id, st, note);
}
// A landing-film clip heard over the radio. Only its sound changes: it keeps the level it had, and its own timing.
function buildLanding(id) {
  const src = newest(path.join(RAW, 'landing', id));
  if (!src) { problems.push(id + ': no original in ' + path.join(RAW, 'landing', id)); return; }
  const before = measure(src);
  const st = finish(radio(src), path.join(OUT.landing, id + '.mp3'), { mean: before.mean, ceil: -1, ch: 2, rate: '128k', fadeIn: 0.004, fadeOut: 0.03 });
  report('film', id, st, 'radio (level kept at ' + before.mean.toFixed(1) + ' dB)');
}
function buildMusic(m) {
  const src = newest(path.join(RAW, 'music', m.id));
  if (!src) return;
  const st = finish(trim(src, 2, 0.02, 0.2), path.join(OUT.music, m.id + '.mp3'), { mean: LOUD.music, ceil: -1.5, ch: 2, rate: '128k', fadeIn: 0.6, fadeOut: 2.5 });
  report('music', m.id, st, '');
}

// ---------- packing: what the game loads ----------
function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, '\\\''); }
function pack() {
  const meta = {}, data = [];
  let bytes = 0;
  M.SFX.forEach((s) => {
    if (!fs.existsSync(path.join(OUT.sfx, s.id + '.mp3'))) return;
    let n = 1;
    while (n < (s.n || 1) && fs.existsSync(path.join(OUT.sfx, s.id + '-' + (n + 1) + '.mp3'))) n++;
    const m = { bus: s.bus, vol: s.vol };
    if (n > 1) m.n = n;
    ['pitch', 'gap', 'range'].forEach((k) => { if (s[k] != null) m[k] = s[k]; });
    if (s.loop) m.loop = 1;
    meta[s.id] = m;
    for (let k = 1; k <= n; k++) {
      const name = s.id + (k > 1 ? '-' + k : ''), buf = fs.readFileSync(path.join(OUT.sfx, name + '.mp3'));
      bytes += buf.length; data.push("'" + name + "':'" + buf.toString('base64') + "'");
    }
  });
  const field = (v) => (typeof v === 'string' ? "'" + v + "'" : v);
  const metaJs = Object.keys(meta).map((k) => "'" + k + "': { " + Object.keys(meta[k]).map((f) => f + ': ' + field(meta[k][f])).join(', ') + ' }').join(',\n  ');
  fs.writeFileSync(path.join(ROOT, 'js', 'sfx-data.js'),
    '/* Astro Outpost — the recorded sound effects, packed so they load even when the game is opened straight from disk.\n' +
    '   Made by tools/audio/build.js from audio/sfx/ and tools/audio/manifest.js. Do not edit by hand. */\n' +
    'window.JA = window.JA || {};\nJA.SFX = { meta: {\n  ' + metaJs + '\n}, data: {\n' + data.join(',\n') + '\n} };\n');

  const voice = M.VOICE.filter((v) => fs.existsSync(path.join(OUT.voice, v.id + '.mp3')));
  const music = M.MUSIC.filter((m) => fs.existsSync(path.join(OUT.music, m.id + '.mp3')));
  fs.writeFileSync(path.join(ROOT, 'js', 'audio-list.js'),
    '/* Astro Outpost — which voice lines and music exist as recordings.\n' +
    '   Made by tools/audio/build.js from audio/voice/, audio/music/ and tools/audio/manifest.js. Do not edit by hand.\n' +
    '   w: who speaks (capcom or mc: both Mission Control on Earth, heard over the radio)   t: the words */\n' +
    'window.JA = window.JA || {};\nJA.VOICE = {\n' +
    voice.map((v) => "  '" + v.id + "': { w: '" + v.who + "', t: '" + esc(v.text) + "' }").join(',\n') + '\n};\n' +
    '// speech bubbles whose words change from game to game: how the bubble starts, and the line that answers it\n' +
    'JA.VOICE_MATCH = [' + M.VOICE.filter((v) => v.match).map((v) => "['" + esc(v.match) + "', '" + v.id + "']").join(', ') + '];\n' +
    'JA.MUSIC = {' + music.map((m) => " '" + m.id + "': { v: " + m.vol + (m.loop ? ', loop: true' : '') + ' }').join(',') + ' };\n');
  return { sfx: Object.keys(meta).length, files: data.length, bytes, voice: voice.length, music: music.length };
}

// ---------- commands ----------
function prep() {
  const jobs = allJobs();
  let missing = 0;
  jobs.forEach((j) => { fs.mkdirSync(j.dir, { recursive: true }); j.have = !!newest(j.dir); if (!j.have) missing++; });
  fs.writeFileSync(path.join(RAW, 'jobs.json'), JSON.stringify(jobs.map((j) => ({ kind: j.kind, key: j.key, have: j.have, dir: j.dir, who: j.who, text: j.text, prompt: j.prompt, sec: j.sec, loop: j.loop })), null, 1));
  console.log('Raw folder: ' + RAW);
  console.log(jobs.length + ' generations in the list (' + M.VOICE.length + ' voice lines, ' + jobs.filter((j) => j.kind === 'sfx').length + ' sound-effect takes, ' + M.MUSIC.length + ' music pieces); ' + missing + ' still missing.');
  console.log('The full list is in ' + path.join(RAW, 'jobs.json'));
}
function table() {
  const f = (x, n) => (x == null || isNaN(x) ? '-' : x.toFixed(n));
  console.log('\nkind   name                      sec    peak dB  loud dB  mean dB  note');
  rows.forEach((r) => console.log(r.kind.padEnd(6) + ' ' + r.name.padEnd(24) + ' ' + f(r.st.sec, 2).padStart(5) + ' ' + f(r.st.max, 1).padStart(8) + ' ' + f(r.st.loud, 1).padStart(8) + ' ' + f(r.st.mean, 1).padStart(8) + '  ' + r.note));
}
function main() {
  if (cmd === 'prep') { prep(); return; }
  if (cmd === 'landing') {
    M.LANDING_RADIO.forEach((id) => { if (!wanted(id)) return; try { buildLanding(id); } catch (e) { problems.push(id + ': ' + e.message); } });
    table();
    if (problems.length) { console.log('\nProblems:'); problems.forEach((x) => console.log('  - ' + x)); process.exitCode = 1; }
    return;
  }
  if (cmd !== 'pack') {
    const each = (list, fn, kind) => list.forEach((x) => { if (!wanted(x.id)) return; try { fn(x); } catch (e) { problems.push(x.id + ': ' + e.message); } });
    each(M.SFX, buildSfx); each(M.VOICE, buildVoice); each(M.MUSIC, buildMusic);
    table();
  }
  const p = pack();
  const miss = { sfx: M.SFX.filter((s) => !fs.existsSync(path.join(OUT.sfx, s.id + '.mp3'))).map((s) => s.id),
    voice: M.VOICE.filter((v) => !fs.existsSync(path.join(OUT.voice, v.id + '.mp3'))).map((v) => v.id),
    music: M.MUSIC.filter((m) => !fs.existsSync(path.join(OUT.music, m.id + '.mp3'))).map((m) => m.id) };
  console.log('\nPacked ' + p.sfx + ' of ' + M.SFX.length + ' sound effects (' + p.files + ' files, ' + (p.bytes / 1024).toFixed(0) + ' kB) into js/sfx-data.js');
  console.log('Listed ' + p.voice + ' of ' + M.VOICE.length + ' voice lines and ' + p.music + ' of ' + M.MUSIC.length + ' music pieces in js/audio-list.js');
  ['sfx', 'voice', 'music'].forEach((k) => { if (miss[k].length) console.log('Not recorded yet (' + k + '): ' + miss[k].join(', ')); });
  if (problems.length) { console.log('\nProblems:'); problems.forEach((x) => console.log('  - ' + x)); process.exitCode = 1; }
}
try { main(); } finally { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* temp files stay */ } }
