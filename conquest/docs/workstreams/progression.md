# Progression (`ws/progression`)
Owns new files `js/sim/progression.js` (ProgressionMixin) and `js/data/innovations.js`, plus a self-contained progression panel appended to the UI.

1. Innovations (the medieval "tech tree"): ~60 innovations in eras (Early High Medieval 1200 → High Medieval 1250 → Late Medieval 1300+), in branches military (crossbow, plate, trebuchet, longbow), civic (universities, Roman law, double-entry bookkeeping), agriculture (heavy plough, three-field rotation, windmill), maritime (cog, compass). Research is driven by learning (court chaplain), development, universities and cultural spread from neighbours. Innovations unlock units, buildings, laws and modifiers through the existing `n.unlocks` and `recalcMods` hooks.
2. Realm rank: county → duchy → kingdom → empire, raised by size and prestige (with coronation events); rank gates titles, laws, council seats and diplomatic weight.
3. Ambitions: rulers pick personal ambitions (build a cathedral, win 3 battles, marry into a great house) that pay prestige/legitimacy.
4. Achievements/score screen: long-term goals and a summary at game end (1453).
Hook into `monthly()` with one line, default the state in `newGame`, back-fill it in `load()`. Give the AI a function to choose research (open an issue for `ws:ai` with the method to call, or add a small clearly separated function).
