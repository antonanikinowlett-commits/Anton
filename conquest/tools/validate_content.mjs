// Validates content data (focus trees, events) against the engine vocabulary. Usage: node tools/validate_content.mjs .
import path from 'path';
const root = path.resolve(process.argv[2]);
const imp = (f) => import(path.join(root, f));
const { buildFocusTree } = await imp('js/data/focus.js');
const { EVENTS, HISTORY } = await imp('js/data/events.js');
const { NATIONS } = await imp('js/data/nations.js');
const { LAWS, GOVS } = await imp('js/data/government.js');
const { UNITS } = await imp('js/data/units.js');
const { BUILDINGS } = await imp('js/data/buildings.js');
const MODS = new Set('taxMult tradeMult foodMult ironMult manpowerMult devGrowth fortDefense discipline armyMorale cavAtk cavCost infDef infAtk rangedAtk siege generalTactics diplo aeDecay focusSpeed legitimacyMonthly stabilityMonthly prestigeMonthly unrest unrestInfidel clergyLoyalty nobleLoyalty seaSpeed lootMult horsesMult trainSpeed supply recruitCost upkeepMult buildSpeed buildCost claimSpeed defenseHome papalOpinion'.split(' '));
const KEYS = new Set('mods mods_t gold prestige iron timber horses food legitimacy stability manpower claims cb unlock build law loyalty influence opinion gov religion unrest devLoss revolt mercs flag'.split(' '));
const TAGS = new Set([...NATIONS.map((n) => n.tag), 'MON']);
const ESTATES = new Set(['nobles', 'clergy', 'burghers', 'peasants']);
let errs = 0;
const err = (w, m) => { errs++; console.log('✗', w, m); };
function checkEffects(w, effs, focusIds) {
  if (!Array.isArray(effs)) return err(w, 'effects not array');
  for (const e of effs) for (const [k, v] of Object.entries(e)) {
    if (!KEYS.has(k)) err(w, 'unknown effect ' + k);
    if (k === 'mods' || k === 'mods_t') for (const m of Object.keys(k === 'mods' ? v : v.mods)) if (!MODS.has(m)) err(w, 'unknown mod ' + m);
    if (k === 'mods_t' && !(v.months > 0)) err(w, 'mods_t months');
    if (k === 'unlock' && !UNITS[v] && !['roman_law', 'common_law_fast'].includes(v)) err(w, 'unknown unlock ' + v);
    if (k === 'law' && !LAWS[v.cat]?.options[v.opt]) err(w, 'bad law ' + JSON.stringify(v));
    if (k === 'build' && !BUILDINGS[v.type]) err(w, 'bad build ' + v.type);
    if (k === 'claims' && v.tag && !TAGS.has(v.tag)) err(w, 'bad claim tag ' + v.tag);
    if (k === 'cb' && v.tag && !TAGS.has(v.tag)) err(w, 'bad cb tag ' + v.tag);
    if (k === 'opinion' && v.tag && !TAGS.has(v.tag)) err(w, 'bad opinion tag ' + v.tag);
    if (k === 'gov' && !GOVS[v.gov]) err(w, 'bad gov ' + v.gov);
    if ((k === 'loyalty' || k === 'influence')) for (const es of Object.keys(v)) if (!ESTATES.has(es)) err(w, 'bad estate ' + es);
    if (k === 'mercs') for (const u of Object.keys(v.regs)) if (!UNITS[u]) err(w, 'bad merc unit ' + u);
    if (['gold', 'prestige', 'iron', 'timber', 'horses', 'food', 'legitimacy', 'stability', 'manpower'].includes(k) && typeof v !== 'number') err(w, k + ' not number');
  }
}
const game = { nationByTag: (t) => ({ name: t, alive: true }), ownedProvinces: () => [], cultureGroup: (c) => (['cuman', 'turkish', 'turkic'].includes(c) ? 'turkic' : 'x'), power: () => 1, s: { nations: [] }, map: { provinces: [] } };
const defs = [...NATIONS, { tag: 'MON', name: 'Golden Horde', culture: 'cuman', religion: 'tengri', gov: 'tribal' }];
const counts = {};
for (const d of defs) {
  for (const gov of [d.gov]) {
    const n = { ...d, gov, focusRival: d.tag === 'FRA' ? 'ENG' : 'FRA' };
    const tree = buildFocusTree(n, game);
    const ids = new Map(), pos = new Map();
    for (const f of tree) {
      if (ids.has(f.id)) err(d.tag, 'dup id ' + f.id);
      ids.set(f.id, f);
      const k = f.x + ',' + f.y;
      if (pos.has(k)) err(d.tag, `pos clash ${f.id} / ${pos.get(k)} at ${k}`);
      pos.set(k, f.id);
      if (!f.name || !f.icon || !f.desc) err(d.tag, 'missing name/icon/desc ' + f.id);
    }
    for (const f of tree) {
      for (const g of f.pre) for (const x of g) { if (!ids.has(x)) err(d.tag, `${f.id} pre ${x} missing`); else if (ids.get(x).y >= f.y) err(d.tag, `${f.id} pre ${x} not above`); }
      for (const x of f.excl) { if (!ids.has(x)) err(d.tag, `${f.id} excl ${x} missing`); else if (!ids.get(x).excl.includes(f.id)) err(d.tag, `${f.id} excl ${x} not mutual`); }
      checkEffects(d.tag + ':' + f.id, f.effects);
    }
    const uniq = tree.filter((f) => f.x >= 20).length;
    counts[d.tag] = `${tree.length}/${uniq}`;
  }
}
console.log('trees (total/national):', Object.entries(counts).map(([k, v]) => k + ' ' + v).join(', '));
const evIds = new Set();
for (const e of [...EVENTS, ...HISTORY]) {
  if (evIds.has(e.id)) err('event', 'dup id ' + e.id);
  evIds.add(e.id);
  if (!e.title || !e.desc || !e.icon) err(e.id, 'missing title/desc/icon');
  if (e.options) { if (e.options.length < 1 || e.options.length > 3) err(e.id, 'options count ' + e.options.length); for (const o of e.options) { if (!o.text) err(e.id, 'option text'); checkEffects('event:' + e.id, o.effects); } }
  else if (!e.global) err(e.id, 'no options');
  if (e.tag && !TAGS.has(e.tag)) err(e.id, 'bad tag');
}
console.log(`events: ${EVENTS.length} random/dynamic + ${HISTORY.length} scripted = ${EVENTS.length + HISTORY.length}`);
console.log(errs ? `${errs} errors` : 'content OK');
process.exit(errs ? 1 : 0);
