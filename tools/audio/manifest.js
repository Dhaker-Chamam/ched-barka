/* Astro Outpost — the sound list. Every recorded sound in the game is described here, once.
   The tools next to this file read it to prepare folders, process the takes, pack them and test them;
   soundboard.html reads it to label the clips. See README.md in this folder.

   VOICE  one spoken line each           -> audio/voice/<id>.mp3
   SFX    sound effects, loops, ambience -> audio/sfx/<id>.mp3, packed into js/sfx-data.js
   MUSIC  longer pieces                  -> audio/music/<id>.mp3 */
(function (root) {
  'use strict';

  // ---------- who speaks ----------
  // voice, voiceId: the ElevenLabs voice, the same one as in the landing film (audio/landing/).
  // radio: the line is heard over the radio from Earth, so build.js puts it through the radio filter.
  // Both speakers are Mission Control on Earth. CAPCOM ("capsule communicator") is the one flight controller
  // who talks to the crew; it is the voice that used to be BOLT, the robot buddy (removed).
  // The astronaut (voice "Alex") only speaks in the landing film, so has no lines here.
  var CAST = {
    capcom: { name: 'Mission Control (CAPCOM)', voice: 'Ramona Archer', voiceId: 'Z9VxF84ucVtzvKlmYFhh', radio: true, direction: 'Bright, warm, friendly flight controller on Earth, talking to the astronaut by radio. Calm for tips, urgent but kind for warnings.' },
    mc: { name: 'Mission Control', voice: 'David - Deep, Cinematic, Documentary', voiceId: 'rSLmFOTRq9g87aTxSUr6', radio: true, direction: 'Steady, warm, professional; short sentences, like a real flight controller.' }
  };
  // The landing-film clips (audio/landing/) that are Mission Control on the radio. Their originals are kept in
  // <raw>/landing/<id>/; `node tools/audio/build.js landing` filters them again and keeps each clip's own level.
  var LANDING_RADIO = ['01-go-for-landing', '02-sixty-metres', '03-contact', '04-ready-commander'];

  // ---------- voice lines ----------
  // [id, who, when it plays, the words]. A fifth entry is a pattern: the start of a speech-bubble text
  // (lower case, no punctuation) that this line answers, for bubbles whose words change from game to game.
  var V = [
    // the meters
    ['hud-air-intro', 'capcom', 'First air made on day 1', 'This is our air. The crew breathes it all day, so keep the Air Maker busy.'],
    ['hud-air-low', 'capcom', 'Air below a safe level', 'Air is running low. The Air Maker needs a power cell and ice.'],
    ['hud-air-stale', 'capcom', 'Air meter shows "stale air"', 'The air is going stale. It is draining fast!'],
    ['hud-air-leak', 'capcom', 'Air meter shows "leaking!"', 'Air leak! The tanks are losing air.'],
    ['hud-air-empty', 'capcom', 'Air runs out, mission ends', 'The air tanks are empty! Everyone to the rocket!'],
    ['hud-food-intro', 'capcom', 'First seeds growing on day 1', 'This is our food. Every night, dinner comes out of it.'],
    ['hud-food-low', 'capcom', 'Food getting low', 'Food is getting low. Plant seeds in the Greenhouse beds.'],
    ['hud-food-short', 'capcom', 'Late in the day, not enough food for dinner', 'There is not enough food for tonight\'s dinner!'],
    ['hud-food-added', 'capcom', 'A veggie crate reaches the food hatch', 'Fresh food in the pantry!'],
    ['hud-rad-intro', 'capcom', 'First soil bag on the dome', 'This is your radiation badge. When it is full, the mission is over.'],
    ['hud-rad-rising', 'capcom', 'Badge filling up', 'The radiation badge is filling up. More soil bags on the dome would slow it down.'],
    ['hud-rad-full', 'capcom', 'Badge full, mission ends', 'The radiation badges are full! Everyone to the rocket!'],
    ['hud-shield-full', 'capcom', 'All soil-bag slots filled', 'The dome is fully covered. Maximum shielding!'],
    ['hud-clock-low', 'capcom', 'Shift almost over', 'The shift is almost over. Head back to the airlock!'],
    ['hud-clock-over', 'capcom', 'Shift ends outside', 'The shift is over! We are calling you home. That rush used extra air.'],
    ['hud-challenge-done', 'capcom', 'Daily challenge finished', 'Today\'s challenge is done. Nice work!', 'todays challenge is done'],

    // the machines
    ['rack-intro', 'capcom', 'Tutorial, first step', 'Power cells charge on the Solar Rack. Walk up to one and grab it, then carry it to the Air Maker\'s socket.'],
    ['rack-full', 'capcom', 'Rack full, panels wasting sun', 'The Solar Rack is full, so the panels are wasting sunshine. Use those power cells!'],
    ['rack-dusty', 'capcom', 'Dust on the panels (Mars)', 'Dust is covering the solar panels. Brush them off to charge faster.'],
    ['rack-sun-moved', 'capcom', 'Panels no longer face the Sun (Moon)', 'The Sun has moved. Turn the solar panels to face it again.'],
    ['rack-zap', 'capcom', 'Short circuit during a repair', 'Zap! A short circuit wasted some solar charge.'],
    ['rack-broken', 'capcom', 'Rack breaks', 'Loose solar cable! The Solar Rack cannot charge cells until it is fixed.'],
    ['rack-fixed', 'capcom', 'Rack repaired', 'Fixed! The Solar Rack is running again.'],
    ['air-intro', 'capcom', 'Tutorial, second step', 'Now the Air Maker needs ice to turn into oxygen. The ice is far away, so plug a cell into the back of the rover and drive there!'],
    ['air-no-power', 'capcom', 'Ice but no power', 'The Air Maker has ice but no power. Bring it a power cell!'],
    ['air-hungry', 'capcom', 'Power but no ice', 'The Air Maker is powered but hungry. Bring it some ice.', 'the air maker is powered but hungry'],
    ['air-cell-empty', 'capcom', 'Cell used up, ice still waiting', 'The Air Maker used up its power cell, and there is still ice waiting.'],
    ['air-broken', 'capcom', 'Air Maker breaks', 'The Air Maker jammed! A valve froze shut. No new air until it is fixed.'],
    ['air-fixed', 'capcom', 'Air Maker repaired', 'Fixed! The Air Maker is running again.'],
    ['food-intro', 'capcom', 'Tutorial, third step', 'Next: food. The Greenhouse needs light from a power cell, water from ice, and seeds in the beds.'],
    ['food-dark', 'capcom', 'No power for the lamps', 'The plants are in the dark. The Greenhouse needs a power cell for its lamps.'],
    ['food-lamps-out', 'capcom', 'Lamp cell used up', 'The grow lamps ran out of power. Plants stop growing in the dark.'],
    ['food-thirsty', 'capcom', 'Water tank empty', 'The plants are thirsty. Drop an ice chunk in the Greenhouse water tank.'],
    ['food-ripe', 'capcom', 'Veggies ready', 'The veggies are ripe! Pick them at the Greenhouse.', 'veggies are ripe'],
    ['food-crate', 'capcom', 'First veggie crate picked', 'Fresh veggies! Carry the crate to the green food hatch on the dome, or throw it in.'],
    ['food-broken', 'capcom', 'Greenhouse breaks', 'Greenhouse pump stuck! The plants cannot grow until it is fixed.'],
    ['food-fixed', 'capcom', 'Greenhouse repaired', 'Fixed! The Greenhouse is running again.'],
    ['bag-intro', 'capcom', 'Soil Bagger starts', 'The Soil Bagger is filling bags. Grab them and throw them onto the dome!'],
    ['bag-storm-day', 'capcom', 'Storm forecast today', 'A solar storm is forecast today. Soil bags on the dome will protect the crew!'],
    ['lab-core-loaded', 'capcom', 'Core dropped in the Lab', 'Core loaded! The Lab needs a power cell to study it.'],
    ['lab-cell-empty', 'capcom', 'Cell used up, cores waiting', 'The Lab used up its power cell, and cores are still waiting.'],
    ['lab-broken', 'capcom', 'Lab breaks', 'The Lab arm is stuck! No rock cores can be studied until it is fixed.'],
    ['lab-fixed', 'capcom', 'Lab repaired', 'Fixed! The Science Lab is running again.'],
    ['dish-on', 'capcom', 'Radio Dish powered', 'Radio Dish on! Now we can warn you early about solar storms, and help with repairs today.'],
    ['dish-sent-moon', 'capcom', 'Repair question sent, Moon', 'We got your question! The Moon is only 1.3 light-seconds from Earth, so our answer is on its way.'],
    ['dish-sent-mars', 'capcom', 'Repair question sent, Mars', 'Your question is on its way to Earth. It takes minutes to get here, and our answer takes just as long to come back. Keep working, we will call you.'],
    ['dish-answer', 'mc', 'Repair answer arrives', 'Outpost One, here is your answer. Go back to the broken machine to finish the repair.'],
    ['rover-charged', 'capcom', 'Rover cell plugged in', 'Rover charged! Hop in and drive.'],
    ['rover-drive', 'capcom', 'First time in the driver\'s seat', 'Buckle up! The battery only drains while the rover is moving.'],
    ['rover-battery-empty', 'capcom', 'Rover battery runs out while driving', 'The rover battery is empty, so it can only crawl. Plug in a fresh power cell!'],
    ['rover-bed-full', 'capcom', 'Fifth item on the rover bed', 'The rover bed is full. It holds four things.'],
    ['rover-edge', 'capcom', 'Edge of the map', 'That is as far as the outpost radio can reach. Turn back, Commander!'],

    // carrying, drilling, repairs and science
    ['act-welcome', 'capcom', 'First step outside, day 1', 'Welcome outside! Walk around, look around, and try a jump.'],
    ['act-grab', 'capcom', 'First item picked up', 'Got it! Use a machine when you are next to it, or aim and throw.'],
    ['act-trick-throw', 'capcom', 'Long throw lands in a machine', 'What a throw! In low gravity things fly much farther than on Earth.'],
    ['act-jump-moon', 'capcom', 'First jump, Moon', 'Wheee! The Moon\'s gravity is only one-sixth of Earth\'s, so you jump six times higher.'],
    ['act-jump-mars', 'capcom', 'First jump, Mars', 'Boing! Mars gravity is about 38% of Earth\'s, so you jump more than twice as high.'],
    ['act-ice', 'capcom', 'First ice chunk mined', 'A chunk of ice! The Air Maker can split it into oxygen. The rover bed carries four at a time.'],
    ['act-core', 'capcom', 'First rock core drilled', 'A rock core! Take it to the Science Lab to find out what it is made of.'],
    ['act-drill-tip', 'capcom', 'First time drilling', 'Drills get hot! Drill in bursts and let it cool, just like real space drills do.'],
    ['act-drill-jam', 'capcom', 'Drill overheats', 'Too hot! The drill jammed. Let it cool between bursts.'],
    ['act-core-rough', 'capcom', 'Core quality: rough', 'Rough core.'],
    ['act-core-good', 'capcom', 'Core quality: good', 'Good core!'],
    ['act-core-perfect', 'capcom', 'Core quality: perfect', 'Perfect core!'],
    ['act-repair-start', 'capcom', 'Something is broken', 'Something is broken! Look for the sparks and fix it.'],
    ['act-samples-loaded', 'capcom', 'Sample case in the rocket', 'Samples loaded! Scientists on Earth will study them for years.'],
    ['act-devil-panels', 'capcom', 'Dust devil cleans the panels (Mars)', 'A dust devil just blew the dust off the solar panels! That really happened to the Spirit and Opportunity rovers.'],
    ['act-devil-hit', 'capcom', 'Dust devil hits the astronaut (Mars)', 'Whee! A dust devil! Mars air is so thin that it feels like a gentle breeze.'],
    ['act-basics-done', 'capcom', 'Tutorial finished', 'You have got the basics! Now you choose: soil bags for the shield, rock cores for science, or the instruments by the rocket. There is not enough power for everything!'],
    ['act-sound-moon', 'capcom', 'Day 2 on the Moon: why everything sounds muffled', 'Hear how quiet it is? The Moon has no air to carry sound. You only hear what travels through your suit.'],
    ['act-sound-mars', 'capcom', 'Day 2 on Mars: why everything sounds faint', 'Everything sounds faint and muffled out here. The thin Mars air carries sound poorly. The Perseverance rover\'s microphones heard the same thing.'],

    // storms, each new day, and launch
    ['storm-spotted', 'capcom', 'Storm coming, Radio Dish on', 'We just spotted a solar flare! A radiation storm is coming. Head for the airlock!'],
    ['storm-no-warning', 'capcom', 'Storm coming, Radio Dish off', 'Your suit sensor just caught a solar storm! The dish is off, so we could not warn you early. Run for the airlock!'],
    ['storm-countdown', 'capcom', 'Ten seconds before a storm, still outside', 'Solar storm coming. Get to the airlock!'],
    ['storm-inside', 'capcom', 'Storm coming, already inside', 'A solar storm is on its way. Good thing you are inside!'],
    ['storm-active', 'capcom', 'Storm hits while outside', 'Radiation storm! You cannot see it or feel it, but your suit sensor can. Get inside!'],
    ['storm-clicks', 'capcom', 'First storm: what the clicking is', 'That clicking is your suit\'s radiation sensor. More clicks mean more radiation.'],
    ['storm-safe', 'capcom', 'Reaches the airlock during a storm', 'Phew, inside! The walls and the soil bags are soaking up the storm.'],
    ['storm-still-going', 'capcom', 'Goes out during a storm', 'Careful! The storm is still going.'],
    ['storm-passed', 'capcom', 'Storm ends', 'The storm has passed. All clear!'],
    ['inside-rest', 'capcom', 'Goes inside, no storm', 'Back inside. Take a breather. The machines keep working.'],
    ['welcome-moon', 'capcom', 'Welcome card, Moon', 'Welcome to the Moon, Commander! This is Mission Control on Earth. We are with you on the radio all the way. Keep the crew alive, do real science, then ride the rocket home.'],
    ['welcome-mars', 'capcom', 'Welcome card, Mars', 'Welcome to Mars, Commander! This is Mission Control on Earth. We are with you on the radio all the way. Keep the crew alive, do real science, then ride the rocket home.'],
    ['day-morning', 'capcom', 'Morning card', 'Good morning, Commander! Here is the plan for today.'],
    ['day-bright-sunshine', 'capcom', 'Morning, Moon', 'Bright sunshine today.'],
    ['day-long-shadows', 'capcom', 'Morning, Moon', 'Long shadows today.'],
    ['day-in-shadow', 'capcom', 'Morning, Moon', 'In the shadow today.'],
    ['day-clear-sky', 'capcom', 'Morning, Mars', 'Clear sky today.'],
    ['day-dusty-sky', 'capcom', 'Morning, Mars', 'Dusty sky today.'],
    ['day-dust-storm', 'capcom', 'Morning, Mars', 'Dust storm today!'],
    ['forecast-quiet', 'capcom', 'After the weather, no storm', 'The Sun is quiet today.'],
    ['forecast-small', 'capcom', 'After the weather, small storm', 'A small solar storm is coming today. Stay ready to run home!'],
    ['forecast-medium', 'capcom', 'After the weather, medium storm', 'A medium solar storm is coming today. Stay ready to run home!'],
    ['forecast-big', 'capcom', 'After the weather, big storm', 'A big solar storm is coming today. Stay ready to run home!'],
    ['forecast-none', 'capcom', 'After the weather, dish was off', 'The dish was off, so there is no storm forecast. Listen for your suit sensor!'],
    ['day-last', 'capcom', 'Launch day, after the forecast', 'Last day: load the sample case and board the rocket!'],
    ['day-sleep', 'capcom', 'The day ends', 'Good night, Commander.'],
    ['night-report', 'capcom', 'Night report card', 'Good work today, Commander. Here is how the day added up.'],
    ['crisis-your-call', 'capcom', 'A crisis card opens', 'We have no checklist for this one, Commander. There is more than one thing you could do. You decide.'],
    ['launch-time-up', 'capcom', 'Launch day ends outside', 'Time is up, Commander! It is launch time. We are bringing you home!'],
    ['launch-3', 'mc', 'Countdown banner shows 3', 'Three.'],
    ['launch-2', 'mc', 'Countdown banner shows 2', 'Two.'],
    ['launch-1', 'mc', 'Countdown banner shows 1', 'One.'],
    ['launch-liftoff', 'mc', 'Countdown banner shows LIFTOFF', 'Liftoff!'],
    ['win-home', 'mc', 'Mission complete card', 'Outpost One, you are on course for Earth. Outstanding work, Commander. Mission complete!'],
    ['fail-safe', 'capcom', 'Mission failed card', 'The mission is over, but everyone is safe. Real astronauts fail in simulators all the time. That is how they learn.']
  ];

  // ---------- sound effects ----------
  // bus:   ui     interface clicks, never turned down
  //        fx     jingles, alarms and in-helmet sounds; dips while someone speaks
  //        world  things that happen outside; muffled by the place (Moon vacuum, thin Mars air)
  //        amb    background beds that fade in and out with where you are
  // sec:   length asked from ElevenLabs (its sound-effect tool allows 0.5 to 5 s)
  // vol:   how loud it sits in the mix (0 to 1)
  // n:     how many different takes are kept and picked from at random (footsteps must not repeat)
  // pitch: random pitch change per play, as a fraction (0.06 = up to 6% higher or lower)
  // gap:   the shortest time between two plays, in seconds
  // range: for sounds with a place, the distance in metres at which they are half as loud
  // loop:  plays round and round; the game joins the end to the start
  // takes: several takes joined into one longer file, so a background bed repeats less often
  // parts: different prompts joined one after the other into one file
  var S = [
    // interface
    { id: 'tap', bus: 'ui', sec: 0.5, vol: 0.5, pitch: 0.03, gap: 0.04, when: 'Any button or menu choice',
      prompt: 'Soft, friendly user-interface tap, a small rounded plastic click with a tiny bright chime, clean, close, no reverb' },
    { id: 'page', bus: 'ui', sec: 0.5, vol: 0.5, when: 'A message or window opens or closes',
      prompt: 'Light paper-like swipe with a soft digital chime, like turning a page on a futuristic tablet, gentle' },
    { id: 'deny', bus: 'ui', sec: 0.5, vol: 0.5, gap: 0.2, when: 'The player tries something not allowed',
      prompt: 'Short low buzz, soft electronic "nope", not harsh' },
    { id: 'swish', bus: 'fx', sec: 1, vol: 0.55, when: 'Mission launched from the menu, samples loaded, a long throw lands',
      prompt: 'Quick airy whoosh rising in pitch, ending in a sparkling shimmer, uplifting, sci-fi' },
    { id: 'ding', bus: 'fx', sec: 0.8, vol: 0.45, range: 22, when: 'A power cell finishes charging on the Solar Rack',
      prompt: 'Single clear bell ding with a faint electric hum underneath, satisfying, like a battery reaching full charge' },
    { id: 'good', bus: 'fx', sec: 1, vol: 0.5, when: 'Tutorial step done, machine repaired, storm over',
      prompt: 'Three rising cheerful synth notes, warm and bouncy, a small success jingle for a kids\' space game' },
    { id: 'bad', bus: 'fx', sec: 1, vol: 0.5, when: 'A machine breaks, the drill jams, a bad night report',
      prompt: 'Two falling low synth notes, a gentle "uh-oh", disappointed but not scary' },
    { id: 'score', bus: 'fx', sec: 0.7, vol: 0.5, when: 'Mission points earned',
      prompt: 'Bright two-note sparkle, coins-meet-stars feeling, quick and rewarding' },
    { id: 'discovery', bus: 'fx', sec: 2, vol: 0.55, when: 'A new science discovery card appears',
      prompt: 'Magical rising arpeggio of bell tones with a soft shimmer, sense of wonder, space discovery' },
    { id: 'win', bus: 'fx', sec: 4, vol: 0.6, when: 'The crew gets home, mission complete',
      prompt: 'Short triumphant fanfare on bright synths and soft bells, joyful ending, kid-friendly' },
    { id: 'lose', bus: 'fx', sec: 3, vol: 0.5, when: 'The mission ends early',
      prompt: 'Gentle descending melody on soft synth and bells, the mission is over but everyone is safe, bittersweet and kind, not scary' },
    { id: 'photo', bus: 'fx', sec: 0.6, vol: 0.5, when: 'Postcard photo taken',
      prompt: 'Mechanical camera shutter click with a short motor wind, crisp' },
    { id: 'low', bus: 'fx', sec: 0.8, vol: 0.4, gap: 4, when: 'Air or food drops into the red',
      prompt: 'Soft two-note low-level warning ping, like a gentle low-battery alert in a spacesuit, clean electronic' },
    { id: 'daystart', bus: 'fx', sec: 2.5, vol: 0.45, when: 'The morning card opens',
      prompt: 'Gentle sunrise chime, warm rising bell tones with a soft synth swell, a new day begins, hopeful' },
    { id: 'night', bus: 'fx', sec: 3, vol: 0.45, when: 'The night report opens',
      prompt: 'Soft lullaby chime, slow descending music-box notes with a warm pad, bedtime in a space habitat, calm' },
    // warnings
    { id: 'warn', bus: 'fx', sec: 0.5, vol: 0.45, gap: 0.5, when: 'Every second of the storm countdown while outside',
      prompt: 'Single short two-tone spaceship warning beep, urgent but not frightening, clean electronic, dry' },
    { id: 'storm-alert', bus: 'fx', sec: 2.5, vol: 0.5, when: 'A solar storm warning arrives',
      prompt: 'Rising space-station alert siren, two slow sweeps, serious but kid-friendly, clean electronic, no voice' },
    { id: 'alarm', bus: 'fx', sec: 2, vol: 0.55, when: 'A crisis moment begins',
      prompt: 'Pulsing sci-fi base alarm, three quick bursts, red-alert feeling, kid-friendly' },
    // the astronaut
    { id: 'step', bus: 'world', sec: 0.5, vol: 0.34, n: 4, pitch: 0.08, gap: 0.09, when: 'Each footstep',
      prompt: 'Single soft footstep of a heavy space boot in powdery dust, quiet, muffled' },
    { id: 'jump', bus: 'world', sec: 0.6, vol: 0.4, pitch: 0.05, when: 'Astronaut jumps',
      prompt: 'Springy light jump with a soft suit-servo whir, playful, low gravity' },
    { id: 'land', bus: 'world', sec: 0.5, vol: 0.5, pitch: 0.06, when: 'Astronaut lands after a jump',
      prompt: 'Space boots landing softly in fine dust, low-gravity, muffled crunch' },
    { id: 'breath', bus: 'fx', sec: 2.5, vol: 0.2, n: 2, pitch: 0.04, when: 'Breathing inside the helmet, faster after running',
      prompt: 'One slow calm breath in and out inside a space helmet, muffled, intimate, close' },
    { id: 'grab', bus: 'world', sec: 0.5, vol: 0.8, pitch: 0.05, when: 'Picks up an item',
      prompt: 'Quick gloved hand gripping a metal handle, short clunk with a soft magnetic click' },
    { id: 'drop', bus: 'world', sec: 0.5, vol: 0.45, pitch: 0.05, when: 'Sets an item down',
      prompt: 'Metal case set down on dusty ground, soft thud with a little scrape' },
    { id: 'throw', bus: 'world', sec: 0.7, vol: 0.45, pitch: 0.06, when: 'Throws an item',
      prompt: 'Fast whoosh of an object thrown through thin air, light and airy' },
    { id: 'thud', bus: 'world', sec: 0.6, vol: 0.5, pitch: 0.08, gap: 0.08, range: 16, when: 'Item lands in a machine or bounces, rover lands after a bump',
      prompt: 'Heavy muffled thump of metal on metal, short, low' },
    // tools and machines
    { id: 'plug', bus: 'world', sec: 0.8, vol: 0.55, range: 16, when: 'Power cell plugged into a socket',
      prompt: 'Heavy battery sliding into a metal socket, solid clack, then a rising electric power-up hum' },
    { id: 'ice', bus: 'world', sec: 0.6, vol: 0.5, pitch: 0.06, range: 16, when: 'Ice chunk mined or dropped in a hopper',
      prompt: 'Crisp crystalline clink of ice chunks knocking together, cold and bright' },
    { id: 'air', bus: 'world', sec: 1, vol: 0.5, range: 20, when: 'The Air Maker releases a puff of oxygen',
      prompt: 'Soft pressurized hiss of gas release through a valve, with a gentle airy whoosh' },
    { id: 'pop', bus: 'world', sec: 0.5, vol: 0.45, pitch: 0.06, when: 'Seeds planted',
      prompt: 'Small soft pop with a tiny sparkle, like a seed popping into soil' },
    { id: 'harvest', bus: 'world', sec: 0.8, vol: 0.45, when: 'Veggies picked',
      prompt: 'Leafy vegetables pulled from soil and dropped in a plastic crate, crisp rustle, soft thump' },
    { id: 'brush', bus: 'world', sec: 1, vol: 0.45, when: 'A solar panel cleaned or turned',
      prompt: 'Soft brush sweeping dust off a glass solar panel, two quick strokes, then a small servo motor whir' },
    { id: 'bag', bus: 'world', sec: 0.6, vol: 0.5, pitch: 0.06, range: 16, when: 'A soil bag drops onto the Soil Bagger tray',
      prompt: 'Heavy sack of sand dropping onto a metal tray, soft dense thump' },
    { id: 'spark', bus: 'world', sec: 0.6, vol: 0.45, n: 2, pitch: 0.1, gap: 0.1, range: 14, when: 'Something is broken, a repair slip',
      prompt: 'Short electric crackle and zap with a few popping sparks' },
    { id: 'hit', bus: 'world', sec: 0.5, vol: 0.5, pitch: 0.05, when: 'A repair step lands',
      prompt: 'Ratchet wrench turning a bolt tight, two quick metallic clicks and a solid clunk' },
    { id: 'core', bus: 'world', sec: 0.8, vol: 0.5, when: 'A rock core comes out of the ground',
      prompt: 'Rock core sample pulled out of a drill hole, gritty stone scrape and a hollow pop' },
    { id: 'jam', bus: 'world', sec: 1, vol: 0.5, when: 'The drill overheats and jams',
      prompt: 'Power drill jamming in rock, grinding screech cut short, metal clunk and a hiss of hot steam' },
    { id: 'door', bus: 'world', sec: 1.5, vol: 0.55, when: 'Airlock door opens or closes',
      prompt: 'Heavy sci-fi airlock door sliding on rails, pneumatic hiss, metal seal locking' },
    { id: 'rover-start', bus: 'world', sec: 1.2, vol: 0.45, when: 'Climbs into the rover',
      prompt: 'Electric rover powering up, soft rising motor whine and a friendly ready beep' },
    // loops with a place
    { id: 'drill', bus: 'world', sec: 4, vol: 0.5, loop: true, when: 'While drilling; the pitch rises with the heat',
      prompt: 'Steady handheld rock drill whine with gritty grinding, constant pitch, loopable' },
    { id: 'rover', bus: 'world', sec: 4, vol: 0.5, loop: true, when: 'While driving; the pitch follows the speed',
      prompt: 'Smooth electric rover motor hum with soft gear whine and tyre crunch on gravel, steady, loopable' },
    { id: 'devil', bus: 'world', sec: 5, vol: 0.6, loop: true, range: 12, when: 'Near a dust devil (Mars)',
      prompt: 'Small whirlwind of sand spinning nearby, swirling gritty wind, steady, loopable' },
    { id: 'loop-air-maker', bus: 'world', sec: 5, vol: 0.55, loop: true, range: 9, when: 'Air Maker working',
      prompt: 'Industrial air recycler: low fan hum, soft rhythmic pump, occasional gentle hiss of oxygen, steady, loopable' },
    { id: 'loop-greenhouse', bus: 'world', sec: 5, vol: 0.5, loop: true, range: 9, when: 'Greenhouse lamps on',
      prompt: 'Quiet greenhouse: warm electric buzz of grow lamps, soft trickle of water, gentle ventilation, calm, loopable' },
    { id: 'loop-solar-rack', bus: 'world', sec: 5, vol: 0.4, loop: true, range: 7, when: 'Solar Rack charging a cell',
      prompt: 'Soft electric charging hum with a faint high whine, steady and calm, loopable' },
    { id: 'loop-soil-bagger', bus: 'world', sec: 5, vol: 0.55, loop: true, range: 9, when: 'Soil Bagger filling bags',
      prompt: 'Small conveyor machine: rattling belt, sand pouring into sacks, low motor hum, steady, loopable' },
    { id: 'loop-lab', bus: 'world', sec: 5, vol: 0.5, loop: true, range: 8, when: 'Science Lab studying a core',
      prompt: 'Lab analyzer: soft computer beeps and whirs, robotic arm servo moves, gentle electronic hum, loopable' },
    { id: 'loop-radio-dish', bus: 'world', sec: 5, vol: 0.45, loop: true, range: 8, when: 'Radio Dish on',
      prompt: 'Radio dish: soft static, faint data chirps and beeps, slow servo motor turning, loopable' },
    // background beds
    { id: 'amb-suit', bus: 'amb', sec: 5, takes: 2, vol: 0.5, loop: true, stereo: true, when: 'Outside, always: the inside of your own helmet',
      prompt: 'Inside a spacesuit helmet: soft steady life-support fan hum, faint air flow, very quiet electronics, calm, no voice, loopable' },
    { id: 'amb-mars-wind', bus: 'amb', sec: 5, takes: 2, vol: 0.5, loop: true, stereo: true, when: 'Outside on Mars',
      prompt: 'Thin cold wind on Mars, low soft whistling over an empty desert, distant and gentle, no voice, loopable' },
    { id: 'amb-mars-dust', bus: 'amb', sec: 5, takes: 2, vol: 0.6, loop: true, stereo: true, when: 'Outside on Mars on a dusty or dust-storm day',
      prompt: 'Dust storm on Mars heard from inside a helmet: gusting wind and fine sand hissing against the visor, steady, no voice, loopable' },
    { id: 'amb-hab', bus: 'amb', sec: 5, takes: 2, vol: 0.5, loop: true, stereo: true, when: 'Inside the habitat',
      prompt: 'Cosy space habitat interior room tone: soft air vents, quiet computer hum, an occasional gentle beep, safe and warm, no voice, loopable' },
    { id: 'amb-storm', bus: 'amb', sec: 5, takes: 2, vol: 0.55, loop: true, stereo: true, when: 'During a solar radiation storm',
      prompt: 'Uneasy low electronic drone with faint crackling static, like a radiation sensor picking up a solar storm, tense but not scary, no voice, loopable' },
    // the landing film and the launch
    { id: 'descent', bus: 'fx', sec: 5, vol: 0.5, loop: true, when: 'Landing film: the engine during the descent',
      prompt: 'Steady rocket engine roar heard from inside the cabin, constant, deep, loopable' },
    { id: 'touchdown', bus: 'fx', sec: 2.5, vol: 0.7, when: 'Landing film: the lander touches down',
      prompt: 'Heavy spacecraft landing on legs, deep thump, hydraulic legs compressing, dust settling' },
    { id: 'hiss', bus: 'fx', sec: 2, vol: 0.55, when: 'Landing film: the hatch opens',
      prompt: 'Hatch seal releasing: long pressurized hiss and a heavy latch clunk' },
    { id: 'launch', bus: 'world', vol: 0.8, when: 'The rocket lifts off',
      parts: [
        { sec: 5, prompt: 'Rocket engine ignition building to a roaring liftoff, deep rumble rising, powerful' },
        { sec: 5, prompt: 'Powerful rocket engine roar climbing into the sky and slowly fading into the distance, deep rumble' }
      ] }
  ];

  // Sounds that stay synthesized in js/audio.js on purpose, because a pure tone is exactly what they are:
  //   click (the radiation counter), radio and the Quindar beeps around every message from Earth,
  //   aim (the throw power tone, which sweeps with the power), rumble (a low shake under the descent).

  // ---------- music ----------
  var MUSIC = [
    { id: 'title', sec: 40, vol: 0.5, loop: true, when: 'Title screen, mission setup, the end cards',
      prompt: 'Gentle hopeful ambient space theme for a children\'s astronaut game: warm synth pads, soft piano notes, a slow twinkling bell melody, sense of wonder and adventure, no drums, no vocals, calm, loops smoothly' },
    { id: 'vista', sec: 18, vol: 0.55, when: 'Landing film: the view of the outpost',
      prompt: 'Warm cinematic ambient swell: slow hopeful synth pad with a soft rising string line and a few gentle piano notes, awe at seeing a new world, no drums, no vocals, ends softly' },
    { id: 'night', sec: 30, vol: 0.45, loop: true, when: 'Night report',
      prompt: 'Quiet lullaby for a night in a space habitat: soft music box and warm low synth pad, slow and sleepy, peaceful, no drums, no vocals, loops smoothly' }
  ];

  var M = {
    CAST: CAST,
    LANDING_RADIO: LANDING_RADIO,
    VOICE: V.map(function (v) { return { id: v[0], who: v[1], when: v[2], text: v[3], match: v[4] || null }; }),
    SFX: S,
    MUSIC: MUSIC
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = M; else root.AUDIO_MANIFEST = M;
})(typeof globalThis !== 'undefined' ? globalThis : this);
