# Workstream 6 — Diplomacy & peace (`ws/diplomacy`)
Owns `js/sim/diplomacy.js`.

Goals
1. Richer actions: demand tribute, sell/buy provinces, guarantee independence, call to arms per war, break alliance with penalties, fabricate claims via spymaster, papal excommunication & crusade calls, Holy Roman Empire elections.
2. Peace: per-province demands on the map (already exists) plus gold reparations, vassalisation, release nations, white peace by AI acceptance formula shown to the player.
3. Opinion breakdown UI data (`opinionBreakdown(a, b)`), AI acceptance reasons (`whyNot()`), so the UI can explain every refusal.
4. Coalitions & aggressive expansion tuning; trade agreements hook for the economy workstream.
Constraints: AI must use every new action (add calls in `ai.js` with a small, clearly separated function, or document it for the AI workstream).

## Status
Step 1 pushed (check + smoke OK). All in `js/sim/diplomacy.js`; no `game.js` edit: per-nation state is `n.dip` (lazy via `this.dip(n)`), `s.coalitions` rebuilt monthly.

Done:
- `whyNot(aid,bid,kind)` → `[ok, "They refuse: Reason −n, …"]`; every `propose*`/`demandVassal` returns it. New acceptance kinds: tribute, guarantee, callToArms, trade.
- Actions (return null or a reason): `demandTribute` (refusal → insult CB 1y), `buyProvince(aid,p)`, `sellProvince(aid,bid,p)`, `provinceValue(p)`, `guaranteeIndependence`/`revokeGuarantee` (guarantors join in `declareWar`, decliners −10 prestige), `callToArms(aid,warId,xid)` (refusal allows penalty-free `breakAlliance` for a year), `breakAlliance` penalties, `proposeTradeAgreement`/`cancelTrade` (n.mods `trade_agreements` → `tradeMult`, economy to consume), `fabricateClaim` with spymaster (chancellor-only forgeries can be detected).
- Peace: demand types `tribute`, `release` ({nation, provs}; see `releasable()`); `peaceAcceptance` returns `reasons[]`; AE spread to winner's neighbours ×0.4 and culture group ×0.3.
- Coalitions: `updateCoalitions()` monthly (AE ≥30, opinion < −20, ≥3 members), members join the defender; opinion breakdown lines.
- AI: `aiDiplomacyExtras(n)` (monthly) and `aiPeaceExtras` (hook in `ai.js` aiPeace); `describeDemand` in panels.js extended.

Not done: papacy (excommunication, crusade calls), HRE elections. UI buttons for the new actions need the UI workstream (open an issue `ws:ui`).
