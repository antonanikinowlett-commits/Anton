// Laws panel: Laws by category, the estates' vote, propose/decree.
import { el, signed } from '../../util.js';
import { LAWS, LAW_ORDER, ESTATE_ICONS } from '../../data/government.js';
import { registerPanel } from './registry.js';
import { H, barHTML, estName } from './common.js';

registerPanel({ id: 'laws', icon: '📜', name: 'Laws', key: 'l', order: 30, render(ui, pb) {
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
} });

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
