// Icon set (see docs/STYLE.md §4): 24x24 filled glyphs in currentColor, stored as inline SVG markup.
// No DOM access, so tools (assets/icons/export.mjs) can import it under node.

const FLEUR = 'M50,18 C41,30 41,44 50,56 C59,44 59,30 50,18 Z M50,57 C40,46 27,44 25,55 C25,63 34,65 40,61 C36,67 41,71 46,66 L46,75 L37,77 L37,81 L63,81 L63,77 L54,75 L54,66 C59,71 64,67 60,61 C66,65 75,63 75,55 C73,44 60,46 50,57 Z';
const LION = 'M40,94 L44,74 L35,64 L29,50 L33,38 L27,31 L31,22 L42,19 L48,26 L53,21 L57,30 L52,37 L60,43 L69,41 L73,31 L69,22 L78,26 L81,37 L75,49 L65,57 L67,70 L76,78 L71,85 L61,75 L56,83 L61,97 L52,97 L48,83 Z';
const SWORD = '<path d="M11 1.5h2V15h-2z M12 0.5l1 1.5h-2z M7 15h10v2H7z M11 17h2v4h-2z M10 21h4v1.5h-4z"/>';
const RAYS = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<rect x="11" y="1" width="2" height="4" transform="rotate(${a} 12 12)"/>`).join('');

export const ICONS = {
  sword: SWORD,
  swords: `<g transform="rotate(45 12 12)">${SWORD}</g><g transform="rotate(-45 12 12)">${SWORD}</g>`,
  shield: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>',
  castle: '<path d="M3 21V7h3v2h2V7h2v2h4V7h2v2h2V7h3v14h-6v-5a3 3 0 0 0-6 0v5z"/>',
  crown: '<path d="M3 18h18v2H3z M3 6l5 5 4-6 4 6 5-5-2 11H5z"/>',
  scroll: '<path fill-rule="evenodd" d="M5 2h14v20H5z M8 6h8v2H8z M8 10h8v2H8z M8 14h5v2H8z"/>',
  ban: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 4.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15z"/><path d="M5.6 7l1.4-1.4L18.4 17 17 18.4z"/>',
  flame: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 3-7 1 1 1.5 2 2 3 1-2 1-5 1-8z"/>',
  wheat: '<path d="M11 9h2v13h-2z"/><g><ellipse cx="12" cy="4.5" rx="1.6" ry="3"/><ellipse cx="8.2" cy="8.5" rx="1.5" ry="3" transform="rotate(-35 8.2 8.5)"/><ellipse cx="15.8" cy="8.5" rx="1.5" ry="3" transform="rotate(35 15.8 8.5)"/><ellipse cx="8.2" cy="14" rx="1.5" ry="3" transform="rotate(-35 8.2 14)"/><ellipse cx="15.8" cy="14" rx="1.5" ry="3" transform="rotate(35 15.8 14)"/></g>',
  horse: '<path d="M5 21l2-8-2-4 4-5 5-2 2 3 4 4-3 1-1 3v8z"/>',
  dove: '<path d="M3 12c4 0 6-2 8-6 1 3 3 4 5 4l5-1-4 4c0 5-4 9-10 9l2-3c-3 0-5-3-6-7z"/>',
  star: '<path d="M12 2l3 7 7 .6-5.4 4.7 1.7 7.2L12 17.8 5.7 21.5l1.7-7.2L2 9.6 9 9z"/>',
  handshake: '<path d="M1 9l5-3 6 2 6-2 5 3-2 5-3 1-4 4-3-1-3 1-5-5z"/>',
  anchor: '<path fill-rule="evenodd" d="M12 1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z M12 3.2a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6z"/><path d="M11 6h2v14h-2z M8 9h8v1.8H8z M3 14h2c0 3 3 5 7 5s7-2 7-5h2c0 5-4 8-9 8s-9-3-9-8z"/>',
  cross: '<path d="M10.5 2h3v6.5H20v3h-6.5V22h-3V11.5H4v-3h6.5z"/>',
  orthodox: '<path d="M10.8 2h2.4v3H18v2H6V5h4.8zM10.8 5h2.4v17h-2.4zM5 9.5h14v2.2H5zM8 17l8-2.2v2L8 19z"/>',
  coin: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14z"/><path d="M11 8h2v8h-2z"/>',
  pillars: '<path d="M12 2l10 5v2H2V7z M4 10h3v8H4z M10.5 10h3v8h-3z M17 10h3v8h-3z M2 19h20v3H2z"/>',
  scales: '<path d="M11 4h2v15h-2z M7 20h10v2H7z M3 6h18v2H3z M5.5 8l3.5 7H2z M18.5 8l3.5 7h-7z M2 15.5h7a3.5 3 0 0 1-7 0z M15 15.5h7a3.5 3 0 0 1-7 0z"/>',
  bag: '<path fill-rule="evenodd" d="M8 2h8l-2 4c4 2 6 6 6 11 0 3-2 5-8 5s-8-2-8-5c0-5 2-9 6-11z M10.5 11.5h3v1.5h-3z M10.5 14.5h3V16h-3z"/>',
  eagle: '<path d="M12 3l2 3 8-2-3 5 3 3h-6l-1 4 2 5-5-3-5 3 2-5-1-4H2l3-3-3-5 8 2z"/>',
  target: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 4.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><circle cx="12" cy="12" r="1.8"/>',
  house: '<path fill-rule="evenodd" d="M12 3l10 9h-3v9H5v-9H2z M10 15h4v6h-4z"/>',
  houses: '<path d="M7 5l6 5h-2v6H3v-6H1z M17 8l6 5h-2v7h-8v-7h-2z"/>',
  hammer: '<path d="M3 7l4-4h7l2 2-3 3 8 8-3 3-8-8-3 3z"/>',
  pick: '<path d="M2 9C6 3 14 3 19 6l-2 3c-3-2-8-2-11 1z M11 8l2.5-1L22 20.5l-2.5 1.5z"/>',
  axe: '<path d="M11 3c5-2 9 1 10 6-3 0-5 0-7-1l-1 1 7 12-2 1-8-13 .5-1.2C8 6.5 9 4.5 11 3z"/>',
  log: '<path fill-rule="evenodd" d="M7 7h10a5 5 0 0 1 0 10H7A5 5 0 0 1 7 7z M5 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z"/>',
  tree: '<path d="M12 2l6 8h-3l5 7h-6v5h-4v-5H4l5-7H6z"/>',
  church: '<path d="M11 1h2v2h2v2h-2v2l7 4v11H4V11l7-4V5H9V3h2z"/>',
  mosque: '<path d="M12 5c4 0 7 3 7 7v1H5v-1c0-4 3-7 7-7z M11 1h2v4h-2z M3 14h18v8H3z M1 8l2-2 2 2v14H1z"/>',
  crescent: '<path d="M15 3.5a9 9 0 1 0 0 17 11 11 0 0 1 0-17z"/>',
  flag: '<path d="M5 2h2v20H5z M7 3h13l-3 4.5 3 4.5H7z"/>',
  ring: '<path fill-rule="evenodd" d="M12 9a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M12 11.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z"/><path d="M12 1l4 4-4 4-4-4z"/>',
  bow: '<path d="M4 2c9 2 16 9 18 18h-2.5C17.5 12 12 6 4 4.5z M5 3.5l1-1.5 15 15-1.5 1.5z"/>',
  people: '<circle cx="8.5" cy="7" r="3.5"/><circle cx="17" cy="8" r="3"/><path d="M1 21c0-5 3-8 7.5-8S16 16 16 21z M16.5 13c4 0 6.5 2.5 6.5 7h-5c0-3-.5-5-1.5-7z"/>',
  skull: '<path fill-rule="evenodd" d="M12 2a8 8 0 0 0-8 8c0 3 1.5 4.5 3 5.5V20h2v-2h2v2h2v-2h2v2h2v-4.5c1.5-1 3-2.5 3-5.5a8 8 0 0 0-8-8z M8.8 8.5a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z M15.2 8.5a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z"/>',
  arrow: '<path d="M3 9h12V4l7 8-7 8v-5H3z"/>',
  key: '<path fill-rule="evenodd" d="M8 3a5 5 0 1 0 3.5 8.5L13 13h2v2h2v2h3v-3.5l-8.5-8.5A5 5 0 0 0 8 3z M7.5 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/>',
  fleur: `<path transform="translate(-4 -3) scale(.32)" d="${FLEUR}"/>`,
  lion: `<path transform="translate(-1.5 -1.2) scale(.24)" d="${LION}"/>`,
  book: '<path fill-rule="evenodd" d="M2 5c4-1 8-1 10 1 2-2 6-2 10-1v14c-4-1-8-1-10 1-2-2-6-2-10-1z M11.4 8h1.200v11h-1.2z"/>',
  gear: `<path fill-rule="evenodd" d="M12 5.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>${[0, 45, 90, 135].map((a) => `<rect x="10.5" y="1.5" width="3" height="21" transform="rotate(${a} 12 12)"/>`).join('')}`,
  map: '<path fill-rule="evenodd" d="M2 5l6-2 8 2 6-2v16l-6 2-8-2-6 2z M8 5v14 M16 7v14"/><path d="M8 3h1.200v14H8z M14.8 7h1.200v14h-1.2z" fill="#000" fill-opacity=".35"/>',
  mountain: '<path d="M1 21l8-14 4 7 3-4 7 11z"/>',
  ship: '<path d="M11 3v12H4z M13 5v10h7z M3 17h18l-3 5H6z"/>',
  warn: '<path fill-rule="evenodd" d="M12 2l11 20H1z M11 9h2v6h-2z M11 17h2v2h-2z"/>',
  check: '<path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>',
  x: '<path d="M5 3.6L3.6 5 10.6 12l-7 7L5 20.4l7-7 7 7 1.4-1.4-7-7 7-7L19 3.6l-7 7z"/>',
  tent: '<path fill-rule="evenodd" d="M12 3l10 18H2z M12 11l3 10H9z"/>',
  pawn: '<path d="M12 3a3 3 0 0 0-1.5 5.6C9 9.5 8.5 11 9 13H7v2h2c0 2-1 4-3 5v2h12v-2c-2-1-3-3-3-5h2v-2h-2c.5-2 0-3.5-1.5-4.4A3 3 0 0 0 12 3z"/>',
  bolt: '<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
  sun: `<circle cx="12" cy="12" r="5"/>${RAYS}`,
  lock: '<path fill-rule="evenodd" d="M12 2a5 5 0 0 0-5 5v3H5v12h14V10h-2V7a5 5 0 0 0-5-5z M12 4.5A2.5 2.5 0 0 1 14.5 7v3h-5V7A2.5 2.5 0 0 1 12 4.5z"/>',
  city: '<path d="M2 22V10h5V4h6v8h4v-2h5v12z"/>',
  menu: '<path d="M3 5h18v2.500H3z M3 10.8h18v2.500H3z M3 16.5h18V19H3z"/>',

  play: '<path d="M7 4.5l13 7.5-13 7.5z"/>',
  pause: '<path d="M6 4h4v16H6z M14 4h4v16h-4z"/>',
  chevd: '<path d="M6.4 8.6L12 14.2l5.6-5.6L19 10l-7 7-7-7z"/>',
  chevr: '<path d="M8.6 6.4L14.2 12l-5.6 5.6L10 19l7-7-7-7z"/>',
  chevl: '<path d="M15.4 6.4L9.8 12l5.6 5.6L14 19l-7-7 7-7z"/>',
  chevu: '<path d="M6.4 15.4L12 9.8l5.6 5.6L19 14l-7-7-7 7z"/>',
  volume: '<path d="M3 9v6h4l5 4V5L7 9z M14.5 8.7l1.4-1.4a6 6 0 0 1 0 9.4l-1.4-1.4a4 4 0 0 0 0-6.6z M17.3 5.9l1.4-1.4a10 10 0 0 1 0 15l-1.4-1.4a8 8 0 0 0 0-12.2z"/>',
  mute: '<path d="M3 9v6h4l5 4V5L7 9z M15 9.4l1.4-1.4 2.6 2.6 2.6-2.6L23 9.4 20.4 12 23 14.6 21.6 16 19 13.4 16.4 16 15 14.6 17.6 12z"/>',
  info: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M11 7h2v2h-2z M11 11h2v6h-2z"/>',
  chart: '<path d="M4 20V10h4v10z M10 20V4h4v16z M16 20v-7h4v7z"/>',
  bank: '<path d="M12 2l10 5v2H2V7z M4 10h3v8H4z M10.5 10h3v8h-3z M17 10h3v8h-3z M2 19h20v3H2z"/>',
  trophy: '<path d="M7 3h10v5a5 5 0 0 1-4 4.9V16h3v2H8v-2h3v-3.1A5 5 0 0 1 7 8z M3 4h3v2.5c0 .8.4 1.5 1 2V11a4 4 0 0 1-4-5z M21 4h-3v2.5c0 .8-.4 1.5-1 2V11a4 4 0 0 0 4-5z M8 19h8v3H8z"/>',
  spear: '<path d="M12 1l2.8 6H9.2z M11 7h2v15h-2z"/>',
  helmet: '<path fill-rule="evenodd" d="M12 2.5a8 8 0 0 0-8 8V21h5v-4h6v4h5V10.5a8 8 0 0 0-8-8z M7.5 9.5h9v2.2h-9z"/>',
  crossbow: '<path d="M2 9c4-4.5 16-4.5 20 0l-1.5 1.4C17 7.6 7 7.6 3.5 10.4z M11 6h2v14h-2z M8 19h8v2.5H8z"/>',
  trebuchet: '<path d="M2 21h20v-2h-9L19 5l-2-1-7 15H2z M18 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>',
  compass: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16z M16 8l-2.2 5.8L8 16l2.2-5.8z"/>',
  quill: '<path d="M21 2C12 3 6 8 5 16l-3 6 2.2.5L7 19.5C15 18.5 21 13 21 2z"/>',
  flask: '<path d="M9 2h6v2h-1v5l5.5 9.5A2 2 0 0 1 17.7 21H6.3a2 2 0 0 1-1.8-2.5L10 9V4H9z"/>',
  cap: '<path d="M12 3L1 9l11 6 9-4.9V17h2V9z M5 13.5V17c0 1.5 3 3 7 3s7-1.5 7-3v-3.5L12 17.3z"/>',
  goblet: '<path d="M6 2h12v6a6 6 0 0 1-5 5.9V19h4v3H7v-3h4v-5.1A6 6 0 0 1 6 8z"/>',
  brick: '<path d="M2 5h20v4H2z M2 10h9v4H2z M12 10h10v4H12z M2 15h20v4H2z"/>',
  rock: '<path d="M2 19l5-10 4-3 5 1 6 12z"/>',
  paw: '<path d="M12 12c-3 0-6 3-6 6 0 2 2 3 6 3s6-1 6-3c0-3-3-6-6-6z M5 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M9 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M15 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M19 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>',
  bell: '<path d="M12 2a1.5 1.5 0 0 1 1.5 1.5v.7C16.4 4.9 18 7.2 18 10v5l2 3H4l2-3v-5c0-2.8 1.6-5.1 4.5-5.8v-.7A1.5 1.5 0 0 1 12 2z M10 19.5h4a2 2 0 0 1-4 0z"/>',
  sparkle: '<path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/>',
  snow: '<path d="M11 2h2v20h-2z M2 11h20v2H2z M4.9 6.3l1.4-1.4 12.8 12.8-1.4 1.4z M17.7 4.9l1.4 1.4L6.3 19.1l-1.4-1.4z"/>',
  plus: '<path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z"/>',
  trident: '<path d="M11 8h2v14h-2z M4 3h2v5a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V3h2v5a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z M11 1h2v8h-2z"/>',
  filter: '<path d="M3 4h18l-7 8.5V20l-4-2v-5.500z"/>',
  eye: '<path fill-rule="evenodd" d="M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7z M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z"/>',
  gem: '<path d="M6 3h12l4 6-10 13L2 9z"/>',
  hourglass: '<path d="M6 2h12v2l-5 7 5 7v4H6v-4l5-7-5-7z"/>',
  drop: '<path d="M12 2s7 7.5 7 13a7 7 0 0 1-14 0c0-5.5 7-13 7-13z"/>',
  grid: '<path d="M3 3h8v8H3z M13 3h8v8h-8z M3 13h8v8H3z M13 13h8v8h-8z"/>',
};

// Emoji used in the UI/data tables -> icon name. Unmapped emoji are left untouched.
export const EMOJI = {
  '⚔': 'swords', '🗡': 'sword', '🚫': 'ban', '📜': 'scroll', '🏰': 'castle', '👑': 'crown', '🛡': 'shield', '🔥': 'flame',
  '🌾': 'wheat', '🐎': 'horse', '🏇': 'horse', '🐴': 'horse', '🕊': 'dove', '★': 'star', '⭐': 'star', '🌟': 'star', '🤝': 'handshake',
  '⚓': 'anchor', '✠': 'cross', '✝': 'cross', '☦': 'orthodox', '🪙': 'coin', '🏛': 'pillars', '⚖': 'scales', '💰': 'bag',
  '🦅': 'eagle', '🎯': 'target', '🏘': 'houses', '🏠': 'house', '⚒': 'hammer', '🔨': 'hammer', '⛏': 'pick', '🪓': 'axe', '🪵': 'log',
  '🌲': 'tree', '🌳': 'tree', '⛪': 'church', '🕌': 'mosque', '🌙': 'crescent', '☪': 'crescent', '⚑': 'flag', '🚩': 'flag', '🏴': 'flag',
  '💍': 'ring', '🏹': 'bow', '👥': 'people', '💀': 'skull', '☠': 'skull', '➜': 'arrow', '🗝': 'key', '⚜': 'fleur', '🦁': 'lion',
  '📚': 'book', '📖': 'book', '📕': 'book', '⚙': 'gear', '🗺': 'map', '⛰': 'mountain', '🏔': 'mountain', '⛵': 'ship', '🚢': 'ship',
  '⚠': 'warn', '✔': 'check', '✕': 'x', '✖': 'x', '✘': 'x', '⛺': 'tent', '🏕': 'tent', '♟': 'pawn', '♞': 'pawn', '⚡': 'bolt',
  '☀': 'sun', '🔒': 'lock', '🏙': 'city', '🏯': 'castle', '☰': 'menu',
  '💪': 'bolt', '🥾': 'arrow', '📦': 'brick', '✂': 'axe', '➕': 'plus', '👁': 'eye', '🌧': 'drop', '🌫': 'snow', '💾': 'scroll', '📂': 'book', '⬇': 'chevd', '⬆': 'chevu',
  '⏳': 'hourglass', '🎁': 'gem', '💔': 'skull', '🔓': 'lock', '😤': 'flame', '🦺': 'shield', '📋': 'scroll', '🧭': 'compass', '🌿': 'tree', '🪷': 'sparkle', '🏜': 'sun', '🗣': 'people',
  '💡': 'sparkle', '🌉': 'city', '☄': 'flame', '🌊': 'ship', '🎶': 'bell', '🎪': 'tent', '📯': 'bell', '🕸': 'key', '📿': 'ring', '🖼': 'scroll', '🌀': 'sparkle', '☘': 'tree', '🍊': 'wheat',
  '➶': 'arrow', '🪺': 'houses', '🏺': 'goblet', '🐟': 'anchor', '🖋': 'quill', '👪': 'people', '🧮': 'chart', '🎨': 'sparkle', '💧': 'drop', '🌱': 'tree', '🌬': 'snow', '🥕': 'wheat',
  '🍇': 'wheat', '🏚': 'house', '🛳': 'ship', '📑': 'scroll', '🏭': 'hammer', '🌍': 'map', '☺': 'people', '⧉': 'grid', '↩': 'arrow', '↔': 'arrow', '⟷': 'arrow', '→': 'arrow',
  '🎓': 'cap', '🍷': 'goblet', '🧱': 'brick', '🪨': 'rock', '🏦': 'bank', '📊': 'chart', '🏆': 'trophy', '🗼': 'castle', '🔔': 'bell', '🕯': 'flame',
  '✨': 'sparkle', '💥': 'bolt', '❄': 'snow', '🛶': 'ship', '🚣': 'ship', '🛤': 'arrow', '🛒': 'bag', '🪚': 'axe', '🪓': 'axe', '🩹': 'plus', '⚕': 'plus', '🧵': 'scroll',
  '🗿': 'pillars', '🕶': 'key', '🔱': 'trident', '🙏': 'dove', '😠': 'flame', '👦': 'people', '🏃': 'arrow', '🏗': 'hammer', '🐑': 'paw', '🐏': 'paw', '🐄': 'paw', '🐇': 'paw',
  '🦌': 'paw', '🦊': 'paw', '🐫': 'paw', '🐚': 'gem', '🎖': 'star', '💤': 'hourglass', '⏸': 'pause', '▶': 'play', '🔊': 'volume', '🔇': 'mute', '💎': 'gem',
};

const BARE = (e) => e.replace(/️/g, '');
const EMOJI_RE = new RegExp(`(${Object.keys(EMOJI).sort((a, b) => b.length - a.length).join('|')})\\uFE0F?`, 'g');
const TAG_RE = /<\/?[a-zA-Z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/g;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Inline <svg> for a named icon ('' if unknown). opts: { size (px), title, gilt, cls } */
export function icon(name, opts = {}) {
  const body = ICONS[name];
  if (!body) return '';
  const size = opts.size ? ` style="width:${opts.size}px;height:${opts.size}px"` : '';
  const cls = 'ic' + (opts.gilt ? ' gilt' : '') + (opts.cls ? ' ' + opts.cls : '');
  const title = opts.title ? `<title>${esc(opts.title)}</title>` : '';
  const aria = opts.title ? '' : ' aria-hidden="true"';
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor"${size}${aria}>${title}${body}</svg>`;
}

/** Icon replacing an emoji, or the emoji itself if unmapped. */
export function iconFor(emoji, opts) {
  const n = EMOJI[BARE(emoji)];
  return n ? icon(n, opts) : emoji;
}

/** True if the string contains an emoji we can swap for an icon. */
export function hasEmoji(str) { EMOJI_RE.lastIndex = 0; return EMOJI_RE.test(str); }

/** Swap every mapped emoji inside an HTML string for its icon. */
export function iconize(html) {
  // only text between tags is converted; attribute values (data-tip="<b>⚔</b>") are left alone
  const str = String(html);
  let out = '', last = 0, m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(str))) {
    out += str.slice(last, m.index).replace(EMOJI_RE, (x, e) => icon(EMOJI[e])) + m[0];
    last = m.index + m[0].length;
  }
  return out + str.slice(last).replace(EMOJI_RE, (x, e) => icon(EMOJI[e]));
}
