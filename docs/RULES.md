# Knotwood — Complete Rules Reference

This document combines two design documents, both implemented as written:

* **Phase 1 – Core Game Rules** (objective, formats, battlefield, territory, turn structure, hand, combat, response sequence);
* **Phase 2 – Card Framework** (card types, classes, factions, archetypes, rarity, boosters and visual language).

Where the documents leave a number or a detail open, the game's choice is marked **[Impl]**.

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

**[Impl]** Each Identity has a power **tier** 1–6 (the number in the card's corner). Its budget is `ISB = 16 + 4 × tier` (+2 for Silver/Gold, +4 for Crystal/Void, +6 for Infinite). Results are rounded. For the board's scale, AP is capped at 8 and RP at 5, AP is at least 3 and MP at least 2 (so every Identity can attack). Body is multiplied by 2 so fights last more than one hit.

Every Identity has a **Unique Ability** and a **Shared Ability** set by its Class + Archetype. All 75 Shared Abilities from the framework are implemented word for word.

---

## 2. Objective & formats

* Dominate the battlefield by expanding territory and **eliminating** opponents. The last player (or team) remaining wins.
* A player stays active while they control **at least one Structure or at least one Identity**. With **no Structures and no Identities** they are eliminated and everything they control is removed. Losing the final Structure doesn't eliminate a player who still has Identities.
* **Formats:** **1v1**; **2v2** (two teams; a team wins when both opposing players are eliminated; one teammate may be knocked out while the other plays on); **Free-for-All** with 3 or 4 players.
* **[Impl]** A player is only checked for elimination after they have had 3 turns or once they have put a Structure or Identity into play, so nobody is knocked out before they can build. A safety limit of **60 rounds** awards the win to the team with the most Structure BP + Identities.

## 3. The battlefield

* A **square, tile-based** board. Each player sits on one side with **three adjacent Home Lanes**, each **5 tiles wide and 12 tiles long**.
* **[Impl]** The board is 39 × 39: four 15-tile-wide arms of Lanes around a central 15 × 15 **Void**. The four 12 × 12 corners are off the board, so it is plus-shaped. Arms without a player are Void as well. The client always rotates the board so your side is at the bottom.
* **The Void** is neutral and can't be claimed or hold Zones or Structures. Identities may enter it, cross it and stand in it, using normal movement. Adjacent Lanes can be crossed directly.
* Each Lane holds **one Zone** and **one Structure**. **Distance** counts diagonals (Chebyshev); "adjacent" means distance 1.
* **Setup:** starting with a random first player, each player may place Zones into their own Home Lanes. No Identity is required there, and this exception only applies to starting Home Lanes. Play then proceeds clockwise.

## 4. Territory

* **Zones:** a Lane without a Zone is **unclaimed**. Playing a Zone there takes control. To claim or replace a Lane **outside your Home Lanes** you need at least one of your Identities in it. A Zone stays until replaced.
* **Structures:** built on a tile inside a Lane whose Zone you control, one per Lane. There is no battlefield-wide limit. Each has BP, one ability and a **Housing Capacity** set by its Class: **Shelter 3, Bastion 2, Den 5, Landmark 3, Facility 3**. Housing is an **active-unit cap**: Identities summoned through it count while they live. It is not a per-turn limit. **[Impl]** Structure BP is the card's base value × 2.5.
* **Capturing an enemy Lane:**
  1. at least one of your Identities enters the Lane;
  2. its enemy Structure is destroyed;
  3. the Zone can't be replaced during the turn the Structure fell;
  4. the defender receives **their next turn to rebuild**;
  5. after that turn, if it hasn't been rebuilt, the Zone becomes eligible;
  6. with an Identity in the Lane, you play your own Zone to replace it and control transfers immediately.

  Enemy Identities do not have to be removed first.
* Destroying a Structure does **not** destroy the Identities it summoned.

## 5. Hand & deck

* Decks have **60–120 cards**, at most **3 copies** of any card, with no Class/Faction/Type restrictions.
* **Hand size is 7.** In the **Draw Phase** you draw until you hold 7. **[Impl]** Effects that would draw beyond 7 discard the extra card. Your opening hand is 7 cards, including a Zone, a Structure and an Identity if the deck has them.
* In the **End Phase** you may discard any number of cards (none, some or all).
* When you need to draw and your deck is empty, shuffle your discard pile into a new deck and keep drawing.

## 6. Turn structure

1. **Draw** up to 7.
2. **Zone** — claim Lanes / capture eligible Lanes.
3. **Build** — build Structures.
4. **Summon** — summon Identities through Structures with free Housing. Each one is deployed onto any empty tile of that Structure's Lane.
5. **Equipment** — attach Equipment and Consumables (one slot each per Identity).
6. **Movement & Combat** — activate Identities one at a time.
7. **End** — effects that end "this turn" expire, you may discard cards, then play passes clockwise.

**[Impl]** Playing a card moves you forward to its phase, and you can't go back. You can also skip ahead from the phase tracker. Actions and Events may be played at any point in your turn. At the **start of each of your turns**, your Identities recover all lost **BP** and refresh their **MP**.

## 7. Movement & combat

* **Activation:** select an Identity, move it (optional), then immediately resolve any attacks or abilities, then finish and pick another. Each Identity **moves once per turn** (unless an effect allows more), up to its **AP** in tiles, orthogonally or diagonally. It can't pass through other Identities or share a tile. There are no opportunity attacks. Once it starts attacking or using abilities it can't keep moving unless an effect says so.
* **Attacks** target any enemy Identity or Structure within **RP** tiles, dealing **SP** damage. Other units don't block attacks, and Structures can be attacked even with defenders nearby. **[Impl]** A basic attack costs **2 MP**.
* **Abilities** cost MP. An Identity may keep attacking and using abilities while it can pay, so MP determines how much it does per turn.
* **Retaliation:** when an Identity is attacked and survives, it may strike back at the attacker if the attacker is within its RP, paying the attack's MP cost. **[Impl]** This is automatic (toggle in Settings) and deals full SP.
* **[Impl] Free Steps:** "may move 1 tile" effects grant a Free Step. It can be used during your turn even after the Identity has finished, and expires at end of turn.
* **Forced movement** (push/pull) that is blocked deals **1 collision damage**.
* An Identity reduced to 0 BP is defeated and discarded with its attachments. **[Impl]** Tokens are capped at 6 per player.

## 8. Lanes & positions

* An Identity in a Lane its team controls is **defending**, and one in an enemy Lane is **invading**. A Lane with opposing Identities in it is **contested**. Many Shared Abilities key off these.

## 9. Response sequence

* Declaring an attack, playing an Action/Event, or using a Consumable opens a **response sequence**. Every other player, in turn order, may add a **⚡ Response** (a Reaction card or a Consumable marked as a response). Each response gives everyone another chance.
* When every player passes in a row, the sequence resolves **newest to oldest**. **[Impl]** The player who added the newest item isn't asked again about their own item, and players with no legal response are skipped automatically.
* Targets are re-checked on resolution: an attack whose target moved out of range **misses**, and a card whose target is gone **fizzles**.

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
* **[Impl]** Copies beyond 3 in your collection are recycled into Acorns.

## 11. Economy & progression [Impl]

* New players start with the 60-card **Beginner's Grove** deck, 300 Acorns and 1 free booster.
* **Match rewards (Acorns):**
  * Win vs AI: 40 + 15 × difficulty (Adventure rivals pay their listed reward). Loss: 15 + 3 × difficulty. Multiplayer formats pay ×1.25.
  * Online: 150 for a win, 50 for a loss.
  * Bonuses: destroyed Structures, captured Lanes, defeated foes, eliminated players, Flawless Defense, first win of the day (+100), and first victory over an Adventure rival (+100 and a free pack).
  * Daily login gift: +100.
* **Shop prices:**
  * Booster: 100
  * Bundle of 5: 450
  * Box of 10: 850
  * Class Focus Pack: 140 (your chosen Class slot is guaranteed to be featured in the pack's affinity).
