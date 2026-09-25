# 🌳 KNOTWOOD — Tactical Card Battle

An anime-flavoured, early-2000s-JRPG-styled **tactical trading card game** built from the *Phase 1 – Core Game Rules* and *Phase 2 – Card Framework* design documents (Set 1: **Knotwood Forest**).

* **Battle AI bots** — a 10-stage Adventure ladder of rivals with scaling difficulty, plus Free Battle at any difficulty (1–10) in **1v1, 2v2 (with a bot ally) or Free-for-All for 3–4 players**.
* **Play online** — Quick Match duels, or private 4-letter rooms for any format (1v1 / 2v2 / FFA up to 4) where bots fill empty seats; turn timers, reconnection and emotes.
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
npm run sim -- 10 5 5       # 10 headless AI-vs-AI duels at difficulty 5 vs 5
npm run sim -- 4 6 6 ffa4   # ...or any format: 1v1, 2v2, ffa3, ffa4
node tests/stress.js 30     # 30 games across difficulties and formats
```

---

## How the game plays

The core rules follow *Phase 1 – Core Game Rules*; the cards follow *Phase 2 – Card Framework*. The full reference is in [`docs/RULES.md`](docs/RULES.md) and in-game under **How to Play**.

* **Board:** a square 39×39 battlefield. Each player owns one side with **three adjacent Home Lanes** (5×12 tiles); the centre (and any empty side) is **the Void**. Your side is always drawn at the bottom.
* **Win:** eliminate everyone else. You stay in while you control at least one Structure **or** one Identity. Teams win together in 2v2.
* **Turn:** Draw up to 7 → Zone → Build → Summon → Equipment → Movement & Combat → End (discard any cards you don't want). There is no mana: phases, housing and your hand are the limits.
* **Territory:** Zones claim Lanes, Structures (one per Lane) house and summon Identities into their Lane. Destroy an enemy Structure; if its owner doesn't rebuild on their next turn, an Identity of yours in that Lane lets you **capture** it with your own Zone.
* **Combat:** each Identity moves once (up to AP), then attacks for SP within RP at **2 MP per attack** and uses abilities while MP lasts. Defenders **retaliate** by paying the same MP. Identities fully recover BP and MP at the start of their controller's turn.
* **Responses:** ⚡ Response cards and Consumables can interrupt; every player gets a chance in turn order and the newest item resolves first.

### Controls

| Action | Input |
| --- | --- |
| Select / move / attack | Left-click Identity → blue tile / red-ringed enemy |
| Play a card | Click it then a glowing target, or drag it onto the board |
| Inspect | Right-click anything |
| End turn / pass | `Space` |
| Next ready Identity | `Tab` |
| Undo move | `Z` |
| Whole battlefield / home view | `V` / `C` |
| Camera | Drag / right-drag pan · wheel zoom · middle-drag or `Q`/`E` rotate · `R`/`F` tilt |

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
shared/constants.js     all tuning numbers (board geometry, formats, phases, ISB, caps…)
shared/cards.js         the 280-card set, 75 shared abilities, tokens
shared/engine.js        rules engine (deterministic JSON state, N players & teams, phases, response sequence)
shared/ai.js            AI planner with difficulty profiles
shared/packs.js         booster generation (affinity, slot rarities, wildcard, duplicates)
shared/decks.js         deck rules, beginner deck, rival ladder & deck generator
server/server.js        static server + WebSocket matchmaking & rooms (authoritative engine, server-side bots)
tests/                  node:test suites + simulations
```

The profile (collection, decks, Acorns) is saved in your browser's `localStorage`. You can export or import it from Settings.
