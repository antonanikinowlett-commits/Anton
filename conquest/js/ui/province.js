// Province panel: terrain, development, buildings, recruiting, armies present.
// Mixed into UI.prototype (this = the UI).
import { el, fmt } from '../util.js';
import { coaSVG, rebelCoa } from './heraldry.js';
import { BUILDINGS, BUILDING_ORDER, CHURCH_NAMES, CASTLE_NAMES } from '../data/buildings.js';
import { PANELS } from './panels.js';
import { terrainTip } from './tips.js';

export const ProvinceMixin = {
  // ── province panel
  renderProvince() {
    const p = this.selProv, g = this.g, s = this.s;
    const E = this.provEl;
    if (p < 0 || p === undefined) { E.classList.add('hidden'); this.provEl.classList.remove('shift'); return; }
    E.classList.remove('hidden');
    E.classList.toggle('shift', !!this.tab && !PANELS[this.tab]?.wide);
    const sp = this.v.map.provinces[p];
    E.innerHTML = '';
    if (sp.sea) {
      E.append(el('div', { class: 'ph' }, el('div', { class: 'grow' }, el('div', { class: 'pname' }, sp.name), el('div', { class: 'muted small' }, 'Sea zone')), el('span', { class: 'x', onclick: () => this.selectProvince(-1) }, '✕')));
      E.append(el('div', { class: 'pb small' }, 'Armies standing in a coastal province can be ordered across the sea: they embark on hired ships (gold cost, cheaper with a harbour) and sail at ~75 km per day. They cannot fight at sea, and suffer light attrition while aboard.'));
      return;
    }
    const pr = s.prov[p], own = s.nations[pr.owner], pl = s.player;
    const isMine = pr.owner === pl;
    const head = el('div', { class: 'ph' });
    head.innerHTML = `${own ? coaSVG(own.coa, 34) : ''}<div class="grow"><div class="pname">${sp.name}${own && own.capital === p ? ' <span data-tip="Capital">★</span>' : ''}</div>
      <div class="small muted">${own ? own.name : 'Unclaimed'}${own && own.overlord >= 0 ? ' (vassal of ' + s.nations[own.overlord].name + ')' : ''}</div></div>`;
    head.append(el('span', { class: 'x', onclick: () => this.selectProvince(-1) }, '✕'));
    E.append(head);
    const pb = el('div', { class: 'pb scroll' });
    E.append(pb);
    const TI = { farmland: '🌾', plains: '🌿', forest: '🌲', taiga: '🌲', hills: '⛰', mountains: '🏔', marsh: '🪷', steppe: '🐎', desert: '🏜' };
    const fort = g.fortLevel(p);
    const stats = el('div', { class: 'row wrap' });
    const chip = (txt, tip, cls = '') => { const c = el('span', { class: 'chip ' + cls }, txt); c._tip = () => tip; return c; };
    stats.append(...[
      chip(`${TI[sp.terrain]} ${sp.terrain}`, `<b>${sp.terrain}</b><br>${terrainTip(sp.terrain)}`),
      chip(`🏘 Dev ${pr.dev}`, '<b>Development</b>: population, wealth and administration. Drives taxes, manpower and supply. Grows slowly with farms and markets.'),
      chip(`🗣 ${pr.culture}`, own && pr.culture !== own.culture ? `<b>Foreign culture</b>: +unrest under the ${own.adj}.` : '<b>Culture</b>', own && pr.culture !== own.culture ? 'bad' : ''),
      chip(`✝ ${pr.religion}`, own && pr.religion !== own.religion ? '<b>Different faith</b>: +10 unrest and -15% taxes. Churches slowly convert.' : '<b>Religion</b>', own && pr.religion !== own.religion ? 'bad' : ''),
      chip(`🔥 ${Math.round(pr.unrest)}`, '<b>Unrest</b>: above 60 revolts become likely. Lowered by churches, stability, garrisons and good laws.', pr.unrest > 45 ? 'bad' : ''),
      chip(`🏰 Fort ${fort}`, `<b>Fort level ${fort}</b>${pr.buildings.walls ? ' (' + CASTLE_NAMES[Math.min(2, pr.buildings.walls - 1)] + ')' : ''}${own && own.capital === p ? ' +1 capital' : ''}. Enemy armies must besiege it to take the province, and cannot march past it.`),
      chip(`🌾 Supply ${g.supplyLimit(p, pl).toFixed(0)}`, '<b>Supply limit</b> (regiments) for your armies here this season. Exceeding it causes attrition.'),
      sp.coastal ? chip('⚓ Coastal', 'Armies can embark here.') : null,
      sp.river > 0.03 ? chip('〰 River', 'Rivers: attackers crossing suffer −25% attack and charge.') : null,
    ].filter(Boolean));
    pb.append(stats);
    if (own && own.id === s.player && (pr.religion !== own.religion || pr.heresy || pr.conv)) {
      const rb = el('div', { class: 'row wrap', style: { marginTop: '6px' } });
      const rbtn = (label, tip, fn, cls = '') => { const b = el('div', { class: 'btn small ' + cls, onclick: () => { const r = fn(); if (r) this.toast('Religion', r, '🚫'); this.renderProvince(); } }, label); b._tip = () => tip; rb.append(b); };
      if (pr.conv) rb.append(el('span', { class: 'chip' }, `✝ Missionaries: ${pr.conv.left} months left`));
      else if (pr.religion !== own.religion) rbtn('✝ Convert (40 gold)', `Send missionaries. About ${g.conversionMonths(own.id, p)} months; churches and a loyal clergy speed it up.`, () => g.startConversion(own.id, p), 'primary');
      if (pr.heresy) rbtn('🔥 Suppress heresy (30 gold)', '<b>Heresy</b>: +12 unrest target here, and it can spread. An inquisition removes it.', () => g.suppressHeresy(own.id, p), 'danger');
      pb.append(rb);
    }
    if (pr.controller !== pr.owner) {
      const c = s.nations[pr.controller];
      pb.append(el('div', { class: 'card', style: { marginTop: '6px', borderColor: '#8a3a2a' } }, `⚔ Occupied by ${c ? c.name : 'rebels'}`));
    }
    if (pr.blockadedBy !== undefined) pb.append(el('div', { class: 'card', style: { marginTop: '6px', borderColor: '#2a5a8a' } }, `⚓ Blockaded by ${s.nations[pr.blockadedBy].name}: trade −80%, no recruitment. Sink the fleet to break it.`));
    if (pr.siege) {
      const sg = pr.siege;
      const besieger = sg.by >= 0 ? s.nations[sg.by] : null;
      const box = el('div', { class: 'card', style: { marginTop: '6px' } });
      box.innerHTML = `<div class="row between"><b>🏰 Siege by ${besieger ? besieger.name : 'rebels'}</b><span>${Math.round(sg.prog)}% · day ${sg.days}</span></div>
        <div class="bar" style="margin:4px 0"><i style="width:${Math.min(100, sg.prog)}%;background:#d07030"></i></div>
        <div class="small muted">Est. ${sg.rate ? Math.max(1, Math.ceil((100 - sg.prog) / sg.rate)) + ' days to fall' : 'no progress'} · walls breached ${Math.round((sg.breach || 0) / 0.4 * 100)}%${sg.starving ? ' · <span class="neg">garrison starving</span>' : ''}</div>
        <div class="small muted">Garrison ${Math.round(fort * 1000 * pr.garrison)} men${sg.blockade ? '' : ' — <span class="neg">besiegers too few to make progress (need 1.5× garrison)</span>'}</div>
        ${sg.events.map((e) => `<div class="small">• ${e.t}</div>`).join('')}`;
      if (sg.by === pl) box.append(el('div', { class: 'btn danger small', style: { marginTop: '4px' }, onclick: () => { const r = g.assault(p); this.toast('Assault', r || 'The walls have been stormed!', r ? '💀' : '🏰'); this.renderProvince(); }, 'data-tip': 'Storm the walls now. Costly in lives; chance grows with siege progress and numbers.' }, '⚔ Assault the walls'));
      pb.append(box);
    }
    // buildings
    pb.append(el('div', { class: 'section' }, 'Buildings', el('span', { class: 'tiny muted' }, isMine ? 'click to build' : '')));
    const grid = el('div', { class: 'bgrid' });
    for (const type of BUILDING_ORDER) {
      const B = BUILDINGS[type];
      const lvl = pr.buildings[type] || 0;
      const allowed = B.allowed(sp);
      const q = pr.queue.find((x) => x.type === type);
      let name = B.name;
      if (type === 'church' && lvl) name = (CHURCH_NAMES[pr.religion] || CHURCH_NAMES.catholic)[Math.min(2, lvl - 1)];
      if (type === 'walls' && lvl) name = CASTLE_NAMES[Math.min(2, lvl - 1)];
      const slot = el('div', { class: 'bslot' + (allowed ? '' : ' na') }, el('div', { class: 'bi' }, B.icon), el('div', { class: 'bn' }, name), lvl ? el('div', { class: 'lv' }, `${lvl}/${B.max}`) : null,
        q ? el('div', { class: 'q' }, el('i', { style: { width: `${100 - q.days / q.total * 100}%` } })) : null);
      slot._tip = () => {
        const cost = g.buildCost(pl, p, type), why = isMine ? g.canBuild(pl, p, type) : 'Not your province';
        return `<div class="tt-title">${B.icon} ${B.name} ${lvl}/${B.max}</div>${B.desc}<hr>Cost: ${Object.entries(cost).map(([k, v]) => `${v} ${k}`).join(', ')}${q ? `<br>Under construction: ${q.days} days left` : ''}${why ? `<br><span class="neg">${why}</span>` : '<br><span class="pos">Click to build</span>'}`;
      };
      if (isMine && allowed) slot.onclick = () => { const r = g.build(pl, p, type); if (r) this.toast('Cannot build', r, '🚫'); else this.emit('built', p, type); this.renderProvince(); this.updateTopbar(); };
      grid.append(slot);
    }
    pb.append(grid);
    // production
    if (own) {
      const inc = g.provinceIncome(p, pr.owner);
      pb.append(el('div', { class: 'small muted', style: { marginTop: '6px' } }, `Monthly: 🪙 ${(inc.tax + inc.trade + inc.goldMine).toFixed(2)} · 🌾 ${inc.food.toFixed(1)} · ⚒ ${inc.iron.toFixed(1)} · 🪵 ${inc.timber.toFixed(1)} · 🐎 ${inc.horses.toFixed(1)}`));
    }
    if (pr.claims.length) pb.append(el('div', { class: 'small', style: { marginTop: '4px' } }, '📜 Claimed by: ', ...pr.claims.map((c) => el('span', { class: 'chip ' + (c === pl ? 'good' : '') }, s.nations[c]?.adj || '?'))));
    // actions
    const act = el('div', { class: 'row wrap', style: { marginTop: '8px' } });
    if (isMine && pr.controller === pl) {
      const sel = el('select', {});
      for (const t of this.P.templates) sel.append(el('option', { value: t.id }, t.name));
      const rb = el('div', { class: 'btn green small', onclick: () => {
        const t = this.P.templates.find((x) => x.id === +sel.value);
        const r = g.recruit(pl, p, t);
        if (r) this.toast('Cannot recruit', r, '🚫'); else { this.toast('Mustering', `${t.name} will assemble at ${sp.name}.`, '⚔'); this.emit('recruited'); }
        this.updateTopbar();
      } }, '⚔ Recruit');
      rb._tip = () => { const t = this.P.templates.find((x) => x.id === +sel.value); if (!t) return ''; const c = g.templateCost(pl, t); return `<b>${t.name}</b><br>${Object.entries(c).filter(([k, v]) => v && k !== 'days').map(([k, v]) => `${fmt(v)} ${k}`).join(', ')}<br>${c.days} days (barracks speed this up)`; };
      act.append(sel, rb);
    }
    if (isMine && pr.controller === pl) {
      const dc = g.developCost(p);
      act.append(el('div', { class: 'btn small', onclick: () => { const r = g.developProvince(pl, p); if (r) this.toast('Develop', r, '🚫'); this.renderProvince(); this.updateTopbar(); }, 'data-tip': `Invest ${dc} gold: settle colonists, clear land and found villages. +1 development (taxes, manpower, supply).` }, `🏘 Develop (${dc}g)`));
    }
    if (!isMine && own) {
      const near = sp.adj.some((e) => e.id < g.L && s.prov[e.id].owner === pl);
      if (near && !pr.claims.includes(pl)) act.append(el('div', { class: 'btn small', onclick: () => { const r = g.fabricateClaim(pl, p); this.toast('Fabricate claim', r || `Our chancellor begins forging documents for ${sp.name}. (~5 months)`, r ? '🚫' : '📜'); this.renderProvince(); }, 'data-tip': 'Your chancellor forges a claim (20 gold, ~5 months). Claims give a casus belli and cheaper peace demands.' }, '📜 Fabricate claim'));
      act.append(el('div', { class: 'btn small', onclick: () => { this.state.dipTarget = pr.owner; this.openTab('diplomacy'); } }, `🤝 ${own.adj} diplomacy`));
    }
    if (this.selArmies.length) act.append(el('div', { class: 'btn small primary', onclick: () => this.rightClick(p) }, '➜ Move selected army here'));
    pb.append(act);
    // armies present
    const here = g.armiesAt(p);
    if (here.length) {
      pb.append(el('div', { class: 'section' }, 'Armies here'));
      for (const a of here) {
        const n = s.nations[a.nation];
        const r = el('div', { class: 'row', style: { cursor: 'pointer', padding: '2px 0' }, onclick: () => this.selectArmies([a.id]) });
        r.innerHTML = `${n ? coaSVG(n.coa, 16) : rebelCoa(16)}<span class="grow">${a.name}</span><span>${fmt(g.armyMen(a))}</span>`;
        pb.append(r);
      }
    }
  },
};
