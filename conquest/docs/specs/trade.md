# Spec: Trade routes, merchant republics & embargoes

Status: approved for M2 · Areas: economy, diplomacy, ai, ui, render

## Why
Venice, Genoa, the Hansa and the Silk Road terminus at Constantinople defined 13th-century politics; today trade is only an income line. Trade should give a reason to fight for specific provinces (ports, straits, river towns) and a non-military lever (embargo).

## Behaviour
1. **Trade nodes** (~15: Venice, Genoa, Constantinople, Alexandria, Bruges/Flanders, Lübeck, Novgorod, Kiev, Champagne fairs, Seville, Tunis, Acre, Sarai, Crimea, Baltic/Visby). Each node is a set of provinces; static data in `js/data/trade.js` (economy owns).
2. **Routes**: a directed graph of nodes; value flows downstream. A node's value = sum of its provinces' dev × goods price.
3. **Trade power** per realm per node from owned provinces (ports ×2, trade buildings, merchant-republic government). Income = node value × share.
4. **Merchants**: each realm has 1–3 merchants (more for republics) to place in a node to steer value or collect.
5. **Embargo** (diplomacy action): target loses trade power in nodes where you have power; opinion −50; free for at-war pairs.
6. **Trade agreements**: +10 % trade power for both in shared nodes.

## State
```
s.trade = { nodes: [{id, value, power:{nid:x}}], merchants: {nid:[nodeId]} }
n.embargoes = [nid]  // diplomacy-owned
```

## Area split
| Area | Work |
|---|---|
| ws:economy | node data, monthly node value/power/income calc (≤ 0.5 ms/month), `tradeShare(nid)`, merchants, budget ledger line |
| ws:diplomacy | `embargo(a,b)`, `liftEmbargo`, `tradeAgreement(a,b)`; opinion/AE; `whyNot` |
| ws:ai | place merchants, embargo rivals, value trade provinces in war goals |
| ws:ui | trade panel (nodes list, your share, merchants), embargo button in diplomacy |
| ws:render | `trade` map mode: node regions + route arrows |

## Acceptance
- Venice and Genoa have top-3 income per province in year 1.
- Taking Constantinople visibly raises the taker's trade income.
- Embargo lowers the target's trade income in the ledger next month.
