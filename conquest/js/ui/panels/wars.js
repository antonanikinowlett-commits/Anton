// Wars panel: Peace offers, our wars and wars elsewhere.
import { el, signed, dateStr } from '../../util.js';
import { coaSVG } from '../heraldry.js';
import { CB_TYPES } from '../../sim/diplomacy.js';
import { registerPanel } from './registry.js';
import { describeDemand } from './common.js';

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
  if (!mine.length) pb.append(el('div', { class: 'small muted' }, 'The realm is at peace. To start a war, pick a target in Diplomacy; you need a casus belli to avoid stability penalties.'));
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
    d.append(warDashboard(ui, w));
  }
  return d;
}

// Progress dashboard: goals, score breakdown, milestones, forces, the war log and advice.
function warDashboard(ui, w) {
  const g = ui.g, n = ui.P, st = g.warStatus(w.id, n.id);
  const box = el('div', { class: 'war-dashboard', style: { marginTop: '6px' } });
  if (!st) return box;
  const lines = [];
  lines.push(`<div class="small"><b>Milestones</b> ${st.milestones.map((m) => `<span class="chip ${m.reached ? 'good' : ''}" data-tip="War score ${m.at}">${m.reached ? '✔' : '○'} ${m.name} ${m.at}</span>`).join(' ')}</div>`);
  if (st.goals.length) lines.push(`<div class="small"><b>War goals</b> ${st.goalsTaken}/${st.goals.length}: ${st.goals.map((x) => `<span class="chip ${x.state === 'enemy' ? '' : 'good'}" data-tip="${x.state}">${x.state === 'taken' ? '✔' : x.state === 'occupied' ? '⚑' : x.state === 'besieged' ? '⚔' : '○'} ${x.name}</span>`).join(' ')}</div>`);
  const f = (l) => l.filter((x) => Math.abs(x.value) >= 0.5).map((x) => `${x.label} ${x.value > 0 ? '+' : ''}${x.value}`).join(' · ');
  lines.push(`<div class="tiny muted">Score from: ${f(st.scoreParts.mine) || 'nothing yet'}${f(st.scoreParts.theirs) ? ` — against us: ${f(st.scoreParts.theirs)}` : ''}${st.exhaustionEffect ? ` · war weariness ${st.exhaustionEffect > 0 ? '+' : ''}${st.exhaustionEffect}` : ''}</div>`);
  lines.push(`<div class="small">Forces: ${st.strength.usMen.toLocaleString()} men vs ${st.strength.themMen.toLocaleString()} (power ${Math.round(st.strength.ratio * 100)}%) · losses ${st.casualties.ours.toLocaleString()} / ${st.casualties.theirs.toLocaleString()} · we hold ${st.occupied.byUs.length}, they hold ${st.occupied.byThem.length} provinces</div>`);
  if (st.peace) lines.push(`<div class="small ${st.peace.willing ? 'pos' : 'neg'}">🕊 ${st.peace.label}</div>`);
  for (const a of st.advice) lines.push(`<div class="small ${a.tone === 'bad' ? 'neg' : a.tone === 'good' ? 'pos' : ''}">▸ ${a.text}</div>`);
  if (st.notes.length) lines.push(`<div class="tiny muted">${st.notes.slice(0, 5).map((x) => `${dateStr(x.day)}: ${x.text}`).join('<br>')}</div>`);
  box.innerHTML = lines.join('');
  return box;
}
