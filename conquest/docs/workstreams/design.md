# Art director / graphics designer (`ws/design`)
Owns `docs/STYLE.md`, `assets/` (new), `js/ui/heraldry.js`, `js/ui/portrait.js`, `js/render/models.js` (3D model shapes and materials only — coordinate with `ws/render`, which owns the rest of rendering).

1. Write `docs/STYLE.md`: the visual identity (illuminated-manuscript meets HOI4: palette tokens, typography, icon grid, panel chrome, map label style, realm colour rules for legibility). The UI workstream applies it to `css/style.css`; give them exact CSS variables in an issue.
2. Icon set: replace emoji in the UI with a consistent inline-SVG icon set (`assets/icons/*.svg` + a small `js/ui/icons.js` loader). File issues for `ws:ui` to adopt them.
3. Heraldry & portraits: proper tinctures and charges per realm, crowns/mitres by rank, culture-specific clothing and faces in `portrait.js`.
4. 3D models: culture-specific castles, churches/mosques/kremlins, distinct unit silhouettes (knights, levy spears, horse archers), keeping instance counts and polygon budgets low.
Verify with screenshots from `npm run smoke` and close-zoom shots; attach before/after images in your issue comments.

## Status
_Updated 2026-10-26._
- **Done:** `docs/STYLE.md` v1. `ws:ui` issue #1 filed (CSS tokens + `.ic` CSS). Icons: `js/ui/icons.js` (56 glyphs, `icon()`, `iconFor()`, `iconize()`, `EMOJI` map covering ~95 emoji) + `assets/icons/*.svg` (regenerate with `node assets/icons/export.mjs`).
- **Visuals pass 1 (done):** terrain bake richer — per-biome tone patches, grain, northern tundra, stronger hillshade, turquoise coastal shallows (`js/render/terrain.js`).
- **Next (orchestrator list):** 2) trees/mountains 3) effects (water foam, clouds, seasons, smoke, dust) 4) CSS vars + icon adoption.
- **Older next:**
  1. File `ws:ui` icon adoption issue (use `iconize()` on panel HTML; add `.ic` CSS from issue #1).
  2. Heraldry: rank crowns above shields (`coaSVG(coa, size, {rank})`), add tenné/sanguine tinctures.
  3. Portraits: culture-specific clothing and headgear.
  4. models.js: culture variants (kremlin, Mediterranean tile roofs), unit silhouettes. Keep to STYLE.md §8 budget.
- Unmapped rarer emoji (✂ 🍷 🦊 …) stay as emoji until more glyphs are drawn.
