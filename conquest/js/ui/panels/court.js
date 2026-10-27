// Court panel: Royal council, estates, generals and courtiers.
import { el } from '../../util.js';
import { portraitSVG } from '../portrait.js';
import { ESTATE_ICONS, COUNCIL_ROLES, ROLE_INFO } from '../../data/government.js';
import { registerPanel } from './registry.js';
import { traitChips, skills, subtabs, barHTML, roleTitle, estName } from './common.js';

registerPanel({ id: 'court', icon: '🏛', name: 'Court & Estates', key: 'c', order: 20, render(ui, pb) {
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
        <div class="small muted">Battles ${c.battles || 0} (won ${c.wins || 0}) · kills ${(c.kills || 0).toLocaleString()} · sieges ${c.sieges || 0} · XP ${Math.round(c.xp || 0)}/30${(c.woundedUntil || 0) > s.day ? ' · <span class="neg">wounded</span>' : ''}</div><div class="small ${a ? '' : 'muted'}">${a ? 'Commands ' + a.name : 'Unassigned'}</div></div>`;
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
} });

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
