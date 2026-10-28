// Wars panel: Peace offers, our wars and wars elsewhere.
import { el, signed, dateStr } from '../../util.js';
import { coaSVG } from '../heraldry.js';
import { CB_TYPES } from '../../sim/diplomacy.js';
import { registerPanel } from './registry.js';
import { describeDemand } from './common.js';
import { icon } from '../icons.js';

registerPanel({ id: 'wars', icon: '🔥', name: 'Wars & Peace', key: 'x', order: 80, render(ui, pb) {
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
  if (!mine.length) pb.append(el('div', { class: 'empty', html: `<div class="ic-green">${icon('dove', { size: 46 })}</div><div class="empty-t">The realm is at peace</div><div class="small muted">To start a war, pick a target in Diplomacy. Without a casus belli it costs stability.</div>` }));
  for (const w of mine) pb.append(warCard(ui, w, true));
  const others = Object.values(s.wars).filter((w) => !mine.includes(w));
  if (others.length) {
    pb.append(el('div', { class: 'section' }, 'Wars Elsewhere'));
    for (const w of others.slice(0, 20)) pb.append(warCard(ui, w, false));
  }
} });

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
