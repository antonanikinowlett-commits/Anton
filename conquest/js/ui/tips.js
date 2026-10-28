// Tooltip text shared by the province/army panels and the side panels.
import { UNITS } from '../data/units.js';

export function terrainTip(t) {
  return {
    farmland: 'Open fields. Rich supply and harvests. Ideal for cavalry charges.',
    plains: 'Grassland. Good supply. Cavalry +20%. Wide battle frontage.',
    steppe: 'Endless grass. Cavalry +30%, widest frontage, poor supply.',
    forest: 'Cavalry −40%, archers −30%, narrow frontage. Ambushes possible.',
    taiga: 'Northern forest. Very poor supply, brutal winters, cavalry −45%.',
    hills: 'Archers +15%, cavalry −20%, slower movement. Mines possible.',
    mountains: 'Cavalry −55%, very narrow frontage, movement −55%, defender\'s paradise.',
    marsh: 'Everything −15%, cavalry −60%, very slow, frontage cut in half.',
    desert: 'Poor supply; summer heat saps non-native troops. Cavalry +15%.',
  }[t] || '';
}
export function unitTip(type) {
  const u = UNITS[type];
  return `<div class="tt-title">${u.icon} ${u.name}</div><i class="small">${u.desc}</i><hr><div class="small">⚔ Attack ${u.atk} · 🛡 Defence ${u.def} · 🎯 Missile ${u.ranged}<br>🐎 Charge ${u.charge} · 🔱 Anti-cavalry ${u.anti} · 🦺 Armour ${u.armor}<br>🏃 Pursuit ${u.pursuit} · Morale ${u.morale}${u.siege ? ' · 🏰 Siege ' + u.siege : ''} · Speed ${u.speed} km/d<br>${u.men} men · cost ${Object.entries(u.cost).map(([k, v]) => v + ' ' + k).join(', ')} · upkeep ${u.upkeep}/mo · ${u.days} days</div>`;
}

// Tooltip HTML for a game.explain(...) result: each contribution on its own line, then the total.
export function explainTip(e) {
  if (!e) return '';
  const f = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100);
  const sg = (v) => `<span class="${v < 0 ? 'neg' : v > 0 ? 'pos' : ''}">${v > 0 ? '+' : ''}${f(v)}</span>`;
  let h = `<div class="tt-title">${e.title}: ${e.max !== undefined && e.title === 'Manpower' ? `${f(e.value)} / ${f(e.max)}` : f(e.value)}</div>`;
  h += e.parts.map((x) => `<div class="tt-line"><span>${x.label}</span>${sg(x.value)}</div>${x.note ? `<div class="muted small">${x.note}</div>` : ''}`).join('');
  h += `<hr><div class="tt-line"><b>${e.target !== undefined ? 'Target' : 'Change'} (${e.unit})</b>${e.target !== undefined ? `<b>${e.target}</b>` : sg(e.change)}</div>`;
  if (e.effects?.length) h += `<div class="muted small">${e.effects.join(' · ')}</div>`;
  if (e.recent?.length) h += `<hr><div class="muted small">Recent: ${e.recent.map((r) => `${r.d > 0 ? '+' : ''}${r.d} ${r.why}`).join('; ')}</div>`;
  if (e.note) h += `<div class="muted small">${e.note}</div>`;
  return h;
}
