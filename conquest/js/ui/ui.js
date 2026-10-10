// UI shell: top bar, tab bar and side panel, province & army panels, tooltips, toasts,
// alerts, modals and the minimap. Panel contents live in ./panels/*.js.
import { el, fmt, signed, dateStr, clamp, pct, store } from '../util.js';
import { coaSVG, rebelCoa } from './heraldry.js';
import { portraitSVG } from './portrait.js';
import { BUILDINGS, BUILDING_ORDER, CHURCH_NAMES, CASTLE_NAMES } from '../data/buildings.js';
import { UNITS } from '../data/units.js';
import { DOCTRINES } from '../data/tactics.js';
import { TRAITS } from '../data/traits.js';
import { GOVS } from '../data/government.js';
import { PANELS, describeDemand } from './panels.js';
import { BattleViewer } from './battleview.js';

export const TABS = [
  { id: 'realm', icon: '👑', name: 'Realm', key: 'r' },
  { id: 'court', icon: '🏛', name: 'Court & Estates', key: 'c' },
  { id: 'laws', icon: '📜', name: 'Laws', key: 'l' },
  { id: 'focus', icon: '🎯', name: 'National Focus', key: 'f' },
  { id: 'diplomacy', icon: '🤝', name: 'Diplomacy', key: 'g' },
  { id: 'military', icon: '⚔', name: 'Military', key: 'm' },
  { id: 'economy', icon: '💰', name: 'Economy', key: 'b' },
  { id: 'wars', icon: '🔥', name: 'Wars & Peace', key: 'x' },
  { id: 'ledger', icon: '📊', name: 'Ledger', key: 'n' },
];
const MODES = [
  ['political', '🗺', 'Political'], ['terrain', '⛰', 'Terrain'], ['terrainType', '🌲', 'Terrain types (combat)'], ['diplomacy', '🤝', 'Diplomacy'], ['religion', '✝', 'Religion'],
  ['culture', '🗣', 'Culture'], ['development', '🏘', 'Development'], ['supply', '🌾', 'Supply limit'], ['fort', '🏰', 'Forts'], ['unrest', '🔥', 'Unrest'],
];
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
  emit(ev, ...a) { for (const f of this.listeners[ev] || []) f(...a); }
  get s() { return this.g.s; }
  get P() { return this.g.player; }

  build() {
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
    this.buildTopbar(); this.buildTabs(); this.buildModes();
    this.setupTooltips(); this.setupKeys(); this.hook();
  }

  // ── top bar
  buildTopbar() {
    const n = this.P;
    this.topbar.innerHTML = '';
    const realm = el('div', { class: 'realm', onclick: () => this.openTab('realm') });
    realm.innerHTML = `${coaSVG(n.coa, 30)}<div><div class="nm">${n.name}</div><div class="rl" id="tb-ruler"></div></div>`;
    this.topbar.append(realm);
    this.resEl = el('div', { class: 'res' });
    const R = [
      ['gold', '🪙', 'Gold'], ['food', '🌾', 'Food'], ['manpower', '👥', 'Manpower'], ['iron', '⚒', 'Iron'], ['timber', '🪵', 'Timber'], ['horses', '🐎', 'Horses'],
      ['prestige', '⭐', 'Prestige'], ['legitimacy', '👑', 'Legitimacy'], ['stability', '⚖', 'Stability'], ['warExhaustion', '💀', 'War Exhaustion'],
    ];
    this.resItems = {};
    for (const [k, ic, nm] of R) {
      const it = el('div', { class: 'res-item' }, el('div', { class: 'v' }, el('span', { class: 'ic' }, ic), el('span', { class: 'vv' }, '')), el('div', { class: 'd' }, nm));
      it._tip = () => this.resTip(k);
      this.resItems[k] = it;
      this.resEl.append(it);
    }
    this.topbar.append(this.resEl);
    const tb = el('div', { class: 'timebox' });
    this.dateEl = el('div', { class: 'date', onclick: () => this.togglePause() });
    this.dateEl._tip = () => '<b>Space</b> pause · <b>1–5</b> game speed';
    this.speedsEl = el('div', { class: 'speeds' });
    for (let i = 1; i <= 5; i++) this.speedsEl.append(el('div', { class: 'sp', onclick: () => this.setSpeed(i) }));
    tb.append(el('div', { class: 'btn icon', onclick: () => this.togglePause(), id: 'pausebtn' }, '⏸'), this.dateEl, this.speedsEl,
      el('div', { class: 'btn icon menu-btn', onclick: () => this.gameMenu(), 'data-tip': 'Game menu: save, load, settings' }, '☰'));
    this.topbar.append(tb);
    this.updateTopbar();
  }
  updateTopbar() {
    const n = this.P, g = this.g;
    if (!n) return;
    const B = this._budget && this._budgetDay === this.s.day ? this._budget : (this._budget = g.budget(n.id), this._budgetDay = this.s.day, this._budget);
    const set = (k, v, cls) => { const e = this.resItems[k].querySelector('.vv'); e.textContent = v; e.className = 'vv ' + (cls || ''); };
    set('gold', `${fmt(n.gold)} (${signed(B.net, 1)})`, n.gold < 0 ? 'neg' : B.net < 0 ? 'neg' : '');
    set('food', `${fmt(n.food)} (${signed(B.foodNet, 1)})`, n.food < 0 ? 'neg' : B.foodNet < 0 ? 'neg' : '');
    set('manpower', `${fmt(n.manpower)}`, n.manpower < n.maxManpower * 0.15 ? 'neg' : '');
    set('iron', fmt(n.iron)); set('timber', fmt(n.timber)); set('horses', fmt(n.horses));
    set('prestige', fmt(n.prestige)); set('legitimacy', Math.round(n.legitimacy), n.legitimacy < 40 ? 'neg' : '');
    set('stability', signed(n.stability, 1), n.stability < 0 ? 'neg' : n.stability > 0 ? 'pos' : '');
    set('warExhaustion', n.warExhaustion.toFixed(1), n.warExhaustion > 5 ? 'neg' : '');
    this.resItems.warExhaustion.style.display = n.warExhaustion > 0.05 ? '' : 'none';
    this.dateEl.textContent = dateStr(this.s.day);
    this.dateEl.classList.toggle('paused', this.speed === 0);
    [...this.speedsEl.children].forEach((e, i) => e.classList.toggle('on', i < (this.speed || this.lastSpeed) && this.speed > 0));
    const rl = this.topbar.querySelector('#tb-ruler');
    const r = this.s.chars[n.ruler];
    if (rl) rl.textContent = `${g.rulerTitle(n)} ${g.charName(r)} · ${GOVS[n.gov].name}`;
    const pb = this.topbar.querySelector('#pausebtn');
    if (pb) pb.textContent = this.speed === 0 ? '▶' : '⏸';
  }
  resTip(k) {
    const n = this.P, g = this.g, B = g.budget(n.id);
    const L = (a, b, cls = '') => `<div class="tt-line"><span>${a}</span><span class="${cls}">${b}</span></div>`;
    const sg = (v) => `<span class="${v < 0 ? 'neg' : 'pos'}">${signed(v, 1)}</span>`;
    switch (k) {
      case 'gold': return `<div class="tt-title">Treasury: ${fmt(n.gold, 1)} gold</div>${L('Taxes', sg(B.tax))}${L('Trade', sg(B.trade))}${L('Mines', sg(B.mines))}${B.tribute ? L('Tribute', sg(B.tribute)) : ''}<hr>${L('Army upkeep', sg(-B.armyUpkeep))}${L('Court & generals', sg(-B.court))}${L('Administration', sg(-B.admin))}${B.interest ? L('Debt interest', sg(-B.interest)) : ''}<hr>${L('<b>Monthly balance</b>', sg(B.net))}<div class="muted small">Negative gold reduces stability and angers the nobles.</div>`;
      case 'food': return `<div class="tt-title">Food stores: ${fmt(n.food)}</div>${L('Harvests (net of towns)', sg(B.food))}${L('Armies in the field', sg(-B.armyFood))}<hr>${L('<b>Monthly balance</b>', sg(B.foodNet))}<div class="muted small">Starvation: army attrition, morale loss, unrest and slower manpower. Build farms, keep armies in friendly land.</div>`;
      case 'manpower': return `<div class="tt-title">Manpower: ${fmt(n.manpower)} / ${fmt(n.maxManpower)}</div>Men available to raise new regiments and reinforce depleted ones.<br>Recovers ~${fmt(n.maxManpower / 60)} per month.<br><span class="muted small">From development, barracks and military laws (${g.mod(n.id, 'manpowerMult') >= 0 ? '+' : ''}${Math.round(g.mod(n.id, 'manpowerMult') * 100)}%).</span>`;
      case 'iron': return `<div class="tt-title">Iron: ${fmt(n.iron)}</div>${L('Monthly', sg(B.iron))}<span class="muted small">Needed for armoured troops, siege engines and castles. Build mines in hills and mountains.</span>`;
      case 'timber': return `<div class="tt-title">Timber: ${fmt(n.timber)}</div>${L('Monthly', sg(B.timber))}<span class="muted small">Bows, siege engines, buildings. Lumber camps in forests.</span>`;
      case 'horses': return `<div class="tt-title">Horses: ${fmt(n.horses)}</div>${L('Monthly', sg(B.horses))}<span class="muted small">Every cavalry regiment needs horses. Stud farms on plains and steppe.</span>`;
      case 'prestige': return `<div class="tt-title">Prestige: ${fmt(n.prestige)}</div>Won from victories and focuses; spent to propose laws and hire generals.`;
      case 'legitimacy': return `<div class="tt-title">Legitimacy: ${Math.round(n.legitimacy)}</div>The right to rule. Low legitimacy erodes stability. Some laws require high legitimacy.${L('Monthly', sg(0.1 + g.mod(n.id, 'legitimacyMonthly') * 10))}`;
      case 'stability': return `<div class="tt-title">Stability: ${signed(n.stability, 2)}</div>From -3 to +3. Each point gives ±4% taxes and ±1.5 unrest everywhere.${L('Monthly drift', sg(g.mod(n.id, 'stabilityMonthly') * 3))}`;
      case 'warExhaustion': return `<div class="tt-title">War Exhaustion: ${n.warExhaustion.toFixed(1)}</div>Grows with casualties, causes unrest and lowers manpower. Recovers in peace.`;
    }
    return '';
  }

  // ── speed
  setSpeed(s) { this.speed = s; if (s > 0) this.lastSpeed = s; this.updateTopbar(); this.emit('speed', s); }
  togglePause() { this.setSpeed(this.speed ? 0 : this.lastSpeed); }

  // ── tabs & side panel
  buildTabs() {
    this.tabsEl.innerHTML = '';
    for (const t of TABS) {
      const e = el('div', { class: 'tab', id: 'tab-' + t.id, onclick: () => this.openTab(this.tab === t.id ? null : t.id) }, t.icon, el('span', { class: 'key' }, t.key.toUpperCase()));
      e._tip = () => `<div class="tt-title">${t.name}</div><span class="muted">Shortcut: ${t.key.toUpperCase()}</span>`;
      this.tabsEl.append(e);
    }
  }
  openTab(id) {
    this.tab = id;
    for (const t of TABS) this.tabsEl.querySelector('#tab-' + t.id).classList.toggle('on', t.id === id);
    if (!id) { this.panel.classList.add('hidden'); this.provEl.classList.remove('shift'); this.emit('tab', null); return; }
    this.panel.classList.remove('hidden');
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
    this.panel.append(el('div', { class: 'ph' }, el('div', { class: 'frame-title' }, tdef.icon + '  ' + tdef.name), el('span', { class: 'x', onclick: () => this.openTab(null) }, '✕')));
    const pb = el('div', { class: 'pb scroll' });
    this.panel.append(pb);
    P.render(this, pb);
    pb.scrollTop = sc;
  }

  // ── map modes & minimap
  buildModes() {
    const bar = el('div', { class: 'modebar frame' });
    for (const [id, ic, nm] of MODES) {
      const b = el('div', { class: 'mode' + (id === this.v.mode ? ' on' : ''), onclick: () => { this.v.setMode(id); [...bar.children].forEach((c) => c.classList.toggle('on', c._id === id)); } }, ic);
      b._id = id; b._tip = () => `<b>${nm}</b> map mode`;
      bar.append(b);
    }
    this.mm = el('canvas', { id: 'minimap', width: 260, height: 238 });
    const wrap = el('div', { class: 'frame', style: { padding: '3px' } }, this.mm);
    this.modesEl.append(bar, wrap);
    const go = (e) => {
      const r = this.mm.getBoundingClientRect();
      this.v.flyTo((e.clientX - r.left) / r.width * this.v.map.W, (e.clientY - r.top) / r.height * this.v.map.H);
    };
    let down = false;
    this.mm.addEventListener('pointerdown', (e) => { down = true; go(e); });
    window.addEventListener('pointerup', () => { down = false; });
    this.mm.addEventListener('pointermove', (e) => { if (down) go(e); });
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
        if (p < 0 || p >= L || land[i] !== 1) { img.data[o] = 22; img.data[o + 1] = 52; img.data[o + 2] = 74; img.data[o + 3] = 255; continue; }
        img.data[o] = D[p * 4]; img.data[o + 1] = D[p * 4 + 1]; img.data[o + 2] = D[p * 4 + 2]; img.data[o + 3] = 255;
        if (D[4096 * 4 + p * 4 + 3] && (x + y) % 3 === 0) { img.data[o] = D[4096 * 4 + p * 4]; img.data[o + 1] = D[4096 * 4 + p * 4 + 1]; img.data[o + 2] = D[4096 * 4 + p * 4 + 2]; }
      }
      this.mmImg = img;
    }
    ctx.putImageData(this.mmImg, 0, 0);
    const c = this.v.cam;
    const vw = c.d * 1.35, vh = c.d * 0.8;
    ctx.strokeStyle = '#f0d48a'; ctx.lineWidth = 1.5;
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
  toast(title, text, icon = '📜', onclick) {
    const t = el('div', { class: 'toast frame', onclick: () => { onclick && onclick(); t.remove(); } }, el('div', { class: 'ti' }, icon), el('div', {}, el('div', { class: 'tt' }, title), el('div', { class: 'small' }, text)));
    this.toasts.prepend(t);
    while (this.toasts.children.length > 5) this.toasts.lastChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 6500);
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
  updateAlerts() {
    const g = this.g, s = this.s, n = this.P;
    const A = [];
    const myBattles = Object.values(s.battles).filter((b) => !b.over && (b.attN === n.id || b.defN === n.id || b.att.concat(b.def).some((i) => s.armies[i]?.nation === n.id)));
    if (myBattles.length) A.push(['battle', '⚔', `${myBattles.length} battle(s) raging — click to watch`, () => this.battleViewer.open(myBattles[0].id), true, myBattles.length]);
    if (s.eventQueue.length) A.push(['event', '📜', 'An event awaits your decision', () => this.showEvent(), true, s.eventQueue.length]);
    if (s.peaceOffers?.length) A.push(['peace', '🕊', 'Peace offer received', () => this.openTab('wars'), true, s.peaceOffers.length]);
    if (!n.focus.cur) A.push(['focus', '🎯', 'No national focus selected', () => this.openTab('focus'), false]);
    if (Object.values(n.council).some((c) => !c)) A.push(['council', '🏛', 'Empty seat on the royal council', () => this.openTab('court'), false]);
    const noGen = g.armiesOf(n.id).filter((a) => !a.general);
    if (noGen.length && g.charsOf(n.id, 'general').some((c) => !c.army)) A.push(['general', '🎖', 'An army has no general (−10% attack, worse morale). Generals are idle.', () => this.selectArmies([noGen[0].id], true), false]);
    if (n.gold < 0) A.push(['gold', '🪙', 'The treasury is in debt!', () => this.openTab('economy'), true]);
    if (n.food < 0) A.push(['food', '🌾', 'The realm is starving!', () => this.openTab('economy'), true]);
    const sieged = g.ownedProvinces(n.id).filter((p) => s.prov[p].siege);
    if (sieged.length) A.push(['siege', '🏰', `${sieged.length} of our castles under siege`, () => { this.selectProvince(sieged[0]); this.v.flyToProvince(sieged[0]); }, true, sieged.length]);
    const unrest = g.ownedProvinces(n.id).filter((p) => s.prov[p].unrest > 45);
    if (unrest.length) A.push(['unrest', '🔥', `High unrest in ${unrest.length} province(s) — risk of revolt`, () => { this.v.setMode('unrest'); this.selectProvince(unrest[0]); this.v.flyToProvince(unrest[0]); }, false, unrest.length]);
    const rebels = Object.values(s.armies).filter((a) => a.nation < 0 && a.rebelOf === n.id);
    if (rebels.length) A.push(['rebels', '🏴', 'Rebels are loose in the realm', () => this.v.flyToProvince(rebels[0].loc), true]);
    if (!n.lawVote && n.prestige > 40 && this.s.day > 60 && this.s.day % 365 < 3) A.push(['law', '📜', 'Consider reforming the laws', () => this.openTab('laws'), false]);
    const key = A.map((a) => a[0] + (a[5] || '')).join(',');
    if (key === this._alertKey) return;
    this._alertKey = key;
    this.alerts.innerHTML = '';
    for (const [id, ic, tip, fn, red, cnt] of A) {
      const e = el('div', { class: 'alert' + (red ? ' red' : ''), onclick: fn, id: 'alert-' + id }, ic, cnt > 1 ? el('span', { class: 'cnt' }, cnt) : null);
      e._tip = () => tip;
      this.alerts.append(e);
    }
  }
  showEvent() {
    const s = this.s, g = this.g;
    if (!s.eventQueue.length || this._eventOpen) return;
    const q = s.eventQueue[0];
    const ev = g.eventDef(q.id);
    if (!ev) { s.eventQueue.shift(); return; }
    this._eventOpen = true;
    const was = this.speed;
    this.setSpeed(0);
    this.modal((m, close) => {
      m.append(el('div', { class: 'mh' }, el('div', { class: 'frame-title' }, ev.title)));
      const mb = el('div', { class: 'mb' }, el('div', { class: 'event-art' }, ev.icon || '📜'), el('div', { class: 'event-desc' }, ev.desc));
      m.append(mb);
      const mf = el('div', { class: 'mf' });
      const opts = ev.options || [{ text: 'So it is written.', effects: [] }];
      opts.forEach((o, i) => {
        const eff = g.describeEffects(o.effects);
        const b = el('div', { class: 'btn opt' + (i === 0 ? ' primary' : '') }, el('div', {}, el('div', {}, o.text), eff.length ? el('div', { class: 'eff' }, eff.join(' · ')) : null));
        b.onclick = () => { close(); this._eventOpen = false; if (ev.options) g.chooseEvent(i); else s.eventQueue.shift(); this.emit('eventDone', q.id); if (was) this.setSpeed(was); setTimeout(() => this.showEvent(), 150); };
        mf.append(b);
      });
      m.append(mf);
    }, { dismiss: false });
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

  // ── province panel
  renderProvince() {
    const p = this.selProv, g = this.g, s = this.s;
    const E = this.provEl;
    if (p < 0 || p === undefined) { E.classList.add('hidden'); this.provEl.classList.remove('shift'); return; }
    E.classList.remove('hidden');
    E.classList.toggle('shift', !!this.tab && !PANELS[this.tab]?.wide);
    const sp = this.v.map.provinces[p];
    E.innerHTML = '';
    if (sp.sea) {
      E.append(el('div', { class: 'ph' }, el('div', { class: 'grow' }, el('div', { class: 'pname' }, sp.name), el('div', { class: 'muted small' }, 'Sea zone')), el('span', { class: 'x', onclick: () => this.selectProvince(-1) }, '✕')));
      E.append(el('div', { class: 'pb small' }, 'Armies standing in a coastal province can be ordered across the sea: they embark on hired ships (gold cost, cheaper with a harbour) and sail at ~75 km per day. They cannot fight at sea, and suffer light attrition while aboard.'));
      return;
    }
    const pr = s.prov[p], own = s.nations[pr.owner], pl = s.player;
    const isMine = pr.owner === pl;
    const head = el('div', { class: 'ph' });
    head.innerHTML = `${own ? coaSVG(own.coa, 34) : ''}<div class="grow"><div class="pname">${sp.name}${own && own.capital === p ? ' <span data-tip="Capital">★</span>' : ''}</div>
      <div class="small muted">${own ? own.name : 'Unclaimed'}${own && own.overlord >= 0 ? ' (vassal of ' + s.nations[own.overlord].name + ')' : ''}</div></div>`;
    head.append(el('span', { class: 'x', onclick: () => this.selectProvince(-1) }, '✕'));
    E.append(head);
    const pb = el('div', { class: 'pb scroll' });
    E.append(pb);
    const TI = { farmland: '🌾', plains: '🌿', forest: '🌲', taiga: '🌲', hills: '⛰', mountains: '🏔', marsh: '🪷', steppe: '🐎', desert: '🏜' };
    const fort = g.fortLevel(p);
    const stats = el('div', { class: 'row wrap' });
    const chip = (txt, tip, cls = '') => { const c = el('span', { class: 'chip ' + cls }, txt); c._tip = () => tip; return c; };
    stats.append(...[
      chip(`${TI[sp.terrain]} ${sp.terrain}`, `<b>${sp.terrain}</b><br>${terrainTip(sp.terrain)}`),
      chip(`🏘 Dev ${pr.dev}`, '<b>Development</b>: population, wealth and administration. Drives taxes, manpower and supply. Grows slowly with farms and markets.'),
      chip(`🗣 ${pr.culture}`, own && pr.culture !== own.culture ? `<b>Foreign culture</b>: +unrest under the ${own.adj}.` : '<b>Culture</b>', own && pr.culture !== own.culture ? 'bad' : ''),
      chip(`✝ ${pr.religion}`, own && pr.religion !== own.religion ? '<b>Different faith</b>: +10 unrest and -15% taxes. Churches slowly convert.' : '<b>Religion</b>', own && pr.religion !== own.religion ? 'bad' : ''),
      chip(`🔥 ${Math.round(pr.unrest)}`, '<b>Unrest</b>: above 60 revolts become likely. Lowered by churches, stability, garrisons and good laws.', pr.unrest > 45 ? 'bad' : ''),
      chip(`🏰 Fort ${fort}`, `<b>Fort level ${fort}</b>${pr.buildings.walls ? ' (' + CASTLE_NAMES[Math.min(2, pr.buildings.walls - 1)] + ')' : ''}${own && own.capital === p ? ' +1 capital' : ''}. Enemy armies must besiege it to take the province, and cannot march past it.`),
      chip(`🌾 Supply ${g.supplyLimit(p, pl).toFixed(0)}`, '<b>Supply limit</b> (regiments) for your armies here this season. Exceeding it causes attrition.'),
      sp.coastal ? chip('⚓ Coastal', 'Armies can embark here.') : null,
      sp.river > 0.03 ? chip('〰 River', 'Rivers: attackers crossing suffer −25% attack and charge.') : null,
    ].filter(Boolean));
    pb.append(stats);
    if (pr.controller !== pr.owner) {
      const c = s.nations[pr.controller];
      pb.append(el('div', { class: 'card', style: { marginTop: '6px', borderColor: '#8a3a2a' } }, `⚔ Occupied by ${c ? c.name : 'rebels'}`));
    }
    if (pr.siege) {
      const sg = pr.siege;
      const besieger = sg.by >= 0 ? s.nations[sg.by] : null;
      const box = el('div', { class: 'card', style: { marginTop: '6px' } });
      box.innerHTML = `<div class="row between"><b>🏰 Siege by ${besieger ? besieger.name : 'rebels'}</b><span>${Math.round(sg.prog)}% · day ${sg.days}</span></div>
        <div class="bar" style="margin:4px 0"><i style="width:${Math.min(100, sg.prog)}%;background:#d07030"></i></div>
        <div class="small muted">Garrison ${Math.round(fort * 1000 * pr.garrison)} men${sg.blockade ? '' : ' — <span class="neg">besiegers too few to make progress (need 1.5× garrison)</span>'}</div>
        ${sg.events.map((e) => `<div class="small">• ${e.t}</div>`).join('')}`;
      if (sg.by === pl) box.append(el('div', { class: 'btn danger small', style: { marginTop: '4px' }, onclick: () => { const r = g.assault(p); this.toast('Assault', r || 'The walls have been stormed!', r ? '💀' : '🏰'); this.renderProvince(); }, 'data-tip': 'Storm the walls now. Costly in lives; chance grows with siege progress and numbers.' }, '⚔ Assault the walls'));
      pb.append(box);
    }
    // buildings
    pb.append(el('div', { class: 'section' }, 'Buildings', el('span', { class: 'tiny muted' }, isMine ? 'click to build' : '')));
    const grid = el('div', { class: 'bgrid' });
    for (const type of BUILDING_ORDER) {
      const B = BUILDINGS[type];
      const lvl = pr.buildings[type] || 0;
      const allowed = B.allowed(sp);
      const q = pr.queue.find((x) => x.type === type);
      let name = B.name;
      if (type === 'church' && lvl) name = (CHURCH_NAMES[pr.religion] || CHURCH_NAMES.catholic)[Math.min(2, lvl - 1)];
      if (type === 'walls' && lvl) name = CASTLE_NAMES[Math.min(2, lvl - 1)];
      const slot = el('div', { class: 'bslot' + (allowed ? '' : ' na') }, el('div', { class: 'bi' }, B.icon), el('div', { class: 'bn' }, name), lvl ? el('div', { class: 'lv' }, `${lvl}/${B.max}`) : null,
        q ? el('div', { class: 'q' }, el('i', { style: { width: `${100 - q.days / q.total * 100}%` } })) : null);
      slot._tip = () => {
        const cost = g.buildCost(pl, p, type), why = isMine ? g.canBuild(pl, p, type) : 'Not your province';
        return `<div class="tt-title">${B.icon} ${B.name} ${lvl}/${B.max}</div>${B.desc}<hr>Cost: ${Object.entries(cost).map(([k, v]) => `${v} ${k}`).join(', ')}${q ? `<br>Under construction: ${q.days} days left` : ''}${why ? `<br><span class="neg">${why}</span>` : '<br><span class="pos">Click to build</span>'}`;
      };
      if (isMine && allowed) slot.onclick = () => { const r = g.build(pl, p, type); if (r) this.toast('Cannot build', r, '🚫'); else this.emit('built', p, type); this.renderProvince(); this.updateTopbar(); };
      grid.append(slot);
    }
    pb.append(grid);
    // production
    if (own) {
      const inc = g.provinceIncome(p, pr.owner);
      pb.append(el('div', { class: 'small muted', style: { marginTop: '6px' } }, `Monthly: 🪙 ${(inc.tax + inc.trade + inc.goldMine).toFixed(2)} · 🌾 ${inc.food.toFixed(1)} · ⚒ ${inc.iron.toFixed(1)} · 🪵 ${inc.timber.toFixed(1)} · 🐎 ${inc.horses.toFixed(1)}`));
    }
    if (pr.claims.length) pb.append(el('div', { class: 'small', style: { marginTop: '4px' } }, '📜 Claimed by: ', ...pr.claims.map((c) => el('span', { class: 'chip ' + (c === pl ? 'good' : '') }, s.nations[c]?.adj || '?'))));
    // actions
    const act = el('div', { class: 'row wrap', style: { marginTop: '8px' } });
    if (isMine && pr.controller === pl) {
      const sel = el('select', {});
      for (const t of this.P.templates) sel.append(el('option', { value: t.id }, t.name));
      const rb = el('div', { class: 'btn green small', onclick: () => {
        const t = this.P.templates.find((x) => x.id === +sel.value);
        const r = g.recruit(pl, p, t);
        if (r) this.toast('Cannot recruit', r, '🚫'); else { this.toast('Mustering', `${t.name} will assemble at ${sp.name}.`, '⚔'); this.emit('recruited'); }
        this.updateTopbar();
      } }, '⚔ Recruit');
      rb._tip = () => { const t = this.P.templates.find((x) => x.id === +sel.value); if (!t) return ''; const c = g.templateCost(pl, t); return `<b>${t.name}</b><br>${Object.entries(c).filter(([k, v]) => v && k !== 'days').map(([k, v]) => `${fmt(v)} ${k}`).join(', ')}<br>${c.days} days (barracks speed this up)`; };
      act.append(sel, rb);
    }
    if (isMine && pr.controller === pl) {
      const dc = g.developCost(p);
      act.append(el('div', { class: 'btn small', onclick: () => { const r = g.developProvince(pl, p); if (r) this.toast('Develop', r, '🚫'); this.renderProvince(); this.updateTopbar(); }, 'data-tip': `Invest ${dc} gold: settle colonists, clear land and found villages. +1 development (taxes, manpower, supply).` }, `🏘 Develop (${dc}g)`));
    }
    if (!isMine && own) {
      const near = sp.adj.some((e) => e.id < g.L && s.prov[e.id].owner === pl);
      if (near && !pr.claims.includes(pl)) act.append(el('div', { class: 'btn small', onclick: () => { const r = g.fabricateClaim(pl, p); this.toast('Fabricate claim', r || `Our chancellor begins forging documents for ${sp.name}. (~5 months)`, r ? '🚫' : '📜'); this.renderProvince(); }, 'data-tip': 'Your chancellor forges a claim (20 gold, ~5 months). Claims give a casus belli and cheaper peace demands.' }, '📜 Fabricate claim'));
      act.append(el('div', { class: 'btn small', onclick: () => { this.state.dipTarget = pr.owner; this.openTab('diplomacy'); } }, `🤝 ${own.adj} diplomacy`));
    }
    if (this.selArmies.length) act.append(el('div', { class: 'btn small primary', onclick: () => this.rightClick(p) }, '➜ Move selected army here'));
    pb.append(act);
    // armies present
    const here = g.armiesAt(p);
    if (here.length) {
      pb.append(el('div', { class: 'section' }, 'Armies here'));
      for (const a of here) {
        const n = s.nations[a.nation];
        const r = el('div', { class: 'row', style: { cursor: 'pointer', padding: '2px 0' }, onclick: () => this.selectArmies([a.id]) });
        r.innerHTML = `${n ? coaSVG(n.coa, 16) : rebelCoa(16)}<span class="grow">${a.name}</span><span>${fmt(g.armyMen(a))}</span>`;
        pb.append(r);
      }
    }
  }

  // ── army panel
  renderArmy() {
    const g = this.g, s = this.s;
    const E = this.armyEl;
    const armies = this.selArmies.map((i) => s.armies[i]).filter(Boolean);
    if (!armies.length) { E.classList.add('hidden'); return; }
    E.classList.remove('hidden');
    E.innerHTML = '';
    if (armies.length > 1) {
      E.append(el('div', { class: 'ph' }, el('div', { class: 'frame-title grow' }, `${armies.length} armies selected`), el('span', { class: 'x', onclick: () => this.selectArmies([]) }, '✕')));
      const pb = el('div', { class: 'pb scroll' });
      for (const a of armies) {
        const r = el('div', { class: 'row', style: { cursor: 'pointer' }, onclick: () => this.selectArmies([a.id]) });
        r.innerHTML = `<span class="grow">${a.name}</span><span>${fmt(g.armyMen(a))} men</span><span class="muted">${this.v.map.provinces[a.loc].name}</span>`;
        pb.append(r);
      }
      const mineAll = armies.every((a) => a.nation === s.player);
      const same = armies.every((a) => a.loc === armies[0].loc);
      const main = armies.find((a) => !a.path.length && !a.battle) || armies[0];
      pb.append(el('div', { class: 'row', style: { marginTop: '8px' } },
        mineAll ? el('div', { class: 'btn primary', onclick: () => {
          const r = g.mergeOrder(armies.map((a) => a.id));
          if (r) this.toast('Merge', r, '⧉');
          this.selectArmies([main.id].filter((i) => s.armies[i]));
        }, 'data-tip': same ? 'Combine these armies into one' : `Combine into one army: the others march to ${main.name} at ${this.v.map.provinces[main.loc].name} and join it on arrival` }, same ? `⧉ Merge ${armies.length} armies` : `⧉ Merge at ${this.v.map.provinces[main.loc].name}`) : null,
        el('div', { class: 'btn small', onclick: () => { for (const a of armies) g.stop(a.id); this.renderArmy(); } }, '■ Stop all')));
      if (armies.every((a) => a.nation === s.player)) pb.append(this.frontTools(armies));
      E.append(pb);
      return;
    }
    const a = armies[0], n = s.nations[a.nation], mine = a.nation === s.player;
    const head = el('div', { class: 'ph' });
    head.innerHTML = `${n ? coaSVG(n.coa, 30) : rebelCoa(30)}<div class="grow"><div class="pname" style="font-size:16px">${a.name}</div><div class="small muted">${n ? n.name : 'Rebels'} · ${this.v.map.provinces[a.loc].name}${a.path.length ? ' → ' + this.v.map.provinces[a.path[a.path.length - 1]].name + ` (${Math.ceil(g.pathDays(a, a.path) * (1 - a.prog * 0))} days)` : ''}${a.retreating ? ' · <span class="neg">retreating</span>' : ''}${a.battle ? ' · <span class="neg">in battle</span>' : ''}</div></div>`;
    head.append(el('span', { class: 'x', onclick: () => this.selectArmies([]) }, '✕'));
    E.append(head);
    const pb = el('div', { class: 'pb scroll' });
    E.append(pb);
    // general
    const gen = g.generalOf(a);
    const gr = el('div', { class: 'row' });
    gr.innerHTML = `<span class="portrait">${portraitSVG(gen, g, 40)}</span>`;
    const ginfo = el('div', { class: 'grow' });
    if (gen) {
      ginfo.innerHTML = `<b>${g.charName(gen)}</b> <span class="muted small">age ${g.age(gen)}</span><div class="small">⚔ ${gen.gen.atk} · 🛡 ${gen.gen.def} · ♟ ${gen.gen.tactics + g.mod(a.nation, 'generalTactics')} · 🏰 ${gen.gen.siege} · 🛒 ${gen.gen.logistics}</div>
        <div class="row wrap">${gen.traits.map((t) => `<span class="chip" data-tip="<b>${TRAITS[t].name}</b><br>${TRAITS[t].desc}">${TRAITS[t].icon} ${TRAITS[t].name}</span>`).join('')}</div>`;
    } else ginfo.innerHTML = '<span class="neg small">No commander: −10% attack, morale suffers, worst tactics.</span>';
    gr.append(ginfo);
    if (mine) {
      const sel = el('select', { onchange: (e) => { if (e.target.value) g.assignGeneral(a.id, +e.target.value); else g.unassignGeneral(a.id); this.renderArmy(); } });
      sel.append(el('option', { value: '' }, '— no general —'));
      for (const c of [...g.charsOf(s.player, 'general'), g.s.chars[this.P.ruler], g.s.chars[this.P.heir]].filter((c) => c && (c.gen || c.role === 'general'))) {
        if (!c.gen) g.makeGeneral(c);
        sel.append(el('option', { value: c.id, selected: c.id === a.general ? 'selected' : null }, `${g.charName(c)} (${c.gen.atk}/${c.gen.def}/${c.gen.tactics})${c.army && c.army !== a.id ? ' ⚑' : ''}`));
      }
      gr.append(sel);
    }
    pb.append(gr);
    // doctrine
    const dr = el('div', { class: 'row', style: { margin: '6px 0' } }, el('span', { class: 'small muted' }, 'Doctrine:'));
    for (const [k, d] of Object.entries(DOCTRINES)) {
      const b = el('div', { class: 'subtab' + (a.doctrine === k ? ' on' : ''), onclick: () => { if (mine) { a.doctrine = k; this.renderArmy(); } } }, d.name);
      b._tip = () => `<b>${d.name}</b><br>${d.desc}<br><span class="muted small">Biases which tactics the general picks in each battle phase.</span>`;
      dr.append(b);
    }
    pb.append(dr);
    // stats
    const men = g.armyMen(a), max = g.armyMax(a);
    const sup = a.loc < g.L ? g.supplyLimit(a.loc, a.nation) : 999;
    const regsHere = g.armiesAt(a.loc).filter((b) => b.nation === a.nation).reduce((t, b) => t + b.regs.length, 0);
    const up = g.armyUpkeep(a);
    const st = el('div', { class: 'row wrap small' });
    st.innerHTML = `<span class="chip" data-tip="Men present / full strength">👥 ${fmt(men)} / ${fmt(max)}</span>
      <span class="chip" data-tip="Average morale. Armies break when morale collapses.">💪 ${pct(g.armyMorale(a))}</span>
      <span class="chip" data-tip="March speed (slowest regiment), km per day on good roads">🥾 ${g.armySpeed(a)} km/d</span>
      <span class="chip ${regsHere > sup ? 'bad' : ''}" data-tip="Regiments here / supply limit. Over the limit means attrition.">🌾 ${regsHere}/${sup >= 999 ? '∞' : sup.toFixed(0)}</span>
      <span class="chip ${a.attrition > 0.001 ? 'bad' : ''}" data-tip="Daily attrition">☠ ${((a.attrition || 0) * 100).toFixed(2)}%/day</span>
      <span class="chip" data-tip="Monthly upkeep">🪙 ${up.gold.toFixed(1)} · 🌾 ${up.food.toFixed(1)}</span>
      ${a.entrench ? `<span class="chip" data-tip="Days dug in: up to +15% defence">⛏ ${a.entrench}d</span>` : ''}`;
    pb.append(st);
    // regiments
    pb.append(el('div', { class: 'section' }, `Regiments (${a.regs.length})`));
    const regs = el('div', { class: 'regs' });
    const order = ['inf', 'rng', 'cav', 'siege'];
    const sorted = [...a.regs].sort((x, y) => order.indexOf(UNITS[x.type].cls) - order.indexOf(UNITS[y.type].cls));
    this.state.regSel ||= new Set();
    if (this.state.regSelArmy !== a.id) { this.state.regSel = new Set(); this.state.regSelArmy = a.id; }
    const regSel = this.state.regSel;
    for (const r of sorted) {
      const u = UNITS[r.type];
      const ri = a.regs.indexOf(r);
      const d = el('div', { class: 'reg' + (regSel.has(ri) ? ' picked' : ''), onclick: () => { if (!mine) return; regSel.has(ri) ? regSel.delete(ri) : regSel.add(ri); this.renderArmy(); } });
      d.innerHTML = `<div class="row"><span class="ri">${u.icon}</span><span class="grow">${u.name}</span></div><div class="row between"><span>${fmt(r.men)}</span><span class="gold">${'★'.repeat(Math.floor((r.xp || 0) * 3))}</span></div><div class="bar green"><i style="width:${r.morale * 100}%"></i></div>`;
      d._tip = () => unitTip(r.type) + `<hr>Men ${Math.round(r.men)}/${r.max} · morale ${pct(r.morale)} · experience ${pct(r.xp || 0)}`;
      regs.append(d);
    }
    pb.append(regs);
    // orders
    if (mine) {
      const o = el('div', { class: 'row wrap', style: { marginTop: '8px' } });
      o.append(el('div', { class: 'btn small', onclick: () => { g.stop(a.id); this.renderArmy(); } }, '■ Stop'));
      if (regSel.size && regSel.size < a.regs.length) o.append(el('div', { class: 'btn small primary', onclick: () => { const b = g.detach(a.id, [...regSel]); regSel.clear(); if (b) this.selectArmies([a.id, b.id]); }, 'data-tip': 'Form a new division from the regiments you picked' }, `✂ Detach ${regSel.size} picked`));
      for (const n of [2, 3, 4]) if (a.regs.length >= n) o.append(el('div', { class: 'btn small', onclick: () => { const ds = g.splitInto(a.id, n); this.selectArmies(ds.map((d) => d.id)); }, 'data-tip': `Divide into ${n} divisions, each with the same mix of troops` }, `✂ ÷${n}`));
      if (new Set(a.regs.map((r) => UNITS[r.type].cls)).size > 1) o.append(el('div', { class: 'btn small', onclick: () => { const ds = g.splitByType(a.id); this.selectArmies(ds.map((d) => d.id)); }, 'data-tip': 'Separate foot, archers, horse and siege engines into their own divisions' }, '✂ By arm'));
      const others = g.armiesAt(a.loc).filter((b) => b !== a && b.nation === a.nation && !b.battle);
      if (others.length) o.append(el('div', { class: 'btn small', onclick: () => { g.merge([a.id, ...others.map((b) => b.id)]); this.renderArmy(); } }, '⧉ Merge here'));
      const pr = s.prov[a.loc];
      if (pr && pr.siege && pr.siege.by === a.nation) o.append(el('div', { class: 'btn small danger', onclick: () => { const r = g.assault(a.loc); this.toast('Assault', r || 'The walls are stormed!', r ? '💀' : '🏰'); this.renderArmy(); } }, '⚔ Assault'));
      if (a.battle) o.append(el('div', { class: 'btn small primary', onclick: () => this.battleViewer.open(a.battle) }, '👁 Watch battle'));
      o.append(el('div', { class: 'btn small danger', onclick: () => this.confirm('Disband army', `Disband ${a.name}? 60% of the men return to the manpower pool.`, () => { g.disband(a.id); this.selectArmies([]); }) }, '✖ Disband'));
      pb.append(o);
      pb.append(this.frontTools([a]));
      pb.append(el('div', { class: 'tiny muted', style: { marginTop: '6px' } }, 'Shift+click other army counters to select them, then Merge. Click regiments to pick them for a new division. Right-click a province to march. Right-click across the sea from a coast to sail. Shift-drag on the map to select several armies.'));
    }
  }

  // ── peace negotiation on the map: click enemy provinces to demand them
  startPeace(w, side) {
    this.endPeace();
    const g = this.g, s = this.s;
    const losers = side === 'att' ? w.def : w.att;
    const pm = this.peace = { w, side, picked: new Set(), provs: new Set(), gold: 0, vassal: false, humiliate: false };
    for (const nid of losers) for (const p of g.ownedProvinces(nid)) { pm.provs.add(p); this.v.setFlag(p, 16, true); }
    this.openTab(null); this.selectProvince(-1); this.selectArmies([]);
    this.peaceEl = el('div', { id: 'peace', class: 'frame' });
    this.root.append(this.peaceEl);
    // look at the enemy land we hold, or their capital
    const ours = side === 'att' ? w.att : w.def;
    const occ = [...pm.provs].filter((p) => ours.includes(s.prov[p].controller));
    const focus = occ.length ? occ : [s.nations[losers[0]].capital].filter((p) => p >= 0);
    if (focus.length) {
      const P = this.v.map.provinces;
      const x = focus.reduce((t, p) => t + P[p].x, 0) / focus.length, z = focus.reduce((t, p) => t + P[p].y, 0) / focus.length;
      this.v.flyTo(x, z, 420);
    }
    this.setSpeed(0);
    this.renderPeace();
  }
  endPeace() {
    const pm = this.peace;
    if (!pm) return;
    for (const p of pm.provs) { this.v.setFlag(p, 16, false); this.v.setFlag(p, 4, false); }
    this.peaceEl?.remove();
    this.peace = null;
  }
  peaceDemands() {
    const pm = this.peace, pl = this.s.player;
    const d = [...pm.picked].map((p) => ({ type: 'province', p, to: pl }));
    if (pm.gold) d.push({ type: 'gold', v: pm.gold });
    if (pm.vassal) d.push({ type: 'vassal', target: pm.side === 'att' ? pm.w.defLeader : pm.w.attLeader });
    if (pm.humiliate) d.push({ type: 'humiliate' });
    return d;
  }
  togglePeaceProv(p) {
    const pm = this.peace;
    if (p < 0 || !pm.provs.has(p)) { this.toast('Peace', 'That province is not theirs to give.', '🚫'); return; }
    if (pm.picked.has(p)) { pm.picked.delete(p); this.v.setFlag(p, 4, false); }
    else { pm.picked.add(p); this.v.setFlag(p, 4, true); }
    this.renderPeace();
  }
  renderPeace() {
    const pm = this.peace, g = this.g, s = this.s, w = pm.w;
    if (!s.wars[w.id]) { this.endPeace(); return; }
    const E = this.peaceEl;
    E.innerHTML = '';
    E.append(el('div', { class: 'ph' }, el('div', { class: 'frame-title grow' }, '🕊 ' + w.name), el('span', { class: 'x', onclick: () => this.endPeace() }, '✕')));
    const pb = el('div', { class: 'pb scroll' });
    E.append(pb);
    const demands = this.peaceDemands();
    const acc = g.peaceAcceptance(w, pm.side, demands);
    const score = pm.side === 'att' ? w.score : -w.score;
    pb.append(el('div', { class: 'small muted' }, 'Click the highlighted enemy provinces on the map to demand them; click again to drop one. Occupied and claimed provinces cost less war score.'));
    const sum = el('div', { class: 'card hl', style: { marginTop: '6px' } });
    sum.innerHTML = `<div class="tt-line"><span>Our war score</span><b class="${score >= 0 ? 'pos' : 'neg'}">${signed(score)}</b></div>
      <div class="tt-line"><span>Cost of demands</span><b>${acc.cost}</b></div>
      <div class="tt-line"><span>Their willingness</span><b class="${acc.will >= 0 ? 'pos' : 'neg'}">${signed(acc.will)}</b></div>
      <div class="bar ${acc.will >= 0 ? 'green' : 'red'}" style="margin-top:4px"><i style="width:${clamp(50 + acc.will, 0, 100)}%"></i></div>
      <div class="small ${acc.will >= 0 ? 'pos' : 'neg'}" style="margin-top:3px">${acc.will >= 0 ? 'They will accept these terms.' : 'They will refuse. Ask for less, or occupy more and win battles first.'}</div>`;
    pb.append(sum);
    const ours = pm.side === 'att' ? w.att : w.def;
    const quick = el('div', { class: 'row wrap', style: { marginTop: '6px' } },
      el('div', { class: 'btn small', onclick: () => { for (const p of pm.provs) if (ours.includes(s.prov[p].controller) && !pm.picked.has(p)) { pm.picked.add(p); this.v.setFlag(p, 4, true); } this.renderPeace(); } }, '+ All we occupy'),
      el('div', { class: 'btn small', onclick: () => { for (const p of pm.provs) if (s.prov[p].claims.includes(s.player) && !pm.picked.has(p)) { pm.picked.add(p); this.v.setFlag(p, 4, true); } this.renderPeace(); } }, '+ All we claim'),
      el('div', { class: 'btn small', onclick: () => { for (const p of pm.picked) this.v.setFlag(p, 4, false); pm.picked.clear(); this.renderPeace(); } }, 'Clear'));
    pb.append(quick);
    pb.append(el('div', { class: 'section' }, `Provinces demanded (${pm.picked.size})`));
    if (!pm.picked.size) pb.append(el('div', { class: 'small muted' }, 'None yet. Click enemy land on the map.'));
    for (const p of pm.picked) {
      const cost = g.demandCost(w, pm.side, { type: 'province', p, to: s.player });
      const occ = ours.includes(s.prov[p].controller);
      const r = el('div', { class: 'row small', style: { padding: '2px 0' } },
        el('span', { class: 'grow', style: { cursor: 'pointer' }, onclick: () => this.v.flyToProvince(p, 160) }, `${this.v.map.provinces[p].name} (dev ${s.prov[p].dev})`),
        occ ? el('span', { class: 'chip good' }, 'occupied') : null,
        el('span', { style: { width: '34px', textAlign: 'right' } }, cost),
        el('span', { class: 'x', onclick: () => this.togglePeaceProv(p) }, '✕'));
      pb.append(r);
    }
    pb.append(el('div', { class: 'section' }, 'Other terms'));
    const gl = el('span', { class: 'small' }, `${pm.gold} gold`);
    pb.append(el('div', { class: 'row' }, el('span', { class: 'small' }, '🪙 Reparations'), el('input', { type: 'range', id: 'peace-gold', min: 0, max: 400, step: 25, value: pm.gold, oninput: (e) => { pm.gold = +e.target.value; gl.textContent = pm.gold + ' gold'; }, onchange: () => this.renderPeace() }), gl));
    const leaderE = pm.side === 'att' ? w.defLeader : w.attLeader;
    pb.append(el('label', { class: 'row small' }, el('input', { type: 'checkbox', id: 'peace-vassal', checked: pm.vassal ? 'checked' : null, onchange: (e) => { pm.vassal = e.target.checked; this.renderPeace(); } }), `Make ${s.nations[leaderE].name} our vassal`));
    pb.append(el('label', { class: 'row small' }, el('input', { type: 'checkbox', id: 'peace-humiliate', checked: pm.humiliate ? 'checked' : null, onchange: (e) => { pm.humiliate = e.target.checked; this.renderPeace(); } }), 'Humiliate them (+30 prestige)'));
    const foot = el('div', { class: 'row wrap', style: { marginTop: '10px' } });
    foot.append(el('div', { class: 'btn primary' + (acc.will >= 0 ? '' : ' disabled'), onclick: () => {
      if (acc.will < 0) { this.toast('Peace refused', 'They reject these terms.', '🚫'); return; }
      g.makePeace(w, pm.side, demands); this.endPeace(); this.toast('Peace', 'The treaty is sealed.', '🕊');
    } }, '🕊 Send peace offer'));
    foot.append(el('div', { class: 'btn', onclick: () => {
      const theirSide = pm.side === 'att' ? 'def' : 'att';
      const leader = s.nations[pm.side === 'att' ? w.defLeader : w.attLeader];
      const tscore = theirSide === 'att' ? w.score : -w.score;
      const D = [];
      let budget = Math.max(0, tscore);
      for (const p of g.ownedProvinces(s.player)) if ((theirSide === 'att' ? w.att : w.def).includes(s.prov[p].controller)) { const d1 = { type: 'province', p, to: leader.id }; const c = g.demandCost(w, theirSide, d1); if (c <= budget) { D.push(d1); budget -= c; } }
      this.confirm('Accept their terms', `${leader.name} would make peace for: ${D.length ? D.map((x) => describeDemand(g, x)).join(', ') : 'a white peace'}.`, () => { g.makePeace(w, theirSide, D); this.endPeace(); });
    } }, 'Ask their terms'));
    foot.append(el('div', { class: 'btn', onclick: () => this.endPeace() }, 'Cancel'));
    pb.append(foot);
  }

  // Assign divisions to a front line against an enemy realm.
  frontTools(armies) {
    const g = this.g, s = this.s, pl = s.player;
    const box = el('div', { class: 'card', style: { marginTop: '8px' } });
    const f = armies.length === 1 ? g.frontOfArmy(armies[0].id) : null;
    if (f) {
      box.append(el('div', { class: 'row' }, el('span', { class: 'grow small' }, `⚑ On the front against the ${s.nations[f.enemy].name} · ${f.mode === 'advance' ? 'advancing' : 'holding the line'}`),
        el('div', { class: 'btn small', onclick: () => { g.leaveFront(armies[0].id); this.renderArmy(); } }, 'Leave front')));
      return box;
    }
    const enemies = g.enemiesOf(pl);
    const cands = [...new Set([...enemies, ...g.neighbours(pl)])].filter((x) => s.nations[x]?.alive);
    if (!cands.length) return el('span');
    const sel = el('select', {});
    for (const x of cands) sel.append(el('option', { value: x }, `${s.nations[x].name}${enemies.includes(x) ? ' ⚔' : ''}`));
    const msg = (r, ok) => { if (r) this.toast('Front', r, '🚫'); else this.toast('Front', ok, '⚑'); this.renderArmy(); this.renderPanel(); };
    box.append(el('div', { class: 'tag' }, 'Front line'), el('div', { class: 'row wrap', style: { marginTop: '4px' } }, sel,
      el('div', { class: 'btn small', onclick: () => msg(g.createFront(pl, +sel.value, armies.map((a) => a.id)), 'Divisions are spreading out along the border.'), 'data-tip': 'These armies spread out evenly along the border with this realm and hold it. Order them to advance from the Military tab or the front list.' }, '⚑ Assign to front'),
      armies.length === 1 ? el('div', { class: 'btn small primary', onclick: () => { const r = g.coverFront(armies[0].id, +sel.value); msg(r, 'Army divided into divisions covering the whole border.'); if (!r) { const fr = g.frontOfArmy(armies[0].id); if (fr) this.selectArmies(fr.armies); } }, 'data-tip': 'Divide this army into as many divisions as the border needs (at least 2 regiments each) and spread them along it.' }, '✂⚑ Split & cover front') : null));
    return box;
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
      this.toast(n.title, n.text, n.icon, () => {
        if (n.battle) this.battleViewer.open(n.battle);
        else if (n.prov !== undefined) { this.selectProvince(n.prov); v.flyToProvince(n.prov); }
        else if (n.peace) this.openTab('wars');
      });
      if (['War!', 'Peace Offer'].includes(n.title) && this.settings?.pauseOnWar !== false) this.setSpeed(0);
    });
    g.on('event', () => { if (!this._eventOpen) this.showEvent(); });
    g.on('armyGone', (id) => { if (this.selArmies.includes(id)) this.selectArmies(this.selArmies.filter((i) => i !== id)); });
    g.on('battle', (id) => { const b = this.s.battles[id]; if (b && this.settings?.autoBattle && [b.attN, b.defN].includes(this.s.player)) this.battleViewer.open(id); });
  }

  // periodic refresh
  update() {
    const now = performance.now();
    if (now - (this._lastTop || 0) > 250) { this._lastTop = now; this.updateTopbar(); this.updateAlerts(); }
    if (now - (this._lastMM || 0) > 400) { this._lastMM = now; this.drawMinimap(); }
    if (this._dirtyDay !== this.s.day && now - (this._lastPanel || 0) > 1500) {
      this._dirtyDay = this.s.day; this._lastPanel = now;
      if (this.tab && !PANELS[this.tab].static) this.renderPanel();
      if (this.selProv >= 0) this.renderProvince();
      if (this.selArmies.length) this.renderArmy();
    }
    this.battleViewer.update();
  }

  gameMenu() {
    const was = this.speed; this.setSpeed(0);
    this.modal((m, close) => {
      m.append(el('div', { class: 'mh' }, el('div', { class: 'frame-title' }, 'Game Menu')));
      const mb = el('div', { class: 'mb col' });
      const saves = JSON.parse(store.get('cc_saves') || '[]');
      mb.append(el('div', { class: 'btn primary', onclick: () => { this.emit('save'); close(); } }, '💾 Save game'));
      for (const sv of saves.slice(-5).reverse()) mb.append(el('div', { class: 'btn', onclick: () => { close(); this.emit('load', sv.key); } }, `📂 Load: ${sv.name}`));
      const set = this.settings ||= { pauseOnWar: true, autoBattle: false, tutorial: true };
      const chk = (k, label) => { const c = el('input', { type: 'checkbox', checked: set[k] ? 'checked' : null, onchange: (e) => { set[k] = e.target.checked; this.emit('settings'); } }); return el('label', { class: 'row small' }, c, label); };
      mb.append(el('div', { class: 'section' }, 'Settings'), chk('pauseOnWar', 'Pause when war is declared on us or peace is offered'), chk('autoBattle', 'Open the battle viewer automatically when our battles begin'), chk('tutorial', 'Show tutorial hints'));
      mb.append(el('div', { class: 'section' }, 'Controls'), el('div', { class: 'small', html: `<b>Mouse</b>: left-drag pan · wheel zoom · left-click select · right-click move/attack · shift-drag box select<br><b>Keys</b>: WASD/arrows pan · Q/E zoom · Space pause · 1–5 speed · R C L F G M B X N panels · Esc close` }));
      mb.append(el('div', { class: 'btn', onclick: () => { close(); this.emit('restart'); } }, '🏠 Main menu'));
      m.append(mb, el('div', { class: 'mf' }, el('div', { class: 'btn', onclick: () => { close(); if (was) this.setSpeed(was); } }, 'Resume')));
    });
  }
}

export function terrainTip(t) {
  return {
    farmland: 'Open fields. Rich supply and harvests. Ideal for cavalry charges.',
    plains: 'Grassland. Good supply. Cavalry +20%. Wide battle frontage.',
    steppe: 'Endless grass. Cavalry +30%, widest frontage, poor supply.',
    forest: 'Cavalry −40%, archers −30%, narrow frontage. Ambushes possible.',
    taiga: 'Northern forest. Very poor supply, brutal winters, cavalry −45%.',
    hills: 'Archers +15%, cavalry −20%, slower movement. Mines possible.',
    mountains: 'Cavalry −55%, very narrow frontage, movement −55%, defender\'s paradise.',
    marsh: 'Everything −15%, cavalry −60%, very slow, frontage cut in half.',
    desert: 'Poor supply; summer heat saps non-native troops. Cavalry +15%.',
  }[t] || '';
}
export function unitTip(type) {
  const u = UNITS[type];
  return `<div class="tt-title">${u.icon} ${u.name}</div><i class="small">${u.desc}</i><hr><div class="small">⚔ Attack ${u.atk} · 🛡 Defence ${u.def} · 🎯 Missile ${u.ranged}<br>🐎 Charge ${u.charge} · 🔱 Anti-cavalry ${u.anti} · 🦺 Armour ${u.armor}<br>🏃 Pursuit ${u.pursuit} · Morale ${u.morale}${u.siege ? ' · 🏰 Siege ' + u.siege : ''} · Speed ${u.speed} km/d<br>${u.men} men · cost ${Object.entries(u.cost).map(([k, v]) => v + ' ' + k).join(', ')} · upkeep ${u.upkeep}/mo · ${u.days} days</div>`;
}
void clamp;
