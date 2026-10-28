// Focus panel: National focus tree with a detail sidebar.
import { el } from '../../util.js';
import { registerPanel } from './registry.js';
import { H, barHTML } from './common.js';

registerPanel({ id: 'focus', icon: '🎯', name: 'National Focus', key: 'f', order: 40, wide: true, render(ui, pb) {
  const g = ui.g, n = ui.P;
  pb.style.display = 'flex'; pb.style.gap = '10px'; pb.style.padding = '8px'; pb.style.overflow = 'hidden';
  const tree = g.focusTree(n.id);
  const wrap = el('div', { class: 'ftree scroll', style: { flex: '1' } });
  const X = (x) => 20 + x * 128, Y = (y) => 40 + y * 116;
  const maxX = Math.max(...tree.map((f) => f.x)), maxY = Math.max(...tree.map((f) => f.y));
  const inner = el('div', { style: { position: 'relative', width: X(maxX) + 140 + 'px', height: Y(maxY) + 110 + 'px' } });
  const svgW = X(maxX) + 140, svgH = Y(maxY) + 110;
  let lines = '';
  const byId = Object.fromEntries(tree.map((f) => [f.id, f]));
  for (const f of tree) {
    for (const grp of f.pre) for (const pid of grp) {
      const p = byId[pid];
      if (!p) continue;
      const done = n.focus.done.includes(pid);
      lines += `<path d="M${X(p.x) + 56},${Y(p.y) + 84} C${X(p.x) + 56},${Y(p.y) + 100} ${X(f.x) + 56},${Y(f.y) - 16} ${X(f.x) + 56},${Y(f.y)}" stroke="${done ? '#8ac060' : '#8a7550'}" stroke-width="2.5" fill="none" ${grp.length > 1 ? 'stroke-dasharray="6 4"' : ''}/>`;
    }
    for (const e of f.excl) {
      const o = byId[e];
      if (o && o.y === f.y && o.x > f.x) lines += `<path d="M${X(f.x) + 114},${Y(f.y) + 42} L${X(o.x) - 2},${Y(o.y) + 42}" stroke="#c84a3a" stroke-width="2" stroke-dasharray="3 3"/><text x="${(X(f.x) + 114 + X(o.x)) / 2}" y="${Y(f.y) + 38}" fill="#e87a6a" font-size="14" text-anchor="middle">⟷</text>`;
    }
  }
  inner.append(H(`<svg class="fsvg" width="${svgW}" height="${svgH}">${lines}</svg>`).firstChild);
  const branches = [[0, 'Economy'], [4, 'Military'], [8, 'Diplomacy'], [12, 'Faith'], [16, 'Government'], [20, 'National']];
  for (const [x, nm] of branches) if (tree.some((f) => f.x >= x && f.x < x + 4)) inner.append(el('div', { class: 'fbranch', style: { left: X(x) + 'px', top: '10px' } }, nm));
  const selId = ui.state.focusSel || n.focus.cur || tree.find((f) => g.focusStatus(n.id, f) === 'available')?.id;
  for (const f of tree) {
    const st = g.focusStatus(n.id, f);
    const node = el('div', { class: `fnode ${st} ${f.id === selId ? 'sel' : ''}`, style: { left: X(f.x) + 'px', top: Y(f.y) + 'px' }, onclick: () => { ui.state.focusSel = f.id; ui.renderPanel(true); },
      ondblclick: () => { const r = g.startFocus(n.id, f.id); if (r) ui.toast('Focus', r, '🚫'); ui.renderPanel(true); } },
      el('div', { class: 'fi' }, f.icon), el('div', { class: 'fn' }, f.name), st === 'active' ? el('div', { class: 'fprog' }, el('i', { style: { width: `${n.focus.prog / f.days * 100}%` } })) : null);
    node._tip = () => `<b>${f.name}</b><br>${g.describeEffects(f.effects).join('<br>')}<br><span class="muted small">${st} · double-click to start</span>`;
    inner.append(node);
  }
  wrap.append(inner);
  // detail sidebar
  const side = el('div', { class: 'col', style: { width: '300px', flexShrink: 0 } });
  if (n.focus.cur) {
    const f = byId[n.focus.cur];
    side.append(H(`<div class="card hl"><div class="tag">Current focus</div><b>${f.icon} ${f.name}</b>${barHTML(n.focus.prog / f.days)}<div class="small muted">${Math.ceil((f.days - n.focus.prog) / (1 + g.mod(n.id, 'focusSpeed')))} days remaining</div></div>`));
  }
  const f = byId[selId];
  if (f) {
    const st = g.focusStatus(n.id, f);
    const d = el('div', { class: 'card' });
    d.innerHTML = `<div style="font-size:42px;text-align:center">${f.icon}</div><div class="pname" style="text-align:center;font-size:17px">${f.name}</div><div class="small muted" style="text-align:center">${f.days} days · ${f.cost} gold · ${st}</div>
      <p class="small" style="font-style:italic">${f.desc || ''}</p><div class="section">Effects</div><div class="small">${g.describeEffects(f.effects).map((x) => '• ' + x).join('<br>')}</div>
      ${f.pre.length ? `<div class="section">Requires</div><div class="small">${f.pre.map((grp) => grp.map((x) => `<span class="${n.focus.done.includes(x) ? 'pos' : 'neg'}">${byId[x]?.name || x}</span>`).join(' or ')).join('<br>and ')}</div>` : ''}
      ${f.excl.length ? `<div class="section">Mutually exclusive with</div><div class="small neg">${f.excl.map((x) => byId[x]?.name || x).join(', ')}</div>` : ''}
      ${f.req?.provinces ? `<div class="small">Requires ${f.req.provinces} provinces</div>` : ''}`;
    const row = el('div', { class: 'row', style: { marginTop: '8px' } });
    if (st === 'available') row.append(el('div', { class: 'btn primary', onclick: () => { const r = g.startFocus(n.id, f.id); if (r) ui.toast('Focus', r, '🚫'); ui.renderPanel(true); } }, n.focus.cur ? 'Busy…' : '▶ Start focus'));
    if (st === 'active') row.append(el('div', { class: 'btn danger', onclick: () => { g.cancelFocus(n.id); ui.renderPanel(true); } }, 'Cancel'));
    d.append(row);
    side.append(d);
  }
  side.append(el('div', { class: 'tiny muted' }, 'Solid lines: all prerequisites needed. Dashed: any one. Red ⟷: choosing one locks the other. Each realm\'s tree is assembled from its government, faith, rivals and history.'));
  pb.append(wrap, side);
} });
