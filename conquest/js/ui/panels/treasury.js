// Treasury panel: clearly priced ways to spend gold, each with its benefit.
import { el, fmt } from '../../util.js';
import { registerPanel } from './registry.js';
import { H } from './common.js';

registerPanel({ id: 'treasury', icon: '🏦', name: 'Treasury', key: 't', order: 75, render(ui, pb) {
  const g = ui.g, n = ui.P;
  pb.append(H(`<div class="card hl"><div class="frame-title" style="font-size:16px">🪙 ${fmt(n.gold)} gold</div><div class="muted small">Spend it on projects that pay back in prestige, loyalty, research, manpower or development.</div></div>`));
  for (const pr of g.projectList(n.id)) {
    const row = el('div', { class: 'row', style: { alignItems: 'center', margin: '6px 0' } },
      el('span', { style: { width: '28px', fontSize: '20px' } }, pr.icon),
      el('div', { class: 'grow' }, el('div', {}, pr.name), el('div', { class: 'muted small' }, pr.tip)),
      el('div', { class: 'btn small' + (pr.affordable && !pr.cooldown ? ' primary' : ''), onclick: () => { const r = g.doProject(n.id, pr.id); if (r) ui.toast('Treasury', r, '🚫'); ui.renderPanel(true); ui.updateTopbar?.(); } }, pr.cooldown ? `${pr.cooldown} mo` : `${pr.cost} 🪙`));
    pb.append(row);
  }
} });
