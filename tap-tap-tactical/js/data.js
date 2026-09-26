// All tuning numbers and content from "Tap Tap Tactical: The Psychosis Protocol".
// Pure data: no DOM access, so the tests can import it.

export const W = 1280;
export const H = 720;

export const FLOOR_MULT = 1.5;          // enemy HP, speed and damage per floor
export const SPEED_CAP = 3;              // cap so floor 5+ stays humanly readable
export const IFRAMES = 0.5;              // "System Shock" freeze after taking damage
export const LOAD_DRAIN = 0.2;           // Cognitive Load drains "extremely slowly" (per second)
export const COMBO_VISIBLE = 3;          // the invisible start: HUD appears after 3 non-miss hits
export const JOLT = 2;                   // load jolt when a combo snaps
export const DDR_MISS_LOAD = 3;          // missed arrow spike
export const BOTCH_LOAD = 4;             // botched injection spike
export const PERFECT_RELOAD_RELIEF = 4;  // perfect reload lowers load
export const OVERLOAD_SECONDS = 10;
export const HALLUCINATION_THRESHOLDS = [10, 20, 30, 40, 50, 60, 70];

export const floorMult = (floor) => Math.pow(FLOOR_MULT, floor - 1);
export const speedMult = (floor) => Math.min(SPEED_CAP, floorMult(floor));

// ---------------------------------------------------------------------------
// Weapons: "The Power Tax" — the more devastating the gun, the longer the reload chart.
// ---------------------------------------------------------------------------
export const TIERS = {
  standard:     { label: 'STANDARD',     min: 3,  max: 4,  spacing: 0.5,  travel: 1.6,  clusters: false, stutter: false },
  tactical:     { label: 'TACTICAL',     min: 6,  max: 8,  spacing: 0.36, travel: 1.25, clusters: false, stutter: false },
  heavy:        { label: 'HEAVY',        min: 10, max: 12, spacing: 0.27, travel: 0.95, clusters: true,  stutter: false },
  experimental: { label: 'EXPERIMENTAL', min: 15, max: 17, spacing: 0.23, travel: 0.8,  clusters: true,  stutter: true },
};

export const WEAPONS = {
  pistol: {
    name: 'P-87 "Last Rites"', kind: 'Pistol', tier: 'standard', dmg: 14, mag: 12, interval: 0.16, auto: false, sound: 'pistol',
    desc: 'Service sidearm. The grip is engraved IN G.O.D. WE TRUST (COMPLIANCE MANDATORY).',
  },
  slapper: {
    name: 'The Slapper', kind: 'Hand-Cannon', tier: 'standard', dmg: 60, mag: 5, interval: 1.5, auto: false, sound: 'slapper',
    desc: 'High damage, 1.5 second cooldown, zero regrets. Every slap is a sermon.',
  },
  rifle: {
    name: 'Psalm-16 Assault Rifle', kind: 'Assault Rifle', tier: 'tactical', dmg: 10, mag: 30, interval: 0.1, auto: true, sound: 'rifle',
    desc: 'G.O.D.-issue. The stock is stamped with a verse that has been redacted for your safety.',
  },
  doodler: {
    name: 'Double Barrel Doodler', kind: 'Shotgun', tier: 'tactical', dmg: 9, pellets: 8, spread: 36, mag: 2, interval: 0.32, auto: false, sound: 'shotgun',
    desc: 'High damage, two shells. Someone drew a crayon smiley face on the stock. Somebody loved this gun.',
  },
  judgment: {
    name: 'Judgment Cannon', kind: 'Quad Cannon', tier: 'heavy', dmg: 24, pellets: 4, pattern: 'quad', mag: 8, interval: 0.45, auto: false, sound: 'cannon',
    desc: "Pried off the Warden's arm. Four barrels, four verdicts, no appeals.",
  },
  thurible: {
    name: 'Thurible Launcher', kind: 'Incense Launcher', tier: 'heavy', dmg: 50, splash: 95, mag: 4, interval: 0.65, auto: false, sound: 'launcher',
    desc: 'Lobs incense-packed shells. Smells like Sunday. Explodes like Monday.',
  },
  needler: {
    name: 'Needler', kind: 'Bolt Caster', tier: 'experimental', dmg: 5, mag: 45, interval: 0.07, auto: true, homing: true, splash: 44, splashDmg: 7, sound: 'needler',
    desc: 'Hymn-tuned bolts that hunt, stick and pop. Individually weak. Collectively a choir.',
  },
  railgun: {
    name: 'Seraph Railgun', kind: 'Railgun', tier: 'experimental', dmg: 140, pierce: true, mag: 3, interval: 1.0, auto: false, sound: 'railgun',
    desc: 'A six-winged capacitor bank. Pierces everything in the line, including your hearing.',
  },
};

// ---------------------------------------------------------------------------
// Consumables: the 4-slot tactical grid. Two-step use: click, then a short chart.
// ---------------------------------------------------------------------------
export const CONSUMABLES = {
  stim: { name: 'Stim-Syringe', icon: 'syringe', notes: 5, spacing: 0.24, travel: 0.9, heal: 35, price: 30, desc: 'Restores 35 Vitals. Fast chart. Do not miss the vein.' },
  sedative: { name: 'Sedative', icon: 'pills', notes: 6, spacing: 0.3, travel: 1.1, load: -35, price: 35, desc: 'The primary way to rapidly lower Cognitive Load. Tastes like communion.' },
  adrenaline: { name: 'Adrenaline', icon: 'adrenaline', notes: 3, spacing: 0.3, travel: 1.0, buff: 7, price: 25, desc: '7 seconds of faster fire and steady hands (no exposure sway).' },
};

// ---------------------------------------------------------------------------
// Items. kind: 'active' | 'passive' | 'both'. Active items live in the 4 active slots
// (a 'both' item's passive only applies while it is held).
// ---------------------------------------------------------------------------
export const ITEMS = [
  {
    id: 'dove', name: 'Dove In a Cage', kind: 'both', tier: 2,
    voice: '"I know it looks grim right now… But one day we will be free from this cursed place."',
    desc: '"But the dove found no resting place for the sole of her foot, and she returned into the ark to him, for the waters were on the face of the whole earth."',
    effect: 'PASSIVE: +50 Max HP. ACTIVE: −50 Cognitive Load (once per room). Arrows are white feathers.',
    passive: { maxHp: 50 }, active: { type: 'sanity', amount: 50, notes: 6, skin: 'feather' },
  },
  {
    id: 'boots', name: 'Metal Boots', kind: 'passive', tier: 1,
    voice: '"Time to give them the ol\' Aaron special."',
    desc: '"F.A.I.T.H. issued combat boots. A perfect fit for mankind."',
    effect: 'PASSIVE: +25% damage, +25 Max HP.',
    passive: { dmgMul: 0.25, maxHp: 25 },
  },
  {
    id: 'heart', name: 'Sacred Heart', kind: 'both', tier: 3,
    voice: '"It\'s been years since I\'ve seen a soft beating heart like this…"',
    desc: '"You have never fought alone. I am always with you."',
    effect: 'PASSIVE: +100 Max HP, ⅓ of missed shots or arrow keys don\'t count as missed. ACTIVE: +50 HP heal (once per room). Arrows are white feathers.',
    passive: { maxHp: 100, forgive: 1 / 3 }, active: { type: 'heal', amount: 50, notes: 6, skin: 'feather' },
  },
  {
    id: 'stone', name: 'Throwing Stone', kind: 'active', tier: 2,
    voice: '"I am not without sin… But I\'m still gonna throw it."',
    desc: '"The stone sank into his forehead, and he fell facedown on the ground."',
    effect: 'ACTIVE: Deals 333 damage to the enemy or boss you click (once per room). Arrows are carved into a rock.',
    active: { type: 'stone', amount: 333, notes: 5, skin: 'rock' },
  },
  {
    id: 'worms', name: 'Blanket of Worms', kind: 'passive', tier: 2,
    voice: '"If nothing else, I\'ll take it to the grave."',
    desc: '"The worm is spread under thee, and the worms cover thee."',
    effect: 'PASSIVE: +50 Max HP, +25% damage resistance.',
    passive: { maxHp: 50, resist: 0.25 },
  },
  {
    id: 'water', name: 'Angry Water', kind: 'active', tier: 2,
    voice: '"Sea of anger. Everybody in."',
    desc: '"We are but fish, drowning in this flood of bitterness, and hope is what causes us to breathe."',
    effect: 'ACTIVE: Floods the room for 60 damage to every hostile and douses blue fire (once per room). Arrows are drops of bitter water.',
    active: { type: 'flood', amount: 60, notes: 7, skin: 'water' },
  },
  {
    id: 'cain', name: 'Mark of Cain', kind: 'passive', tier: 2,
    voice: '"Nobody touches the marked man. Nobody hugs him either."',
    desc: '"And the LORD set a mark upon Cain, lest any finding him should kill him."',
    effect: 'PASSIVE: Enemy Threat Rings fill 20% slower.',
    passive: { ringSlow: 0.2 },
  },
  {
    id: 'silver', name: 'Thirty Pieces of Silver', kind: 'passive', tier: 1,
    voice: '"Betrayal pays. It always has. Ask her."',
    desc: '"And they covenanted with him for thirty pieces of silver."',
    effect: 'PASSIVE: Double scrap from every source.',
    passive: { scrapMul: 1 },
  },
  {
    id: 'salt', name: "Lot's Salt Shaker", kind: 'active', tier: 3,
    voice: '"Don\'t look back. Seriously. Don\'t."',
    desc: '"But his wife looked back from behind him, and she became a pillar of salt."',
    effect: 'ACTIVE: Turns the hostile you click into a pillar of salt (bosses take 150) (once per room). Arrows are salt crystals.',
    active: { type: 'salt', amount: 150, notes: 6, skin: 'salt' },
  },
  {
    id: 'lazarus', name: 'Lazarus Firmware', kind: 'passive', tier: 3,
    voice: '"She made sure I can\'t die. This just makes it official."',
    desc: '"Lazarus, come forth." — Patch notes v4.11: fixed rising.',
    effect: 'PASSIVE: Once per floor, a lethal hit leaves you at 1 HP instead.',
    passive: { lazarus: true },
  },
  {
    id: 'rosary', name: 'Rosary of Zip-Ties', kind: 'passive', tier: 1,
    voice: '"Fifty-nine beads. Fifty-nine chances to not screw up."',
    desc: 'Standard-issue restraints, prayed over by someone who meant it.',
    effect: 'PASSIVE: Arrow timing windows are 35% wider.',
    passive: { window: 0.35 },
  },
  {
    id: 'loaves', name: 'Loaves & Fishes', kind: 'passive', tier: 2,
    voice: '"We are but fish. Apparently also lunch."',
    desc: '"And they did all eat, and were filled."',
    effect: 'PASSIVE: Every combat room drops a consumable. Consumables have a 25% chance to not be used up.',
    passive: { dropAlways: true, saveChance: 0.25 },
  },
  {
    id: 'shard', name: 'Wormwood Shard', kind: 'passive', tier: 3,
    voice: '"It\'s warm. Why is it warm. Why does it smell like her."',
    desc: 'A splinter of the Slaying Star. It is bitter, and it is hers.',
    effect: 'PASSIVE: +40% damage, but all Cognitive Load gains are 25% higher.',
    passive: { dmgMul: 0.4, loadGain: 0.25 },
  },
  {
    id: 'halo', name: 'Noise-Cancelling Halo', kind: 'passive', tier: 1,
    voice: '"Finally. Silence. …Why is it humming hymns?"',
    desc: 'G.O.D. brand. Now with 40% fewer revelations.',
    effect: 'PASSIVE: Immune to the Static of Guilt. Suppresses the Film Grain and Uncanny Valley Eyes.',
    passive: { guiltImmune: true, suppress: ['grain', 'eyes'] },
  },
  {
    id: 'bush', name: 'Burning Bush', kind: 'active', tier: 2,
    voice: '"It\'s talking to me. It says \'reload.\'"',
    desc: '"And the bush burned with fire, and the bush was not consumed."',
    effect: 'ACTIVE: Sets every hostile ablaze for 15 damage per second for 5 seconds (once per room). Arrows are tongues of flame.',
    active: { type: 'burn', amount: 15, duration: 5, notes: 6, skin: 'flame' },
  },
];
export const itemById = (id) => ITEMS.find((i) => i.id === id);

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------
export const ENEMIES = {
  angel: {
    name: 'G.O.D. Tier 1 Angel', hp: 30, dmg: 10, load: 5, ring: [2.3, 3.4], burst: 3,
    voice: 'Just another guy who drank the water. I wonder if he even knows what his acronym stands for.',
    desc: 'The Baseline. Stripped of their names and fed a steady diet of twisted scripture and synthetic rations.',
  },
  elite: {
    name: 'Seraph Guard', hp: 60, dmg: 15, load: 6, ring: [1.7, 2.5], burst: 3,
    voice: 'Gold halo. Must be management.',
    desc: 'Tier 1 Angels who scored well on the Obedience Exam. Their rings fill faster.',
  },
  ember: {
    name: "Uriel's Ember", hp: 60, fireDps: 15, fireLoad: 10, windup: 1.5, flight: 1.5, fireTime: 4, splash: 40,
    voice: "Don't let that blue stuff stick to you. It burns hotter than Hell.",
    desc: 'Chemically altered incendiaries that burn the color of a dying star. Deployed to fry the fish of Hades.',
  },
  prisoner: {
    name: 'Prisoner of F.A.I.T.H.', hp: 10, killLoad: 20, guilt: 2,
    voice: 'Wait… I think I knew him. Was he… No. Just keep shooting. My head is splitting.',
    desc: 'Once rebels who stood against G.O.D., now mindless drones swimming without direction through the dark labyrinth of Hades.',
  },
  berserker: {
    name: 'Bejeweled Berserker', hp: 90, dmg: 20, load: 5, march: 8,
    voice: "So this is how she 'saved' you? Pretty, isn't it? Makes me wonder why she left me so… unfinished.",
    desc: "A victim of La'anah's 'love.' Her cosmic corrosion calcifies the flesh, turning men into living statues of diamond and rage.",
  },
  crawler: {
    name: 'Failed Subject', hp: 40, dmg: 15, load: 10, crawl: 5.5,
    voice: 'Subject 86. They couldn\'t die either. They tried harder than me.',
    desc: 'Unclassified experiments. Bunker-busters: cover does not stop what climbs over it.',
  },
  warden: { name: 'ARCHANGEL UNIT-01 "THE WARDEN"', hp: 1200 },
  aaron: { name: 'EXPERIMENT A-4RON', hp: 520 },
};

// ---------------------------------------------------------------------------
// Hallucinations: 7 of these 11 are dealt to the 10%–70% Cognitive Load thresholds each run.
// ---------------------------------------------------------------------------
export const HALLUCINATIONS = [
  { id: 'rat', name: 'The Dancing Rat', desc: 'A low-poly, N64-era rat replaces the crosshair and loops a dancing animation.' },
  { id: 'scramble', name: 'Scrambled UI Text', desc: 'The Ammo Counter and weapon displays scramble into unreadable, glitching symbols.' },
  { id: 'shift', name: 'Shifting Crosshairs', desc: 'The crosshair vibrates off-center (bullets still go to the true center).' },
  { id: 'phantoms', name: 'Phantom Hostiles', desc: 'Fake, glitching soldiers spawn. Shooting a Phantom registers as a Miss.' },
  { id: 'ghosts', name: 'Phantom DDR Arrows', desc: 'Semi-transparent Ghost Arrows scroll alongside real ones. Tapping one is a missed beat.' },
  { id: 'invert', name: 'Inverted DDR Prompts', desc: 'Arrow colors aggressively swap, breaking muscle memory.' },
  { id: 'horse', name: 'The JPEG Horse', desc: 'A massive, badly-compressed horse gallops across the screen, blocking line of sight.' },
  { id: 'grain', name: 'The Film Grain', desc: 'A thick TV-static filter fades in and out, lowering visibility.' },
  { id: 'eyes', name: 'Uncanny Valley Eyes', desc: 'Unblinking human eyes fade in and out at random points on the screen.' },
  { id: 'anatomy', name: 'Anatomical Cover', desc: 'In Cover, the concrete barrier reveals pulsing muscle and ribs underneath.' },
  { id: 'flayed', name: 'Flayed Hands', desc: "While performing utility in Cover, Subject 87's hands are stripped to raw muscle and bone." },
];

// ---------------------------------------------------------------------------
// Sector map
// ---------------------------------------------------------------------------
export const NODE_TYPES = {
  initiation: { tag: '[INITIATION_NODE]', name: 'The Breach', line: 'ESTABLISHING CONNECTION. PREPARE FOR COMBAT.' },
  combat: { tag: '[SEC_BREACH]', name: 'Combat Room', line: 'HOSTILES DETECTED. PREPARE FOR COMBAT.' },
  gateway: { tag: '[GATEWAY]', name: 'Minigame / QTE', line: 'REFLEX CALIBRATION REQUIRED.' },
  containment: { tag: '[CONTAINMENT_CELL]', name: 'Item Vault', line: 'ANOMALY VAULT UNSEALED. EXTRACT ONE.' },
  quarantine: { tag: '[QUARANTINE_SECTOR]', name: 'Mini-Boss', line: 'CONTAINMENT FAILURE. 30 HOSTILES. GOOD LUCK.' },
  null: { tag: '[NULL_ZONE]', name: 'Relief / Lore', line: 'NO HOSTILES DETECTED. BREATHE.' },
  core: { tag: '[SYSTEM_CORE]', name: 'Floor Boss', line: 'APEX PROCESS ONLINE. JUDGMENT PENDING.' },
};
export const FLOOR_COUNTS = { combat: [5, 8], gateway: [1, 3], containment: [1, 2], quarantine: [2, 3], null: [2, 5] };

// ---------------------------------------------------------------------------
// Cheat codes (typed at the title terminal)
// ---------------------------------------------------------------------------
export const CHEATS = {
  9074: { id: 'oneShot', name: 'ONE SHOT BULLET' },
  4612: { id: 'unlockAll', name: 'UNLOCK ALL' },
  7298: { id: 'invincible', name: 'INVINCIBILITY' },
  1111: { id: 'bossSkip', name: 'FIRST FLOOR BOSS SKIP' },
};

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------
export const TICKER = [
  'REPENT • RELOAD • REPEAT',
  'G.O.D. LOVES YOU (CONDITIONS APPLY)',
  'THIS FACILITY HAS GONE 0 DAYS WITHOUT A MIRACLE',
  'HYDRATE! THE WATER IS FINE. THE WATER IS FINE. THE WATER IS FINE.',
  'SIN IS A SUBSCRIPTION — CANCEL ANYTIME*   *CANCELLATION NOT AVAILABLE IN HADES',
  'HAVE YOU TRIED NOT BEING AN ANOMALY?',
  'REPORT ALL DANCING. DANCING IS RESERVED FOR SACRED CALIBRATIONS.',
  'THE SKY IS 66.6% COMPLETE. PLEASE DO NOT LOOK UP.',
  'OBEDIENCE IS A LOVE LANGUAGE',
  "TODAY'S SCRIPTURE: [REDACTED]",
  'NEW! COMMUNION WAFERS — GLUTEN-FREE, SOUL-FREE',
  'F.A.I.T.H. IS DEAD. PLEASE STOP SPRAY-PAINTING IT ON THINGS.',
  'SUBJECT OF THE MONTH: SUBJECT 87 (AGAIN)',
  'HE IS WATCHING. SO ARE WE. SO IS THE RAT.',
  'GLOBAL OFFENSIVE DEMOCRACY — YOU VOTED FOR THIS*   *YOU DID NOT VOTE',
];

export const BARKS = {
  roomStart: ['Another room. Another sermon.', "Node locked. Let's get this over with.", 'Here we go again.', 'Cover. Breathe. Count.'],
  kill: ['Rest. Somebody should get to.', 'Another fish off the hook.', 'Amen. Next.', 'Sorry. Not sorry. …A little sorry.'],
  hurt: ["Can't die. Doesn't mean it tickles.", 'Blessing my ass.', 'It hurts. It always hurts. I just never get to stop.'],
  perfectReload: ['Chambered. Like a prayer.', 'Brass and rhythm.', 'Clean.'],
  pills: ['Tastes like communion. Bitter communion.', 'Wormwood aftertaste. Figures.', 'Okay. Okay. Floor is a floor again.'],
  lowSanity: ['Is that a… rat? Is it dancing?', "La'anah? …No. Keep moving.", 'The walls are breathing again.', "Don't look at the eyes. Don't look at the eyes."],
  overloadWin: ["Okay. Okay. I'm here. I'm here.", 'Brain back online. Mostly.'],
  critical: ["Heart's barely in it.", 'Not yet. Not like this.'],
};

export const BULKHEAD_CURSES = [
  'Sonofa-', '*curses to himself*', 'I like women. Not dudes.',
  'This key is like my penis and the lock is like your mom.', 'Dammit.', 'Oops. Had the card the wrong way.',
];

export const DANCE_ROUNDS = [
  {
    name: 'ROUND 1: THE INITIATION', notes: 9, doubles: 0, spacing: 0.3, travel: 1.0,
    lines: [
      ['DANCE SOLDIER', 'G.O.D. mandates perfect rhythmic compliance. Observe and replicate, anomaly.'],
      ['SUBJECT 87', 'What the hell is wrong with you people?! Dammit, my knees.'],
      ['DANCE SOLDIER', 'Your footwork is offensive to Democracy. Adjust your posture.'],
      ['SUBJECT 87', "Are we fighting or are we at a prom? Because I don't pull out on the first date."],
    ],
  },
  {
    name: 'ROUND 2: THE ESCALATION', notes: 11, doubles: 0.35, spacing: 0.27, travel: 0.9,
    lines: [
      ['DANCE SOLDIER', 'Sub-optimal performance. The world dances faster. Keep up.'],
      ['SUBJECT 87', "Sonofa— left, right, up— screw you! I have a gun! Why aren't I just shooting you?!"],
      ['DANCE SOLDIER', 'Ballistics are prohibited during the Sacred Calibrations. Feel the rhythm.'],
      ['SUBJECT 87', "I'm gonna shove this rhythm so far up your ass you'll be coughing up sheet music!"],
    ],
  },
  {
    name: 'ROUND 3: THE BLUR', notes: 15, doubles: 0.2, spacing: 0.19, travel: 0.75,
    lines: [
      ['DANCE SOLDIER', 'Final assessment! The Slaying Star demands absolute kinetic synergy!'],
      ['SUBJECT 87', 'I like women! Not dudes in armor doing the cha-cha! Dammit, slow down!'],
      ['DANCE SOLDIER', 'Submit to the beat! Surrender your neural link!'],
      ['SUBJECT 87', 'This floor is like ice and your helmet looks like a trash can! Eat shit, twinkle-toes!'],
    ],
  },
];

export const WARDEN_LINES = {
  intro: ['THE WARDEN', 'Subject 87… How did you slip your shackles this time? G.O.D. is a jealous master. You will find no exit in Hades—only deeper circles of the deep dark.'],
  introRepeat: ['THE WARDEN', 'Unit-0{n}. Same face, different serial number. G.O.D. buys in bulk, Subject 87.'],
  phase2: ['THE WARDEN', 'The world dances faster. DANCE WITH IT.'],
  phase3: ['SUBJECT 87', 'In a way, Warden, I have a certain respect for you… You kept my mind still for so long. For that, I swear to make your end quick.'],
  victory: 'The first ripple has been cast. The sea begins to wake.',
};

export const AARON_LINES = {
  intro: ['A-4RON', "*wet laugh* You're wasting our time, kid!"],
  intro87: ['SUBJECT 87', 'Aaron? …What did they do to you.'],
  mid: [
    ['A-4RON', 'Go back to Mom before I tell her you\'re annoying me again…'],
    ['A-4RON', 'LEAH! Where did you take her?!'],
    ['A-4RON', "He isn't wanted here. Look at him. Dirty. No friends."],
    ['SUBJECT 87', "Time for the ol' Aaron special. Again."],
  ],
  death: ['A-4RON', 'Geez… kid. …Tell Leah I…'],
};

export const GAG_ROOMS = [
  {
    title: 'G.O.D. EMPLOYEE BREAK ROOM',
    text: 'A Tier 1 Angel sits at a folding table, helmet off, halo dimmed to "break mode." He is eating a sandwich labeled PROPERTY OF G.O.D. — DO NOT JUDGE. He looks at you. You look at him.\n\n"I\'m on my fifteen, man. Shoot me after."',
    options: [
      { label: 'Let him finish his sandwich', result: 'He nods and slides a Stim-Syringe across the table. "Didn\'t see you. Didn\'t see me. Nobody sees anything down here."', effect: { consumable: 'stim', load: -10 } },
      { label: 'Shoot him anyway', result: '"On my FIFTEEN, man." You feel worse than he does. He drops his lunch money.', effect: { scrap: 25, load: 12 } },
    ],
  },
  {
    title: 'CONFESSIONAL BOOTH v2.3 (BETA)',
    text: 'A booth of black glass and crucifix LEDs. A synthesized voice crackles: "Welcome to Automated Absolution. Please state your sin after the tone. Your call is important to G.O.D."\n\n*beep*',
    options: [
      { label: '"I miss her."', result: '"…Processing. …Processing. That is not a sin. That is a symptom. Prescribing one (1) Sedative." A pill rattles into the tray.', effect: { consumable: 'sedative' } },
      { label: '"I kicked Aaron in the nuts."', result: '"…Absolved. Honestly? Deserved. Here is a loyalty reward for your candor."', effect: { scrap: 30 } },
      { label: 'Say nothing', result: '"Silence detected. Silence is also a confession. Have a blessed shift." You feel strangely lighter.', effect: { load: -15 } },
    ],
  },
  {
    title: 'MANDATORY JOY CENTER',
    text: 'A treadmill faces a screen of a smiling Archangel giving a thumbs up. Text scrolls: PRODUCTIVITY IS PRAYER. PRAYER IS CARDIO. CARDIO IS COMPLIANCE.',
    options: [
      { label: 'Run on the treadmill', result: "You run for eleven minutes. The Archangel's thumb goes up further. Your heart feels… sturdier?", effect: { maxHp: 10 } },
      { label: 'Unplug the screen', result: 'The screen goes black. For a second you hear actual silence. Then it plugs itself back in.', effect: { load: -12 } },
    ],
  },
  {
    title: 'LOST & FOUND (SOULS)',
    text: 'Shelves of labeled mason jars glow faintly. SUBJECT 12 — LAUGH. SUBJECT 40 — FIRST KISS. SUBJECT 86 — LEFT SOCK. At the very end, a jar with no label hums a song you almost remember.',
    options: [
      { label: 'Take the unlabeled jar', result: 'It is warm. It smells like the rebel camp at night, like festival lanterns. You put it in your coat.', effect: { load: -20 } },
      { label: 'Take SUBJECT 86 — LEFT SOCK', result: 'It is just a sock. There is scrap in it. Subject 86 was smarter than he looked.', effect: { scrap: 35 } },
    ],
  },
  {
    title: 'HADES GIFT SHOP',
    text: 'A cheerful kiosk under a neon sign: YOU\'RE IN HADES! (WISH YOU WERE HERE). The T-shirts read I SURVIVED FLOOR 1 AND ALL I GOT WAS IMMORTALITY. The cashier is a skeleton in a G.O.D. polo. It has been waiting a very long time.',
    options: [
      { label: 'Buy a snow globe (20 scrap)', cost: 20, result: 'Inside the globe, a tiny star falls forever onto a tiny sea. You shake it. It falls again. You feel… seen.', effect: { load: -25 } },
      { label: 'Leave a tip', result: "The skeleton's jaw falls off. You think that means thank you. There is an Adrenaline shot in the tip jar. You take it. Economy.", effect: { consumable: 'adrenaline' } },
    ],
  },
  {
    title: 'KARAOKE CHAPEL',
    text: 'A jukebox shaped like a cathedral organ blinks: NOW PLAYING — "Amazing Grace (Offensive Democracy Remix) feat. The Warden." The lyric screen reads: AMAZING GRACE / HOW SWEET THE SOUND / THAT SAVED A WRETCH / [REDACTED] [REDACTED].',
    options: [
      { label: 'Sing along', result: 'You sing badly. You sing loudly. Somewhere, a Prisoner of F.A.I.T.H. hums along. Your hands stop shaking.', effect: { load: -18 } },
      { label: 'Kick the jukebox', result: 'It plays one note of her favorite song and dies. Scrap spills out of the coin slot.', effect: { scrap: 20, load: 6 } },
    ],
  },
];

export const TIPS = [
  'Hold SPACE to pop up. Let go to drop into cover. Cover is the only place you can reload, heal or take pills.',
  'Threat Rings: cyan = aiming, yellow = tightening, flashing red = firing. Be in cover when they go red.',
  "Shoot Uriel's Ember grenades out of the air. If they land, your cover burns for 4 seconds.",
  "Never shoot the Prisoners of F.A.I.T.H. They are one click from a +20% Cognitive Load spike.",
  'The Bejeweled Berserker is armored. Only the glowing weak point takes damage, and it moves.',
  'A perfect reload (every arrow PERFECT) grants glowing Overload Rounds and lowers Cognitive Load.',
  'The combo counter only appears after 3 hits in a row. Missing a shot, missing an arrow or getting hit resets it.',
  'At 100% Cognitive Load you are dragged into cover and have 10 seconds to swallow the Emergency Sedative.',
];
