# Crown & Conquest — contributor notes

Browser grand-strategy game (Europe, AD 1200). Vanilla ES modules + vendored three.js, **no build step** for development.

## Run / verify
- `npm run dev` → http://localhost:8000 (any static server works; ES modules need http, not file://).
- `npm run check` — `node --check` on every module. Run before every commit.
- `npm run smoke [-- days]` — headless: simulates N days all-AI via `tools/debug_sim.html`, then boots the UI as France and opens every panel. Must print `smoke OK`.
- `npm run build -- <esbuild binary>` — bundles everything into `CrownAndConquest.html` (double-clickable). Only rebuild on `main`/release, not on workstream branches (it is a 1.5 MB generated file and conflicts constantly).
- Debug pages: `tools/debug_map.html` (map gen stats), `tools/debug_sim.html?days=730&tag=FRA`, `tools/debug_front.html`.

## Architecture (short)
See `docs/ARCHITECTURE.md`. One `Game` object (`js/sim/game.js`) holds all state in `game.s` (plain JSON, serialized for saves). Behaviour is split into **mixins** (`js/sim/*.js` export `XxxMixin = { methods }`) that are copied onto `Game.prototype`; every mixin method uses `this` = the game. Data tables live in `js/data/`. Rendering (`js/render/`) and UI (`js/ui/`) only read `game.s` and call game methods; they never mutate state directly.

## Rules
- Stay inside your workstream's files (`docs/MODULES.md`). Changes to shared files (`game.js`, `util.js`, `main.js`, `index.html`, `css/style.css`) must be small and additive: add a hook, don't restructure.
- `game.s` must stay JSON-serializable. New per-nation/province fields need a default in `newGame` **and** a fallback in `load()` so old saves keep working.
- Mixin method names are one global namespace on `Game` — grep before adding one.
- Performance budget: a game-day tick for all 67 realms ≲ 10 ms (debug_sim reports it); menus open < 50 ms; the map renders on demand (set `view.dirty = true` after changing anything visible).
- No new runtime dependencies; vendored libs go in `vendor/`.
