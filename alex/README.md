# Alex K-Pop Demon Hunter 2: Fates Uncertain Hearts Rewired Recircumcised Edition

A 3D comedy roguelike bullet hell. Alex fights through the increasingly absurd spaces around a K-pop concert, from the parking lot to the main stage, where the K-Pop Demon King is waiting. His phone keeps ringing the whole way.

It runs in the browser with three.js (vendored in `vendor/`). There is no build step and there are no art or audio files: every model, texture, sound effect, song, portrait and minigame is generated in code.

## Play

```bash
npm install
npm start            # from the repo root
# open http://localhost:8080/alex/
```

You can also serve the repo from any static host (for example GitHub Pages) and open `/alex/`.

### Controls

| | Keyboard + mouse | Controller |
| --- | --- | --- |
| Run / camera | WASD / mouse (click to capture) | Left stick / right stick |
| Jump (tap = hop), vault, wall kick | Space | A |
| Dash (2 charges, perfect dodge) | Shift | B / RB |
| Melee (hold, or pull back + melee = launcher) | LMB / J | X |
| Shoot (hold) | RMB / K | RT |
| Hard focus (lock-on) / switch target | F or MMB / Q, C, mouse flick | LT / right-stick flick |
| Interact / buy | E | Y |
| Gadget (grenade, TNT, pearl, capture ball, staff) | G / R | LB |
| Hop on / off a vehicle | V (or E) | RS (or Y) |
| Phone: accept · decline / agree · provoke · deflect | 1 2 3 (4) | D-pad |
| Map (hold) / pause | Tab / Esc | Back / Start |

Every binding can be changed in **Settings → Keyboard / Controller**. Touch devices get an on-screen stick and buttons (including GADGET and RIDE).

## What's in it

**Flow Movement.** Acceleration reaches full speed in about 0.15 s, and running long enough breaks into an anime sprint. Dash is 3.6 m over 0.25 s, with 0.15 s of i-frames, 2 charges and a 1.5 s recharge. Jumps are variable height, with 0.12 s of coyote time and a 0.15 s jump buffer. Alex gets one air dash and one wall kick per airtime, plus an automatic vault over waist- and chest-high cover. Landings come in three tiers, up to a superhero landing with a shockwave. Clutter is cleared automatically, and a dash into a wall redirects along it. Ledge protection keeps him from walking off drops during fights. The cancel hierarchy is Perfect Dodge/Dash → Jump → Movement → Attack → cosmetic, and inputs are buffered.

**Perfect Dodge.** Dash through an attack at the last moment to get a short slow-motion window, a distinctive dodge flip and a contextual counterattack that deals ×1.5 damage and always staggers.

**Combat Focus.** Targets are acquired inside a 30° cone and kept inside a 90° cone. The target stays locked through combos, and after a kill the next target is picked by priority: the one you are pointing at, then whoever is attacking you, then the closest, then the one nearest the screen centre. Hard lock and target switching are optional. Melee pulls Alex up to 1.5 m toward the target, and shots get an aim-assist cone. If you swing the camera away decisively, you always win the argument.

**Camera.** It has explore, combat, crowd and bullet-hell states with distances and FOVs of 70°, 75°, 78° and 80°. It frames Alex and his target together, pulls back for vertical fights, collides with the world and fades whatever is in the way (walls included). It recenters when idle and uses trauma-based shake. Off-screen attacks show edge indicators that go dim → bright → flashing as the hit gets closer, with a panned sound cue. Alex keeps an x-ray silhouette whenever something else hides him.

**The run.** There are 3 floors × 5 room types × 5 layouts, for 75 procedural room layouts, laid out as Isaac-style maps. Each floor has 6–9 fights, side rooms, Lost & Found, a Gas Station about 60% of the time, a hidden bathroom and a pre-boss room before the boss. Rooms are filled from a threat budget of 4–7, 7–11 and 10–15 on floors 1, 2 and 3. Environmental hazards include rolling shopping carts, grills, metal detectors, scanner lasers, grease, spilled soda, hot plates, tracking spotlights, speaker shockwaves, camera beams, electrical arcs, rig sweeps, pyro, a stage lift, equalizer bars and backup dancers.

**Fifteen demons, three bosses.** Stats and behaviour follow the design tables: Lightstick Lurker, Photocard Possessed (its binder can be broken), Bias Beast, Queue Cultist (low rope = jump, high rope = stay down), Merch Mimic, Fancam Fiend (friendly fire), Sasaeng Stalker (slow while watched), Album Hoarder (directional armour that sprays CDs), Fan-Chanter (buffs that don't stack), Ult-Bias, Akgae (hits everything and switches aggro), Parasocial (grab, break free, stretched vulnerable arm), Comeback Queen (revives, with costumes), Fanwar (splits into Solo Stans) and Delulu (verse, pre-chorus, chorus, final pose, encore). The bosses are PRELUDE (every attack lands on the beat), CROWN//CORE (four members, and only the Center Position can be hurt) and THE K-POP DEMON KING (target nodes, three phases, relationship-dependent theatrics, and a phone call in the middle of his own boss fight). All bosses are original parodies, not real artists.

**Economy.** Demons drop coins and bills, which fly to Alex when he's close. The Gas Station has counter, snack aisle, locked weapon case, back wall and lottery kiosk sections, with $2, $5 and $10 K-POP MEGA MILLIONS tickets. There are six extra weapons and about thirty items.

**♥ HEARTLINE.** Six callers ring mid-combat (and sometimes while you explore), and nothing pauses. Every call rolls its own ringtone, caller mood (good mood, grumpy, chaotic, sleepy), signal quality (garbled lines, dropped calls that ring back), hold music and option order, and people text you between calls. Each caller has a persistent relationship from −5 to +5 and their own consequences:
- **Girlfriend:** asks for escalating amounts of money, and sends gifts when your hearts are high.
- **Ugly Girlfriend:** raises the chance of the UGLY KITCHEN COOK-OFF, a five-stage timing minigame that ends in "Pay me." if you lose.
- **Cameron's Cat:** fully functional hearts, no consequences.
- **Baby Mario:** triggers the pixel-horse nightmare and a three-stage Horse Mario platformer.
- **The K-Pop Demon King:** obsesses over one of your stats each run and reshapes the next room and his boss fight.
- **Jesus Christ:** played straight. A low relationship brings a Bible Check (KJV) that escalates from one blank, to two blanks, to typing the word yourself while you're being shot at.

**Elite variants and health bars.** Demons can roll an affix — Swift, Armored, Giant, Regenerating, Volatile, Frenzied or the rare Shiny — shown as a title over a health bar. Bars appear when a demon takes damage, stay while it's in your focus (focus target, soft target or near the reticle) and fade when you look away. They also show the stagger meter and shields.

**Scratch-off tickets.** The Gas Station kiosk sells three real scratchers (Lucky Lightstick, Bias Bingo, K-Pop Mega Millions) drawn on a big card: drag the mouse or a finger over the silver, or hold Interact to let the coin do it. Every ticket pays back more than it costs on average, and stock is limited per visit.

**Crossover rifts.** About a quarter to a third of fights tear open a rift to another universe and part of the fight pours out of it. Every creature is an original low-poly parody built for this game:
- **Halo:** Grunt (panics, plasma-grenade kamikaze), Jackal (front shield), Elite (recharging shield, sword lunge), Hunter (armoured, soft back, fuel rod).
- **Minecraft:** Zombie (and babies, and reinforcements), Skeleton, Creeper (fuse — run and it defuses), Enderman (don't stare at it). Blocks appear in the room.
- **One Piece:** Marine (rifle lanes), Fish-Man Karate Master (water shots hurt Devil Fruit users double), Pacifista (lasers), Sea King (burrows and surfaces under you).
- **Pokémon:** Pikachew (lightning), Gastlee (phases), Magikrap (useless — until it evolves into Gyara-DOS), Snorelax (sleeps, body slams, Rests). A wild-encounter text box announces them.
- **The Bible:** Plague Frogs, Locust Swarm, Pharaoh's Charioteer, Golden Calf (idol that buffs everyone), Goliath (a sling stone fells him). Rifts bring a plague: frogs, locusts, hail or darkness.

Closing a rift drops a choose-one loot pedestal: new weapons (Energy Sword, Needler, Diamond Sword, Bow, Jawbone of a Donkey, David's Sling), gadgets (Plasma Grenade, TNT, Ender Pearl, Capture Ball, Staff of Moses) and items (Overshield, Devil Fruits, Haki, Rare Candy, Armor of God…). The Capture Ball catches a weakened demon as a companion that follows you between rooms and fights. Minecraft mobs drop blocks for the crafting table.

**Vehicles.** Warthog, Minecart, Mini-Merry (Land Edition), Acro Bike and the Chariot of Fire. Steer with the stick, ram demons, smash props; each has its own boost and weapon, soaks half your damage and follows you through doors.

**Random events.** Parked vehicles, a travelling merchant with crossover goods, a crafting table, a burning bush that blesses you, and bigger clear rewards — all rolled generously per room.

**Compendium.** Every creature and vehicle as a rendered 3D portrait, plus item cards. Things you haven't met stay silhouettes.

**Accessibility.** Settings cover aim assist, combat camera assist, sensitivity (per axis and per device), inversion, FOV, camera distance, shake 0–100%, motion blur, recentering and its delay, lock hold or toggle, auto-targeting and auto-switch, projectile contrast, attack indicator intensity, perfect-dodge assistance, rapid fire, auto sprint, ledge protection, vibration, photosensitivity (reduce flashing plus a flash intensity slider), render scale reduced UI motion, enemy health bars and full remapping.

## Code map

```
index.html, css/game.css      page + all UI styling
js/main.js                    boot, main loop (time scaling for perfect-dodge slow-mo / hit-stop)
js/config.js                  every tuning number from the design doc
js/core/                      rng, math, settings, input (buffers, gamepad, text capture), audio (synth + sequencer)
js/world/                     collision + nav flow field, 75 layouts, floor generator, encounter budgets,
                              room builder, props, hazards, live Room
js/actors/                    Alex (controller + model), enemy base, 15 enemies, 3 bosses, models
js/combat/                    projectiles, telegraphed area attacks, targeting, weapons
js/phone/                     Heartline runtime, callers, KJV verses, Cook-Off, nightmare horse, Horse Mario
js/ui/                        HUD, nameplates, scratch-offs, compendium, menus, touch controls
js/actors/crossover*.js       the 22 rift creatures and their models; affixes.js = elite variants
js/world/rifts.js, riftRoom.js, events.js   rift data + composition, portal/plagues, room events
js/vehicles.js, gadgets.js, companions.js   rides, the gadget slot, captured companions
js/phone/portraits.js         painted caller portraits
js/items.js, shop.js, lottery.js, run.js, fx.js, cameraRig.js
```

Headless tests live in `../tests/alex.test.js` and run with `npm test`.

### Your own art

All art is generated in code, but `img/manifest.json` lets you swap in your own portrait and item images (hand-drawn, photos, or AI-generated images you have the rights to). See `img/README.md`.

### About the crossover content

The Halo, Minecraft, One Piece, Pokémon and Bible content is an affectionate fan parody: every model, sound and line is original and generated in code. The Pokémon creatures have parody names; terms from the other franchises are used as references. If you plan to publish the game, check those names first. This project isn't affiliated with or endorsed by any of those rights holders.

Add `?debug` to the URL for these keys:

| Key | Action |
| --- | --- |
| F1 | god mode |
| F2 | +$100 |
| F3 | kill the room |
| F4 | random call |
| F6 | nightmare |
| F7 | jump to the boss |
| F8 | cook-off |
