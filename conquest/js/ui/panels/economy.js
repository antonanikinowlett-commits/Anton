// Economy panel: Budget, resources, merchants, buildings and construction.
import { el, fmt, signed, pct } from '../../util.js';
import { BUILDINGS, BUILDING_ORDER } from '../../data/buildings.js';
import { registerPanel } from './registry.js';
import { H, barHTML } from './common.js';

registerPanel({ id: 'economy', icon: '💰', name: 'Economy', key: 'b', order: 70, render(ui, pb) {
  const g = ui.g, n = ui.P, s = g.s, B = g.budget(n.id);
  pb.append(el('div', { class: 'section' }, 'Monthly Budget'));
  const max = Math.max(B.income, B.expense, 1);
  const line = (k, v, cls) => `<div class="row small"><span style="width:130px">${k}</span><div class="grow bar ${cls}"><i style="width:${Math.abs(v) / max * 100}%"></i></div><span style="width:56px;text-align:right" class="${v < 0 ? 'neg' : 'pos'}">${signed(v, 1)}</span></div>`;
  pb.append(H(line('Taxes', B.tax, 'green') + line('Trade', B.trade, 'green') + (B.nodes ? line('Trade routes', B.nodes, 'green') : '') + line('Mines', B.mines, 'green') + (B.tribute ? line('Tribute', B.tribute, B.tribute > 0 ? 'green' : 'red') : '') +
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
} });
