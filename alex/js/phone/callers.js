// HEARTLINE callers: dialogue, preferences and portraits. Agree / Provoke / Deflect are
// never inherently good or bad — each caller likes different things, and players learn
// their personalities over many runs. A script's `pick(choice, ctx)` returns
// { reply, delta, effect? }. ctx exposes the run (money, stats, rng, relationship).

const A = 'agree', P = 'provoke', D = 'deflect';
const fmt$ = (n) => '$' + Math.floor(n).toLocaleString('en-US');

export const CALLERS = {
  gf: {
    name: 'GIRLFRIEND', color: '#ff4fa3', weight: 3, ring: 'kpop', sub: ['mobile', 'iPhone', 'FaceTime Audio', '♥ bae ♥'],
    decline: ['oh. okay.', 'ok.', 'seen.', 'you\'re at the concert again aren\'t you', 'call me when you remember I exist', '😐'],
    missed: ['missed call from you: none. missed calls from me: 4.'],
  },
  ugly: {
    name: 'UGLY GIRLFRIEND', color: '#2ec4b6', weight: 2.5, ring: 'marimba', sub: ['mobile', 'home', 'kitchen landline'],
    decline: ['wow. declined. bold.', 'I\'ll just eat both dinners then.', 'you\'re lucky I think you\'re funny', 'the green soup is getting cold', 'noted. (I am keeping a list.)'],
  },
  cat: {
    name: 'CAMERON\'S CAT', color: '#adb5bd', weight: 2, ring: 'meow', sub: ['paw-dialed', 'Cameron\'s iPad', 'unknown'],
    decline: ['mrrp.', '.', '*sent a photo of a knocked-over glass*', 'Mrrrow.', 'hhhhsss'],
  },
  mario: {
    name: 'BABY MARIO', color: '#e63946', weight: 2, ring: 'baby', sub: ['toy phone', 'Mushroom Kingdom', 'collect call'],
    decline: ['baby mario will remember this', 'BABY.', 'waaaaah', 'baby mario is disappointed but not surprised', 'wahoo? (sad)'],
  },
  demonKing: {
    name: 'THE K-POP DEMON KING', color: '#b5179e', weight: 2, ring: 'royal', sub: ['No Caller ID', 'THE STAGE', 'Fan Club Hotline'],
    decline: ['You dare decline ME?', '...I will be adding this to the statistic.', 'Rude. My followers saw that.', 'I had a whole speech prepared.'],
  },
  jesus: {
    name: 'JESUS CHRIST', color: '#ffd166', weight: 1.7, ring: 'hymn', sub: ['heaven', 'mobile', 'always available'],
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

export { drawPortrait } from './portraits.js';
export { A as AGREE, P as PROVOKE, D as DEFLECT };

// ---------------------------------------------------------------------------
// Extra scripts in a compact data form: `react[choice] = [[reply, delta], ...]`
// (one is picked at random), `open` / option texts may be arrays of variants, and
// `rift` scripts only appear while a crossover rift is open in the current room.
const R = (...xs) => xs;
const RIFT_LINES = {
  gf: { halo: 'Why are there ALIENS yelling "WORT WORT WORT" in the background?', minecraft: 'Why is there a green thing HISSING at you??', onepiece: 'Why does it smell like the ocean? You hate the ocean.', pokemon: 'Did you just throw a BALL at something?', bible: 'Alex why are there FROGS everywhere.' },
  ugly: { halo: 'Is that a jeep? Can it pick up groceries?', minecraft: 'I\'m building us a house. It\'s made of dirt. Thoughts?', onepiece: 'There\'s a sea monster in the kitchen. Unrelated: dinner is ready.', pokemon: 'I caught a fish. It\'s useless. It just flops. I love him.', bible: 'The locusts ate the green soup. Honestly, good for them.' },
  mario: { halo: 'BABY MARIO WANT RIDE BIG JEEP', minecraft: 'baby mario punch tree', onepiece: 'baby mario stretchy?', pokemon: 'baby mario catch it?', bible: 'FROG. BABY MARIO SAW FROG.' },
  demonKing: { halo: 'Who let the SPARTANS into my venue? This is a K-pop event.', minecraft: 'Why is part of my arena made of BLOCKS now?', onepiece: 'Pirates. In MY venue. Ticketless.', pokemon: 'Stop catching my followers. They are not collectibles.', bible: 'There are PLAGUES in the VIP section. Was this you?' },
  jesus: { halo: 'Alex. Those are not angels. Be careful.', minecraft: 'You know, I was a carpenter. I respect the crafting.', onepiece: 'I walked on water once. You do not have to fight on it.', pokemon: 'Be kind to the creatures, Alex.', bible: 'Alex. That is a plague. I want you to know I did not send it.' },
};
export const MORE_SCRIPTS = {
  gf: [
    { id: 'selfie', open: R('Send me a selfie. Right now.', 'Why haven\'t you posted me in three weeks?', 'Rate my new nails 1–10. Be honest. Don\'t be honest.'),
      options: { [A]: R('Sending it.', 'Posting you right now.', '11/10.'), [P]: R('I\'m in a FIGHT.', 'You post ME first.', '6.'), [D]: R('My camera only does demons now.', 'Front camera\'s broken.', 'What nails?') },
      react: { [A]: [['cute. ♥', 1], ['you look stressed. still cute.', 1]], [P]: [['WOW.', -1], ['blocked. unblocked. still mad.', -1]], [D]: [['...sure.', 0], ['you said that about the back camera.', -1]] } },
    { id: 'anniversary', open: R('Do you know what today is?', 'What day is it, Alex?'),
      options: { [A]: R('Our anniversary. Obviously.', 'The best day. Because of you.'), [P]: R('Tuesday?', 'Concert day.'), [D]: R('National Demon Day?', 'Ask me after this boss.') },
      react: { [A]: [['It\'s NOT. But aww.', 1], ['It IS. You remembered??', 2]], [P]: [['Unbelievable.', -2]], [D]: [['...', -1], ['There is no boss. There is only me.', -1]] } },
    { id: 'rift', when: (c) => c.rift, open: (c) => RIFT_LINES.gf[c.rift],
      options: { [A]: 'It\'s a crossover event, babe.', [P]: 'Don\'t worry about it.', [D]: 'What background?' },
      react: { [A]: [['A WHAT event?', 0], ['okay that\'s actually kind of hot', 1]], [P]: [['I WILL worry about it.', -1]], [D]: [['The background with the MONSTERS, Alex.', -1]] } },
  ],
  ugly: [
    { id: 'recipe', open: R('I\'m making the green soup again. Want the recipe?', 'Guess what\'s for dinner. (It\'s green.)'),
      options: { [A]: R('Yes please. I love the green soup.', 'Make a double batch.'), [P]: R('Is it still green?', 'Can it be ANY other color?'), [D]: R('I\'m allergic to green.', 'I already ate. (I did not eat.)') },
      react: { [A]: [['You\'re a liar and I adore you.', 1]], [P]: [['It\'s greener now. Out of spite.', -1]], [D]: [['You are allergic to EFFORT.', -1], ['I\'m putting you down for two bowls.', 0]] } },
    { id: 'gym', open: R('Spot me at the gym later?', 'I deadlifted a vending machine today.'),
      options: { [A]: R('Always.', 'You\'re so strong.'), [P]: R('Spot ME. I\'m fighting a demon army.', 'I could lift two.'), [D]: R('Gym? Like... Pokémon?', 'I\'ll be busy being cardio.') },
      react: { [A]: [['Bring chalk. And snacks.', 1]], [P]: [['Prove it. Tonight.', 1], ['Ok tough guy.', 0]], [D]: [['No, Alex.', -1]] } },
    { id: 'rift', when: (c) => c.rift, open: (c) => RIFT_LINES.ugly[c.rift],
      options: { [A]: 'That\'s amazing.', [P]: 'That\'s concerning.', [D]: 'I can\'t hear you over the monsters.' },
      react: { [A]: [['I KNOW.', 1]], [P]: [['Everything is concerning with you.', 0]], [D]: [['Rude. Also same.', 0]] } },
  ],
  cat: [
    { id: 'zoomies', open: R('*3 AM zoomies noises*', '*thunderous paws*') , options: { [A]: 'Go off.', [P]: 'Some of us are fighting.', [D]: 'Wrong number, little guy.' } },
    { id: 'gift', open: R('*left a dead lightstick on your pillow*', '*sent a photo of a single bean*'), options: { [A]: 'Thank you. I\'m honored.', [P]: 'Gross.', [D]: 'Is that... mine?' } },
  ],
  mario: [
    { id: 'horse', open: R('baby mario saw horse', 'horse is in the walls'), options: { [A]: 'Stay away from the horse.', [P]: 'Ride the horse.', [D]: 'There is no horse.' } },
    { id: 'rift', when: (c) => c.rift, open: (c) => RIFT_LINES.mario[c.rift], options: { [A]: 'Yes, baby.', [P]: 'No, baby.', [D]: 'Ask your brother.' } },
  ],
  demonKing: [
    { id: 'review', open: R('Rate my venue. Out of ten. Choose wisely.', 'Be honest: is my lighting rig the best you have ever seen?'), options: { [A]: R('Ten.', 'The best.'), [P]: R('Four. The bathrooms are haunted.', 'Mid.'), [D]: R('I haven\'t seen the bathrooms yet.', 'Next question.') } },
    { id: 'rift', when: (c) => c.rift, open: (c) => RIFT_LINES.demonKing[c.rift], options: { [A]: 'I\'ll handle them for you.', [P]: 'They have better merch than you.', [D]: 'Not my crossover.' } },
  ],
  jesus: [
    { id: 'loaves', open: R('Did you share your snacks today?', 'Remember to drink water, Alex.'),
      options: { [A]: R('I gave a demon half my hot dog.', 'I will.'), [P]: R('They\'re MY snacks.', 'Water doesn\'t drop from demons.'), [D]: R('Snacks? In this economy?', 'Can water be energy drinks?') },
      react: { [A]: [['That is kind.', 1]], [P]: [['Alex.', -1]], [D]: [['No.', 0], ['It cannot.', 0]] } },
    { id: 'forgive', open: R('Have you forgiven your girlfriend for the money requests?', 'Have you apologised to Baby Mario?'),
      options: { [A]: R('I\'m working on it.', 'I\'ll call them.'), [P]: R('No.', 'Why should I?'), [D]: R('Which one?', 'Define "apologise."') },
      react: { [A]: [['Good.', 1]], [P]: [['Seventy times seven, Alex.', -1]], [D]: [['You know which one.', 0]] } },
    { id: 'rift', when: (c) => c.rift, open: (c) => RIFT_LINES.jesus[c.rift],
      options: { [A]: 'Thank you for telling me.', [P]: 'Then who did?', [D]: 'Can you make it stop?' },
      react: { [A]: [['Be well.', 1]], [P]: [['Read Exodus.', 0]], [D]: [['You are doing fine.', 1], ['That is not how this works, Alex.', 0]] } },
  ],
};

// Caller moods, rolled per call and shown on the phone. They bend the outcome a little.
export const MOODS = {
  normal: { w: 5, emoji: '', label: '' },
  happy: { w: 2, emoji: '😊', label: 'good mood' },
  grumpy: { w: 2, emoji: '😤', label: 'grumpy' },
  chaotic: { w: 1, emoji: '🌀', label: 'chaotic' },
  sleepy: { w: 1, emoji: '😴', label: 'sleepy' },
};
export function moodDelta(mood, delta, rng) {
  if (mood === 'happy') return delta > 0 ? delta + 1 : delta < 0 && rng() < 0.5 ? 0 : delta;
  if (mood === 'grumpy') return delta < 0 ? delta - 1 : delta > 0 && rng() < 0.4 ? 0 : delta;
  if (mood === 'chaotic') return rng() < 0.35 ? -delta || (rng() < 0.5 ? 1 : -1) : delta;
  if (mood === 'sleepy') return Math.trunc(delta / 2) || (delta && rng() < 0.5 ? Math.sign(delta) : 0);
  return delta;
}

// Spontaneous texts between calls: [text, effect?]. Effects are small and generous.
export const TEXTS = {
  gf: [['where r u', null], ['ur not answering ur phone', null], ['sent u $5 for snacks. don\'t say I never do anything', 'money5'], ['🥺', null], ['k', null], ['did u see my story', null]],
  ugly: [['made extra. it\'s in a container labeled ALEX DO NOT SHARE', 'heal10'], ['the soup is thriving', null], ['call me when ur done being a hero', null], ['📸 [a photo of green soup]', null]],
  cat: [['📸 [photo of a knocked-over glass]', null], ['mrrp', null], ['.', null], ['📸 [the cat, on your keyboard: "jjjjjjjjjjjjjjj"]', null]],
  mario: [['coin', 'money1'], ['BABY', null], ['horse?', null], ['wahoo', null]],
  demonKing: [['My followers are watching you. Smile.', null], ['Your posture during combat is atrocious.', null], ['Ticket sales are up. Thank you for the publicity.', null]],
  jesus: [['"Be strong and of a good courage." Joshua 1:9', 'heal5'], ['I\'m proud of you.', null], ['Drink some water.', 'heal5']],
};
