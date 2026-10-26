# Workstreams & module ownership

Parallel workstreams, each on its own branch off the integration branch `dev`. Each owns the files listed; anything else is shared and only gets small, additive edits.

| # | Workstream | Branch | Owns |
|---|---|---|---|
| 1 | Map & world generation | `ws/map` | `js/world/*`, `data/*`, `tools/build_geo.mjs`, `tools/debug_map.html` |
| 2 | Rendering & performance | `ws/render` | `js/render/*` except models.js, `vendor/*` |
| 3 | Battles & battle viewer | `ws/battle` | `js/sim/battle.js`, `js/ui/battleview.js`, `js/data/tactics.js` |
| 4 | Armies, logistics & fronts | `ws/military` | `js/sim/military.js`, `js/sim/fronts.js`, `js/data/units.js`, `tools/debug_front.html` |
| 5 | AI | `ws/ai` | `js/sim/ai.js`, `tools/debug_sim.html` |
| 6 | Diplomacy & peace | `ws/diplomacy` | `js/sim/diplomacy.js` |
| 7 | Politics, laws, estates, characters | `ws/politics` | `js/sim/politics.js`, `js/sim/characters.js`, `js/sim/estates.js`, `js/data/government.js`, `js/data/traits.js` |
| 8 | Content: nations, focus trees, events | `ws/content` | `js/data/focus.js`, `js/data/events.js`, `js/data/nations.js`, `js/data/cities.js`, `js/data/names.js` |
| 9 | Economy, trade & buildings | `ws/economy` | `js/sim/economy.js`, `js/data/buildings.js` |
| 10 | UI/UX, tutorial, saves | `ws/ui` | `js/ui/ui.js`, `js/ui/panels.js`, `js/ui/start.js`, `js/ui/tutorial.js`, `css/style.css`, `index.html`, `js/main.js` |

| — | Art director / design | `ws/design` | `docs/STYLE.md`, `assets/*`, `js/ui/heraldry.js`, `js/ui/portrait.js`, `js/render/models.js` |
| — | Progression | `ws/progression` | `js/sim/progression.js`, `js/data/innovations.js` |
| — | Product manager | `pm` | `docs/ROADMAP.md`, `docs/specs/*`, GitHub issues |
| — | QA simulation / gameplay | `qa/sim`, `qa/play` | `tools/qa/*`, `docs/qa/*` |

Note: heraldry.js, portrait.js and models.js moved from UI/render to design. Roles and the communication protocol: `docs/TEAM.md`.

Shared: `js/sim/game.js`, `js/util.js`, `CLAUDE.md`, `docs/`. A workstream that needs a panel for its feature may add a self-contained function/section to `panels.js` (append, don't reorganize) — the UI workstream owns the rest.

Briefs: `docs/workstreams/<name>.md`.
