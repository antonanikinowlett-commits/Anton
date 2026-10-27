# Workstream 3 — Battles & battle viewer (`ws/battle`)
Owns `js/sim/battle.js`, `js/ui/battleview.js`, `js/data/tactics.js`.

Goals
1. Battle depth: terrain-specific tactics, commander skill vs. tactic choice, reserves joining over several days, river-crossing and night penalties, combined-arms bonuses, captured nobles/ransom.
2. Battle viewer: real formations per unit type (shield wall, wedge, schiltron, horse archers circling), visible flanks/reserves, phase timeline, casualty graph, speed controls, replay of finished battles.
3. Naval battles in sea zones (cogs, galleys) for transports and blockades.
4. Battle report screen after each player battle (tactics used, why you won/lost).
Constraints: keep per-day battle cost low (thousands of AI battles per campaign). Balance-check with `tools/debug_sim.html?days=730`.

## Status
- Done: combined-arms bonus (sideMods), captured-general ransom (endBattle). River penalty and tactics already existed on dev.
- Done: rain-mud penalty (extra charge/attack malus on marsh, plains, forest).
- Done: night battles (10%, 20% winter: ranged -35%, charge -20%, attacker -8%); reinforcements arriving raise side morale +6%. 730-day smoke OK.
- Done: viewer night chip; post-battle report (tactics per phase, strength graph) in showResult.
- Done: viewer formations (schiltron ring, wedge, shield-wall ranks, circling horse archers).
- Todo: replay, terrain bonuses in viewer, naval battles.
