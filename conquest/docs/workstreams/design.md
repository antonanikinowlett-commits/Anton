# Art director / graphics designer (`ws/design`)
Owns `docs/STYLE.md`, `assets/` (new), `js/ui/heraldry.js`, `js/ui/portrait.js`, `js/render/models.js` (3D model shapes and materials only — coordinate with `ws/render`, which owns the rest of rendering).

1. Write `docs/STYLE.md`: the visual identity (illuminated-manuscript meets HOI4: palette tokens, typography, icon grid, panel chrome, map label style, realm colour rules for legibility). The UI workstream applies it to `css/style.css`; give them exact CSS variables in an issue.
2. Icon set: replace emoji in the UI with a consistent inline-SVG icon set (`assets/icons/*.svg` + a small `js/ui/icons.js` loader). File issues for `ws:ui` to adopt them.
3. Heraldry & portraits: proper tinctures and charges per realm, crowns/mitres by rank, culture-specific clothing and faces in `portrait.js`.
4. 3D models: culture-specific castles, churches/mosques/kremlins, distinct unit silhouettes (knights, levy spears, horse archers), keeping instance counts and polygon budgets low.
Verify with screenshots from `npm run smoke` and close-zoom shots; attach before/after images in your issue comments.

## Status
_Updated 2026-10-26 (handover)._
- **Done:** `docs/STYLE.md` v1: palette tokens (with exact CSS to add to `:root`), type scale, panel chrome, icon grid and API spec, realm-colour legibility rules, map label table, heraldry rank rules, 3D model budget. Contrast ratios checked.
- **Half-done:** nothing in progress. The issue for `ws:ui` with the CSS variables from STYLE.md §1 (and the `.ic` CSS from §4) is **not filed yet**.
- **Next:**
  1. File a `ws:ui` issue with the STYLE.md §1 `:root` block and §4 `.ic` CSS.
  2. Icons: write `js/ui/icons.js` (24×24 filled `currentColor` paths, `icon()`, `iconFor()`, `iconize()`, `EMOJI` map) plus `assets/icons/export.mjs` to write `assets/icons/*.svg`. Emoji inventory: about 140 distinct emoji. The most common are ⚔ 🚫 📜 🏰 👑 🛡 🔥 🌾 🐎 🕊 ★ 🤝 ⚓ ✠ 🪙 🏛 ⚖ 💰 ✝, mostly in ui.js, panels.js and the data tables. Then file a `ws:ui` adoption issue.
  3. Heraldry: rank crowns above shields (`coaSVG(coa, size, {rank})`), add tenné/sanguine tinctures.
  4. Portraits: culture-specific clothing and headgear.
  5. models.js: culture variants (kremlin, Mediterranean tile roofs), unit silhouettes. Keep to the STYLE.md §8 budget.
- No open `ws:design` issues as of this update.
