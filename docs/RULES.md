# Knotwood — Complete Rules Reference

This document combines two sources:

* the **Phase 2 – Card Framework** design document (card types, classes, factions, archetypes, rarity, boosters and visual language), which the game implements as written;
* the **core play rules** (board, resources, turn structure, win condition), which the framework assumes but does not define. They were designed to fit it and are marked **[Core]** below.

All numbers live in [`shared/constants.js`](../shared/constants.js) and can be tuned in one place.

---

## 1. Components

### 1.1 Cards (framework)
* **Seven Card Types:** Identity, Zone, Structure, Equipment, Consumable, Action, Event.
* **Classes** are type-specific. Each type has 5 classes, and the *n*-th class of every type forms a "Class slot" used by booster affinity:

  | Slot | Identity | Zone | Structure | Equipment | Consumable | Action | Event |
  |---|---|---|---|---|---|---|---|
  | 1 | Silviculturist | Environmental | Shelter | Tool | Trinket | Interaction | Object |
  | 2 | Hydrologist | Terrain | Bastion | Accessory | Enchantment | Command | Weather |
  | 3 | Understory | Property | Den | Armor | Recovery | Maneuver | Space-Time |
  | 4 | Poacher | Domain | Landmark | Weapon | Provision | Technique | Customs |
  | 5 | Forager | Territory | Facility | Trap | Catalyst | Reaction | Ecology |

* **8 Factions:** Feathered, Pelted, Scales, Arthropod, Knot-Bots, Ghoul, Magically-Mutated, Character.
* **15 Archetypes:** Ancestry, Succulence, Stagnation, Hardpan, Friction, Scarcity, Obscurity, Seclusion, Venom, Monopoly, Labor, Infrastructure, Persistence, Erosion, Predation.
* **Set 1 — Knotwood Forest** has 280 cards: 85 Identities, 35 Zones, 35 Structures, 35 Equipment, 25 Consumables, 40 Actions and 25 Events. That is 56 per Class slot: 14 Base, 12 Bronze, 10 Silver, 9 Gold, 6 Crystal, 4 Void and 1 Infinite (Infinite is Identity-only).

### 1.2 Identity stats (framework)
`Stat = Identity Stat Budget × Class Weight × Individual Modifier`

| Class | BP | SP | MP | AP | RP |
|---|---|---|---|---|---|
| Silviculturist | 30% | 20% | 18% | 12% | 20% |
| Hydrologist | 16% | 16% | 28% | 24% | 16% |
| Understory | 16% | 18% | 18% | 30% | 18% |
| Poacher | 15% | 32% | 15% | 23% | 15% |
| Forager | 21% | 18% | 25% | 18% | 18% |

**[Core]** An Identity's budget is `ISB = 8 + 3 × Sap cost` (+1 for Silver/Gold, +2 for Crystal/Void, +3 for Infinite). Results are rounded. AP is capped at 6 and RP at 4 for the board size.

Every Identity has a **Unique Ability** and a **Shared Ability** set by its Class + Archetype. All 75 Shared Abilities from the framework are implemented word for word.

---

## 2. The battlefield [Core]

* **5 Lanes**, each **2 tiles wide** and **8 tiles long** (a 10 × 8 grid). Each player's **half** is the 4 rows nearest them.
* Each Lane has a **Structure slot** at each end, just behind that player's first row. A Structure counts as occupying both of its Lane's columns, one step behind the edge row.
* **Distance** is counted in tiles and includes diagonals (Chebyshev distance). "Adjacent" means distance 1.
* **Setup:** each player starts with a *Homeland* Zone and a *Base Camp* Structure (12 BP, Housing 3) in their home Lane: Lane 2 for the first seat and Lane 4 for the second.

## 3. Resources [Core]

* **Sap** is refilled at the start of each of your turns to **3 + (turns taken − 1)**, up to a maximum of 10. The second player gets +1 Sap on their first turn. Unspent Sap stays available for Responses during your opponent's turn.
* **MP** starts full. Each Identity restores **2 MP** at the start of its controller's turn.
* **Renown** is the victory track.

## 4. Deck & hand [Framework + Core]

* Decks have **60–120 cards**, with at most **3 copies** of any card regardless of rarity.
* **Opening hand:** 6 cards, always including one Zone and one Structure if the deck contains them. Each player may **redraw once**.
* The first player skips their first draw. Hand limit is **10**; further draws are discarded. Drawing from an empty deck costs 2 Renown instead.

## 5. Turn structure [Core]

1. **Start of turn:** refill Sap. Gain Renown (see §8). Ready your Identities, reset their AP and attacks, and restore MP. Resolve start-of-turn effects. Draw a card.
2. **Main phase:** in any order and as often as you can afford:
   * play cards;
   * **activate** Identities (move, attack, use abilities);
   * use attached Consumables;
   * **Forage** once per turn: pay 1 Sap, discard a card, draw a card.
3. **End of turn:** end-of-turn effects, then **Liberation** (§7). Effects that last "this turn" expire.

## 6. Playing cards

| Type | How to play [Core] |
|---|---|
| **Zone** | Target an **open** Lane, or **your own** Lane with no Structure (the old Zone is replaced). To **capture** an enemy Lane, it must have no enemy Structure and you must have an Identity in the **enemy's half** of that Lane. Capturing gives +2 Renown. A Zone cannot be replaced while its Structure stands (framework). |
| **Structure** | Build in a Lane you control that has no Structure. |
| **Identity** | Summon it onto an empty tile adjacent to one of your Structures that has free **Housing**. Housing counts living Identities summoned through that Structure (framework). Summoned Identities may act immediately. |
| **Equipment** | Attach to a friendly Identity. One Equipment slot; attaching another replaces it (framework). |
| **Consumable** | Attach to a friendly Identity (one slot). Use it later from that Identity; it is then discarded (framework). |
| **Action / Event** | Resolve the effect. **⚡ Response** cards may also be played while a chain is open. |

## 7. Identities, combat and Lanes [Core]

### Activation
* Selecting an Identity and moving, attacking or using an ability with it **activates** it. Acting with a different Identity ends the previous activation. An Identity whose activation has ended is **done** for the turn.
* During an activation an Identity may:
  * move up to its **AP** in any direction, one tile at a time;
  * make **one attack**;
  * use each of its abilities **once**, paying MP;
  * do these in any order.
* **Free Steps.** "May move 1 tile" effects grant a Free Step. It can be used any time during your turn, even after the Identity is done, and expires at the end of your turn.

### Attacks
* Target an enemy Identity or Structure within **RP**. The target takes damage equal to the attacker's **SP**, adjusted by bonuses and reductions. An attack from 2 or more tiles away is a **ranged attack**.
* **Retaliation:** a defending Identity that survives, with the attacker within its RP, automatically spends **1 MP** to deal **half its SP** (rounded up) back.
* **Forced movement** (push/pull) that is blocked by an edge, obstacle or unit deals **1 collision damage**.
* An Identity reduced to 0 BP is defeated and goes to the discard pile with its attachments. A Structure reduced to 0 BP is destroyed and gives its attacker's controller **+3 Renown**.

### Lanes
* An Identity in a Lane its controller owns is **defending**. In an enemy Lane it is **invading**. A Lane with Identities from both players is **contested**.
* **Liberation:** at the end of your turn, an enemy Lane with no enemy Structure and no enemy Identities, where you have an Identity in the enemy's half, becomes **open** (+1 Renown).

## 8. Winning [Core]

* At the start of your turn, gain **+1 Renown for each Lane you control that holds your Structure**.
* **+3** for destroying an enemy Structure, **+2** for capturing a Lane, **+1** for liberating a Lane.
* The first player to **20 Renown** wins.
* Controlling **all 5 Lanes** at the start of your turn wins instantly (**Dominion**).
* After **round 30**, the player with more Renown wins.

## 9. The chain (responses) [Framework + Core]

* Declaring an attack or playing an Action/Event opens a **chain**. The opponent receives priority and may play a **⚡ Response**. Each Response gives priority back to the other player.
* When a player **passes**, the chain resolves **newest to oldest** (framework).
* Targets are re-checked on resolution. An attack whose target is out of range **misses**, and a card whose target is gone **fizzles**.

## 10. Boosters (framework)

* **12 cards:** 3 Identities, 1 of each other type, 2 **flex** slots, and 1 **Wildcard**.
* **Flex weights:** Identity 21.43%, Zone 16.67%, Structure 16.67%, Equipment 16.67%, Consumable 2.38%, Action 23.81%, Event 2.38%.
* The first 11 slots are shuffled, then assigned rarity profiles:

  | Profile | Slots | Odds |
  |---|---|---|
  | Foundation | 6 | Base 50 / Bronze 35 / Silver 15 |
  | Enhanced | 3 | Bronze 25 / Silver 45 / Gold 25 / Crystal 5 |
  | Premium | 2 | Silver 40 / Gold 35 / Crystal 20 / Void 5 |

* **Wildcard:** Gold 50 / Crystal 30 / Void 17 / Infinite 3. An Infinite Wildcard is always an Identity.
* **Hidden Affinity Profile:** 3 Classes (×1.30 weight) and 3 Factions (×1.35 weight).
* **Duplicates within a pack:** the second copy has ×0.5 weight and the third ×0.1.
* **Cosmetics:** 81 cosmetic variants (3 primary × 3 secondary × 3 accent colours × 3 patterns) and an 8% foil chance. These never affect gameplay.
* **[Core]** Copies beyond 3 in your collection are recycled into Acorns.

## 11. Economy & progression [Core]

* New players start with the 60-card **Beginner's Grove** deck, 300 Acorns and 1 free booster.
* **Match rewards (Acorns):**
  * Win vs AI: 40 + 15 × difficulty (Adventure rivals pay their listed reward). Loss: 15 + 3 × difficulty.
  * Online: 150 for a win, 50 for a loss.
  * Bonuses: destroyed Structures, captured Lanes, defeated foes, Flawless Defense, first win of the day (+100), and first victory over an Adventure rival (+100 and a free pack).
  * Daily login gift: +100.
* **Shop prices:**
  * Booster: 100
  * Bundle of 5: 450
  * Box of 10: 850
  * Class Focus Pack: 140 (your chosen Class slot is guaranteed to be featured in the pack's affinity).
