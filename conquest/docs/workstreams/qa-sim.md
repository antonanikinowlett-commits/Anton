# QA — simulation (`qa/sim`)
Tests the `dev` branch. Owns `tools/qa/*` (new).

1. Build `tools/qa/longrun.cjs`: run 50 years all-AI across several seeds headlessly; record crashes, tick time per year, nations alive, largest realm's size over time, wars, battles, revolts, save→load→continue round-trips. Save a markdown report to `docs/qa/sim-<date>.md`.
2. Run it whenever `dev` changes (check `git log origin/dev` each time you are woken). Each crash, NaN, perf regression (>20% slower tick) or absurd outcome (one realm owning half the map, no wars for 20 years, armies of 0 men) becomes a GitHub issue labelled `bug` + the owning `ws:<area>` with a minimal reproduction (seed, day, command).
3. Add invariant checks (`tools/qa/invariants.js`): every province has a valid owner/controller, armies are on valid provinces, no negative manpower, wars have at least one participant per side, etc. Run them every simulated month.
Don't fix other areas' code; you may fix test tooling and push small fixes to code nobody owns.

## Status
Updated 2026-10-27. Tooling: `tools/qa/longrun.cjs` (+ `longrun.html`, `invariants.js`), run `node tools/qa/longrun.cjs --years 20 --seeds 1,2` (~3 min; 50y×4 seeds took 20 min). Invariants checked monthly; save→load→+60 days every 10 y. Report: `docs/qa/sim-2026-10-26.md` (50 y, seeds 1-4, dev@3c573bc). No GitHub issues filed (per orchestrator).
Findings (no crashes, 4/4 seeds ran 50 y, save/load 20/20 OK):
- Frozen world: top 3 realms/sizes identical from year 1 to 50; only ~1 province-owner change in 50 y despite ~100 wars / ~1500 battles each → wars never change borders (ws:ai / ws:diplomacy).
- Tick time grows ~3x (≈8 → 26 ms/day avg, max 140 ms; budget 10 ms) as armies grow 100 → 330 and men 0.7M → 3M with no cap (ws:military / ws:economy).
- Invariants: every prov has `controller = -2` (x~700-1000; likely deliberate sentinel e.g. rebels—verify); alliances not mutual (ENG/TOU, BYZ/BUL, SIC/PAP…, ws:diplomacy); alive nation MON owns 0 provinces (day 13839); armies with 0 regiments; negative regiment morale; battle with no living armies.
- Long peaces: up to 4217 days with no war (seed 4).
