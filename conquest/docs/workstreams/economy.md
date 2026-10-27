# Workstream 9 — Economy, trade & buildings (`ws/economy`)
Owns `js/sim/economy.js`, `js/data/buildings.js`.

Goals
1. Trade: trade nodes/routes (Venice, Genoa, Hansa, Silk Road via Constantinople, Baltic), merchants, trade income, embargoes (hook for diplomacy).
2. Resources: production chains (iron → weapons, horses → cavalry, timber → ships/siege), shortages limiting recruitment, markets with price changes.
3. Population & development: peasants/burghers per province, growth, plague/famine effects, devastation from war.
4. Buildings: more tiers & types (universities, cathedrals, guild halls, toll bridges, walls), upkeep, building slots by development.
5. Budget clarity: `budget(nid)` returns a full itemised ledger for the UI.
Constraints: keep monthly economy tick fast; the AI must use new buildings (add priorities in `aiBuild` or document them for the AI workstream).

## Status
Work in progress, paused mid-goal 1.
- Done (data only): `js/data/trade.js` has 17 trade nodes with downstream flow (Silk Road via Tabriz and Constantinople, Alexandria, Venice, Genoa, Hansa/Lübeck, Baltic, Novgorod, Bruges…). `economy.js` doesn't use it yet.
- Half-done: `js/data/buildings.js` adds guildhall, university, cathedral, tollbridge, townwalls, armoury, tiltyard, shipyard and siegeworks, plus `upkeep/req/minDev/slot/mods/cap/chain/ai` fields. **Nothing enforces these yet:** the new buildings can be built with no prerequisites and have no effect.
- Next (in `economy.js`): enforce req/minDev/slots (2 + dev/3) in `canBuild` and route availability through `n.unlocks` (progression ws); add building upkeep and chain consumption to `budget()` as an itemised `B.ledger`; nation mods from buildings via `n.econ.mods` (one-line hook in `recalcMods`); `initEconomy()` hook in newGame/load; monthly trade (province→nearest node, power, merchants `n.econ.merchants`, `setEmbargo(nid, target, on)`), market price multipliers `s.market` with buy/sell, pop `pr.pop {p,b}` with growth/famine/devastation, plague `pr.plague` spread, fortLevel + townwalls; one-line `BUILDINGS[type].ai` fallback in `aiBuild`; ledger/trade/market sections in the economy panel.
- Not yet: merging `origin/dev`.
