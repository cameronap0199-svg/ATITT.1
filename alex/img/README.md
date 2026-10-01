# Optional art overrides

Everything in the game is drawn in code, so nothing here is required. If you want to
use your own artwork (hand-drawn, photos, or AI-generated images you have the rights
to), drop PNG/JPG/WebP files in this folder and list them in `manifest.json`:

```json
{
  "portraits": {
    "gf": "portraits/gf.png",
    "ugly": "portraits/ugly.png",
    "cat": "portraits/cat.png",
    "mario": "portraits/mario.png",
    "demonKing": "portraits/demon-king.png",
    "jesus": "portraits/jesus.png",
    "alex": "portraits/alex.png"
  },
  "items": {
    "sushi": "items/sushi.png"
  }
}
```

- **portraits**: square images (256×256 or larger work best). They replace the caller
  portraits on the phone, the call screen, text messages and the Heartline menu.
- **items**: square images keyed by item id (see `js/items.js`). They replace the
  item card art in the HUD, menus, shop prompts and pickups.

Anything not listed keeps its procedural art.
