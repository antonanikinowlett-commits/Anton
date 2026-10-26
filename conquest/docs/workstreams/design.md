# Art director / graphics designer (`ws/design`)
Owns `docs/STYLE.md`, `assets/` (new), `js/ui/heraldry.js`, `js/ui/portrait.js`, `js/render/models.js` (3D model shapes and materials only — coordinate with `ws/render`, which owns the rest of rendering).

1. Write `docs/STYLE.md`: the visual identity (illuminated-manuscript meets HOI4: palette tokens, typography, icon grid, panel chrome, map label style, realm colour rules for legibility). The UI workstream applies it to `css/style.css`; give them exact CSS variables in an issue.
2. Icon set: replace emoji in the UI with a consistent inline-SVG icon set (`assets/icons/*.svg` + a small `js/ui/icons.js` loader). File issues for `ws:ui` to adopt them.
3. Heraldry & portraits: proper tinctures and charges per realm, crowns/mitres by rank, culture-specific clothing and faces in `portrait.js`.
4. 3D models: culture-specific castles, churches/mosques/kremlins, distinct unit silhouettes (knights, levy spears, horse archers), keeping instance counts and polygon budgets low.
Verify with screenshots from `npm run smoke` and close-zoom shots; attach before/after images in your issue comments.
