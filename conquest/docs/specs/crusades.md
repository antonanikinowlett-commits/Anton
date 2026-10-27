# Spec: Papacy, excommunication & crusades

Status: approved for M2 · Owner of the spec: PM · Areas: diplomacy, politics, ai, content, ui

## Why
In 1200 the Pope is the strongest diplomatic force in Latin Europe. Today crusades exist only as a `holy_war` casus belli (`diplomacy.js` `declareWar`) and one hard-coded `fourth_crusade` event (`politics.js`). Players can't call, join, fund or be punished by a crusade, and the AI never reacts to one.

## Player-facing behaviour
1. **Papal authority** (`n.papalFavor`, 0–100, Catholic realms only). Rises with donations, crusade participation, clergy-friendly laws; falls with attacking Catholics without a CB, seizing church land, defying the Pope.
2. **Excommunication.** The Papacy (AI or player PAP) may excommunicate a Catholic ruler with favour < 15. Effects: −legitimacy/month, clergy loyalty −20, every Catholic realm gets a free `excommunicated` CB against them, marriages/alliances with them cost opinion. Lifted by paying a penance (gold + favour) or a new ruler.
3. **Crusade call.** PAP calls a crusade against a target (non-Catholic realm owning a holy site or bordering Catholics) every ~15–25 years or by event. The call lasts 2 years: Catholic realms may *take the cross* (join as co-belligerents), *donate* gold (favour), or ignore (small favour loss).
4. **Crusade war.** One shared war, leader = biggest contributor; war score for "holding the target province(s)". On victory the occupied provinces go to the realm that holds them; participants gain prestige and favour proportional to contribution (`battles won + provinces sieged`).
5. **Jihad mirror.** Sunni realms (Ayyubids, Almohads) can respond with a defensive jihad call from the leading Sunni realm; same mechanics, no Pope.

## State (JSON, back-filled in `load()`)
```
s.papacy = { holder: nid|-1, crusade: null | { id, target, targetProvs[], callDay, endDay, warId, members:{nid:contribution}, donations:{nid:gold} } }
n.papalFavor = 50   // Catholic realms
n.excommunicated = false
```

## Area split (each its own issue, referencing this spec)
| Area | Work |
|---|---|
| ws:diplomacy | `papalFavor` changes, `excommunicate(nid)`, `liftExcommunication(nid)`, `callCrusade(targetNid)`, `joinCrusade(nid)`, `donateCrusade(nid, gold)`; crusade war creation and peace resolution; `whyNot()` reasons |
| ws:politics | Excommunication effects on legitimacy/clergy; law/estate hooks for favour; replace hard-coded `fourth_crusade` with the generic call |
| ws:content | Events: "The Pope calls for a crusade", "Take the cross?", "Excommunicated!", "Penance at Canossa", "Fall of Constantinople 1204" via the new system; historical crusades (Fourth 1202, Fifth 1217, Albigensian 1209, Baltic) as scheduled calls |
| ws:ai | Pope AI decides calls/excommunication; Catholic AI joins by zeal/personality/distance; Sunni AI jihad response |
| ws:ui | Papacy panel (favour, active crusade, contributors leaderboard, join/donate buttons), excommunication badge on realm header and diplomacy panel |

## Acceptance
- In a 50-year all-AI run (qa-sim longrun) at least 2 crusades are called, ≥ 3 realms join each, and at least one ends in a peace transferring provinces.
- A player as FRA can see the crusade call, join it with one click, and see their contribution rank.
- Old saves load (no `s.papacy` → default).
- Tick cost stays within budget (crusade logic runs monthly, not daily).
