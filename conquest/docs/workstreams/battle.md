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
- Done: replay (game.s.pastBattles keeps 25 compact records; BattleViewer.replay(id), Replay button on result panel). UI could add a battle-history list calling ui.battleViewer.replay(id).
- Done: terrain chip tooltip lists terrain multipliers and favoured tactics.
- Done: naval. Ships (cog, galley, longship in units.js; cls inf + ship:true) recruitable in a coastal province with a Harbour; checkContact lets fleets (or anyone meeting a fleet) fight at sea; AI maritime realms keep one small War Fleet in port (aiFleet). tools/debug_naval.html forces a fleet clash to verify. AI fleets do not patrol yet (they defend ports and catch landings only), no blockade effect on trade yet.
- Done: AI fleets (aiFleet/aiFleetMove in ai.js): maritime realms keep up to 3 fleets, patrol coast, hunt enemy ships in 6 sea hops, return to harbour when damaged. 730 days: ~18 fleets, 9 at sea, but 0 naval battles yet (needs blockades and sea invasions, next slices).
