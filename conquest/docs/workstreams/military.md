# Workstream 4 — Armies, logistics & fronts (`ws/military`)
Owns `js/sim/military.js`, `js/sim/fronts.js`, `js/data/units.js`, `tools/debug_front.html`.

Goals
1. Fronts: offensive lines (advance to a target line), defensive lines on rivers/forts, automatic reinforcement of weak posts, splitting/merging fronts, naval invasion plans.
2. Logistics: supply depots and supply lines that can be cut, foraging that devastates provinces, winter quarters, levy vs. retinue vs. mercenary companies (hire/disband, loyalty, cost).
3. Recruitment queue with training time, unit experience/veterancy, general retinues.
4. Fix any remaining order bugs: divisions stuck, oscillating between posts, lone sieges.
Constraints: everything you add must be usable by the AI — coordinate by adding methods `ai.js` can call, and note them in the PR. Verify with `tools/debug_front.html` and debug_sim.

## Status
Stopped early (orchestrator handoff) after investigation; **no code changes yet**.

Done
- Read the code and recorded a baseline: `npm run check` and `npm run smoke` pass on this branch (365 days ≈ 6.4 s headless, ~17 ms/day, already above the 10 ms budget, so keep new work cheap).
- Built a headless runner for `tools/debug_front.html` (a Playwright page loader like `tools/smoke.cjs`). Baseline results:
  - Peace (hold): 11 divisions, all on the line, 0 retargets, 0 stacked. OK.
  - `?war=1` (advance from day 40): each division retargets 1–4 times in 20 days, 4 are off the line, 2 stack in Tours. That is the oscillation/stacking bug in goal 4.

Already present (don't rebuild)
- Recruitment queue with training time (`s.recruit`, `recruit`, `dailyRecruit`, barracks speed-up).
- Regiment `xp` (0..1), gained in battle and used in battle.js (`xpF`); UI shows stars.
- Foraging devastation in `supplyAndRecovery`; winter supply and attrition penalties.

Next (suggested order)
1. Goal 4 / fronts stability in `manageFront`:
   - Keep existing post assignments when the line shifts (don't re-post everyone when `slotKey` changes); reassign only divisions whose post left the line.
   - In advance mode, stop retargeting a division that is already marching; the `taken.has(...) === false` check is suspect.
   - Lone sieges: a division that can't blockade (men < garrison×1.5) should get a helper or go back to its post after N days.
   - Track `orderMove` failures and fall back to the post.
2. Fronts: threat-weighted posts (reinforce weak posts), a defensive mode that snaps posts to forts and rivers, an advance-to-target goal (`f.goal`), `splitFront`/`mergeFronts`, and a naval invasion plan (gather at a port, then sail; `findPath` already crosses sea).
3. Logistics: supply network via BFS from the capital through controlled land, with depots extending reach and enemy occupation cutting it. Out-of-supply armies take attrition, get no reinforcement and forage harder. Winter-quarters order. Levies, mercenary companies (hire/dismiss, loyalty) and retinues via a `kind` on regiments and an upkeep multiplier in `armyUpkeep`.
4. Veterancy: drill xp while idle at home, plus veterancy labels. Generals' bodyguard retinue.
5. Expose AI-callable methods and list them for `ws/ai`.
