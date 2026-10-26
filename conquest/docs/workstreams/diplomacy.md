# Workstream 6 — Diplomacy & peace (`ws/diplomacy`)
Owns `js/sim/diplomacy.js`.

Goals
1. Richer actions: demand tribute, sell/buy provinces, guarantee independence, call to arms per war, break alliance with penalties, fabricate claims via spymaster, papal excommunication & crusade calls, Holy Roman Empire elections.
2. Peace: per-province demands on the map (already exists) plus gold reparations, vassalisation, release nations, white peace by AI acceptance formula shown to the player.
3. Opinion breakdown UI data (`opinionBreakdown(a, b)`), AI acceptance reasons (`whyNot()`), so the UI can explain every refusal.
4. Coalitions & aggressive expansion tuning; trade agreements hook for the economy workstream.
Constraints: AI must use every new action (add calls in `ai.js` with a small, clearly separated function, or document it for the AI workstream).
