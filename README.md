# 🌳 KNOTWOOD — Tactical Card Battle

An anime-flavoured, early-2000s-JRPG-styled **tactical trading card game** built from the *Phase 2 – Card Framework* design document (Set 1: **Knotwood Forest**).

* **Duel AI rivals** — a 10-stage Adventure ladder of rivals with scaling difficulty, plus Free Battle at any difficulty (1–10).
* **Play online** — Quick Match or private 4-letter room codes, with turn timers, reconnection and emotes.
* **Collect** — earn Acorns every match, buy booster packs in the shop and open them in a pack-opening ceremony with rarity reveals.
* **Build decks** — a Deck Workshop with filters, mana curve, validation and Auto-Fill. You start with a 60-card beginner deck.
* **The full Set 1** — all **280 cards** in the exact type / class / rarity distribution of the design doc, all **75 Class + Archetype shared abilities**, 8 Factions, 15 Archetypes and 7 rarity frames (Base leather → Infinite holo).

No build step and no art assets: everything, including card art, frames, particles, music and sound effects, is generated procedurally in the browser.

---

## Quick start

```bash
npm install
npm start
# open http://localhost:8080
```

* Single-player modes (Adventure, Free Battle, Shop, Collection, Decks) run entirely in the browser. You can also host the repo root on any static host, such as GitHub Pages.
* **Online play** needs the Node server (`npm start`). Open two browser tabs to try online play against yourself. To point a static-hosted client at a remote server, set *Settings → Online server* (e.g. `wss://your-host/ws`).
* Environment variables: `PORT` (default `8080`), `TURN_SECONDS` (default `100`).

### Tests & simulations

```bash
npm test                    # engine, card set, booster odds and AI tests
npm run sim -- 10 5 5       # 10 headless AI-vs-AI games at difficulty 5 vs 5
node tests/stress.js 30     # 30 games across all difficulty pairings
```

---

## How the game plays

The design document defines the cards; the core turn rules (board, resources, win condition) were not included, so they are defined here in a way that stays consistent with the framework. The full reference is in [`docs/RULES.md`](docs/RULES.md) and in-game under **How to Play**.

* **Board:** 5 Lanes × 2 tiles wide, 8 rows long. Structures sit at each Lane's edge. Each player starts with a *Homeland* Zone and a *Base Camp* Structure.
* **Sap:** your per-turn resource (3 on turn 1, +1 per turn, max 10).
* **Win:** first to **20 Renown**. Each Lane holding your Structure earns +1 Renown per turn. Destroying Structures gives +3, capturing Lanes +2 and liberating Lanes +1. Controlling all 5 Lanes wins instantly.
* **Identities** are summoned beside your Structures (limited by Housing). They move with AP, attack targets within RP for SP damage, spend MP on abilities and retaliate automatically.
* **Responses:** ⚡ Response cards can interrupt attacks and cards. The chain resolves newest to oldest.

### Controls

| Action | Input |
| --- | --- |
| Select / move / attack | Left-click Identity → blue tile / red-ringed enemy |
| Play a card | Click it then a glowing target, or drag it onto the board |
| Inspect | Right-click anything |
| End turn / pass | `Space` |
| Next ready Identity | `Tab` |
| Undo move | `Z` |
| Forage (swap a card) | `G` |
| Camera | Drag / right-drag pan · wheel zoom · middle-drag or `Q`/`E` rotate · `R`/`F` tilt · `C` reset |

---

## Project layout

```
index.html              entry page
client/css/             base (JRPG windows), cards (rarity frames), screens, battle (3D board)
client/js/main.js       boot, title, onboarding
client/js/screens/      hub, ladder, shop + pack opening, collection, deck builder, online lobby, rules, settings
client/js/battle/       battle view & animations, 3D board + camera, match controllers, AI web worker
client/js/cardView.js   card rendering + procedural art
client/js/audio.js      synthesized SFX + chiptune sequencer
client/js/fx.js         particle effects
shared/constants.js     all tuning numbers (board size, Sap, Renown, ISB…)
shared/cards.js         the 280-card set, 75 shared abilities, tokens
shared/engine.js        rules engine (deterministic, JSON state, chain/response system)
shared/ai.js            AI planner with difficulty profiles
shared/packs.js         booster generation (affinity, slot rarities, wildcard, duplicates)
shared/decks.js         deck rules, beginner deck, rival ladder & deck generator
server/server.js        static server + WebSocket matchmaking (authoritative engine)
tests/                  node:test suites + simulations
```

The profile (collection, decks, Acorns) is saved in your browser's `localStorage`. You can export or import it from Settings.
