# Workstream 1 — Map & world generation (`ws/map`)
Owns `js/world/*`, `data/*`, `tools/build_geo.mjs`, `tools/debug_map.html`.

Goals
1. Load time: map generation currently runs on every page load. Cache the generated province raster/graph (IndexedDB keyed by a version hash, or a precomputed binary in `data/`) so a second load is < 1 s.
2. Geography quality: named rivers as province borders where historically relevant, mountain passes (Alps, Pyrenees, Caucasus) as chokepoint adjacencies, marsh/steppe/desert biome tuning, correct islands (Gotland, Rhodes, Balearics, Orkney) with sea links.
3. Province names: every province named from real 1200-era places (add a place-name table), no duplicates within a realm.
4. Expose terrain features needed by others: `province.river`, `coastal`, `pass`, `strait` flags, documented in `docs/ARCHITECTURE.md`.
Constraints: province ids must stay deterministic (saves depend on them); bump a `MAP_VERSION` constant and make `load()` refuse mismatched saves gracefully. Verify with `tools/debug_map.html` + `npm run smoke`.

## Status
Done
- Goal 1 (load time): `generateMap(progress, { cache })` now restores the raster + province graph from IndexedDB (`js/world/cache.js`), keyed by `MAP_VERSION` plus a hash of cities, nation seeds, `PROV_SCALE` and the geo/height data. Cold load is about 6.9 s and a cached reload about 0.6 s (headless `tools/debug_map.html`). Culture, religion and names (`nameWorld`) are recomputed on every load because other workstreams' tables feed them. `debug_map.html?nocache` forces a rebuild and the page shows "(cached)" when it hit the cache.
- `MAP_VERSION` (now 2) lives in `js/world/version.js`. `serialize()` writes `map`, and `load()` throws on a mismatch; saves without the field count as v1. `main.js` catches the error and shows a "Load failed" toast. Bump `MAP_VERSION` whenever province ids, shapes or adjacency change.

Half-done (investigated, no code yet)
- Goal 2: `GEO.rivers` entries carry names (`n`) and ranks (`r`): Danube/Donau, Rhine/Rhein/Rhin, Dnipro, Vistula, Elbe, Oder, Loire, Seine, Ebro, Po, Don, Volga, Tajo, Duero and others. Plan: give major named rivers a prohibitive crossing cost in step 5 so they become hard borders, and record `adj.riverName` and `province.riverName`.
- Other consumers read `province.river` as a pixel share with a `> 0.03` threshold (`ui.js`, `game.js`, `economy.js`, `buildings.js`), so keep it numeric and add new flags next to it.

Next
- Goal 2: passes (Brenner, Great St Bernard, Mont Cenis, Gotthard, Roncevaux/Somport, Darial). Mark `adj.pass` near those points. Possibly drop high-ridge edges that are not passes, but only where global connectivity is preserved.
- Goal 2: tune biomes: steppe (Hungarian puszta, Anatolian plateau, Meseta), desert, and marsh (Fens, Pontine, Po delta, Danube delta, Mesopotamian marshes).
- Goal 2: islands. Make sure Gotland, Rhodes, the Balearics and Orkney survive the `< 14 px` island cut in step 6 (whitelist by lon/lat).
- Goal 3: GeoNames and Wikidata are blocked by the network policy, so write a hand-made table of real c. 1200 place names (`data/places.js`, `[name, lon, lat]`). Assign each province the nearest unused place, fall back to `placeName`, and enforce no duplicate names within a realm.
- Goal 4: add `pass`, `strait`, `island` and `riverName` flags and document them in `docs/ARCHITECTURE.md`.
- Bump `MAP_VERSION` after any change to the province layout.
