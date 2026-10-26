# Progression (`ws/progression`)
Owns new files `js/sim/progression.js` (ProgressionMixin) and `js/data/innovations.js`, plus a self-contained progression panel appended to the UI.

1. Innovations (the medieval "tech tree"): ~60 innovations in eras (Early High Medieval 1200 → High Medieval 1250 → Late Medieval 1300+), in branches military (crossbow, plate, trebuchet, longbow), civic (universities, Roman law, double-entry bookkeeping), agriculture (heavy plough, three-field rotation, windmill), maritime (cog, compass). Research is driven by learning (court chaplain), development, universities and cultural spread from neighbours. Innovations unlock units, buildings, laws and modifiers through the existing `n.unlocks` and `recalcMods` hooks.
2. Realm rank: county → duchy → kingdom → empire, raised by size and prestige (with coronation events); rank gates titles, laws, council seats and diplomatic weight.
3. Ambitions: rulers pick personal ambitions (build a cathedral, win 3 battles, marry into a great house) that pay prestige/legitimacy.
4. Achievements/score screen: long-term goals and a summary at game end (1453).
Hook into `monthly()` with one line, default the state in `newGame`, back-fill it in `load()`. Give the AI a function to choose research (open an issue for `ws:ai` with the method to call, or add a small clearly separated function).

## Status
_Updated 2026-10-26 — handover; the role is moving to a new session._

**Done:** nothing in code yet. I read the codebase and settled on the design below.

**Half-done:** none.

**Next (planned design, findings from the code):**
- **Hooks into `game.js`** (one line each): `this.initProgression()` in `newGame` before the final `recalcMods` loop; the same call in `load()` to back-fill old saves; `this.monthlyProgression()` once after the per-nation loop in `monthly()`, so neighbour scans run once per month for all realms. Horde nations are created in `military.js:567` without the new fields, so `monthlyProgression` must also back-fill any nation that lacks them.
- **Innovation modifiers:** push `{ src: 'innov:<id>', mods }` onto `n.mods`. `recalcMods` already sums `n.mods`, so `game.js` needs no other change. Use existing modifier keys (taxMult, tradeMult, foodMult, devGrowth, buildCost, buildSpeed, siege, fortDefense, supply, seaSpeed, rangedAtk, cavAtk, infAtk, infDef, discipline, armyMorale, manpowerMult, focusSpeed, legitimacyMonthly, …) and add a new one, `researchSpeed`. Unit and law unlocks go into `n.unlocks`: `longbowmen` (restrict to English/Welsh with an innovation `req`) and `roman_law` (law req `['unlock','roman_law']`). Note: `politics.js:27` labels that law requirement "University (focus)"; open an issue for `ws:politics` to reword it.
- **Data (`js/data/innovations.js`):** about 60 innovations in 4 branches (military, civic, agriculture, maritime) × 3 eras (1200, 1250, 1300). Each has a historical `year`; researching before that year costs more.
- **Research points per month:** a base amount, plus the chaplain's and ruler's learning skill, plus sqrt of total development, plus church levels, plus a bonus once the `university` focus is done. Each neighbouring realm that already knows an innovation makes it up to 40% cheaper (find neighbours by scanning province adjacency once a month). Unspent points are banked, up to a cap.
- **AI:** a separate `aiResearch(n)` in `progression.js`, called from the monthly hook for non-player realms that have no current research. Open a `ws:ai` issue for visibility.
- **Realm rank** 0–3 (county/duchy/kingdom/empire). The starting rank comes from the realm's name/gov or, failing that, its size. Rank goes up through a coronation (prestige + gold, provinces/dev thresholds) and goes down when the realm shrinks. Rank modifiers use `src: 'rank'`. Expose `realmRank(nid)` and open issues so that `ws:politics` (laws, titles, council), `ws:diplomacy` (weight) and characters' `rulerTitle` can read it.
- **Ambitions:** one active at a time, with a deadline. Progress is measured against a snapshot taken when the ambition starts (`stats.won`, total building levels, church level 3, a marriage with a kingdom-rank house, gold, provinces, dev, innovations). Rewards are prestige, legitimacy and timed mods; failing costs some prestige. The AI picks ambitions too.
- **Achievements & score:** checked yearly for the player. Score = dev + prestige + innovations + rank + battles + achievements, with a history entry every 5 years. At game end (1453) emit `gameEnd` once and set `s.ended`. Open a `ws:ui` issue for an end-of-game modal and pause.
- **UI:** a new file `js/ui/progression.js` that `panels.js` imports and assigns to `PANELS.progress` (`wide: true`). The panel has subtabs: Innovations grid, Rank, Ambitions, Achievements/Score. It also needs one `TABS` line in `ui.js`: `{ id: 'progress', icon: '📚', name: 'Progress', key: 'i' }`. The key `i` is free; it can't be registered from panels.js because of the circular import and TDZ. Add `'i'` to the panel keys in `tools/smoke.cjs` or ask `qa`.
