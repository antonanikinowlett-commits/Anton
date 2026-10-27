// Trade nodes of the 13th-century world. Every land province belongs to its nearest node (by lon/lat).
// Value flows downstream along `to`: listed upstream-first so one pass in this order settles the network.
// base = exotic goods arriving from outside the map (spices, silk, furs, gold).
export const TRADE_NODES = [
  { id: 'tabriz', name: 'Tabriz', lon: 46.3, lat: 38.1, base: 4, to: 'constantinople', desc: 'Caravans of the Silk Road from Persia and the East.' },
  { id: 'novgorod', name: 'Novgorod', lon: 31.3, lat: 58.5, base: 3, to: 'baltic', desc: 'Furs, wax and honey of the northern forests.' },
  { id: 'kiev', name: 'Kiev', lon: 30.5, lat: 50.4, base: 1.5, to: 'constantinople', desc: 'The route from the Varangians to the Greeks.' },
  { id: 'crimea', name: 'Crimea', lon: 34.1, lat: 44.9, base: 2, to: 'constantinople', desc: 'Steppe slaves, grain and the northern Silk Road.' },
  { id: 'alexandria', name: 'Alexandria', lon: 29.9, lat: 31.2, base: 6, to: 'venice', desc: 'Spices of India arrive through the Red Sea.' },
  { id: 'acre', name: 'Acre', lon: 35.1, lat: 32.9, base: 3, to: 'genoa', desc: 'The Crusader ports and the Damascus caravans.' },
  { id: 'constantinople', name: 'Constantinople', lon: 28.9, lat: 41.0, base: 3, to: 'venice', desc: 'The Queen of Cities, where Silk Road and Black Sea meet.' },
  { id: 'tunis', name: 'Tunis', lon: 10.2, lat: 36.8, base: 2, to: 'genoa', desc: 'Saharan gold and Ifriqiyan grain.' },
  { id: 'seville', name: 'Seville', lon: -6.0, lat: 37.4, base: 1.5, to: 'genoa', desc: 'Olive oil, wool and the wealth of al-Andalus.' },
  { id: 'danube', name: 'Vienna', lon: 16.4, lat: 48.2, base: 0.5, to: 'venice', desc: 'Silver of Bohemia and Hungary moving south.' },
  { id: 'baltic', name: 'Visby', lon: 18.3, lat: 57.6, base: 1, to: 'lubeck', desc: 'Gotland merchants of the eastern Baltic.' },
  { id: 'lubeck', name: 'Lübeck', lon: 10.7, lat: 53.9, base: 1, to: 'flanders', desc: 'Heart of the Hansa: salt, herring and cloth.' },
  { id: 'venice', name: 'Venice', lon: 12.3, lat: 45.4, base: 1, to: 'champagne', desc: 'La Serenissima, gateway of the East.' },
  { id: 'genoa', name: 'Genoa', lon: 8.9, lat: 44.4, base: 1, to: 'champagne', desc: 'Rival of Venice, mistress of the western sea.' },
  { id: 'champagne', name: 'Champagne Fairs', lon: 4.0, lat: 48.3, base: 0.5, to: 'flanders', desc: 'The great fairs where north and south meet.' },
  { id: 'london', name: 'London', lon: -0.1, lat: 51.5, base: 0.5, to: 'flanders', desc: 'English wool for the looms of Flanders.' },
  { id: 'flanders', name: 'Bruges', lon: 3.2, lat: 51.2, base: 1, to: null, desc: 'The cloth towns of Flanders, end of every road.' },
];
export const TRADE_NODE_INDEX = Object.fromEntries(TRADE_NODES.map((t, i) => [t.id, i]));
// share of a node's value that travels on downstream
export const TRADE_FLOW = 0.35;
