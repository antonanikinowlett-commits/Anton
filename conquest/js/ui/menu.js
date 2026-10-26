// Game menu: save, load, settings, controls.
// Mixed into UI.prototype (this = the UI).
import { el, store } from '../util.js';

export const MenuMixin = {
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
  },
};
