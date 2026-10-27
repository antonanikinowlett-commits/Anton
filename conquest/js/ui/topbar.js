// Top bar: realm, resources with breakdown tooltips, date and game speed.
// Mixed into UI.prototype (this = the UI).
import { el, fmt, signed, dateStr } from '../util.js';
import { coaSVG } from './heraldry.js';
import { GOVS } from '../data/government.js';

export const TopbarMixin = {
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
  },
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
  },
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
  },

  // ── speed
  setSpeed(s) { this.speed = s; if (s > 0) this.lastSpeed = s; this.updateTopbar(); this.emit('speed', s); },
  togglePause() { this.setSpeed(this.speed ? 0 : this.lastSpeed); },
};
