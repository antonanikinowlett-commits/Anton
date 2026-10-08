# Crown & Conquest — Europe 1200

A grand-strategy game of conquest, diplomacy and statecraft in medieval Europe, in the spirit of Hearts of Iron but set in Anno Domini 1200. Runs entirely in the browser (Three.js, no build step).

## Running

ES modules need to be served over HTTP:

```
cd conquest
python3 -m http.server 8000
# open http://localhost:8000
```

## What's in it

- **Real geography**: coastlines, lakes and rivers from Natural Earth, NASA elevation, Mercator projection from Iberia to the Volga and from Egypt to Scandinavia.
- **~3,450 land provinces + ~110 sea zones**, grown from ~600 historical settlements by a terrain-aware algorithm so borders follow rivers and ridgelines. Every border is fluid: provinces change hands through peace treaties and occupation (shown striped).
- **67 realms of 1200** (Angevin England, Capetian France, the Empire, Byzantium, Almohads, Ayyubids, Rus' principalities, pagan Baltic tribes…) with historical rulers, heraldry, generals and alliances; the Fourth Crusade and the Mongol invasion arrive on schedule.
- **3D map**: zoom in and every castle (motte, keep, concentric), church/mosque/sacred grove, farm, market, mine, stud farm, barracks, harbour, forest and marching soldier appears in 3D; zoom out to a political map with realm names laid across the land. Map modes for terrain, diplomacy, religion, culture, development, supply, forts, unrest.
- **War**: 15 unit types, army template designer, generals with traits, doctrines, supply and attrition, seasons, river crossings, high ground, weather, frontage by terrain, flanking and envelopment, morale-driven routs and cavalry pursuit, sieges with engines and assaults, zones of control, sea transport, war score and peace treaties.
- **Tactics from real battles** (Hastings shield wall & feigned retreat, Crécy arrow storm, Bannockburn schiltron, Falkirk, Cannae envelopment, Hattin, Manzikert…) chosen per phase, with counters. Watch any battle in the **real-time battle viewer**.
- **Politics**: royal council, four estates with loyalty and influence that vote on laws, nine law categories gated logically by government, faith and prerequisites, national focus trees built per realm (shared branches + faith + government + unique historical branches), events, succession, revolts.
- **Diplomacy**: opinion with breakdowns, alliances, marriages, pacts, vassals, claims, casus belli, aggressive expansion and coalitions.
- **Dynamic tutorial** that follows what you do, plus contextual hints.

## Controls

Left-drag pan · wheel zoom · click select · right-click move/attack · shift-drag box-select · WASD/arrows pan · Q/E zoom · Space pause · 1–5 speed · R C L F G M B X N panels · Esc close.

## Rebuilding map data

`tools/build_geo.mjs` regenerates `data/geo.js` and `data/height.png` from Natural Earth GeoJSON and a NASA elevation bump map (see the script header).
