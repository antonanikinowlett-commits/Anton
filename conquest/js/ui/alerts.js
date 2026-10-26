// Alerts bar and event pop-ups.
// Mixed into UI.prototype (this = the UI).
import { el } from '../util.js';

export const AlertsMixin = {
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
  },
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
  },
};
