# Playtest — round 1 (dev merged 2026-10-27)

Method: headless Chromium at 1280×720, started as England and France (tutorial on and off), ran ≈ 12 in-game months at speed 5, opened every side-bar panel, read the events that fired. Screenshots in `docs/playtest/` (01 start, 03 boot, 06 military, 08 focus, 09 diplomacy, 11 event under tutorial, 14 France after 8 months, 15 wars, 16 ledger). Judged as a CK3/EU4/HOI4 fan. Existing issues are referenced, not duplicated.

**What works:** the start screen (blurbs, difficulty, rulers, neighbours), the map look, the focus tree (exclusive branches, effects shown), event options that show their costs, the diplomacy panel with relative strength bars, the wars panel with war score. The foundation is promising.

## 20 biggest gaps (ranked)

| # | Gap | Why it matters | Owner | Size | Issue |
|---|---|---|---|---|---|
| 1 | **No objectives.** After the tutorial nothing says what to do or what "winning" is (no goals, no end date/score, no victory conditions). | A strategy game without a goal loses players in the first 10 minutes. | progression + ui | M | #60 |
| 2 | **Innovations have data (`innovations.js`) but no UI anywhere** — no research panel, no key, no alert. | Tech/progression is a core HOI4/EU4 loop and is invisible. | ui + progression | M | #61 |
| 3 | **Nothing to spend on.** Gold sat at 567 (+34/month) and food at 906 after a year; no sinks, no suggested actions, no alerts. | Dead economy: no decisions. | economy + ui | M | #62 |
| 4 | **No alerts bar.** Idle armies (💤), unspent gold, free focus, empty council seats, expiring truces are silent (only a red dot on Focus). | HOI4/EU4 players live on the alert strip. | ui | M | #63 |
| 5 | **Tutorial card overlaps events and panels** and stays on step 1 while the clock runs; 18 steps, text-only. | Blocks the first events (screenshot 11). | ui | S | #50, #69 |
| 6 | **Quiet world.** Only 2 wars in Europe in 8 months, none in the West; the player can sit for a year with no pressure. | No tension, no threats. | ai + diplomacy | M | #23, #33 |
| 7 | **Sparse events**: 1 event in ~8 months of play; few "consequence" chains. | CK3's heartbeat is events. | content | M | #40, #41 |
| 8 | **War is opaque for the player**: wars panel lists score only; no front-line status, casualties, siege progress, war-goal objectives or "what do I do now". | War is the main action. | ui + military | M | #64 |
| 9 | **Supply/attrition invisible** (no supply map mode, no attrition warning, no forage/devastation feedback). | HOI4-depth promise unmet. | military + render | L | #65 |
| 10 | **Odd world balance**: after one year the Cuman Khanate leads the power ledger (470 provinces) and the Almohad army shows 2,959 men on 858 provinces; France ranks 10th. | History plausibility and fairness at start. | content + ai | M | #66 |
| 11 | **Trade absent** (spec exists). Economy is gold/food only. | EU4/CK3 trade identity. | economy | L | specs/trade.md |
| 12 | **Religion/papacy absent** as a player system (spec exists). | Medieval identity: crusades, excommunication. | diplomacy + politics | L | specs/crusades.md |
| 13 | **Espionage/intrigue absent**: no spies, plots, fabricate claim, assassination. | Standard CK3/EU4 tool. | diplomacy + politics | L | new later |
| 14 | **No sound or music at all** (no AudioContext in code). | Half of the atmosphere. | design | M | #67 |
| 15 | **Naval gameplay absent** for the player (no fleets, blockades, transports). | England/Venice/Scandinavia can't play right. | military + battle | L | #22 |
| 16 | **Estates/rebellion hidden**: stability +1.0 is the only signal; no unrest indicator or revolt warning. | Players can't plan; revolts feel random. | politics + ui | M | #39 |
| 17 | **Difficulty is a static label**; no AI aggression/handicap choice, no ironman/save rules. | Replayability for veterans. | ai + ui | M | new later |
| 18 | **Map modes lack a legend/tooltip** (icons only in the mode strip). | New players can't read the map. | ui + render | S | new later |
| 19 | **Dynasty/court depth unverified** in this pass (court panel opens; no heir/marriage prompts surfaced in 8 months). | CK3 expectation. | politics | M | check next round |
| 20 | **Settings/accessibility**: no UI scale, key rebinding, touch layout (brief goal, not shipped). | Reach. | ui | M | ui brief |

## Next round
Re-run after the orchestrator merges `dev`; try war end-to-end (declare, siege, peace deal), saves, laws, and a non-Western start (Byzantium, Mongol-adjacent).
