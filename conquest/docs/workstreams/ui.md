# Workstream 10 — UI/UX, tutorial & saves (`ws/ui`)
Owns `js/ui/ui.js`, `js/ui/panels.js`, `js/ui/start.js`, `js/ui/tutorial.js`, `js/ui/heraldry.js`, `js/ui/portrait.js`, `css/style.css`, `index.html`, `js/main.js`.

Goals
1. Split `panels.js` (626 lines) and `ui.js` (835 lines) into one module per panel (`js/ui/panels/*.js`) with a tiny registry so other workstreams can add panels without editing a central file.
2. Outliner (armies, fronts, sieges, constructions), alerts bar (idle armies, empty council seats, available focus), tooltips with breakdowns everywhere.
3. Save system: multiple named slots, autosave every year, export/import save file, version check.
4. Settings: UI scale, keybinds, graphics quality, auto-pause on events; mobile/touch-friendly layout.
5. Tutorial: update for fronts, merging, map peace deals; dynamic hints.
Constraints: menus must open instantly (no full re-render of the map). Do this refactor first and push early, since other workstreams touch `panels.js` additively.
