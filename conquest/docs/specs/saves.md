# Spec: Save compatibility & versioning

Status: approved for M1 · Areas: ui, map, every sim area, qa

## Why
Ten workstreams add state in parallel. `game.serialize()` writes `{v:1}` and `load()` accepts anything, so a save from an older `dev` build either crashes or silently misses fields. Saves are capped at 3 in localStorage (`main.js`), which is ~1 MB+ each with 8,300 provinces and will hit the 5 MB quota.

## Rules (all areas)
1. Every new field gets a default in `newGame` **and** a back-fill in `load()` — reviewed by the orchestrator at merge.
2. `SAVE_VERSION` (integer in `game.js`) is bumped only for breaking changes; `load()` runs `migrations[v]` in order.
3. `MAP_VERSION` (map workstream) is stored in the save; a mismatch shows "This save was made with a different map and can't be loaded" instead of crashing.

## Area split
| Area | Work |
|---|---|
| ws:ui | storage via IndexedDB (no 5 MB cap), named slots, autosave yearly (keep last 3), export/import `.ccsave` file, error dialog on failed load |
| ws:map | `MAP_VERSION` constant, written into saves, checked in `load()` |
| qa (sim) | save → load → continue round-trip every 10 simulated years in longrun; diff `serialize()` before/after equals |

## Acceptance
- A save made on today's `dev` loads after every later merge to `dev` (QA keeps a fixture save in `tools/qa/fixtures/`).
- Loading a save with a different map version shows a dialog, not a console error.
