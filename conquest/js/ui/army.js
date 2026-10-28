// Army panel: general, doctrine, regiments, orders, splitting/merging and front assignment.
// Mixed into UI.prototype (this = the UI).
import { el, fmt, pct } from '../util.js';
import { coaSVG, rebelCoa } from './heraldry.js';
import { portraitSVG } from './portrait.js';
import { ENGAGE } from '../sim/warplan.js';
import { UNITS } from '../data/units.js';
import { DOCTRINES } from '../data/tactics.js';
import { TRAITS } from '../data/traits.js';
import { unitTip } from './tips.js';

export const ArmyMixin = {
  // ── army panel
  renderArmy() {
    const g = this.g, s = this.s;
    const E = this.armyEl;
    const armies = this.selArmies.map((i) => s.armies[i]).filter(Boolean);
    if (!armies.length) { E.classList.add('hidden'); return; }
    E.classList.remove('hidden');
    E.innerHTML = '';
    if (armies.length > 1) {
      E.append(el('div', { class: 'ph' }, el('div', { class: 'frame-title grow' }, `${armies.length} armies selected`), el('span', { class: 'x', onclick: () => this.selectArmies([]) }, '✕')));
      const pb = el('div', { class: 'pb scroll' });
      for (const a of armies) {
        const r = el('div', { class: 'row', style: { cursor: 'pointer' }, onclick: () => this.selectArmies([a.id]) });
        r.innerHTML = `<span class="grow">${a.name}</span><span>${fmt(g.armyMen(a))} men</span><span class="muted">${this.v.map.provinces[a.loc].name}</span>`;
        pb.append(r);
      }
      const mineAll = armies.every((a) => a.nation === s.player);
      const same = armies.every((a) => a.loc === armies[0].loc);
      const main = armies.find((a) => !a.path.length && !a.battle) || armies[0];
      pb.append(el('div', { class: 'row', style: { marginTop: '8px' } },
        mineAll ? el('div', { class: 'btn primary', onclick: () => {
          const r = g.mergeOrder(armies.map((a) => a.id));
          if (r) this.toast('Merge', r, '⧉');
          this.selectArmies([main.id].filter((i) => s.armies[i]));
        }, 'data-tip': same ? 'Combine these armies into one' : `Combine into one army: the others march to ${main.name} at ${this.v.map.provinces[main.loc].name} and join it on arrival` }, same ? `⧉ Merge ${armies.length} armies` : `⧉ Merge at ${this.v.map.provinces[main.loc].name}`) : null,
        el('div', { class: 'btn small', onclick: () => { for (const a of armies) g.stop(a.id); this.renderArmy(); } }, '■ Stop all')));
      if (armies.every((a) => a.nation === s.player)) pb.append(this.frontTools(armies));
      E.append(pb);
      return;
    }
    const a = armies[0], n = s.nations[a.nation], mine = a.nation === s.player;
    const head = el('div', { class: 'ph' });
    head.innerHTML = `${n ? coaSVG(n.coa, 30) : rebelCoa(30)}<div class="grow"><div class="pname" style="font-size:16px">${a.name}</div><div class="small muted">${n ? n.name : 'Rebels'} · ${this.v.map.provinces[a.loc].name}${a.path.length ? ' → ' + this.v.map.provinces[a.path[a.path.length - 1]].name + ` (${Math.ceil(g.pathDays(a, a.path) * (1 - a.prog * 0))} days)` : ''}${a.retreating ? ' · <span class="neg">retreating</span>' : ''}${a.battle ? ' · <span class="neg">in battle</span>' : ''}</div></div>`;
    head.append(el('span', { class: 'x', onclick: () => this.selectArmies([]) }, '✕'));
    E.append(head);
    const pb = el('div', { class: 'pb scroll' });
    E.append(pb);
    // general
    const gen = g.generalOf(a);
    const gr = el('div', { class: 'row' });
    gr.innerHTML = `<span class="portrait">${portraitSVG(gen, g, 40)}</span>`;
    const ginfo = el('div', { class: 'grow' });
    if (gen) {
      ginfo.innerHTML = `<b>${g.charName(gen)}</b> <span class="muted small">age ${g.age(gen)}</span><div class="small">⚔ ${gen.gen.atk} · 🛡 ${gen.gen.def} · ♟ ${gen.gen.tactics + g.mod(a.nation, 'generalTactics')} · 🏰 ${gen.gen.siege} · 🛒 ${gen.gen.logistics}</div>
        <div class="row wrap">${gen.traits.map((t) => `<span class="chip" data-tip="<b>${TRAITS[t].name}</b><br>${TRAITS[t].desc}">${TRAITS[t].icon} ${TRAITS[t].name}</span>`).join('')}</div>`;
    } else ginfo.innerHTML = '<span class="neg small">No commander: −10% attack, morale suffers, worst tactics.</span>';
    gr.append(ginfo);
    if (mine) {
      const sel = el('select', { onchange: (e) => { if (e.target.value) g.assignGeneral(a.id, +e.target.value); else g.unassignGeneral(a.id); this.renderArmy(); } });
      sel.append(el('option', { value: '' }, '— no general —'));
      for (const c of [...g.charsOf(s.player, 'general'), g.s.chars[this.P.ruler], g.s.chars[this.P.heir]].filter((c) => c && (c.gen || c.role === 'general'))) {
        if (!c.gen) g.makeGeneral(c);
        sel.append(el('option', { value: c.id, selected: c.id === a.general ? 'selected' : null }, `${g.charName(c)} (${c.gen.atk}/${c.gen.def}/${c.gen.tactics})${c.army && c.army !== a.id ? ' ⚑' : ''}`));
      }
      gr.append(sel);
    }
    pb.append(gr);
    // doctrine
    const dr = el('div', { class: 'row', style: { margin: '6px 0' } }, el('span', { class: 'small muted' }, 'Doctrine:'));
    for (const [k, d] of Object.entries(DOCTRINES)) {
      const b = el('div', { class: 'subtab' + (a.doctrine === k ? ' on' : ''), onclick: () => { if (mine) { a.doctrine = k; this.renderArmy(); } } }, d.name);
      b._tip = () => `<b>${d.name}</b><br>${d.desc}<br><span class="muted small">Biases which tactics the general picks in each battle phase.</span>`;
      dr.append(b);
    }
    pb.append(dr);
    // orders: engage policy and retreat line
    {
      const o = g.armyOrders(a), vet = g.armyVeterancy(a);
      const orow = el('div', { class: 'row wrap army-orders', style: { margin: '6px 0' } }, el('span', { class: 'small muted' }, 'Orders:'));
      for (const [k, d] of Object.entries(ENGAGE)) {
        const b = el('div', { class: 'subtab' + (o.engage === k ? ' on' : ''), onclick: () => { if (mine) { g.setArmyOrders(a.id, { engage: k }); this.renderArmy(); } } }, d.name);
        b._tip = () => `<b>${d.name}</b><br>${d.desc}`;
        orow.append(b);
      }
      const rl = el('select', { onchange: (e) => { if (mine) { g.setArmyOrders(a.id, { retreat: +e.target.value }); this.renderArmy(); } } });
      for (const v of [0, 0.2, 0.3, 0.4, 0.5, 0.6]) rl.append(el('option', { value: v, selected: Math.abs(o.retreat - v) < 0.01 ? 'selected' : null }, v ? `Retreat below ${Math.round(v * 100)}% morale` : 'Fight to the end'));
      rl._tip = () => '<b>Retreat line</b><br>If the army\'s morale falls below this (and the enemy\'s is higher) it leaves the battle in good order: far fewer casualties than a rout.';
      orow.append(rl, el('span', { class: 'chip', 'data-tip': `Veterancy: ${vet.label}. Experienced regiments fight up to +35% better; fresh recruits dilute it.` }, `🎖 ${vet.label} (+${vet.bonus}%)`));
      pb.append(orow);
    }
    // stats
    const men = g.armyMen(a), max = g.armyMax(a);
    const sup = a.loc < g.L ? g.supplyLimit(a.loc, a.nation) : 999;
    const regsHere = g.armiesAt(a.loc).filter((b) => b.nation === a.nation).reduce((t, b) => t + b.regs.length, 0);
    const up = g.armyUpkeep(a);
    const st = el('div', { class: 'row wrap small' });
    st.innerHTML = `<span class="chip" data-tip="Men present / full strength">👥 ${fmt(men)} / ${fmt(max)}</span>
      <span class="chip" data-tip="Average morale. Armies break when morale collapses.">💪 ${pct(g.armyMorale(a))}</span>
      <span class="chip" data-tip="March speed (slowest regiment), km per day on good roads">🥾 ${g.armySpeed(a)} km/d</span>
      <span class="chip ${regsHere > sup ? 'bad' : ''}" data-tip="Regiments here / supply limit. Over the limit means attrition.">🌾 ${regsHere}/${sup >= 999 ? '∞' : sup.toFixed(0)}</span>
      <span class="chip ${a.attrition > 0.001 ? 'bad' : ''}" data-tip="Daily attrition">☠ ${((a.attrition || 0) * 100).toFixed(2)}%/day</span>
      <span class="chip" data-tip="Monthly upkeep">🪙 ${up.gold.toFixed(1)} · 🌾 ${up.food.toFixed(1)}</span>
      ${a.entrench ? `<span class="chip" data-tip="Days dug in: up to +15% defence">⛏ ${a.entrench}d</span>` : ''}`;
    pb.append(st);
    // regiments
    pb.append(el('div', { class: 'section' }, `Regiments (${a.regs.length})`));
    const regs = el('div', { class: 'regs' });
    const order = ['inf', 'rng', 'cav', 'siege'];
    const sorted = [...a.regs].sort((x, y) => order.indexOf(UNITS[x.type].cls) - order.indexOf(UNITS[y.type].cls));
    this.state.regSel ||= new Set();
    if (this.state.regSelArmy !== a.id) { this.state.regSel = new Set(); this.state.regSelArmy = a.id; }
    const regSel = this.state.regSel;
    for (const r of sorted) {
      const u = UNITS[r.type];
      const ri = a.regs.indexOf(r);
      const d = el('div', { class: 'reg' + (regSel.has(ri) ? ' picked' : ''), onclick: () => { if (!mine) return; regSel.has(ri) ? regSel.delete(ri) : regSel.add(ri); this.renderArmy(); } });
      d.innerHTML = `<div class="row"><span class="ri">${u.icon}</span><span class="grow">${u.name}</span></div><div class="row between"><span>${fmt(r.men)}</span><span class="gold">${'★'.repeat(Math.floor((r.xp || 0) * 3))}</span></div><div class="bar green"><i style="width:${r.morale * 100}%"></i></div>`;
      d._tip = () => unitTip(r.type) + `<hr>Men ${Math.round(r.men)}/${r.max} · morale ${pct(r.morale)} · experience ${pct(r.xp || 0)}${UNITS[r.type].merc ? ` · loyalty ${pct(r.loy ?? 1)} (falls while the treasury is empty; below 50% they desert)` : ''}`;
      regs.append(d);
    }
    pb.append(regs);
    // supply & attrition
    {
      const at = a.attrition || 0;
      const pc = (at * 30 * 100).toFixed(1);
      const card = el('div', { class: 'small', style: { marginTop: '6px' } });
      card.innerHTML = `📦 Supply: ${a.supply ? `${a.supply.regs}/${a.supply.lim} regiments supported here` : a.atSea ? 'at sea' : '—'} · Attrition <b class="${at > 0 ? 'neg' : 'pos'}">${pc}%/month</b>`;
      card._tip = () => (a.attrWhy && a.attrWhy.length ? a.attrWhy.map(([t, v]) => `${t}${v ? ` (−${(v * 30 * 100).toFixed(1)}%/month)` : ''}`).join('<br>') : 'No attrition. Armies in friendly land recover; enemy land, winter in mountains or taiga, desert summers, and overcrowding all cost men.');
      pb.append(card);
    }
    // orders
    if (mine) {
      const o = el('div', { class: 'row wrap', style: { marginTop: '8px' } });
      o.append(el('div', { class: 'btn small', onclick: () => { g.stop(a.id); this.renderArmy(); } }, '■ Stop'));
      if (regSel.size && regSel.size < a.regs.length) o.append(el('div', { class: 'btn small primary', onclick: () => { const b = g.detach(a.id, [...regSel]); regSel.clear(); if (b) this.selectArmies([a.id, b.id]); }, 'data-tip': 'Form a new division from the regiments you picked' }, `✂ Detach ${regSel.size} picked`));
      for (const n of [2, 3, 4]) if (a.regs.length >= n) o.append(el('div', { class: 'btn small', onclick: () => { const ds = g.splitInto(a.id, n); this.selectArmies(ds.map((d) => d.id)); }, 'data-tip': `Divide into ${n} divisions, each with the same mix of troops` }, `✂ ÷${n}`));
      if (new Set(a.regs.map((r) => UNITS[r.type].cls)).size > 1) o.append(el('div', { class: 'btn small', onclick: () => { const ds = g.splitByType(a.id); this.selectArmies(ds.map((d) => d.id)); }, 'data-tip': 'Separate foot, archers, horse and siege engines into their own divisions' }, '✂ By arm'));
      const others = g.armiesAt(a.loc).filter((b) => b !== a && b.nation === a.nation && !b.battle);
      if (others.length) o.append(el('div', { class: 'btn small', onclick: () => { g.merge([a.id, ...others.map((b) => b.id)]); this.renderArmy(); } }, '⧉ Merge here'));
      const pr = s.prov[a.loc];
      if (pr && pr.siege && pr.siege.by === a.nation) o.append(el('div', { class: 'btn small danger', onclick: () => { const r = g.assault(a.loc); this.toast('Assault', r || 'The walls are stormed!', r ? '💀' : '🏰'); this.renderArmy(); } }, '⚔ Assault'));
      if (a.template && !a.battle) o.append(el('div', { class: 'btn small green', onclick: () => { const r = g.reinforceFromTemplate(a.id); this.toast(r ? 'Cannot reinforce' : 'Reinforcements', r || 'Missing regiments are mustering and will join the army.', r ? '🚫' : '⚔'); this.updateTopbar(); }, 'data-tip': 'Recruit the regiments this army has lost, up to its template. They muster here and merge in.' }, '➕ Reinforce from template'));
      if (a.battle) o.append(el('div', { class: 'btn small primary', onclick: () => this.battleViewer.open(a.battle) }, '👁 Watch battle'));
      o.append(el('div', { class: 'btn small danger', onclick: () => this.confirm('Disband army', `Disband ${a.name}? 60% of the men return to the manpower pool.`, () => { g.disband(a.id); this.selectArmies([]); }) }, '✖ Disband'));
      pb.append(o);
      pb.append(this.frontTools([a]));
      pb.append(el('div', { class: 'tiny muted', style: { marginTop: '6px' } }, 'Shift+click other army counters to select them, then Merge. Click regiments to pick them for a new division. Right-click a province to march. Right-click across the sea from a coast to sail. Shift-drag on the map to select several armies.'));
    }
  },

  // Assign divisions to a front line against an enemy realm.
  frontTools(armies) {
    const g = this.g, s = this.s, pl = s.player;
    const box = el('div', { class: 'card', style: { marginTop: '8px' } });
    const f = armies.length === 1 ? g.frontOfArmy(armies[0].id) : null;
    if (f) {
      box.append(el('div', { class: 'row' }, el('span', { class: 'grow small' }, `⚑ On the front against the ${s.nations[f.enemy].name} · ${f.mode === 'advance' ? 'advancing' : 'holding the line'}`),
        el('div', { class: 'btn small', onclick: () => { g.leaveFront(armies[0].id); this.renderArmy(); } }, 'Leave front')));
      return box;
    }
    const enemies = g.enemiesOf(pl);
    const cands = [...new Set([...enemies, ...g.neighbours(pl)])].filter((x) => s.nations[x]?.alive);
    if (!cands.length) return el('span');
    const sel = el('select', {});
    for (const x of cands) sel.append(el('option', { value: x }, `${s.nations[x].name}${enemies.includes(x) ? ' ⚔' : ''}`));
    const msg = (r, ok) => { if (r) this.toast('Front', r, '🚫'); else this.toast('Front', ok, '⚑'); this.renderArmy(); this.renderPanel(); };
    box.append(el('div', { class: 'tag' }, 'Front line'), el('div', { class: 'row wrap', style: { marginTop: '4px' } }, sel,
      el('div', { class: 'btn small', onclick: () => msg(g.createFront(pl, +sel.value, armies.map((a) => a.id)), 'Divisions are spreading out along the border.'), 'data-tip': 'These armies spread out evenly along the border with this realm and hold it. Order them to advance from the Military tab or the front list.' }, '⚑ Assign to front'),
      armies.length === 1 ? el('div', { class: 'btn small primary', onclick: () => { const r = g.coverFront(armies[0].id, +sel.value); msg(r, 'Army divided into divisions covering the whole border.'); if (!r) { const fr = g.frontOfArmy(armies[0].id); if (fr) this.selectArmies(fr.armies); } }, 'data-tip': 'Divide this army into as many divisions as the border needs (at least 2 regiments each) and spread them along it.' }, '✂⚑ Split & cover front') : null));
    return box;
  },
};
