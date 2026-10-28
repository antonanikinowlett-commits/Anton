// Realm panel: The sovereign, state of the realm, national modifiers and chronicle.
import { el, fmt, signed, dateStr } from '../../util.js';
import { coaSVG } from '../heraldry.js';
import { portraitSVG } from '../portrait.js';
import { GOVS, LAWS } from '../../data/government.js';
import { registerPanel } from './registry.js';
import { H, traitChips, skills, barHTML, estName } from './common.js';
import { RANKS } from '../../sim/progression.js';
import { explainTip } from '../tips.js';

registerPanel({ id: 'realm', icon: '👑', name: 'Realm', key: 'r', order: 10, render(ui, pb) {
  const g = ui.g, n = ui.P, s = g.s;
  const ruler = s.chars[n.ruler], heir = s.chars[n.heir];
  const owned = g.ownedProvinces(n.id);
  const dev = owned.reduce((t, p) => t + s.prov[p].dev, 0);
  const B = g.budget(n.id);
  pb.append(H(`<div class="row" style="gap:14px;margin:6px 0">${coaSVG(n.coa, 70)}<div><div class="pname" style="font-size:22px">${n.name}</div>
    <div class="muted">${GOVS[n.gov].name} · ${n.religion} · ${n.culture}</div><div class="small" style="margin-top:4px;font-style:italic">${GOVS[n.gov].desc}</div></div></div>`));
  pb.append(el('div', { class: 'section' }, 'Sovereign'));
  const rc = el('div', { class: 'card row', style: { alignItems: 'flex-start' } });
  rc.innerHTML = `<span class="portrait">${portraitSVG(ruler, g, 64)}</span><div class="grow"><div><b>${g.rulerTitle(n)} ${g.charName(ruler)}</b> <span class="muted small">age ${ruler ? g.age(ruler) : '?'}</span></div>
    <div class="small">${ruler ? skills(ruler) : ''}</div><div class="row wrap" style="margin-top:4px">${ruler ? traitChips(ruler) : ''}</div>
    <div class="small muted" style="margin-top:4px">Succession: ${LAWS.succession.options[n.laws.succession]?.name || '—'}</div></div>`;
  pb.append(rc);
  if (heir) {
    const hc = el('div', { class: 'card row', style: { marginTop: '5px' } });
    hc.innerHTML = `<span class="portrait">${portraitSVG(heir, g, 40)}</span><div><b>Heir: ${g.charName(heir)}</b> <span class="muted small">age ${g.age(heir)}</span><div class="small">${skills(heir)}</div></div>`;
    pb.append(hc);
  } else if (!['merchant_republic', 'theocracy', 'elective_monarchy'].includes(n.gov)) pb.append(el('div', { class: 'small neg', style: { marginTop: '4px' } }, 'No heir! A succession crisis threatens if the ruler dies.'));
  // government, rank, laws and estates at a glance
  const ri = g.rankInfo(n.id), gl = el('div', { class: 'card', style: { marginTop: '6px' } });
  gl.innerHTML = `<div class="row between"><b>Rank: ${RANKS[ri.rank]}</b><span class="muted small">${GOVS[n.gov].name}</span></div>
    ${ri.maxed ? '<div class="small muted">Highest rank.</div>' : `<div class="small muted">Next: ${ri.next} — ${ri.checks.map(([k, v, need]) => `<span class="${v >= need ? 'pos' : 'neg'}">${k} ${v}/${need}</span>`).join(', ')}</div>`}
    <div class="small" style="margin-top:4px">${Object.entries(n.laws).map(([cat, opt]) => `<span class="chip" data-tip="${LAWS[cat]?.name}: ${LAWS[cat]?.options[opt]?.name}">${LAWS[cat]?.options[opt]?.name}</span>`).join(' ')}</div>
    <div style="margin-top:6px">${Object.entries(n.estates).map(([e, v]) => `<div class="small row between"><span>${estName(n, e)}</span><span class="muted">influence ${Math.round(v.influence)}% · loyalty <b class="${v.loyalty < 35 ? 'neg' : v.loyalty > 65 ? 'pos' : ''}">${Math.round(v.loyalty)}</b></span></div>${barHTML(v.loyalty / 100, v.loyalty < 35 ? 'red' : 'green')}`).join('')}</div>
    ${n.religion === 'catholic' && n.tag !== 'PAP' ? `<div class="small" style="margin-top:4px">Papal favour <b>${Math.round(n.papalFavor ?? 50)}</b>${n.excommunicated ? ' — <b class="neg">excommunicated</b>' : ''}</div>` : ''}`;
  pb.append(gl);
  pb.append(el('div', { class: 'section' }, 'State of the Realm'));
  const regs = g.armiesOf(n.id).reduce((t, a) => t + a.regs.length, 0);
  const grid = el('div', { class: 'stat-grid' });
  const stat = (k, v, tip) => { const d = H(`<div class="stat"><b>${v}</b>${k}</div>`).firstChild; if (tip) d._tip = () => tip; return d; };
  grid.append(stat('Provinces', owned.length), stat('Development', dev), stat('Regiments', regs), stat('Monthly income', signed(B.net, 1), 'See the Economy tab for details'),
    stat('Manpower', fmt(n.manpower)), stat('Battles won/lost', `${n.stats.won}/${n.stats.lost}`), stat('Claims held', s.prov.filter((p) => p.claims.includes(n.id) && p.owner !== n.id).length, 'Provinces we have a claim on'),
    stat('Administration', `${owned.length}/${g.overextension(n.id).cap}`, explainTip(g.explain(n.id, 'admin'))), stat('Allies', n.allies.length), stat('Vassals', s.nations.filter((x) => x.alive && x.overlord === n.id).length));
  pb.append(grid);
  // national modifiers
  pb.append(el('div', { class: 'section' }, 'National Modifiers'));
  const mods = Object.entries(g.recalcMods(n.id)).filter(([, v]) => Math.abs(v) > 0.0001).sort();
  pb.append(H(`<div class="small" style="columns:2;column-gap:14px">${mods.map(([k, v]) => `<div class="tt-line"><span class="muted">${k}</span><span class="${v > 0 === !['unrest', 'upkeepMult', 'buildCost', 'recruitCost', 'cavCost'].includes(k) ? 'pos' : 'neg'}">${Math.abs(v) < 1 && !['diplo', 'unrest', 'nobleLoyalty', 'clergyLoyalty', 'burgherLoyalty', 'peasantLoyalty', 'generalTactics', 'decree'].includes(k) ? signed(v * 100, 0) + '%' : signed(v, 1)}</span></div>`).join('')}</div>`));
  if (n.focus.cur) {
    const f = g.focusTree(n.id).find((x) => x.id === n.focus.cur);
    pb.append(el('div', { class: 'section' }, 'Current Focus'));
    pb.append(H(`<div class="card" style="cursor:pointer">${f.icon} <b>${f.name}</b> ${barHTML(n.focus.prog / f.days)}</div>`));
    pb.lastChild.onclick = () => ui.openTab('focus');
  }
  pb.append(el('div', { class: 'section' }, 'Chronicle'));
  const log = el('div', { class: 'small' });
  for (const l of s.log.filter((l) => l.nation === n.id || l.important).slice(0, 18)) log.append(H(`<div style="margin-bottom:3px"><span class="muted">${dateStr(l.day)}</span> — ${l.text}</div>`));
  pb.append(log);
} });
