# Tap Tap Tactical: The Psychosis Protocol

A cyberpunk, dystopian, comedic, horror, religious **arcade rail-shooter**. It is built from the *Tap Tap Tactical: The Psychosis Protocol* design document.

You are **Subject 87**, an immortal prisoner of the Global Offensive Democracy (G.O.D.) inside the black site **Hades**. You never control movement. The game locks you behind waist-high cover, and you pop up to shoot Tier 1 Angels in a neon cyber-cathedral. Every reload, injection and relic is a **DDR arrow chart** that you play while hiding. Two invisible bars track you:

* **Vitals** are read off an EKG.
* **Cognitive Load** is read off an EEG. As it climbs, 7 of 11 hallucinations stack on top of each other.

Examples include a dancing N64 rat, a JPEG horse, flayed hands and unblinking eyes. At 100% you have ten seconds to swallow the Emergency Sedative, or it's **NEURAL DEATH. PREPARE NEXT SUBJECT.**

It runs entirely in the browser with no build step. Guns, enemies, rooms, hallucinations, music and sound effects are all procedural. The only image files are the concept art from the design document, shown on the title screen and in the lore archive.

## Play

```bash
npm start
# open http://localhost:8080/tap-tap-tactical/
```

The folder is fully static, so you can also serve it with any static host (for example `npx serve tap-tap-tactical`) or GitHub Pages.

You need a keyboard and mouse. Headphones are recommended.

| Action | Input |
| --- | --- |
| Pop up / duck | Hold **Space** / release |
| Aim / fire | Mouse / left click (hold for automatic weapons) |
| Swap Primary / Secondary | **Q**, right click or mouse wheel |
| Reload (in cover) | **R**, or click a gun silhouette |
| Hit arrows | **← ↓ ↑ →** or **W A S D** |
| Consumables / relics (in cover) | **1–4** / **5–8**, or click them |
| Pause | **Esc** |

## What's in it

### The combat loop

* **Cover system:** you can only take damage, and only shoot, while you are popped up. Accuracy sways the longer you stay exposed.
* **Threat Rings:** a hollow cyan ring fills clockwise, turns yellow, then flashes red and fires a burst. After a hit, 0.5 s of I-frames freeze the EKG white.
* **The Power Tax:** reload charts scale with the weapon's tier:

  | Tier | Arrows | Chart |
  | --- | --- | --- |
  | Standard | 3–4 | Slow |
  | Tactical | 6–8 | Moderate |
  | Heavy | 10–12 | Clustered |
  | Experimental | 15+ | Stuttering notes |

  A missed arrow jams the gun, and you restart the chart from the first arrow. An all-PERFECT reload loads glowing **Overload Rounds**.
* **The consumable grid:** four slots holding Stim-Syringe, Sedative and Adrenaline. Click an item, then play a short pill chart. Popping up cancels it and keeps the item. Missing an arrow wastes it.
* **Invisible combo:** the counter only appears after 3 hits in a row. It snaps on a missed shot, a missed arrow or taking damage.

### Enemies and bosses

* **G.O.D. Tier 1 Angels** and gold-haloed **Seraph Guards**.
* **Uriel's Embers:** they throw blue grenades. Shoot the grenade out of the air, or your cover burns and ducking hurts.
* **Prisoners of F.A.I.T.H.:** never shoot them. Killing one adds +20% load, the Static of Guilt and a whisper of her name.
* **Bejeweled Berserkers:** armored except for a shifting weak point. They lunge, then hop back.
* **Failed Subjects:** these bunker-busters crawl over your cover.
* **Phantom Hostiles:** shooting one counts as a miss.
* **Archangel Unit-01 "The Warden"** has three phases:
  1. Four Threat Rings at once, plus summons.
  2. The Great Divider laser sweep, which you must duck.
  3. The Falling Star: 15 core hits before Final Judgment.
* **Experiment A-4RON** is the Quarantine mini-boss.

### The run

* **Mainframe Topology map:** forward-only routing with burnt nodes and encrypted rooms. Every route ends at the `[SYSTEM_CORE]`.
* **Room types:**
  * `[SEC_BREACH]` combat rooms.
  * `[GATEWAY]` rooms: either the Jammed Bulkhead QTE or the Dance Soldier duel, a Friday Night Funkin'-style dance-off.
  * `[CONTAINMENT_CELL]` item vaults: take one of two items, and the other is locked away.
  * `[QUARANTINE_SECTOR]`: 30 hostiles.
  * `[NULL_ZONE]` rooms: the Sacrament Dispenser™ shop, a hidden armory, story terminals, or a gag room. Gag rooms include the break room, the confessional booth, the gift shop and karaoke chapel.
* **15 items** combine the doc's six (Dove In a Cage, Metal Boots, Sacred Heart, Throwing Stone, Blanket of Worms, Angry Water) with new ones in the same spirit, for example the Wormwood Shard.
* **8 weapons:** pistol, Slapper, assault rifle, Double Barrel Doodler, Judgment Cannon, Thurible Launcher, Needler and Seraph Railgun.
* **The Infinite Descent:** every floor multiplies enemy health, speed and damage by 1.5×. Speed is capped at 3× so it stays readable.

### Story and extras

* **Lore Archive:** every chapter from the document, with its concept art. Chapters unlock at story terminals and when a Warden falls.
* **Cheat codes:** type these at the title screen's `> ENTER CODE` prompt. Enter a code again to turn it off.

  | Code | Effect |
  | --- | --- |
  | `9074` | One Shot Bullet |
  | `4612` | Unlock All (all lore plus an Armory loadout picker) |
  | `7298` | Invincibility |
  | `1111` | First Floor Boss Skip (warps straight to the Warden) |

* **Settings:** volume controls, **Reduce Flashing**, screen shake and optional text-to-speech voice lines.

## Code map

```
index.html            entry page (fonts, canvas, overlay root)
css/game.css          terminal-green overlays
js/main.js            boot, letterboxing, frame loop, input timing
js/game.js            run flow, rewards, containment cells, null zones, menus
js/combat.js          the rail-shooter room: cover, shooting, DDR utility, overload, death
js/enemies.js         Angels, Embers, Prisoners, Berserkers, Failed Subjects, Warden, A-4RON
js/minigames.js       Jammed Bulkhead QTE and the Dance Soldier duel
js/screens.js         title, sector map, decryption, elevator, game over
js/ddr.js             rhythm engine (pure): charts, judging, restart / fail / requeue
js/psyche.js          Vitals states, Cognitive Load, hallucination draw, combo (pure)
js/map.js             sector map generation and routing (pure)
js/data.js, lore.js   all tuning numbers and writing
js/scene.js, figures.js, viewmodel.js, hud.js, ddrView.js, hallucinations.js   procedural art
js/audio.js           WebAudio sound effects and music
assets/art/           concept art from the design document (lore archive and title)
```

The pure modules are covered by `tests/tap-tap-tactical.test.js` (`npm test` at the repo root).
