# Sound tools

Everything the game plays that is a recording is described once, in `manifest.js`: 106 voice lines,
58 sound effects (71 takes) and 3 pieces of music. The tools here turn ElevenLabs takes into the files the game loads.

| File | What it is |
| --- | --- |
| `manifest.js` | The sound list: every id, its words or prompt, how loud it sits in the mix, when it plays |
| `build.js` | Prepares the raw folders, processes the takes, packs the game files |
| `test.js` | Plays the real game in headless Chrome and checks every sound loads and is used |
| `soundboard.html` | Open it in a browser to listen to every sound through the game's own sound engine |

## Where things live

| Place | Contents |
| --- | --- |
| `../audio-raw/` (next to the repo, not in git) | Raw ElevenLabs takes, one folder per generation |
| `audio/sfx/`, `audio/voice/`, `audio/music/` | Processed mp3 files |
| `js/sfx-data.js` | The sound effects packed into one script, so they load when `index.html` is opened from disk |
| `js/audio-list.js` | Which voice lines and music exist; the game only uses what is listed |

## Making or replacing a sound

1. `node tools/audio/build.js prep` creates a folder for every sound under `../audio-raw/` and writes `jobs.json`,
   the list of what to generate (prompt or words, length, folder).
2. Generate into the sound's folder. The newest file in a folder is the take that is used, so to redo a sound,
   generate again; to go back to an older take, delete the newer file.
3. `node tools/audio/build.js` processes everything: it cuts the silence at both ends, sets the level,
   joins multi-take sounds, saves the mp3 files and rewrites the two `js/` files. `--only tap,step` limits it to some sounds.
4. `node tools/audio/test.js` (and `node tools/audio/test.js mars`) checks the game.
5. Open `tools/audio/soundboard.html` and listen. The test cannot judge how a sound sounds.

To swap in an mp3 made some other way, save it as `audio/sfx/<id>.mp3` (or `voice/`, `music/`) and run
`node tools/audio/build.js pack`.

Needs Node 22 or newer, plus `ffmpeg` and `ffprobe` on the PATH. The test also needs Chrome.

## How the game uses them (`js/audio.js`)

- **A missing recording is never an error.** A sound effect falls back to its synthesized version; a voice line
  falls back to the speech bubble alone (and the browser voice when read-aloud is on).
- **Four mix groups** (`bus` in the manifest): `ui` is never turned down; `fx` dips while someone speaks;
  `world` is also filtered by the place; `amb` holds the background beds.
- **The place changes the sound.** Outside on the Moon there is no air, so world sounds are muffled as if they
  reached you through the suit. Thin Mars air dulls them less. Inside the habitat you hear the machines faintly
  through the walls. BOLT explains this on day 2.
- **Sounds have a position.** Machine hums, sparks and the charging chime get quieter with distance and pan left
  and right with the camera.
- **Loops are joined in the browser**: the tail is cross-faded into the head after decoding, because an mp3
  always carries a little silence at both ends.
- **Kept synthesized on purpose**: the radiation counter's clicks, the Quindar beeps around Mission Control's
  lines, the throw-power tone and the low shake under the descent engine.
