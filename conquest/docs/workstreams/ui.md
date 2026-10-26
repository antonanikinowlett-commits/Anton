# Workstream 10 — UI/UX, tutorial & saves (`ws/ui`)
Owns `js/ui/ui.js`, `js/ui/panels.js`, `js/ui/start.js`, `js/ui/tutorial.js`, `js/ui/heraldry.js`, `js/ui/portrait.js`, `css/style.css`, `index.html`, `js/main.js`.

Goals
1. Split `panels.js` (626 lines) and `ui.js` (835 lines) into one module per panel (`js/ui/panels/*.js`) with a tiny registry so other workstreams can add panels without editing a central file.
2. Outliner (armies, fronts, sieges, constructions), alerts bar (idle armies, empty council seats, available focus), tooltips with breakdowns everywhere.
3. Save system: multiple named slots, autosave every year, export/import save file, version check.
4. Settings: UI scale, keybinds, graphics quality, auto-pause on events; mobile/touch-friendly layout.
5. Tutorial: update for fronts, merging, map peace deals; dynamic hints.
Constraints: menus must open instantly (no full re-render of the map). Do this refactor first and push early, since other workstreams touch `panels.js` additively.

## Status
**Done — goal 1 (panels/ui split)**, pushed:
- `js/ui/panels.js` now only loads panel modules. There is one module per tab in `js/ui/panels/` (realm, court, laws, focus, diplomacy, military, economy, wars, ledger). Each module calls `registerPanel({ id, icon, name, key, order, wide?, static?, tab?, render(ui, pb) })` from `panels/registry.js`. `TABS` is built from the registry, sorted by `order` (built-in tabs use 10…90). To add a panel, create a new file and add one import line to `panels.js`. Shared helpers (`H`, `subtabs`, `barHTML`, `skills`, `traitChips`, `roleTitle`, `estName`, `describeDemand`) are in `panels/common.js`.
- `js/ui/ui.js` keeps the shell: tabs, panel rendering, modes/minimap, tooltips, toasts/modals, keys, selection, wiring and `update`. The rest moved into mixins assigned onto `UI.prototype`: `topbar.js`, `alerts.js` (alerts + events), `province.js`, `army.js` (army panel + frontTools), `peace.js`, `menu.js`. `terrainTip`/`unitTip` moved to `tips.js` and are still re-exported from `ui.js`.
- `docs/ARCHITECTURE.md` describes the new layout and the "add a panel" step.
- Checks: `npm run check` and `npm run smoke` pass. A deeper scratch test also passed: every tab and subtab, province, army, menu and alerts, no page errors, every panel opens in under 13 ms. ESLint `no-undef` is clean on `js/ui`.

**Next — goals 2–5 (not started; no code written):**
2. Outliner: a right-side collapsible frame with Armies (status icon: battle/moving/siege/idle/front), Fronts, Sieges (ours and against us) and Construction + mustering. Rebuild it about once a second only when its content key changes, and shift `#toasts` left while it is open. Alerts: idle armies while at war, unassigned generals, and "focus available" only when `focusStatus === 'available'` exists. Use the unused `.tab .dot` CSS to mark tabs that have alerts. Breakdown tooltips: province unrest (the formula is in `economy.js monthlyProvinces`), province income (`provinceIncome`), dev/supply chips, war score (battleScore/occupation) in the wars panel.
3. Saves: save logic is in `main.js` (`ui.on('save'|'load')`, keys `cc_saves`/`cc_save_*`, keeps 3). Planned: named slots, yearly autosave on `month` when the month is January, export/import as a `.json` file, and a version check against `serialize().v`.
4. Settings (`ui.settings`, currently not persisted): UI scale, keybinds, graphics quality, auto-pause on events, and a touch layout (an `@media (max-width: 900px)` block already exists).
5. Tutorial (`tutorial.js`): add steps for fronts, merging and map peace deals.

**Team update (from orchestrator):** integration branch is now `dev` (merged into `ws/ui`); read `docs/TEAM.md`. `heraldry.js` and `portrait.js` now belong to `ws/design`. After the brief's goals, work open GitHub issues labelled `ws:ui`, merge `origin/dev` whenever it moves, and message the orchestrator when blocked or a milestone is pushed.
