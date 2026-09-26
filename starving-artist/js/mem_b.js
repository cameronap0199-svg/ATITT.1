// Memories 4-6: The Commission, Holiday, The Opening.
import * as THREE from 'three';
import * as P from './props.js';
import { GridBuilder } from './level.js';
import { World } from './world.js';
import { tex, textTex, toTex } from './tex.js';
import { audio } from './audio.js';
import { apartment, PEOPLE } from './mem_a.js';
import { S, neglect } from './state.js';
import { renderComposition, newPaintCanvas } from './painting.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function familyMood() {
  const n = neglect(S.cur).bond;
  return n >= 3 ? 'blank' : n >= 2 ? 'sad' : 'neutral';
}

// ================================================================== 4. THE COMMISSION
const M4 = {
  intro: ['April. She had 4,000 followers and $212 in checking.', 'A stranger with forty thousand followers had one request.', 'Someone was knocking.'],
  steps: {
    create: [{ id: 'c1', label: 'Read the commission (laptop)' }, { id: 'c2', label: 'Paint the commission' }],
    bond: [{ id: 'b1', label: 'Answer the door' }, { id: 'b2', label: 'Have lunch with Mom' }],
    duty: [{ id: 'd1', label: 'Pay the overdue rent (bills on the counter)' }, { id: 'd2', label: 'Take out the trash', count: 2 }, { id: 'd3', label: 'Call Dale about Saturday' }],
  },
  build(ctx) {
    const world = apartment(ctx, 'commission');
    const E = ctx.easel(2, 1, { dz: 0.4, ry: 0.35 });
    for (let n = 0; n < 9; n++) {
      const c = new THREE.Group();
      const s = newPaintCanvas(); renderComposition(s, S.cur.records[n % Math.max(1, S.cur.records.length)]?.comp || { blank: true, seed: n });
      c.add(P.uniquePlane(0.8, 0.6, toTex(s, { repeat: false }), { emissive: 0.3 }));
      c.add(P.at(P.box(0.84, 0.64, 0.03, 0xe8e0d0), 0, 0, -0.02));
      c.rotation.x = -0.12;
      world.prop(c, [1, 2, 5, 6, 1, 4, 6, 3, 2][n], [2, 4, 4, 3, 1, 4, 2, 2, 2][n], { dx: (n % 3 - 1) * 0.4, dz: 0.3, y: 0.32, ry: n * 1.7, bake: false });
    }
    const desk = P.table(1.2, 0.6, 0x7a5a3a); world.prop(desk, 4, 1, { dz: -0.5, collide: 0.02 });
    const scr = textTex('@thevistavenue\n1 new message', { w: 64, h: 44, color: '#ffffff', bg: '#d0507a', size: 11 });
    const lap = P.laptop(scr); world.prop(lap, 4, 1, { dz: -0.5, y: 0.79, ry: Math.PI });
    const table = P.table(1.0, 1.0, 0xb07a4a); world.prop(table, 4, 3, { dx: 0.4, collide: 0.02 });
    world.prop(P.chair(0xa0643c), 4, 3, { dx: -0.4, ry: Math.PI / 2, collide: 0.02 });
    world.prop(P.chair(0xa0643c), 5, 3, { dx: 0.2, ry: -Math.PI / 2, collide: 0.02 });
    const bills = P.box(0.3, 0.06, 0.22, 0xf4efe2); world.prop(bills, 6, 1, { dz: -0.5, y: 0.95 });
    const phone = P.cellphone(); world.prop(phone, 4, 3, { dx: 0.4, y: 0.8, bake: false });

    ctx.task({ obj: lap, offsetY: 0.15, r: 0.5, step: 'c1', prompt: 'Read the message',
      idle: { prompt: 'Laptop', lines: ['The notification glows the exact pink of a tongue.'] },
      neglect: { prompt: 'Laptop', line: 'She didn\'t open it. She could feel it, unopened, like a splinter.' },
      use: async () => {
        audio.play('ding');
        await ctx.think('@thevistavenue — 40.2k followers. "Nate. We have been watching your work for a long time."');
        await ctx.think('"Paint yourself. Not how you look. How you ARE. $800. They are going to love you."');
        await ctx.choose(['Accept.', 'Accept. (What else would you do?)']);
        audio.play('type');
        await ctx.think('"Wonderful. We knew you would." — Paid in full. Instantly. Before she had painted anything.');
      } });
    ctx.task({ obj: E.easel, offsetY: 1.2, r: 0.8, step: 'c2', prompt: 'Paint the commission',
      later: 'Easel', laterLine: 'Read the message first.',
      neglect: { prompt: 'Easel', line: 'Not this one. Not for them.' },
      after: { prompt: 'The commission', lines: ['It looks like her, from very far away.'] },
      use: async () => { const c = await ctx.paint(); E.show(c); } });

    let mom = null;
    const door = world.at(6, 3, 0.85, 0).setY(1.2);
    ctx.task({ pos: door, r: 0.7, step: 'b1', prompt: 'Answer the door',
      idle: { prompt: 'Front door (knocking)', lines: ['Knock-knock. Knock. Mom\'s knock.'] },
      neglect: { prompt: 'Front door (knocking)', line: 'She stood very still until it stopped.' },
      use: async () => {
        audio.play('door');
        mom = ctx.npc({ ...PEOPLE.mom, mood: familyMood() }, 5, 3, { ry: -Math.PI / 2, dz: 0.6 });
        world.prop(P.box(0.35, 0.4, 0.25, 0xc19a6b), 6, 3, { dx: 0.2, dz: -0.6 });
        await ctx.talk(mom, async () => {
          await ctx.say('Mom', 'Mija. I brought pozole. And don\'t say you already ate.');
          await ctx.say('Nate', 'Mom, you can\'t just— ...hi, Mom.');
        });
      } });
    ctx.task({ obj: table, offsetY: 0.8, r: 0.8, step: 'b2', prompt: 'Have lunch with Mom',
      later: 'Table', laterLine: 'Someone\'s at the door.',
      neglect: { prompt: 'Table', line: 'Lunch was a granola bar, eaten over the sink.' },
      use: () => ctx.talk(mom, async () => {
        world.prop(P.plate(true), 4, 3, { dx: 0.1, y: 0.8, bake: false }); world.prop(P.plate(true), 4, 3, { dx: 0.7, y: 0.8, bake: false });
        await ctx.say('Mom', 'So many paintings. They\'re beautiful, Natalee. They\'re a little sad.');
        const a = await ctx.choose(['They\'re not sad. They\'re honest.', 'Yeah. They are.']);
        await ctx.say('Mom', a === 0 ? 'Honest. Okay. Honest can be sad.' : 'You can make happy ones too, you know. You\'re allowed.');
        await ctx.say('Mom', 'Your hands are shaking.');
        const b = await ctx.choose(['It\'s the coffee.', 'I\'ve been working a lot.']);
        await ctx.say('Mom', b === 0 ? 'Then drink less coffee and eat more pozole.' : 'Working. Mm. Your father worked a lot, when you were small. He missed a lot.');
        await ctx.say('Mom', 'Your father won\'t say it, so I will. Come home for Christmas. Please. Teo asks every day.');
        const c = await ctx.choose(['I\'ll come home.', 'I\'ll try, Mom.']);
        S.cur.flags.promised = c === 0;
        ctx.rel('mom', 2);
        await ctx.think('Mom washed every dish in the apartment before she left. Even the clean ones.');
      }) });

    ctx.task({ obj: bills, r: 0.45, step: 'd1', prompt: 'Pay the bills',
      idle: { prompt: 'Bills', lines: ['Rent. Electric. A dentist she never went to.'] },
      neglect: { prompt: 'Bills', line: 'Tomorrow. Everything is tomorrow.' },
      use: async () => { audio.play('type'); await ctx.think('Rent, two months late. Paid. $61.14 left in checking. She laughed, and it came out wrong.'); } });
    [[6, 3, 0.5, 0.6], [6, 4, 0.3, -0.2]].forEach(([i, j, dx, dz], n) => {
      const bag = P.trashBag(); world.prop(bag, i, j, { dx, dz, collide: 0.02 });
      const it = ctx.task({ obj: bag, offsetY: 0.3, r: 0.5, step: 'd2', prompt: 'Take out the trash',
        later: 'Trash bag', laterLine: 'Bills first.',
        idle: { prompt: 'Trash bag', lines: ['It has been there long enough to have opinions.'] },
        neglect: { prompt: 'Trash bag', line: 'It can wait. Everything can wait.' },
        use: async () => { audio.play('door'); world.remove(bag); world.removeInteract(it); await ctx.think(['Down three flights. Back up three flights.', 'The dumpster lid clangs like a bell.'][n]); } });
    });
    ctx.task({ obj: phone, r: 0.45, step: 'd3', prompt: 'Call Dale',
      later: 'Phone', laterLine: 'Trash first.',
      idle: { prompt: 'Phone', lines: ['137 new followers since breakfast.'] },
      neglect: { prompt: 'Phone', line: 'Dale could find someone else for Saturday. Dale could find someone else, period.' },
      use: async () => {
        audio.play('phone'); await wait(1200);
        await ctx.say('Dale', 'Saturday? You sure? You sound like death, kid.');
        await ctx.choose(['I\'m sure. I need the hours.', '...Yeah. I\'m sure.']);
        await ctx.say('Dale', 'Okay. Eat something before you come in. I mean it.');
      } });
    ctx.inspect({ pos: world.at(3, 1, 1, -0.9).setY(1.7), r: 1.2, prompt: 'Window', lines: ['Spring. The tomato lady across the street is gone. Her fire escape is empty.'] });
    return { world, spawn: { pos: world.at(3, 3), yaw: 0.4 }, mood: { tint: [1.08, 0.97, 1.02], desat: 0.08, warp: 0.15 } };
  },
  onEnter: async (ctx) => { audio.play('knock', { pos: ctx.world.at(6, 3, 0.9, 0).setY(1.5) }); },
  onPicked: async (ctx) => {
    const w = ctx.world;
    if (!ctx.isPicked('bond')) {
      let t = 0, stage = 0;
      w.onUpdate((dt) => {
        t += dt;
        if (stage === 0 && t > 8) { stage = 1; audio.play('knock', { pos: w.at(6, 3, 0.9, 0).setY(1.5) }); }
        if (stage === 1 && t > 16) { stage = 2; ctx.game.ui.subtitle('"Natalee? It\'s Mom. ...I\'ll leave them by the door, okay?"', 4000); }
        if (stage === 2 && t > 22) {
          stage = 3;
          const bag = P.box(0.35, 0.4, 0.25, 0xc19a6b); w.prop(bag, 6, 3, { dx: 0.5, dz: -0.2 });
          ctx.inspect({ obj: bag, offsetY: 0.3, r: 0.5, prompt: 'Paper bag', lines: ['Pozole in a jar, still warm. A note: "You didn\'t answer. I love you. EAT. —Mom"'] });
        }
      });
    }
    if (!ctx.isPicked('create')) {
      let t = 0; w.onUpdate((dt) => { t += dt; if (t > 14) { t = -999; audio.play('ding'); ctx.game.ui.subtitle('@thevistavenue: "we\'re still waiting, nate."', 3500); } });
    }
  },
  onNeglect: async (ctx, which) => {
    if (which === 'bond') await ctx.think('She never opened the door. Mom drove the three hours home.');
    else if (which === 'duty') {
      const n = P.box(0.5, 0.7, 0.01, 0xe84050, null, { emissive: 0.5 }); ctx.world.onWall(n, 6, 3, 'e', 1.5, { inset: 0.14 });
      audio.play('knock');
      await ctx.think('Someone taped something to her door. FINAL NOTICE. In red. Where everybody could see.');
    } else await ctx.think('"That\'s disappointing, Nate. We believed in you." She blocked them. They came back under another name.');
  },
};

// ================================================================== 5. HOLIDAY
const M5 = {
  intro: ['December. She came home for Christmas.', 'The house was smaller than she remembered. Everyone was louder.', 'Her phone buzzed every eleven seconds. Four thousand people wanted a new post.'],
  steps: {
    create: [{ id: 'c1', label: 'Paint in your old bedroom (upstairs hall)' }],
    bond: [{ id: 'b1', label: 'Sit down for dinner' }, { id: 'b2', label: 'Open presents with Teo (by the tree)' }],
    duty: [{ id: 'd1', label: 'Take your medication (kitchen)' }, { id: 'd2', label: 'Call the landlord back (hallway phone)' }, { id: 'd3', label: 'Go to bed before midnight' }],
  },
  build(ctx) {
    const B = new GridBuilder(14, 12);
    B.room(1, 1, 7, 6, 'lv');
    B.room(8, 2, 1, 1, 'kt'); B.room(9, 1, 3, 3, 'kt');
    B.room(8, 5, 4, 1, 'hw');
    B.room(10, 6, 1, 1, 'br'); B.room(9, 7, 3, 3, 'br');
    const regions = {
      default: { floor: 'carpetBeige', wall: 'wallpaperCream', ceil: 'plaster', h: 3, ambient: [0.36, 0.3, 0.26] },
      lv: { floor: 'carpetBeige', wall: 'wallpaperCream', ceil: 'plaster', h: 3, ambient: [0.38, 0.31, 0.26], surface: 'carpet' },
      kt: { floor: 'checkerBlue', wall: 'plaster', ceil: 'plaster', h: 3, ambient: [0.36, 0.36, 0.38], surface: 'tile' },
      hw: { floor: 'wood', wall: 'wallpaperBlue', ceil: 'plaster', h: 3, ambient: [0.22, 0.22, 0.26], surface: 'wood' },
      br: { floor: 'carpetKids', wall: 'wallpaperKids', ceil: 'plaster', h: 3, ambient: [0.28, 0.24, 0.3], surface: 'carpet' },
    };
    const lights = [
      { x: 3, y: 1.5, z: 3, color: 0xffd080, intensity: 1.0, range: 6 }, { x: 3, y: 1, z: 9, color: 0xff8040, intensity: 1.1, range: 7 },
      { x: 11, y: 2.8, z: 7, color: 0xffe0b0, intensity: 0.9, range: 8 }, { x: 21, y: 2.8, z: 5, color: 0xf0f0ff, intensity: 0.9, range: 7 },
      { x: 19, y: 2.8, z: 11, color: 0xffe0b0, intensity: 0.4, range: 6 }, { x: 21, y: 2.5, z: 17, color: 0xffb0d0, intensity: 0.7, range: 6 },
    ];
    const world = new World(ctx.game, { builder: B, regions, lights, sky: 'skyNight', seed: 51 });
    ctx.world = world;
    const face = familyMood();
    // Tree
    const tree = new THREE.Group();
    for (let i = 0; i < 4; i++) tree.add(P.at(P.cone(0.9 - i * 0.18, 0.9, 7, 0x2f7a42), 0, 0.6 + i * 0.5, 0));
    const star = P.sphere(0.12, 0xffe36e, 4, null, { emissive: 1 }); star.position.y = 2.6; star.userData.noBake = true; tree.add(star);
    for (let i = 0; i < 18; i++) { const a = i * 2.4, h = 0.5 + (i / 18) * 1.9, r = 0.85 - (h / 2.6) * 0.75; const b = P.sphere(0.05, [0xe8637a, 0xffd24a, 0x9ad0f5][i % 3], 4, null, { emissive: 1 }); b.position.set(Math.cos(a) * r, h, Math.sin(a) * r); b.userData.noBake = true; tree.add(b); }
    world.prop(tree, 1, 1, { dx: 0.3, dz: 0.3, collide: 0.1 });
    for (const [dx, dz, c] of [[0.8, 0.9, 0x6fd3c1], [-0.2, 1.2, 0xe8637a], [1.2, 0.2, 0xf6d36b]]) world.prop(P.box(0.35, 0.3, 0.35, c), 1, 1, { dx: dx + 0.3, dz: dz + 0.3 });
    const fire = new THREE.Group();
    fire.add(P.at(P.box(1.6, 1.2, 0.5, 0x8a4a3a, 'brick'), 0, 0.6, 0));
    const flame = P.box(0.8, 0.4, 0.1, 0xff8a3a, null, { emissive: 1 }); flame.position.set(0, 0.35, 0.22); flame.userData.noBake = true; fire.add(flame);
    world.onWall(fire, 1, 4, 'w', 0, { inset: 0.25 });
    world.onUpdate((dt, t) => { flame.scale.y = 0.8 + Math.sin(t * 13) * 0.15 + Math.sin(t * 7) * 0.1; });
    world.onWall(P.windowQuad(1.6, 1.2, 'skyNight'), 3, 1, 'n', 1.7, { bake: false });
    world.onWall(P.windowQuad(1.6, 1.2, 'skyNight'), 6, 1, 'n', 1.7, { bake: false });
    world.prop(P.couch(0x8a5a4a), 3, 5, { dz: 0.2, ry: Math.PI, collide: 0.02 });
    const dining = P.table(2.2, 1.1, 0x8a5a36); world.prop(dining, 5, 3, { dx: 0.5, collide: 0.02 });
    for (const [dx, dz] of [[-0.5, 0], [0.5, 0], [1.5, 0]]) world.prop(P.plate(true), 5, 3, { dx: dx + 0.1, dz, y: 0.8, bake: false });
    world.prop(P.vase(), 5, 3, { dx: 0.5, y: 0.79 });
    const empty = P.chair(0xa0643c); world.prop(empty, 5, 3, { dx: 0.5, dz: 1.0, ry: Math.PI, collide: 0.02 });
    const dad = ctx.npc({ ...PEOPLE.dad, mood: face }, 6, 2, { ry: Math.PI * 0.8, dx: 0.6, dz: 0.2 });
    const mom = ctx.npc({ ...PEOPLE.mom, mood: face }, 4, 2, { ry: -Math.PI * 0.8, dz: 0.4 });
    const teo = ctx.npc({ ...PEOPLE.teo, height: 1.6, mood: face === 'blank' ? 'sad' : 'happy' }, 2, 3, { ry: Math.PI / 2, dx: 0.3 });
    // Kitchen
    world.prop(P.counter(3), 10, 1, { dz: -0.6, collide: 0.02 });
    world.prop(P.fridge(), 11, 3, { dx: 0.55, ry: -Math.PI / 2, collide: 0.02 });
    const pills = P.box(0.25, 0.04, 0.08, 0x9ad0f5); world.prop(pills, 9, 1, { dz: -0.55, y: 0.95 });
    // Hallway phone
    const wallPhone = P.phone(true, 0xe8e2d6); world.onWall(wallPhone, 9, 5, 'n', 0);
    world.onWall(P.frame(0.7, 0.5, textTex('NATALEE\n2nd GRADE', { w: 64, h: 44, color: '#3a2a2a', bg: '#f6e6c6', size: 11 })), 11, 5, 'n', 1.6);
    // Bedroom
    const E = ctx.easel(9, 7, { dx: 0.2, dz: 0.2, ry: Math.PI * 0.8 });
    const bed = P.bed(0x9ad0f5, { w: 1.1, l: 1.9 }); world.prop(bed, 11, 8, { dx: 0.3, collide: 0.02 });
    world.prop(P.teddy(true), 11, 7, { dx: 0.3, y: 0.55, dz: 0.2 });
    world.onWall(P.uniquePlane(0.9, 1.2, textTex('ART\nIS\nLIFE', { w: 32, h: 48, color: '#ffffff', bg: '#6a3a9a', size: 14 }), { emissive: 0.4 }), 10, 7, 'n', 1.8);
    world.prop(P.deskLamp(true), 9, 9, { dz: 0.3 });

    ctx.task({ obj: E.easel, offsetY: 1.2, r: 0.8, step: 'c1', prompt: 'Paint',
      idle: { prompt: 'Your old easel', lines: ['She painted her first horse on this. It was a dog.'] },
      neglect: { prompt: 'Your old easel', line: 'Not this week. This week is for them.' },
      after: { prompt: 'Your painting', lines: ['Downstairs, somebody laughs at something she missed.'] },
      use: async () => { await ctx.think('Downstairs, Mom calls her name. Once. Then not again.'); const c = await ctx.paint(); E.show(c); } });

    ctx.task({ obj: dining, offsetY: 0.9, r: 1.1, step: 'b1', prompt: 'Sit down for dinner',
      idle: { prompt: 'Dinner table', lines: ['Tamales. Pozole. Dad\'s terrible, beloved green bean thing.'] },
      neglect: { prompt: 'Dinner table', line: '"Start without me!" They did.' },
      use: () => ctx.talk(dad, async () => {
        await ctx.game.fade(0.4, 0.6);
        await ctx.say('Dad', 'So. How\'s the... art.');
        const sold = S.cur.records[3]?.picked.includes('create');
        const opts = ['It\'s good, Dad. It\'s really good.', ...(sold ? ['I sold a painting. A big one.'] : []), 'Honestly? I don\'t know anymore.'];
        const a = await ctx.choose(opts);
        const pickText = opts[a];
        if (pickText.startsWith('It\'s good')) await ctx.say('Dad', 'Good. Good.');
        else if (pickText.startsWith('I sold')) { await ctx.say('Dad', 'A big one! How big?'); await ctx.say('Nate', 'Eight hundred dollars.'); await ctx.say('Mom', 'To who?'); await ctx.say('Nate', '...A fan.'); }
        else { await ctx.say('Mom', 'Then you don\'t have to know tonight. Tonight you eat.'); }
        await ctx.say('Dad', 'Your mother still keeps the one you did in fourth grade in her purse. The horse.');
        await ctx.say('Mom', 'It\'s a DOG, Rafael.');
        await ctx.say('Teo', 'I\'m on my second sketchbook. I drew a museum I dreamed about. With a giant fountain, and a door that\'s just painted on.');
        const b = await ctx.choose(['Show me after dinner.', '...Where did you see that?']);
        await ctx.say('Teo', b === 0 ? 'Okay! It\'s kind of creepy, though.' : 'I told you. A dream. You were in it. You were looking for something.');
        await ctx.say('Mom', 'Stay till New Year\'s? Please?');
        const c = await ctx.choose(['I\'ll stay.', 'I have to get back to work.']);
        await ctx.say('Mom', c === 0 ? 'Good. Your room\'s still your room.' : 'Okay. Okay. Take leftovers at least.');
        ctx.rel('mom', 1); ctx.rel('dad', 1);
        await ctx.game.fade(0, 0.6);
      }) });
    ctx.task({ pos: world.at(1, 1, 0.8, 1.2).setY(0.6), r: 1.0, step: 'b2', prompt: 'Open presents with Teo',
      later: 'Presents', laterLine: 'After dinner. Mom\'s rules.',
      idle: { prompt: 'Presents', lines: ['One of them is shaped exactly like a sketchbook.'] },
      neglect: { prompt: 'Presents', line: 'Hers stayed wrapped under the tree until February.' },
      use: () => ctx.talk(teo, async () => {
        audio.play('remove');
        await ctx.say('Teo', 'REAL paints? Not the chalky kind?');
        await ctx.say('Teo', 'Okay, open mine. Don\'t laugh.');
        await ctx.think('A drawing of the two of them. He drew her smiling. She hasn\'t seen herself smile in a while.');
        const a = await ctx.choose(['It\'s perfect, Teo.', 'You made me look happy.']);
        await ctx.say('Teo', a === 0 ? 'It\'s not perfect. Your hand has six fingers. But thanks.' : 'You ARE happy. When you\'re here.');
        ctx.rel('teo', 2);
      }) });

    ctx.task({ obj: pills, r: 0.45, step: 'd1', prompt: 'Take your medication',
      idle: { prompt: 'Pill organizer', lines: ['S M T W T F S. Mom bought it. It is mostly full.'] },
      neglect: { prompt: 'Pill organizer', line: 'She\'d take them tomorrow. Two tomorrow. That\'s how it works, right?' },
      use: async () => { audio.play('pour'); await ctx.think('Today\'s. Just today\'s. The kitchen smells like cinnamon and everything is fine.'); } });
    ctx.task({ obj: wallPhone, offsetY: 1.45, r: 0.5, step: 'd2', prompt: 'Call the landlord back',
      later: 'Phone', laterLine: 'Medication first.',
      idle: { prompt: 'Phone', lines: ['The same phone she used to call Priya on for four hours a night.'] },
      neglect: { prompt: 'Phone (ringing)', line: 'She let it ring.' },
      use: async () => {
        audio.play('phone'); await wait(1200);
        await ctx.say('Landlord', 'Ms. Reyes. Rent\'s three weeks late. Again.');
        await ctx.choose(['Can we do a payment plan?', 'I\'ll have it by the fifth. I promise.']);
        await ctx.say('Landlord', '...Fine. The fifth. Merry Christmas, Ms. Reyes.');
      } });
    ctx.task({ obj: bed, offsetY: 0.6, r: 0.9, step: 'd3', prompt: 'Go to bed',
      later: 'Bed', laterLine: 'Call the landlord back first.',
      idle: { prompt: 'Your old bed', lines: ['Glow-in-the-dark stars on the ceiling. Seven of them still glow.'] },
      neglect: { prompt: 'Your old bed', line: 'Sleep is for people with nothing to prove.' },
      use: async () => { await ctx.game.fade(0.9, 1.5); await ctx.think('11:48 PM. She fell asleep to Dad snoring through the wall, exactly like when she was nine.'); await ctx.game.fade(0, 1.2); } });
    ctx.inspect({ obj: teo, offsetY: 1.3, r: 0.6, prompt: 'Teo', enabled: () => !ctx.picked || !ctx.isPicked('bond'), lines: (c) => (c.picked && !c.isPicked('bond') ? ['"It\'s fine. You\'re busy."'] : ['Teo has grown three inches. His voice cracks on "Nate."']) });
    ctx.inspect({ obj: mom, offsetY: 1.4, r: 0.6, prompt: 'Mom', enabled: () => !ctx.picked || !ctx.isPicked('bond'), lines: [face === 'blank' ? 'Mom\'s face is hard to look at. Like a word you\'ve said too many times.' : 'Mom, doing three things at once, humming.'] });
    return { world, spawn: { pos: world.at(4, 5), yaw: 0 }, mood: { ambient: ['crackle', 'murmur'], tint: [1.08, 1.0, 0.9] } };
  },
  onPicked: async (ctx) => {
    const w = ctx.world;
    if (!ctx.isPicked('duty')) { let t = 6; w.onUpdate((dt) => { t -= dt; if (t <= 0) { t = 16; audio.play('phone', { pos: w.at(9, 5).setY(1.5) }); } }); }
    if (!ctx.isPicked('create')) { let t = 10; w.onUpdate((dt) => { t -= dt; if (t <= 0) { t = 14; audio.play('whisper', { pos: w.at(10, 8).setY(1.5), vol: 0.8 }); } }); }
  },
  onNeglect: async (ctx, which) => {
    if (which === 'bond') await ctx.think('They ate without her. When she came downstairs, Teo was already in bed. "It\'s fine. You\'re busy," he\'d said.');
    else if (which === 'duty') await ctx.think('She fell asleep at 4 AM with her phone on her face. The landlord stopped calling. That was worse.');
    else await ctx.think('Something upstairs kept whispering that she was wasting it. She didn\'t go up.');
  },
};

// ================================================================== 6. THE OPENING
const M6 = {
  intro: ['May. Her first real show: "NATE — NEW WORK."', 'The gallery was full of people who knew her name and nothing else.', 'Priya\'s train left at nine.'],
  steps: {
    create: [{ id: 'c1', label: 'Finish the centerpiece in front of everyone' }],
    bond: [{ id: 'b1', label: 'Find your family' }, { id: 'b2', label: 'Say goodbye to Priya (back alley)' }],
    duty: [{ id: 'd1', label: 'Sign the contract with Vivian (office)' }, { id: 'd2', label: 'Eat something from the buffet' }],
  },
  build(ctx) {
    const nb = neglect(S.cur).bond;
    const famHere = nb <= 2;
    if (!famHere) ctx.steps.bond[0].label = 'Call home (office phone)';
    const B = new GridBuilder(16, 13);
    B.room(1, 1, 10, 8, 'gl');
    B.room(11, 2, 1, 1, 'of'); B.room(12, 1, 3, 3, 'of');
    B.room(11, 7, 1, 1, 'al'); B.room(12, 6, 3, 5, 'al');
    const regions = {
      default: { floor: 'marble', wall: 'plaster', ceil: 'ceilingTile', h: 5, ambient: [0.5, 0.48, 0.52] },
      gl: { floor: 'marble', wall: 'plaster', ceil: 'ceilingTile', h: 5, ambient: [0.5, 0.48, 0.52], surface: 'tile', floorScale: 3 },
      of: { floor: 'carpetBeige', wall: 'wallpaperBlue', ceil: 'plaster', h: 3, ambient: [0.3, 0.3, 0.34], surface: 'carpet' },
      al: { floor: 'concrete', wall: 'brick', ceil: null, h: 6, ambient: [0.1, 0.1, 0.16], surface: 'hard' },
    };
    const lights = [
      { x: 11, y: 4.5, z: 11, color: 0xffffff, intensity: 1.2, range: 9 },
      { x: 7, y: 4.5, z: 3, color: 0xfff0e0, intensity: 0.7, range: 7 }, { x: 13, y: 4.5, z: 3, color: 0xfff0e0, intensity: 0.7, range: 7 }, { x: 19, y: 4.5, z: 3, color: 0xfff0e0, intensity: 0.7, range: 7 },
      { x: 3, y: 4.5, z: 9, color: 0xfff0e0, intensity: 0.7, range: 7 }, { x: 3, y: 4.5, z: 15, color: 0xfff0e0, intensity: 0.7, range: 7 },
      { x: 27, y: 2.6, z: 5, color: 0xffe0b0, intensity: 0.8, range: 6 }, { x: 27, y: 3.4, z: 17, color: 0xffa050, intensity: 1.2, range: 9 },
    ];
    const world = new World(ctx.game, { builder: B, regions, lights, sky: 'skyNight', seed: 61 });
    ctx.world = world;
    // Her own paintings on the walls
    const spots = [[3, 1, 'n'], [6, 1, 'n'], [9, 1, 'n'], [1, 4, 'w'], [1, 7, 'w']];
    S.cur.records.slice(0, 5).forEach((r, idx) => {
      const [i, j, side] = spots[idx];
      const s = newPaintCanvas(); renderComposition(s, r.comp);
      const f = P.frame(2.0, 1.5, toTex(s, { repeat: false }), { frameColor: 0xf6f2ea, emissiveAmt: 0.6 });
      world.onWall(f, i, j, side, 2.4);
      const t = r.comp && !r.comp.blank ? r.comp.title : 'Untitled (unfinished)';
      world.onWall(P.plaque(textTex(`${t} · SOLD`, { w: 128, h: 16, color: '#e8d8a8', size: 12 }), 1.0, 0.12), i, j, side, 1.35);
      ctx.inspect({ obj: f.userData.pic, r: 1, reach: 3, prompt: `“${t}”`, lines: [`A red dot on the plaque. Sold. To someone called @thevistavenue.`] });
    });
    world.onWall(P.uniquePlane(4, 0.8, textTex('NATE — NEW WORK', { w: 128, h: 26, color: '#1a1a1a', size: 20 }), { emissive: 0.4, transparent: true }), 5, 8, 's', 3.6, { along: 1 });
    // Centerpiece
    world.prop(P.box(1.6, 0.3, 1.2, 0xf0f0f0, 'marble'), 5, 4, { dx: 1, dz: 1, collide: 0.02 });
    const E = ctx.easel(5, 4, { dx: 1, dz: 1.1, y: 0.3, ry: 0 });
    // The Following
    const crowd = [];
    for (let n = 0; n < 14; n++) {
      const a = (n / 14) * Math.PI * 1.55 + Math.PI * 0.72;
      const pos = new THREE.Vector3(12 + Math.cos(a) * 4.2, 0, 11 + Math.sin(a) * 3.6);
      const m = P.person({ skin: '#e8e0d8', hair: ['#1a1a1a', '#e8e0d8', '#3a2a2a'][n % 3], shirt: [0x2a2a2a, 0xd8d0c8, 0x3a3040][n % 3], pants: 0x2a2a2a, mood: 'blank', height: 1.65 + (n % 4) * 0.05 });
      const scr = P.box(0.08, 0.14, 0.01, 0xaad0ff, null, { emissive: 1 }); scr.userData.noBake = true; scr.position.set(0.18, 1.35, 0.3); m.add(scr);
      m.userData.armR.rotation.x = -1.2;
      world.prop(m, 0, 0, { pos, ry: Math.atan2(12 - pos.x, 11.2 - pos.z), dynamic: true, collide: 0.05 });
      crowd.push(m);
    }
    world.onUpdate((dt, t) => { if (Math.random() < dt * 0.25) { audio.play('shutter', { pos: crowd[Math.floor(Math.random() * crowd.length)].position }); ctx.game.pulse('aberr', 0.4); } });
    // Vivian, buffet
    const viv = ctx.npc({ skin: '#f0d0c0', hair: '#e8e0d8', shirt: 0x1a1a1a, pants: 0x1a1a1a, height: 1.74, hairLong: true, mood: 'happy' }, 10, 3, { ry: -Math.PI / 2 });
    const buffet = P.table(2.0, 0.8, 0xf6f2ea); world.prop(buffet, 8, 7, { dx: 0.5, dz: 0.4, collide: 0.02 });
    for (let n = 0; n < 6; n++) world.prop(P.plate(true), 8, 7, { dx: -0.2 + n * 0.28, dz: 0.4, y: 0.8, bake: false });
    // Office
    const desk = P.table(1.4, 0.7, 0x3a2418); world.prop(desk, 13, 1, { dz: 0.2, collide: 0.02 });
    const contract = P.box(0.25, 0.01, 0.32, 0xffffff); world.prop(contract, 13, 1, { dz: 0.2, y: 0.8 });
    const deskPhone = P.phone(false, 0x2a2a2a); world.prop(deskPhone, 13, 1, { dx: 0.5, dz: 0.2, y: 0.79 });
    world.prop(P.deskLamp(true), 13, 1, { dx: -0.5, dz: 0.1, y: 0.79 });
    // Alley
    world.prop(P.streetLamp(), 13, 8, { dx: 0.8 });
    world.prop(P.trashBag(), 14, 10, { dx: 0.3, collide: 0.02 });
    const priya = ctx.npc(PEOPLE.priya, 13, 9, { ry: Math.PI });
    const suit = P.box(0.45, 0.6, 0.25, 0x6a4a8a); world.prop(suit, 13, 9, { dx: 0.5, dz: 0.3 });
    let fam = [];
    if (famHere) {
      const face = familyMood();
      fam = [ctx.npc({ ...PEOPLE.mom, mood: face }, 2, 7, { ry: 0.6 }), ctx.npc({ ...PEOPLE.dad, mood: face }, 3, 8, { ry: 0.2, dz: -0.3 }), ctx.npc({ ...PEOPLE.teo, height: 1.62, mood: face }, 2, 8, { ry: 0.9, dx: -0.3, dz: -0.2 })];
    }

    ctx.task({ obj: E.easel, offsetY: 1.4, r: 0.8, step: 'c1', prompt: 'Finish the centerpiece',
      idle: { prompt: 'The centerpiece', lines: ['A blank canvas on a pedestal, under a spotlight. Forty phones already pointed at it.'] },
      neglect: { prompt: 'The centerpiece', line: 'She couldn\'t. Not with everyone watching.' },
      after: { prompt: 'The centerpiece', lines: ['They applaud like a machine that has learned applause.'] },
      use: async () => { audio.play('clap'); const c = await ctx.paint(); E.show(c); audio.play('clap'); } });

    if (famHere) {
      ctx.task({ obj: fam[0], offsetY: 1.4, r: 0.8, step: 'b1', prompt: 'Go to your family',
        idle: { prompt: 'Family', lines: ['They came. All three of them. Dad is wearing the tie.'] },
        neglect: { prompt: 'Family', line: 'She waved. She meant to go over. The crowd closed.' },
        use: () => ctx.talk(fam[0], async () => {
          await ctx.say('Mom', 'Mija! Look at you. Look at THIS.');
          await ctx.say('Dad', '...These are really something, Natalee.');
          await ctx.say('Teo', 'People keep asking if I\'m "the brother." I say yes. It\'s the best.');
          const a = await ctx.choose(['I\'m so glad you came.', 'You didn\'t have to drive all this way.']);
          await ctx.say('Dad', a === 0 ? 'Wouldn\'t miss it.' : 'Three hours is nothing. I told you. I\'d drive thirty.');
          ctx.rel('dad', 2);
        }) });
    } else {
      ctx.task({ obj: deskPhone, offsetY: 0.1, r: 0.45, step: 'b1', prompt: 'Call home',
        idle: { prompt: 'Office phone', lines: ['A beige phone. It looks like home.'] },
        neglect: { prompt: 'Office phone', line: 'They wouldn\'t want to hear from her. Not after all this time.' },
        use: async () => {
          audio.play('phone'); await wait(1600);
          await ctx.say('Mom', 'Natalee? Is everything okay? We— we didn\'t know if you wanted us there.');
          const a = await ctx.choose(['I wanted you here.', 'It\'s okay. It\'s just a show.']);
          await ctx.say('Mom', a === 0 ? 'Then next time, ask us. We\'ll come. We\'ll always come.' : '...It\'s not just a show, mija. It\'s you.');
          ctx.rel('mom', 2);
        } });
    }
    ctx.task({ obj: priya, offsetY: 1.4, r: 0.7, step: 'b2', prompt: 'Say goodbye to Priya',
      idle: { prompt: 'Priya', lines: ['Priya, with one suitcase and her whole life in it.'] },
      neglect: { prompt: 'Priya', line: '"Five minutes, Pri, I swear." She checked the time. It was nine.' },
      use: () => ctx.talk(priya, async () => {
        await ctx.say('Priya', 'There she is. The famous Nate.');
        await ctx.say('Priya', 'I kept waiting for you to disappear into that crowd.');
        const a = await ctx.choose(['I\'m here.', 'I\'m sorry I haven\'t been around.']);
        await ctx.say('Priya', a === 0 ? 'You\'re here.' : 'You\'re around now. That counts. That totally counts.');
        await ctx.say('Priya', 'Portland has trains back, you know. Use them.');
        await ctx.say('Priya', 'Don\'t disappear, okay?');
        audio.play('train');
        await ctx.think('Priya hugged her so hard her ribs hurt.');
        ctx.rel('priya', 3);
      }) });
    ctx.task({ obj: contract, offsetY: 0.05, r: 0.5, step: 'd1', prompt: 'Sign the contract',
      idle: { prompt: 'Contract', lines: ['Forty pages. Vivian\'s perfume is on every one.'] },
      neglect: { prompt: 'Contract', line: 'Vivian would handle it. Vivian handled everything.' },
      use: async () => {
        await ctx.say('Vivian', 'Darling. Sign here, here, and... here. Standard terms.');
        const a = await ctx.choose(['Read it first.', 'Just sign.']);
        if (a === 0) await ctx.think('Seventy percent to the gallery. She crossed it out and wrote fifty. Vivian smiled like a shark who respects you.');
        else await ctx.think('She signed without reading. Her hand was shaking so hard the signature looked like someone else\'s.');
      } });
    ctx.task({ obj: buffet, offsetY: 0.85, r: 1.0, step: 'd2', prompt: 'Eat something',
      later: 'Buffet', laterLine: 'Vivian is waiting in the office.',
      idle: { prompt: 'Buffet', lines: ['Tiny sandwiches. Nobody is eating them. It would be weird to be the first.'] },
      neglect: { prompt: 'Buffet', line: 'Not hungry. Hasn\'t been hungry since Tuesday.' },
      use: async () => { audio.play('place'); await ctx.think('Tiny sandwiches. She ate three. Her hands stopped shaking.'); } });
    ctx.inspect({ obj: viv, offsetY: 1.5, r: 0.6, prompt: 'Vivian', lines: ['Vivian: "They adore you. Don\'t make them wait too long for more."'] });
    for (const m of crowd.slice(0, 5)) ctx.inspect({ obj: m, offsetY: 1.5, r: 0.5, prompt: 'Guest', lines: [['"We love you, Nate."', '"We\'ve been following you since the beginning."', '"Is the next one about us?"', '"You look thinner in person. It suits you."', '"Can we have a little more of you?"'][crowd.indexOf(m)]] });
    return { world, spawn: { pos: world.at(5, 8, 1, 0), yaw: 0 }, mood: { ambient: ['murmur'], tint: [1.02, 1.0, 1.0], desat: 0.12, fog: [0xf6f2f0, 6, 30], corrupt: 0.45 } };
  },
  onPicked: async (ctx) => {
    if (!ctx.isPicked('bond')) { let t = 25; ctx.world.onUpdate((dt) => { t -= dt; if (t <= 0) { t = 999; audio.play('train'); ctx.game.ui.subtitle('Somewhere, a train whistle. Nine o\'clock.', 3000); } }); }
  },
  onNeglect: async (ctx, which) => {
    if (which === 'bond') { audio.play('ding'); await ctx.think('Priya: "i waited. it\'s ok. i love you. don\'t disappear, okay?"'); }
    else if (which === 'duty') {
      ctx.game.player.shake = 0.1;
      for (let i = 0; i < 6; i++) { audio.play('shutter'); ctx.game.pulse('aberr', 2); await wait(220); }
      await ctx.game.fade(1, 0.8, 0x000000);
      await ctx.think('She fainted during the toast. She woke up on the floor with forty phones pointed at her.');
    } else {
      for (let i = 0; i < 3; i++) { ctx.game.ui.subtitle('PAINT.  PAINT.  PAINT.', 900); audio.play('whisper', { vol: 1.2 }); await wait(1000); }
      await ctx.think('The centerpiece stayed white. They chanted until Vivian turned the lights up.');
    }
  },
};

export const MEM_B = [M4, M5, M6];
