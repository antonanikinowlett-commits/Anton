// Small rendering helpers shared by the side panels.
import { el, clamp } from '../../util.js';
import { ESTATE_NAMES, ROLE_TITLES } from '../../data/government.js';
import { TRAITS } from '../../data/traits.js';

export const H = (html) => el('div', { html });
export const traitChips = (c) => c.traits.map((t) => `<span class="chip" data-tip="<b>${TRAITS[t].icon} ${TRAITS[t].name}</b><br>${TRAITS[t].desc}">${TRAITS[t].icon} ${TRAITS[t].name}</span>`).join(' ');
export const skills = (c) => `<span data-tip="Martial">⚔${c.skills.martial}</span> <span data-tip="Diplomacy">📜${c.skills.diplomacy}</span> <span data-tip="Stewardship">💰${c.skills.stewardship}</span> <span data-tip="Intrigue">🗝${c.skills.intrigue}</span> <span data-tip="Learning">📚${c.skills.learning}</span>`;
export const subtabs = (ui, key, tabs) => {
  const cur = ui.subtab[key] || tabs[0][0];
  const row = el('div', { class: 'subtabs' });
  for (const [id, name] of tabs) row.append(el('div', { class: 'subtab' + (id === cur ? ' on' : ''), onclick: () => { ui.subtab[key] = id; ui.renderPanel(true); } }, name));
  return [row, cur];
};
export const barHTML = (v, cls = '', w = '100%') => `<div class="bar ${cls}" style="width:${w}"><i style="width:${clamp(v, 0, 1) * 100}%"></i></div>`;
export const roleTitle = (n, role) => (ROLE_TITLES[n.gov] || ROLE_TITLES.default)[role];
export const estName = (n, e) => (ESTATE_NAMES[n.gov] || ESTATE_NAMES.default)[e];

export function describeDemand(g, d) {
  if (d.type === 'province') return g.provName(d.p);
  if (d.type === 'gold') return `${d.v} gold`;
  if (d.type === 'vassal') return `vassalage of ${g.s.nations[d.target].name}`;
  return 'humiliation';
}
