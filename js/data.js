/* Astro Outpost — game data: sites, levels, rules, discoveries, instruments, facts.
   Numbers marked REAL come from NASA (or the cited paper). Numbers marked GAME are
   simplified game scales, and the in-game "Real science" panel says so. */
window.JA = window.JA || {};
(function (JA) {
  'use strict';

  JA.SOURCES = {
    donki: { name: 'NASA DONKI — Space Weather Database', url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/' },
    osdr: { name: 'NASA Open Science Data Repository (OSDR)', url: 'https://osdr.nasa.gov/' },
    mars: { name: 'NASA Science — Mars facts', url: 'https://science.nasa.gov/mars/facts/' },
    moon: { name: 'NASA Science — Moon facts', url: 'https://science.nasa.gov/moon/facts/' },
    rad: { name: 'Curiosity rover RAD instrument (Hassler et al., Science, 2014)', url: 'https://science.nasa.gov/mission/msl-curiosity/' },
    msl: { name: 'NASA Curiosity rover', url: 'https://science.nasa.gov/mission/msl-curiosity/' },
    lnd: { name: 'Lunar surface dose measurement (Zhang et al., Science Advances, 2020)', url: 'https://www.science.org/doi/10.1126/sciadv.aaz1334' },
    m2020: { name: 'NASA Perseverance rover', url: 'https://science.nasa.gov/mission/mars-2020-perseverance/' },
    artemis: { name: 'NASA Artemis', url: 'https://www.nasa.gov/humans-in-space/artemis/' },
    iss: { name: 'NASA International Space Station', url: 'https://www.nasa.gov/international-space-station/' },
    mer: { name: 'NASA Mars Exploration Rovers (Spirit & Opportunity)', url: 'https://science.nasa.gov/mission/mer-opportunity/' },
    apollo: { name: 'NASA Apollo program', url: 'https://www.nasa.gov/the-apollo-program/' },
    insight: { name: 'NASA InSight lander', url: 'https://science.nasa.gov/mission/insight/' },
    phoenix: { name: 'NASA Phoenix Mars lander', url: 'https://science.nasa.gov/mission/phoenix/' },
    lro: { name: 'NASA Lunar Reconnaissance Orbiter', url: 'https://science.nasa.gov/mission/lro/' }
  };

  JA.SITES = {
    moon: {
      id: 'moon', short: 'Moon', name: 'the Moon', emoji: '🌙',
      place: 'Shackleton Crater rim, South Pole', dayWord: 'Day',
      gravity: 1.62,                 // REAL m/s²
      doseDay: 6, doseNight: 4,      // GAME badge points (real: ~1.4 mSv/day, about twice Mars)
      stormMult: 1.0,                // GAME: no air at all, storms hit at full strength
      iceName: 'Shadow Crater',
      commText: 'A radio message reaches Earth in about 1.3 seconds.',
      blurb: 'Earth answers in seconds. But there is no air, so solar storms hit HARD.',
      why: 'We built here because the crater next door never sees the Sun — and its floor hides frozen water.',
      env: {
        sun: { cells: 7, icon: '☀️', label: 'Bright sunshine', why: 'The Sun skims along the crater rim and the solar panels drink it up.' },
        lowsun: { cells: 5, icon: '🌥️', label: 'Long shadows', why: 'At the Moon\'s south pole the Sun stays very low. A mountain is starting to block it.' },
        shadow: { cells: 3, icon: '🌑', label: 'In the shadow', why: 'The Sun is hiding behind a mountain. The panels will charge very slowly today!' }
      }
    },
    mars: {
      id: 'mars', short: 'Mars', name: 'Mars', emoji: '🔴',
      place: 'Arcadia Planitia', dayWord: 'Sol',
      gravity: 3.71,                 // REAL m/s²
      doseDay: 3, doseNight: 2,      // GAME badge points (real: ~0.67 mSv/day, Curiosity RAD)
      stormMult: 0.5,                // GAME: thin air soaks up part of a solar storm
      iceName: 'Ice Pit',
      commText: 'A radio message takes between 3 and 22 minutes to reach Earth.',
      blurb: 'Earth takes minutes to answer. And dust storms can hide the Sun for days.',
      why: 'We built here because water ice lies just under the soil — water to drink, and oxygen to breathe.',
      env: {
        clear: { cells: 6, icon: '🌤️', label: 'Clear sky', why: 'Mars gets less than half the sunlight Earth does, but today the sky is clear.' },
        dusty: { cells: 4, icon: '🌫️', label: 'Dusty sky', why: 'Dust floating in the air blocks some of the sunlight.' },
        storm: { cells: 2.5, icon: '🌪️', label: 'Dust storm!', why: 'A dust storm is hiding the Sun. In 2018 a storm like this ended the Opportunity rover\'s mission.' }
      }
    }
  };

  JA.LEVELS = {
    cadet: {
      id: 'cadet', name: 'Cadet', ages: 'Ages 7–9', sols: 3, airDrain: 30, dinner: 16, cellBonus: 1,
      stormScale: 0.6, warnBonus: 12, ease: 1.5, glitchSols: [2], rankMins: [0, 90, 170, 260],
      blurb: 'A 3-day mission with extra power and longer storm warnings.'
    },
    commander: {
      id: 'commander', name: 'Commander', ages: 'Ages 10–12', sols: 5, airDrain: 38, dinner: 20, cellBonus: 0,
      stormScale: 1, warnBonus: 0, ease: 1, glitchSols: [2, 4], rankMins: [0, 160, 290, 420],
      blurb: 'A 5-day mission. Every power cell matters.'
    }
  };

  // GAME rules, all in one place so they are easy to tune and to explain.
  JA.RULES = {
    dayLength: 180,                // seconds of play for one working day
    startAir: 65, startFood: 45,
    morningCells: 2, chargeSpan: 0.72, rackMax: 4, effMin: 0.5,
    airPerIce: 14, iceTime: 6, airCharges: 3, hopperMax: 4,
    beds: 4, growSols: 1.15, foodPerCrate: 13, waterSols: 1.2,
    bagsPerCell: 4, bagInterval: 2.2, shieldSlots: 16, wallBlock: 0.25, bagBlock: 0.035,
    labCharges: 3, analyzeTime: 8, labQueue: 4,
    roverPerCell: 100, roverMax: 200, roverBed: 4,
    stormDuration: 28, warnDish: 45, warnNoDish: 12, radWarn: 10,
    sprintAir: 1.5, lateAir: 6,
    corePts: [12, 20, 30], instPts: 40, photoPts: 15, casePts: 50, trickPts: 3
  };

  JA.MACHINES = {
    rack: { name: 'Solar Rack', icon: '☀️', color: '#ffd23f' },
    air: { name: 'Air Maker', icon: '💨', color: '#4fd8ff' },
    food: { name: 'Greenhouse', icon: '🥬', color: '#7be36a' },
    bag: { name: 'Soil Bagger', icon: '🛡️', color: '#c9a6ff' },
    lab: { name: 'Science Lab', icon: '🔬', color: '#ffb84d' },
    comms: { name: 'Radio Dish', icon: '📡', color: '#ff8fb8' },
    rover: { name: 'Rover', icon: '🚙', color: '#9fe8ff' }
  };

  JA.ITEMS = {
    cell: { name: 'power cell', icon: '🔋' },
    ice: { name: 'ice chunk', icon: '🧊' },
    bag: { name: 'soil bag', icon: '🧱' },
    core: { name: 'rock core', icon: '🧪' },
    crate: { name: 'veggie crate', icon: '🥬' },
    inst: { name: 'instrument', icon: '📦' },
    'case': { name: 'sample case', icon: '🧳' }
  };

  // ---------- Geology sites: two rock cores each, every core reveals a real finding ----------
  JA.GEO = {
    moon: [
      { name: 'Boulder Field', icon: '🪨', finds: [
        { title: 'A piece of the first Moon crust', src: 'apollo',
          text: 'This pale rock is anorthosite, part of the Moon\'s very first crust. Apollo 15 astronauts found one about 4 billion years old and nicknamed it the Genesis Rock.' },
        { title: 'Smash-up rock', src: 'apollo',
          text: 'This is a breccia: broken bits of rock welded together by the heat of a meteorite crash. Many of the rocks Apollo brought home are breccias.' }] },
      { name: 'Bead Patch', icon: '✨', finds: [
        { title: 'Volcanic glass beads', src: 'apollo',
          text: 'Tiny orange beads of glass! Apollo 17 found soil like this. The beads sprayed out of fire fountains on the Moon more than 3 billion years ago.' },
        { title: 'Dust as sharp as glass', src: 'apollo',
          text: 'Moon dust is sharp like tiny bits of broken glass, because there is no wind or water to smooth it. It scratched the Apollo astronauts\' suits and visors.' }] },
      { name: 'Crater Wall', icon: '🌑', finds: [
        { title: 'Layers of crashes', src: 'moon',
          text: 'This wall shows layers of rock thrown out by older impacts. With no weather on the Moon, craters stay sharp for billions of years.' },
        { title: 'Bootprints that last', src: 'apollo',
          text: 'The bootprints you leave here could last for millions of years. There is no wind or rain on the Moon to wipe them away.' }] },
      { name: 'Deep Freeze', icon: '🧊', finds: [
        { title: 'Water ice in the soil', src: 'moon',
          text: 'Ice mixed into the soil! In 2009 NASA\'s LCROSS mission crashed a rocket stage into a dark polar crater and found water in the cloud it kicked up.' },
        { title: 'One of the coldest places known', src: 'lro',
          text: 'The floors of some polar craters never see the Sun. NASA\'s Lunar Reconnaissance Orbiter measured about −240°C there.' }] }
    ],
    mars: [
      { name: 'Striped Mesa', icon: '🏜️', finds: [
        { title: 'Pebbles from a stream', src: 'msl',
          text: 'Smooth, rounded pebbles stuck in rock. In 2012 the Curiosity rover found ones like these — an ancient stream bed. Water once flowed on Mars!' },
        { title: 'Mud from a lake', src: 'msl',
          text: 'These thin layers are hardened mud, like the layers Curiosity drilled in Gale Crater, which held a lake billions of years ago.' }] },
      { name: 'Blueberry Flats', icon: '🫐', finds: [
        { title: 'Martian "blueberries"', src: 'mer',
          text: 'Tiny grey balls! In 2004 the Opportunity rover found "blueberries" like these, made of a mineral called hematite that usually forms in water.' },
        { title: 'Rusty dust', src: 'mars',
          text: 'Mars looks red because its dust is full of iron that has rusted — a bit like an old bike left out in the rain.' }] },
      { name: 'White Vein Rocks', icon: '🤍', finds: [
        { title: 'A vein left by water', src: 'mer',
          text: 'A bright white stripe in the rock. Opportunity found a vein like this in 2011: the mineral gypsum, left behind by water trickling through a crack.' },
        { title: 'Cooled lava', src: 'mars',
          text: 'This dark rock is basalt — cooled lava. Mars has the tallest volcano in the solar system, Olympus Mons, about two and a half times as high as Mount Everest.' }] },
      { name: 'Ice Pit', icon: '🧊', finds: [
        { title: 'Ice under the soil', src: 'phoenix',
          text: 'Bright ice just under the soil! In 2008 NASA\'s Phoenix lander dug a small trench on Mars and found water ice like this.' },
        { title: 'Ice that vanishes', src: 'phoenix',
          text: 'Phoenix watched little chunks of ice disappear over a few days. In Mars\'s thin air, ice turns straight into gas without melting first.' }] }
    ]
  };

  // ---------- Science instruments to carry out and set up ----------
  JA.INSTRUMENTS = {
    moon: [
      { id: 'seismo', name: 'Moonquake Sensor', icon: '〰️', src: 'apollo',
        text: 'Apollo astronauts left seismometers on the Moon that felt thousands of moonquakes. They showed the Moon is still slowly shrinking as it cools.' },
      { id: 'beam', name: 'Laser Mirror', icon: '🪞', src: 'apollo',
        text: 'Apollo crews left mirrors on the Moon. Scientists still bounce lasers off them, and found the Moon drifts 3.8 cm farther from Earth every year.' },
      { id: 'rad', name: 'Radiation Watcher', icon: '☢️', src: 'lro', perk: 'Solar storm warnings now arrive 10 seconds earlier.',
        text: 'NASA\'s Lunar Reconnaissance Orbiter carries a radiation sensor called CRaTER. Yours works on the ground and spots solar storms sooner.' }
    ],
    mars: [
      { id: 'seismo', name: 'Marsquake Sensor', icon: '〰️', src: 'insight',
        text: 'NASA\'s InSight lander put a seismometer on Mars and felt more than 1,300 marsquakes. They revealed that Mars has a liquid metal core.' },
      { id: 'beam', name: 'Weather Station', icon: '🌡️', src: 'm2020', perk: 'You now get tomorrow\'s sunlight forecast every night.',
        text: 'The Perseverance rover carries a weather station called MEDA that measures wind, temperature and dust.' },
      { id: 'rad', name: 'Radiation Watcher', icon: '☢️', src: 'rad', perk: 'Solar storm warnings now arrive 10 seconds earlier.',
        text: 'The Curiosity rover carries a sensor called RAD. It was the first to measure radiation on the surface of Mars.' }
    ]
  };

  JA.PHOTOS = {
    moon: [
      { name: 'Earth View', src: 'moon', text: 'From here Earth hangs low in the black sky. It hardly ever moves, because the Moon always keeps the same face toward Earth.' },
      { name: 'Edge of Darkness', src: 'lro', text: 'The real Shackleton Crater is about 21 km wide and 4 km deep — deeper than the Grand Canyon.' }
    ],
    mars: [
      { name: 'Big Sky', src: 'mars', text: 'On Mars the daytime sky is butterscotch-colored and the sunsets are blue — the opposite of Earth.' },
      { name: 'Moon Spotting', src: 'mars', text: 'Mars has two tiny potato-shaped moons, Phobos and Deimos. Phobos races around Mars about three times a day.' }
    ]
  };

  // ---------- Things that break ----------
  JA.REPAIRS = {
    air: { title: 'The Air Maker jammed!', text: 'A valve froze shut. No new air until it is fixed.' },
    food: { title: 'Greenhouse pump stuck!', text: 'The water pump stopped. Plants cannot grow until it is fixed.' },
    lab: { title: 'The Lab arm is stuck!', text: 'The robot arm that loads rock cores froze. No analysis until it is fixed.' },
    rack: { title: 'Loose solar cable!', text: 'A cable came loose. The Solar Rack cannot charge cells until it is fixed.' }
  };

  // ---------- Facts for the night report ----------
  JA.FACTS = [
    { id: 'sol', site: 'mars', tags: ['any'], src: 'mars', text: 'A day on Mars is called a "sol". It lasts 24 hours and 39 minutes — a little longer than a day on Earth.' },
    { id: 'moxie', site: 'mars', tags: ['air'], src: 'm2020', text: 'A real machine called MOXIE rode on the Perseverance rover and made oxygen out of Mars air: 122 grams in total. That is about what a small dog breathes in 10 hours!' },
    { id: 'rad', site: 'mars', tags: ['dose'], src: 'rad', text: 'The Curiosity rover\'s RAD sensor measured about 0.67 millisieverts of radiation every day on Mars — far more than you get on Earth.' },
    { id: 'sep2017', site: 'mars', tags: ['storm'], src: 'rad', text: 'In September 2017 a solar storm reached Mars. Curiosity\'s sensor saw the radiation on the ground double!' },
    { id: 'oppy', site: 'mars', tags: ['dust'], src: 'mer', text: 'In 2018 a dust storm covered the whole planet of Mars. The solar-powered Opportunity rover could not charge and went silent after almost 15 years of exploring.' },
    { id: 'insight', site: 'mars', tags: ['dust', 'power', 'repair'], src: 'insight', text: 'NASA\'s InSight lander slowly lost power as dust piled up on its solar panels. Its mission ended in 2022.' },
    { id: 'devil', site: 'mars', tags: ['dust', 'power'], src: 'mer', text: 'Whirlwinds called dust devils sometimes blew the dust off the Spirit and Opportunity rovers\' solar panels, giving them a free power boost.' },
    { id: 'marsdelay', site: 'mars', tags: ['comms', 'repair'], src: 'mars', text: 'Radio waves travel at the speed of light, but Mars is so far away that a message takes 3 to 22 minutes to arrive. Astronauts there must solve many problems on their own.' },
    { id: 'marsgrav', site: 'mars', tags: ['any'], src: 'mars', text: 'Gravity on Mars is about 38% of Earth\'s. That is why you can jump and throw more than twice as far here.' },
    { id: 'tubes', site: 'mars', tags: ['science'], src: 'm2020', text: 'The Perseverance rover drills rock cores and seals them in metal tubes, so a future mission can carry them back to Earth.' },
    { id: 'spirit', site: 'mars', tags: ['rover'], src: 'mer', text: 'In 2009 the Spirit rover got stuck in soft Martian soil. Engineers on Earth tried for months to drive it free.' },
    { id: 'moondelay', site: 'moon', tags: ['comms', 'repair'], src: 'moon', text: 'The Moon is about 384,000 km away. A radio message gets there in about 1.3 seconds, so Moon crews can talk with Earth almost like a phone call.' },
    { id: 'moongrav', site: 'moon', tags: ['any'], src: 'moon', text: 'The Moon\'s gravity is one-sixth of Earth\'s. A throw that goes 6 metres on Earth flies about 36 metres here!' },
    { id: 'lcross', site: 'moon', tags: ['ice', 'air'], src: 'moon', text: 'In 2009 NASA\'s LCROSS mission found water ice inside a dark crater near the Moon\'s south pole. Ice can be turned into drinking water and oxygen.' },
    { id: 'moontemp', site: 'moon', tags: ['power'], src: 'moon', text: 'In sunlight the Moon\'s surface can reach 121°C. In darkness it drops to about −133°C. Machines need power just to stay warm.' },
    { id: 'apollo72', site: 'moon', tags: ['storm'], src: 'apollo', text: 'In August 1972 a huge solar storm blasted the Moon — luckily between the Apollo 16 and Apollo 17 missions, so no astronauts were walking on it.' },
    { id: 'lnd', site: 'moon', tags: ['dose'], src: 'lnd', text: 'A sensor on the Moon\'s surface measured about 1.4 millisieverts of radiation every day. The Moon has no air and no magnetic shield to block it.' },
    { id: 'artemis', site: 'moon', tags: ['any'], src: 'artemis', text: 'NASA\'s Artemis program is aiming for the Moon\'s south pole — the same kind of place as your outpost — because of its sunlight and its ice.' },
    { id: 'regolith', site: 'any', tags: ['shield'], src: 'artemis', text: 'Loose space soil is called regolith. Engineers study piling regolith over habitats, because thick soil is a great radiation shield — and it is free!' },
    { id: 'lunarrover', site: 'moon', tags: ['rover'], src: 'apollo', text: 'Apollo 15, 16 and 17 each brought an electric Moon buggy. Apollo 17\'s crew drove theirs about 36 km in total.' },
    { id: 'flareclass', site: 'any', tags: ['storm'], src: 'donki', text: 'Scientists sort solar flares into classes: A, B, C, M and X. Each letter is 10 times stronger than the one before. X is the strongest.' },
    { id: 'invisible', site: 'any', tags: ['storm', 'dose'], src: 'donki', text: 'You cannot see or feel space radiation. Astronauts carry small sensors called dosimeters that count it for them — like your radiation badge.' },
    { id: 'electro', site: 'any', tags: ['air', 'ice'], src: 'iss', text: 'Water is made of hydrogen and oxygen. The Space Station uses electricity to split water apart and give the crew oxygen to breathe.' },
    { id: 'water', site: 'any', tags: ['food', 'any'], src: 'iss', text: 'On the International Space Station, machines recycle about 98% of the water — even sweat and pee — back into clean drinking water.' },
    { id: 'veggie', site: 'any', tags: ['food'], src: 'iss', text: 'Astronauts first ate space-grown lettuce on the Space Station in 2015. The "Veggie" garden glows pink because plants love red and blue light.' },
    { id: 'plants', site: 'any', tags: ['food'], src: 'osdr', text: 'NASA\'s Open Science Data Repository shares data from hundreds of space biology experiments — including how plants grow without normal gravity.' },
    { id: 'bones', site: 'any', tags: ['any'], src: 'osdr', text: 'In low gravity, astronauts can lose 1% of their bone strength every month. They exercise about 2 hours every day to stay strong.' },
    { id: 'apollo13', site: 'any', tags: ['repair', 'air'], src: 'apollo', text: 'On Apollo 13 the air filters started to fail. The crew built a new filter holder out of plastic bags, cardboard and duct tape — and it worked.' }
  ];

  JA.RANKS = [
    { name: 'Space Cadet', icon: '🎒', line: 'You brought the crew home. That is the hardest part!' },
    { name: 'Mission Pilot', icon: '🚀', line: 'Safe crew and solid science. Nicely balanced!' },
    { name: 'Outpost Commander', icon: '🧑‍🚀', line: 'You juggled power, air, food and radiation like a pro.' },
    { name: 'Legend of the Outpost', icon: '🏆', line: 'Mission Control is speechless. What a mission!' }
  ];

  JA.FAIL = {
    air: { icon: '💨', title: 'The air ran out', text: 'The air tanks hit empty, so the crew climbed into the rocket and flew home early. Everyone is safe.',
      tip: 'Try this: plug a power cell into the Air Maker first thing, then haul ice to it. The rover carries four chunks at once.' },
    food: { icon: '🥬', title: 'The food ran out', text: 'The pantry is empty, so the crew packed up and flew home early. Everyone is safe.',
      tip: 'Try this: plants need light, water and more than a day to grow — so set up the Greenhouse on day one.' },
    dose: { icon: '☢️', title: 'Too much radiation', text: 'The crew\'s radiation badges are full. The mission doctor called everyone home to stay healthy.',
      tip: 'Try this: throw soil bags on the dome early, power the Radio Dish for longer storm warnings, and get inside when a storm is coming.' }
  };
})(window.JA);
