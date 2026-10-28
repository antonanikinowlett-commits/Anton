// Treasury panel: clearly priced ways to spend gold, each with its benefit.
import { el, fmt } from '../../util.js';
import { icon, iconFor } from '../icons.js';
import { registerPanel } from './registry.js';
import { H } from './common.js';

registerPanel({ id: 'treasury', icon: '🏦', name: 'Treasury', key: 't', order: 75, render(ui, pb) {
  const g = ui.g, n = ui.P;
  const B = g.budget(n.id);
  pb.append(H(`<div class="card hl"><div class="row"><span class="ic-gold">${icon('coin', { size: 34 })}</span><div class="grow"><div class="tag">In the treasury</div><div style="font-family:var(--display);font-size:34px;font-weight:700;line-height:1">${fmt(n.gold)} <span class="small ${B.net < 0 ? 'neg' : 'pos'}" style="font-family:var(--ui);font-weight:600">${B.net >= 0 ? '+' : ''}${B.net.toFixed(1)} / month</span></div></div></div>
    <div class="small muted" style="margin-top:6px">Spend it on projects that pay back in prestige, loyalty, research, manpower or development. A full treasury does nothing for you.</div></div>`));
  pb.append(el('div', { class: 'section' }, 'Projects'));
  const col = el('div', { class: 'col', style: { gap: '8px' } });
  for (const pr of g.projectList(n.id)) {
    const can = pr.affordable && !pr.cooldown;
    const card = el('div', { class: 'card', style: { display: 'flex', gap: '12px', alignItems: 'center', opacity: can ? 1 : 0.7 } },
      el('div', { class: 'tn-ic ic-gold', style: { width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(232,197,109,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontSize: '22px' }, html: iconFor(pr.icon, { size: 22 }) }),
      el('div', { class: 'grow' }, el('div', { style: { fontFamily: 'var(--display)', fontWeight: 700, fontSize: '19px', lineHeight: 1.1 } }, pr.name), el('div', { class: 'muted small' }, pr.tip)),
      el('div', { class: 'btn' + (can ? ' primary' : ''), style: { minWidth: '78px' }, onclick: () => { const r = g.doProject(n.id, pr.id); if (r) { ui.toast('Treasury', r, '🚫'); ui.sfx('error'); } else ui.sfx('coin'); ui.renderPanel(true); ui.updateTopbar?.(); } },
        pr.cooldown ? `${pr.cooldown} mo` : el('span', { html: `${pr.cost} ${icon('coin')}` })));
    col.append(card);
  }
  pb.append(col);
} });
