// The Pokédex: affectionate parody "pocket critters", 100+ species in evolution lines.
// Base stats [hp, atk, def, spa, spd, spe], types, catch rate, base exp, how they
// evolve (by level or by stone), the moves they learn as they level up, and a "look"
// that the sprite painter and the 3D model builder both read.

// Learnsets are shared by an evolution line: [level, move].
const LEARN = {
  bulb: [[1, 'tackle'], [1, 'growl'], [3, 'vineWhip'], [7, 'poisonPowder'], [9, 'sleepPowder'], [12, 'razorLeaf'], [15, 'megaDrain'], [19, 'takeDown'], [23, 'seedBomb'], [27, 'synthesis'], [31, 'sludgeBomb'], [36, 'gigaDrain'], [42, 'energyBall'], [48, 'petalDance'], [54, 'solarBeam']],
  char: [[1, 'scratch'], [1, 'growl'], [4, 'ember'], [8, 'leer'], [12, 'dragonBreath'], [16, 'fireFang'], [20, 'slam'], [24, 'flameWheel'], [28, 'dragonClaw'], [33, 'flamethrower'], [36, 'wingAttack'], [40, 'airSlash'], [45, 'flareBlitz'], [50, 'fireBlast'], [56, 'dragonDance']],
  squirt: [[1, 'tackle'], [1, 'tailWhip'], [3, 'waterGun'], [7, 'withdraw'], [10, 'bubble'], [13, 'bite'], [17, 'waterPulse'], [21, 'rockTomb'], [25, 'aquaTail'], [30, 'ironDefense'], [34, 'surf'], [38, 'flashCannon'], [44, 'hydroPump']],
  cater: [[1, 'tackle'], [1, 'stringShot'], [7, 'harden'], [10, 'confusion'], [12, 'poisonPowder'], [13, 'stunSpore'], [15, 'sleepPowder'], [18, 'gust'], [22, 'psybeam'], [26, 'signalBeam'], [30, 'airSlash'], [34, 'bugBuzz'], [40, 'psychic']],
  weed: [[1, 'poisonSting'], [1, 'stringShot'], [7, 'harden'], [10, 'furySwipes'], [13, 'bugBite'], [16, 'poisonJab'], [20, 'pinMissile'], [25, 'xScissor'], [30, 'swordsDance'], [35, 'sludgeBomb']],
  pidg: [[1, 'tackle'], [5, 'gust'], [9, 'quickAttack'], [13, 'wingAttack'], [17, 'twister'], [21, 'aerialAce'], [27, 'airSlash'], [33, 'roost'], [38, 'braveBird'], [44, 'hurricane']],
  rat: [[1, 'tackle'], [1, 'tailWhip'], [4, 'quickAttack'], [7, 'bite'], [10, 'furySwipes'], [13, 'hyperFang'], [16, 'crunch'], [20, 'swordsDance'], [24, 'suckerPunch'], [29, 'doubleEdge'], [34, 'takeDown'], [40, 'hyperBeam']],
  ekans: [[1, 'leer'], [1, 'poisonSting'], [4, 'bite'], [9, 'acid'], [12, 'lick'], [17, 'poisonFang'], [20, 'sludge'], [25, 'crunch'], [28, 'sludgeBomb'], [33, 'poisonJab'], [38, 'toxic']],
  pika: [[1, 'thunderShock'], [1, 'growl'], [4, 'tailWhip'], [8, 'quickAttack'], [11, 'thunderWave'], [15, 'spark'], [18, 'doubleKick'], [22, 'discharge'], [26, 'slam'], [30, 'thunderbolt'], [35, 'ironTail'], [40, 'thunder'], [45, 'voltTackle']],
  sand: [[1, 'scratch'], [1, 'defenseCurl'], [5, 'mudSlap'], [9, 'rockThrow'], [13, 'furySwipes'], [17, 'metalClaw'], [21, 'dig'], [26, 'slam'], [31, 'crunch'], [36, 'swordsDance'], [40, 'earthquake']],
  cleff: [[1, 'pound'], [1, 'growl'], [5, 'sing'], [9, 'disarmingVoice'], [13, 'defenseCurl'], [17, 'drainingKiss'], [21, 'sweetKiss'], [25, 'calmMind'], [30, 'dazzlingGleam'], [35, 'moonblast'], [42, 'recover']],
  vulpix: [[1, 'ember'], [1, 'tailWhip'], [5, 'quickAttack'], [9, 'confuseRay'], [13, 'fireSpin'], [17, 'hex'], [21, 'willOWisp'], [26, 'flamethrower'], [32, 'darkPulse'], [38, 'fireBlast']],
  jiggly: [[1, 'pound'], [1, 'sing'], [5, 'defenseCurl'], [9, 'disarmingVoice'], [14, 'bodySlam'], [19, 'rest'], [24, 'playRough'], [30, 'hyperVoice'], [36, 'doubleEdge']],
  zubat: [[1, 'leechLife'], [1, 'astonish'], [5, 'confuseRay'], [9, 'bite'], [13, 'wingAttack'], [17, 'poisonFang'], [22, 'airSlash'], [28, 'crunch'], [34, 'braveBird'], [40, 'sludgeBomb']],
  odd: [[1, 'absorb'], [1, 'growl'], [5, 'acid'], [9, 'poisonPowder'], [11, 'stunSpore'], [13, 'sleepPowder'], [17, 'megaDrain'], [21, 'sludge'], [25, 'gigaDrain'], [30, 'moonblast'], [35, 'petalDance'], [40, 'solarBeam']],
  duck: [[1, 'scratch'], [1, 'tailWhip'], [4, 'waterGun'], [8, 'confusion'], [12, 'furySwipes'], [16, 'waterPulse'], [20, 'psybeam'], [24, 'zenHeadbutt'], [29, 'amnesia'], [34, 'surf'], [39, 'psychic'], [44, 'hydroPump']],
  growl: [[1, 'bite'], [1, 'leer'], [5, 'ember'], [9, 'quickAttack'], [13, 'fireFang'], [17, 'flameWheel'], [21, 'crunch'], [26, 'takeDown'], [31, 'flamethrower'], [36, 'extremeSpeed'], [42, 'flareBlitz']],
  poli: [[1, 'waterGun'], [1, 'pound'], [5, 'hypnosis'], [9, 'bubble'], [13, 'doubleKick'], [17, 'bubbleBeam'], [21, 'bodySlam'], [25, 'brickBreak'], [30, 'waterfall'], [35, 'hydroPump'], [40, 'closeCombat']],
  abra: [[1, 'confusion'], [1, 'tackle'], [16, 'psybeam'], [20, 'recover'], [24, 'calmMind'], [28, 'psychoCut'], [32, 'psychic'], [38, 'shadowBall'], [44, 'auraSphere']],
  machop: [[1, 'lowKick'], [1, 'leer'], [5, 'karateChop'], [9, 'machPunch'], [13, 'forcePalm'], [17, 'seismicToss'], [21, 'brickBreak'], [25, 'bulkUp'], [30, 'submission'], [36, 'crossChop'], [42, 'closeCombat']],
  geo: [[1, 'tackle'], [1, 'defenseCurl'], [5, 'rockThrow'], [9, 'mudSlap'], [13, 'rockTomb'], [17, 'harden'], [21, 'rockSlide'], [26, 'dig'], [31, 'stoneEdge'], [36, 'earthquake'], [42, 'explosion']],
  pony: [[1, 'tackle'], [1, 'growl'], [5, 'ember'], [9, 'tailWhip'], [13, 'flameWheel'], [17, 'quickAttack'], [21, 'takeDown'], [26, 'fireSpin'], [31, 'flamethrower'], [37, 'flareBlitz'], [42, 'fireBlast']],
  slow: [[1, 'tackle'], [1, 'growl'], [5, 'waterGun'], [9, 'confusion'], [13, 'headbutt'], [17, 'waterPulse'], [22, 'zenHeadbutt'], [27, 'amnesia'], [32, 'psychic'], [38, 'surf'], [44, 'rest']],
  magnet: [[1, 'tackle'], [1, 'thunderShock'], [5, 'thunderWave'], [9, 'spark'], [13, 'metalClaw'], [17, 'flashCannon'], [22, 'discharge'], [28, 'ironDefense'], [33, 'thunderbolt'], [40, 'thunder']],
  gastly: [[1, 'lick'], [1, 'hypnosis'], [5, 'astonish'], [9, 'confuseRay'], [13, 'nightShade'], [17, 'hex'], [21, 'shadowSneak'], [25, 'sludge'], [30, 'shadowBall'], [36, 'darkPulse'], [42, 'sludgeBomb']],
  onix: [[1, 'tackle'], [1, 'harden'], [5, 'rockThrow'], [9, 'bite'], [13, 'rockTomb'], [17, 'dragonBreath'], [21, 'slam'], [26, 'rockSlide'], [31, 'ironTail'], [36, 'stoneEdge'], [42, 'earthquake']],
  cubone: [[1, 'growl'], [1, 'mudSlap'], [5, 'tailWhip'], [9, 'boneClub'], [13, 'headbutt'], [17, 'bonemerang'], [21, 'leer'], [26, 'dig'], [31, 'doubleEdge'], [37, 'earthquake']],
  koff: [[1, 'tackle'], [1, 'smog'], [5, 'poisonPowder'], [9, 'acid'], [13, 'sludge'], [18, 'selfDestruct'], [23, 'toxic'], [28, 'sludgeBomb'], [34, 'explosion']],
  eevee: [[1, 'tackle'], [1, 'tailWhip'], [5, 'quickAttack'], [9, 'bite'], [13, 'swift'], [17, 'headbutt'], [21, 'takeDown'], [26, 'returnMove'], [31, 'doubleEdge'], [36, 'hyperVoice']],
  vaporeon: [[1, 'waterGun'], [20, 'bubbleBeam'], [25, 'waterPulse'], [30, 'aquaTail'], [36, 'surf'], [42, 'hydroPump']],
  jolteon: [[1, 'thunderShock'], [20, 'spark'], [25, 'doubleKick'], [30, 'thunderWave'], [36, 'thunderbolt'], [42, 'thunder']],
  flareon: [[1, 'ember'], [20, 'fireFang'], [25, 'bite'], [30, 'flameWheel'], [36, 'flareBlitz'], [42, 'fireBlast']],
  umbreon: [[1, 'bite'], [20, 'confuseRay'], [25, 'suckerPunch'], [30, 'crunch'], [36, 'darkPulse'], [42, 'rest']],
  leafeon: [[1, 'razorLeaf'], [20, 'megaDrain'], [25, 'seedBomb'], [30, 'swordsDance'], [36, 'leafBlade'], [42, 'solarBeam']],
  karp: [[1, 'splash'], [15, 'tackle'], [20, 'bite'], [24, 'twister'], [28, 'waterfall'], [32, 'crunch'], [36, 'dragonDance'], [40, 'hydroPump'], [45, 'hyperBeam']],
  lapras: [[1, 'waterGun'], [1, 'growl'], [5, 'sing'], [10, 'powderSnow'], [15, 'confuseRay'], [20, 'iceShard'], [25, 'waterPulse'], [30, 'bodySlam'], [35, 'iceBeam'], [40, 'surf'], [46, 'blizzard'], [52, 'hydroPump']],
  snor: [[1, 'tackle'], [1, 'defenseCurl'], [8, 'amnesia'], [12, 'lick'], [16, 'headbutt'], [20, 'rest'], [25, 'bodySlam'], [30, 'crunch'], [36, 'doubleEdge'], [42, 'hyperBeam']],
  dratini: [[1, 'leer'], [1, 'twister'], [5, 'thunderWave'], [11, 'dragonRage'], [15, 'slam'], [21, 'dragonBreath'], [25, 'aquaTail'], [31, 'dragonPulse'], [35, 'dragonDance'], [41, 'outrage'], [47, 'extremeSpeed'], [55, 'hyperBeam']],
  mewtoo: [[1, 'confusion'], [1, 'swift'], [10, 'psybeam'], [20, 'recover'], [30, 'psychic'], [40, 'auraSphere'], [50, 'calmMind'], [60, 'shadowBall']],
  mew: [[1, 'pound'], [10, 'confusion'], [20, 'ancientPower'], [30, 'psychic'], [40, 'auraSphere'], [50, 'flamethrower'], [60, 'thunderbolt']],
  bird: [[1, 'gust'], [1, 'peck'], [10, 'ancientPower'], [20, 'airSlash'], [30, 'roost'], [40, 'drillPeck'], [50, 'hurricane']],
  articuno: [[1, 'gust'], [1, 'powderSnow'], [15, 'iceShard'], [25, 'ancientPower'], [35, 'iceBeam'], [45, 'roost'], [55, 'blizzard']],
  zapdos: [[1, 'peck'], [1, 'thunderShock'], [15, 'thunderWave'], [25, 'ancientPower'], [35, 'thunderbolt'], [45, 'drillPeck'], [55, 'thunder']],
  moltres: [[1, 'wingAttack'], [1, 'ember'], [15, 'fireSpin'], [25, 'ancientPower'], [35, 'flamethrower'], [45, 'airSlash'], [55, 'fireBlast']],
  ditto: [[1, 'pound'], [10, 'tackle'], [20, 'bodySlam'], [30, 'doubleEdge']],
  meowth: [[1, 'scratch'], [1, 'growl'], [6, 'bite'], [9, 'payDay'], [14, 'furySwipes'], [18, 'nightSlash'], [22, 'swift'], [28, 'swordsDance'], [33, 'suckerPunch'], [38, 'playRough']],
  scyther: [[1, 'quickAttack'], [1, 'leer'], [6, 'furySwipes'], [11, 'wingAttack'], [16, 'razorLeaf'], [21, 'swordsDance'], [26, 'nightSlash'], [31, 'xScissor'], [36, 'airSlash'], [42, 'leafBlade']],
  voltorb: [[1, 'tackle'], [1, 'thunderShock'], [5, 'spark'], [10, 'selfDestruct'], [15, 'swift'], [20, 'thunderWave'], [26, 'discharge'], [32, 'thunderbolt'], [38, 'explosion']],
  diglett: [[1, 'scratch'], [1, 'mudSlap'], [5, 'growl'], [9, 'furySwipes'], [14, 'mudShot'], [19, 'suckerPunch'], [24, 'dig'], [30, 'earthPower'], [36, 'earthquake']],
  tenta: [[1, 'poisonSting'], [1, 'waterGun'], [6, 'acid'], [10, 'bubbleBeam'], [15, 'confuseRay'], [20, 'waterPulse'], [25, 'poisonJab'], [30, 'sludgeBomb'], [36, 'surf'], [42, 'hydroPump']],
  togepi: [[1, 'pound'], [1, 'growl'], [5, 'sweetKiss'], [9, 'disarmingVoice'], [13, 'charm'], [17, 'ancientPower'], [21, 'drainingKiss'], [26, 'dazzlingGleam'], [31, 'airSlash'], [36, 'moonblast']],
  mareep: [[1, 'tackle'], [1, 'growl'], [4, 'thunderShock'], [8, 'thunderWave'], [11, 'spark'], [15, 'confuseRay'], [20, 'discharge'], [25, 'dragonPulse'], [30, 'thunderbolt'], [36, 'thunder']],
  wooper: [[1, 'waterGun'], [1, 'tailWhip'], [4, 'mudSlap'], [8, 'mudShot'], [12, 'slam'], [16, 'amnesia'], [20, 'waterPulse'], [24, 'dig'], [29, 'surf'], [35, 'earthquake']],
  riolu: [[1, 'quickAttack'], [1, 'machPunch'], [5, 'forcePalm'], [10, 'metalClaw'], [15, 'bulletPunch'], [20, 'brickBreak'], [25, 'swordsDance'], [30, 'auraSphere'], [36, 'closeCombat'], [42, 'meteorMash'], [48, 'extremeSpeed']],
  gible: [[1, 'tackle'], [1, 'mudSlap'], [5, 'dragonRage'], [10, 'bite'], [15, 'dig'], [19, 'dragonClaw'], [24, 'crunch'], [30, 'dragonDance'], [36, 'earthquake'], [42, 'outrage'], [50, 'dracoMeteor']],
  mimikyu: [[1, 'astonish'], [1, 'scratch'], [6, 'shadowSneak'], [11, 'charm'], [16, 'hex'], [21, 'shadowClaw'], [26, 'swordsDance'], [32, 'playRough'], [38, 'shadowBall']],
  froakie: [[1, 'pound'], [1, 'growl'], [5, 'bubble'], [8, 'quickAttack'], [12, 'waterPulse'], [16, 'aerialAce'], [21, 'bite'], [26, 'nightSlash'], [31, 'waterfall'], [36, 'darkPulse'], [42, 'hydroPump']],
  wooloo: [[1, 'tackle'], [1, 'growl'], [4, 'defenseCurl'], [8, 'headbutt'], [12, 'takeDown'], [16, 'bodySlam'], [21, 'ironDefense'], [26, 'doubleEdge']],
  bidoof: [[1, 'tackle'], [1, 'growl'], [5, 'defenseCurl'], [9, 'headbutt'], [13, 'hyperFang'], [17, 'aquaTail'], [21, 'crunch'], [25, 'bodySlam'], [30, 'swordsDance'], [35, 'doubleEdge']],
  ralts: [[1, 'growl'], [1, 'confusion'], [5, 'disarmingVoice'], [9, 'hypnosis'], [13, 'drainingKiss'], [17, 'psybeam'], [22, 'calmMind'], [27, 'dazzlingGleam'], [32, 'psychic'], [38, 'moonblast']],
  larvitar: [[1, 'bite'], [1, 'leer'], [5, 'rockThrow'], [10, 'mudSlap'], [15, 'rockTomb'], [20, 'crunch'], [26, 'rockSlide'], [32, 'darkPulse'], [38, 'stoneEdge'], [45, 'earthquake'], [52, 'hyperBeam']],
  absol: [[1, 'scratch'], [1, 'leer'], [5, 'quickAttack'], [10, 'bite'], [15, 'nightSlash'], [20, 'swordsDance'], [26, 'psychoCut'], [32, 'suckerPunch'], [38, 'darkPulse'], [44, 'playRough']],
  ponytaH: [[1, 'tackle'], [5, 'confusion'], [10, 'fairyWind'], [15, 'psybeam'], [20, 'dazzlingGleam'], [26, 'psychic'], [32, 'playRough'], [38, 'moonblast']],
};

// look: form, colours [main, second, accent, belly], feature tags, size (m)
const L = (form, c, f = [], size = 1) => ({ form, c, f, size });

// S(id, no, name, types, base stats, line, opts)
const DEX = [];
const S = (id, no, name, types, stats, line, o = {}) => DEX.push({ id, no, name, types, base: stats, learn: line, catchRate: o.cr ?? 120, exp: o.exp ?? Math.round(stats.reduce((a, b) => a + b, 0) / 4.5), evo: o.evo || null, look: o.look, rarity: o.rare ?? 1, legendary: !!o.legend, cry: o.cry ?? (0.6 + (no % 13) / 13 * 0.9), real: o.real });

S('bulbasore', 1, 'Bulbasore', ['grass', 'poison'], [45, 49, 49, 65, 65, 45], 'bulb', { cr: 45, evo: { to: 'ivysore', lvl: 16 }, look: L('quad', ['#6cc6a0', '#3b8d6e', '#c94b6d', '#a7e3c8'], ['bulb', 'spots', 'pointears'], 0.7) });
S('ivysore', 2, 'Ivysore', ['grass', 'poison'], [60, 62, 63, 80, 80, 60], 'bulb', { cr: 45, evo: { to: 'venusore', lvl: 32 }, look: L('quad', ['#5bb79a', '#2f7a5c', '#e06a8a', '#9fdcc0'], ['bud', 'spots', 'pointears'], 1) });
S('venusore', 3, 'Venusore', ['grass', 'poison'], [80, 82, 83, 100, 100, 80], 'bulb', { cr: 45, look: L('quad', ['#4aa78a', '#2a6a50', '#e8607e', '#8fd0b0'], ['flower', 'spots', 'pointears'], 1.6) });
S('charmandork', 4, 'Charmandork', ['fire'], [39, 52, 43, 60, 50, 65], 'char', { cr: 45, evo: { to: 'charmelon', lvl: 16 }, look: L('biped', ['#f59e4c', '#e07b28', '#fde047', '#fde68a'], ['flametail', 'roundhead'], 0.6) });
S('charmelon', 5, 'Charmelon', ['fire'], [58, 64, 58, 80, 65, 80], 'char', { cr: 45, evo: { to: 'charizzard', lvl: 36 }, look: L('biped', ['#e2553a', '#b33a22', '#fde047', '#f8d8a0'], ['flametail', 'horn', 'claws'], 1) });
S('charizzard', 6, 'Charizzard', ['fire', 'flying'], [78, 84, 78, 109, 85, 100], 'char', { cr: 45, look: L('dragon', ['#f08a3a', '#c6601f', '#3b82c4', '#fde68a'], ['flametail', 'bigwings', 'horns2'], 1.8) });
S('squirtul', 7, 'Squirtul', ['water'], [44, 48, 65, 50, 64, 43], 'squirt', { cr: 45, evo: { to: 'wartortel', lvl: 16 }, look: L('turtle', ['#7cc4e8', '#a0522d', '#f8e5b0', '#f8e5b0'], ['shell', 'tailcurl'], 0.6) });
S('wartortel', 8, 'Wartortel', ['water'], [59, 63, 80, 65, 80, 58], 'squirt', { cr: 45, evo: { to: 'blastortoise', lvl: 36 }, look: L('turtle', ['#7d9fe0', '#8b4513', '#f8e5b0', '#f8e5b0'], ['shell', 'tailfluffy', 'longears'], 1) });
S('blastortoise', 9, 'Blastortoise', ['water'], [79, 83, 100, 85, 105, 78], 'squirt', { cr: 45, look: L('turtle', ['#5b7fd1', '#7a4a20', '#d1d5db', '#f8e5b0'], ['shell', 'cannons'], 1.6) });
S('caterpeel', 10, 'Caterpeel', ['bug'], [45, 30, 35, 20, 20, 45], 'cater', { cr: 255, evo: { to: 'metapud', lvl: 7 }, look: L('larva', ['#7ccf5a', '#4a9a35', '#fbbf24', '#f8f0c0'], ['antenna'], 0.5) });
S('metapud', 11, 'Metapud', ['bug'], [50, 20, 55, 25, 25, 30], 'cater', { cr: 120, evo: { to: 'butterfreak', lvl: 10 }, look: L('cocoon', ['#65b84a', '#3f7a2c', '#a7e3a0', '#a7e3a0'], [], 0.6) });
S('butterfreak', 12, 'Butterfreak', ['bug', 'flying'], [60, 45, 50, 90, 80, 70], 'cater', { cr: 45, look: L('bug', ['#6b5bb3', '#f8fafc', '#e11d48', '#6b5bb3'], ['wings', 'antenna', 'bigeyes'], 1) });
S('weedlr', 13, 'Weedlr', ['bug', 'poison'], [40, 35, 30, 20, 20, 50], 'weed', { cr: 255, evo: { to: 'kakoona', lvl: 7 }, look: L('larva', ['#d6a04a', '#a0702a', '#e11d48', '#f8e5b0'], ['horn'], 0.5) });
S('kakoona', 14, 'Kakoona', ['bug', 'poison'], [45, 25, 50, 25, 25, 35], 'weed', { cr: 120, evo: { to: 'beedrll', lvl: 10 }, look: L('cocoon', ['#f2c94c', '#b8902a', '#fde68a', '#fde68a'], [], 0.6) });
S('beedrll', 15, 'Beedrll', ['bug', 'poison'], [65, 90, 40, 45, 80, 75], 'weed', { cr: 45, look: L('bug', ['#f6c533', '#111827', '#e11d48', '#f6c533'], ['wings', 'stinger', 'stripes'], 1) });
S('pidgee', 16, 'Pidgee', ['normal', 'flying'], [40, 45, 40, 35, 35, 56], 'pidg', { cr: 255, evo: { to: 'pidgeoto', lvl: 18 }, look: L('bird', ['#b9854f', '#f5deb3', '#f59e0b', '#f5deb3'], ['beak', 'tuft'], 0.5) });
S('pidgeoto', 17, 'Pidgeoto', ['normal', 'flying'], [63, 60, 55, 50, 50, 71], 'pidg', { cr: 120, evo: { to: 'pidgeyet', lvl: 36 }, look: L('bird', ['#a8743f', '#f5deb3', '#e11d48', '#f5deb3'], ['beak', 'crest'], 0.9) });
S('pidgeyet', 18, 'Pidgeyet', ['normal', 'flying'], [83, 80, 75, 70, 70, 101], 'pidg', { cr: 45, look: L('bird', ['#9a6a38', '#f5deb3', '#fbbf24', '#f5deb3'], ['beak', 'crest', 'bigwings'], 1.4) });
S('rattatat', 19, 'Rattatat', ['normal'], [30, 56, 35, 25, 35, 72], 'rat', { cr: 255, evo: { to: 'raticat', lvl: 20 }, look: L('quad', ['#a463c8', '#f5deb3', '#f8fafc', '#f5deb3'], ['roundears', 'whiskers', 'teeth', 'tailcurl'], 0.45), real: 'In the top percentage of rattatats.' });
S('raticat', 20, 'Raticat', ['normal'], [55, 81, 60, 50, 70, 97], 'rat', { cr: 127, look: L('quad', ['#c9a065', '#f5deb3', '#f8fafc', '#f5deb3'], ['roundears', 'whiskers', 'teeth'], 0.8) });
S('ekanz', 23, 'Ekanz', ['poison'], [35, 60, 44, 40, 54, 55], 'ekans', { cr: 255, evo: { to: 'arbokz', lvl: 22 }, look: L('serpent', ['#a35fc4', '#fde047', '#dc2626', '#fde68a'], ['rattle'], 0.8) });
S('arbokz', 24, 'Arbokz', ['poison'], [60, 95, 69, 65, 79, 80], 'ekans', { cr: 90, look: L('serpent', ['#7e4ba3', '#fde047', '#dc2626', '#fde68a'], ['hood'], 1.6) });
S('pikachew', 25, 'Pikachew', ['electric'], [35, 55, 40, 50, 50, 90], 'pika', { cr: 190, evo: { to: 'raichew', item: 'thunderStone' }, rare: 0.4, look: L('quad', ['#f9d71c', '#1f2937', '#ef4444', '#f9d71c'], ['longears', 'cheeks', 'tailbolt'], 0.45) });
S('raichew', 26, 'Raichew', ['electric'], [60, 90, 55, 90, 80, 110], 'pika', { cr: 75, look: L('quad', ['#e9902a', '#4b3416', '#fde047', '#f8e5b0'], ['longears', 'cheeks', 'tailbolt'], 0.8) });
S('sandschrew', 27, 'Sandschrew', ['ground'], [50, 75, 85, 20, 30, 40], 'sand', { cr: 255, evo: { to: 'sandslosh', lvl: 22 }, look: L('biped', ['#e2c06b', '#b8902a', '#f8fafc', '#f8e5b0'], ['claws', 'pointears'], 0.6) });
S('sandslosh', 28, 'Sandslosh', ['ground'], [75, 100, 110, 45, 55, 65], 'sand', { cr: 90, look: L('biped', ['#d8a84a', '#8b5a2b', '#f8fafc', '#f8e5b0'], ['claws', 'spikes'], 1) });
S('cleffairy', 35, 'Cleffairy', ['fairy'], [70, 45, 48, 60, 65, 35], 'cleff', { cr: 150, evo: { to: 'clefabble', item: 'moonStone' }, look: L('blob', ['#f9b4c4', '#e8849c', '#7c2d12', '#fcd5de'], ['pointears', 'curl', 'tinywings'], 0.6) });
S('clefabble', 36, 'Clefabble', ['fairy'], [95, 70, 73, 95, 90, 60], 'cleff', { cr: 25, look: L('blob', ['#f7a6ba', '#e07a94', '#7c2d12', '#fcd5de'], ['pointears', 'curl', 'tinywings'], 1.2) });
S('vulpicks', 37, 'Vulpicks', ['fire'], [38, 41, 40, 50, 65, 65], 'vulpix', { cr: 190, evo: { to: 'ninetailz', item: 'fireStone' }, look: L('quad', ['#d9733a', '#a8481f', '#fde68a', '#f5deb3'], ['pointears', 'tails6', 'tuft'], 0.55) });
S('ninetailz', 38, 'Ninetailz', ['fire'], [73, 76, 75, 81, 100, 100], 'vulpix', { cr: 75, look: L('quad', ['#f3e5ab', '#e5c76b', '#dc2626', '#fffbeb'], ['pointears', 'tails9', 'mane'], 1.1) });
S('jigglypuffed', 39, 'Jigglypuffed', ['normal', 'fairy'], [115, 45, 20, 45, 25, 20], 'jiggly', { cr: 170, evo: { to: 'wigglytough', item: 'moonStone' }, look: L('blob', ['#f8b4cc', '#e88aa8', '#3b82f6', '#f8b4cc'], ['pointears', 'curl', 'bigeyes'], 0.5) });
S('wigglytough', 40, 'Wigglytough', ['normal', 'fairy'], [140, 70, 45, 85, 50, 45], 'jiggly', { cr: 50, look: L('blob', ['#f7a8c0', '#e07a9c', '#16a34a', '#fde2ec'], ['longears', 'curl', 'bigeyes'], 1) });
S('zoobat', 41, 'Zoobat', ['poison', 'flying'], [40, 45, 35, 30, 40, 55], 'zubat', { cr: 255, evo: { to: 'golbatt', lvl: 22 }, look: L('bat', ['#5a8ac6', '#9b59b6', '#f8fafc', '#5a8ac6'], ['bigwings', 'pointears', 'noeyes', 'fangs'], 0.6) });
S('golbatt', 42, 'Golbatt', ['poison', 'flying'], [75, 80, 70, 65, 75, 90], 'zubat', { cr: 90, evo: { to: 'crobattle', lvl: 36 }, look: L('bat', ['#4a72b0', '#8e44ad', '#dc2626', '#4a72b0'], ['bigwings', 'pointears', 'bigmouth', 'fangs'], 1.1) });
S('crobattle', 169, 'Crobattle', ['poison', 'flying'], [85, 90, 80, 70, 80, 130], 'zubat', { cr: 90, look: L('bat', ['#7b4fa8', '#5b3a82', '#fde047', '#7b4fa8'], ['bigwings', 'wings4', 'pointears', 'fangs'], 1.2) });
S('oddysh', 43, 'Oddysh', ['grass', 'poison'], [45, 50, 55, 75, 65, 30], 'odd', { cr: 255, evo: { to: 'gloomy', lvl: 21 }, look: L('plant', ['#3b5bab', '#16a34a', '#dc2626', '#3b5bab'], ['leaves'], 0.45) });
S('gloomy', 44, 'Gloomy', ['grass', 'poison'], [60, 65, 70, 85, 75, 40], 'odd', { cr: 120, evo: { to: 'vileplum', item: 'leafStone' }, look: L('plant', ['#3b5bab', '#c2410c', '#fb923c', '#3b5bab'], ['bigflower', 'drool'], 0.8) });
S('vileplum', 45, 'Vileplum', ['grass', 'poison'], [75, 80, 85, 110, 90, 50], 'odd', { cr: 45, look: L('plant', ['#3b5bab', '#dc2626', '#f8fafc', '#3b5bab'], ['rafflesia'], 1.2) });
S('psyduct', 54, 'Psyduct', ['water'], [50, 52, 48, 65, 50, 55], 'duck', { cr: 190, evo: { to: 'golduct', lvl: 33 }, look: L('biped', ['#f6d34a', '#e9b13a', '#fde68a', '#fde68a'], ['duckbill', 'tuft', 'dazed'], 0.7) });
S('golduct', 55, 'Golduct', ['water'], [80, 82, 78, 95, 80, 85], 'duck', { cr: 75, look: L('biped', ['#3b82c4', '#1d4ed8', '#dc2626', '#93c5fd'], ['duckbill', 'gem', 'claws'], 1.5) });
S('growlith', 58, 'Growlith', ['fire'], [55, 70, 45, 70, 50, 60], 'growl', { cr: 190, evo: { to: 'arcanein', item: 'fireStone' }, look: L('quad', ['#f08a3a', '#111827', '#fde68a', '#fde68a'], ['pointears', 'stripes', 'tuft', 'tailfluffy'], 0.7) });
S('arcanein', 59, 'Arcanein', ['fire'], [90, 110, 80, 100, 80, 95], 'growl', { cr: 75, look: L('quad', ['#ec7a2a', '#111827', '#fde68a', '#fde68a'], ['pointears', 'stripes', 'mane', 'tailfluffy'], 1.9) });
S('polywag', 60, 'Polywag', ['water'], [40, 50, 40, 40, 40, 90], 'poli', { cr: 255, evo: { to: 'polywhirl', lvl: 25 }, look: L('blob', ['#5b8fd8', '#f8fafc', '#111827', '#f8fafc'], ['swirl', 'tadtail'], 0.6) });
S('polywhirl', 61, 'Polywhirl', ['water'], [65, 65, 65, 50, 50, 90], 'poli', { cr: 120, evo: { to: 'polywrath', item: 'waterStone' }, look: L('biped', ['#4a7cc8', '#f8fafc', '#111827', '#f8fafc'], ['swirl'], 1) });
S('polywrath', 62, 'Polywrath', ['water', 'fighting'], [90, 95, 95, 70, 90, 70], 'poli', { cr: 45, look: L('biped', ['#3b6bb8', '#f8fafc', '#111827', '#f8fafc'], ['swirl', 'angry', 'fists'], 1.3) });
S('abrah', 63, 'Abrah', ['psychic'], [25, 20, 15, 105, 55, 90], 'abra', { cr: 200, evo: { to: 'kadabruh', lvl: 16 }, rare: 0.6, look: L('humanoid', ['#e9c46a', '#8b5a2b', '#a16207', '#e9c46a'], ['sleepy', 'pointears', 'tailfluffy'], 0.9) });
S('kadabruh', 64, 'Kadabruh', ['psychic'], [40, 35, 30, 120, 70, 105], 'abra', { cr: 100, evo: { to: 'alakazamn', lvl: 36 }, look: L('humanoid', ['#e2b85a', '#8b5a2b', '#dc2626', '#e2b85a'], ['star', 'mustache', 'spoon', 'pointears'], 1.3) });
S('alakazamn', 65, 'Alakazamn', ['psychic'], [55, 50, 45, 135, 95, 120], 'abra', { cr: 50, look: L('humanoid', ['#d9a84a', '#8b5a2b', '#9ca3af', '#d9a84a'], ['mustache', 'spoon2', 'pointears'], 1.5) });
S('machomp', 66, 'Machomp', ['fighting'], [70, 80, 50, 35, 35, 35], 'machop', { cr: 180, evo: { to: 'machoked', lvl: 28 }, look: L('biped', ['#9aa5b8', '#6b7280', '#dc2626', '#d1d5db'], ['crest', 'fists'], 0.8) });
S('machoked', 67, 'Machoked', ['fighting'], [80, 100, 70, 50, 60, 45], 'machop', { cr: 90, evo: { to: 'machamped', lvl: 40 }, look: L('biped', ['#8a93b0', '#4b5563', '#facc15', '#d1d5db'], ['crest', 'fists', 'belt', 'muscles'], 1.5) });
S('machamped', 68, 'Machamped', ['fighting'], [90, 130, 80, 65, 85, 55], 'machop', { cr: 45, look: L('biped', ['#7c85a8', '#374151', '#facc15', '#d1d5db'], ['crest', 'fists', 'belt', 'arms4', 'muscles'], 1.6) });
S('geodud', 74, 'Geodud', ['rock', 'ground'], [40, 80, 100, 30, 30, 20], 'geo', { cr: 255, look: L('rock', ['#9b8f7a', '#6b6255', '#4b5563', '#9b8f7a'], ['arms', 'angry'], 0.5), evo: { to: 'gravelord', lvl: 25 } });
S('gravelord', 75, 'Gravelord', ['rock', 'ground'], [55, 95, 115, 45, 45, 35], 'geo', { cr: 120, evo: { to: 'golemn', lvl: 40 }, look: L('rock', ['#8f8270', '#5f5648', '#4b5563', '#8f8270'], ['arms4', 'angry', 'rocky'], 1) });
S('golemn', 76, 'Golemn', ['rock', 'ground'], [80, 120, 130, 55, 65, 45], 'geo', { cr: 45, look: L('turtle', ['#7a8f5a', '#5f6e44', '#8b5a2b', '#a8b07a'], ['shell', 'rocky'], 1.4) });
S('ponytail', 77, 'Ponytail', ['fire'], [50, 85, 55, 65, 65, 90], 'pony', { cr: 190, evo: { to: 'rapidosh', lvl: 40 }, look: L('horse', ['#fbf3d5', '#f5deb3', '#f97316', '#fbf3d5'], ['firemane', 'hooves'], 1) });
S('rapidosh', 78, 'Rapidosh', ['fire'], [65, 100, 70, 80, 80, 105], 'pony', { cr: 60, look: L('horse', ['#fbf3d5', '#f5deb3', '#f97316', '#fbf3d5'], ['firemane', 'horn', 'hooves'], 1.7) });
S('slowpok', 79, 'Slowpok', ['water', 'psychic'], [90, 65, 65, 40, 40, 15], 'slow', { cr: 190, evo: { to: 'slowbruh', lvl: 37 }, look: L('quad', ['#f6a5b8', '#e2849c', '#fde68a', '#fde2ec'], ['roundears', 'dazed', 'longtail'], 0.9) });
S('slowbruh', 80, 'Slowbruh', ['water', 'psychic'], [95, 75, 110, 100, 80, 30], 'slow', { cr: 75, look: L('biped', ['#f6a5b8', '#9ca3af', '#fde68a', '#fde2ec'], ['roundears', 'dazed', 'shellbite'], 1.4) });
S('magnamite', 81, 'Magnamite', ['electric', 'steel'], [25, 35, 70, 95, 55, 45], 'magnet', { cr: 190, evo: { to: 'magnetonne', lvl: 30 }, look: L('orb', ['#c0c7d1', '#6b7280', '#dc2626', '#c0c7d1'], ['magnets', 'screws', 'cyclops'], 0.4) });
S('magnetonne', 82, 'Magnetonne', ['electric', 'steel'], [50, 60, 95, 120, 70, 70], 'magnet', { cr: 60, look: L('orb', ['#c0c7d1', '#6b7280', '#dc2626', '#c0c7d1'], ['magnets', 'screws', 'cyclops', 'triple'], 1) });
S('cubonk', 104, 'Cubonk', ['ground'], [50, 50, 95, 40, 50, 35], 'cubone', { cr: 190, evo: { to: 'marowack', lvl: 28 }, look: L('biped', ['#b98a52', '#8b5a2b', '#f1eee3', '#e8d5b0'], ['skullhelm', 'bone'], 0.5) });
S('marowack', 105, 'Marowack', ['ground'], [60, 80, 110, 50, 80, 45], 'cubone', { cr: 75, look: L('biped', ['#a8794a', '#7a4a20', '#f1eee3', '#e8d5b0'], ['skullhelm', 'bone', 'angry'], 1) });
S('gastlee', 92, 'Gastlee', ['ghost', 'poison'], [30, 35, 30, 100, 35, 80], 'gastly', { cr: 190, evo: { to: 'hauntur', lvl: 25 }, look: L('ghost', ['#2a1b3d', '#6d28d9', '#f8fafc', '#2a1b3d'], ['gasaura', 'fangs'], 0.8) });
S('hauntur', 93, 'Hauntur', ['ghost', 'poison'], [45, 50, 45, 115, 55, 95], 'gastly', { cr: 90, evo: { to: 'gengur', lvl: 38 }, look: L('ghost', ['#6b4fa8', '#4c3a7a', '#f8fafc', '#6b4fa8'], ['spikes', 'hands', 'grin'], 1.2) });
S('gengur', 94, 'Gengur', ['ghost', 'poison'], [60, 65, 60, 130, 75, 110], 'gastly', { cr: 45, look: L('blob', ['#5b3f96', '#3f2a6a', '#dc2626', '#5b3f96'], ['spikes', 'grin', 'redeyes'], 1.4) });
S('onyx', 95, 'Onyx', ['rock', 'ground'], [35, 45, 160, 30, 45, 70], 'onix', { cr: 45, evo: { to: 'steelyx', lvl: 40 }, look: L('serpent', ['#9aa1a8', '#6b7280', '#4b5563', '#9aa1a8'], ['boulders', 'horn'], 3) });
S('steelyx', 208, 'Steelyx', ['steel', 'ground'], [75, 85, 200, 55, 65, 30], 'onix', { cr: 25, look: L('serpent', ['#b7bccc', '#6b7280', '#e11d48', '#b7bccc'], ['boulders', 'jaw'], 3.5) });
S('coughing', 109, 'Coughing', ['poison'], [40, 65, 95, 60, 45, 35], 'koff', { cr: 190, evo: { to: 'wheezin', lvl: 35 }, look: L('orb', ['#7c5ea8', '#5b3a82', '#fde047', '#7c5ea8'], ['skull', 'smoke', 'craters'], 0.6) });
S('wheezin', 110, 'Wheezin', ['poison'], [65, 90, 120, 85, 70, 60], 'koff', { cr: 60, look: L('orb', ['#7c5ea8', '#5b3a82', '#fde047', '#7c5ea8'], ['skull', 'smoke', 'twin'], 1.2) });
S('eevie', 133, 'Eevie', ['normal'], [55, 55, 50, 45, 65, 55], 'eevee', { cr: 45, rare: 0.5, evo: [{ to: 'vaporieon', item: 'waterStone' }, { to: 'jolteeon', item: 'thunderStone' }, { to: 'flarieon', item: 'fireStone' }, { to: 'umbreeon', item: 'moonStone' }, { to: 'leafieon', item: 'leafStone' }], look: L('quad', ['#b07a45', '#f5deb3', '#4b3416', '#f5deb3'], ['longears', 'mane', 'tailfluffy'], 0.4) });
S('vaporieon', 134, 'Vaporieon', ['water'], [130, 65, 60, 110, 95, 65], 'vaporeon', { cr: 45, look: L('quad', ['#6ab7e8', '#2f6ea8', '#f8fafc', '#a0d8f0'], ['fins', 'finears', 'fishtail'], 1) });
S('jolteeon', 135, 'Jolteeon', ['electric'], [65, 65, 60, 110, 95, 130], 'jolteon', { cr: 45, look: L('quad', ['#f6d34a', '#f8fafc', '#111827', '#f6d34a'], ['spikes', 'pointears', 'mane'], 0.8) });
S('flarieon', 136, 'Flarieon', ['fire'], [65, 130, 60, 95, 110, 65], 'flareon', { cr: 45, look: L('quad', ['#ef6b3a', '#fde68a', '#111827', '#ef6b3a'], ['longears', 'mane', 'tailfluffy'], 0.9) });
S('umbreeon', 197, 'Umbreeon', ['dark'], [95, 65, 110, 60, 130, 65], 'umbreon', { cr: 45, look: L('quad', ['#1f2937', '#fde047', '#dc2626', '#1f2937'], ['longears', 'rings'], 1) });
S('leafieon', 470, 'Leafieon', ['grass'], [65, 110, 130, 60, 65, 95], 'leafeon', { cr: 45, look: L('quad', ['#efe1b0', '#5bb450', '#8b5a2b', '#efe1b0'], ['leafears', 'leaves', 'leaftail'], 1) });
S('magikrap', 129, 'Magikrap', ['water'], [20, 10, 55, 15, 20, 80], 'karp', { cr: 255, evo: { to: 'gyarados', lvl: 20 }, look: L('fish', ['#ef6c3a', '#f5deb3', '#f8fafc', '#fde68a'], ['whiskers', 'crown', 'dazed'], 0.9) });
S('gyarados', 130, 'Gyara-DOS', ['water', 'flying'], [95, 125, 79, 60, 100, 81], 'karp', { cr: 45, look: L('serpent', ['#3b6fd1', '#f5deb3', '#f8fafc', '#fde68a'], ['crest', 'whiskers', 'bigmouth', 'angry'], 3) });
S('lapraz', 131, 'Lapraz', ['water', 'ice'], [130, 85, 80, 85, 95, 60], 'lapras', { cr: 45, rare: 0.3, look: L('plesio', ['#5aa3dc', '#9ca3af', '#f8e5b0', '#f8e5b0'], ['shell', 'horn'], 2.2) });
S('dittoh', 132, 'Dittoh', ['normal'], [48, 48, 48, 48, 48, 48], 'ditto', { cr: 35, rare: 0.5, look: L('blob', ['#c4a2e0', '#a77fd0', '#111827', '#c4a2e0'], ['dotface', 'goo'], 0.3) });
S('snorelax', 143, 'Snorelax', ['normal'], [160, 110, 65, 65, 110, 30], 'snor', { cr: 25, rare: 0.3, look: L('blob', ['#2f5d6e', '#f5e6c8', '#111827', '#f5e6c8'], ['pointears', 'sleepy', 'belly'], 2.2) });
S('dratiny', 147, 'Dratiny', ['dragon'], [41, 64, 45, 50, 50, 50], 'dratini', { cr: 45, rare: 0.4, evo: { to: 'dragonaire', lvl: 30 }, look: L('serpent', ['#7c9fe8', '#f8fafc', '#f8fafc', '#f8fafc'], ['finears'], 1.5) });
S('dragonaire', 148, 'Dragonaire', ['dragon'], [61, 84, 65, 70, 70, 70], 'dratini', { cr: 45, evo: { to: 'dragonbite', lvl: 55 }, look: L('serpent', ['#4a7fe0', '#f8fafc', '#38bdf8', '#f8fafc'], ['finears', 'horn', 'orbs'], 3) });
S('dragonbite', 149, 'Dragonbite', ['dragon', 'flying'], [91, 134, 95, 100, 100, 80], 'dratini', { cr: 45, look: L('dragon', ['#f5a742', '#3f7a5c', '#f8e5b0', '#f8e5b0'], ['antenna', 'tinywings', 'belly'], 2.2) });
S('articool', 144, 'Articool', ['ice', 'flying'], [90, 85, 100, 95, 125, 85], 'articuno', { cr: 3, legend: true, rare: 0.02, look: L('bird', ['#7cc4f0', '#3b82c4', '#e0f2fe', '#bae6fd'], ['beak', 'crest', 'bigwings', 'longtail'], 1.7) });
S('zapdoss', 145, 'Zapdoss', ['electric', 'flying'], [90, 90, 85, 125, 90, 100], 'zapdos', { cr: 3, legend: true, rare: 0.02, look: L('bird', ['#f6d34a', '#111827', '#f59e0b', '#f6d34a'], ['beak', 'spikes', 'bigwings'], 1.6) });
S('moltrez', 146, 'Moltrez', ['fire', 'flying'], [90, 100, 90, 125, 85, 90], 'moltres', { cr: 3, legend: true, rare: 0.02, look: L('bird', ['#f6b23a', '#f97316', '#dc2626', '#f6b23a'], ['beak', 'firemane', 'bigwings'], 1.8) });
S('mewtoo', 150, 'Mew-Too', ['psychic'], [106, 110, 90, 154, 90, 130], 'mewtoo', { cr: 3, legend: true, rare: 0.01, look: L('humanoid', ['#d9d0e8', '#8b5cf6', '#6d28d9', '#c4b5fd'], ['tube', 'longtail', 'pointears'], 1.8) });
S('meww', 151, 'Meww', ['psychic'], [100, 100, 100, 100, 100, 100], 'mew', { cr: 45, legend: true, rare: 0.008, look: L('humanoid', ['#f9c4d8', '#f0a6c0', '#3b82f6', '#fde2ec'], ['longtail', 'pointears', 'floaty'], 0.5) });
S('meowf', 52, 'Meowf', ['normal'], [40, 45, 35, 40, 40, 90], 'meowth', { cr: 255, evo: { to: 'persion', lvl: 28 }, look: L('biped', ['#f3e5c0', '#8b5a2b', '#fbbf24', '#f3e5c0'], ['pointears', 'coin', 'whiskers', 'tailcurl'], 0.5), real: 'That\'s right!' });
S('persion', 53, 'Persion', ['normal'], [65, 70, 60, 65, 65, 115], 'meowth', { cr: 90, look: L('quad', ['#f3e0b0', '#a16207', '#dc2626', '#f3e0b0'], ['pointears', 'gem', 'whiskers', 'longtail'], 1) });
S('scythr', 123, 'Scythr', ['bug', 'flying'], [70, 110, 80, 55, 80, 105], 'scyther', { cr: 45, rare: 0.5, look: L('mantis', ['#7cc46a', '#4a8a3a', '#f8fafc', '#e5e7eb'], ['scythes', 'wings', 'crest'], 1.5) });
S('voltorbe', 100, 'Voltorbe', ['electric'], [40, 30, 50, 55, 55, 100], 'voltorb', { cr: 190, evo: { to: 'electroad', lvl: 30 }, look: L('orb', ['#e11d48', '#f8fafc', '#111827', '#e11d48'], ['pokeball', 'angry'], 0.5) });
S('electroad', 101, 'Electroad', ['electric'], [60, 50, 70, 80, 80, 150], 'voltorb', { cr: 60, look: L('orb', ['#f8fafc', '#e11d48', '#111827', '#f8fafc'], ['pokeball', 'grin'], 1.2) });
S('digglett', 50, 'Digglett', ['ground'], [10, 55, 25, 35, 45, 95], 'diglett', { cr: 255, evo: { to: 'dugtrioh', lvl: 26 }, look: L('mole', ['#8b5a2b', '#f472b6', '#111827', '#8b5a2b'], ['nose'], 0.3) });
S('dugtrioh', 51, 'Dugtrioh', ['ground'], [35, 100, 50, 50, 70, 120], 'diglett', { cr: 50, look: L('mole', ['#7a4a20', '#f472b6', '#111827', '#7a4a20'], ['nose', 'triple'], 0.7) });
S('tentakool', 72, 'Tentakool', ['water', 'poison'], [40, 40, 35, 50, 100, 70], 'tenta', { cr: 190, evo: { to: 'tentakruel', lvl: 30 }, look: L('jelly', ['#7cc4f0', '#e11d48', '#bae6fd', '#7cc4f0'], ['gems2', 'tentacles'], 0.9) });
S('tentakruel', 73, 'Tentakruel', ['water', 'poison'], [80, 70, 65, 80, 120, 100], 'tenta', { cr: 60, look: L('jelly', ['#5aa3dc', '#e11d48', '#bae6fd', '#5aa3dc'], ['gems3', 'tentacles', 'bigtentacles'], 1.6) });
S('togepie', 175, 'Togepie', ['fairy'], [35, 20, 65, 40, 65, 20], 'togepi', { cr: 190, rare: 0.5, evo: { to: 'togetic', lvl: 25 }, look: L('egg', ['#fefce8', '#ef4444', '#3b82f6', '#fde68a'], ['spikes'], 0.3) });
S('togetic', 176, 'Togetic', ['fairy', 'flying'], [55, 40, 85, 80, 105, 40], 'togepi', { cr: 75, look: L('blob', ['#fefce8', '#ef4444', '#3b82f6', '#fefce8'], ['tinywings', 'spikes'], 0.6) });
S('mareap', 179, 'Mareap', ['electric'], [55, 40, 40, 65, 45, 35], 'mareep', { cr: 235, evo: { to: 'flaafy', lvl: 15 }, look: L('quad', ['#f8fafc', '#60a5fa', '#fde047', '#f8fafc'], ['wool', 'tailbolt', 'stripes'], 0.6) });
S('flaafy', 180, 'Flaafy', ['electric'], [70, 55, 55, 80, 60, 45], 'mareep', { cr: 120, evo: { to: 'ampharoz', lvl: 30 }, look: L('biped', ['#f9a8d4', '#f8fafc', '#60a5fa', '#f9a8d4'], ['wool', 'tailorb'], 0.8) });
S('ampharoz', 181, 'Ampharoz', ['electric'], [90, 75, 85, 115, 90, 55], 'mareep', { cr: 45, look: L('biped', ['#fde047', '#f8fafc', '#dc2626', '#fde047'], ['tailorb', 'gem', 'stripes', 'longneck'], 1.4) });
S('woopr', 194, 'Woopr', ['water', 'ground'], [55, 45, 45, 25, 25, 15], 'wooper', { cr: 255, evo: { to: 'quagsir', lvl: 20 }, look: L('biped', ['#7ccfe8', '#3b82c4', '#d946ef', '#7ccfe8'], ['gills', 'dazed'], 0.4) });
S('quagsir', 195, 'Quagsir', ['water', 'ground'], [95, 85, 85, 65, 65, 35], 'wooper', { cr: 90, look: L('biped', ['#5aa3dc', '#3b6fb8', '#93c5fd', '#7cc4f0'], ['gills', 'dazed', 'longtail'], 1.4) });
S('riolew', 447, 'Riolew', ['fighting'], [40, 70, 40, 35, 40, 60], 'riolu', { cr: 75, rare: 0.5, evo: { to: 'lucarioh', lvl: 30 }, look: L('biped', ['#3b6fd1', '#111827', '#fde047', '#fde68a'], ['pointears', 'mask', 'fists'], 0.7) });
S('lucarioh', 448, 'Lucarioh', ['fighting', 'steel'], [70, 110, 70, 115, 70, 90], 'riolu', { cr: 45, look: L('biped', ['#3b6fd1', '#111827', '#e5e7eb', '#fde68a'], ['pointears', 'mask', 'spikes', 'dreads'], 1.2) });
S('giblet', 443, 'Giblet', ['dragon', 'ground'], [58, 70, 45, 40, 45, 42], 'gible', { cr: 45, rare: 0.4, evo: { to: 'gabight', lvl: 24 }, look: L('biped', ['#5a6fa8', '#dc2626', '#fde047', '#dc2626'], ['bigmouth', 'fins', 'fangs'], 0.7) });
S('gabight', 444, 'Gabight', ['dragon', 'ground'], [68, 90, 65, 50, 55, 82], 'gible', { cr: 45, evo: { to: 'garchompers', lvl: 48 }, look: L('biped', ['#4a5f98', '#dc2626', '#fde047', '#dc2626'], ['fins', 'claws', 'fangs'], 1.4) });
S('garchompers', 445, 'Garchompers', ['dragon', 'ground'], [108, 130, 95, 80, 85, 102], 'gible', { cr: 45, look: L('dragon', ['#3f5390', '#dc2626', '#fde047', '#dc2626'], ['fins', 'claws', 'jetwings', 'fangs'], 1.9) });
S('mimikyou', 778, 'Mimikyou', ['ghost', 'fairy'], [55, 90, 80, 50, 105, 96], 'mimikyu', { cr: 45, rare: 0.4, look: L('ghost', ['#f3dc7a', '#111827', '#111827', '#f3dc7a'], ['disguise', 'pointears'], 0.5) });
S('froaky', 656, 'Froaky', ['water'], [41, 56, 40, 62, 44, 71], 'froakie', { cr: 45, rare: 0.5, evo: { to: 'frogadear', lvl: 16 }, look: L('frog', ['#7cc4f0', '#f8fafc', '#f8fafc', '#bae6fd'], ['bubbles'], 0.5) });
S('frogadear', 657, 'Frogadear', ['water'], [54, 63, 52, 83, 56, 97], 'froakie', { cr: 45, evo: { to: 'greninjah', lvl: 36 }, look: L('frog', ['#5aa3dc', '#f8fafc', '#f8fafc', '#bae6fd'], ['bubbles', 'tall'], 0.8) });
S('greninjah', 658, 'Greninjah', ['water', 'dark'], [72, 95, 67, 103, 71, 122], 'froakie', { cr: 45, look: L('frog', ['#2f5fb0', '#111827', '#ec4899', '#93c5fd'], ['tongue', 'tall', 'star'], 1.5) });
S('woolooloo', 831, 'Woolooloo', ['normal'], [42, 40, 55, 40, 45, 48], 'wooloo', { cr: 255, evo: { to: 'dubwoolly', lvl: 24 }, look: L('quad', ['#f8fafc', '#111827', '#e5e7eb', '#f8fafc'], ['wool', 'roundears'], 0.5) });
S('dubwoolly', 832, 'Dubwoolly', ['normal'], [72, 80, 100, 60, 90, 88], 'wooloo', { cr: 127, look: L('quad', ['#f8fafc', '#111827', '#f1eee3', '#f8fafc'], ['wool', 'horns2'], 1.2) });
S('bidoofus', 399, 'Bidoofus', ['normal'], [59, 45, 40, 35, 40, 31], 'bidoof', { cr: 255, evo: { to: 'bibarrel', lvl: 15 }, look: L('quad', ['#b07a45', '#f5deb3', '#f8fafc', '#f5deb3'], ['roundears', 'teeth', 'flattail'], 0.5), real: 'Bidoofus is unbothered. Bidoofus is moisturized.' });
S('bibarrel', 400, 'Bibarrel', ['normal', 'water'], [79, 85, 60, 55, 60, 71], 'bidoof', { cr: 127, look: L('biped', ['#a8743f', '#f5deb3', '#f8fafc', '#f5deb3'], ['roundears', 'teeth', 'flattail'], 1) });
S('raltz', 280, 'Raltz', ['psychic', 'fairy'], [28, 25, 25, 45, 35, 40], 'ralts', { cr: 235, rare: 0.6, evo: { to: 'kirlea', lvl: 20 }, look: L('humanoid', ['#f8fafc', '#4ade80', '#ef4444', '#f8fafc'], ['helmet', 'horn'], 0.4) });
S('kirlea', 281, 'Kirlea', ['psychic', 'fairy'], [38, 35, 35, 65, 55, 50], 'ralts', { cr: 120, evo: { to: 'gardevwar', lvl: 30 }, look: L('humanoid', ['#f8fafc', '#4ade80', '#ef4444', '#f8fafc'], ['tutu', 'horns2'], 0.8) });
S('gardevwar', 282, 'Gardevwar', ['psychic', 'fairy'], [68, 65, 65, 125, 115, 80], 'ralts', { cr: 45, look: L('humanoid', ['#f8fafc', '#4ade80', '#ef4444', '#f8fafc'], ['gown', 'chestspike', 'hairbob'], 1.6) });
S('larvitarr', 246, 'Larvi-tar', ['rock', 'ground'], [50, 64, 50, 45, 50, 41], 'larvitar', { cr: 45, rare: 0.4, evo: { to: 'pupitarr', lvl: 30 }, look: L('biped', ['#9ccf5a', '#4a7a2a', '#dc2626', '#9ccf5a'], ['horn', 'spikes'], 0.6) });
S('pupitarr', 247, 'Pupitarr', ['rock', 'ground'], [70, 84, 70, 65, 70, 51], 'larvitar', { cr: 45, evo: { to: 'tyranitarr', lvl: 55 }, look: L('cocoon', ['#8aa8c8', '#4b5563', '#dc2626', '#8aa8c8'], ['angry'], 1.2) });
S('tyranitarr', 248, 'Tyranitarr', ['rock', 'dark'], [100, 134, 110, 95, 100, 61], 'larvitar', { cr: 45, look: L('dragon', ['#7a9a5a', '#4a6a3a', '#3b82c4', '#a8b8a0'], ['spikes', 'horn', 'belly'], 2) });
S('abzol', 359, 'Abzol', ['dark'], [65, 130, 60, 75, 60, 75], 'absol', { cr: 30, rare: 0.4, look: L('quad', ['#f8fafc', '#1f2937', '#dc2626', '#f8fafc'], ['scythehorn', 'mane'], 1.2) });
S('ponytaH', 1077, 'Galarian Ponytail', ['psychic'], [50, 85, 55, 65, 65, 90], 'ponytaH', { cr: 190, rare: 0.4, look: L('horse', ['#f8fafc', '#f9a8d4', '#a78bfa', '#f8fafc'], ['rainbowmane', 'horn', 'hooves'], 1) });

export const SPECIES = Object.fromEntries(DEX.map((s) => [s.id, s]));
export const SPECIES_IDS = DEX.map((s) => s.id);
export const SPECIES_LIST = DEX.slice().sort((a, b) => a.no - b.no);
export const LEARNSETS = LEARN;
export const learnsetOf = (sp) => LEARN[(typeof sp === 'string' ? SPECIES[sp] : sp).learn] || [];

// Evolution stones and other battle items (also sold in the Poké Mart at the gas station).
export const STONES = { fireStone: 'Fire Stone', waterStone: 'Water Stone', thunderStone: 'Thunder Stone', leafStone: 'Leaf Stone', moonStone: 'Moon Stone' };

// Wild encounter tables: where each species lives.
export const HABITATS = {
  1: ['rattatat', 'pidgee', 'caterpeel', 'weedlr', 'ekanz', 'sandschrew', 'meowf', 'digglett', 'oddysh', 'bidoofus', 'woolooloo', 'pikachew', 'eevie', 'growlith', 'abrah', 'magikrap', 'jigglypuffed', 'zoobat', 'mareap', 'vulpicks'],
  2: ['zoobat', 'jigglypuffed', 'cleffairy', 'psyduct', 'polywag', 'machomp', 'geodud', 'magnamite', 'voltorbe', 'coughing', 'gastlee', 'ponytail', 'slowpok', 'mareap', 'woopr', 'raltz', 'togepie', 'cubonk', 'vulpicks', 'tentakool', 'froaky', 'meowf', 'pidgeoto', 'eevie', 'riolew', 'dittoh', 'ponytaH'],
  3: ['hauntur', 'onyx', 'scythr', 'dratiny', 'larvitarr', 'giblet', 'riolew', 'abzol', 'lapraz', 'mimikyou', 'kadabruh', 'snorelax', 'dittoh', 'golbatt', 'gravelord', 'machoked', 'magnetonne', 'wheezin', 'electroad', 'kirlea', 'flaafy', 'arbokz', 'persion', 'gyarados', 'articool', 'zapdoss', 'moltrez', 'meww', 'mewtoo'],
  nether: ['ponytail', 'growlith', 'vulpicks', 'coughing', 'hauntur', 'abzol', 'larvitarr', 'gastlee', 'magnamite', 'moltrez', 'cubonk'],
};
export const LEVEL_RANGE = { 1: [3, 9], 2: [12, 22], 3: [24, 36], nether: [30, 42], end: [45, 55] };

export const STARTERS = ['bulbasore', 'charmandork', 'squirtul'];
