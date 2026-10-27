// Peace negotiation on the map: click enemy provinces to demand them.
// Mixed into UI.prototype (this = the UI).
import { el, signed, clamp } from '../util.js';
import { describeDemand } from './panels.js';

export const PeaceMixin = {
  // ── peace negotiation on the map: click enemy provinces to demand them
  startPeace(w, side) {
    this.endPeace();
    const g = this.g, s = this.s;
    const losers = side === 'att' ? w.def : w.att;
    const pm = this.peace = { w, side, picked: new Set(), provs: new Set(), gold: 0, vassal: false, humiliate: false };
    for (const nid of losers) for (const p of g.ownedProvinces(nid)) { pm.provs.add(p); this.v.setFlag(p, 16, true); }
    this.openTab(null); this.selectProvince(-1); this.selectArmies([]);
    this.peaceEl = el('div', { id: 'peace', class: 'frame' });
    this.root.append(this.peaceEl);
    // look at the enemy land we hold, or their capital
    const ours = side === 'att' ? w.att : w.def;
    const occ = [...pm.provs].filter((p) => ours.includes(s.prov[p].controller));
    const focus = occ.length ? occ : [s.nations[losers[0]].capital].filter((p) => p >= 0);
    if (focus.length) {
      const P = this.v.map.provinces;
      const x = focus.reduce((t, p) => t + P[p].x, 0) / focus.length, z = focus.reduce((t, p) => t + P[p].y, 0) / focus.length;
      this.v.flyTo(x, z, 420);
    }
    this.setSpeed(0);
    this.renderPeace();
  },
  endPeace() {
    const pm = this.peace;
    if (!pm) return;
    for (const p of pm.provs) { this.v.setFlag(p, 16, false); this.v.setFlag(p, 4, false); }
    this.peaceEl?.remove();
    this.peace = null;
  },
  peaceDemands() {
    const pm = this.peace, pl = this.s.player;
    const d = [...pm.picked].map((p) => ({ type: 'province', p, to: pl }));
    if (pm.gold) d.push({ type: 'gold', v: pm.gold });
    if (pm.vassal) d.push({ type: 'vassal', target: pm.side === 'att' ? pm.w.defLeader : pm.w.attLeader });
    if (pm.humiliate) d.push({ type: 'humiliate' });
    return d;
  },
  togglePeaceProv(p) {
    const pm = this.peace;
    if (p < 0 || !pm.provs.has(p)) { this.toast('Peace', 'That province is not theirs to give.', '🚫'); return; }
    if (pm.picked.has(p)) { pm.picked.delete(p); this.v.setFlag(p, 4, false); }
    else { pm.picked.add(p); this.v.setFlag(p, 4, true); }
    this.renderPeace();
  },
  renderPeace() {
    const pm = this.peace, g = this.g, s = this.s, w = pm.w;
    if (!s.wars[w.id]) { this.endPeace(); return; }
    const E = this.peaceEl;
    E.innerHTML = '';
    E.append(el('div', { class: 'ph' }, el('div', { class: 'frame-title grow' }, '🕊 ' + w.name), el('span', { class: 'x', onclick: () => this.endPeace() }, '✕')));
    const pb = el('div', { class: 'pb scroll' });
    E.append(pb);
    const demands = this.peaceDemands();
    const acc = g.peaceAcceptance(w, pm.side, demands);
    const score = pm.side === 'att' ? w.score : -w.score;
    pb.append(el('div', { class: 'small muted' }, 'Click the highlighted enemy provinces on the map to demand them; click again to drop one. Occupied and claimed provinces cost less war score.'));
    const sum = el('div', { class: 'card hl', style: { marginTop: '6px' } });
    sum.innerHTML = `<div class="tt-line"><span>Our war score</span><b class="${score >= 0 ? 'pos' : 'neg'}">${signed(score)}</b></div>
      <div class="tt-line"><span>Cost of demands</span><b>${acc.cost}</b></div>
      <div class="tt-line"><span>Their willingness</span><b class="${acc.will >= 0 ? 'pos' : 'neg'}">${signed(acc.will)}</b></div>
      <div class="bar ${acc.will >= 0 ? 'green' : 'red'}" style="margin-top:4px"><i style="width:${clamp(50 + acc.will, 0, 100)}%"></i></div>
      <div class="small ${acc.will >= 0 ? 'pos' : 'neg'}" style="margin-top:3px">${acc.will >= 0 ? 'They will accept these terms.' : 'They will refuse. Ask for less, or occupy more and win battles first.'}</div>`;
    pb.append(sum);
    const ours = pm.side === 'att' ? w.att : w.def;
    const quick = el('div', { class: 'row wrap', style: { marginTop: '6px' } },
      el('div', { class: 'btn small', onclick: () => { for (const p of pm.provs) if (ours.includes(s.prov[p].controller) && !pm.picked.has(p)) { pm.picked.add(p); this.v.setFlag(p, 4, true); } this.renderPeace(); } }, '+ All we occupy'),
      el('div', { class: 'btn small', onclick: () => { for (const p of pm.provs) if (s.prov[p].claims.includes(s.player) && !pm.picked.has(p)) { pm.picked.add(p); this.v.setFlag(p, 4, true); } this.renderPeace(); } }, '+ All we claim'),
      el('div', { class: 'btn small', onclick: () => { for (const p of pm.picked) this.v.setFlag(p, 4, false); pm.picked.clear(); this.renderPeace(); } }, 'Clear'));
    pb.append(quick);
    pb.append(el('div', { class: 'section' }, `Provinces demanded (${pm.picked.size})`));
    if (!pm.picked.size) pb.append(el('div', { class: 'small muted' }, 'None yet. Click enemy land on the map.'));
    for (const p of pm.picked) {
      const cost = g.demandCost(w, pm.side, { type: 'province', p, to: s.player });
      const occ = ours.includes(s.prov[p].controller);
      const r = el('div', { class: 'row small', style: { padding: '2px 0' } },
        el('span', { class: 'grow', style: { cursor: 'pointer' }, onclick: () => this.v.flyToProvince(p, 160) }, `${this.v.map.provinces[p].name} (dev ${s.prov[p].dev})`),
        occ ? el('span', { class: 'chip good' }, 'occupied') : null,
        el('span', { style: { width: '34px', textAlign: 'right' } }, cost),
        el('span', { class: 'x', onclick: () => this.togglePeaceProv(p) }, '✕'));
      pb.append(r);
    }
    pb.append(el('div', { class: 'section' }, 'Other terms'));
    const gl = el('span', { class: 'small' }, `${pm.gold} gold`);
    pb.append(el('div', { class: 'row' }, el('span', { class: 'small' }, '🪙 Reparations'), el('input', { type: 'range', id: 'peace-gold', min: 0, max: 400, step: 25, value: pm.gold, oninput: (e) => { pm.gold = +e.target.value; gl.textContent = pm.gold + ' gold'; }, onchange: () => this.renderPeace() }), gl));
    const leaderE = pm.side === 'att' ? w.defLeader : w.attLeader;
    pb.append(el('label', { class: 'row small' }, el('input', { type: 'checkbox', id: 'peace-vassal', checked: pm.vassal ? 'checked' : null, onchange: (e) => { pm.vassal = e.target.checked; this.renderPeace(); } }), `Make ${s.nations[leaderE].name} our vassal`));
    pb.append(el('label', { class: 'row small' }, el('input', { type: 'checkbox', id: 'peace-humiliate', checked: pm.humiliate ? 'checked' : null, onchange: (e) => { pm.humiliate = e.target.checked; this.renderPeace(); } }), 'Humiliate them (+30 prestige)'));
    const foot = el('div', { class: 'row wrap', style: { marginTop: '10px' } });
    foot.append(el('div', { class: 'btn primary' + (acc.will >= 0 ? '' : ' disabled'), onclick: () => {
      if (acc.will < 0) { this.toast('Peace refused', 'They reject these terms.', '🚫'); return; }
      g.makePeace(w, pm.side, demands); this.endPeace(); this.toast('Peace', 'The treaty is sealed.', '🕊');
    } }, '🕊 Send peace offer'));
    foot.append(el('div', { class: 'btn', onclick: () => {
      const theirSide = pm.side === 'att' ? 'def' : 'att';
      const leader = s.nations[pm.side === 'att' ? w.defLeader : w.attLeader];
      const tscore = theirSide === 'att' ? w.score : -w.score;
      const D = [];
      let budget = Math.max(0, tscore);
      for (const p of g.ownedProvinces(s.player)) if ((theirSide === 'att' ? w.att : w.def).includes(s.prov[p].controller)) { const d1 = { type: 'province', p, to: leader.id }; const c = g.demandCost(w, theirSide, d1); if (c <= budget) { D.push(d1); budget -= c; } }
      this.confirm('Accept their terms', `${leader.name} would make peace for: ${D.length ? D.map((x) => describeDemand(g, x)).join(', ') : 'a white peace'}.`, () => { g.makePeace(w, theirSide, D); this.endPeace(); });
    } }, 'Ask their terms'));
    foot.append(el('div', { class: 'btn', onclick: () => this.endPeace() }, 'Cancel'));
    pb.append(foot);
  },
};
