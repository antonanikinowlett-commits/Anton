# Workstream 9 — Economy, trade & buildings (`ws/economy`)
Owns `js/sim/economy.js`, `js/data/buildings.js`.

Goals
1. Trade: trade nodes/routes (Venice, Genoa, Hansa, Silk Road via Constantinople, Baltic), merchants, trade income, embargoes (hook for diplomacy).
2. Resources: production chains (iron → weapons, horses → cavalry, timber → ships/siege), shortages limiting recruitment, markets with price changes.
3. Population & development: peasants/burghers per province, growth, plague/famine effects, devastation from war.
4. Buildings: more tiers & types (universities, cathedrals, guild halls, toll bridges, walls), upkeep, building slots by development.
5. Budget clarity: `budget(nid)` returns a full itemised ledger for the UI.
Constraints: keep monthly economy tick fast; the AI must use new buildings (add priorities in `aiBuild` or document them for the AI workstream).
