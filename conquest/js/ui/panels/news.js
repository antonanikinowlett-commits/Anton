// Chronicle: what the rest of the world is doing (wars, treaties, deaths, coronations), from game.newsFeed().
import { dateStr } from '../../util.js';
import { registerPanel } from './registry.js';
import { H, subtabs } from './common.js';

registerPanel({ id: 'news', icon: '📰', name: 'Chronicle', key: 'h', order: 95, render(ui, pb) {
  const g = ui.g, n = ui.P;
  const [tabs, cur] = subtabs(ui, 'news', [['all', 'All'], ['war', 'Wars'], ['diplomacy', 'Diplomacy'], ['dynasty', 'Dynasties'], ['unrest', 'Unrest'], ['mine', 'Our realm']]);
  pb.append(tabs);
  const opts = { limit: 60 };
  if (cur === 'mine') opts.nation = n.id; else if (cur !== 'all') opts.kinds = [cur];
  const feed = g.newsFeed(opts);
  if (!feed.length) pb.append(H('<p class="muted">Nothing of note has happened yet.</p>'));
  for (const x of feed) pb.append(H(`<div class="small news-item ${x.nations.includes(n.id) ? 'mine' : ''}"><span class="muted">${dateStr(x.day)}</span> ${x.text}</div>`));
} });
