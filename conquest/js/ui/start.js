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

// Title art, drawn in code: a gilded crown over a laurel rule.
const CROWN_SVG = `<svg class="crown-art" viewBox="0 0 140 104" width="112" aria-hidden="true">
  <defs>
    <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c4"/><stop offset=".45" stop-color="#e8b94e"/><stop offset="1" stop-color="#8a5c14"/></linearGradient>
    <linearGradient id="cg2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <clipPath id="cc"><path d="M14 84 L22 30 L48 58 L70 14 L92 58 L118 30 L126 84 Z"/></clipPath>
  </defs>
  <path d="M14 84 L22 30 L48 58 L70 14 L92 58 L118 30 L126 84 Z" fill="url(#cg)" stroke="#5a3a0c" stroke-width="2.5" stroke-linejoin="round"/>
  <g clip-path="url(#cc)"><rect class="shine" x="-60" y="0" width="50" height="104" fill="url(#cg2)" transform="skewX(-20)"/></g>
  <path d="M30 70 L36 44 L52 64 L70 30 L88 64 L104 44 L110 70" fill="none" stroke="#fff3c8" stroke-opacity=".55" stroke-width="1.6" stroke-linejoin="round"/>
  <rect x="12" y="84" width="116" height="14" rx="4" fill="url(#cg)" stroke="#5a3a0c" stroke-width="2.5"/>
  <g fill="#c8372f" stroke="#5a1a14" stroke-width="1.4"><circle cx="40" cy="91" r="3.6"/><circle cx="70" cy="91" r="3.6"/><circle cx="100" cy="91" r="3.6"/></g>
  <g fill="#fff3c8" stroke="#5a3a0c" stroke-width="1.6"><circle cx="22" cy="28" r="5.5"/><circle cx="70" cy="12" r="6.5"/><circle cx="118" cy="28" r="5.5"/></g>
</svg>`;
const RULE_SVG = `<svg class="rule-art" viewBox="0 0 320 16" width="260" aria-hidden="true"><path d="M0 8 H128 M192 8 H320" stroke="#b2832a" stroke-width="1.2" opacity=".8"/><path d="M160 1 L169 8 L160 15 L151 8 Z" fill="#e8c56d" stroke="#7a5a1c"/><circle cx="138" cy="8" r="2.5" fill="#e8c56d"/><circle cx="182" cy="8" r="2.5" fill="#e8c56d"/></svg>`;
const DIFF_TEXT = ['', 'A mighty realm: forgiving, with many ways to win.', 'A solid state with room to grow, but real rivals.', 'Contested borders and few resources. Expect hardship.', 'A fragile realm among giants. Only for the bold.'];

export class StartScreen {
  constructor(ui, onStart) { this.ui = ui; this.g = ui.g; this.v = ui.v; this.onStart = onStart; this.sel = null; this.hard = false; this.tut = true; }
  show() {
    const g = this.g;
    this.root = el('div', { id: 'start' });
    const hero = el('div', { class: 'start-hero' });
    hero.innerHTML = `${CROWN_SVG}<div class="t1">Crown <em>&amp;</em> Conquest</div>${RULE_SVG}<div class="t2">Europe · Anno Domini MCC</div>`;
    const left = el('div', { class: 'start-left frame' });
    const save = store.get('cc_saves');
    if (save && JSON.parse(save).length) {
      const last = JSON.parse(save).slice(-1)[0];
      left.append(el('div', { class: 'row', style: { padding: '12px 12px 0' } }, el('div', { class: 'btn primary grow', style: { justifyContent: 'center' }, onclick: () => { this.close(); this.ui.emit('load', last.key); } }, `▶ Continue: ${last.name}`)));
    }
    const head = el('div', { class: 'section', style: { margin: '14px 16px 8px' } }, 'Choose your realm', el('span', { class: 'tiny muted' }, 'or click the map'));
    left.append(head);
    const search = el('input', { type: 'text', placeholder: 'Search realms…', class: 'start-search', oninput: (e) => this.filter(e.target.value) });
    left.append(el('div', { style: { padding: '0 14px 6px' } }, search));
    const list = el('div', { class: 'nlist scroll' });
    const nations = g.s.nations.filter((n) => n.alive);
    const power = new Map(nations.map((n) => [n.id, g.power(n.id)]));
    const rank = [...nations].sort((a, b) => power.get(b.id) - power.get(a.id));
    this.diff = (n) => { const r = rank.indexOf(n); return r < 10 ? 1 : r < 25 ? 2 : r < 45 ? 3 : 4; };
    const DN = ['', 'Easy', 'Normal', 'Hard', 'Very hard'];
    const groups = [['Great Powers', nations.filter((n) => GREAT.includes(n.tag))], ['Kingdoms & Principalities', nations.filter((n) => !GREAT.includes(n.tag) && n.gov !== 'tribal')], ['Tribes & Hordes', nations.filter((n) => n.gov === 'tribal')]];
    this.items = new Map(); this.heads = [];
    for (const [title, ns] of groups) {
      const h = el('div', { class: 'tag grp-head' }, title);
      list.append(h); this.heads.push([h, []]);
      ns.sort((a, b) => power.get(b.id) - power.get(a.id));
      for (const n of ns) {
        const d = this.diff(n);
        const it = el('div', { class: 'nitem', onclick: () => this.select(n.id) });
        it.dataset.name = n.name.toLowerCase();
        it.innerHTML = `${coaSVG(n.coa, 28)}<div class="grow"><div class="nn">${n.name}</div><div class="tiny muted">${GOVS[n.gov].name} · ${g.ownedProvinces(n.id).length} provinces</div></div><span class="diff d${d}">${DN[d]}</span>`;
        list.append(it);
        this.items.set(n.id, it);
        this.heads[this.heads.length - 1][1].push(it);
      }
    }
    left.append(list);
    this.right = el('div', { class: 'dossier hidden' });
    const foot = el('div', { class: 'start-foot' });
    foot.append(el('div', { class: 'btn ghost small', onclick: () => this.ui.settingsModal() }, '⚙ Settings'));
    this.root.append(hero, left, this.right, foot);
    document.getElementById('ui').append(this.root);
    this.onClick = (p) => { if (p >= 0 && p < g.L) this.select(g.s.prov[p].owner); };
    this.v.on('provinceClick', this.onClick);
    this.select(g.nationByTag('FRA').id, false);
  }
  filter(q) {
    q = q.trim().toLowerCase();
    for (const [h, its] of this.heads) {
      let any = false;
      for (const it of its) { const ok = !q || it.dataset.name.includes(q); it.style.display = ok ? '' : 'none'; any ||= ok; }
      h.style.display = any ? '' : 'none';
    }
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
    const d = this.diff(n), DN = ['', 'Easy', 'Normal', 'Hard', 'Very hard'];
    this.right.classList.remove('hidden');
    this.right.style.animation = 'none'; void this.right.offsetWidth; this.right.style.animation = '';
    this.right.innerHTML = `<div class="dz-top"><div class="dz-coa">${coaSVG(n.coa, 84)}</div><div class="grow"><div class="dz-name">${n.name}</div>
        <div class="dz-chips"><span>${GOVS[n.gov].name}</span><span>${n.religion}</span><span>${n.culture}</span></div></div></div>
      <div class="dz-diff d${d}"><b>${DN[d]}</b> · ${DIFF_TEXT[d]}</div>
      <div class="dz-ruler"><span class="portrait">${portraitSVG(r, g, 54)}</span><div><div class="tag">${g.rulerTitle(n)}</div><div class="dz-rn">${g.charName(r)}</div><div class="small dz-mut">age ${r ? g.age(r) : '?'}</div></div></div>
      <p class="dz-blurb">${BLURB[n.tag] || `A ${GOVS[n.gov].name.toLowerCase()} of ${owned.length} provinces. Survive among powerful neighbours, and perhaps one day rival them.`}</p>
      <div class="stat-grid"><div class="stat"><b>${owned.length}</b>Provinces</div><div class="stat"><b>${fmt(men)}</b>Soldiers</div><div class="stat"><b>${fmt(n.gold)}</b>Gold</div></div>
      <div class="dz-nb"><span class="tag">Neighbours</span>${nb.map((x) => `<span class="chip">${coaSVG(x.coa, 14)} ${x.name}</span>`).join('')}</div>`;
    const foot = el('div', { class: 'dz-foot' });
    const tut = el('input', { type: 'checkbox', id: 'tutchk' });
    tut.checked = this.tut; tut.onchange = () => { this.tut = tut.checked; };
    foot.append(el('label', { class: 'row small' }, tut, 'Guided tutorial'));
    const seg = el('div', { class: 'seg' });
    const diffSel = el('input', { type: 'hidden', id: 'diffsel', value: this.hard ? 'hard' : 'normal' });
    for (const [v, label, tip] of [['normal', 'Normal', 'Standard rivals'], ['hard', 'Hard', 'Richer, warlike rivals who target you']]) {
      const b = el('div', { class: 'seg-b' + ((v === 'hard') === this.hard ? ' on' : ''), onclick: () => { this.hard = v === 'hard'; diffSel.value = v; [...seg.children].forEach((c) => c.classList.toggle('on', c === b)); } }, label);
      b._tip = () => tip;
      seg.append(b);
    }
    foot.append(seg, diffSel);
    this.right.append(foot);
    this.right.append(el('div', { class: 'btn primary big dz-go', onclick: () => { const t = tut.checked; this.close(); this.onStart(n.tag, t, this.hard ? 'hard' : 'normal'); } }, `⚔  Rule the ${n.adj}`));
  }
  close() {
    if (!this.root) return;
    this.root.remove(); this.root = null;
    const L = this.v.listeners.provinceClick;
    if (L) L.splice(L.indexOf(this.onClick), 1);
  }
}
