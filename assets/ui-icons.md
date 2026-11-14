# UI icon list: Astro Outpost

**Update:** the core set is now drawn as SVG in `assets/icons/` (air, food, radiation, star, sun, shield, lab, dish, rover, cell, ice, bag, core, inst, case, rocket, home).
`tools/icons/build.js` draws them and `js/icons.js` swaps the matching emoji for them on screen. To redesign one, replace its `.svg` file with the same name (square, transparent).
Everything else below is still an emoji.

Originally every UI icon in the game was an **emoji drawn as text**. This file lists each one,
where it appears, and how big it is on screen, so it can be replaced with a drawn image.

## Export spec (all icons)

| Setting | Value |
|---|---|
| Format | **SVG** preferred, or **PNG with transparency** |
| Canvas | **Square.** PNG: **256 × 256 px** (128 × 128 px is fine for icons marked "small only") |
| Safe area | Keep the drawing inside the centre ~85% (about 218 px of a 256 px canvas) |
| Background | Transparent. Icons sit on a dark navy panel `#0f152e` at 84% opacity, so use bright, high-contrast shapes |
| Naming | lowercase id, e.g. `assets/ui/air.svg`, `assets/ui/item-cell.svg` |

"On-screen size" below is the CSS size at the default 16 px root font. 256 px PNGs cover
every size here, including the largest (74 px), on 3× high-resolution screens.

---

## 1. HUD meters (top bar). Priority: essential

Defined in `index.html` (`.m-icon`, 1.5rem). Toasts and the mission-failed screen reuse them (`JA.FAIL` in `js/data.js`).

| File name | Emoji | Content | Colour | On-screen size |
|---|---|---|---|---|
| `air` | 💨 | Air the crew breathes | `#4fd8ff` cyan | 24 px |
| `food` | 🥬 | Food / meals | `#7be36a` green | 24 px |
| `radiation` | ☢️ | Radiation badge (fills up = mission over) | `#ff6fb1` pink | 24 px |
| `star` | ⭐ | Mission points / score | `#ffd23f` yellow | 18 px |
| `clock-sun` | ☀️ | Sun marker that slides along the day clock | `#ffd23f` | 17 px |

## 2. Machines. Priority: essential

`JA.MACHINES` in `js/data.js:108`. Shown in world markers (34 px circle, `.mark i`),
repair and report screens, and the goal list.

| File name | Emoji | Machine | Colour | On-screen size |
|---|---|---|---|---|
| `machine-rack` | ☀️ | Solar Rack (charges power cells) | `#ffd23f` | 17 px in a 34 px circle; 26 px in reports |
| `machine-air` | 💨 | Air Maker (turns ice into air) | `#4fd8ff` | same |
| `machine-food` | 🥬 | Greenhouse | `#7be36a` | same |
| `machine-bag` | 🛡️ | Soil Bagger (radiation shield for the dome) | `#c9a6ff` | same |
| `machine-lab` | 🔬 | Science Lab | `#ffb84d` | same |
| `machine-comms` | 📡 | Radio Dish (talks to Earth, storm warnings) | `#ff8fb8` | same |
| `machine-rover` | 🚙 | Rover | `#9fe8ff` | same; 29 px in the rover battery panel |

Small world markers (`.mark.small`) shrink the icon to **12 px in a 24 px circle**, so keep the silhouettes simple.

## 3. Carried items. Priority: essential

`JA.ITEMS` in `js/data.js:118`. Shown in the "in your hands" panel (`#hands-icon`, 1.8rem).

| File name | Emoji | Item | On-screen size |
|---|---|---|---|
| `item-cell` | 🔋 | Power cell | 29 px |
| `item-ice` | 🧊 | Ice chunk | 29 px |
| `item-bag` | 🧱 | Soil bag | 29 px |
| `item-core` | 🧪 | Rock core sample | 29 px |
| `item-crate` | 🥬 | Veggie crate | 29 px |
| `item-inst` | 📦 | Science instrument (boxed) | 29 px |
| `item-case` | 🧳 | Sample case (goes on the rocket) | 29 px |

## 4. Buttons

| File name | Emoji | Purpose | On-screen size |
|---|---|---|---|
| `btn-sound` | 🔊 | Sound on/off (greyed out when off) | 18 px glyph in a 42 px circle |
| `btn-read` | 🗣️ | Read text aloud | 18 px in 42 px circle |
| `btn-help` | ❔ | Help & the real science | 18 px in 42 px circle |
| `touch-throw` | 🎯 | Throw (touch screens) | 27 px in a 70 px circle |
| `touch-use` | ✋ | Use / interact (touch) | 27 px in a 78 px yellow circle |
| `touch-jump` | ⤴ | Jump (touch) | 27 px in a 70 px circle |

## 5. Daily weather / sunlight

`JA.SITES` in `js/data.js:25–60`. Shown in the morning banner (18 px) and reports (26–30 px).

| File name | Emoji | Site | Meaning |
|---|---|---|---|
| `wx-moon-sun` | ☀️ | Moon | Bright sunshine |
| `wx-moon-lowsun` | 🌥️ | Moon | Long shadows |
| `wx-moon-shadow` | 🌑 | Moon | In the shadow |
| `wx-mars-clear` | 🌤️ | Mars | Clear sky |
| `wx-mars-dusty` | 🌫️ | Mars | Dusty sky |
| `wx-mars-storm` | 🌪️ | Mars | Dust storm |

## 6. Mission setup

| File name | Emoji | Meaning | On-screen size |
|---|---|---|---|
| `site-moon` | 🌙 | Pick the Moon | 27 px (`.pick em`) |
| `site-mars` | 🔴 | Pick Mars | 27 px |
| `level-cadet` | 🎒 | Cadet, 3 days | 27 px |
| `level-commander` | 🧑‍🚀 | Commander, 5 days | 27 px |
| `sun-live` | ☀️ | Real Sun, live NASA data | 27 px |
| `sun-archive` | 🌩️ | May 2024 storm archive | 27 px |
| `shift-quick` | ⚡ | 3-minute day | 27 px |
| `shift-standard` | ⏱️ | 5-minute day | 27 px |
| `shift-relaxed` | 🌤️ | 8-minute day | 27 px |
| `shift-explorer` | 🧭 | 12-minute day | 27 px |

## 7. Exploration sites (discovery cards). Small only

`js/data.js:128+`. Shown on the discovery card (`#card-icon`, 34 px) and the report list (24 px).

| File name | Emoji | Site |
|---|---|---|
| `find-boulders` | 🪨 | Boulder Field (Moon) |
| `find-beads` | ✨ | Bead Patch (Moon) |
| `find-crater` | 🌑 | Crater Wall (Moon) |
| `find-deepfreeze` | 🧊 | Deep Freeze (Moon) |
| `find-mesa` | 🏜️ | Striped Mesa (Mars) |
| `find-blueberries` | 🫐 | Blueberry Flats (Mars) |
| `find-whitevein` | 🤍 | White Vein Rocks (Mars) |
| `find-icepit` | 🧊 | Ice Pit (Mars) |
| `find-default` | 🧪 | Fallback for any discovery |

## 8. Science instruments. Small only

`js/data.js:179–191`. Discovery card and report: 24–34 px.

| File name | Emoji | Instrument |
|---|---|---|
| `inst-seismo` | 〰️ | Moonquake / Marsquake Sensor |
| `inst-mirror` | 🪞 | Laser Mirror (Moon) |
| `inst-weather` | 🌡️ | Weather Station (Mars) |
| `inst-rad` | ☢️ | Radiation Watcher |

## 9. "What you learned" facts. Small only

`js/data.js:211–239`. Shown at 30 px (`.info-row .ic`).

| File name | Emoji | Topic |
|---|---|---|
| `fact-land` | 👣 | Living off the land |
| `fact-radiation` | 🛡️ | Invisible radiation |
| `fact-rocks` | 🧪 | Rocks are history books |
| `fact-light` | 📡 | The speed of light |
| `fact-plants` | 🥬 | Plants in space |
| `fact-power` | ☀️ | Keeping the power on |
| `fact-watching` | 🛰️ | Machines that keep watching |
| `fact-farther` | 🚙 | Going farther |
| `fact-samples` | 🧳 | Samples for Earth |
| `fact-home` | 🚀 | The ride home |

## 10. End-of-mission ranks. Largest icons

`JA.RANKS` in `js/data.js:283`. Shown at **74 px** on the result screen (`.rank .big-icon`, 4.6rem). These need the most detail.

| File name | Emoji | Rank |
|---|---|---|
| `rank-cadet` | 🎒 | Space Cadet |
| `rank-pilot` | 🚀 | Mission Pilot |
| `rank-commander` | 🧑‍🚀 | Outpost Commander |
| `rank-legend` | 🏆 | Legend of the Outpost |

---

### Shortcut
Sections 1–3 are the core set: **17 icons**, or 15 unique drawings since Air and Food repeat.
You can redraw those first and leave the rest as emoji.

### Note
Swapping these in needs a small code change: the icons are inserted as text (e.g. `js/ui.js:116`,
`js/ui.js:162`, `js/ui.js:195`) and must become `<img>` tags pointing at `assets/ui/<file name>`.
