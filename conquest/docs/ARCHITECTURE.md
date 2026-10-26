# Architecture

```
index.html ─ js/main.js            boot: generate map → Game → MapView → UI, wires events, save/load
            ├ js/world/            static world, generated once per page load
            │   mapgen.js          Natural Earth raster → biomes → ~8,340 land provinces + 108 sea zones,
            │                      adjacency, straits, rivers, nation assignment from seed cities
            │   proj.js            Mercator projection, km per pixel
            ├ js/sim/              all game rules; Game + mixins
            │   game.js            state (game.s), newGame/load/serialize, tickDay/monthly, modifiers
            │   characters.js      rulers, heirs, generals, council members, succession
            │   economy.js         income, budget, resources, development, buildings & construction
            │   estates.js         estate loyalty/influence drift
            │   military.js        armies, divisions, templates, movement, supply, attrition, sieges
            │   battle.js          battles: frontage, phases, tactics, morale, pursuit
            │   fronts.js          fronts / battle plans; division posts along a border
            │   diplomacy.js       opinion, treaties, wars, war score, peace deals, AE, coalitions
            │   politics.js        laws & voting, focus trees, events, revolts, government
            │   ai.js              AI for every system (war, fronts, build, diplomacy, laws, focus)
            ├ js/data/             pure data tables (nations, cities, units, buildings, tactics, traits,
            │                      government/laws, focus trees, events, names)
            ├ js/render/           three.js map
            │   map3d.js           camera, terrain mesh + province shader, color table, labels, counters
            │   terrain.js         heightfield & textures;  models.js  instanced 3D buildings/units/trees
            └ js/ui/               DOM UI: ui.js (top bar, selection, orders, game menu), panels.js
                                   (court, laws, focus, diplomacy, military, economy, ledger…),
                                   battleview.js (real-time battle canvas), start.js, tutorial.js,
                                   heraldry.js, portrait.js
data/        geo.js (coastlines/rivers raster source), height.png/js (NASA elevation)
vendor/      three.module.js r160
tools/       build_geo.mjs (regenerate data/), build_single.mjs, check.mjs, smoke.cjs, debug pages
```

## State
`game.s` is the whole save: `day, player, nations[], prov[], armies{}, battles{}, wars{}, fronts{}, chars{}, log, notifications, eventQueue …`. Static map data (`game.map.provinces[i]`: x, y, terrain, adj[{id, km, river, strait}], name …) is regenerated deterministically and never saved. Province ids `< game.L` are land, the rest sea.

## Loop
`tickDay()` → movement, battles (4 rounds/day), sieges, construction, fronts, AI (staggered) → every month `monthly()` → economy, manpower, estates, characters, focus, events, diplomacy upkeep. The UI drives ticks from `requestAnimationFrame` at the selected speed.

## Events
`game.emit(name, …)` / `game.on(name, fn)`: e.g. `day`, `month`, `owner`, `control`, `army`, `armyMoved`, `battle`, `battleEnd`, `war`, `peace`, `diplo`, `law`, `focus`, `fronts`, `log`, `notify`, `event`. The map view listens and refreshes its color table (`map3d.js` writes rows: color, occupier, owner+flags).

## Adding a system
1. Create `js/sim/foo.js` exporting `FooMixin = { ... }`, add it to the mixin list at the bottom of `game.js`.
2. Hook it into `tickDay`/`monthly` with one line.
3. Default its state in `newGame` and back-fill it in `load()`.
4. UI: add a tab/panel in `panels.js` (or a new `js/ui/foo.js` imported by `panels.js`).
5. AI: teach `ai.js` to use it — every player tool must be usable by the AI.
