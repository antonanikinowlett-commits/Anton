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
- Done: blockades (battle.js dailyBlockades every 5 days): an enemy fleet in a sea zone beside a coastal province sets pr.blockadedBy; trade income x0.2, canRecruit refuses, log + province panel card. Contested sea (two hostile fleets) blockades nothing. Lifted when the blockader is sunk or leaves.
- Done: sea invasions (aiSeaInvasion: host + fleet escort to a realm with no land border), fleets chase enemy hosts at sea and sail to blockade the nearest enemy port, any realm at war may build 2 fleets. Honest result: 730 AI days give 0-1 naval battles; wars between two fleet-owning realms are rare. Remaining: fleets on the 3D map / army list.
- Done (sieges): ram and siege_tower units; rams help vs forts <=2, towers vs >=3; engines sap walls (sg.breach up to -40% defence); starving garrison (food<0 or blockaded) loses strength and speeds the siege; siege card shows est. days, breach %, starvation. Relief battles and assaults already existed. Next: supply visibility, mercenaries.
- Done (supply visibility): supplyAndRecovery records a.supply and a.attrWhy; army panel shows supply vs regiments and attrition %/month with a tooltip explaining each cause (winter, desert, overcrowding, famine, sea). No map mode yet. Next: mercenaries.
- Done (mercenaries): free_company and merc_crossbowmen units (flag merc): hired in 8 days, no manpower, high gold cost and upkeep; they desert 4%/day while the treasury is negative (player warned once); rich AI realms at war add a Free Company. Hire/disband via normal recruit/disband. No separate loyalty meter yet.
- Done (gaps): 'attrition' map mode (map3d.js provColor + ui.js MODES, military.js attritionRisk; colours do not auto-refresh on season change); mercenary loyalty meter (r.loy per regiment, -2%/day while treasury negative, +1% paid, desertion below 50%, shown in the regiment tooltip).
- Done (generals): battle XP/levelling across 5 skills, battlefield traits after 3 wins (cavalry/archer/defender/inspiring/aggressive), siege XP and siege skill from captured forts, wounds (-2 skills for 40 days, player notified), battles/wins/kills/sieges stats on the court Generals panel. Promote/dismiss/assign already existed. No rivalries yet.
- Done (templates): designer already showed counts, cost, manpower, upkeep and formation; added a combat-width preview per terrain and a "Reinforce from template" button on the army panel (g.reinforceFromTemplate: musters the missing regiments in the army's province and merges them in; verified headless 8 -> 10 regiments).
- Done (doctrines): js/data/mildoctrines.js: Feudal Levy / Professional Retinue / Horde & Crusading Orders, picked by culture+government (n.milDoc, lazily set), permanent mods plus a perk that unlocks with a named innovation (castle_concentric / standing_retinue / couched_lance). Applied via one line in game.recalcMods; shown as a card in the Templates tab. Not player-selectable yet (chosen automatically at start).
- Done (doctrine switching): g.setMilDoctrine(nid, key): 30 prestige, -1 stability, 365-day cooldown; buttons on the Templates tab doctrine card; AI reconsiders rarely by aggro/wealth (aiDoctrine).
- Done (performance): 730-day sim 8.3s -> ~4.3s (tools/debug_sim.html). Army lookups indexed by nation/location (armyIndex, invalidated by _armyVer on add/remove/move), neighbours() and borderProvinces() cached per ownership generation, findPath memoises canEnter/blocksPassage per search. tools/debug_prof.html wraps every Game method with timers (self ms + calls); a CDP sampling profile showed the rest is spread thin (provinceIncome/budget, charsOf, Heap pop). Behaviour intended identical; runs are not deterministic so it could not be diffed.
