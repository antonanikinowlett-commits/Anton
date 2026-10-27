// Procedural heraldry: shields drawn from a blazon [field, charge, tincture].
export const TINCT = { or: '#e2b93b', argent: '#f1eee4', gules: '#c0282d', azure: '#2a5aa8', vert: '#2e7a3a', sable: '#1d1d1d', purpure: '#7a3a8a' };
const SHIELD = 'M6,6 H94 V56 C94,90 72,108 50,116 C28,108 6,90 6,56 Z';

const LION = 'M40,94 L44,74 L35,64 L29,50 L33,38 L27,31 L31,22 L42,19 L48,26 L53,21 L57,30 L52,37 L60,43 L69,41 L73,31 L69,22 L78,26 L81,37 L75,49 L65,57 L67,70 L76,78 L71,85 L61,75 L56,83 L61,97 L52,97 L48,83 Z M65,60 C82,62 86,78 76,88 C80,78 76,68 66,66 Z';
const PASSANT = 'M0,6 L6,2 L10,4 L13,0 L16,3 L15,7 L30,8 L36,4 L40,6 L36,9 L37,16 L33,16 L32,12 L18,12 L17,16 L13,16 L13,11 L6,10 Z';
const EAGLE = 'M50,22 L57,29 L55,38 L68,30 L88,26 L81,36 L89,41 L77,46 L83,53 L66,52 L58,60 L62,74 L71,87 L58,82 L54,93 L50,84 L46,93 L42,82 L29,87 L38,74 L42,60 L34,52 L17,53 L23,46 L11,41 L19,36 L12,26 L32,30 L45,38 L43,29 Z';
const DEAGLE = 'M36,18 L42,24 L46,34 L50,30 L54,34 L58,24 L64,18 L66,28 L60,38 L70,31 L88,27 L81,37 L89,42 L77,47 L83,54 L66,53 L58,61 L62,75 L71,88 L58,83 L54,94 L50,85 L46,94 L42,83 L29,88 L38,75 L42,61 L34,53 L17,54 L23,47 L11,42 L19,37 L12,27 L30,31 L40,38 L34,28 Z';
const FLEUR = 'M50,18 C41,30 41,44 50,56 C59,44 59,30 50,18 Z M50,57 C40,46 27,44 25,55 C25,63 34,65 40,61 C36,67 41,71 46,66 L46,75 L37,77 L37,81 L63,81 L63,77 L54,75 L54,66 C59,71 64,67 60,61 C66,65 75,63 75,55 C73,44 60,46 50,57 Z';
const HORSE = 'M28,90 L32,70 L28,58 L30,44 L42,40 L56,40 L62,30 L58,22 L66,20 L76,30 L80,40 L72,40 L68,46 L72,58 L70,72 L74,90 L68,90 L64,74 L56,64 L46,64 L40,74 L36,90 Z';
const BEAR = 'M26,80 L28,62 L24,52 L32,40 L52,36 L64,30 L72,32 L76,40 L72,46 L74,58 L72,80 L65,80 L64,66 L56,62 L42,62 L38,80 Z';

function charge(c, t, field) {
  const T = TINCT[t] || TINCT.or;
  const stroke = `stroke="${t === 'sable' || field === 'sable' ? '#000' : '#00000066'}" stroke-width="1"`;
  switch (c) {
    case 'lion': case 'griffin': return `<path d="${LION}" fill="${T}" ${stroke}/>`;
    case 'lions3': return [24, 50, 76].map((y) => `<path d="${PASSANT}" transform="translate(${y === 76 ? 33 : 30},${y - 10}) scale(${y === 76 ? 0.95 : 1.05})" fill="${T}" ${stroke}/>`).join('');
    case 'lions4q': return `<rect x="6" y="6" width="44" height="50" fill="${TINCT.gules}"/><rect x="50" y="56" width="44" height="60" fill="${TINCT.gules}"/>` +
      [[10, 20], [56, 76]].map(([x, y]) => `<path d="${PASSANT}" transform="translate(${x},${y}) scale(.9)" fill="${TINCT.or}"/>`).join('') +
      [[56, 20], [10, 76]].map(([x, y]) => `<path d="${PASSANT}" transform="translate(${x},${y}) scale(.9)" fill="${TINCT.gules}"/>`).join('');
    case 'eagle': return `<path d="${EAGLE}" fill="${T}" ${stroke}/>`;
    case 'deagle': return `<path d="${DEAGLE}" fill="${T}" ${stroke}/>`;
    case 'fleur': return [[30, 30], [70, 30], [50, 70]].map(([x, y]) => `<path d="${FLEUR}" transform="translate(${x - 25},${y - 25}) scale(.5)" fill="${T}"/>`).join('');
    case 'lily': case 'lilies': return `<path d="${FLEUR}" transform="translate(5,8) scale(.9)" fill="${T}"/>`;
    case 'cross': return `<rect x="42" y="6" width="16" height="110" fill="${T}"/><rect x="6" y="44" width="88" height="16" fill="${T}"/>`;
    case 'cross_toulouse': case 'cross_pisa': return `<path d="M40,22 H60 V42 H80 V62 H60 V92 H40 V62 H20 V42 H40 Z" fill="${T}"/>` + [[50, 18], [84, 52], [50, 96], [16, 52]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${T}"/>`).join('');
    case 'crosses_jer': return `<path d="M42,22 H58 V44 H80 V60 H58 V90 H42 V60 H20 V44 H42 Z" fill="${T}"/>` + [[25, 28], [75, 28], [25, 78], [75, 78]].map(([x, y]) => `<path d="M${x - 2},${y - 8} h4 v6 h6 v4 h-6 v6 h-4 v-6 h-6 v-4 h6 Z" fill="${T}"/>`).join('');
    case 'crescent': return `<path d="M62,30 A26,26 0 1,0 62,86 A20,20 0 1,1 62,30 Z" fill="${T}" transform="translate(-6,0)"/><path d="M70,48 l3,7 7,0 -6,4 3,7 -7,-4 -7,4 3,-7 -6,-4 7,0 Z" fill="${T}"/>`;
    case 'star': return `<path d="M50,24 L57,46 L80,46 L61,60 L68,82 L50,68 L32,82 L39,60 L20,46 L43,46 Z" fill="${T}"/>`;
    case 'castle': case 'tower': case 'cannon': return `<path d="M26,92 V52 H30 V44 H36 V52 H42 V36 H46 V28 H54 V36 H58 V52 H64 V44 H70 V52 H74 V92 Z M45,92 V76 A5,5 0 0,1 55,76 V92 Z" fill="${T}" fill-rule="evenodd" ${stroke}/>`;
    case 'keys': return `<g fill="${T}"><g transform="rotate(35 50 60)"><rect x="47" y="24" width="6" height="64"/><circle cx="50" cy="22" r="9" fill="none" stroke="${T}" stroke-width="5"/><rect x="53" y="76" width="10" height="5"/><rect x="53" y="83" width="8" height="5"/></g><g transform="rotate(-35 50 60)"><rect x="47" y="24" width="6" height="64"/><circle cx="50" cy="22" r="9" fill="none" stroke="${T}" stroke-width="5"/><rect x="37" y="76" width="10" height="5"/><rect x="39" y="83" width="8" height="5"/></g></g>`;
    case 'crowns3': case 'prince': return (c === 'prince' ? [[50, 50]] : [[30, 32], [70, 32], [50, 74]]).map(([x, y]) => `<path d="M${x - 14},${y + 8} L${x - 14},${y - 6} L${x - 8},${y} L${x},${y - 10} L${x + 8},${y} L${x + 14},${y - 6} L${x + 14},${y + 8} Z" fill="${T}" ${stroke}/>`).join('');
    case 'harp': return `<path d="M34,90 L38,30 C50,22 62,26 70,36 C64,46 62,62 66,90 Z M42,84 L44,38 C52,34 58,36 62,40 C58,52 58,66 60,84 Z" fill="${T}" fill-rule="evenodd"/>` + [48, 53, 58].map((x) => `<line x1="${x}" y1="${36 + (x - 44)}" x2="${x}" y2="84" stroke="${T}" stroke-width="1.5"/>`).join('');
    case 'horse': return `<path d="${HORSE}" fill="${T}" ${stroke}/>`;
    case 'bear': case 'bears2': return `<path d="${BEAR}" fill="${T}" ${stroke}/>`;
    case 'tree': return `<rect x="46" y="58" width="8" height="34" fill="${T}"/><circle cx="50" cy="44" r="24" fill="${T}"/>`;
    case 'sun': return `<circle cx="50" cy="56" r="16" fill="${T}"/>` + Array.from({ length: 12 }, (_, i) => `<rect x="48" y="24" width="4" height="12" fill="${T}" transform="rotate(${i * 30} 50 56)"/>`).join('');
    case 'trident': return `<path d="M47,30 H53 V80 H47 Z M30,30 H36 V58 C36,66 44,66 47,66 V72 C38,72 30,68 30,58 Z M64,30 H70 V58 C70,68 62,72 53,72 V66 C56,66 64,66 64,58 Z M44,82 H56 L50,96 Z" fill="${T}"/>`;
    case 'chains': return `<g stroke="${T}" stroke-width="4" fill="none"><path d="M6,8 L94,110 M94,8 L6,110 M50,6 V116 M6,58 H94"/><rect x="20" y="20" width="60" height="76"/></g><circle cx="50" cy="58" r="7" fill="${TINCT.vert}"/>`;
    case 'quinas': return [[50, 30], [30, 54], [50, 54], [70, 54], [50, 78]].map(([x, y]) => `<path d="M${x - 8},${y - 9} h16 v10 c0,6 -4,9 -8,10 c-4,-1 -8,-4 -8,-10 Z" fill="${T}"/>` + `<circle cx="${x}" cy="${y - 2}" r="1.6" fill="#fff"/>`).join('');
    case 'bars': return Array.from({ length: 4 }, (_, i) => `<rect x="6" y="${14 + i * 26}" width="88" height="13" fill="${T}"/>`).join('');
    case 'pales': return Array.from({ length: 4 }, (_, i) => `<rect x="${14 + i * 21}" y="6" width="10" height="112" fill="${T}"/>`).join('');
    case 'fess': return `<rect x="6" y="44" width="88" height="24" fill="${T}"/>`;
    case 'lozengy': { let s = ''; for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) if ((x + y) % 2 === 0) s += `<path d="M${6 + x * 16 + 8},${6 + y * 15} l8,7.5 -8,7.5 -8,-7.5 Z" fill="${T}"/>`; return s; }
    case 'chevron': return `<path d="M6,84 L50,40 L94,84 L94,100 L50,58 L6,100 Z" fill="${T}"/>`;
    case 'ermine': { let s = ''; for (let y = 0; y < 5; y++) for (let x = 0; x < 4; x++) s += `<path d="M${18 + x * 22 + (y % 2) * 11},${18 + y * 20} l-3,8 3,-3 3,3 Z M${18 + x * 22 + (y % 2) * 11},${14 + y * 20} m-1.5,0 a1.5,1.5 0 1,0 3,0 a1.5,1.5 0 1,0 -3,0" fill="${T}"/>`; return s; }
    default: return `<circle cx="50" cy="56" r="18" fill="${T}"/>`;
  }
}

let uid = 0;
export function coaSVG(coa, size = 32) {
  const [field, ch, t] = coa || ['sable', 'star', 'argent'];
  const id = 'sh' + (uid++);
  const h = Math.round(size * 1.2);
  return `<svg class="coa" width="${size}" height="${h}" viewBox="0 0 100 120"><defs><clipPath id="${id}"><path d="${SHIELD}"/></clipPath>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient></defs>
    <g clip-path="url(#${id})"><rect width="100" height="120" fill="${TINCT[field] || '#888'}"/>${charge(ch, t, field)}<rect width="100" height="120" fill="url(#${id}g)"/></g>
    <path d="${SHIELD}" fill="none" stroke="#2a2014" stroke-width="5"/><path d="${SHIELD}" fill="none" stroke="#d4af5f" stroke-width="2"/></svg>`;
}
export function rebelCoa(size) { return coaSVG(['sable', 'star', 'gules'], size); }
