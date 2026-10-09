// Main menu & realm selection, shown over the live map.
import { el, fmt, store } from '../util.js';
import { coaSVG } from './heraldry.js';
import { portraitSVG } from './portrait.js';
import { GOVS } from '../data/government.js';

const BLURB = {
  ENG: 'King John has just inherited the Angevin Empire, from the Scottish border to the Pyrenees. Philip Augustus covets Normandy, the barons grumble, and the Welsh and Scots watch for weakness.',
  FRA: 'Philip II Augustus rules a modest domain around Paris, hemmed in by the lands of his overmighty English vassal. Break the Angevin Empire and make the Capetian crown first in Christendom.',
  HRE: 'Two kings claim the imperial crown. Hold the electors together, cross the Alps, humble the Lombard cities and restore the empire of Barbarossa.',
  BYZ: 'The Queen of Cities is the richest prize in the world — and the most coveted. A weak emperor, scheming nobles, Seljuks in Anatolia and crusaders gathering in Venice: can Rome endure?',
  CAS: 'Alfonso VIII still smarts from Alarcos. The Almohad caliph dominates al-Andalus. Unite Christian Spain and win the battle that will decide the Reconquista.',
  ALM: 'From the Atlantic to Tripoli the Almohad Caliphate rules in the name of the Mahdi. Crush the quarrelling Christian kingdoms before they unite against you.',
  AYY: 'Saladin\'s brother al-Adil holds Egypt and Syria together. The Franks still cling to Acre and Antioch — and a new crusade is being preached in the West.',
  VEN: 'Blind, ninety-three-year-old Doge Enrico Dandolo rules the queen of the Adriatic. Crusaders will soon come begging for ships they cannot pay for…',
  HUN: 'The Árpád kingdom is rich and wide, from Croatia to Transylvania, but the king and his brother Andrew are at odds and the barons grow bold.',
  POL: 'The Piast realm is fractured among quarrelling dukes. Reunite the crown, and look north to the pagan Prussians and the Baltic.',
  DEN: 'Denmark is the great power of the north. The Baltic coasts and pagan Estonia lie open to Danish crusaders.',
  SIC: 'The heir of Normans and Hohenstaufen, Frederick, is a child of six. Regents squabble over the richest kingdom in Italy.',
  PAP: 'Innocent III, the most powerful pope of the age, would make kings his vassals and send all Christendom on crusade.',
  LIT: 'The pagan Lithuanian tribes are fierce but divided. Unite them, resist the crusaders, and build a great duchy from the ruins of the Rus\'.',
  CUM: 'The Cuman khans rule the endless steppe from the Danube to the Volga — but in the far east, the Mongols are stirring.',
  GEO: 'Queen Tamar presides over Georgia\'s golden age. Expand into Armenia and Shirvan, and set your cousins on the throne of Trebizond.',
  RUM: 'The Seljuk sultans of Rum hold the Anatolian plateau. Win ports on both seas and finish what Manzikert began.',
  SCO: 'William the Lion rules a proud kingdom in the shadow of England. Its spearmen know how to stand against knights.',
  NOV: 'Lord Novgorod the Great: a merchant republic of furs and silver ruled by its veche assembly, from the Baltic to the White Sea.',
  VLA: 'Vsevolod "Big Nest" is the strongest prince of the Rus\'. Gather the Russian lands under Vladimir.',
  ARA: 'Young Peter II rules Aragon and Catalonia, with ambitions in Occitania and across the sea to the Balearics and Sicily.',
  POR: 'The young kingdom of Portugal must push the Moors from the Alentejo and the Algarve.',
  JER: 'Jerusalem is lost; the kingdom clings to Acre and Tyre. Will the West come to its aid in time?',
  ABB: 'Caliph al-Nasir dreams of restoring the temporal power of the Abbasids from his palace in Baghdad.',
  BUL: 'Tsar Kaloyan, the "Roman-slayer", has restored the Bulgarian empire and eyes the weakness of Constantinople.',
};
const GREAT = ['ENG', 'FRA', 'HRE', 'BYZ', 'CAS', 'ALM', 'AYY', 'HUN', 'VEN', 'SIC', 'POL', 'DEN', 'RUM', 'PAP'];

export class StartScreen {
  constructor(ui, onStart) { this.ui = ui; this.g = ui.g; this.v = ui.v; this.onStart = onStart; this.sel = null; }
  show() {
    const g = this.g;
    this.root = el('div', { id: 'start' });
    const left = el('div', { class: 'start-left frame' });
    left.append(el('div', { class: 'start-title' }, el('div', { class: 't1' }, 'Crown & Conquest'), el('div', { class: 't2' }, 'EUROPE · ANNO DOMINI MCC')));
    const save = store.get('cc_saves');
    if (save && JSON.parse(save).length) {
      const last = JSON.parse(save).slice(-1)[0];
      left.append(el('div', { class: 'row', style: { padding: '0 10px 8px' } }, el('div', { class: 'btn primary grow', style: { justifyContent: 'center' }, onclick: () => { this.close(); this.ui.emit('load', last.key); } }, `▶ Continue: ${last.name}`)));
    }
    left.append(el('div', { class: 'section', style: { margin: '0 10px' } }, 'Choose your realm', el('span', { class: 'tiny muted' }, 'or click the map')));
    const list = el('div', { class: 'nlist scroll' });
    const nations = g.s.nations.filter((n) => n.alive);
    const power = new Map(nations.map((n) => [n.id, g.power(n.id)]));
    const rank = [...nations].sort((a, b) => power.get(b.id) - power.get(a.id));
    const diff = (n) => { const r = rank.indexOf(n); return r < 10 ? 1 : r < 25 ? 2 : r < 45 ? 3 : 4; };
    const DN = ['', 'Easy', 'Normal', 'Hard', 'Very hard'];
    const groups = [['Great Powers', nations.filter((n) => GREAT.includes(n.tag))], ['Kingdoms & Principalities', nations.filter((n) => !GREAT.includes(n.tag) && n.gov !== 'tribal')], ['Tribes & Hordes', nations.filter((n) => n.gov === 'tribal')]];
    this.items = new Map();
    for (const [title, ns] of groups) {
      list.append(el('div', { class: 'tag', style: { margin: '8px 4px 4px' } }, title));
      ns.sort((a, b) => power.get(b.id) - power.get(a.id));
      for (const n of ns) {
        const d = diff(n);
        const it = el('div', { class: 'nitem', onclick: () => this.select(n.id) });
        it.innerHTML = `${coaSVG(n.coa, 24)}<span class="grow nn">${n.name}</span><span class="diff d${d}">${DN[d]}</span>`;
        list.append(it);
        this.items.set(n.id, it);
      }
    }
    left.append(list);
    this.right = el('div', { class: 'start-right frame hidden' });
    this.root.append(left, this.right);
    document.getElementById('ui').append(this.root);
    this.onClick = (p) => { if (p >= 0 && p < g.L) this.select(g.s.prov[p].owner); };
    this.v.on('provinceClick', this.onClick);
    this.select(g.nationByTag('FRA').id, false);
  }
  select(nid, fly = true) {
    const g = this.g, n = g.s.nations[nid];
    if (!n || !this.root) return;
    this.sel = nid;
    for (const [id, it] of this.items) it.classList.toggle('on', id === nid);
    this.items.get(nid)?.scrollIntoView({ block: 'nearest' });
    if (fly && n.capital >= 0) this.v.flyToProvince(n.capital, 420);
    const r = g.s.chars[n.ruler];
    const owned = g.ownedProvinces(nid);
    const nb = g.neighbours(nid).map((x) => g.s.nations[x]).sort((a, b) => g.power(b.id) - g.power(a.id)).slice(0, 6);
    const men = g.armiesOf(nid).reduce((t, a) => t + g.armyMen(a), 0);
    this.right.classList.remove('hidden');
    this.right.innerHTML = `<div style="padding:12px"><div class="row" style="gap:12px">${coaSVG(n.coa, 64)}<div><div class="pname" style="font-size:20px">${n.name}</div><div class="muted small">${GOVS[n.gov].name} · ${n.religion} · ${n.culture}</div></div></div>
      <div class="row" style="margin-top:10px"><span class="portrait">${portraitSVG(r, g, 56)}</span><div><b>${g.rulerTitle(n)} ${g.charName(r)}</b><div class="small muted">age ${r ? g.age(r) : '?'}</div></div></div>
      <p style="font-style:italic;line-height:1.4">${BLURB[n.tag] || `A ${GOVS[n.gov].name.toLowerCase()} of ${owned.length} provinces. Survive among powerful neighbours, and perhaps one day rival them.`}</p>
      <div class="stat-grid"><div class="stat"><b>${owned.length}</b>Provinces</div><div class="stat"><b>${fmt(men)}</b>Soldiers</div><div class="stat"><b>${fmt(n.gold)}</b>Gold</div></div>
      <div class="section">Neighbours</div><div class="row wrap">${nb.map((x) => `<span class="chip">${coaSVG(x.coa, 14)} ${x.name}</span>`).join('')}</div></div>`;
    const foot = el('div', { style: { padding: '0 12px 12px' } });
    const tut = el('input', { type: 'checkbox', checked: 'checked', id: 'tutchk' });
    foot.append(el('label', { class: 'row small', style: { marginBottom: '8px' } }, tut, 'Play with the interactive tutorial'));
    foot.append(el('div', { class: 'btn primary', style: { width: '100%', justifyContent: 'center', fontSize: '17px', padding: '9px' }, onclick: () => { const t = tut.checked; this.close(); this.onStart(n.tag, t); } }, `⚔  Rule the ${n.adj}`));
    this.right.append(foot);
  }
  close() {
    if (!this.root) return;
    this.root.remove(); this.root = null;
    const L = this.v.listeners.provinceClick;
    if (L) L.splice(L.indexOf(this.onClick), 1);
  }
}
