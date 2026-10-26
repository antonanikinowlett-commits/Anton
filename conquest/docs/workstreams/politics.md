# Workstream 7 — Politics, laws, estates & characters (`ws/politics`)
Owns `js/sim/politics.js`, `js/sim/characters.js`, `js/sim/estates.js`, `js/data/government.js`, `js/data/traits.js`.

Goals
1. Characters: dynasties & family trees, marriages producing heirs, regency for minors, claimant pretenders, ministers with ambitions and loyalty, assassination/plots.
2. Estates: estate privileges to grant/revoke, estate demands as events, estate-led revolts with their own armies.
3. Laws: logical prerequisites and transitions (e.g. elective → hereditary needs legitimacy + clergy support), law-change cost in stability and estate loyalty; government reforms (feudal → centralised monarchy, merchant republic, theocracy).
4. Religion: heresies (Cathars), papal authority, conversion of pagans, religious unrest.
Constraints: new state must be JSON-serializable and back-filled in `load()`; AI support for every new choice.
