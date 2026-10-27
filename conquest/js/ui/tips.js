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
