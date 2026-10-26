# Workstream 4 — Armies, logistics & fronts (`ws/military`)
Owns `js/sim/military.js`, `js/sim/fronts.js`, `js/data/units.js`, `tools/debug_front.html`.

Goals
1. Fronts: offensive lines (advance to a target line), defensive lines on rivers/forts, automatic reinforcement of weak posts, splitting/merging fronts, naval invasion plans.
2. Logistics: supply depots and supply lines that can be cut, foraging that devastates provinces, winter quarters, levy vs. retinue vs. mercenary companies (hire/disband, loyalty, cost).
3. Recruitment queue with training time, unit experience/veterancy, general retinues.
4. Fix any remaining order bugs: divisions stuck, oscillating between posts, lone sieges.
Constraints: everything you add must be usable by the AI — coordinate by adding methods `ai.js` can call, and note them in the PR. Verify with `tools/debug_front.html` and debug_sim.

## Status
Done (pushed): fronts stability fix in `manageFront` (js/sim/fronts.js).
- Posts are now sticky: a division keeps its post while it is still on the line; only divisions that lost theirs are re-posted (nearest free slot, doubling up only if slots run out). Removed `slotKey` re-post-everyone.
- Advance mode: a division already marching on a foe-held target (within capacity) keeps going instead of retargeting.
- Result with `node tools/front.cjs "?war=1"` (new headless runner for debug_front.html): stacked 2 -> 0, retargets 1-4 -> 1-3 per 20 days; peace case unchanged (0 retargets).
- `npm run check` / `npm run smoke` pass.

Still open (see Next): lone sieges, orderMove failure fallback, goal 2/3 features (f.goal, split/merge, naval plan, supply network, mercenaries, veterancy), AI-callable method list. Divisions standing in just-captured provinces may sit off the line until the next manageFront recompute.

Next (suggested order)
1. Lone sieges helper/return-to-post; orderMove failure fallback.
2. Threat-weighted posts, defensive mode, `f.goal`, `splitFront`/`mergeFronts`, naval invasion plan.
3. Supply network + depots, winter quarters, levies/mercenaries/retinues.
4. Veterancy drilling; generals' retinue.
5. Expose AI-callable methods for `ws/ai`.
