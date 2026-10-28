// Outliner: collapsible right-side list of armies, fronts, sieges and construction.
// Mixed into UI.prototype (this = the UI).
import { el, fmt } from '../util.js';
import { icon } from './icons.js';

export const OutlinerMixin = {
  buildOutliner() {
    this.outEl = el('div', { id: 'outliner', class: 'frame' });
    this.root.append(this.outEl);
    this._outKey = null;
    this._outOpen = this._outOpen || { Goals: true, Recent: true, Armies: true, Fronts: true, Sieges: true, Construction: true };
    if (this._outCollapsed === undefined) this._outCollapsed = true;
    this.root.classList.toggle('out-closed', !!this._outCollapsed);
  },
  outlinerData() {
    const g = this.g, s = this.s, n = this.P, nid = n.id, pn = (p) => g.provName(p);
    const fronted = new Set();
    const fronts = g.frontsOf ? g.frontsOf(nid) : [];
    for (const f of fronts) for (const i of f.armies) fronted.add(i);
    const armies = g.armiesOf(nid).map((a) => {
      const st = a.battle ? ['⚔', 'battle'] : s.prov[a.loc]?.siege?.by === nid && !a.path.length ? ['🏰', 'siege'] : a.path.length ? ['➜', 'moving'] : fronted.has(a.id) ? ['🛡', 'front'] : ['💤', 'idle'];
      return { id: a.id, icon: st[0], st: st[1], name: a.name, men: g.armyMen(a), loc: a.loc, where: pn(a.loc) };
    });
    const frs = fronts.map((f) => ({ id: f.id, name: s.nations[f.enemy].name, mode: f.mode, n: f.armies.length, enemy: f.enemy }));
    const sieges = [];
    for (let p = 0; p < s.prov.length; p++) {
      const pr = s.prov[p];
      if (!pr.siege) continue;
      if (pr.siege.by === nid) sieges.push({ p, ours: true, name: pn(p), prog: pr.siege.prog });
      else if (pr.owner === nid) sieges.push({ p, ours: false, name: pn(p), prog: pr.siege.prog });
    }
    const cons = [];
    for (const r of s.recruit) if (r.nation === nid) cons.push({ p: r.prov, icon: '⚔', name: `Muster: ${r.template.name}`, left: Math.ceil(r.days), where: pn(r.prov) });
    for (const p of g.ownedProvinces(nid)) for (const q of s.prov[p].queue) cons.push({ p, icon: '🔨', name: String(q.type), left: Math.ceil(q.days), where: pn(p) });
    const goals = [], pg = n.prog;
    if (pg) {
      const am = g.ambitionProgress(nid), ri = g.rankInfo(nid);
      if (am) goals.push({ icon: am.def.icon, label: am.def.name, right: `${Math.min(am.value, am.goal)}/${am.goal} · ${Math.max(0, Math.round(am.daysLeft / 30))}mo`, tab: 'progress' });
      else goals.push({ icon: '🎯', label: pg.ambCool > 0 ? 'Ambition: court is resting' : 'Choose an ambition', right: pg.ambCool > 0 ? `${pg.ambCool}mo` : 'prestige reward', tab: 'progress', hot: pg.ambCool <= 0 });
      if (!ri.maxed) goals.push({ icon: '👑', label: ri.ok ? `Crown the ${ri.next}!` : `Reach ${ri.next}`, right: ri.ok ? 'ready' : ri.checks.map((c) => `${c[0].slice(0, 4)} ${c[1]}/${c[2]}`).join(' · '), tab: 'progress', hot: ri.ok });
      goals.push({ icon: '🏆', label: 'Score', right: String(g.nationScore(nid)), tab: 'progress' });
    }
    return { armies, frs, sieges, cons, goals, recent: (this.recent || []).slice(0, 6) };
  },
  updateOutliner() {
    if (!this.outEl || !this.P) return;
    const D = this.outlinerData();
    const key = JSON.stringify([D.goals, D.recent.map((r) => r.day + r.text), D.armies.map((a) => [a.id, a.st, a.loc, Math.round(a.men / 10)]), D.frs.map((f) => [f.id, f.n, f.mode]), D.sieges.map((x) => [x.p, x.ours, Math.floor(x.prog)]), D.cons.map((c) => [c.name, c.left, c.p]), this._outOpen, this._outCollapsed, this.selArmies]);
    if (key === this._outKey) return;
    this._outKey = key;
    const E = this.outEl;
    E.innerHTML = '';
    E.classList.toggle('collapsed', !!this._outCollapsed);
    this.root.classList.toggle('out-closed', !!this._outCollapsed);
    const chip = (ic, n) => (n ? `<span>${icon(ic)}${n}</span>` : '');
    const head = el('div', { class: 'ph', onclick: () => { this._outCollapsed = !this._outCollapsed; this._outKey = null; this.updateOutliner(); this.sfx?.('click'); } },
      el('div', { class: 'frame-title' }, 'Outliner'),
      el('div', { class: 'oc', html: this._outCollapsed ? chip('swords', D.armies.length) + chip('shield', D.frs.length) + chip('castle', D.sieges.length) + chip('hammer', D.cons.length) : '' }),
      el('span', { class: 'x', html: icon(this._outCollapsed ? 'chevd' : 'chevu') }));
    E.append(head);
    if (this._outCollapsed) return;
    const body = el('div', { class: 'ob scroll' });
    const sec = (name, count, rows) => {
      const open = this._outOpen[name];
      body.append(el('div', { class: 'osec', onclick: () => { this._outOpen[name] = !open; this._outKey = null; this.updateOutliner(); } }, el('span', { html: icon(open ? 'chevd' : 'chevr'), style: { width: '12px', display: 'inline-flex' } }), name, el('span', { class: 'muted' }, ' ' + count)));
      if (open) for (const r of rows) body.append(r);
    };
    const row = (icon, label, right, fn, cls = '') => el('div', { class: 'orow ' + cls, onclick: fn }, el('span', { class: 'oi' }, icon), el('span', { class: 'grow' }, label), el('span', { class: 'muted small' }, right));
    if (D.goals.length) sec('Goals', '', D.goals.map((x) => row(x.icon, x.label, x.right, () => this.openTab(x.tab), x.hot ? 'idle' : '')));
    if (D.recent.length) sec('Recent', '', D.recent.map((r) => row(r.icon || '•', r.text, String(Math.floor(r.day / 365) + 1200), () => {}, 'muted')));
    sec('Armies', D.armies.length, D.armies.map((a) => row(a.icon, a.name, `${fmt(a.men)} · ${a.where}`, () => this.selectArmies([a.id], true), (a.st === 'idle' ? 'idle ' : '') + (this.selArmies.includes(a.id) ? 'sel' : ''))));
    sec('Fronts', D.frs.length, D.frs.map((f) => row('🛡', `vs ${f.name}`, `${f.n} armies · ${f.mode}`, () => this.openTab('military'))));
    sec('Sieges', D.sieges.length, D.sieges.map((x) => row(x.ours ? '🏰' : '🔥', x.name, x.ours ? `besieging ${Math.floor(x.prog)}%` : 'under siege', () => { this.selectProvince(x.p); this.v.flyToProvince(x.p); }, x.ours ? '' : 'bad')));
    sec('Construction', D.cons.length, D.cons.map((c) => row(c.icon, c.name, `${c.left}d · ${c.where}`, () => { this.selectProvince(c.p); this.v.flyToProvince(c.p); })));
    E.append(body);
  },
};
