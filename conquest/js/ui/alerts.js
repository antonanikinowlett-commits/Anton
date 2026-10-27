// Alerts bar and event pop-ups.
// Mixed into UI.prototype (this = the UI).
import { el } from '../util.js';
import { showEndScore } from './panels/progress.js';

export const AlertsMixin = {
  updateAlerts() {
    const g = this.g, s = this.s, n = this.P;
    const A = [];
    if (s.ended && !this._endShown) { this._endShown = true; showEndScore(this); }
    const myBattles = Object.values(s.battles).filter((b) => !b.over && (b.attN === n.id || b.defN === n.id || b.att.concat(b.def).some((i) => s.armies[i]?.nation === n.id)));
    if (myBattles.length) A.push(['battle', '⚔', `${myBattles.length} battle(s) raging — click to watch`, () => this.battleViewer.open(myBattles[0].id), true, myBattles.length]);
    if (s.eventQueue.length) A.push(['event', '📜', 'An event awaits your decision', () => this.showEvent(), true, s.eventQueue.length]);
    if (s.peaceOffers?.length) A.push(['peace', '🕊', 'Peace offer received', () => this.openTab('wars'), true, s.peaceOffers.length]);
    if (!n.focus.cur && g.focusTree(n.id).some((f) => g.focusStatus(n.id, f) === 'available')) A.push(['focus', '🎯', 'A national focus is available', () => this.openTab('focus'), false]);
    if (n.prog && !n.prog.cur && s.day > 30 && g.hasResearchOptions(n.id)) A.push(['research', '📚', 'Nothing is being researched — choose an innovation', () => this.openTab('progress'), false]);
    if (n.prog && !n.prog.amb && n.prog.ambCool <= 0 && s.day > 30) A.push(['ambition', '⭐', 'Your ruler has no ambition — choose one for a prestige reward', () => this.openTab('progress'), false]);
    if (n.prog && g.rankInfo(n.id).ok) A.push(['crown', '👑', `You can be crowned ${g.rankInfo(n.id).next}`, () => this.openTab('progress'), false]);
    if (s.day > 60 && n.gold > 400 && n.gold > 6 * Math.max(10, (this._budget?.net ?? 0))) A.push(['spend', '🪙', 'Treasury is idle — build, hire, or fund something', () => this.openTab('treasury'), false]);
    if (n.prog && !n.prog.amb && n.prog.ambCool <= 0 && s.day > 60) A.push(['ambition', '⭐', 'Your ruler has no ambition — choose one for prestige and legitimacy', () => { this.subtab.progress = 'amb'; this.openTab('progress'); }, false]);
    if (n.prog && g.rankInfo(n.id).ok) A.push(['crown', '👑', `We can be proclaimed ${g.rankInfo(n.id).next}`, () => { this.subtab.progress = 'rank'; this.openTab('progress'); }, false]);
    if (n.prog && g.availableFormables(n.id).some((f) => g.formableStatus(n.id, f).ok)) A.push(['form', '🏛', 'A greater realm can be proclaimed', () => { this.subtab.progress = 'dec'; this.openTab('progress'); }, false]);
    if (n.gold > 600 && n.gold > 12 * Math.max(5, g.budget(n.id).net)) A.push(['hoard', '💰', 'A great hoard of gold lies idle — build, develop or hire', () => this.openTab('economy'), false]);
    const atWar = g.warsOf(n.id).length > 0;
    const idle = atWar ? g.armiesOf(n.id).filter((a) => !a.path.length && !a.battle && !s.prov[a.loc]?.siege && !g.frontsOf(n.id).some((f) => f.armies.includes(a.id))) : [];
    if (idle.length) A.push(['idle', '💤', `${idle.length} idle army(ies) while at war`, () => this.selectArmies([idle[0].id], true), false, idle.length]);
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
    const tabOf = { research: 'progress', ambition: 'progress', crown: 'progress', form: 'progress', hoard: 'economy', ambition: 'progress', crown: 'progress', spend: 'treasury', focus: 'focus', council: 'court', law: 'laws', peace: 'wars', gold: 'economy', food: 'economy', idle: 'military', general: 'military' };
    const tabs = new Set(A.map((a) => tabOf[a[0]]).filter(Boolean));
    for (const t of this.tabsEl.children) {
      const on = tabs.has(t.id.slice(4)), d = t.querySelector('.dot');
      if (on && !d) t.append(el('span', { class: 'dot' })); else if (!on && d) d.remove();
    }
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
    if (this.settings?.pauseOnEvents !== false) this.setSpeed(0);
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
