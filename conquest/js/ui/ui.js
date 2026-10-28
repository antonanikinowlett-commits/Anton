// UI shell: tab bar and side panel, map modes & minimap, tooltips, toasts, modals, keys,
// selection and event wiring. The other parts are mixins in sibling modules (topbar, alerts,
// province, army, peace, menu); panel contents live in ./panels/*.js.
import { el } from '../util.js';
import { icon, iconize, ICONS, icon as svgIcon } from './icons.js';
import { installEmojiPatch } from './emoji_patch.js';
import { sfx } from './sfx.js';
import { coaSVG } from './heraldry.js';
import { PANELS, TABS } from './panels.js';
import { BattleViewer } from './battleview.js';
import { ci } from '../render/map3d.js';
import { TopbarMixin } from './topbar.js';
import { AlertsMixin } from './alerts.js';
import { ProvinceMixin } from './province.js';
import { ArmyMixin } from './army.js';
import { PeaceMixin } from './peace.js';
import { MenuMixin } from './menu.js';
import { OutlinerMixin } from './outliner.js';
export { TABS } from './panels.js';
export { terrainTip, unitTip } from './tips.js';

const MODES = [
  ['political', 'map', 'Political', 'Realms and borders'], ['terrain', 'mountain', 'Terrain', 'Relief without political colour'], ['terrainType', 'tree', 'Combat terrain', 'Terrain types and their battle modifiers'],
  ['diplomacy', 'handshake', 'Diplomacy', 'Allies, enemies and opinion of you'], ['religion', 'cross', 'Religion', 'Faith of every province'], ['culture', 'people', 'Culture', 'Cultural groups'],
  ['development', 'houses', 'Development', 'Size and wealth of provinces'], ['supply', 'wheat', 'Supply limit', 'How many troops the land can feed'],
  ['attrition', 'skull', 'Attrition risk', 'Green: safe. Red: armies bleed men (winter, desert, famine, poor supply; open sea)'], ['fort', 'castle', 'Forts', 'Fortification levels'], ['unrest', 'flame', 'Unrest', 'Revolt risk'],
];
// Dock: panels are grouped; the rail shows one button per group and the panel header shows the group's tabs.
const GROUPS = [
  { id: 'gov', name: 'Realm', icon: 'crown', panels: ['realm', 'court', 'laws', 'focus'] },
  { id: 'mil', name: 'Military', icon: 'swords', panels: ['military'] },
  { id: 'eco', name: 'Economy', icon: 'coin', panels: ['economy', 'trade', 'treasury', 'ledger'] },
  { id: 'dip', name: 'Diplomacy', icon: 'handshake', panels: ['diplomacy', 'wars'] },
  { id: 'prog', name: 'Progress', icon: 'book', panels: ['progress'] },
];
const PANEL_ICON = { realm: 'crown', court: 'pillars', laws: 'scroll', focus: 'target', diplomacy: 'handshake', wars: 'flame', progress: 'book', military: 'swords', economy: 'bag', trade: 'anchor', treasury: 'bank', ledger: 'chart' };
const groupOf = (id) => GROUPS.find((g) => g.panels.includes(id)) || { id: 'x', name: 'Other', icon: 'grid', panels: [id] };
export const SPEEDS = [0, 0.7, 1.5, 3, 6, 14]; // days per second

export class UI {
  constructor(root, game, view) {
    this.root = root; this.g = game; this.v = view;
    this.tab = null;
    this.speed = 0; this.lastSpeed = 2;
    this.selProv = -1; this.selArmies = [];
    this.subtab = {};
    this.state = {};
    this.listeners = {};
    this.battleViewer = new BattleViewer(this);
  }
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  sfx(name) { sfx.play(name); }
  emit(ev, ...a) { for (const f of this.listeners[ev] || []) f(...a); }
  get s() { return this.g.s; }
  get P() { return this.g.player; }

  build() {
    installEmojiPatch();
    const R = this.root;
    R.innerHTML = '';
    this.topbar = el('div', { id: 'topbar' }); R.append(this.topbar);
    this.alerts = el('div', { id: 'alerts' }); R.append(this.alerts);
    this.tabsEl = el('div', { id: 'tabs' }); R.append(this.tabsEl);
    this.panel = el('div', { id: 'panel', class: 'frame hidden' }); R.append(this.panel);
    this.provEl = el('div', { id: 'prov', class: 'frame hidden' }); R.append(this.provEl);
    this.armyEl = el('div', { id: 'army', class: 'frame hidden' }); R.append(this.armyEl);
    this.modesEl = el('div', { id: 'modes' }); R.append(this.modesEl);
    this.toasts = el('div', { id: 'toasts' }); R.append(this.toasts);
    if (!document.getElementById('banners')) document.body.append(el('div', { id: 'banners' }));
    this.buildOutliner();
    this.buildTopbar(); this.buildTabs(); this.buildModes();
    this.setupTooltips(); this.setupKeys(); this.hook(); this.setupSounds();
  }

  // click feedback on every interactive chrome element, plus a context unlock for WebAudio
  setupSounds() {
    if (this._soundsOn) return;
    this._soundsOn = true;
    const CLICKABLE = '.btn, .tab, .gtab, .subtab, .mode, .modebtn, .card.click, .lawopt, .bslot, .nitem, .tech-node, .fnode, .res-item.more, .alert, .x, .reg, .orow, .osec, .playbtn, .speeds .sp';
    document.addEventListener('pointerdown', (e) => {
      sfx.unlock();
      const t = e.target.closest && e.target.closest(CLICKABLE);
      if (!t || t.classList.contains('disabled') || t.hasAttribute('disabled')) return;
      sfx.play(t.classList.contains('tab') || t.classList.contains('gtab') ? 'panel' : 'click');
    }, true);
  }


  // ── dock & side panel
  buildTabs() {
    this.tabsEl.innerHTML = '';
    const present = new Set(TABS.map((t) => t.id));
    const known = new Set(GROUPS.flatMap((g) => g.panels));
    const groups = GROUPS.map((g) => ({ ...g, panels: g.panels.filter((p) => present.has(p)) })).filter((g) => g.panels.length);
    const extra = TABS.filter((t) => !known.has(t.id));
    if (extra.length) groups.push({ id: 'more', name: 'More', icon: 'grid', panels: extra.map((t) => t.id) });
    this.groups = groups;
    for (const g of groups) {
      const keys = g.panels.map((id) => TABS.find((t) => t.id === id).key.toUpperCase()).join(' ');
      const e = el('div', { class: 'tab', id: 'grp-' + g.id, onclick: () => {
        const cur = this.tab && g.panels.includes(this.tab);
        this.openTab(cur ? null : (this._lastInGroup?.[g.id] && g.panels.includes(this._lastInGroup[g.id]) ? this._lastInGroup[g.id] : g.panels[0]));
      } }, el('span', { html: icon(g.icon) }), el('span', { class: 'lbl' }, g.name));
      e._tip = () => `<div class="tt-title">${g.name}</div><span class="muted">${g.panels.map((id) => PANELS[id].name + ' <b>' + PANELS[id].key.toUpperCase() + '</b>').join('<br>')}</span>`;
      void keys;
      this.tabsEl.append(e);
    }
  }
  // selector of the control that opens a panel: its tab in the open panel's header, else the dock button of its group
  tabTarget(id) {
    if (this.panel && !this.panel.classList.contains('hidden') && this.panel.querySelector('#tab-' + id)) return '#panel #tab-' + id;
    const g = (this.groups || []).find((x) => x.panels.includes(id));
    return g ? '#grp-' + g.id : '#tabs';
  }
  openTab(id) {
    this.tab = id;
    const grp = id ? groupOf(id) : null;
    if (grp) (this._lastInGroup ||= {})[grp.id] = id;
    for (const e of this.tabsEl.children) e.classList.toggle('on', !!grp && e.id === 'grp-' + grp.id);
    if (!id) { this.panel.classList.add('hidden'); this.provEl.classList.remove('shift'); this.emit('tab', null); return; }
    const first = this.panel.classList.contains('hidden');
    this.panel.classList.remove('hidden');
    if (first) { this.panel.style.animation = 'none'; void this.panel.offsetWidth; this.panel.style.animation = ''; }
    this.renderPanel(true);
    this.emit('tab', id);
  }
  renderPanel(force = false) {
    if (!this.tab) return;
    const P = PANELS[this.tab];
    const wide = !!P.wide;
    this.panel.classList.toggle('wide', wide);
    this.provEl.classList.toggle('shift', !wide && !this.provEl.classList.contains('hidden'));
    if (!force && P.static) return;
    const body = this.panel.querySelector('.pb');
    const sc = body ? body.scrollTop : 0;
    this.panel.innerHTML = '';
    const tdef = TABS.find((t) => t.id === this.tab);
    const grp = (this.groups || []).find((g) => g.panels.includes(this.tab));
    const ph = el('div', { class: 'ph' }, el('div', { class: 'top' },
      el('div', { class: 'frame-title' }, el('span', { html: icon(PANEL_ICON[this.tab] || 'grid') }), tdef.name),
      el('span', { class: 'x', onclick: () => this.openTab(null), html: icon('x') })));
    if (grp && grp.panels.length > 1) {
      const gt = el('div', { class: 'grouptabs' });
      for (const id of grp.panels) {
        const d = PANELS[id];
        gt.append(el('div', { class: 'gtab' + (id === this.tab ? ' on' : ''), id: 'tab-' + id, onclick: () => this.openTab(id) }, el('span', { html: icon(PANEL_ICON[id] || 'grid') }), d.name.replace(/ & .*/, '')));
      }
      ph.append(gt);
    } else ph.append(el('div', { style: { height: '12px' } }));
    this.panel.append(ph);
    const pb = el('div', { class: 'pb scroll' });
    this.panel.append(pb);
    P.render(this, pb);
    pb.scrollTop = sc;
    this.refreshTabDots();
  }
  // alerts.js tells us which panels want attention
  setTabDots(set) { this._dotPanels = set; this.refreshTabDots(); }
  refreshTabDots() {
    const set = this._dotPanels || new Set();
    for (const g of this.groups || []) {
      const e = this.tabsEl.querySelector('#grp-' + g.id);
      if (!e) continue;
      const on = g.panels.some((p) => set.has(p)), d = e.querySelector('.dot');
      if (on && !d) e.append(el('span', { class: 'dot' })); else if (!on && d) d.remove();
    }
    for (const t of TABS) {
      const e = this.panel.querySelector('#tab-' + t.id);
      if (!e) continue;
      const on = set.has(t.id), d = e.querySelector('.dot');
      if (on && !d) e.append(el('span', { class: 'dot' })); else if (!on && d) d.remove();
    }
  }

  // ── map modes & minimap
  buildModes() {
    const cur = () => MODES.find((m) => m[0] === this.v.mode) || MODES[0];
    this.modeBtn = el('div', { class: 'modebtn frame', id: 'modebtn', onclick: (e) => { e.stopPropagation(); this.toggleModeMenu(); } });
    const paint = () => { const m = cur(); this.modeBtn.innerHTML = `${icon(m[1])}<span>${m[2]}</span>${icon('chevu')}`; };
    paint();
    this.v.on('mode', () => { paint(); if (this.modeMenu) this.toggleModeMenu(false); });
    this.modeBtn._tip = () => 'Change what the map shows';
    this.mm = el('canvas', { id: 'minimap', width: 204, height: 150 });
    const wrap = el('div', { class: 'frame mm-wrap' }, this.mm);
    this.modesEl.append(this.modeBtn, wrap);
    this._modesDoc = () => this.toggleModeMenu(false);
    document.addEventListener('pointerdown', (e) => { if (this.modeMenu && !this.modeMenu.contains(e.target) && !this.modeBtn.contains(e.target)) this.toggleModeMenu(false); });
    const go = (e) => {
      const r = this.mm.getBoundingClientRect();
      this.v.flyTo((e.clientX - r.left) / r.width * this.v.map.W, (e.clientY - r.top) / r.height * this.v.map.H);
    };
    let down = false;
    this.mm.addEventListener('pointerdown', (e) => { down = true; go(e); });
    window.addEventListener('pointerup', () => { down = false; });
    this.mm.addEventListener('pointermove', (e) => { if (down) go(e); });
  }
  toggleModeMenu(force) {
    const open = force === undefined ? !this.modeMenu : force;
    if (this.modeMenu) { this.modeMenu.remove(); this.modeMenu = null; }
    if (!open) return;
    const menu = el('div', { class: 'modemenu frame' });
    for (const [id, ic, nm, desc] of MODES) {
      const row = el('div', { class: 'mode' + (id === this.v.mode ? ' on' : ''), onclick: (e) => { e.stopPropagation(); this.v.setMode(id); this.sfx?.('click'); } }, el('span', { html: icon(ic) }), nm);
      row._tip = () => `<div class="tt-title">${nm}</div>${desc}`;
      menu.append(row);
    }
    this.modeBtn.append(menu);
    this.modeMenu = menu;
  }
  drawMinimap() {
    const cv = this.mm, ctx = cv.getContext('2d');
    const { W, H, pid, L, land } = this.v.map;
    if (this.v.minimapDirty || !this.mmImg) {
      this.v.minimapDirty = false;
      const img = ctx.createImageData(cv.width, cv.height);
      const D = this.v.colData;
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
        const sx = Math.floor(x / cv.width * W), sy = Math.floor(y / cv.height * H), i = sy * W + sx, p = pid[i];
        const o = (y * cv.width + x) * 4;
        if (p < 0 || p >= L || land[i] !== 1) { img.data[o] = 21; img.data[o + 1] = 44; img.data[o + 2] = 62; img.data[o + 3] = 255; continue; }
        const c0 = ci(p, 0), c1 = ci(p, 1);
        img.data[o] = D[c0]; img.data[o + 1] = D[c0 + 1]; img.data[o + 2] = D[c0 + 2]; img.data[o + 3] = 255;
        if (D[c1 + 3] && (x + y) % 3 === 0) { img.data[o] = D[c1]; img.data[o + 1] = D[c1 + 1]; img.data[o + 2] = D[c1 + 2]; }
      }
      this.mmImg = img;
    }
    ctx.putImageData(this.mmImg, 0, 0);
    const c = this.v.cam;
    const vw = c.d * 1.35, vh = c.d * 0.8;
    ctx.strokeStyle = '#f3dc9c'; ctx.lineWidth = 1.5; ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 3;
    ctx.strokeRect((c.x - vw / 2) / W * cv.width, (c.z - vh / 2) / H * cv.height, vw / W * cv.width, vh / H * cv.height);
    // player's armies
    ctx.fillStyle = '#fff';
    for (const a of Object.values(this.s.armies)) if (a.nation === this.s.player) { const p = this.v.map.provinces[a.loc]; ctx.fillRect(p.x / W * cv.width - 1.5, p.y / H * cv.height - 1.5, 3, 3); }
    ctx.fillStyle = '#ff5030';
    for (const b of Object.values(this.s.battles)) if (!b.over) { const p = this.v.map.provinces[b.prov]; ctx.beginPath(); ctx.arc(p.x / W * cv.width, p.y / H * cv.height, 3, 0, 7); ctx.fill(); }
  }

  // ── tooltips
  setupTooltips() {
    const tt = document.getElementById('tooltip');
    let cur = null;
    const show = (e) => {
      let t = e.target;
      while (t && t !== document.body && !t._tip && !(t.dataset && t.dataset.tip)) t = t.parentElement;
      if (!t || t === document.body) { tt.style.display = 'none'; cur = null; return; }
      if (cur !== t) { cur = t; const h = t._tip ? t._tip() : t.dataset.tip; if (!h) { tt.style.display = 'none'; return; } tt.innerHTML = h; tt.style.display = 'block'; }
      const r = tt.getBoundingClientRect();
      let x = e.clientX + 16, y = e.clientY + 16;
      if (x + r.width > innerWidth - 6) x = e.clientX - r.width - 12;
      if (y + r.height > innerHeight - 6) y = e.clientY - r.height - 12;
      tt.style.left = Math.max(4, x) + 'px'; tt.style.top = Math.max(4, y) + 'px';
    };
    document.addEventListener('mousemove', show);
    document.addEventListener('mousedown', () => { tt.style.display = 'none'; cur = null; });
    this.ttEl = tt;
  }
  mapTip(p, e) {
    const tt = this.ttEl;
    if (p < 0 || e.buttons) { if (this._mapTip) { tt.style.display = 'none'; this._mapTip = false; } return; }
    const sp = this.v.map.provinces[p], g = this.g;
    let h;
    if (this.peace && !sp.sea) {
      const pm = this.peace, pr = this.s.prov[p];
      if (pm.provs.has(p)) {
        const cost = g.demandCost(pm.w, pm.side, { type: 'province', p, to: this.s.player });
        const occ = (pm.side === 'att' ? pm.w.att : pm.w.def).includes(pr.controller);
        h = `<div class="tt-title">${sp.name}</div>${this.s.nations[pr.owner].name} · dev ${pr.dev}<br>War score cost <b>${cost}</b>${occ ? ' · <span class="pos">we occupy it</span>' : ''}${pr.claims.includes(this.s.player) ? ' · <span class="pos">claimed (cheaper)</span>' : ''}<hr>${pm.picked.has(p) ? 'Click to drop this demand' : 'Click to demand this province'}`;
      } else h = `<div class="tt-title">${sp.name}</div><span class="muted">Not theirs to give</span>`;
      tt.innerHTML = h; tt.style.display = 'block';
      tt.style.left = Math.min(innerWidth - 300, e.clientX + 18) + 'px'; tt.style.top = Math.min(innerHeight - 120, e.clientY + 18) + 'px';
      this._mapTip = true;
      return;
    }
    if (sp.sea) h = `<div class="tt-title">${sp.name}</div><span class="muted">Sea zone · armies may cross by ship from coastal provinces</span>`;
    else {
      const pr = this.s.prov[p], o = this.s.nations[pr.owner];
      h = `<div class="tt-title">${sp.name}${o && o.capital === p ? ' ★' : ''}</div><div class="row">${o ? coaSVG(o.coa, 16) : ''}<span>${o ? o.name : '—'}</span></div>
        <div class="muted small">${sp.terrain} · dev ${pr.dev} · ${pr.culture} · ${pr.religion}${g.fortLevel(p) ? ' · fort ' + g.fortLevel(p) : ''}</div>
        ${pr.controller !== pr.owner ? `<div class="neg small">Occupied by ${pr.controller >= 0 ? this.s.nations[pr.controller].name : 'rebels'}</div>` : ''}
        ${this.selArmies.length ? `<hr><span class="small">Right-click to <b>${g.armiesAt(p).some((b) => g.hostileArmies(this.s.armies[this.selArmies[0]] || {}, b)) ? 'attack' : 'move'}</b> here</span>` : ''}`;
    }
    tt.innerHTML = h; tt.style.display = 'block';
    tt.style.left = Math.min(innerWidth - 300, e.clientX + 18) + 'px'; tt.style.top = Math.min(innerHeight - 120, e.clientY + 18) + 'px';
    this._mapTip = true;
  }

  // ── toasts, alerts and modals
  toast(title, text, icon = 'scroll', onclick, level = 'info') {
    // Settings: 'important' hides routine feedback, 'critical' shows only war, peace, revolt and ruin (errors always show)
    const v = this.settings?.toasts || 'all';
    if (v !== 'all' && icon !== '🚫' && level !== 'critical' && !(v === 'important' && level === 'important')) return;
    const t = el('div', { class: 'toast frame lv-' + level, onclick: () => { onclick && onclick(); t.remove(); } }, el('div', { class: 'ti', html: ICONS[icon] ? svgIcon(icon) : null }, ICONS[icon] ? null : icon), el('div', {}, el('div', { class: 'tt' }, title), el('div', { class: 'small muted' }, text)));
    this.toasts.prepend(t);
    while (this.toasts.children.length > 4) this.toasts.lastChild.remove();
    this.sfx?.(level === 'critical' ? 'alert' : 'toast');
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, level === 'critical' ? 9000 : 6000);
  }
  // Big centred announcement (war declared, peace, coronation, battle). kind: 'war' | 'peace' | 'gold' | 'battle'
  banner(kicker, title, sub = '', kind = 'gold') {
    const host = document.getElementById('banners');
    if (!host) return;
    const b = el('div', { class: 'banner ' + kind }, el('div', { class: 'bn-k' }, kicker), el('div', { class: 'bn-t' }, title), sub ? el('div', { class: 'bn-s' }, sub) : null);
    host.append(b);
    while (host.children.length > 2) host.firstChild.remove();
    setTimeout(() => b.remove(), 3900);
    if (kind === 'war') { const f = el('div', { id: 'flash', style: { background: 'radial-gradient(circle, rgba(255,120,90,.45), rgba(255,120,90,0) 65%)' } }); document.body.append(f); setTimeout(() => f.remove(), 800); }
  }
  modal(build, { dismiss = true, cls = '' } = {}) {
    const back = el('div', { class: 'modal-back' });
    const m = el('div', { class: 'modal frame ' + cls });
    back.append(m);
    const close = () => { back.remove(); this.emit('modalClosed'); };
    if (dismiss) back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
    build(m, close);
    document.body.append(back);
    return close;
  }
  confirm(title, text, ok) {
    this.modal((m, close) => {
      m.append(el('div', { class: 'mh' }, el('div', { class: 'frame-title' }, title)), el('div', { class: 'mb' }, text),
        el('div', { class: 'mf' }, el('div', { class: 'row' }, el('div', { class: 'btn primary', onclick: () => { close(); ok(); } }, 'Confirm'), el('div', { class: 'btn', onclick: close }, 'Cancel'))));
    });
  }

  // ── keyboard
  setupKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (document.querySelector('.modal-back') && e.key !== 'Escape') return;
      if (e.key === ' ') { e.preventDefault(); this.togglePause(); return; }
      if (/^[1-5]$/.test(e.key)) { this.setSpeed(+e.key); return; }
      if (e.key === 'Escape') {
        if (this.peace) this.endPeace();
        else if (this.battleViewer.isOpen) this.battleViewer.close();
        else if (this.tab) this.openTab(null);
        else if (this.selArmies.length) this.selectArmies([]);
        else this.selectProvince(-1);
        return;
      }
      if (e.key === 'Delete' && this.selArmies.length) return;
      const t = TABS.find((t) => t.key === e.key.toLowerCase());
      if (t && !e.ctrlKey && !e.metaKey) this.openTab(this.tab === t.id ? null : t.id);
    });
  }

  // ── selection
  selectProvince(p) {
    this.selProv = p;
    this.v.selectProvince(p);
    this.renderProvince();
    this.emit('selectProvince', p);
  }
  selectArmies(ids, fly = false) {
    this.selArmies = ids.filter((i) => this.s.armies[i]);
    this.v.selectArmies(this.selArmies);
    this.renderArmy();
    if (fly && this.selArmies.length) { const a = this.s.armies[this.selArmies[0]]; this.v.flyToProvince(a.loc, 160); }
    this.emit('selectArmies', this.selArmies);
  }
  rightClick(p) {
    if (p < 0) return;
    const mine = this.selArmies.map((i) => this.s.armies[i]).filter((a) => a && a.nation === this.s.player);
    if (!mine.length) return;
    let ok = 0, why = null;
    for (const a of mine) { this.g.leaveFront(a.id); const r = this.g.orderMove(a.id, p); if (r) why = r; else ok++; }
    if (!ok && why) this.toast('Cannot move there', why, '🚫');
    else this.emit('ordered', p);
    this.renderArmy();
  }





  // ── wiring
  hook() {
    const g = this.g, v = this.v;
    v.on('provinceClick', (p, e) => {
      if (this.peace) { this.togglePeaceProv(p); return; }
      this.selectArmies([]);
      this.selectProvince(p);
      void e;
    });
    v.on('armyClick', (id, e) => {
      if (e && (e.shiftKey || e.ctrlKey)) { const set = new Set(this.selArmies); set.has(id) ? set.delete(id) : set.add(id); this.selectArmies([...set]); }
      else this.selectArmies([id]);
    });
    v.on('boxSelect', (ids) => this.selectArmies(ids.filter((i) => this.s.armies[i]?.nation === this.s.player)));
    v.on('rightClick', (p) => this.rightClick(p));
    v.on('battleClick', (id) => this.battleViewer.open(id));
    v.on('hover', (p, e) => this.mapTip(p, e));
    g.on('notify', (n) => {
      // routine news (finished focus, innovation, achievement, ambition...) goes to the outliner, not into a toast
      if (!n.title || n.title === 'Focus Complete') {
        (this.recent ||= []).unshift({ day: this.s.day, icon: n.icon, text: n.title ? `${n.title}: ${n.text}` : n.text });
        if (this.recent.length > 12) this.recent.length = 12;
        this._outKey = null;
        return;
      }
      const level = ['War!', 'Peace Offer', 'Province Lost', 'Revolt', 'Bankruptcy', 'Excommunicated', 'Vassal rebels', 'Crusade failed'].includes(n.title) ? 'critical' : ['Battle!', 'Succession', 'Heresy', 'General wounded', 'General disgruntled'].includes(n.title) ? 'important' : 'info';
      this.toast(n.title, n.text, n.icon, () => {
        if (n.battle) this.battleViewer.open(n.battle);
        else if (n.prov !== undefined) { this.selectProvince(n.prov); v.flyToProvince(n.prov); }
        else if (n.peace) this.openTab('wars');
      }, level);
      if (['War!', 'Peace Offer'].includes(n.title) && this.settings?.pauseOnWar !== false) this.setSpeed(0);
    });
    g.on('event', () => { if (!this._eventOpen) this.showEvent(); });
    g.on('log', (text, o) => {
      if (!o || !o.important) return;
      let m;
      if (o.type === 'war' && (m = /^(.+) declares war on (.+)! \((.+)\)$/.exec(text))) { this.banner('War declared', `${m[1]} · ${m[2]}`, m[3], 'war'); sfx.play('horn'); }
      else if ((m = /^Peace: the (.+) ends\. Terms: (.+)\.$/.exec(text))) { this.banner('Peace', `The ${m[1]} is ended`, m[2], 'peace'); sfx.play('peace'); }
    });
    g.on('coronation', (nid, rank) => {
      if (nid !== this.s.player) return;
      const n = this.s.nations[nid];
      this.banner('Coronation', `${n.name} is raised`, `Henceforth a ${g.rankInfo(nid).name || 'greater realm'}`, 'gold');
      sfx.play('fanfare');
    });
    g.on('battle', (id) => {
      const b = this.s.battles[id], pl = this.s.player;
      if (b && (b.attN === pl || b.defN === pl)) { sfx.play('clash'); this.v.flashProvince?.(b.prov); }
    });
    // a freshly mustered army announces itself, is selected and the camera goes to it
    g.on('mustered', (id) => {
      const a = this.s.armies[id]; if (!a) return;
      this.toast('Army mustered', `${a.name} is ready at ${g.provName(a.loc)} (${Math.round(g.armyMen(a)).toLocaleString('en-US')} men).`, '⚔', () => this.selectArmies([id], true));
      if (!this.selArmies.length && !this.peace) this.selectArmies([id], true);
    });
    g.on('armyGone', (id) => { if (this.selArmies.includes(id)) this.selectArmies(this.selArmies.filter((i) => i !== id)); });
    g.on('battle', (id) => { const b = this.s.battles[id]; if (b && this.settings?.autoBattle && [b.attN, b.defN].includes(this.s.player)) this.battleViewer.open(id); });
  }

  // periodic refresh
  update() {
    const now = performance.now();
    if (now - (this._lastTop || 0) > 250) { this._lastTop = now; this.updateTopbar(); this.updateAlerts(); this.updateOutliner(); }
    if (now - (this._lastMM || 0) > 400) { this._lastMM = now; this.drawMinimap(); }
    if (this._dirtyDay !== this.s.day && now - (this._lastPanel || 0) > 1500) {
      this._dirtyDay = this.s.day; this._lastPanel = now;
      if (this.tab && !PANELS[this.tab].static) this.renderPanel();
      if (this.selProv >= 0) this.renderProvince();
      if (this.selArmies.length) this.renderArmy();
    }
    this.battleViewer.update();
  }
}
Object.assign(UI.prototype, TopbarMixin, AlertsMixin, ProvinceMixin, ArmyMixin, PeaceMixin, MenuMixin, OutlinerMixin);
