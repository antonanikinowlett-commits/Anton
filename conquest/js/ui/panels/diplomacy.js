// Diplomacy panel: Realm list, relations, diplomatic actions and war declaration.
import { el, fmt, signed, dateStr } from '../../util.js';
import { coaSVG } from '../heraldry.js';
import { portraitSVG } from '../portrait.js';
import { GOVS } from '../../data/government.js';
import { CB_TYPES } from '../../sim/diplomacy.js';
import { registerPanel } from './registry.js';
import { H, subtabs } from './common.js';

registerPanel({ id: 'diplomacy', icon: '🤝', name: 'Diplomacy', key: 'g', order: 50, render(ui, pb) {
  const g = ui.g, n = ui.P, s = g.s;
  const [tabs, cur] = subtabs(ui, 'dip', [['nb', 'Neighbours'], ['allies', 'Allies & Vassals'], ['enemies', 'Enemies'], ['all', 'All realms']]);
  pb.append(tabs);
  let list = s.nations.filter((x) => x.alive && x.id !== n.id);
  const nbs = new Set(g.neighbours(n.id));
  if (cur === 'nb') list = list.filter((x) => nbs.has(x.id));
  if (cur === 'allies') list = list.filter((x) => n.allies.includes(x.id) || x.overlord === n.id || n.overlord === x.id);
  if (cur === 'enemies') list = list.filter((x) => g.atWar(n.id, x.id));
  list.sort((a, b) => g.power(b.id) - g.power(a.id));
  const box = el('div', { class: 'scroll', style: { maxHeight: '230px', border: '1px solid var(--line)', borderRadius: '4px' } });
  let target = ui.state.dipTarget;
  if (target === undefined || !s.nations[target]?.alive || target === n.id) target = list[0]?.id;
  for (const x of list) {
    const op = g.opinion(x.id, n.id);
    const it = el('div', { class: 'nitem' + (x.id === target ? ' on' : ''), onclick: () => { ui.state.dipTarget = x.id; ui.renderPanel(true); } });
    it.innerHTML = `${coaSVG(x.coa, 20)}<span class="grow nn" style="font-size:13px">${x.name}</span>${g.atWar(n.id, x.id) ? '⚔' : ''}${n.allies.includes(x.id) ? '🤝' : ''}${n.marriages.includes(x.id) ? '💍' : ''}${x.overlord === n.id ? '🛡' : ''}<span class="${op >= 0 ? 'pos' : 'neg'} small" style="width:36px;text-align:right">${signed(op)}</span>`;
    box.append(it);
  }
  if (!list.length) box.append(el('div', { class: 'muted small', style: { padding: '8px' } }, 'None.'));
  pb.append(box);
  if (target === undefined) return;
  const t = s.nations[target];
  const tr = s.chars[t.ruler];
  pb.append(el('div', { class: 'section' }, t.name));
  pb.append(H(`<div class="row" style="align-items:flex-start">${coaSVG(t.coa, 50)}<span class="portrait">${portraitSVG(tr, g, 44)}</span><div class="grow small">
    <div><b>${g.rulerTitle(t)} ${g.charName(tr)}</b></div><div>${GOVS[t.gov].name} · ${t.religion} · ${t.culture}</div>
    <div class="muted">${g.ownedProvinces(t.id).length} provinces${t.overlord >= 0 ? ' · vassal of ' + s.nations[t.overlord].name : ''}</div></div></div>`));
  // power comparison
  const cmp = (label, a, b) => `<div class="small row"><span style="width:90px">${label}</span><div class="grow bar blue" style="height:9px"><i style="width:${a / Math.max(1, a + b) * 100}%"></i></div><span style="width:120px;text-align:right" class="muted">${fmt(a)} vs ${fmt(b)}</span></div>`;
  const devOf = (id) => g.ownedProvinces(id).reduce((t2, p) => t2 + s.prov[p].dev, 0);
  pb.append(H(`<div style="margin:6px 0">${cmp('Armies', g.armyStrength(n.id) * 100, g.armyStrength(t.id) * 100)}${cmp('Development', devOf(n.id), devOf(t.id))}${cmp('Manpower', n.manpower, t.manpower)}</div>`));
  const op = g.opinion(t.id, n.id);
  const opEl = H(`<div class="row"><span>Their opinion of us:</span><b class="${op >= 0 ? 'pos' : 'neg'}">${signed(op)}</b><span class="muted small">(hover for details)</span></div>`).firstChild;
  opEl._tip = () => g.opinionBreakdown(t.id, n.id).map(([k, v]) => `<div class="tt-line"><span>${k}</span><span class="${v >= 0 ? 'pos' : 'neg'}">${signed(v)}</span></div>`).join('');
  pb.append(opEl);
  const rel = [];
  if (n.allies.includes(t.id)) rel.push('🤝 Allied'); if (n.marriages.includes(t.id)) rel.push('💍 Royal marriage'); if (n.naps.includes(t.id)) rel.push('🕊 Non-aggression pact');
  if (g.atWar(n.id, t.id)) rel.push('⚔ At war'); if ((n.truces[t.id] || 0) > s.day) rel.push(`⏳ Truce until ${dateStr(n.truces[t.id])}`);
  if (t.overlord === n.id) rel.push('🛡 Our vassal'); if ((t.ae[n.id] || 0) > 1) rel.push(`😠 Aggressive expansion ${Math.round(t.ae[n.id])}`);
  if (rel.length) pb.append(el('div', { class: 'row wrap', style: { margin: '4px 0' } }, ...rel.map((r) => el('span', { class: 'chip' }, r))));
  // actions
  pb.append(el('div', { class: 'section' }, 'Diplomatic Actions'));
  const acts = el('div', { class: 'row wrap' });
  const act = (label, fn, tip, cls = '') => { const b = el('div', { class: 'btn small ' + cls, onclick: () => { const r = fn(); ui.toast(label, r || 'Done.', r ? '🚫' : '📜'); ui.renderPanel(true); ui.updateTopbar(); } }, label); b._tip = typeof tip === 'function' ? tip : () => tip; acts.append(b); };
  const accTip = (kind) => () => { const [sc, R] = g.acceptance(n.id, t.id, kind); return `<b>Acceptance: <span class="${sc >= 0 ? 'pos' : 'neg'}">${signed(sc)}</span></b><hr>${R.map(([k, v]) => `<div class="tt-line"><span>${k}</span><span class="${v >= 0 ? 'pos' : 'neg'}">${signed(v)}</span></div>`).join('')}`; };
  const war = g.atWar(n.id, t.id);
  if (!war) {
    act('🕊 Improve relations', () => g.improveRelations(n.id, t.id), 'Send envoys: +20 opinion (15 gold, once per 60 days).');
    act('🎁 Gift 50 gold', () => g.sendGift(n.id, t.id, 50), '+25 opinion');
    if (!n.allies.includes(t.id)) act('🤝 Alliance', () => g.proposeAlliance(n.id, t.id), accTip('alliance')); else act('💔 Break alliance', () => { g.breakAlliance(n.id, t.id); return null; }, '−40 opinion, −5 prestige', 'danger');
    if (!n.marriages.includes(t.id)) act('💍 Royal marriage', () => g.proposeMarriage(n.id, t.id), accTip('marriage'));
    if (!n.naps.includes(t.id)) act('📜 Non-aggression pact', () => g.proposeNAP(n.id, t.id), accTip('nap'));
    if (t.overlord !== n.id) act('🛡 Demand vassalage', () => g.demandVassal(n.id, t.id), accTip('vassal'));
    else act('🔓 Release vassal', () => { g.releaseVassal(n.id, t.id); return null; }, 'Set them free');
    act('😤 Insult', () => g.insult(n.id, t.id), 'They will hate us (−50) and gain a casus belli against us. +3 prestige.', 'danger');
  }
  pb.append(acts);
  // war declaration
  if (!war) {
    const cbs = g.cbsAgainst(n.id, t.id);
    pb.append(el('div', { class: 'section' }, 'Declare War'));
    const why = g.canDeclareWar(n.id, t.id);
    if (why) pb.append(el('div', { class: 'small neg' }, why));
    else {
      const sel = el('select', {});
      for (const c of cbs) sel.append(el('option', { value: c }, CB_TYPES[c].name));
      const allies = [...t.allies, ...(t.overlord >= 0 ? [t.overlord] : [])].filter((x) => s.nations[x]?.alive && x !== n.id && !n.allies.includes(x));
      const info = el('div', { class: 'small', style: { margin: '4px 0' } });
      const upd = () => {
        const c = CB_TYPES[sel.value];
        info.innerHTML = `${c.desc}<br>Likely to defend them: ${allies.length ? allies.map((x) => s.nations[x].name).join(', ') : '<span class="pos">no one</span>'}${(n.truces[t.id] || 0) > s.day ? '<br><span class="neg">Breaking a truce: −2 stability, −20 prestige!</span>' : ''}${n.naps.includes(t.id) ? '<br><span class="neg">Breaking a non-aggression pact: −1 stability</span>' : ''}`;
      };
      sel.onchange = upd; upd();
      pb.append(el('div', { class: 'row' }, sel, el('div', { class: 'btn danger', onclick: () => ui.confirm('Declare War', `Declare war on the ${t.name}?`, () => { const r = g.declareWar(n.id, t.id, { kind: sel.value }); if (r) ui.toast('War', r, '🚫'); ui.renderPanel(true); }) }, '⚔ Declare war')), info);
    }
  } else pb.append(el('div', { class: 'btn', onclick: () => ui.openTab('wars') }, '🔥 Go to war overview'));
} });
