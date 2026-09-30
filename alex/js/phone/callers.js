// HEARTLINE callers: dialogue, preferences and portraits. Agree / Provoke / Deflect are
// never inherently good or bad — each caller likes different things, and players learn
// their personalities over many runs. A script's `pick(choice, ctx)` returns
// { reply, delta, effect? }. ctx exposes the run (money, stats, rng, relationship).

const A = 'agree', P = 'provoke', D = 'deflect';
const fmt$ = (n) => '$' + Math.floor(n).toLocaleString('en-US');

export const CALLERS = {
  gf: {
    name: 'GIRLFRIEND', color: '#ff4fa3', weight: 3,
    decline: ['oh. okay.', 'ok.', 'seen.', 'you\'re at the concert again aren\'t you', 'call me when you remember I exist', '😐'],
    missed: ['missed call from you: none. missed calls from me: 4.'],
  },
  ugly: {
    name: 'UGLY GIRLFRIEND', color: '#2ec4b6', weight: 2.5,
    decline: ['wow. declined. bold.', 'I\'ll just eat both dinners then.', 'you\'re lucky I think you\'re funny', 'the green soup is getting cold', 'noted. (I am keeping a list.)'],
  },
  cat: {
    name: 'CAMERON\'S CAT', color: '#adb5bd', weight: 2,
    decline: ['mrrp.', '.', '*sent a photo of a knocked-over glass*', 'Mrrrow.', 'hhhhsss'],
  },
  mario: {
    name: 'BABY MARIO', color: '#e63946', weight: 2,
    decline: ['baby mario will remember this', 'BABY.', 'waaaaah', 'baby mario is disappointed but not surprised', 'wahoo? (sad)'],
  },
  demonKing: {
    name: 'THE K-POP DEMON KING', color: '#b5179e', weight: 2,
    decline: ['You dare decline ME?', '...I will be adding this to the statistic.', 'Rude. My followers saw that.', 'I had a whole speech prepared.'],
  },
  jesus: {
    name: 'JESUS CHRIST', color: '#ffd166', weight: 1.5,
    decline: ['I had hoped you would answer.', 'I\'ll try again later, Alex.', 'I\'m still here.', 'Okay.'],
  },
};

// ---------------------------------------------------------------------------
// Scripts. `when(ctx)` gates availability; `weight` biases selection.
// ---------------------------------------------------------------------------
export const SCRIPTS = {
  gf: [
    {
      id: 'money', weight: 6,
      open: (c) => [
        'Can you send me ' + fmt$(c.request) + '?',
        'Babe. Can you send me ' + fmt$(c.request) + '? It\'s for... a thing.',
        'I need ' + fmt$(c.request) + '.',
        fmt$(c.request) + '. Don\'t ask.',
        'Send ' + fmt$(c.request) + '. I\'ll explain later. I won\'t explain later.',
      ][Math.min(4, c.requestIdx)],
      options: { [A]: 'Sending it now.', [P]: 'Get a job.', [D]: 'I think my bank app is haunted.' },
      pick(ch, c) {
        c.advanceRequest();
        if (ch === A) {
          if (c.money >= c.request) { c.pay(c.request); return { reply: 'You\'re the best. ♥', delta: 1 }; }
          const all = c.money;
          c.pay(all);
          return all > 0 ? { reply: 'That\'s... all you have? ' + fmt$(all) + '? Okay.', delta: 0 } : { reply: 'You sent me zero dollars. On purpose?', delta: -1 };
        }
        if (ch === P) return { reply: 'WOW. Okay. WOW.', delta: -2 };
        return c.rng() < 0.4 ? { reply: '...Fine. But you owe me.', delta: 0 } : { reply: 'You said that last time.', delta: -1 };
      },
    },
    {
      id: 'where', weight: 1,
      open: () => 'Alex. Where are you?',
      options: { [A]: 'At the concert. Fighting demons. For you.', [P]: 'Somewhere you\'re not.', [D]: 'Where are YOU?' },
      pick: (ch) => ch === A ? { reply: 'That\'s... weirdly sweet?', delta: 1 } : ch === P ? { reply: 'Cool. Cool cool cool.', delta: -1 } : { reply: 'I asked first.', delta: 0 },
    },
    {
      id: 'eat', weight: 1,
      open: () => 'Did you eat today?',
      options: { [A]: 'I had gas station sushi.', [P]: 'Did YOU?', [D]: 'Define "eat".' },
      pick: (ch) => ch === A ? { reply: 'That\'s not food. But I\'m proud of you.', delta: 1 } : ch === P ? { reply: 'I had a salad and my feelings.', delta: -1 } : { reply: 'Alex.', delta: 0 },
    },
    {
      id: 'kpop', weight: 1,
      open: () => 'Are you at ANOTHER K-pop concert?',
      options: { [A]: '...Yes.', [P]: 'It\'s not "another." It\'s THE one.', [D]: 'What\'s K-pop?' },
      pick: (ch) => ch === A ? { reply: 'At least you\'re honest.', delta: 1 } : ch === P ? { reply: 'That\'s what you said last time.', delta: -1 } : { reply: 'Alex, you own a lightstick katana.', delta: -1 },
    },
    {
      id: 'who', weight: 1,
      open: () => 'Who is "Ugly Girlfriend" in your phone?',
      options: { [A]: '...A coworker.', [P]: 'Who is "Girlfriend" in YOUR phone?', [D]: 'Autocorrect.' },
      pick: (ch) => ch === A ? { reply: 'You don\'t have a job.', delta: 0 } : ch === P ? { reply: '...Touché. I have you saved as "Girlfriend" too.', delta: 1 } : { reply: 'Autocorrect does not write "Ugly."', delta: -1 },
    },
    {
      id: 'gift', weight: 3, when: (c) => c.score >= 3,
      open: () => 'I sent you something. Don\'t make it weird.',
      options: { [A]: 'Thank you. Really.', [P]: 'Is it money? Is it MY money?', [D]: 'Put it on the fridge.' },
      pick(ch, c) {
        c.gift();
        return ch === A ? { reply: 'Okay. Love you. Bye.', delta: 1 } : ch === P ? { reply: 'It was your money, yes. Enjoy.', delta: -1 } : { reply: 'It\'s not a drawing, Alex.', delta: 0 };
      },
    },
  ],
  ugly: [
    {
      id: 'dinner', open: () => 'Hey. I made you dinner. Where are you?',
      options: { [A]: 'I\'ll be home after I slay this demon.', [P]: 'Is it the green soup again?', [D]: 'Who is this?' },
      pick: (ch) => ch === A ? { reply: 'Go get \'em, tiger.', delta: 1 } : ch === P ? { reply: 'The green soup is a DELICACY.', delta: -1 } : { reply: 'You have me saved as "Ugly Girlfriend," Alex. I\'ve seen it.', delta: -2 },
    },
    {
      id: 'real', open: () => 'Be honest. Am I your real girlfriend?',
      options: { [A]: 'Yes.', [P]: 'Define "real."', [D]: 'My phone\'s at 3%.' },
      pick: (ch) => ch === A ? { reply: 'Then why does another one keep calling you?', delta: 1 } : ch === P ? { reply: 'Wrong answer, philosopher.', delta: -1 } : { reply: 'Your phone has been at 3% for four years.', delta: -1 },
    },
    {
      id: 'outfit', open: () => 'Rate my outfit. Sent you a pic.',
      options: { [A]: '10/10. You look amazing.', [P]: '7. The hat is doing a lot.', [D]: 'I can\'t open pics while dodging bullets.' },
      pick: (ch) => ch === A ? { reply: 'I know. But thank you.', delta: 1 } : ch === P ? { reply: 'HA. Correct. The hat is doing a LOT.', delta: 1 } : { reply: 'Valid.', delta: 0 },
    },
    {
      id: 'mom', open: () => 'My mom wants to meet you on Sunday.',
      options: { [A]: 'I\'ll bring flowers.', [P]: 'Is your mom also a demon?', [D]: 'Sunday\'s bad. Demon stuff.' },
      pick: (ch) => ch === A ? { reply: 'She\'s going to love you. Probably.', delta: 1 } : ch === P ? { reply: '...A little bit. Don\'t tell her I said that.', delta: 0 } : { reply: 'Every day is demon stuff with you.', delta: -1 },
    },
    {
      id: 'cooking', open: () => 'I entered us in a couples cooking competition.',
      options: { [A]: 'We\'re gonna win.', [P]: 'Can you even cook?', [D]: 'I\'m allergic to competition.' },
      pick: (ch) => ch === A ? { reply: 'We are NOT going to win. But I love the energy.', delta: 1 } : ch === P ? { reply: 'Oh, you\'re going to find out.', delta: -2 } : { reply: 'You\'re allergic to commitment.', delta: -1 },
    },
    {
      id: 'saved', open: () => 'Who\'s "Girlfriend" in your phone, Alex?',
      options: { [A]: '...My girlfriend.', [P]: 'Who\'s "Alex" in YOUR phone?', [D]: 'Spam caller.' },
      pick: (ch) => ch === A ? { reply: 'And what does that make me?', delta: -2 } : ch === P ? { reply: '..."Ugly Boyfriend." We\'re even.', delta: 1 } : { reply: 'Spam callers don\'t send you $240 requests.', delta: -1 },
    },
  ],
  cat: [
    { id: 'mrrow', open: () => 'Mrrrow.', options: { [A]: 'You\'re absolutely right.', [P]: 'Say that to my face.', [D]: 'Cameron\'s not here.' } },
    { id: 'silence', open: () => '...', options: { [A]: 'I understand.', [P]: 'Speak up.', [D]: 'Wrong number.' } },
    { id: 'crash', open: () => '*distant crash*', options: { [A]: 'Good job.', [P]: 'You\'re paying for that.', [D]: 'That wasn\'t me.' } },
    { id: 'hiss', open: () => 'HHHHHSSSSS', options: { [A]: 'Fair.', [P]: 'HHHHSSSS back.', [D]: 'Is Cameron there?' } },
    { id: 'purr', open: () => '*purring for eleven seconds*', options: { [A]: 'Aw.', [P]: 'Get to the point.', [D]: 'I\'m in a fight right now.' } },
    { id: 'mew', open: () => 'Mew?', options: { [A]: 'Mew.', [P]: 'No.', [D]: 'Ask your dad.' } },
  ],
  mario: [
    { id: 'baby', open: () => 'BABY!', options: { [A]: 'I\'m coming.', [P]: 'Grow up.', [D]: 'Wrong Mario.' } },
    { id: 'star', open: () => 'BABY MARIO NEED BIG STAR', options: { [A]: 'I\'ll find you a star.', [P]: 'Earn it.', [D]: 'Stars are a myth.' } },
    { id: 'yoshi', open: () => 'WHERE IS YOSHI', options: { [A]: 'I\'ll look for him.', [P]: 'Yoshi left.', [D]: 'Who\'s Yoshi?' } },
    { id: 'coin', open: () => 'coin?', options: { [A]: 'Here\'s a coin.', [P]: 'Get your own coin.', [D]: 'I don\'t carry cash.' } },
    { id: 'itsa', open: () => 'it\'s-a me. baby.', options: { [A]: 'It\'s-a you.', [P]: 'Prove it.', [D]: 'New phone, who dis.' } },
    { id: 'waa', open: () => 'WAAAAAAAAAAAAH', options: { [A]: 'Shh, it\'s okay.', [P]: 'Louder.', [D]: 'Is this Luigi?' } },
  ],
  demonKing: [
    { id: 'stat', open: (c) => c.dkLine(), options: (c) => c.dkOptions() },
  ],
  jesus: [
    { id: 'doing', open: () => 'Alex. What are you doing?', options: { [A]: 'My best.', [P]: 'What does it look like?', [D]: 'Can\'t talk. Concert.' },
      pick: (ch) => ch === A ? { reply: 'Good.', delta: 1 } : ch === P ? { reply: '...', delta: -1 } : { reply: 'Alex, I can see you.', delta: 0 } },
    { id: 'eating', open: () => 'Are you eating well?', options: { [A]: 'I\'m trying to.', [P]: 'Are YOU?', [D]: 'Define "well."' },
      pick: (ch) => ch === A ? { reply: 'Good. Share with your neighbour.', delta: 1 } : ch === P ? { reply: 'I once fed five thousand people, Alex.', delta: -1 } : { reply: 'You know what I mean.', delta: 0 } },
    { id: 'mother', open: () => 'Have you called your mother?', options: { [A]: 'I\'ll call her after this.', [P]: 'Have you called YOURS?', [D]: 'Is this about the concert?' },
      pick: (ch) => ch === A ? { reply: 'She would like that.', delta: 1 } : ch === P ? { reply: 'Every day, Alex.', delta: -1 } : { reply: 'It\'s about your mother.', delta: 0 } },
    { id: 'demons', open: () => 'How are the demons?', options: { [A]: 'Numerous.', [P]: 'Easy.', [D]: 'Which demons?' },
      pick: (ch) => ch === A ? { reply: 'Be careful.', delta: 1 } : ch === P ? { reply: 'Pride goes before a fall, Alex.', delta: -1 } : { reply: 'All of them.', delta: 0 } },
    { id: 'two', open: () => 'Two girlfriends, Alex?', options: { [A]: 'It\'s complicated.', [P]: 'At least they call.', [D]: 'Wrong number.' },
      pick: (ch) => ch === A ? { reply: 'It is not that complicated.', delta: 0 } : ch === P ? { reply: 'I call too.', delta: -1 } : { reply: 'Alex. I can see you.', delta: -1 } },
    { id: 'proud', open: () => 'Just checking in. I\'m proud of you.', options: { [A]: 'Thanks. That means a lot.', [P]: 'Proud of what?', [D]: 'Can\'t talk, two hundred projectiles.' },
      pick: (ch) => ch === A ? { reply: 'I mean it.', delta: 1 } : ch === P ? { reply: 'You\'ll see.', delta: 0 } : { reply: 'I know. I counted them.', delta: 0 } },
  ],
};

// Cat: fully functional hearts, zero gameplay consequences. It hates agreement
// (weakness), respects confrontation, and deflection is a coin toss.
export function catReaction(ch, rng) {
  const r = rng();
  if (ch === A) return { reply: rng.pick(['*slow blink*', 'Mrrp.', '*hangs up by stepping on the phone*']), delta: r < 0.7 ? -1 : 0 };
  if (ch === P) return { reply: rng.pick(['Mrrrow!', 'Prrrt.', '*headbutts the phone*']), delta: r < 0.65 ? 1 : 0 };
  return { reply: rng.pick(['...', 'Mew.', 'HSSS']), delta: r < 0.5 ? 1 : -1 };
}

// Baby Mario: his logic is nearly impossible to decipher. (It is: the correct answer
// is decided by how many demons are alive plus the floor number.)
export function marioReaction(ch, ctx) {
  const idx = (ctx.enemiesAlive + ctx.floor) % 3;
  const correct = [A, P, D][idx];
  if (ch === correct) return { reply: ctx.rng.pick(['WAHOO!', 'BABY HAPPY', 'yay baby', 'it\'s-a good']), delta: 1 };
  return { reply: ctx.rng.pick(['WAAAAAAH', 'baby mario will remember this', 'NO', '*throws phone*']), delta: -1 };
}

// Demon King: respects provocation, tolerates agreement, hates being ignored.
export const DK_STATS = {
  kills: { line: (v) => `You have slaughtered ${v} of my followers.`, opts: (v) => ({ [A]: 'Correct.', [P]: `${v + 1}.`, [D]: 'New phone. Who\'s this?' }) },
  moneyCollected: { line: (v) => `You have collected ${fmt$(v)} from the corpses of my followers.`, opts: () => ({ [A]: 'It\'s called a side hustle.', [P]: 'I\'m spending it on YOUR merch.', [D]: 'Money? What money?' }) },
  moneyHeld: { line: (v) => `You are carrying ${fmt$(v)}. I can hear it jingling.`, opts: () => ({ [A]: 'It\'s for the Gas Station.', [P]: 'Want some? Too bad.', [D]: 'That\'s just my keys.' }) },
  timesHit: { line: (v) => `You have been struck ${v} times.`, opts: (v) => ({ [A]: 'It\'s been rough.', [P]: 'And I\'m still coming.', [D]: 'I\'ve been hit zero times. Zero.' }) },
  roomsCleared: { line: (v) => `You have cleared ${v} of my rooms. They were decorated.`, opts: () => ({ [A]: 'They were very nice rooms.', [P]: 'They were tacky.', [D]: 'What rooms?' }) },
  callsDeclined: { line: (v) => `You have declined ${v} calls. Not just mine. I checked.`, opts: () => ({ [A]: 'I\'m bad at phones.', [P]: 'And I\'ll decline more.', [D]: 'My phone is on silent.' }) },
  callsAnswered: { line: (v) => `You have answered ${v} calls during combat. Reckless. I respect it.`, opts: () => ({ [A]: 'Thank you.', [P]: 'I\'m multitasking. On you.', [D]: 'Answering? Me? Never.' }) },
  shotsFired: { line: (v) => `You have fired ${v} shots at my followers.`, opts: () => ({ [A]: 'Yes. Many.', [P]: 'You\'re next.', [D]: 'Those were warning shots.' }) },
  accuracy: { line: (v) => `Your accuracy is ${v}%. My backup dancers are laughing.`, opts: () => ({ [A]: 'I\'m working on it.', [P]: 'Tell them to hold still.', [D]: 'I was aiming for the floor.' }) },
  itemsPurchased: { line: (v) => `You have purchased ${v} items from a gas station. In a war.`, opts: () => ({ [A]: 'The sushi was worth it.', [P]: 'Your venue has no snacks.', [D]: 'Retail therapy.' }) },
  healthRecovered: { line: (v) => `You have recovered ${v} health. Stop healing.`, opts: () => ({ [A]: 'Sorry.', [P]: 'Make me.', [D]: 'It\'s just ketchup.' }) },
  floorTime: { line: (v) => `You have spent ${v} seconds on this floor. My show starts soon.`, opts: () => ({ [A]: 'I\'m hurrying.', [P]: 'Start without me. I dare you.', [D]: 'Time is a construct.' }) },
};
export const DK_BOSS = {
  line: 'You\'re really here. On MY stage.',
  opts: { [A]: 'I came to see you.', [P]: 'Your vocals are pitchy.', [D]: 'Can I call you back? Kinda busy.' },
  pick: (ch) => ch === A ? { reply: '...I\'m flattered, frankly.', delta: 1 } : ch === P ? { reply: 'HOW DARE— ...noted.', delta: 1 } : { reply: 'I am the one you are busy WITH.', delta: -1 },
};
export function dkReaction(ch, rng) {
  if (ch === P) return { reply: rng.pick(['Ha! Bold. I will send more followers.', 'Insolent. I love it. The next room is yours.', 'Excellent. More demons for you.']), delta: 1, room: { threat: 2, money: 1.5, text: 'THE DEMON KING SENT MORE FOLLOWERS (+50% money)' } };
  if (ch === A) return { reply: rng.pick(['I appreciate your honesty.', 'Correct. As always.', 'Hm. Good.']), delta: rng() < 0.5 ? 1 : 0 };
  return { reply: rng.pick(['Do NOT pretend you don\'t know me.', 'I will send a welcome party.', 'New phone? I sent a welcome party.']), delta: -1, room: { extra: ['lurker'], text: 'THE DEMON KING SENT A WELCOME PARTY' } };
}

// ---------------------------------------------------------------------------
// Portraits (drawn on a 2D canvas)
// ---------------------------------------------------------------------------
export function drawPortrait(key, g, s, t = 0) {
  g.save();
  g.clearRect(0, 0, s, s);
  const k = s / 100;
  g.scale(k, k);
  const circle = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  const ell = (x, y, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
  const bg = (a, b) => { const gr = g.createLinearGradient(0, 0, 0, 100); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 100, 100); };
  const blink = Math.sin(t * 1.3) > 0.97;
  const eyes = (y, sep, col = '#222', r = 4) => { if (blink) { g.fillStyle = col; g.fillRect(50 - sep - r, y, r * 2, 1.5); g.fillRect(50 + sep - r, y, r * 2, 1.5); } else { circle(50 - sep, y, r, col); circle(50 + sep, y, r, col); circle(50 - sep + 1.2, y - 1.2, r * 0.35, '#fff'); circle(50 + sep + 1.2, y - 1.2, r * 0.35, '#fff'); } };
  switch (key) {
    case 'gf':
      bg('#ffafcc', '#ff4fa3');
      ell(50, 58, 34, 40, '#5e3023');
      circle(50, 52, 24, '#f3cfae');
      g.fillStyle = '#5e3023'; g.beginPath(); g.arc(50, 42, 26, Math.PI, 0); g.fill();
      eyes(52, 9);
      g.strokeStyle = '#c9184a'; g.lineWidth = 2.5; g.beginPath(); g.arc(50, 62, 6, 0.3, Math.PI - 0.3); g.stroke();
      circle(27, 62, 3, '#ff006e'); circle(73, 62, 3, '#ff006e');
      ell(40, 60, 4, 2, 'rgba(255,100,150,.4)'); ell(60, 60, 4, 2, 'rgba(255,100,150,.4)');
      break;
    case 'ugly':
      bg('#90e0ef', '#2ec4b6');
      circle(50, 25, 12, '#6f1d1b');
      circle(50, 55, 27, '#e0ac69');
      g.fillStyle = '#6f1d1b'; g.beginPath(); g.arc(50, 45, 28, Math.PI, 0); g.fill();
      g.strokeStyle = '#222'; g.lineWidth = 3;
      g.strokeRect(33, 47, 13, 10); g.strokeRect(54, 47, 13, 10); g.beginPath(); g.moveTo(46, 51); g.lineTo(54, 51); g.stroke();
      eyes(52, 10, '#222', 3);
      g.fillStyle = '#222'; g.fillRect(31, 41, 16, 3); g.fillRect(53, 41, 16, 3);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(50, 64, 10, 0, Math.PI); g.fill();
      g.strokeStyle = '#6f1d1b'; g.lineWidth = 2; g.stroke();
      for (const [x, y] of [[38, 60], [41, 62], [62, 60], [59, 62]]) circle(x, y, 1, '#a0522d');
      break;
    case 'cat':
      bg('#495057', '#212529');
      g.fillStyle = '#8d8d8d';
      g.beginPath(); g.moveTo(22, 40); g.lineTo(30, 12); g.lineTo(42, 32); g.fill();
      g.beginPath(); g.moveTo(78, 40); g.lineTo(70, 12); g.lineTo(58, 32); g.fill();
      ell(50, 55, 32, 30, '#9e9e9e');
      g.fillStyle = '#6c6c6c'; for (let i = 0; i < 3; i++) g.fillRect(44 + i * 5, 28, 2, 14);
      ell(37, 50, 8, blink ? 1 : 9, '#c9f29b'); ell(63, 50, 8, blink ? 1 : 9, '#c9f29b');
      if (!blink) { ell(37, 50, 2, 8, '#111'); ell(63, 50, 2, 8, '#111'); }
      g.fillStyle = '#ffafcc'; g.beginPath(); g.moveTo(46, 62); g.lineTo(54, 62); g.lineTo(50, 66); g.fill();
      g.strokeStyle = '#ddd'; g.lineWidth = 1; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(50 + s * 8, 66 + i * 2); g.lineTo(50 + s * 34, 60 + i * 5); g.stroke(); }
      break;
    case 'mario':
      bg('#caf0f8', '#48cae4');
      circle(50, 58, 28, '#f7c59f');
      g.fillStyle = '#e63946'; g.beginPath(); g.arc(50, 45, 29, Math.PI, 0); g.fill();
      g.fillRect(40, 40, 36, 7);
      circle(50, 30, 8, '#fff'); g.fillStyle = '#e63946'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText('B', 50, 34);
      eyes(58, 9, '#1d3557', 5);
      ell(50, 76, 9, 6, '#4cc9f0'); circle(50, 76, 3, '#fff');
      ell(35, 66, 5, 3, 'rgba(255,90,90,.4)'); ell(65, 66, 5, 3, 'rgba(255,90,90,.4)');
      break;
    case 'demonKing':
      bg('#3c096c', '#10002b');
      g.fillStyle = '#240046';
      g.beginPath(); g.moveTo(26, 38); g.lineTo(18, 8); g.lineTo(36, 30); g.fill();
      g.beginPath(); g.moveTo(74, 38); g.lineTo(82, 8); g.lineTo(64, 30); g.fill();
      circle(50, 55, 27, '#e0aaff');
      g.fillStyle = '#10002b'; g.beginPath(); g.arc(50, 48, 28, Math.PI, 0); g.fill();
      g.fillStyle = '#ffd60a'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(30 + i * 10, 24); g.lineTo(35 + i * 10, 12); g.lineTo(40 + i * 10, 24); g.fill(); }
      circle(40, 55, 4.5, '#ff006e'); circle(60, 55, 4.5, '#ff006e');
      g.fillStyle = '#370617'; g.fillRect(40, 67, 20, 3);
      break;
    case 'jesus':
      bg('#fff3b0', '#ffd166');
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.beginPath(); g.ellipse(50, 22, 22, 6, 0, 0, Math.PI * 2); g.stroke();
      ell(50, 58, 30, 38, '#6f4518');
      circle(50, 50, 22, '#e0ac69');
      g.fillStyle = '#6f4518'; g.beginPath(); g.arc(50, 42, 23, Math.PI, 0); g.fill();
      g.beginPath(); g.moveTo(30, 56); g.quadraticCurveTo(50, 92, 70, 56); g.quadraticCurveTo(50, 70, 30, 56); g.fill();
      eyes(50, 8, '#3d2b1f', 3);
      g.strokeStyle = '#3d2b1f'; g.lineWidth = 1.5; g.beginPath(); g.arc(50, 60, 4, 0.2, Math.PI - 0.2); g.stroke();
      break;
    case 'alex':
      bg('#3a0ca3', '#10002b');
      circle(50, 56, 24, '#f3cfae');
      g.fillStyle = '#17121f';
      for (let i = 0; i < 7; i++) { g.beginPath(); const x = 24 + i * 9; g.moveTo(x, 50); g.lineTo(x + 4 + (i % 2) * 2, 18 + (i % 3) * 5); g.lineTo(x + 10, 46); g.fill(); }
      g.beginPath(); g.arc(50, 46, 25, Math.PI, 0); g.fill();
      g.fillStyle = '#ff4fa3'; g.beginPath(); g.moveTo(52, 44); g.lineTo(58, 16); g.lineTo(62, 42); g.fill();
      eyes(57, 9, '#20132e', 4);
      g.strokeStyle = '#6a040f'; g.lineWidth = 2; g.beginPath(); g.moveTo(44, 70); g.lineTo(56, 69); g.stroke();
      g.fillStyle = '#e5383b'; g.fillRect(28, 80, 44, 10);
      break;
  }
  g.restore();
}
export { A as AGREE, P as PROVOKE, D as DEFLECT };
