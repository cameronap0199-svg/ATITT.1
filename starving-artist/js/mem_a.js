// Memories 1-3: Moving Day, Open Mic, Fever.
import * as THREE from 'three';
import * as P from './props.js';
import { GridBuilder } from './level.js';
import { World } from './world.js';
import { tex, textTex } from './tex.js';
import { audio } from './audio.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const PEOPLE = {
  dad: { skin: '#d8a080', hair: '#4a4a4a', shirt: 0x5a7a5a, pants: 0x3a3a4a, height: 1.8 },
  mom: { skin: '#d8a080', hair: '#5a3a2a', shirt: 0xd87a8a, pants: 0x4a4a6a, height: 1.62, hairLong: true },
  teo: { skin: '#d8a080', hair: '#2a1a12', shirt: 0xf0c040, pants: 0x4a5a8a, height: 1.45 },
  priya: { skin: '#b07a52', hair: '#1a1212', shirt: 0x9a5ab8, pants: 0x2a2a3a, height: 1.66, hairLong: true },
};

// ------------------------------------------------------------------ shared apartment
export function apartment(ctx, variant) {
  const B = new GridBuilder(12, 8);
  B.room(1, 1, 6, 4, 'm');
  B.room(7, 1, 1, 1, 't'); B.room(8, 1, 2, 2, 't');
  B.voidc(1, 5, 6, 1);
  const V = {
    moving: { amb: [0.5, 0.42, 0.36], tint: [1.05, 1, 0.95], win: 0xffa860, wi: 1.4, sky: 'skyDusk', lamp: 0.5 },
    fever: { amb: [0.24, 0.27, 0.24], tint: [0.92, 1, 0.86], win: 0x8090b0, wi: 0.7, sky: 'skyNight', lamp: 0.35 },
    commission: { amb: [0.4, 0.33, 0.37], tint: [1.05, 0.95, 1], win: 0xffd0e0, wi: 1.0, sky: 'skyDay', lamp: 0.45 },
  }[variant];
  const regions = {
    default: { floor: 'wood', wall: 'wallpaperCream', ceil: 'plaster', h: 3, ambient: V.amb },
    m: { floor: 'wood', wall: variant === 'fever' ? 'wallpaperRot' : 'wallpaperCream', ceil: 'plaster', h: 3, ambient: V.amb, tint: V.tint, surface: 'wood', edge: 'wood' },
    t: { floor: 'whiteTile', wall: 'whiteTile', ceil: 'plaster', h: 3, ambient: V.amb.map((x) => x * 0.9), surface: 'tile' },
  };
  const lights = [
    { x: 8, y: 2, z: 3.2, color: V.win, intensity: V.wi, range: 10 },
    { x: 9, y: 2.8, z: 7, color: 0xffe0b0, intensity: V.lamp, range: 8 },
    { x: 17.5, y: 2.6, z: 4, color: 0xfff0e0, intensity: 0.6, range: 5 },
  ];
  const world = new World(ctx.game, { builder: B, regions, lights, sky: 'skyWhite', seed: 3 + ctx.k });
  ctx.world = world;
  world.onWall(P.windowQuad(2.6, 1.6, V.sky), 3, 1, 'n', 1.7, { along: 1, bake: false });
  world.shafts = [{ x: 8, z: 3.4, w: 2.4, h: 4.6, color: V.win, op: variant === 'fever' ? 0.05 : 0.16, tx: -0.62 }];
  world.onWall(P.doorMesh(1.0, 2.2, 0xe8e0d6), 6, 3, 'e', 0);
  world.prop(P.counter(3.6, true), 5, 1, { dx: 1, dz: -0.55, collide: 0.02 });
  world.prop(P.fridge(), 6, 2, { dx: 0.55, ry: -Math.PI / 2, collide: 0.02 });
  world.prop(P.bed(variant === 'fever' ? 0x9aa890 : 0xe7a8c0), 1, 3, { dx: -0.3, dz: 0.5, collide: 0.02 });
  world.prop(P.couch(variant === 'commission' ? 0xb56b8f : 0x6b7fb5), 3, 4, { dz: 0.4, ry: Math.PI, collide: 0.02 });
  world.prop(P.plant(variant === 'fever' ? 0.7 : 0.1), 6, 4, { dx: 0.4, dz: 0.4, collide: 0.02 });
  world.prop(P.lamp(true), 1, 4, { dx: -0.5, dz: 0.2 });
  const rug = P.plane(3, 2, 0xd8a0b0, 'fabricPink'); rug.rotation.x = -Math.PI / 2; world.prop(rug, 3, 3, { dx: 1, y: 0.01 });
  // bathroom
  world.onWall(P.mirror(0.7, 0.9), 9, 1, 'n', 1.6);
  world.prop(P.counter(1.0, true), 9, 1, { dz: -0.6, collide: 0.02 });
  world.onWall(P.windowQuad(1.0, 0.8, V.sky), 1, 2, 'w', 1.9, { bake: false });
  return world;
}

// ================================================================== 1. MOVING DAY
const M1 = {
  intro: ['August. The apartment smelled like somebody else\'s paint.', 'Dad drove three hours with everything she owned in the back of his truck.', 'Four hundred square feet. All of it hers.'],
  steps: {
    create: [{ id: 'c1', label: 'Unfold the easel by the window' }, { id: 'c2', label: 'Paint the view from the window' }],
    bond: [{ id: 'b1', label: 'Talk to Dad' }, { id: 'b2', label: 'Call Mom' }],
    duty: [{ id: 'd1', label: 'Unpack the kitchen boxes', count: 3 }, { id: 'd2', label: 'Stock the fridge' }, { id: 'd3', label: 'Set an alarm for your first shift' }],
  },
  build(ctx) {
    const world = apartment(ctx, 'moving');
    const E = ctx.easel(2, 1, { dz: 0.4, ry: 0.35, covered: true });
    ctx.task({ obj: E.easel, offsetY: 1.2, r: 0.8, step: 'c1', prompt: 'Unfold the easel',
      idle: { prompt: 'Easel', lines: ['Her old easel. Still spattered from high school.'] },
      neglect: { prompt: 'Easel (not today)', line: 'Not today. There\'s too much to do.' },
      use: async () => { E.sheet.visible = false; audio.play('door'); await ctx.think('She set it up facing the window. The light was doing something golden and temporary.'); } });
    ctx.task({ obj: E.easel, offsetY: 1.2, r: 0.8, step: 'c2', prompt: 'Paint the view',
      after: { prompt: 'Look at your painting', lines: ['The first thing she ever made in a room of her own.'] },
      use: async () => { const c = await ctx.paint(); E.show(c); } });

    const dad = ctx.npc(PEOPLE.dad, 4, 2, { ry: -2.4, dx: 0.3 });
    world.prop(P.cardboardBox(0.6, true), 4, 3, { dx: 0.6, collide: 0.02 });
    ctx.task({ obj: dad, offsetY: 1.5, r: 0.6, step: 'b1', prompt: 'Talk to Dad',
      idle: { prompt: 'Dad', lines: ['Dad, pretending he isn\'t out of breath from the stairs.'] },
      neglect: { prompt: 'Dad (not now)', line: '"In a minute, Dad." She said that a lot, that day.' },
      after: { prompt: 'Dad', lines: ['"Go on, kiddo. I\'m just admiring your water stain. Very artistic."'] },
      use: () => ctx.talk(dad, async () => {
        await ctx.say('Dad', 'That\'s the last of it. Your whole life fit in the truck bed, huh.');
        const a = await ctx.choose(['It\'s a small life. For now.', 'Thanks for driving all this way.', 'You didn\'t have to help, you know.']);
        await ctx.say('Dad', ['Small\'s good. Small\'s easy to carry.', 'Three hours is nothing. I\'d drive thirty.', 'Sure I did. That\'s the job.'][a]);
        await ctx.say('Dad', 'Your mother packed you a cooler. Tamales. Eat them before they go bad, okay? Not just coffee.');
        await ctx.say('Nate', 'I will.');
        await ctx.say('Dad', '...You\'ll call, right? Sundays?');
        const b = await ctx.choose(['Every Sunday.', 'When I can.']);
        ctx.rel('dad', b === 0 ? 2 : 0);
        await ctx.say('Dad', b === 0 ? 'Every Sunday. I\'m holding you to that.' : 'When you can. Okay. That\'s okay.');
        await ctx.say('Dad', 'Here. My old toolbox. Every apartment\'s got one drawer that sticks.');
        world.prop(P.toolbox(), 4, 3, { dx: -0.4, dz: 0.3 });
        audio.play('place');
      }) });

    const phone = P.cellphone(); world.prop(phone, 5, 1, { y: 0.96, dz: -0.4, bake: false });
    ctx.task({ obj: phone, r: 0.45, step: 'b2', prompt: 'Call Mom',
      idle: { prompt: 'Phone', lines: ['4% battery. Of course.'] },
      neglect: { prompt: 'Phone (later)', line: 'She\'d call tomorrow. Mom would understand.' },
      use: async () => {
        audio.play('phone');
        await wait(1300);
        await ctx.say('Mom', 'Mija! Is it nice? Does it get light?');
        await ctx.say('Nate', 'It gets so much light, Mom. The window faces west.');
        await ctx.say('Mom', 'Good. An artist needs a window. And a kitchen. Are you eating?');
        const a = await ctx.choose(['I\'m eating, Mom.', 'Dad brought the tamales. I\'ll eat them tonight.']);
        ctx.rel('mom', 1);
        await ctx.say('Mom', a === 0 ? 'Mm. You said that at Easter too.' : 'Good. Heat them in a pan, not the microwave, they get sad.');
        await ctx.say('Mom', 'Tell your father to drive safe. And Natalee—');
        await ctx.say('Mom', 'I\'m proud of you. Even if it\'s scary. Especially if it\'s scary.');
        await ctx.think('Nobody calls her Natalee but Mom.');
      } });

    const boxLines = ['Plates. Mugs. A colander she has never once used.', 'Spices Mom labelled in Sharpie: "USE THESE."', 'Silverware, wrapped in the funny pages. Dad\'s idea.'];
    [[5, 2, 0.2, 0], [6, 3, -0.3, -0.2], [5, 3, 0.4, 0.3]].forEach(([i, j, dx, dz], n) => {
      const b = P.cardboardBox(0.55); world.prop(b, i, j, { dx, dz, collide: 0.02 });
      const it = ctx.task({ obj: b, offsetY: 0.3, r: 0.5, step: 'd1', prompt: 'Unpack the box',
        idle: { prompt: 'Box labelled KITCHEN', lines: ['KITCHEN, in Mom\'s handwriting.'] },
        neglect: { prompt: 'Kitchen box (later)', line: 'Later. Boxes can be furniture.' },
        use: async () => { audio.play('remove'); world.remove(b); world.removeInteract(it); await ctx.think(boxLines[n]); } });
    });
    ctx.task({ pos: world.at(6, 2, 0.3, 0).setY(1.2), r: 0.7, step: 'd2', prompt: 'Stock the fridge',
      idle: { prompt: 'Fridge', lines: ['It hums like it\'s thinking about something.'] },
      later: 'Fridge (unpack first)', laterLine: 'Unpack the kitchen first.',
      neglect: { prompt: 'Fridge', line: 'Empty. It would stay that way a while.' },
      use: async () => { audio.play('door'); await ctx.think('Tamales, eggs, oat milk, and a single sad lemon. A real adult fridge.'); } });
    const clock = P.box(0.18, 0.12, 0.08, 0xe86a7a, null, { emissive: 0.4 });
    world.prop(clock, 1, 2, { dx: -0.4, dz: 0.3, y: 0.55 });
    world.prop(P.cardboardBox(0.5), 1, 2, { dx: -0.4, dz: 0.3, collide: 0.02 });
    ctx.task({ obj: clock, r: 0.4, step: 'd3', prompt: 'Set the alarm for 5:30 AM',
      later: 'Alarm clock', laterLine: 'Kitchen first. Then the fridge. Then the alarm. One thing at a time.',
      idle: { prompt: 'Alarm clock', lines: ['It is blinking 12:00. It always will.'] },
      neglect: { prompt: 'Alarm clock', line: 'She\'d wake up on her own. Probably.' },
      use: async () => { audio.play('blip', { freq: 880 }); audio.play('blip', { freq: 880 }); await ctx.think('5:30 AM. First shift at the Daily Grind. She set a second alarm, just in case.'); } });

    ctx.inspect({ pos: world.at(3, 1, 1, -0.9).setY(1.7), r: 1.2, prompt: 'Look out the window', lines: ['The city at golden hour. Across the street, someone on a fire escape is watering tomatoes.', 'She wanted to paint every single thing she could see.'] });
    ctx.inspect({ pos: world.at(9, 1, 0, -0.9).setY(1.6), r: 0.5, prompt: 'Mirror', lines: ['Twenty, and tired, and happy. She looks like her mother when she smiles.'] });
    ctx.inspect({ pos: world.at(1, 3, -0.3, 0.5).setY(0.5), r: 0.9, prompt: 'Bed', lines: ['The mattress is still in its plastic. It crinkles like a secret.'] });
    return { world, spawn: { pos: world.at(3, 3, 1, 0), yaw: 0.2 } };
  },
  onNeglect: async (ctx, which) => {
    if (which === 'bond') {
      const dad = ctx.npcs[0];
      await ctx.say('Dad', 'Well. I\'ll let you get to it, kiddo.');
      dad.visible = false; audio.play('door');
      await wait(900); audio.play('phone');
      await ctx.think('Missed call: Mom.');
    } else if (which === 'duty') await ctx.think('The boxes stayed boxes. Dinner was dry cereal out of a mug.');
    else await ctx.think('She leaned the folded easel back against the wall. Tomorrow. Or the day after.');
  },
};

// ================================================================== 2. OPEN MIC
const M2 = {
  intro: ['October. Nine months of 5:30 alarms and burnt espresso.', 'Dale said she could hang one painting for open mic night. One.', 'It was also Teo\'s thirteenth birthday. Mom drove him in to surprise her.'],
  steps: {
    create: [{ id: 'c1', label: 'Paint "something that feels like home" (back room)' }, { id: 'c2', label: 'Hang it on the art wall' }],
    bond: [{ id: 'b1', label: 'Sit with Mom and Teo' }, { id: 'b2', label: 'Get Teo\'s present from your bag (back room)' }, { id: 'b3', label: 'Give Teo his present' }],
    duty: [{ id: 'd1', label: 'Make and serve orders', count: 3 }],
  },
  build(ctx) {
    const B = new GridBuilder(12, 12);
    B.room(1, 1, 9, 6, 'cf');
    B.room(2, 7, 1, 1, 'bk'); B.room(1, 8, 3, 2, 'bk');
    const regions = {
      default: { floor: 'checkerBW', wall: 'brick', ceil: 'wood', h: 3.5, ambient: [0.36, 0.3, 0.26] },
      cf: { floor: 'checkerBW', wall: 'brick', ceil: 'woodDark', h: 3.5, ambient: [0.36, 0.3, 0.26], surface: 'tile' },
      bk: { floor: 'concrete', wall: 'plaster', ceil: 'plaster', h: 3, ambient: [0.25, 0.24, 0.24], surface: 'hard' },
    };
    const lights = [
      { x: 5, y: 3, z: 9, color: 0xffc080, intensity: 0.9, range: 7 }, { x: 15, y: 3, z: 9, color: 0xffc080, intensity: 0.9, range: 7 },
      { x: 9, y: 3, z: 12, color: 0xffb070, intensity: 0.8, range: 7 }, { x: 12, y: 3, z: 3, color: 0xffe0b0, intensity: 1, range: 8 },
      { x: 18, y: 3, z: 5, color: 0xff90b0, intensity: 0.7, range: 6 }, { x: 4, y: 2.6, z: 18, color: 0xfff0d0, intensity: 0.8, range: 6 },
    ];
    const world = new World(ctx.game, { builder: B, regions, lights, sky: 'skyNight', seed: 21 });
    ctx.world = world;
    world.prop(P.counter(5), 5, 2, { dz: -0.2, collide: 0.02 });
    const mach = P.espresso(); world.prop(mach, 6, 2, { dz: -0.2, y: 0.95 });
    world.onWall(P.windowQuad(1.8, 1.4, 'skyNight'), 9, 3, 'e', 1.7, { bake: false });
    world.onWall(P.windowQuad(1.8, 1.4, 'skyNight'), 9, 5, 'e', 1.7, { bake: false });
    world.shafts = [{ x: 9, z: 9, w: 1.6, h: 3.4, color: 0xffc080, op: 0.12 }, { x: 15, z: 9, w: 1.6, h: 3.4, color: 0xffc080, op: 0.12 }, { x: 9, z: 12, w: 1.4, h: 3.4, color: 0xffb070, op: 0.1 }];
    world.onWall(P.uniquePlane(2.4, 0.5, textTex('THE DAILY GRIND', { w: 128, h: 26, color: '#ffd8a0', bg: '#2a1810', size: 18 }), { emissive: 1 }), 5, 1, 'n', 2.8);
    for (let i = 0; i < 16; i++) { const s = P.sphere(0.05, [0xffd24a, 0xf6a6c1, 0x9ad0f5][i % 3], 4, null, { emissive: 1 }); s.userData.noBake = true; world.prop(s, 1, 1, { pos: new THREE.Vector3(2.5 + i * 1.0, 3.1 + Math.sin(i) * 0.12, 2.2), bake: false }); }
    for (const [i, j] of [[2, 4], [8, 4], [6, 6], [4, 5]]) { world.prop(P.table(1.0, 1.0, 0x6a4a34), i, j, { collide: 0.02 }); }
    world.prop(P.cup(), 2, 4, { y: 0.8, dx: 0.2 }); world.prop(P.laptop(), 8, 4, { y: 0.79 });
    const mic = new THREE.Group(); mic.add(P.at(P.cyl(0.02, 0.02, 1.5, 4, 0x222222), 0, 0.75, 0), P.at(P.sphere(0.06, 0x333333, 5), 0, 1.52, 0), P.at(P.cyl(0.2, 0.2, 0.03, 6, 0x222222), 0, 0.02, 0));
    world.prop(mic, 9, 2, { dx: -0.2 });
    // Art wall
    const wallSign = P.uniquePlane(1.6, 0.35, textTex('ART WALL · YOUR WORK HERE', { w: 128, h: 20, color: '#2a1a10', bg: '#f0e0c0', size: 13 }), { emissive: 0.6 });
    world.onWall(wallSign, 1, 3, 'w', 2.9);
    const hang = P.frame(1.3, 1.0, tex('canvasBlank'), { frameColor: 0x2a2020, emissiveAmt: 0.2 }); world.onWall(hang, 1, 3, 'w', 1.8);
    // Back room
    world.prop(P.cardboardBox(0.6), 3, 9, { dx: 0.3, collide: 0.02 }); world.prop(P.cardboardBox(0.5), 3, 8, { dx: 0.4, collide: 0.02 });
    const E = ctx.easel(1, 9, { ry: Math.PI * 0.75, dx: 0.2 });
    const bag = P.box(0.35, 0.4, 0.2, 0x4a6ab0); world.prop(bag, 3, 9, { dx: -0.3, dz: 0.5, y: 0 });

    const dale = ctx.npc({ skin: '#e0b090', hair: '#8a7a6a', shirt: 0x2a3a2a, pants: 0x2a2a2a, height: 1.82 }, 4, 1, { ry: 0, dz: 0.2 });
    ctx.inspect({ obj: dale, offsetY: 1.5, r: 0.6, prompt: 'Dale', lines: (c) => [c.isPicked('duty') ? 'Dale: "Marcy called out. You\'re on the bar tonight, superstar."' : 'Dale: "If you\'re off the clock, get off my counter. Kidding. Mostly."'] });

    // Duty: drinks
    const orders = [
      { who: { skin: '#f0c8a8', hair: '#c8a060', shirt: 0xe89a6a, height: 1.68, hairLong: true }, at: [2, 5, Math.PI], ask: 'Oat latte, extra hot. Thank you, sweetheart.', thanks: 'Oh, that\'s perfect. You\'re perfect.' },
      { who: { skin: '#a07050', hair: '#1a1a1a', shirt: 0x3a5a8a, height: 1.76 }, at: [8, 5, Math.PI], ask: 'Americano. And is the wifi still "beanthere"?', thanks: 'Legend. Thanks.' },
      { who: { skin: '#e8d0c0', hair: '#e8e8e8', shirt: 0x9a7ab0, height: 1.55, hairLong: true }, at: [7, 6, -Math.PI / 2], ask: 'Chamomile? Oh—only coffee. Then surprise me, dear.', thanks: 'A cortado! How exciting. Thank you, dear.' },
    ];
    const cup = P.cup(); cup.visible = false; world.scene.add(cup);
    ctx.task({ obj: mach, offsetY: 0.3, r: 0.5, step: 'd1', manual: true, prompt: () => (ctx.holding ? 'Holding a drink' : 'Make a drink'),
      idle: { prompt: 'Espresso machine', lines: ['It screams like a kettle having a panic attack.'] },
      neglect: { prompt: 'Espresso machine', line: 'Not her shift. Not her problem. (It was her problem.)' },
      use: async () => {
        if (ctx.holding) { await ctx.think('Serve this one first.'); return; }
        audio.play('steam'); await wait(900); audio.play('pour');
        ctx.holding = true; ctx.game.ui.toast('Carrying a drink', 1600);
      } });
    orders.forEach((o) => {
      const npc = ctx.npc(o.who, o.at[0], o.at[1], { ry: o.at[2] });
      o.npc = npc;
      ctx.task({ obj: npc, offsetY: 1.4, r: 0.6, step: 'd1', manual: true, cond: () => !o.served,
        prompt: () => (ctx.holding ? 'Serve the drink' : 'Take the order'),
        idle: { prompt: 'Customer', lines: ['Waiting. Checking the time. Checking the counter.'] },
        neglect: { prompt: 'Customer (waiting)', line: '"Excuse me? Is anyone working?"' },
        use: () => ctx.talk(npc, async () => {
          if (!ctx.holding) { await ctx.say('Customer', o.ask); return; }
          ctx.holding = false; o.served = true;
          const c = P.cup(); world.prop(c, o.at[0], o.at[1], { pos: npc.position.clone().add(new THREE.Vector3(0, 0.8, 0)).addScaledVector(new THREE.Vector3(Math.sin(o.at[2]), 0, Math.cos(o.at[2])), 0.7), bake: false });
          await ctx.say('Customer', o.thanks);
          ctx.done('d1');
        }) });
    });

    // Bond: Mom and Teo
    const mom = ctx.npc(PEOPLE.mom, 3, 5, { ry: Math.PI / 2, dx: 0.2 });
    const teo = ctx.npc(PEOPLE.teo, 4, 6, { ry: Math.PI, dz: -0.2 });
    world.prop(P.cake(), 4, 5, { y: 0.78 });
    ctx.task({ obj: teo, offsetY: 1.2, r: 0.7, step: 'b1', prompt: 'Sit with Mom and Teo',
      idle: { prompt: 'Teo', lines: ['Teo, thirteen today, pretending he is too cool to wave. He waves.'] },
      neglect: { prompt: 'Mom and Teo (waiting)', line: '"I\'ll be over in a minute!" It was a long minute.' },
      use: () => ctx.talk(teo, async () => {
        await ctx.say('Teo', 'Nate! Mom said you\'d be too busy but I SAID you\'d make time.');
        await ctx.say('Mom', 'Thirteen, and he wanted to spend his birthday in a coffee shop with his sister. Explain that.');
        const a = await ctx.choose(['Happy birthday, little man.', 'Thirteen? You\'re basically a senior citizen.']);
        await ctx.say('Teo', a === 0 ? 'I\'m not little. I\'m five-two.' : 'I\'m WISE. There\'s a difference.');
        await ctx.say('Teo', 'I\'ve been drawing every day. Like you. I\'m gonna be an artist too.');
        const b = await ctx.choose(['You\'ll be better than me.', 'Maybe have a backup plan.', 'Draw every day. That\'s the whole secret.']);
        if (b === 1) { await ctx.say('Mom', 'Natalee.'); await ctx.say('Teo', '...Okay.'); ctx.rel('teo', -1); }
        else { await ctx.say('Teo', b === 0 ? 'Obviously.' : 'Every day. Got it.'); ctx.rel('teo', 2); }
        await ctx.say('Mom', 'You look tired, mija.');
        const c = await ctx.choose(['I\'m fine. Just busy.', 'I am tired. It\'s a good tired.']);
        await ctx.say('Mom', c === 0 ? 'Busy. Mm-hm. Your father says "busy" too.' : 'Good tired I can live with. Bad tired, you call me.');
        ctx.rel('mom', 1);
      }) });
    ctx.task({ obj: bag, offsetY: 0.3, r: 0.5, step: 'b2', prompt: 'Take Teo\'s present',
      idle: { prompt: 'Your bag', lines: ['Keys, receipts, three pens, one granola bar from a previous life.'] },
      neglect: { prompt: 'Your bag', line: 'She\'d give it to him next time.' },
      use: async () => { audio.play('pickup'); await ctx.think('Her old sketchbook. Half full. On the first blank page she wrote: "For the next great one."'); } });
    ctx.task({ obj: teo, offsetY: 1.2, r: 0.7, step: 'b3', prompt: 'Give Teo his present',
      use: () => ctx.talk(teo, async () => {
        await ctx.say('Teo', 'Your OLD sketchbook? The one with the—');
        await ctx.say('Teo', '...There\'s a note.');
        await ctx.say('Teo', 'I\'m gonna fill the whole thing. Every page.');
        await ctx.say('Mom', 'Okay, okay. Nobody cry in the coffee shop.');
        ctx.setFace(teo, 'happy'); ctx.setFace(mom, 'happy'); ctx.rel('teo', 2);
      }) });

    // Create: paint in the back room, hang on the wall
    ctx.task({ obj: E.easel, offsetY: 1.2, r: 0.8, step: 'c1', prompt: 'Paint "something that feels like home"',
      idle: { prompt: 'Easel', lines: ['Dale lets her keep it back here, next to the mop bucket. Glamour.'] },
      neglect: { prompt: 'Easel', line: 'Not tonight. There\'s no time tonight.' },
      after: { prompt: 'Your painting', lines: ['It\'s drying. It\'s good. It\'s hers.'] },
      use: async () => { const c = await ctx.paint(); E.show(c); } });
    ctx.task({ obj: hang, r: 0.9, step: 'c2', prompt: 'Hang your painting',
      idle: { prompt: 'The art wall', lines: ['One nail. Room for one painting.'] },
      neglect: { prompt: 'The art wall', line: 'Empty. Someone else will fill it.' },
      use: async () => { hang.userData.pic.material.uniforms.map.value = E.tex; audio.play('place'); await ctx.think('Three people looked at it. One of them took a picture. She floated for a week.'); } });
    ctx.inspect({ obj: mic, offsetY: 1.4, r: 0.5, prompt: 'Microphone', lines: ['Open mic starts at nine. A boy with a ukulele is already terrified.'] });
    return { world, spawn: { pos: world.at(5, 4), yaw: 0 }, mood: { ambient: ['murmur', 'crackle'] } };
  },
  onNeglect: async (ctx, which) => {
    const [dale, , , , mom, teo] = ctx.npcs;
    if (which === 'bond') {
      await ctx.say('Mom', 'We\'ll let you work, mija. Happy birthday from your sister, Teo.');
      mom.visible = false; teo.visible = false; audio.play('door');
      await ctx.think('Teo left a drawing on the table. It was her. He gave her a halo.');
    } else if (which === 'duty') await ctx.say('Dale', 'Nate. We talked about this.');
    else await ctx.think('At closing, Dale hung Marcy\'s watercolor of a duck on the art wall.');
    void dale;
  },
};

// ================================================================== 3. FEVER
const M3 = {
  intro: ['February. The fever came on a Tuesday and didn\'t leave.', 'She had missed two shifts. The canvases kept looking at her.', 'Everything was slightly too far away, and breathing.'],
  steps: {
    create: [{ id: 'c1', label: 'Paint what the fever shows you' }],
    bond: [{ id: 'b1', label: 'Answer Priya\'s texts' }, { id: 'b2', label: 'Let Priya in' }, { id: 'b3', label: 'Watch a movie on the couch' }],
    duty: [{ id: 'd1', label: 'Take your medicine (bathroom)' }, { id: 'd2', label: 'Heat up soup and eat it' }, { id: 'd3', label: 'Email Dale that you\'re sick' }],
  },
  build(ctx) {
    const world = apartment(ctx, 'fever');
    const E = ctx.easel(2, 1, { dz: 0.4, ry: 0.35 });
    for (const [i, j, ry] of [[1, 1, 0.3], [6, 4, -0.5], [5, 3, 2.2]]) { const c = P.box(0.9, 1.1, 0.05, 0xe8e0d0, 'canvasBlank'); c.rotation.x = -0.15; world.prop(c, i, j, { ry, y: 0.55, collide: 0.02 }); }
    for (const [i, j] of [[2, 3], [4, 2], [1, 2]]) world.prop(P.box(0.6, 0.12, 0.5, 0x8a7a9a, 'fabricBlue'), i, j, { dx: 0.2, y: 0.06 });
    for (const [i, j] of [[3, 2], [5, 2], [2, 4]]) world.prop(P.cup(0xd8d0e0), i, j, { dx: -0.3, dz: 0.3 });
    const stove = P.stove(); world.prop(stove, 6, 3, { dx: 0.5, ry: -Math.PI / 2, collide: 0.02 });
    const desk = P.table(1.2, 0.6, 0x7a5a3a); world.prop(desk, 4, 1, { dz: -0.5, collide: 0.02 });
    const lap = P.laptop(); world.prop(lap, 4, 1, { dz: -0.5, y: 0.79, ry: Math.PI });
    const phone = P.cellphone(); world.prop(phone, 1, 3, { dx: -0.3, dz: 0.6, y: 0.56, bake: false });
    world.prop(P.chair(0x5a4a3a), 4, 1, { dz: 0.1, ry: Math.PI });

    ctx.task({ obj: E.easel, offsetY: 1.2, r: 0.8, step: 'c1', prompt: 'Paint what the fever shows you',
      idle: { prompt: 'Easel', lines: ['The canvas is so white it hums.'] },
      neglect: { prompt: 'Easel', line: 'She turned it to face the wall. It kept looking anyway.' },
      after: { prompt: 'Your painting', lines: ['She doesn\'t remember painting half of it.'] },
      use: async () => { const c = await ctx.paint(); E.show(c); } });

    let priya = null;
    ctx.task({ obj: phone, r: 0.45, step: 'b1', prompt: 'Read Priya\'s texts',
      idle: { prompt: 'Phone (9 unread)', lines: ['The screen is too bright. 9 unread.'] },
      neglect: { prompt: 'Phone (buzzing)', line: 'She turned it face down. It kept buzzing into the mattress.' },
      use: async () => {
        await ctx.think('Priya: "you alive?"  "nate"  "NATALEE"');
        await ctx.think('Priya: "i have soup and spirited away. opening the door is optional but encouraged"');
        await ctx.choose(['"come over."', '"i\'m disgusting. come over anyway."']);
        audio.play('type');
        await wait(1500); audio.play('knock', { pos: world.at(6, 3, 0.9, 0).setY(1.5) });
      } });
    ctx.task({ pos: world.at(6, 3, 0.85, 0).setY(1.2), r: 0.7, step: 'b2', prompt: 'Open the door',
      idle: { prompt: 'Front door', lines: ['Chain on. Deadbolt on. The hallway smells like someone else\'s dinner.'] },
      neglect: { prompt: 'Front door', line: 'She didn\'t open it.' },
      use: async () => {
        audio.play('door');
        priya = ctx.npc(PEOPLE.priya, 5, 3, { ry: -Math.PI / 2 });
        world.prop(P.box(0.3, 0.3, 0.25, 0xf0f0f0), 5, 3, { dx: -0.6, dz: 0.5, y: 0 });
        await ctx.talk(priya, async () => {
          await ctx.say('Priya', 'You look like a Victorian ghost. Like, a sick one. Sicker than a regular ghost.');
          await ctx.choose(['Thanks, Pri.', 'I feel like one.']);
          await ctx.say('Priya', 'I brought soup. And Spirited Away. Non-negotiable. Couch. Go.');
        });
        ctx.rel('priya', 2);
      } });
    ctx.task({ pos: world.at(3, 4, 0, 0.4).setY(0.6), r: 1.0, step: 'b3', prompt: 'Sit on the couch with Priya',
      idle: { prompt: 'Couch', lines: ['There\'s a Nate-shaped dent in it.'] },
      neglect: { prompt: 'Couch', line: 'She lay there alone. It was fine. It was quiet.' },
      use: async () => {
        await ctx.game.fade(0.85, 1);
        await ctx.say('Priya', 'Remember junior year, you painted the whole back wall of the art room and Mr. Delgado cried?');
        await ctx.say('Nate', 'He said it was allergies.');
        await ctx.say('Priya', 'He did NOT have allergies.');
        await ctx.say('Priya', '...I got the Portland job. The one I applied to on a dare.');
        const a = await ctx.choose(['Pri! That\'s amazing!', 'Portland. ...That\'s far.']);
        await ctx.say('Priya', a === 0 ? 'I know! I\'m terrified. Not yet, though. Not for a while.' : 'Not yet. Not for a while. You\'re stuck with me.');
        await ctx.think('She fell asleep before the bathhouse. Nate watched the rest alone, and was happy.');
        await ctx.game.fade(0, 1);
        ctx.rel('priya', 1);
      } });

    ctx.task({ pos: world.at(9, 1, 0, -0.8).setY(1.5), r: 0.6, step: 'd1', prompt: 'Take your medicine',
      idle: { prompt: 'Medicine cabinet', lines: ['Her face in the mirror looks like a bad copy.'] },
      neglect: { prompt: 'Medicine cabinet', line: 'She\'d be fine. She\'s always fine.' },
      use: async () => { audio.play('pour'); ctx.game.setMood({ warp: 0.2 }); await ctx.think('Two pills, a whole glass of water. The room stops breathing quite so loudly.'); } });
    ctx.task({ obj: stove, offsetY: 0.95, r: 0.6, step: 'd2', prompt: 'Heat up soup',
      later: 'Stove', laterLine: 'Medicine first.',
      idle: { prompt: 'Stove', lines: ['A can of soup, sweating on the burner. Chicken & stars.'] },
      neglect: { prompt: 'Stove', line: 'Not hungry. Not hungry for four days.' },
      use: async () => { audio.play('steam'); await wait(1200); await ctx.think('Chicken & stars. She ate the whole thing standing up, like a raccoon.'); } });
    ctx.task({ obj: lap, offsetY: 0.15, r: 0.5, step: 'd3', prompt: 'Email Dale',
      later: 'Laptop', laterLine: 'Eat something first.',
      idle: { prompt: 'Laptop', lines: ['32 tabs. One of them is "can a fever make you see things".'] },
      neglect: { prompt: 'Laptop', line: 'Dale would figure it out.' },
      use: async () => { audio.play('type'); await ctx.think('"Hi Dale, I\'m really sick, I\'m so sorry, I\'ll make it up—" Send.'); await ctx.think('Dale: "feel better kid. seriously."'); } });
    ctx.inspect({ pos: world.at(3, 1, 1, -0.9).setY(1.7), r: 1.2, prompt: 'Window', lines: ['Rain. The streetlights look like they\'re underwater.', 'For a second, she thinks someone very tall is standing in the street, looking up.'] });
    return { world, spawn: { pos: world.at(2, 3), yaw: 0.6 }, mood: { warp: 0.55, desat: 0.15, tint: [0.95, 1.02, 0.9], ambient: ['rain', 'crackle'], fog: [0xe8f0e0, 4, 22] } };
  },
  onPicked: async (ctx) => {
    if (!ctx.isPicked('bond')) {
      const w = ctx.world;
      let t = 12;
      w.onUpdate((dt) => { t -= dt; if (t <= 0) { t = 18 + Math.random() * 8; audio.play(Math.random() < 0.5 ? 'knock' : 'phone', { pos: w.at(6, 3, 0.9, 0).setY(1.5) }); } });
    }
  },
  onNeglect: async (ctx, which) => {
    if (which === 'bond') { audio.play('knock', { pos: ctx.world.at(6, 3, 0.9, 0).setY(1.5) }); await ctx.think('Priya knocked for a long time. Then it was quiet. Then footsteps, going away.'); }
    else if (which === 'duty') { ctx.game.setMood({ warp: 1.0 }); await ctx.think('The room swam. She didn\'t take anything. She painted until she couldn\'t tell which way was up.'); }
    else await ctx.think('She turned all the canvases to face the wall. It didn\'t help.');
  },
};

export const MEM_A = [M1, M2, M3];
