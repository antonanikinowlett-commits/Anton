// Side-panel contents for every tab.
import { el, fmt, signed, pct, dateStr, clamp } from '../util.js';
import { coaSVG, rebelCoa } from './heraldry.js';
import { portraitSVG } from './portrait.js';
import { GOVS, LAWS, LAW_ORDER, ESTATE_NAMES, ESTATE_ICONS, COUNCIL_ROLES, ROLE_INFO, ROLE_TITLES } from '../data/government.js';
import { TRAITS } from '../data/traits.js';
import { UNITS, UNIT_ORDER, unitAvailable, unitReqText } from '../data/units.js';
import { BUILDINGS, BUILDING_ORDER } from '../data/buildings.js';
import { DOCTRINES } from '../data/tactics.js';
import { CB_TYPES } from '../sim/diplomacy.js';
import { unitTip } from './ui.js';

const H = (html) => el('div', { html });
const traitChips = (c) => c.traits.map((t) => `<span class="chip" data-tip="<b>${TRAITS[t].icon} ${TRAITS[t].name}</b><br>${TRAITS[t].desc}">${TRAITS[t].icon} ${TRAITS[t].name}</span>`).join(' ');
const skills = (c) => `<span data-tip="Martial">⚔${c.skills.martial}</span> <span data-tip="Diplomacy">📜${c.skills.diplomacy}</span> <span data-tip="Stewardship">💰${c.skills.stewardship}</span> <span data-tip="Intrigue">🗝${c.skills.intrigue}</span> <span data-tip="Learning">📚${c.skills.learning}</span>`;
const subtabs = (ui, key, tabs) => {
  const cur = ui.subtab[key] || tabs[0][0];
  const row = el('div', { class: 'subtabs' });
  for (const [id, name] of tabs) row.append(el('div', { class: 'subtab' + (id === cur ? ' on' : ''), onclick: () => { ui.subtab[key] = id; ui.renderPanel(true); } }, name));
  return [row, cur];
};
const barHTML = (v, cls = '', w = '100%') => `<div class="bar ${cls}" style="width:${w}"><i style="width:${clamp(v, 0, 1) * 100}%"></i></div>`;
const roleTitle = (n, role) => (ROLE_TITLES[n.gov] || ROLE_TITLES.default)[role];
const estName = (n, e) => (ESTATE_NAMES[n.gov] || ESTATE_NAMES.default)[e];

export const PANELS = {
  // ─────────────────────────────── REALM
  realm: { render(ui, pb) {
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
    pb.append(el('div', { class: 'section' }, 'State of the Realm'));
    const regs = g.armiesOf(n.id).reduce((t, a) => t + a.regs.length, 0);
    const grid = el('div', { class: 'stat-grid' });
    const stat = (k, v, tip) => { const d = H(`<div class="stat"><b>${v}</b>${k}</div>`).firstChild; if (tip) d._tip = () => tip; return d; };
    grid.append(stat('Provinces', owned.length), stat('Development', dev), stat('Regiments', regs), stat('Monthly income', signed(B.net, 1), 'See the Economy tab for details'),
      stat('Manpower', fmt(n.manpower)), stat('Battles won/lost', `${n.stats.won}/${n.stats.lost}`), stat('Claims held', s.prov.filter((p) => p.claims.includes(n.id) && p.owner !== n.id).length, 'Provinces we have a claim on'),
      stat('Allies', n.allies.length), stat('Vassals', s.nations.filter((x) => x.alive && x.overlord === n.id).length));
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
  } },

  // ─────────────────────────────── COURT
  court: { render(ui, pb) {
    const g = ui.g, n = ui.P, s = g.s;
    const [tabs, cur] = subtabs(ui, 'court', [['council', 'Royal Council'], ['estates', 'Estates'], ['generals', 'Generals'], ['pool', 'Courtiers']]);
    pb.append(tabs);
    if (cur === 'council') {
      pb.append(el('div', { class: 'small muted' }, 'Each office applies its holder\'s skill to the realm. Empty seats cost stability every month.'));
      for (const role of COUNCIL_ROLES) {
        const c = s.chars[n.council[role]];
        const info = ROLE_INFO[role];
        const card = el('div', { class: 'card row', style: { marginTop: '6px', alignItems: 'flex-start' } });
        card.innerHTML = `<span class="portrait">${portraitSVG(c, g, 48)}</span><div class="grow"><div class="tag">${info.icon} ${roleTitle(n, role)}</div>
          ${c ? `<div><b>${g.charName(c)}</b> <span class="muted small">age ${g.age(c)}</span></div><div class="small">${info.skill}: <b class="gold">${c.skills[info.skill]}</b> · ${skills(c)}</div><div class="row wrap">${traitChips(c)}</div>` : '<div class="neg">Vacant</div>'}
          <div class="tiny muted">${info.desc}</div></div>`;
        const btns = el('div', { class: 'col' });
        btns.append(el('div', { class: 'btn small', onclick: () => pickCharacter(ui, `Appoint ${roleTitle(n, role)}`, info.skill, (cid) => { const r = g.appoint(n.id, role, cid); if (r) ui.toast('Cannot appoint', r, '🚫'); ui.renderPanel(true); }) }, c ? 'Replace' : 'Appoint'));
        if (c) btns.append(el('div', { class: 'btn small danger', onclick: () => { g.dismiss(n.id, role); ui.renderPanel(true); }, 'data-tip': 'Dismissing a councillor slightly angers the nobility.' }, 'Dismiss'));
        card.append(btns);
        pb.append(card);
      }
    } else if (cur === 'estates') {
      pb.append(el('div', { class: 'small muted' }, 'The estates vote on every law in proportion to their influence. Loyal estates support the crown; disloyal and powerful estates rebel.'));
      const grid = el('div', { class: 'estates', style: { marginTop: '6px' } });
      for (const e of ['nobles', 'clergy', 'burghers', 'peasants']) {
        const st = n.estates[e];
        const card = el('div', { class: 'card' });
        card.innerHTML = `<div class="row between"><b>${ESTATE_ICONS[e]} ${estName(n, e)}</b></div>
          <div class="small">Loyalty ${Math.round(st.loyalty)}</div>${barHTML(st.loyalty / 100, st.loyalty < 30 ? 'red' : st.loyalty > 60 ? 'green' : '')}
          <div class="small" style="margin-top:3px">Influence ${Math.round(st.influence)}%</div>${barHTML(st.influence / 100, 'blue')}
          ${st.loyalty < 25 && st.influence > 35 ? '<div class="small neg">⚠ Dangerous! Revolt possible.</div>' : ''}`;
        const acts = el('div', { class: 'row wrap', style: { marginTop: '5px' } });
        for (const [k, A] of Object.entries(g.ESTATE_ACTIONS)) {
          if (A.only && !A.only.includes(e)) continue;
          const cd = (n.estateCd?.[e + k] || 0) - s.day;
          const b = el('div', { class: 'btn small' + (cd > 0 ? ' disabled' : ''), onclick: () => { const r = g.estateAction(n.id, e, k); if (r) ui.toast(A.name, r, '🚫'); ui.renderPanel(true); ui.updateTopbar(); } }, A.name);
          b._tip = () => `<b>${A.name}</b><br>${A.desc}${cd > 0 ? `<br><span class="neg">Available again in ${cd} days</span>` : ''}`;
          acts.append(b);
        }
        card.append(acts);
        grid.append(card);
      }
      pb.append(grid);
    } else if (cur === 'generals') {
      const gens = g.charsOf(n.id, 'general');
      if (!gens.length) pb.append(el('div', { class: 'muted' }, 'No generals. Hire one from the courtiers.'));
      for (const c of gens) {
        const a = s.armies[c.army];
        const card = el('div', { class: 'card row', style: { marginTop: '5px' } });
        card.innerHTML = `<span class="portrait">${portraitSVG(c, g, 44)}</span><div class="grow"><b>${g.charName(c)}</b> <span class="muted small">age ${g.age(c)}</span>
          <div class="small">⚔ Attack ${c.gen.atk} · 🛡 Defence ${c.gen.def} · ♟ Tactics ${c.gen.tactics} · 🏰 Siege ${c.gen.siege} · 🛒 Logistics ${c.gen.logistics}</div><div class="row wrap">${traitChips(c)}</div>
          <div class="small ${a ? '' : 'muted'}">${a ? 'Commands ' + a.name : 'Unassigned'}</div></div>`;
        const btns = el('div', { class: 'col' });
        if (a) btns.append(el('div', { class: 'btn small', onclick: () => ui.selectArmies([a.id], true) }, 'Show'));
        btns.append(el('div', { class: 'btn small danger', onclick: () => { g.dismissGeneral(c.id); ui.renderPanel(true); } }, 'Dismiss'));
        card.append(btns);
        pb.append(card);
      }
      pb.append(el('div', { class: 'small muted', style: { marginTop: '8px' } }, 'Attack and defence add 5% each per point. Tactics decides who reads the battle better and can counter the enemy\'s tactic. Win battles to gain experience.'));
    } else {
      pb.append(el('div', { class: 'row' }, el('span', { class: 'small muted grow' }, 'Courtiers can be appointed to the council or made generals.'),
        ...['martial', 'diplomacy', 'stewardship'].map((k) => el('div', { class: 'btn small', onclick: () => { const r = g.recruitCandidate(n.id, k); if (r) ui.toast('Court', r, '🚫'); ui.renderPanel(true); }, 'data-tip': `Invite a courtier gifted in ${k} (25 gold)` }, `+ ${k}`))));
      for (const c of g.charsOf(n.id, 'pool')) {
        const card = el('div', { class: 'card row', style: { marginTop: '5px' } });
        card.innerHTML = `<span class="portrait">${portraitSVG(c, g, 40)}</span><div class="grow"><b>${g.charName(c)}</b> <span class="muted small">age ${g.age(c)}</span><div class="small">${skills(c)}</div><div class="row wrap">${traitChips(c)}</div></div>`;
        card.append(el('div', { class: 'btn small', onclick: () => { const r = g.hireGeneral(n.id, c.id); if (r) ui.toast('Generals', r, '🚫'); ui.renderPanel(true); }, 'data-tip': 'Make general (10 prestige)' }, '🎖 General'));
        pb.append(card);
      }
    }
  } },

  // ─────────────────────────────── LAWS
  laws: { render(ui, pb) {
    const g = ui.g, n = ui.P;
    if (n.lawVote) {
      const v = g.lawVote(n.id, n.lawVote.cat, n.lawVote.opt);
      const o = LAWS[n.lawVote.cat].options[n.lawVote.opt];
      pb.append(H(`<div class="card hl"><div class="row between"><b>⚖ Debating: ${o.name}</b><span>${n.lawVote.days} days left</span></div>
        ${barHTML(1 - n.lawVote.days / n.lawVote.total)}<div class="small" style="margin-top:4px">Projected: <b class="${v.yes >= 0.5 ? 'pos' : 'neg'}">${Math.round(v.yes * 100)}% in favour</b> (50% needed)</div></div>`));
    }
    pb.append(el('div', { class: 'small muted', style: { margin: '4px 0' } }, `Proposing a law costs 10 prestige and opens a 45-day debate in which the estates vote by influence.${g.canDecree(n.id) ? ' As an absolute ruler you may also decree laws instantly.' : ''}`));
    const sel = ui.state.lawSel;
    for (const cat of LAW_ORDER) {
      const L = LAWS[cat];
      const card = el('div', { class: 'card lawcat' });
      const curOpt = L.options[n.laws[cat]];
      card.append(H(`<div class="row between"><b>${L.icon} ${L.name}</b><span class="small gold">${curOpt ? curOpt.name : '—'}</span></div><div class="tiny muted">${L.desc}</div>`));
      const opts = el('div', { class: 'lawopts' });
      for (const [k, o] of Object.entries(L.options)) {
        if (!g.lawVisible(n.id, cat, k)) continue;
        const why = g.canProposeLaw(n.id, cat, k);
        const cls = n.laws[cat] === k ? 'cur' : n.lawVote?.opt === k ? 'voting' : why ? 'no' : '';
        const b = el('div', { class: `lawopt ${cls} ${sel && sel.cat === cat && sel.opt === k ? 'sel' : ''}`, onclick: () => { ui.state.lawSel = { cat, opt: k }; ui.renderPanel(true); } }, o.name);
        b._tip = () => `<b>${o.name}</b><br>${o.desc}`;
        opts.append(b);
      }
      card.append(opts);
      if (sel && sel.cat === cat) card.append(lawDetail(ui, cat, sel.opt));
      pb.append(card);
    }
  } },

  // ─────────────────────────────── FOCUS
  focus: { wide: true, render(ui, pb) {
    const g = ui.g, n = ui.P;
    pb.style.display = 'flex'; pb.style.gap = '10px'; pb.style.padding = '8px'; pb.style.overflow = 'hidden';
    const tree = g.focusTree(n.id);
    const wrap = el('div', { class: 'ftree scroll', style: { flex: '1' } });
    const X = (x) => 20 + x * 128, Y = (y) => 40 + y * 116;
    const maxX = Math.max(...tree.map((f) => f.x)), maxY = Math.max(...tree.map((f) => f.y));
    const inner = el('div', { style: { position: 'relative', width: X(maxX) + 140 + 'px', height: Y(maxY) + 110 + 'px' } });
    const svgW = X(maxX) + 140, svgH = Y(maxY) + 110;
    let lines = '';
    const byId = Object.fromEntries(tree.map((f) => [f.id, f]));
    for (const f of tree) {
      for (const grp of f.pre) for (const pid of grp) {
        const p = byId[pid];
        if (!p) continue;
        const done = n.focus.done.includes(pid);
        lines += `<path d="M${X(p.x) + 56},${Y(p.y) + 84} C${X(p.x) + 56},${Y(p.y) + 100} ${X(f.x) + 56},${Y(f.y) - 16} ${X(f.x) + 56},${Y(f.y)}" stroke="${done ? '#8ac060' : '#8a7550'}" stroke-width="2.5" fill="none" ${grp.length > 1 ? 'stroke-dasharray="6 4"' : ''}/>`;
      }
      for (const e of f.excl) {
        const o = byId[e];
        if (o && o.y === f.y && o.x > f.x) lines += `<path d="M${X(f.x) + 114},${Y(f.y) + 42} L${X(o.x) - 2},${Y(o.y) + 42}" stroke="#c84a3a" stroke-width="2" stroke-dasharray="3 3"/><text x="${(X(f.x) + 114 + X(o.x)) / 2}" y="${Y(f.y) + 38}" fill="#e87a6a" font-size="14" text-anchor="middle">⟷</text>`;
      }
    }
    inner.append(H(`<svg class="fsvg" width="${svgW}" height="${svgH}">${lines}</svg>`).firstChild);
    const branches = [[0, 'Economy'], [4, 'Military'], [8, 'Diplomacy'], [12, 'Faith'], [16, 'Government'], [20, 'National']];
    for (const [x, nm] of branches) if (tree.some((f) => f.x >= x && f.x < x + 4)) inner.append(el('div', { class: 'fbranch', style: { left: X(x) + 'px', top: '10px' } }, nm));
    const selId = ui.state.focusSel || n.focus.cur || tree.find((f) => g.focusStatus(n.id, f) === 'available')?.id;
    for (const f of tree) {
      const st = g.focusStatus(n.id, f);
      const node = el('div', { class: `fnode ${st} ${f.id === selId ? 'sel' : ''}`, style: { left: X(f.x) + 'px', top: Y(f.y) + 'px' }, onclick: () => { ui.state.focusSel = f.id; ui.renderPanel(true); },
        ondblclick: () => { const r = g.startFocus(n.id, f.id); if (r) ui.toast('Focus', r, '🚫'); ui.renderPanel(true); } },
        el('div', { class: 'fi' }, f.icon), el('div', { class: 'fn' }, f.name), st === 'active' ? el('div', { class: 'fprog' }, el('i', { style: { width: `${n.focus.prog / f.days * 100}%` } })) : null);
      node._tip = () => `<b>${f.name}</b><br>${g.describeEffects(f.effects).join('<br>')}<br><span class="muted small">${st} · double-click to start</span>`;
      inner.append(node);
    }
    wrap.append(inner);
    // detail sidebar
    const side = el('div', { class: 'col', style: { width: '300px', flexShrink: 0 } });
    if (n.focus.cur) {
      const f = byId[n.focus.cur];
      side.append(H(`<div class="card hl"><div class="tag">Current focus</div><b>${f.icon} ${f.name}</b>${barHTML(n.focus.prog / f.days)}<div class="small muted">${Math.ceil((f.days - n.focus.prog) / (1 + g.mod(n.id, 'focusSpeed')))} days remaining</div></div>`));
    }
    const f = byId[selId];
    if (f) {
      const st = g.focusStatus(n.id, f);
      const d = el('div', { class: 'card' });
      d.innerHTML = `<div style="font-size:42px;text-align:center">${f.icon}</div><div class="pname" style="text-align:center;font-size:17px">${f.name}</div><div class="small muted" style="text-align:center">${f.days} days · ${st}</div>
        <p class="small" style="font-style:italic">${f.desc || ''}</p><div class="section">Effects</div><div class="small">${g.describeEffects(f.effects).map((x) => '• ' + x).join('<br>')}</div>
        ${f.pre.length ? `<div class="section">Requires</div><div class="small">${f.pre.map((grp) => grp.map((x) => `<span class="${n.focus.done.includes(x) ? 'pos' : 'neg'}">${byId[x]?.name || x}</span>`).join(' or ')).join('<br>and ')}</div>` : ''}
        ${f.excl.length ? `<div class="section">Mutually exclusive with</div><div class="small neg">${f.excl.map((x) => byId[x]?.name || x).join(', ')}</div>` : ''}
        ${f.req?.provinces ? `<div class="small">Requires ${f.req.provinces} provinces</div>` : ''}`;
      const row = el('div', { class: 'row', style: { marginTop: '8px' } });
      if (st === 'available') row.append(el('div', { class: 'btn primary', onclick: () => { const r = g.startFocus(n.id, f.id); if (r) ui.toast('Focus', r, '🚫'); ui.renderPanel(true); } }, n.focus.cur ? 'Busy…' : '▶ Start focus'));
      if (st === 'active') row.append(el('div', { class: 'btn danger', onclick: () => { g.cancelFocus(n.id); ui.renderPanel(true); } }, 'Cancel'));
      d.append(row);
      side.append(d);
    }
    side.append(el('div', { class: 'tiny muted' }, 'Solid lines: all prerequisites needed. Dashed: any one. Red ⟷: choosing one locks the other. Each realm\'s tree is assembled from its government, faith, rivals and history.'));
    pb.append(wrap, side);
  } },

  // ─────────────────────────────── DIPLOMACY
  diplomacy: { render(ui, pb) {
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
  } },

  // ─────────────────────────────── MILITARY
  military: { render(ui, pb) {
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
  } },

  // ─────────────────────────────── ECONOMY
  economy: { render(ui, pb) {
    const g = ui.g, n = ui.P, s = g.s, B = g.budget(n.id);
    pb.append(el('div', { class: 'section' }, 'Monthly Budget'));
    const max = Math.max(B.income, B.expense, 1);
    const line = (k, v, cls) => `<div class="row small"><span style="width:130px">${k}</span><div class="grow bar ${cls}"><i style="width:${Math.abs(v) / max * 100}%"></i></div><span style="width:56px;text-align:right" class="${v < 0 ? 'neg' : 'pos'}">${signed(v, 1)}</span></div>`;
    pb.append(H(line('Taxes', B.tax, 'green') + line('Trade', B.trade, 'green') + line('Mines', B.mines, 'green') + (B.tribute ? line('Tribute', B.tribute, B.tribute > 0 ? 'green' : 'red') : '') +
      line('Army upkeep', -B.armyUpkeep, 'red') + line('Court', -B.court, 'red') + line('Administration', -B.admin, 'red') + (B.interest ? line('Interest', -B.interest, 'red') : '') + `<div class="row small" style="margin-top:4px"><b class="grow">Balance</b><b class="${B.net < 0 ? 'neg' : 'pos'}">${signed(B.net, 1)} / month</b></div>`));
    pb.append(el('div', { class: 'section' }, 'Resources'));
    pb.append(H(`<div class="stat-grid"><div class="stat"><b>${fmt(n.food)}</b>🌾 Food ${signed(B.foodNet, 1)}</div><div class="stat"><b>${fmt(n.iron)}</b>⚒ Iron ${signed(B.iron, 1)}</div><div class="stat"><b>${fmt(n.timber)}</b>🪵 Timber ${signed(B.timber, 1)}</div>
      <div class="stat"><b>${fmt(n.horses)}</b>🐎 Horses ${signed(B.horses, 1)}</div><div class="stat"><b>${fmt(n.manpower)}</b>👥 Manpower</div><div class="stat"><b>${pct(g.mod(n.id, 'taxMult'))}</b>Tax modifier</div></div>`));
    pb.append(el('div', { class: 'section' }, 'Foreign Merchants'));
    const mk = el('div', { class: 'row wrap' });
    for (const [k, ic] of [['iron', '⚒'], ['timber', '🪵'], ['horses', '🐎'], ['food', '🌾']]) {
      const b = el('div', { class: 'btn small', onclick: () => { const r = g.buyResource(n.id, k, 10); if (r) ui.toast('Merchants', r, '🚫'); ui.renderPanel(true); ui.updateTopbar(); } }, `${ic} Buy 10 ${k} (${Math.round(g.resourcePrice(n.id, k) * 10)}g)`);
      b._tip = () => 'Import goods from Venetian, Genoese and Hanseatic traders. Trade modifiers lower the price.';
      mk.append(b);
    }
    pb.append(mk);
    pb.append(el('div', { class: 'section' }, 'Buildings in the Realm'));
    const tb = el('table', { class: 'tbl' });
    tb.innerHTML = '<tr><th>Building</th><th>Levels</th><th>Building</th></tr>' + BUILDING_ORDER.map((t) => {
      const lv = g.countBuildings(n.id, t);
      const q = g.ownedProvinces(n.id).reduce((a, p) => a + s.prov[p].queue.filter((x) => x.type === t).length, 0);
      return `<tr><td>${BUILDINGS[t].icon} ${BUILDINGS[t].name}</td><td>${lv}</td><td>${q || ''}</td></tr>`;
    }).join('');
    pb.append(tb);
    pb.append(el('div', { class: 'section' }, 'Construction Queue'));
    const qs = [];
    for (const p of g.ownedProvinces(n.id)) for (const q of s.prov[p].queue) qs.push([p, q]);
    if (!qs.length) pb.append(el('div', { class: 'small muted' }, 'Nothing under construction. Select one of your provinces and click a building slot.'));
    for (const [p, q] of qs) {
      const d = el('div', { class: 'row small', style: { cursor: 'pointer', margin: '3px 0' }, onclick: () => { ui.selectProvince(p); ui.v.flyToProvince(p); } });
      d.innerHTML = `<span style="width:150px">${BUILDINGS[q.type].icon} ${BUILDINGS[q.type].name}</span><span class="grow muted">${ui.v.map.provinces[p].name}</span>${barHTML(1 - q.days / q.total, 'green', '70px')}<span style="width:44px;text-align:right">${q.days}d</span>`;
      pb.append(d);
    }
    pb.append(el('div', { class: 'section' }, 'Suggestions'));
    const tips = [];
    if (B.foodNet < 0) tips.push('Food is falling: build Manorial Farms in farmland and plains, or keep armies at home.');
    if (n.iron < 10) tips.push('Iron is scarce: Mines in hills and mountains feed armoured troops and castles.');
    if (n.horses < 5) tips.push('Few horses: Stud Farms on plains and steppe are needed for cavalry.');
    if (B.net < 0) tips.push('The treasury is shrinking: disband idle regiments, build Markets, or demand funds from an estate.');
    if (!tips.length) tips.push('The realm\'s finances are sound. Invest in markets and castles on the frontier.');
    pb.append(H(tips.map((t) => `<div class="small">• ${t}</div>`).join('')));
  } },

  // ─────────────────────────────── WARS
  wars: { render(ui, pb) {
    const g = ui.g, n = ui.P, s = g.s;
    for (const o of s.peaceOffers || []) {
      const w = s.wars[o.war];
      if (!w) continue;
      const from = s.nations[o.from];
      const d = el('div', { class: 'card hl' });
      d.innerHTML = o.concession ? `<b>🕊 ${from.name} sues for peace</b><div class="small">They offer to cede: ${o.demands.map((x) => describeDemand(g, x)).join(', ')}</div>` : `<b>🕊 ${from.name} offers peace</b><div class="small">Terms: ${o.demands.length ? o.demands.map((x) => describeDemand(g, x)).join(', ') : 'white peace'}</div>`;
      d.append(el('div', { class: 'row', style: { marginTop: '5px' } },
        el('div', { class: 'btn green small', onclick: () => { g.makePeace(w, o.side, o.demands); s.peaceOffers = s.peaceOffers.filter((x) => x !== o); ui.renderPanel(true); } }, 'Accept'),
        el('div', { class: 'btn danger small', onclick: () => { s.peaceOffers = s.peaceOffers.filter((x) => x !== o); ui.renderPanel(true); } }, 'Refuse')));
      pb.append(d);
    }
    const mine = g.warsOf(n.id);
    pb.append(el('div', { class: 'section' }, 'Our Wars'));
    if (!mine.length) pb.append(el('div', { class: 'small muted' }, 'The realm is at peace. To start a war, pick a target in Diplomacy; you need a casus belli to avoid stability penalties.'));
    for (const w of mine) pb.append(warCard(ui, w, true));
    const others = Object.values(s.wars).filter((w) => !mine.includes(w));
    if (others.length) {
      pb.append(el('div', { class: 'section' }, 'Wars Elsewhere'));
      for (const w of others.slice(0, 20)) pb.append(warCard(ui, w, false));
    }
  } },

  // ─────────────────────────────── LEDGER
  ledger: { render(ui, pb) {
    const g = ui.g, n = ui.P, s = g.s;
    const [tabs, cur] = subtabs(ui, 'ledger', [['powers', 'Great Powers'], ['log', 'Chronicle of Europe']]);
    pb.append(tabs);
    if (cur === 'powers') {
      const rows = s.nations.filter((x) => x.alive).map((x) => ({ x, prov: g.ownedProvinces(x.id).length, dev: g.ownedProvinces(x.id).reduce((t, p) => t + s.prov[p].dev, 0), men: g.armiesOf(x.id).reduce((t, a) => t + g.armyMen(a), 0), pow: g.power(x.id) }));
      rows.sort((a, b) => b.pow - a.pow);
      const tb = el('table', { class: 'tbl' });
      tb.innerHTML = '<tr><th>#</th><th>Realm</th><th>Prov.</th><th>Dev</th><th>Army</th><th>Gold</th></tr>';
      rows.forEach((r, i) => {
        const tr = el('tr', { class: 'click', onclick: () => { ui.state.dipTarget = r.x.id; ui.openTab('diplomacy'); } });
        tr.innerHTML = `<td>${i + 1}</td><td>${coaSVG(r.x.coa, 14)} ${r.x.id === n.id ? '<b class="gold">' + r.x.name + '</b>' : r.x.name}</td><td>${r.prov}</td><td>${r.dev}</td><td>${fmt(r.men)}</td><td>${fmt(r.x.gold)}</td>`;
        tb.append(tr);
      });
      pb.append(tb);
    } else {
      for (const l of s.log.slice(0, 120)) pb.append(H(`<div class="small" style="margin-bottom:3px"><span class="muted">${dateStr(l.day)}</span> — ${l.text}</div>`));
    }
  } },
};

// ── helpers
function lawDetail(ui, cat, opt) {
  const g = ui.g, n = ui.P;
  const o = LAWS[cat].options[opt];
  const d = el('div', { class: 'card', style: { marginTop: '6px', background: 'rgba(0,0,0,.25)' } });
  const effs = g.describeEffects([{ mods: o.mods || {} }]);
  const reqs = g.lawReqs(n.id, cat, opt);
  const vote = g.lawVote(n.id, cat, opt);
  const st = (v) => (v > 0 ? `<span class="stance pos">${'+'.repeat(v)}</span>` : v < 0 ? `<span class="stance neg">${'−'.repeat(-v)}</span>` : '<span class="stance muted">·</span>');
  d.innerHTML = `<b>${o.name}</b><div class="small" style="font-style:italic">${o.desc}</div>
    <div class="section">Effects</div><div class="small">${effs.length ? effs.map((x) => '• ' + x).join('<br>') : '• No direct modifiers'}${o.convert ? '<br>• <b>The court converts to Christianity</b>' : ''}${o.infl ? '<br>' + Object.entries(o.infl).map(([k, v]) => `• ${estName(n, k)} influence ${signed(v)}`).join('<br>') : ''}</div>
    ${reqs.length ? `<div class="section">Requirements</div><div class="small">${reqs.map(([t, ok]) => `<div class="${ok ? 'pos' : 'neg'}">${ok ? '✔' : '✘'} ${t}</div>`).join('')}</div>` : ''}
    <div class="section">Estates' Stance</div><div class="small">${['nobles', 'clergy', 'burghers', 'peasants'].map((e) => `<div class="tt-line"><span>${ESTATE_ICONS[e]} ${estName(n, e)} (${Math.round(vote.estates[e].influence)}%)</span><span>${st(vote.estates[e].stance)} ${Math.round(vote.estates[e].support * 100)}% aye</span></div>`).join('')}
    <div class="tt-line"><b>Projected vote</b><b class="${vote.yes >= 0.5 ? 'pos' : 'neg'}">${Math.round(vote.yes * 100)}% in favour</b></div></div>`;
  const why = g.canProposeLaw(n.id, cat, opt);
  const row = el('div', { class: 'row', style: { marginTop: '6px' } });
  if (n.laws[cat] === opt) row.append(el('span', { class: 'pos small' }, '✔ In force'));
  else {
    row.append(el('div', { class: 'btn primary small' + (why ? ' disabled' : ''), onclick: () => { const r = g.proposeLaw(n.id, cat, opt); if (r) ui.toast('Law', r, '🚫'); ui.renderPanel(true); }, 'data-tip': why || 'Put it before the estates (10 prestige, 45 days)' }, '⚖ Propose'));
    if (g.canDecree(n.id)) row.append(el('div', { class: 'btn danger small', onclick: () => { const r = g.decreeLaw(n.id, cat, opt); if (r) ui.toast('Decree', r, '🚫'); ui.renderPanel(true); }, 'data-tip': 'Absolute decree: immediate. −15 legitimacy, −10 noble loyalty.' }, '👑 Decree'));
    if (why) row.append(el('span', { class: 'small neg' }, why));
  }
  d.append(row);
  return d;
}

function pickCharacter(ui, title, skill, cb) {
  const g = ui.g, n = ui.P;
  const cands = [...g.charsOf(n.id, 'pool'), ...g.charsOf(n.id, 'minister')].sort((a, b) => b.skills[skill] - a.skills[skill]);
  ui.modal((m, close) => {
    m.append(el('div', { class: 'mh' }, el('div', { class: 'frame-title' }, title)));
    const mb = el('div', { class: 'mb scroll', style: { maxHeight: '60vh' } });
    for (const c of cands) {
      const r = el('div', { class: 'nitem', onclick: () => { close(); cb(c.id); } });
      r.innerHTML = `<span class="portrait">${portraitSVG(c, g, 36)}</span><div class="grow"><b>${g.charName(c)}</b> ${c.office ? `<span class="muted small">(${roleTitle(n, c.office)})</span>` : ''}<div class="small">${skill}: <b class="gold">${c.skills[skill]}</b> · ${skills(c)}</div><div class="row wrap">${traitChips(c)}</div></div>`;
      mb.append(r);
    }
    if (!cands.length) mb.append(el('div', { class: 'muted' }, 'No candidates. Invite courtiers from the Court tab.'));
    m.append(mb, el('div', { class: 'mf' }, el('div', { class: 'btn', onclick: close }, 'Cancel')));
  });
}

function templateEditor(ui, pb) {
  const g = ui.g, n = ui.P;
  const st = ui.state;
  if (!st.tmpl || !n.templates.find((t) => t.id === st.tmpl.id) && st.tmpl.id !== 'new') {
    const t0 = n.templates[0];
    st.tmpl = t0 ? { id: t0.id, name: t0.name, regs: { ...t0.regs }, doctrine: t0.doctrine } : { id: 'new', name: 'New Host', regs: {}, doctrine: 'balanced' };
  }
  const T = st.tmpl;
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

export function describeDemand(g, d) {
  if (d.type === 'province') return g.provName(d.p);
  if (d.type === 'gold') return `${d.v} gold`;
  if (d.type === 'vassal') return `vassalage of ${g.s.nations[d.target].name}`;
  return 'humiliation';
}

function warCard(ui, w, mine) {
  const g = ui.g, s = g.s, n = ui.P;
  const side = w.att.includes(n.id) ? 'att' : 'def';
  const d = el('div', { class: 'card', style: { marginTop: '6px' } });
  const flags = (ids) => ids.map((i) => s.nations[i] ? coaSVG(s.nations[i].coa, 16) : '').join('');
  const score = mine ? (side === 'att' ? w.score : -w.score) : w.score;
  d.innerHTML = `<div class="row between"><b>${w.name}</b><span class="small muted">since ${dateStr(w.start)}</span></div>
    <div class="row small"><span>${flags(w.att)}</span><span class="grow" style="text-align:center">vs</span><span>${flags(w.def)}</span></div>
    <div class="row small"><span style="width:110px">${mine ? 'Our war score' : 'Attacker score'}</span><div class="grow bar ${score >= 0 ? 'green' : 'red'}"><i style="width:${Math.abs(score)}%"></i></div><b class="${score >= 0 ? 'pos' : 'neg'}" style="width:40px;text-align:right">${signed(score)}</b></div>
    <div class="tiny muted">Casus belli: ${CB_TYPES[w.cb]?.name || w.cb} · battles ${signed(w.battleScore || 0, 0)} · occupation ${Math.round(w.attOcc || 0)}% / ${Math.round(w.defOcc || 0)}%</div>`;
  if (mine) {
    const leader = side === 'att' ? w.attLeader : w.defLeader;
    const row = el('div', { class: 'row', style: { marginTop: '5px' } });
    if (leader === n.id) row.append(el('div', { class: 'btn primary small', onclick: () => ui.startPeace(w, side) }, '🕊 Negotiate peace on the map'));
    else row.append(el('div', { class: 'btn small', onclick: () => { g.leaveWar(w, n.id); ui.renderPanel(true); }, 'data-tip': 'Make a separate peace and leave the war (−prestige)' }, 'Leave war'));
    d.append(row);
  }
  return d;
}
