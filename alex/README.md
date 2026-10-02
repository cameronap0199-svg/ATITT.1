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
| Pack: inventory, crafting, Pokémon, Bag | I / B | LS |
| Battles and menus: move · confirm · back | WASD/arrows · Space or E · Shift or Esc | stick/D-pad · A or Y · B |
| Phone: accept · decline / agree · provoke · deflect | 1 2 3 (4) | D-pad |
| Map (hold) / pause | Tab / Esc | Back / Start |

Every binding can be changed in **Settings → Keyboard / Controller**. Touch devices get an on-screen stick and buttons (including GADGET, RIDE and BAG); Pokémon battles, evolutions and the Pack are tapped directly.

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
- **Ugly Girlfriend:** fewer hearts raise the chance of the UGLY KITCHEN COOK-OFF (still only occasional: at most once per floor, several rooms apart). Each one cooks a random dish over four rounds drawn from thirteen (chop, stir, flip, crack, plate, season, whisk, secret recipe, grocery run, microwave, pour, grill, order up), all with randomized timing. Lose and it ends in "Pay me."
- **Cameron's Cat:** fully functional hearts, no consequences.
- **Baby Mario:** triggers the pixel-horse nightmare and a three-stage Horse Mario platformer. You get 3 lives (a death retries the same stage); lose them all and Alex wakes up with half the health he had.
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

Closing a rift drops a choose-one loot pedestal: new weapons (Energy Sword, Needler, Diamond Sword, Bow, Jawbone of a Donkey, David's Sling), gadgets (Plasma Grenade, TNT, Ender Pearl, Capture Ball, Staff of Moses) and items (Overshield, Devil Fruits, Haki, Rare Candy, Armor of God…). The Capture Ball catches a weakened demon as a pal that follows you and fights. Catch a rift Pokémon with it and it joins your party as a real Pokémon.

**Vehicles.** Warthog, Minecart, Mini-Merry (Land Edition), Acro Bike and the Chariot of Fire. Steer with the stick and ram demons. Each has its own boost and weapon, soaks half your damage and follows you through doors. Rides plough through anything that isn't a wall, door or parked ride: cars, buses, tents, crates, shelves, pillars and blocks all get smashed, and drop materials. Stairs and stage platforms are climbed rather than smashed. The Chariot flies over low props.

**Minecraft, for real.** Every room on a floor grows trees and stone outcrops with ore veins (coal, iron, gold, lapis, redstone, diamond, emerald, obsidian), and they stay mined when you come back. Everything drops something: each demon, rift mob, Pokémon and boss has its own drop table, every prop drops by what it is (cars give iron, glass and redstone; crates give planks; toilets give paper), and XP orbs fill a Minecraft XP bar. Pickaxe tiers matter: wood → stone → iron → diamond, and the wrong tool gets you nothing (obsidian needs diamond). The **Pack** (I/B) has a 2×2 pocket grid everywhere and the full **3×3 grid next to a Crafting Table** you place yourself. You can click or tap ingredients into slots (shaped, mirrored and shapeless recipes), or let the recipe book lay them out. There are 40+ recipes: planks, sticks, tables, furnaces, torches, every pickaxe and sword tier, the bow, leather/iron/gold/diamond armour, a shield, flint and steel, minecarts that spawn a ride, TNT, golden apples, bread, books, beds (don't sleep in the Nether), the Enchanting Table and Eyes of Ender. The **Furnace** smelts with real fuel values, and the **Enchanting Table** spends XP levels and lapis on Sharpness, Power, Protection, Efficiency, Fortune, Looting, Fire Aspect, Mending and more.

**The Nether, the End and the Ender Dragon.** Some rooms hold a ruined portal with a loot chest. Build a 10-obsidian **Nether Portal**, light it with flint and steel, and stand in it (with the purple wobble) to reach an eight-room Nether: Nether Wastes, Soul Sand Valley (slow ground), Crimson and Warped Forests (huge fungi), Basalt Deltas (lava everywhere), a Nether Fortress, the **Blaze Spawner** room (break the cage), a Bastion Remnant (piglin brutes guarding treasure) and a Piglin Trading Post (barter gold ingots for ender pearls and more). The Nether has its own mobs:
- zombified piglins, neutral until you hit one, then all of them come for you
- ghasts whose fireballs you can swing back at them
- blazes, splitting magma cubes, wither skeletons, silverfish and spiders

Blaze rods + ender pearls → **Eyes of Ender**. Throw one and it flies toward the door that leads to the floor's hidden **stronghold**; in the room next to it, the eye dives into the ground and opens the way. Fill the stronghold's twelve End Portal frames and jump in. **The End**: an island of obsidian pillars topped with End Crystals that heal the dragon through beams. The **Ender Dragon** circles spitting dragon's-breath fireballs, dives at you, and perches by the exit portal to breathe (that's when it's hittable up close). Kill it for its death beams, the Dragon Egg (+25% damage, +25 max HP), the exit portal and a short End Poem.

**Pokémon, the actual game.** There are 125 parody species in evolution lines, each with a procedural GBA-style pixel sprite (front and back), 18 types with the full type chart, and 169 moves.
- **Starting out:** Professor Oakley waits in the first parking lot with three starters and five Poké Balls.
- **Wild encounters:** tall grass grows in many rooms and rustles into wild encounters. The transition flashes into a handheld-style battle screen with FIGHT / BAG / POKéMON / RUN, HP and EXP bars and typewriter text.
- **Battle rules:** Gen-3 damage (STAB, crits, random roll), accuracy, priority and Speed, burn, paralysis, poison, toxic, sleep, freeze, confusion, flinch, stat stages, recoil, drain, recharge and Self-Destruct.
- **Catching:** Poké Balls use real shake checks, and full-HP legendaries almost never stay in.
- **Trainers:** they spot you ("!"), walk up and challenge you for prize money. Youngster Joey's Rattatat is in the top percentage.
- **Levels and moves:** Pokémon level up from battles **and from every demon Alex defeats in real time** (the Exp. Share spreads it). Level-ups show the stat box, and new moves are learned, with "1, 2, and… Poof!" when the moveset is full.
- **Evolution:** the classic sequence, with flickering white silhouettes speeding up, a flash, then "Congratulations!" Press B to stop it; a cancelled evolution comes back at the next level-up. Stones evolve Pikachew, Eevie (five ways), Vulpicks and others.
- **Party and items:** a party of six plus Bill's PC, with a full summary screen (nature, stats, moves with PP). The Bag holds Poké Balls, potions, Revives, Rare Candy and stones. The Gas Station has a **Pokémon Center** and a **Poké Mart**.
- **The follower:** your lead Pokémon follows Alex around the 3D rooms and fights alongside him with its real moves.
- **Pokédex:** it persists between runs and lives in the Compendium.

**∞ Infinite Mode.** Start it from the title menu. Beating the Demon King opens an ENCORE exit back to the parking lot, and every loop gets tougher: +45% enemy HP, +25% damage, a bigger threat budget, more elites, higher wild Pokémon levels and +20% money. Your party, materials, gear and enchantments carry over. The title screen tracks your best loop.

**Random events.** Parked vehicles, a travelling merchant with crossover goods, a crafting table, a burning bush that blesses you, and bigger clear rewards — all rolled generously per room.

**Compendium.** Every creature and vehicle as a rendered 3D portrait, the Nether & End mobs, the Pokédex, plus item cards. Things you haven't met stay silhouettes.

**Accessibility.** Settings cover aim assist, combat camera assist, sensitivity (per axis and per device), inversion, FOV, camera distance, shake 0–100%, motion blur, recentering and its delay, lock hold or toggle, auto-targeting and auto-switch, projectile contrast, attack indicator intensity, perfect-dodge assistance, rapid fire, auto sprint, ledge protection, vibration, photosensitivity (reduce flashing plus a flash intensity slider), render scale reduced UI motion, enemy health bars and full remapping.

## Code map

```
index.html, css/*.css         page + UI styling (game, ui2, mc, pokemon)
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
js/vehicles.js, gadgets.js, companions.js   rides (and prop smashing), the gadget slot, demon pals
js/mc/                        Minecraft: data.js (items, recipes, smelting, XP, enchants, ores, drop tables),
                              icons.js (pixel icons), blocks.js (block textures), world.js (mining, drops,
                              stations, portals, eyes), craftUI.js (the Pack), hudmc.js, mobs.js (Nether mobs),
                              dragon.js (Ender Dragon + crystals), realmLayouts.js (Nether / stronghold / End
                              rooms and maps), realms.js (travel, barterer, spawner, End Portal, End Poem)
js/pokemon/                   types.js, moves.js, dex.js (species, learnsets, habitats), mon.js (stats, EXP,
                              learning, evolution), battleCore.js (battle rules), battle.js (battle screen),
                              scenes.js (evolution + move prompts), sprites.js (procedural pixel sprites),
                              companion.js (follower), index.js (party, grass, trainers, Oakley, Center),
                              packTabs.js (party / PC / Bag / Mart)
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
