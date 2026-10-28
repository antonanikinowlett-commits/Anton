# Gameplay v2 — notes from the gameplay lead (branch `gameplay/v2`)

Method: headless playtests of the sim (`tools/qa/play.cjs`, `tools/qa/eval.cjs`: passive and "human-like" bots as FRA, POL, ENG, 1200–1208), real-UI playtests (`tools/qa/ui_play.cjs`), 20–40 year all-AI runs (`tools/qa/longrun.cjs`, eval snippets). Everything below was measured, not guessed.

## What was wrong (baseline, before this branch)
1. **Passive player never threatened.** France sat 5 years with 700+ gold unspent; Poland 1,600 gold, stability 3.0, legitimacy 100, no war at all. AI war logic needs `ratio > 1` *and* a CB, and rolls ~12% a month; a quiet realm just wasn't picked.
2. **Gold had no sinks and stability/legitimacy sat at their caps.** Legitimacy grew +1.9/month with nothing to spend it on; stability pegged at +2…+3. Province "building slots" were mentioned in tooltips but not enforced; the tier-2 buildings (guild hall, university, cathedral, town walls, toll bridge, armoury, tiltyard, shipyard, siege workshop) had `mods`/`chain`/`req` fields that **nothing in the sim read** — they were placebo.
3. **Innovations**: 60 near-identical entries, five per era per branch, no exclusivity, identical cost curve (260 × era), halved bonuses; every AI realm researched the *same* order (canon_law first in 67/67 realms).
4. **War opacity.** War score was computed against the *whole* enemy bloc, so occupying 15 of 16 provinces of the actual enemy gave score 23 (allies' land diluted it to 2.4%). No goals, no milestones, no advice, no retreat control, blockade log spam every month.
5. **Allies auto-joined wars on the player's behalf** ("We join the … War") — no choice, no consequence.
6. **No news**: nothing told you what the other realms did.
7. **Events are mostly flavour**: single-step, ±20 gold.
8. **No objectives**; the economy answers no "why did this change?" (no explain anywhere).

## What changed (all numbers visible in data; helpers listed for the UI)
### Decisions that matter
- `js/data/innovations.js`: 72 innovations. Era 0 now has exclusive pairs (Couched Lance ⟂ Mail Hauberks, Castles ⟂ Trebuchet, Charters ⟂ Canon Law, Guilds ⟂ Chancery, Plough ⟂ Collar, Watermill ⟂ Assarting, Clinker ⟂ Galleys, Law Merchant ⟂ Harbour Works); eras 1–2 are forks (Longbow ⟂ Pavise, Plate ⟂ Pikes, Retinues ⟂ Arrière-ban, Bombards ⟂ Bastions, Roman Law ⟂ Estates General, Banking ⟂ Exchequer, Wool ⟂ Three-field, Enclosure ⟂ Selective Seed, Carrack ⟂ Lateen, …). Every entry has its **own cost** (150–820), a price as well as a gain (negative mods), and some unlock a building (`bld`), unit (`unlock`) or law. Era gates: N learned in the previous era of the same branch.
- Helpers: `innovInfo(nid,id)` → `{state, cost, months, block, effects:[{text,good}], forfeits, breakdown}`, `innovBlock`, `innovForfeits`, `researchBreakdown(nid)`, `innovEffects(i)`/`modLines(mods)` in the data module (`MOD_INFO` has labels and sign direction).
- New mods now consumed by the sim: `devCost`, `manpowerRegen`, `xpGain`, `moraleRecovery`, `adminCap`.
- AI research picks by what the realm lacks (gold, food, order, war) with a stable per-realm taste, so realms diverge.
- Focus: every focus has its own length and **gold cost** (refund half if cancelled early). *Still weak:* focus effects are mostly upsides; the cost and the exclusive branches are the trade-off.
- Laws already had upside + downside; unchanged.

### Province & economy depth
- **Province stances** (`data/stances.js`): Balanced, Collect Dues (+35% tax, +4 unrest, growth ×0.4), Settle & Improve (−30% tax, growth ×3), Muster Rolls (+70% manpower), Fortify (+1 fort), Stockpile (+50% resources). API: `stanceOptions`, `setStance`, `provinceInfo`, `provinceIdentity`; AI uses them (`aiStances`).
- **Building slots**: `3 + floor(dev/2.5)`, enforced in `canBuild`; `provinceSlots(p)`.
- **Special buildings now work** (`updateBuildingMods`): per-level mods with caps, production chains burning iron/horses/timber, tolls, town walls fort +1, `req`/`minDev`/innovation gates.
- **Administrative capacity / overextension** (`overextension(nid)`, `explain(nid,'admin')`): start size ×1.2 or rank base, raised by laws, chancery/records innovations and the steward. Beyond it: tax −25%/100% over, unrest, legitimacy and stability drain. Alert on approach.
- **Legitimacy bands** (80+ bonuses, <40/<20 penalties, pretender revolts <25) so it is a resource and not a number that sits at 100.
- **`explain(nid, key, p)`** for `gold, manpower, food, stability, legitimacy, prestige, research, admin, unrest(p)`; `explainProvince(p)`; `modSources(nid,key)`; ledger `bump()/recentChanges()`. Top-bar tooltips use them (`ui/tips.js: explainTip`).

### War
- `js/sim/warplan.js`: **war goals** (picked from CB: claims, border ring, other-faith provinces; cheaper at the peace table ×0.7, non-goals ×1.3 and 1.4× AE), **score with parts** (60% occupation of the *enemy leader*, 15% allies' land, goals, capital, battles, exhaustion), **milestone reports** (25/50/75, goal taken, capital falls) as war notes + notifications, `warStatus(wid,nid)` dashboard data + `warAdvice`, wars-panel dashboard (`.war-dashboard`).
- **Orders**: `setArmyOrders/setFrontOrders({retreat, engage})` — retreat line (army leaves a battle in good order when its morale falls below it), engage policy (cautious falls back from a stack ≥25% stronger, aggressive hits adjacent weaker stacks); default retreat 30% for everyone. **Pincer** when armies arrive from different roads. **Veterancy** (`armyVeterancy`, xp bonus up to +35%, diluted by reinforcements).
- **AI musters before it marches**: it declares only when its field army (plus a third of its allies') is ≥0.9× the target's; otherwise it builds up (news: "X musters its host on the border of Y", notification when the player is the target). Measured over 25 AI years: attackers with ≥2× army ratio now win 38 / lose 5 (before: coin flip at any ratio, because the old gate used a "power" number with dev and gold in it).
- Peace table: `peaceAcceptance(...).parts` explains every term; `peaceCounter()` says which demands to drop. Leader's land counts in full for demand costs, allies' at 40%.
- Four unlockable late units tied to innovations: Halberdiers, Plate Knights, Pavise Crossbowmen, Bombards (render falls back to existing models).
- Blockade spam fixed (announce once per 180 days per province).

### Living world (`js/sim/world.js`)
- **News feed** `newsFeed({limit,kinds,nation})` fed from `log()`; Chronicle panel (key `h`).
- **Ultimatums**: a strong neighbour makes demands (~month 4–5 first; then every 12–22 months, Hard sooner). Pay (gold, truce 3y), show allies (needs strength), marriage, or defy (war). Early-warning notice before.
- **Ally calls**: allies *ask* the player (honour: join + prestige; decline: breaks the alliance with betrayal penalties). Friendly realms propose alliance/marriage.
- **Coalitions**: realms with aggressive-expansion ≥22 against a conqueror ally with ≥2 others and strike together (event for the player: buy off / prepare / let them come).
- `threats(nid)` / `opportunities(nid)` for onboarding UI. Dynamic events live in `s.dynEvents` and use the normal event popup.
- Event chains with consequences (`data/events_v2.js`): barons' demand → ultimatum → revolt → judgement; bankers' loan → bill due (default = trade/legitimacy hit); hunger → bread riots; famous captain; heir schooling (changes the heir).

### Onboarding & difficulty
- `objectives(nid)`: 13 objectives with rewards, 3 active at a time (Progress → Objectives tab, alert).
- 30-year all-AI runs (Normal & Hard, seeds 5/7): max realm growth ×1.6–1.9, no realm destroyed, 5.7–6.7 ms/day, ~3–5% of provinces change hands in 40 years.

## Still weak (honest list)
1. **AI offensive competence.** A defied ultimatum still gives months of nothing: England's fleets wandered the Baltic for 9 months, then a 9k stack camped in its own French provinces. Concentration/relief logic is basic. AI-vs-AI wars end in small border changes (the world is stable to the point of being *quiet*: ALM sits at exactly 858 provinces for 40 years).
2. **Stability still pegs at ~3 for a competent player**; war exhaustion barely bites at low intensity.
3. **Peace table**: AI acceptance is a single number (`will`); there is no counter-offer or "wants X more" dialogue. Demand cost is relative to the *whole* losing bloc, so cheap when allies are in the war.
4. **Focus trees** have costs/lengths now, but ~370 entries are still upside-only effects.
5. **Stability** is still high in peaceful realms (that is arguably right); shocks come from wars, estates, debt and occupation — but a well-run realm rarely drops below +1.
6. **Innovation panel** shows forks only via a ⇄ marker and tooltip; no side-by-side comparison. Unit unlocks are limited to existing units (no new unit types).
7. **Dynastic drama** is the old regency/claimant events plus heir schooling; no marriage politics for the player beyond the diplomacy panel.
8. Mongol-type horde mechanics, naval war, espionage, trade UI: untouched.
