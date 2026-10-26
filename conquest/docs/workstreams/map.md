# Workstream 1 — Map & world generation (`ws/map`)
Owns `js/world/*`, `data/*`, `tools/build_geo.mjs`, `tools/debug_map.html`.

Goals
1. Load time: map generation currently runs on every page load. Cache the generated province raster/graph (IndexedDB keyed by a version hash, or a precomputed binary in `data/`) so a second load is < 1 s.
2. Geography quality: named rivers as province borders where historically relevant, mountain passes (Alps, Pyrenees, Caucasus) as chokepoint adjacencies, marsh/steppe/desert biome tuning, correct islands (Gotland, Rhodes, Balearics, Orkney) with sea links.
3. Province names: every province named from real 1200-era places (add a place-name table), no duplicates within a realm.
4. Expose terrain features needed by others: `province.river`, `coastal`, `pass`, `strait` flags, documented in `docs/ARCHITECTURE.md`.
Constraints: province ids must stay deterministic (saves depend on them); bump a `MAP_VERSION` constant and make `load()` refuse mismatched saves gracefully. Verify with `tools/debug_map.html` + `npm run smoke`.
