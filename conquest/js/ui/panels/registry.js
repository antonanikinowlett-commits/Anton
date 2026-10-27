// Panel registry. A panel module calls registerPanel({...}) at import time; panels.js imports
// every panel module. To add a panel from another workstream: create js/ui/panels/foo.js
// calling registerPanel and add one `import './panels/foo.js';` line to js/ui/panels.js.
//
// def: { id, icon, name, key?, order?, wide?, static?, tab? = true, render(ui, pb) }
//   key    – single-letter keyboard shortcut (must be unique; checked below)
//   order  – position in the tab bar (built-ins use 10, 20 … 90)
//   wide   – takes the wide panel slot (like the focus tree)
//   static – not re-rendered on the periodic refresh, only on renderPanel(true)
//   tab    – false: no tab button, open it with ui.openTab(id) from elsewhere
export const PANELS = {};
export const TABS = [];

export function registerPanel(def) {
  if (!def.id || typeof def.render !== 'function') throw new Error('registerPanel: id and render(ui, pb) are required');
  if (def.key && TABS.some((t) => t.key === def.key && t.id !== def.id)) console.warn(`registerPanel: key "${def.key}" of ${def.id} already used`);
  PANELS[def.id] = def;
  const i = TABS.findIndex((t) => t.id === def.id);
  if (i >= 0) TABS.splice(i, 1);
  if (def.tab !== false) {
    TABS.push(def);
    TABS.sort((a, b) => (a.order ?? 500) - (b.order ?? 500));
  }
  return def;
}
