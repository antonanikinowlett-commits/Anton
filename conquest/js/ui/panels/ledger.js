// Ledger panel: Great powers table and the chronicle of Europe.
import { el, fmt, dateStr } from '../../util.js';
import { coaSVG } from '../heraldry.js';
import { registerPanel } from './registry.js';
import { H, subtabs } from './common.js';

registerPanel({ id: 'ledger', icon: '📊', name: 'Ledger', key: 'n', order: 90, render(ui, pb) {
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
} });
