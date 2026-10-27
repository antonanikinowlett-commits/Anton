// Trade panel: the nodes of the 13th-century world, who collects there, and our merchants.
import { el, fmt } from '../../util.js';
import { coaSVG } from '../heraldry.js';
import { registerPanel } from './registry.js';
import { H, barHTML } from './common.js';
import { TRADE_NODES } from '../../data/trade.js';

registerPanel({ id: 'trade', icon: '⚓', name: 'Trade', key: 't', order: 85, render(ui, pb) {
  const g = ui.g, n = ui.P, s = g.s, T = s.trade;
  if (!T || !T.nodes) return;
  const slots = g.merchantSlots(n.id), inc = g.tradeIncome(n.id);
  pb.style.padding = '8px';
  pb.append(H(`<div class="card hl"><b>Trade routes: <span class="pos">+${fmt(inc, 1)}</span> gold / month</b>
    <div class="muted small">Goods flow downstream between nodes; each node pays its realms by trade power (ports count double). Merchants: ${n.merchants.length} / ${slots}. A <b>collecting</b> merchant adds power in a node; a <b>steering</b> merchant pushes more of its value downstream.</div>
    ${n.embargoes.length ? `<div class="small neg">We embargo: ${n.embargoes.map((e) => s.nations[e.id].name).join(', ')}</div>` : ''}
    ${s.nations.filter((x) => x.alive && x.embargoes.some((e) => e.id === n.id)).length ? `<div class="small neg">Embargoed by: ${s.nations.filter((x) => x.alive && x.embargoes.some((e) => e.id === n.id)).map((x) => x.name).join(', ')}</div>` : ''}</div>`));
  const rows = TRADE_NODES.map((nd) => [nd, T.nodes[nd.id]]).sort((a, b) => b[1].value - a[1].value);
  for (const [nd, info] of rows) {
    const mine = n.merchants.find((m) => m.node === nd.id), sh = (info.top.find((t) => t[0] === n.id) || [0, 0])[1];
    const card = el('div', { class: 'card', style: { marginTop: '6px', ...(mine ? { borderColor: 'var(--gold)' } : {}) } });
    card.innerHTML = `<div class="row between"><b>${nd.name}</b><span class="muted small">value ${fmt(info.value, 1)}${nd.to ? ' → ' + TRADE_NODES.find((x) => x.id === nd.to).name : ' (end of the road)'}</span></div>
      <div class="muted small">${nd.desc}</div>
      <div class="small">Our share: <b class="${sh > 0.2 ? 'pos' : ''}">${Math.round(sh * 100)}%</b> ${sh > 0 ? `(≈ ${fmt(info.retained * sh, 1)} gold)` : ''}</div>${barHTML(sh, 'green')}
      <div class="row wrap small" style="margin-top:3px">${info.top.slice(0, 4).map(([id, v]) => `<span class="chip">${coaSVG(s.nations[id].coa, 12)} ${s.nations[id].name.replace(/^(Kingdom|Republic|Duchy|County) of /, '')} ${Math.round(v * 100)}%</span>`).join(' ')}</div>`;
    const row = el('div', { class: 'row wrap', style: { marginTop: '4px' } });
    if (mine) {
      row.append(el('span', { class: 'chip' }, mine.mode === 'steer' ? '🧭 Steering' : '💰 Collecting'),
        el('div', { class: 'btn small', onclick: () => { g.setMerchantMode(n.id, nd.id, mine.mode === 'steer' ? 'collect' : 'steer'); ui.renderPanel(true); } }, mine.mode === 'steer' ? 'Collect instead' : 'Steer instead'),
        el('div', { class: 'btn small danger', onclick: () => { g.recallMerchant(n.id, nd.id); ui.renderPanel(true); } }, 'Recall merchant'));
    } else if (n.merchants.length < slots) {
      row.append(...[el('div', { class: 'btn small primary', onclick: () => { const r = g.placeMerchant(n.id, nd.id, 'collect'); if (r) ui.toast('Trade', r, '🚫'); ui.renderPanel(true); } }, 'Send merchant to collect'),
        nd.to ? el('div', { class: 'btn small', onclick: () => { const r = g.placeMerchant(n.id, nd.id, 'steer'); if (r) ui.toast('Trade', r, '🚫'); ui.renderPanel(true); } }, 'Send merchant to steer') : null].filter(Boolean));
    }
    card.append(row);
    pb.append(card);
  }
} });
