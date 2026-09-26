# Starving Artist

A PS1-style weirdcore / dreamcore psychological horror game about Nate, a young painter, reliving her memories inside the **Vista Venue**, a dreamlike museum that remembers every choice she makes.

Everything is generated in the browser: low-poly geometry, textures, paintings, music and sound effects (three.js + canvas + WebAudio). There are no pre-made assets.

## Play

```bash
npm install
npm start
# open http://localhost:8080/starving-artist/
```

You can also serve this folder from any static host. It uses ES modules, so opening `index.html` straight from disk (`file://`) won't work.

A first playthrough takes about 60 minutes and is meant for one sitting. Headphones help.

## Controls

| | Keyboard & mouse | Gamepad | Touch |
|---|---|---|---|
| Move | WASD / arrows | left stick | left stick |
| Look | mouse (click to capture) | right stick | drag the right side |
| Run | Shift (stamina) | L3 / LT | RUN toggle |
| Phone flashlight | F | Y | ☀ |
| Interact / advance | E, Space, click | A | tap, or E button |
| Choices | 1 2 3, arrows | d-pad + A | tap |
| Journal | Tab / J | Select | J |
| Pause | Esc / P | Start | II |

Painting: drag Ideas onto the canvas, drag to move them, scroll or `[` `]` to resize, `F` to flip, right-click or `Del` to remove, `Ctrl+Z` to undo. The Brush tool paints freehand, and the Washes set the background.

## How it plays

1. **Explore the Vista Venue** and find the glowing blank canvas.
2. **Enter a memory.** Choose **two of Create / Bond / Duty**. The third is neglected, and the game shows you what that costs.
3. **Live it.** Talk to Nate's family and friends, work, eat, sleep, or paint.
4. **Paint.** Inspiration's thought bubbles suggest which Ideas to use and where to put them, or which spaces to leave empty. Following them feels natural.
5. **Return.** Your painting now hangs in the Venue. Look away, then look back. **Alienate** stands in the space you left for it, or hides behind the thing Inspiration asked you to place.
6. The Venue changes: gates open, plants wilt when Duty is neglected, faces vanish from the family portrait when Bond is neglected, empty frames multiply when Create is neglected, and watchers gather as you obey Inspiration. Later, Alienate climbs out of the paintings and hunts you. You can hide in wardrobes.

Seven chapters: *Moving Day, Open Mic, Fever, The Commission, Holiday, The Opening*, and a final canvas.

**Four endings:** Natalee, Gone, Cult Following, and Boring. Which one you get depends on your Create / Bond / Duty balance and how much of Inspiration you obeyed.

## Presentation

- A boot sequence and brightness calibration, then a live title screen set in the Venue.
- Cinematic letterboxing in cutscenes, NOW LOADING screens with tips, and a memory-card save icon.
- A phone viewmodel with a real flashlight (a per-vertex spotlight, as the hardware of the era would have done it). Its screen dissolves into static and the speaker hisses when Alienate is near.
- Dust motes, falling ash, light shafts, paint splatters and drips, and Alienate's black footprints.
- Alienate moves in stop-motion, twitches, breathes, freezes and screams before it charges, and is drawn to your light.
- Scripted set pieces in every chapter, per-room ambience and reverb, and a tension layer during hunts.
- 12 collectible sketchbook pages of backstory, a keepsake for every priority you complete, and a hand-drawn auto-map in the journal.

## Quality of life

- Autosaves each time you return to the Venue, with Continue on the title screen
- Nate's journal of every memory, choice, neglect and painting
- Objective hints (can be turned off), subtitles and a typewriter with a skip option
- Settings: volumes, sensitivity, invert Y, FOV, head bob, resolution (200p–480p), dithering, vertex jitter, texture warping, CRT lines, grain, text size and speed, and reduce flashing
- A content note before starting; keyboard, gamepad and touch support
- If you're caught, you respawn nearby after a short scare. No lives are lost and no progress is erased.

## Code map

| File | What it does |
|---|---|
| `js/renderer.js` | PS1 pipeline: low-res target, vertex snapping, affine UVs, Gouraud lights, dithered 15-bit post pass |
| `js/level.js` | grid levels → batched geometry, baked lighting with grid shadows, collision, line of sight, A* |
| `js/venue.js` | the Vista Venue layout, per-chapter consequences, puzzles, hunts and the finale |
| `js/memories.js`, `js/mem_a.js`, `js/mem_b.js` | the memory framework and its six scenes |
| `js/painting.js`, `js/ideas.js` | painting minigame, Inspiration, composition renderer, Alienate inside paintings |
| `js/alienate.js` | the stalker's model and AI |
| `js/story.js` | chapter text, painting prompts, Inspiration scripts and endings |
| `js/audio.js` | procedural music beds, ambience and positional SFX |

Developer shortcut: `?chapter=N&picks=cb,bd,cd,...` jumps to the Venue after N memories, using placeholder records.
