# QA — simulation (`qa/sim`)
Tests the `dev` branch. Owns `tools/qa/*` (new).

1. Build `tools/qa/longrun.cjs`: run 50 years all-AI across several seeds headlessly; record crashes, tick time per year, nations alive, largest realm's size over time, wars, battles, revolts, save→load→continue round-trips. Save a markdown report to `docs/qa/sim-<date>.md`.
2. Run it whenever `dev` changes (check `git log origin/dev` each time you are woken). Each crash, NaN, perf regression (>20% slower tick) or absurd outcome (one realm owning half the map, no wars for 20 years, armies of 0 men) becomes a GitHub issue labelled `bug` + the owning `ws:<area>` with a minimal reproduction (seed, day, command).
3. Add invariant checks (`tools/qa/invariants.js`): every province has a valid owner/controller, armies are on valid provinces, no negative manpower, wars have at least one participant per side, etc. Run them every simulated month.
Don't fix other areas' code; you may fix test tooling and push small fixes to code nobody owns.
