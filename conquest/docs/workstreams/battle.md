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
- Todo: night penalties, reserves joining over days, viewer formations/replay, naval battles, battle report screen.
