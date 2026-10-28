// Game menu: save, load, settings, controls.
// Mixed into UI.prototype (this = the UI).
import { el, store } from '../util.js';
import { sfx } from './sfx.js';

export const SETTING_DEFAULTS = { pauseOnWar: true, autoBattle: false, tutorial: true, pauseOnEvents: true, uiScale: 1, toasts: 'all', quality: 'high', autosave: true, sound: true, volume: 0.5 };

export const MenuMixin = {
  // settings persist in the browser; `over` overrides (e.g. the tutorial choice at the start screen)
  loadSettings(over = {}) {
    let saved = {};
    try { saved = JSON.parse(store.get('cc_settings') || '{}'); } catch { saved = {}; }
    this.settings = { ...SETTING_DEFAULTS, ...saved, ...over };
    this.applySettings();
    return this.settings;
  },
  saveSettings() { try { store.set('cc_settings', JSON.stringify(this.settings)); } catch { /* storage unavailable */ } },
  applySettings() {
    const set = this.settings || SETTING_DEFAULTS;
    if (this.root) this.root.style.zoom = set.uiScale === 1 ? '' : String(set.uiScale);
    if (this.v?.setQuality) this.v.setQuality(set.quality);
    sfx.configure({ sound: set.sound, volume: set.volume });
  },
  exportSave() {
    const g = this.g, n = g.player;
    const blob = new Blob([g.serialize()], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `crown-and-conquest-${n.tag}-${g.date().y}.json` });
    document.body.append(a); a.click(); a.remove();
    this.toast('Save exported', 'The file was downloaded.', '💾');
  },
  importSave() {
    const inp = el('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
    inp.onchange = () => { const f = inp.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => this.emit('loadjson', String(rd.result)); rd.readAsText(f); };
    document.body.append(inp); inp.click(); setTimeout(() => inp.remove(), 60000);
  },
  settingsModal() {
    this.modal((m, close) => {
      const set = this.settings ||= { ...SETTING_DEFAULTS };
      const change = () => { this.saveSettings(); this.applySettings(); this.emit('settings'); };
      m.append(el('div', { class: 'mh' }, el('div', { class: 'frame-title' }, '⚙ Game Settings')));
      const mb = el('div', { class: 'mb col' });
      const chk = (k, label) => el('label', { class: 'row small' }, el('input', { type: 'checkbox', id: 'set-' + k, checked: set[k] ? 'checked' : null, onchange: (e) => { set[k] = e.target.checked; change(); } }), label);
      const sel = (k, label, opts, conv = (x) => x) => { const s = el('select', { id: 'set-' + k, onchange: (e) => { set[k] = conv(e.target.value); change(); } }); for (const [v, l] of opts) s.append(el('option', { value: v, selected: String(set[k]) === String(v) ? 'selected' : null }, l)); return el('label', { class: 'row small', style: { gap: '8px' } }, label, s); };
      mb.append(el('div', { class: 'section' }, 'Interface'),
        sel('uiScale', 'UI scale', [[0.85, '85%'], [1, '100%'], [1.15, '115%'], [1.3, '130%']], Number),
        sel('toasts', 'Notifications', [['all', 'All'], ['important', 'Important only'], ['critical', 'Critical only (war, peace, revolt)']]),
        chk('pauseOnEvents', 'Pause the game while an event is open'), chk('pauseOnWar', 'Pause when war is declared on us or peace is offered'),
        chk('autoBattle', 'Open the battle viewer automatically when our battles begin'), chk('tutorial', 'Show tutorial hints'));
      mb.append(el('div', { class: 'section' }, 'Sound'), chk('sound', 'Sound effects'),
        el('label', { class: 'row small', style: { gap: '8px' } }, 'Volume', el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: set.volume ?? 0.5, style: { flex: 1, accentColor: '#d9a93f' }, oninput: (e) => { set.volume = +e.target.value; change(); }, onchange: () => sfx.play('coin') })));
      mb.append(el('div', { class: 'section' }, 'Graphics'),
        sel('quality', 'Quality', [['low', 'Low: no trees or mountains, fast'], ['med', 'Medium'], ['high', 'High']]));
      mb.append(el('div', { class: 'section' }, 'Saves'), chk('autosave', 'Autosave every January'),
        el('div', { class: 'row wrap' }, el('div', { class: 'btn small', id: 'export-save', onclick: () => this.exportSave() }, '⬇ Export save file'), el('div', { class: 'btn small', id: 'import-save', onclick: () => { close(); this.importSave(); } }, '⬆ Import save file')));
      m.append(mb, el('div', { class: 'mf' }, el('div', { class: 'btn', onclick: close }, 'Close')));
    });
  },
  gameMenu() {
    const was = this.speed; this.setSpeed(0);
    this.modal((m, close) => {
      m.append(el('div', { class: 'mh' }, el('div', { class: 'frame-title' }, 'Game Menu')));
      const mb = el('div', { class: 'mb col' });
      const saves = JSON.parse(store.get('cc_saves') || '[]');
      mb.append(el('div', { class: 'btn primary', onclick: () => { this.emit('save'); close(); } }, '💾 Save game'));
      for (const sv of saves.slice(-5).reverse()) mb.append(el('div', { class: 'btn', onclick: () => { close(); this.emit('load', sv.key); } }, `📂 Load: ${sv.name}`));
      if (store.get('cc_autosave')) mb.append(el('div', { class: 'btn', onclick: () => { close(); this.emit('load', 'cc_autosave'); } }, '📂 Load: Autosave'));
      mb.append(el('div', { class: 'btn', onclick: () => { close(); this.settingsModal(); } }, '⚙ Settings…'));
      mb.append(el('div', { class: 'section' }, 'Controls'), el('div', { class: 'small', html: `<b>Mouse</b>: left-drag pan · wheel zoom · left-click select · right-click move/attack · shift-drag box select<br><b>Keys</b>: WASD/arrows pan · Q/E zoom · Space pause · 1–5 speed · R C L F G M B X N panels · Esc close` }));
      mb.append(el('div', { class: 'btn', onclick: () => { close(); this.emit('restart'); } }, '🏠 Main menu'));
      m.append(mb, el('div', { class: 'mf' }, el('div', { class: 'btn', onclick: () => { close(); if (was) this.setSpeed(was); } }, 'Resume')));
    });
  },
};
