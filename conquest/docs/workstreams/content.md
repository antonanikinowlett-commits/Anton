# Workstream 8 — Content: nations, focus trees, events (`ws/content`)
Owns `js/data/focus.js`, `js/data/events.js`, `js/data/nations.js`, `js/data/cities.js`, `js/data/names.js`.

Goals
1. Unique historical focus trees for every great power and key minors (England/Magna Carta, France/Bouvines, HRE/Staufer vs Welf, Byzantium/1204, Castile/Las Navas, Venice/Fourth Crusade, Mongols, Rus', Hungary/Golden Bull, Papacy, Ayyubids, Almohads), 25–40 nodes each with branching, mutually exclusive paths.
2. 100+ events: historical (with date windows and conditions) and dynamic (plague, famine, comet, heresy, succession crisis), each with 2–3 meaningful options.
3. Data accuracy pass on rulers, capitals, cultures, religions, alliances in 1200; more name pools.
4. Formable nations (Kingdom of Portugal → Iberia, Kingdom of Italy, Rus' unification).
Constraints: data-only where possible; any new effect type needs a handler in `politics.js` — keep it to a short, additive edit and describe it in the PR.

## Status
Paused at the orchestrator's request. No changes to the content data yet.

**Done**
- Read the docs and the engine (`politics.js` effects, focus layout in `panels.js`, AI focus picking). Baseline `npm run check` and `npm run smoke` both pass.
- Added `tools/validate_content.mjs` (run `node tools/validate_content.mjs .` from `conquest/`). It builds every realm's focus tree with a mock game, plus MON. It flags duplicate ids, missing or one-way `pre`/`excl` refs, prerequisites placed at or below their node, and two nodes in the same (x,y) cell. It also checks every effect key, modifier key, unit unlock, law, building, gov and tag against what the engine handles, and validates events. It reports each tree's node count as total/national. It passes on the current data.

**Findings for whoever continues**
- Every tree already has 27–35 nodes in total: a core of 21, plus faith (4–5) and government (3–4). The national branches (x ≥ 20) have only 0–6 nodes. So goal 1 means growing the national branch to about 20–25 nodes for ENG, FRA, HRE, BYZ, CAS, VEN, HUN, PAP, AYY, ALM and Rus' (a shared builder for VLA/NOV/KIE/GAL/CHE/SMO/PLT/RYA works well). MON gets a horde tree.
- The focus panel draws the ⟷ exclusion marker only when the two nodes are on the same `y` and the other node has the larger `x`. Put mutually exclusive pairs side by side.
- Node ids must be unique across the whole tree, including core/faith/gov ids (e.g. `golden_bull`, `fourth_lateran`, `great_crusade`, `royal_justice` are taken).
- Modifier keys the engine actually reads: taxMult tradeMult foodMult ironMult manpowerMult devGrowth fortDefense discipline armyMorale cavAtk cavCost infDef infAtk rangedAtk siege generalTactics diplo aeDecay focusSpeed legitimacyMonthly stabilityMonthly prestigeMonthly unrest unrestInfidel clergyLoyalty nobleLoyalty seaSpeed lootMult horsesMult trainSpeed supply recruitCost upkeepMult buildSpeed buildCost claimSpeed defenseHome papalOpinion.
- Events: `monthlyEvents` stops at the first event that fires for each realm. Adding ~80 events means keeping their total chance per realm around 0.2–0.3 a month, or the player gets flooded. Random events can repeat. For one-off historical events with date windows, the plan was a `flag` effect (`(n.flags ||= []).push(x)`, a one-line additive handler in `applyEffects`). `cond` would check the flag, game day and tag, and also that the event isn't already in `s.eventQueue`.
- Formables can be data-only: an event, or a focus with `req: { provinces }`, using `gov: { gov, name }` to rename the realm (`changeGov` handles a same-gov rename).

**Next**
1. National focus trees, as above. Run the validator after each nation.
2. 100+ events, plus the `flag` handler.
3. Accuracy pass on rulers, capitals and alliances in `nations.js`, and more name pools.
4. Formables: Portugal → Iberia, Kingdom of Italy, Rus' unification.
