# Workstream 8 — Content: nations, focus trees, events (`ws/content`)
Owns `js/data/focus.js`, `js/data/events.js`, `js/data/nations.js`, `js/data/cities.js`, `js/data/names.js`.

Goals
1. Unique historical focus trees for every great power and key minors (England/Magna Carta, France/Bouvines, HRE/Staufer vs Welf, Byzantium/1204, Castile/Las Navas, Venice/Fourth Crusade, Mongols, Rus', Hungary/Golden Bull, Papacy, Ayyubids, Almohads), 25–40 nodes each with branching, mutually exclusive paths.
2. 100+ events: historical (with date windows and conditions) and dynamic (plague, famine, comet, heresy, succession crisis), each with 2–3 meaningful options.
3. Data accuracy pass on rulers, capitals, cultures, religions, alliances in 1200; more name pools.
4. Formable nations (Kingdom of Portugal → Iberia, Kingdom of Italy, Rus' unification).
Constraints: data-only where possible; any new effect type needs a handler in `politics.js` — keep it to a short, additive edit and describe it in the PR.
