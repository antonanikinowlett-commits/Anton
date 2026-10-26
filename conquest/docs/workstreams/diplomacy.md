# Workstream 6 — Diplomacy & peace (`ws/diplomacy`)
Owns `js/sim/diplomacy.js`.

Goals
1. Richer actions: demand tribute, sell/buy provinces, guarantee independence, call to arms per war, break alliance with penalties, fabricate claims via spymaster, papal excommunication & crusade calls, Holy Roman Empire elections.
2. Peace: per-province demands on the map (already exists) plus gold reparations, vassalisation, release nations, white peace by AI acceptance formula shown to the player.
3. Opinion breakdown UI data (`opinionBreakdown(a, b)`), AI acceptance reasons (`whyNot()`), so the UI can explain every refusal.
4. Coalitions & aggressive expansion tuning; trade agreements hook for the economy workstream.
Constraints: AI must use every new action (add calls in `ai.js` with a small, clearly separated function, or document it for the AI workstream).

## Status
Stopped early at the orchestrator's request: the role is moving to another session. **No code changes yet.** Only the analysis and plan below are done.

Done:
- Read the code. `opinionBreakdown(a, b)` and `acceptance(aid, bid, kind)` → `[score, reasons]` already exist. `panels.js` shows them as tooltips. `peaceAcceptance` returns only `{cost, will}`.
- Baseline: `npm run check` and `npm run smoke` pass on this branch (the smoke run takes about 70 s).

Half-done: nothing.

Next (planned design, all in `js/sim/diplomacy.js` unless noted):
1. `whyNot(aid, bid, kind, ctx)`: preconditions, then `acceptance()`. A refusal names the worst negative reasons ("They refuse: Different faith −40, …"). The `propose*` functions return it.
2. New per-nation state, via a hook `initDiplomacy(isLoad)` (add one line in `game.js` `newGame` after relations, and one in `load()`): `guarantees[]`, `trade[]`, `tribute {to,v,until}`, `betrayed{}`, `excomm` (day), `calls{}`. Plus `s.coalitions{}`, `s.papacy {crusade}` and `s.empire {emperor, ruler, electors, last}`.
3. Actions:
   - `demandTribute` (a refusal gives an insult CB for 1 year)
   - `sellProvince` / `buyProvince` with `provinceValue(p)` (capitals excluded)
   - `guaranteeIndependence` / `revokeGuarantee` (guarantors join in `declareWar`; a guarantor that declines loses prestige)
   - `callToArms(aid, warId, xid)` with acceptance `'callToArms'`. A refused call goes in `a.calls[x]`, which allows breaking that alliance without penalty for 1 year.
   - `breakAlliance` penalties when the ally is at war: −1 stability, −15 prestige, `betrayed` opinion, −10 opinion from our other allies.
   - `fabricateClaim` accepts a chancellor **or** a spymaster, with a monthly chance of detection (opinion hit and an insult CB).
   - Papacy (PAP): `requestExcommunication`, `excommunicate`, `seekAbsolution`, `callCrusade`, `joinCrusade`. New CB types: `crusade`, `excommunication`, `coalition`.
   - HRE: the electors are BOH, SAX, BRA, BAV, AUS and MEI. An election runs when the emperor's ruler changes, and electors vote by opinion, prestige and self-interest. The emperor gets an `n.mods` entry `{src:'emperor', mods}`.
4. Peace:
   - New demand types: `release` (revive or restore a nation from `map.owner` original provinces) and `tribute`.
   - `peaceAcceptance` also returns `reasons[]`, which the UI can show as the white-peace explanation.
   - `describeDemand` in `panels.js` needs the new types (small additive edit).
5. Coalitions:
   - `updateCoalitions()` runs once a month: members have AE ≥ 30 and opinion < −20, and a coalition needs at least 3 members. Members defend together and can declare a coalition war.
   - AE spread in `makePeace`: neighbours of the province ×1, the winner's neighbours ×0.4, the loser's culture group ×0.3.
   - Trade agreements: `proposeTradeAgreement` / `cancelTrade`, applied as an `n.mods` entry `{src:'trade_agreements', mods:{tradeMult}}`. This is the hook for economy.
6. AI:
   - `aiDiplomacyExtras(n)`, called from `monthlyDiplomacy` for non-player realms. It covers tribute, buying and selling land, guarantees, calls to arms, breaking alliances, excommunication and absolution, joining crusades and trade agreements.
   - A one-line hook in `ai.js` `aiPeace`: `budget = this.aiPeaceExtras(w, side, n, demands, budget)` for vassal, tribute and release demands.
   - AI never sends proposals *to the player*, because no UI inbox exists yet (needs the UI workstream).
