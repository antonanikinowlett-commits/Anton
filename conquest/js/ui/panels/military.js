// Military panel: Armies, fronts, templates, mustering and the unit codex.
import { el, fmt, pct } from '../../util.js';
import { coaSVG } from '../heraldry.js';
import { MIL_DOCTRINES, pickMilDoctrine } from '../../data/mildoctrines.js';
import { INNOV } from '../../data/innovations.js';
import { UNITS, UNIT_ORDER, unitAvailable, unitReqText, TERRAIN_COMBAT } from '../../data/units.js';
import { DOCTRINES } from '../../data/tactics.js';
import { unitTip } from '../tips.js';
import { registerPanel } from './registry.js';
import { H, subtabs, barHTML } from './common.js';

registerPanel({ id: 'military', icon: '⚔', name: 'Military', key: 'm', order: 60, render(ui, pb) {
  const g = ui.g, n = ui.P, s = g.s;
  const [tabs, cur] = subtabs(ui, 'mil', [['armies', 'Armies'], ['fronts', 'Fronts'], ['templates', 'Army Templates'], ['recruit', 'Mustering'], ['units', 'Unit Codex']]);
  pb.append(tabs);
  if (cur === 'armies') {
    const as = g.armiesOf(n.id);
    const tot = as.reduce((t, a) => t + g.armyMen(a), 0);
    pb.append(H(`<div class="small">${as.length} armies · ${fmt(tot)} men · manpower ${fmt(n.manpower)}/${fmt(n.maxManpower)}</div>`));
    const tb = el('table', { class: 'tbl' });
    tb.innerHTML = '<tr><th>Army</th><th>Men</th><th>Morale</th><th>Location</th><th>General</th></tr>';
    for (const a of as) {
      const tr = el('tr', { class: 'click', onclick: () => ui.selectArmies([a.id], true) });
      const gen = g.generalOf(a);
      tr.innerHTML = `<td>${a.battle ? '⚔ ' : a.path.length ? '➜ ' : ''}${a.name}</td><td>${fmt(g.armyMen(a))}</td><td>${barHTML(g.armyMorale(a), 'green', '50px')}</td><td class="small">${ui.v.map.provinces[a.loc].name}</td><td class="small ${gen ? '' : 'neg'}">${gen ? g.charName(gen) : 'none'}</td>`;
      tb.append(tr);
    }
    pb.append(tb);
    pb.append(el('div', { class: 'tiny muted', style: { marginTop: '6px' } }, 'Click an army to select it, then right-click a province to march. Armies reinforce from manpower when in friendly land.'));
    pb.append(el('div', { class: 'section' }, 'Military Record'));
    pb.append(H(`<div class="small">Battles won ${n.stats.won}, lost ${n.stats.lost} · enemies slain ${fmt(n.stats.killed)} · our dead ${fmt(n.stats.lostMen)}</div>`));
  } else if (cur === 'fronts') frontsPanel(ui, pb);
  else if (cur === 'templates') templateEditor(ui, pb);
  else if (cur === 'recruit') {
    const q = s.recruit.filter((r) => r.nation === n.id);
    if (!q.length) pb.append(el('div', { class: 'muted small' }, 'No regiments are being mustered. Recruit from a province panel or the template designer.'));
    for (const r of q) {
      const d = el('div', { class: 'card', style: { marginTop: '5px' } });
      d.innerHTML = `<div class="row between"><b>${r.template.name}</b><span class="small">${ui.v.map.provinces[r.prov].name} · ${r.days} days</span></div>${barHTML(1 - r.days / r.total)}`;
      d.append(el('div', { class: 'btn small danger', style: { marginTop: '4px' }, onclick: () => { g.cancelRecruit(r.id); ui.renderPanel(true); }, 'data-tip': 'Refunds manpower and half the materials' }, 'Cancel'));
      pb.append(d);
    }
  } else {
    pb.append(el('div', { class: 'small muted' }, 'Every unit type, its strengths, and how terrain and tactics affect it.'));
    for (const k of UNIT_ORDER) {
      const ok = unitAvailable(k, n, g);
      const d = el('div', { class: 'card', style: { marginTop: '4px', opacity: ok ? 1 : 0.55 } });
      d.innerHTML = unitTip(k) + (ok ? '' : `<div class="small neg">${unitReqText(k)}</div>`);
      pb.append(d);
    }
  }
} });

function templateEditor(ui, pb) {
  const g = ui.g, n = ui.P;
  const st = ui.state;
  if (!st.tmpl || !n.templates.find((t) => t.id === st.tmpl.id) && st.tmpl.id !== 'new') {
    const t0 = n.templates[0];
    st.tmpl = t0 ? { id: t0.id, name: t0.name, regs: { ...t0.regs }, doctrine: t0.doctrine } : { id: 'new', name: 'New Host', regs: {}, doctrine: 'balanced' };
  }
  const T = st.tmpl;
  {
    const md = MIL_DOCTRINES[n.milDoc || pickMilDoctrine(n)], active = md.perk && n.prog && n.prog.known.includes(md.perk.innov);
    pb.append(H(`<div class="card" style="margin-bottom:6px"><b>${md.icon} ${md.name}</b> <span class="muted small">national doctrine</span><div class="small">${md.desc}</div>
      <div class="small ${active ? 'pos' : 'muted'}">${active ? '✔' : '🔒'} ${md.perk.name}: ${md.perk.desc}${active ? '' : ` Unlocked by the ${INNOV[md.perk.innov] ? INNOV[md.perk.innov].name : md.perk.innov} innovation.`}</div></div>`));
  }
  const list = el('div', { class: 'row wrap' });
  for (const t of n.templates) list.append(el('div', { class: 'subtab' + (t.id === T.id ? ' on' : ''), onclick: () => { st.tmpl = { id: t.id, name: t.name, regs: { ...t.regs }, doctrine: t.doctrine }; ui.renderPanel(true); } }, t.name));
  list.append(el('div', { class: 'subtab' + (T.id === 'new' ? ' on' : ''), onclick: () => { st.tmpl = { id: 'new', name: 'New Host', regs: { levy_spear: 4 }, doctrine: 'balanced' }; ui.renderPanel(true); } }, '+ New'));
  pb.append(list);
  const nameIn = el('input', { type: 'text', value: T.name, style: { width: '200px' }, oninput: (e) => { T.name = e.target.value; } });
  const docSel = el('select', { onchange: (e) => { T.doctrine = e.target.value; } });
  for (const [k, d] of Object.entries(DOCTRINES)) docSel.append(el('option', { value: k, selected: k === T.doctrine ? 'selected' : null }, d.name));
  pb.append(el('div', { class: 'row', style: { margin: '6px 0' } }, nameIn, docSel));
  const units = el('div', { class: 'tmpl-units' });
  for (const k of UNIT_ORDER) {
    const u = UNITS[k], ok = unitAvailable(k, n, g);
    const c = T.regs[k] || 0;
    if (!ok && !c) {
      const row = el('div', { class: 'tunit na' }, el('span', { class: 'ui' }, u.icon), el('span', { class: 'grow small' }, u.name), el('span', { class: 'tiny muted' }, '🔒'));
      row._tip = () => unitTip(k) + `<div class="neg small">${unitReqText(k)}</div>`;
      units.append(row);
      continue;
    }
    const row = el('div', { class: 'tunit' },
      el('span', { class: 'ui' }, u.icon), el('span', { class: 'grow small' }, u.name),
      el('div', { class: 'btn icon small', onclick: () => { T.regs[k] = Math.max(0, c - 1); ui.renderPanel(true); } }, '−'),
      el('span', { class: 'cnt' }, c),
      el('div', { class: 'btn icon small', onclick: () => { const tot = Object.values(T.regs).reduce((a, b) => a + b, 0); if (tot < 40) { T.regs[k] = c + 1; ui.renderPanel(true); } } }, '+'));
    row._tip = () => unitTip(k);
    units.append(row);
  }
  pb.append(units);
  const S = g.templateStats(n.id, T), C = g.templateCost(n.id, T);
  pb.append(el('div', { class: 'section' }, 'Battle Profile'));
  pb.append(H(`<div class="stat-grid"><div class="stat"><b>${fmt(S.men)}</b>Men</div><div class="stat"><b>${S.atk.toFixed(1)}</b>⚔ Melee attack</div><div class="stat"><b>${S.def.toFixed(1)}</b>🛡 Defence</div>
    <div class="stat"><b>${S.rng.toFixed(1)}</b>🎯 Missile</div><div class="stat"><b>${S.charge.toFixed(1)}</b>🐎 Charge</div><div class="stat"><b>${S.anti.toFixed(1)}</b>🔱 Anti-cavalry</div>
    <div class="stat"><b>${S.pursuit.toFixed(1)}</b>🏃 Pursuit</div><div class="stat"><b>${pct(S.armor)}</b>🦺 Armour</div><div class="stat"><b>${S.siege.toFixed(1)}</b>🏰 Siege</div>
    <div class="stat"><b>${S.speed}</b>🥾 km/day</div><div class="stat"><b>${S.upkeep.toFixed(1)}</b>🪙 Upkeep/mo</div><div class="stat"><b>${C.days}</b>⏳ Days</div></div>`));
  // formation preview and doctrine analysis
  const fr = el('div', { class: 'formation', style: { marginTop: '6px' } });
  const regsList = Object.entries(T.regs).flatMap(([k, c2]) => Array(c2).fill(k));
  const rows = { rng: [], inf: [], cav: [], siege: [] };
  for (const k of regsList) rows[UNITS[k].cls].push(k);
  const cav = rows.cav;
  const front = el('div', { class: 'fr' }, ...cav.slice(0, Math.ceil(cav.length / 2)).map((k) => el('div', { class: 'fu cav' }, UNITS[k].icon)), ...rows.inf.map((k) => el('div', { class: 'fu inf' }, UNITS[k].icon)), ...cav.slice(Math.ceil(cav.length / 2)).map((k) => el('div', { class: 'fu cav' }, UNITS[k].icon)));
  fr.append(el('div', { class: 'tiny muted' }, '▲ enemy'), front, el('div', { class: 'fr' }, ...rows.rng.map((k) => el('div', { class: 'fu rng' }, UNITS[k].icon))), el('div', { class: 'fr' }, ...rows.siege.map((k) => el('div', { class: 'fu siege' }, UNITS[k].icon))));
  pb.append(fr);
  const tips = [];
  const tot = S.regs || 1;
  if (S.cav / tot > 0.3) tips.push('Strong cavalry: excels on plains and steppe; enables Couched-Lance Charge, Feigned Retreat and Double Envelopment. Weak in forests, marsh and mountains.');
  if (S.rgd / tot > 0.25) tips.push('Many missile troops: Arrow Storm in the skirmish phase; vulnerable to Rapid Advance and Pavise Wall.');
  if ((T.regs.pikemen || 0) / tot >= 0.2) tips.push('Pike blocks form Schiltrons that wreck cavalry charges — but massed archers can shred them (Falkirk).');
  if (S.inf / tot > 0.45) tips.push('Infantry-heavy: can form a Shield Wall; beware the Feigned Retreat.');
  if (!S.cav) tips.push('No cavalry: no pursuit to finish fleeing enemies, and no flank cover.');
  if (S.siege === 0) tips.push('No siege engines: castles will take many months to starve out.');
  if (S.regs > 24) tips.push('Large armies may exceed the supply limit of poor provinces, especially in winter.');
  // combat width: how many of these regiments can fight at once on each kind of ground
  pb.append(H(`<div class="small" style="margin-top:6px">↔ Combat width (fighting at once / total ${S.regs}): ${[['plains', 'Plains'], ['hills', 'Hills'], ['forest', 'Forest'], ['mountains', 'Mountains'], ['marsh', 'Marsh']].map(([k, nm]) => `${nm} ${Math.min(S.regs, Math.max(6, Math.round(TERRAIN_COMBAT[k].width / 2)))}`).join(' · ')}. The rest wait in reserve.</div>`));
  pb.append(H(tips.map((t) => `<div class="small" style="margin-top:3px">• ${t}</div>`).join('')));
  pb.append(H(`<div class="small" style="margin-top:6px">Cost: 🪙 ${C.gold} · ⚒ ${C.iron} · 🪵 ${C.timber} · 🐎 ${C.horses} · 👥 ${fmt(C.manpower)}</div>`));
  const btns = el('div', { class: 'row wrap', style: { marginTop: '6px' } });
  btns.append(el('div', { class: 'btn primary small', onclick: () => {
    const clean = Object.fromEntries(Object.entries(T.regs).filter(([, v]) => v > 0));
    if (T.id === 'new') { const t = { id: g.newId(), name: T.name || 'Host', regs: clean, doctrine: T.doctrine }; n.templates.push(t); st.tmpl = { ...t, regs: { ...clean } }; }
    else { const t = n.templates.find((x) => x.id === T.id); Object.assign(t, { name: T.name, regs: clean, doctrine: T.doctrine }); }
    ui.toast('Template saved', T.name, '📋'); ui.renderPanel(true); ui.emit('templateSaved');
  } }, '💾 Save template'));
  if (T.id !== 'new') btns.append(el('div', { class: 'btn danger small', onclick: () => { n.templates = n.templates.filter((x) => x.id !== T.id); st.tmpl = null; ui.renderPanel(true); } }, 'Delete'));
  pb.append(btns);
  // recruit
  pb.append(el('div', { class: 'section' }, 'Muster this army'));
  const loc = el('select', {});
  const owned = g.ownedProvinces(n.id).filter((p) => g.s.prov[p].controller === n.id);
  owned.sort((a, b) => (b === n.capital) - (a === n.capital) || (g.s.prov[b].buildings.barracks || 0) - (g.s.prov[a].buildings.barracks || 0) || g.s.prov[b].dev - g.s.prov[a].dev);
  const preferred = ui.selProv >= 0 && owned.includes(ui.selProv) ? ui.selProv : owned[0];
  for (const p of owned.slice(0, 60)) loc.append(el('option', { value: p, selected: p === preferred ? 'selected' : null }, `${ui.v.map.provinces[p].name}${p === n.capital ? ' ★' : ''}${g.s.prov[p].buildings.barracks ? ' (barracks)' : ''}`));
  pb.append(el('div', { class: 'row' }, loc, el('div', { class: 'btn green', onclick: () => {
    const t = { name: T.name, regs: Object.fromEntries(Object.entries(T.regs).filter(([, v]) => v > 0)), doctrine: T.doctrine, id: T.id };
    const r = g.recruit(n.id, +loc.value, t);
    if (r) ui.toast('Cannot recruit', r, '🚫'); else { ui.toast('Mustering', `${t.name} assembling at ${ui.v.map.provinces[+loc.value].name}`, '⚔'); ui.emit('recruited'); }
    ui.updateTopbar();
  } }, '⚔ Recruit')));
}

function frontsPanel(ui, pb) {
  const g = ui.g, n = ui.P, s = g.s;
  pb.append(el('div', { class: 'small muted' }, 'A front spreads its divisions evenly along the border with an enemy. Holding keeps them on the line; advancing sends every division across the border at once, province by province, so the line moves forward together. Divide armies first (✂ ÷2, ÷3, Split & cover front) to cover a long border.'));
  const fronts = g.frontsOf(n.id);
  if (!fronts.length) pb.append(el('div', { class: 'card', style: { marginTop: '8px' } }, 'No fronts yet. Select an army, choose a realm under "Front line" in the army panel, then Assign to front or Split & cover front.'));
  for (const f of fronts) {
    const e = s.nations[f.enemy];
    const line = f.line || g.frontProvinces(f);
    const armies = f.armies.map((id) => s.armies[id]).filter(Boolean);
    const men = armies.reduce((t, a) => t + g.armyMen(a), 0);
    const war = g.atWar(n.id, f.enemy);
    const d = el('div', { class: 'card' + (f.mode === 'advance' ? ' hl' : ''), style: { marginTop: '8px' } });
    d.append(H(`<div class="row">${coaSVG(e.coa, 22)}<b class="grow">Front against the ${e.name}</b><span class="chip ${f.mode === 'advance' ? 'bad' : ''}">${f.mode === 'advance' ? '➜ Advancing' : '🛡 Holding'}</span></div>
      <div class="small muted">${armies.length} divisions · ${fmt(men)} men · ${line.length} border provinces${armies.length < line.length ? ` <span class="neg">(thin: ${line.length - armies.length} provinces uncovered)</span>` : ''}</div>`));
    const row = el('div', { class: 'row wrap', style: { marginTop: '6px' } });
    row.append(el('div', { class: 'btn small' + (f.mode === 'hold' ? ' primary' : ''), onclick: () => { g.setFrontMode(f.id, 'hold'); ui.renderPanel(true); }, 'data-tip': 'Stand on the border and defend it' }, '🛡 Hold the line'));
    row.append(el('div', { class: 'btn small danger' + (war ? '' : ' disabled'), onclick: () => { const r = g.setFrontMode(f.id, 'advance'); if (r) ui.toast('Front', r, '🚫'); ui.renderPanel(true); }, 'data-tip': war ? 'All divisions cross the border together, besieging and occupying as the line moves forward' : 'Only possible at war' }, '➜ Advance'));
    row.append(el('div', { class: 'btn small', onclick: () => { ui.selectArmies(f.armies); if (armies[0]) ui.v.flyToProvince(armies[0].loc, 300); } }, '👁 Select divisions'));
    row.append(el('div', { class: 'btn small', onclick: () => { g.deleteFront(f.id); ui.renderPanel(true); }, 'data-tip': 'Disband the front. The armies stay where they are.' }, '✖ Disband front'));
    d.append(row);
    pb.append(d);
  }
}
