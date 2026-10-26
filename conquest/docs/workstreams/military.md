# Workstream 4 — Armies, logistics & fronts (`ws/military`)
Owns `js/sim/military.js`, `js/sim/fronts.js`, `js/data/units.js`, `tools/debug_front.html`.

Goals
1. Fronts: offensive lines (advance to a target line), defensive lines on rivers/forts, automatic reinforcement of weak posts, splitting/merging fronts, naval invasion plans.
2. Logistics: supply depots and supply lines that can be cut, foraging that devastates provinces, winter quarters, levy vs. retinue vs. mercenary companies (hire/disband, loyalty, cost).
3. Recruitment queue with training time, unit experience/veterancy, general retinues.
4. Fix any remaining order bugs: divisions stuck, oscillating between posts, lone sieges.
Constraints: everything you add must be usable by the AI — coordinate by adding methods `ai.js` can call, and note them in the PR. Verify with `tools/debug_front.html` and debug_sim.
