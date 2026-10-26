# Workstream 7 — Politics, laws, estates & characters (`ws/politics`)
Owns `js/sim/politics.js`, `js/sim/characters.js`, `js/sim/estates.js`, `js/data/government.js`, `js/data/traits.js`.

Goals
1. Characters: dynasties & family trees, marriages producing heirs, regency for minors, claimant pretenders, ministers with ambitions and loyalty, assassination/plots.
2. Estates: estate privileges to grant/revoke, estate demands as events, estate-led revolts with their own armies.
3. Laws: logical prerequisites and transitions (e.g. elective → hereditary needs legitimacy + clergy support), law-change cost in stability and estate loyalty; government reforms (feudal → centralised monarchy, merchant republic, theocracy).
4. Religion: heresies (Cathars), papal authority, conversion of pagans, religious unrest.
Constraints: new state must be JSON-serializable and back-filled in `load()`; AI support for every new choice.

## Status
Handed off before any code was written: no game code has changed on this branch yet. The baseline passes `npm run check` and `npm run smoke` (365 days ≈ 12 ms/day).

**Done:** read the code and worked out the plan below.
**Half-done:** nothing.
**Next:** goals 1 → 4, following this plan.

Integration notes (worked out from the code):
- `ai.js` belongs to ws/ai. Give AI support for new choices from our own monthly hooks (`monthlyCharacters`/`monthlyEstates` run for every nation from `game.monthly`): `if (n.id !== s.player) this.aiXxx(n)`.
- Realm modifiers: add one hook line in `game.js` `recalcMods` (e.g. `if (this.politicsMods) this.politicsMods(n, add);`) and apply regency, privilege, excommunication and new-gov mods there.
- Dynamic events (estate demands, minister demands, plots discovered): `eventDef`/`chooseEvent`/`applyEffects`/`describeEffects` are in `politics.js`. Store generated defs in `s.polEvents[id]` (JSON: title, icon, desc, options[{text, effects}]), check it first in `eventDef`, and delete the entry in `chooseEvent`. Add new effect keys (privilege, charLoyalty, killChar, estateRevolt, penance) to `applyEffects`/`describeEffects`. The UI (`ui.js showEvent`) only needs title/icon/desc/options.
- UI: create `js/ui/politics_panels.js` and hook it in with small additive edits to `panels.js` (extra Court subtabs: Family, Plots, Faith; a gov-reform section and law-cost line in Laws/`lawDetail`). Smoke only opens the default subtabs, so test new subtabs with a custom Playwright script.

Plan per goal:
1. Characters (`characters.js`): add char fields `father, mother, spouse, dynastic, loyalty, ambition` (back-fill in `load()`). Use roles `spouse`, `family`, `claimant` alongside the existing ones. Keep a compact record of dead dynasts in `s.dead` for family trees (characters are deleted in `killChar`). Spouse at `initCourt`; births need a ruler + spouse and a fertile mother; add child mortality. Pick the heir by succession law (primogeniture: eldest son, then daughter; seniority: eldest male dynast; tanistry: most capable adult). Regency when the ruler is under 16 (`n.regent`, mods via the hook). Passed-over dynasts become claimants, who may raise a pretender revolt (`spawnRebels` + tag the army). Usurp if the revolt survives or holds provinces; exile/kill if crushed. Minister loyalty drifts; disloyal ambitious ministers make demands or plot. Plots in `s.plots` (assassinate/usurp) progress by intrigue against the target's spymaster. Player/AI can assassinate foreign rulers/heirs (gold cost; opinion hit if discovered).
2. Estates (`estates.js`, data in `government.js`): add `ESTATE_PRIVILEGES` (about 3 per estate: mods + loyalty target + influence) and `n.privileges` with grant/revoke (revoking costs stability and loyalty, with a revolt risk when the estate is strong). Estate demands as polEvents. Generalise `estateRevolt(n, e)`: troop mix per estate (nobles: knights/MAA; clergy: zealots/MAA; burghers: crossbowmen/pikemen; peasants: levies), size from influence, tracked in `n.estateRevolt`. If crushed, influence −15; if it survives 12 months or holds 3 provinces, it forces a privilege.
3. Laws (`politics.js`): add `reqFrom: {curOpt: reqs}` and new req keys `loyalty.<estate>`, `prestige`. Transitions: gavelkind/seniority/tanistry → primogeniture need legitimacy + clergy loyalty; papal → royal investiture needs high authority. Law-change cost: stability −(0.2 + weighted opposition); opposed estates lose loyalty; a per-category cooldown `n.lawCd`. Gov reforms (`GOV_REFORMS` in `government.js`, `reformGov()` using `changeGov`): feudal → new `centralized_monarchy` (add it to the law `govs` lists, `defaultLaws`, `GOVS` with estates + mods), feudal → merchant republic (burgher influence, markets), → theocracy (clergy influence, pious ruler), elective → feudal (hereditary crown: legitimacy ≥ 80, clergy loyalty ≥ 60), tribal → feudal (non-pagan, ≥ 10 provinces), republic → feudal (signoria lordship).
4. Religion: add `pr.heresy` as a separate field (do NOT add new `pr.religion` values; map3d/ui colour religions by name). Seed Cathars (lon 0.5–3.5, lat 42.8–44.5) and Bogomils (Bosnia, lon 17–19.5, lat 43–45). Heresy spreads to adjacent same-faith provinces, faster with low clergy loyalty; it adds unrest and can spark zealot revolts. Suppress (inquisition) or tolerate. Papacy state `s.papacy = {authority, excommunicated[]}`: excommunication for royal investiture or low papal opinion, penance to lift it, and the Pope (PAP, or AI) can call crusades by pushing `{kind:'holy_war', tag}` into catholic `n.cbs` (`diplomacy.cbsAgainst` already honours a tagged holy_war). Pagan conversion pressure from Christian neighbours makes the AI take the `baptism` law (`aiLawScore` never picks it on its own); missionaries for pagan provinces.


**Update (goal 1 core done):** characters.js now has spouses, births, child mortality, heir by succession law (`pickHeir`), regency (`n.regent`, via `politicsMods` hook in recalcMods), claimants + pretender revolts/usurpation, dead-dynast record `s.dead`, `backfillPolitics()` called from `load()`. Still to do: minister loyalty/plots/assassination, then goals 2-4.
