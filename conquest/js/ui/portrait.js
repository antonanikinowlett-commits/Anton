// Procedural character portraits: faces, beards and headgear fitting rank, faith and culture.
import { mulberry32, shade } from '../util.js';
import { groupOf } from '../data/names.js';

const SKIN = { north: ['#f1d2b8', '#e8c3a4', '#f5dcc6'], mid: ['#e6c09c', '#dcb08a', '#eac7a5'], south: ['#c99a6e', '#b98a5e', '#d4a57a'], dark: ['#a8764e', '#9a6a44'] };
const HAIR = ['#2a1d14', '#4a3020', '#6a4a2a', '#8a6a3a', '#b08a50', '#1a1410', '#7a3a1a'];

export function portraitSVG(c, game, w = 64) {
  if (!c) return `<svg width="${w}" height="${Math.round(w * 1.25)}" viewBox="0 0 64 80"><rect width="64" height="80" fill="#2a241c"/><text x="32" y="48" font-size="26" text-anchor="middle" fill="#6a5a40">?</text></svg>`;
  const r = mulberry32(c.seed || 1);
  const n = game.s.nations[c.nation];
  const grp = n ? groupOf(n.culture) : 'german';
  const region = ['norse', 'finnic', 'baltic', 'english', 'gaelic', 'welsh', 'dutch', 'german', 'eslavic', 'wslavic'].includes(grp) ? 'north' : ['arabic', 'berber'].includes(grp) ? (r() < 0.5 ? 'south' : 'dark') : ['turkic', 'persian', 'caucasian', 'greek'].includes(grp) ? 'south' : 'mid';
  const skin = SKIN[region][Math.floor(r() * SKIN[region].length)];
  const age = game.age(c);
  let hair = HAIR[Math.floor(r() * (region === 'north' ? 7 : 3))];
  if (age > 55) hair = '#c8c4bc'; else if (age > 45 && r() < 0.5) hair = '#8a8580';
  const col = n ? n.color : '#555';
  const dark = shade(col, -0.45);
  const muslim = n && n.religion === 'sunni';
  const female = c.female;
  const role = c.role;
  const clergy = c.office === 'chaplain' || (n && n.gov === 'theocracy' && role === 'ruler');
  const beard = !female && age >= 18 && (r() < 0.7 || muslim || ['greek', 'eslavic', 'norse'].includes(grp));
  const fw = 15 + r() * 3, fh = 19 + r() * 3;
  const eyeY = 39 + r() * 1.5;
  let s = `<svg width="${w}" height="${Math.round(w * 1.25)}" viewBox="0 0 64 80">`;
  s += `<defs><radialGradient id="pg${c.id}" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="${shade(col, 0.15)}"/><stop offset="1" stop-color="${shade(col, -0.6)}"/></radialGradient></defs>`;
  s += `<rect width="64" height="80" fill="url(#pg${c.id})"/>`;
  // shoulders & clothing
  const cloth = role === 'general' ? '#7a7a80' : clergy ? (n && n.religion === 'orthodox' ? '#1a1a1a' : '#e8e2d0') : dark;
  s += `<path d="M4,80 C6,64 18,58 32,58 C46,58 58,64 60,80 Z" fill="${cloth}"/>`;
  if (role === 'general') s += `<path d="M10,80 C12,68 22,62 32,62 C42,62 52,68 54,80" fill="none" stroke="#5a5a60" stroke-width="2" stroke-dasharray="2 2"/>`;
  if (role === 'ruler' && !clergy) s += `<path d="M14,80 L22,62 L32,70 L42,62 L50,80 Z" fill="${shade(col, 0.1)}"/><path d="M22,62 L32,70 L42,62" fill="none" stroke="#e2b93b" stroke-width="1.5"/>`;
  // neck & face
  s += `<rect x="27" y="50" width="10" height="10" fill="${shade(skin, -0.12)}"/>`;
  s += `<ellipse cx="32" cy="${40}" rx="${fw / 1.5 + 2}" ry="${fh / 1.5 + 3}" fill="${skin}"/>`;
  // hair
  if (!female) s += `<path d="M${32 - fw / 1.5 - 2},38 C${32 - fw / 1.5 - 2},22 ${32 + fw / 1.5 + 2},22 ${32 + fw / 1.5 + 2},38 C${32 + fw / 1.5},30 ${32 - fw / 1.5},30 ${32 - fw / 1.5 - 2},38 Z" fill="${hair}"/>`;
  else s += `<path d="M18,40 C16,18 48,18 46,40 L48,62 L40,52 L24,52 L16,62 Z" fill="${hair}"/>`;
  // eyes, brows, nose, mouth
  s += `<ellipse cx="27" cy="${eyeY}" rx="2.2" ry="1.4" fill="#fff"/><ellipse cx="37" cy="${eyeY}" rx="2.2" ry="1.4" fill="#fff"/>`;
  const iris = ['#3a5a8a', '#5a4a2a', '#2a2a2a', '#4a6a4a'][Math.floor(r() * 4)];
  s += `<circle cx="27" cy="${eyeY}" r="1.1" fill="${iris}"/><circle cx="37" cy="${eyeY}" r="1.1" fill="${iris}"/>`;
  s += `<path d="M24,${eyeY - 3} L30,${eyeY - 3.5} M34,${eyeY - 3.5} L40,${eyeY - 3}" stroke="${shade(hair, -0.2)}" stroke-width="1.4"/>`;
  s += `<path d="M32,${eyeY + 1} L${30 + r() * 1},${eyeY + 8} L33,${eyeY + 8.5}" fill="none" stroke="${shade(skin, -0.3)}" stroke-width="1"/>`;
  s += `<path d="M28.5,${eyeY + 12} Q32,${eyeY + 13.5} 35.5,${eyeY + 12}" fill="none" stroke="#8a4a3a" stroke-width="1.2"/>`;
  if (age > 50) s += `<path d="M22,${eyeY + 3} q2,2 4,1 M42,${eyeY + 3} q-2,2 -4,1 M25,${eyeY - 6} h14" stroke="${shade(skin, -0.25)}" stroke-width=".6" fill="none"/>`;
  if (beard) {
    const long = muslim || grp === 'greek' || grp === 'eslavic' || r() < 0.3;
    s += `<path d="M${32 - fw / 1.5 - 1},${eyeY + 4} C${32 - fw / 1.5},${eyeY + (long ? 26 : 18)} ${32 + fw / 1.5},${eyeY + (long ? 26 : 18)} ${32 + fw / 1.5 + 1},${eyeY + 4} C${32 + fw / 2},${eyeY + 12} ${32 - fw / 2},${eyeY + 12} ${32 - fw / 1.5 - 1},${eyeY + 4} Z" fill="${hair}"/>`;
    s += `<path d="M28,${eyeY + 10} Q32,${eyeY + 8} 36,${eyeY + 10}" fill="none" stroke="${hair}" stroke-width="2"/>`;
  }
  // headgear
  if (clergy && n && n.religion === 'catholic') s += `<path d="M22,30 L26,8 L32,14 L38,8 L42,30 Z" fill="#f2efe4" stroke="#e2b93b" stroke-width="1.2"/><path d="M32,12 V28 M27,20 H37" stroke="#e2b93b" stroke-width="1.5"/>`;
  else if (clergy && n && (n.religion === 'orthodox' || n.religion === 'armenian')) s += `<path d="M20,32 C20,14 44,14 44,32 Z" fill="#1a1a1a"/><path d="M22,32 L16,56 M42,32 L48,56" stroke="#1a1a1a" stroke-width="4"/>`;
  else if (muslim && role !== 'general') s += `<path d="M17,32 C14,12 50,12 47,32 C42,28 22,28 17,32 Z" fill="${role === 'ruler' ? '#f2efe4' : '#d8c8a0'}"/><path d="M18,27 C28,20 36,22 46,27" stroke="#c8b890" stroke-width="2" fill="none"/>` + (role === 'ruler' ? `<circle cx="32" cy="22" r="3" fill="#2a8a5a" stroke="#e2b93b"/>` : '');
  else if (role === 'ruler') {
    if (female) s += `<path d="M18,40 C18,22 46,22 46,40 L46,56 C40,50 24,50 18,56 Z" fill="#f2efe4" opacity=".9"/>`;
    s += `<path d="M19,${female ? 24 : 27} L19,${female ? 15 : 18} L24,${female ? 20 : 23} L28,${female ? 13 : 16} L32,${female ? 19 : 22} L36,${female ? 13 : 16} L40,${female ? 20 : 23} L45,${female ? 15 : 18} L45,${female ? 24 : 27} Z" fill="#e2b93b" stroke="#8a6d33" stroke-width=".8"/><circle cx="32" cy="${female ? 21 : 24}" r="1.6" fill="#c0282d"/>`;
  } else if (role === 'general') {
    if (muslim) s += `<path d="M18,34 C16,10 48,10 46,34 Z" fill="#8a8a90"/><path d="M32,6 V14" stroke="#8a8a90" stroke-width="2"/><path d="M18,32 C24,30 40,30 46,32" stroke="#d8c8a0" stroke-width="4"/>`;
    else s += `<path d="M18,36 C16,12 48,12 46,36 Z" fill="#8f8f96"/><rect x="30.5" y="30" width="3" height="16" fill="#7a7a80"/><path d="M18,36 H46" stroke="#5a5a60" stroke-width="1.5"/>`;
  } else if (female) s += `<path d="M18,40 C18,20 46,20 46,40 L48,60 C40,52 24,52 16,60 Z" fill="#e8e2d2" opacity=".95"/>`;
  else if (role === 'minister' || role === 'pool' || role === 'heir') {
    if (r() < 0.5 && !clergy) s += `<path d="M18,30 C18,18 46,18 46,30 C40,27 24,27 18,30 Z" fill="${shade(col, -0.2)}"/><path d="M44,24 C52,26 54,36 50,44" stroke="${shade(col, -0.2)}" stroke-width="4" fill="none"/>`;
  }
  s += `<rect x=".5" y=".5" width="63" height="79" fill="none" stroke="#000" stroke-opacity=".5"/></svg>`;
  return s;
}
