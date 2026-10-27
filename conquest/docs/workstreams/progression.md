# Progression (`ws/progression`)
Owns new files `js/sim/progression.js` (ProgressionMixin) and `js/data/innovations.js`, plus a self-contained progression panel appended to the UI.

1. Innovations (the medieval "tech tree"): ~60 innovations in eras (Early High Medieval 1200 → High Medieval 1250 → Late Medieval 1300+), in branches military (crossbow, plate, trebuchet, longbow), civic (universities, Roman law, double-entry bookkeeping), agriculture (heavy plough, three-field rotation, windmill), maritime (cog, compass). Research is driven by learning (court chaplain), development, universities and cultural spread from neighbours. Innovations unlock units, buildings, laws and modifiers through the existing `n.unlocks` and `recalcMods` hooks.
2. Realm rank: county → duchy → kingdom → empire, raised by size and prestige (with coronation events); rank gates titles, laws, council seats and diplomatic weight.
3. Ambitions: rulers pick personal ambitions (build a cathedral, win 3 battles, marry into a great house) that pay prestige/legitimacy.
4. Achievements/score screen: long-term goals and a summary at game end (1453).
Hook into `monthly()` with one line, default the state in `newGame`, back-fill it in `load()`. Give the AI a function to choose research (open an issue for `ws:ai` with the method to call, or add a small clearly separated function).

## Status
_Updated 2026-10-27._

**Done (first slice, pushed):** `js/data/innovations.js` (60 innovations, 4 branches x 3 eras, prerequisites, mods, unlocks); `js/sim/progression.js` (ProgressionMixin): monthly research (chaplain/ruler learning, development, churches, university focus, `researchSpeed`, neighbour discount, early-research penalty), `n.prog` state, innovation mods via `n.mods` (`src: innov:<id>`), unlocks via `n.unlocks` (longbowmen only English/Welsh; `roman_law`), `aiResearch`, realm rank + `crownRealm`/`realmRank`/`rankInfo`, ambitions, achievements, `nationScore`, `gameEnd` event at 1453 (sets `s.ended`). Hooks in `game.js`: `initProgression()` in `newGame` and `load()`, `monthlyProgression()` in `monthly()`. Horde nations are back-filled in the monthly hook.

**UI (done 2026-10-27):** `js/ui/panels/progress.js` — tab `i` (Innovations grid by branch/era with tooltips, Realm Rank + coronation, Ambitions, Achievements & Score) and a top-bar research alert. Opens in ~10 ms. **Not done:** end-of-game modal (`ws:ui`), issues for `ws:politics`/`ws:diplomacy`/`ws:ai`, balance tuning, icons for innovations (cards are text-only).

**Content pass (2026-10-27, orchestrator request):** innovation/rank/ambition SVG icons; end-of-game score modal (`showEndScore` in `panels/progress.js`, triggered from `alerts.js` when `s.ended`); 40 new events in `js/data/events.js` (31 dynamic incl. Black Death 1347-50, 9 scripted historical for ENG/TOU/CAS/FRA/HUN/POL/HRE/WAL/SIC, existing effect types only); a second unique focus branch (x columns 24-27) for ENG, FRA, HRE, BYZ, CAS, VEN in `js/data/focus.js` (`U2`). No data validator exists in `tools/`; I checked ids, tags, effect keys and conds with throwaway scripts.
