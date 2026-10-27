// Validates the data tables (events, focus trees, innovations, formables): ids, tags, effect keys,
// references and event conditions, so content can't silently rot. Run by `npm run check`.
import path from 'path';
import { pathToFileURL } from 'url';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const load = (p) => import(pathToFileURL(path.join(root, p)).href);
const [{ EVENTS, HISTORY }, { buildFocusTree }, { INNOVATIONS, INNOV }, { FORMABLES }, { NATIONS }, { LAWS, GOVS }, { BUILDINGS }, { UNITS }, { CB_TYPES }] = await Promise.all([
  load('js/data/events.js'), load('js/data/focus.js'), load('js/data/innovations.js'), load('js/data/formables.js'), load('js/data/nations.js'),
  load('js/data/government.js'), load('js/data/buildings.js'), load('js/data/units.js'), load('js/sim/diplomacy.js'),
]);

const errs = [];
const bad = (where, msg) => errs.push(`${where}: ${msg}`);
const tags = new Set([...NATIONS.map((n) => n.tag), 'MON']);
const ESTATES = new Set(['nobles', 'clergy', 'burghers', 'peasants']);
const KEYS = new Set(['mods', 'mods_t', 'gold', 'prestige', 'iron', 'timber', 'horses', 'food', 'legitimacy', 'stability', 'manpower', 'claims', 'cb', 'unlock', 'build', 'law', 'loyalty', 'influence', 'opinion', 'gov', 'religion', 'unrest', 'devLoss', 'revolt', 'mercs', 'followup', 'holy']);
const num = (v) => typeof v === 'number' && Number.isFinite(v);

function checkMods(where, m) {
  if (!m || typeof m !== 'object') return bad(where, 'mods must be an object');
  for (const [k, v] of Object.entries(m)) if (!num(v)) bad(where, `mod ${k} is not a number`);
}
function checkEffects(where, effects, eventIds) {
  if (!Array.isArray(effects)) return bad(where, 'effects must be an array');
  for (const e of effects) for (const [k, v] of Object.entries(e)) {
    if (!KEYS.has(k)) { bad(where, `unknown effect "${k}"`); continue; }
    if (['gold', 'prestige', 'iron', 'timber', 'horses', 'food', 'legitimacy', 'stability', 'manpower'].includes(k) && !num(v)) bad(where, `${k} is not a number`);
    if (k === 'mods') checkMods(where, v);
    if (k === 'mods_t') { checkMods(where, v.mods); if (!(v.months > 0)) bad(where, 'mods_t needs months'); }
    if (k === 'claims' && v.tag && !tags.has(v.tag)) bad(where, `claim on unknown tag ${v.tag}`);
    if (k === 'cb' && v.kind !== 'holy_war' && !CB_TYPES[v.kind]) bad(where, `unknown cb kind ${v.kind}`);
    if (k === 'cb' && v.tag && !tags.has(v.tag)) bad(where, `cb on unknown tag ${v.tag}`);
    if (k === 'opinion' && v.tag && !tags.has(v.tag)) bad(where, `opinion of unknown tag ${v.tag}`);
    if (k === 'opinion' && !num(v.v)) bad(where, 'opinion needs v');
    if (k === 'law' && !LAWS[v.cat]?.options[v.opt]) bad(where, `unknown law ${v.cat}/${v.opt}`);
    if (k === 'build' && !BUILDINGS[v.type]) bad(where, `unknown building ${v.type}`);
    if (k === 'gov' && !GOVS[v.gov]) bad(where, `unknown gov ${v.gov}`);
    if ((k === 'loyalty' || k === 'influence') && Object.keys(v).some((x) => !ESTATES.has(x))) bad(where, `${k} with unknown estate`);
    if (k === 'unlock' && !UNITS[v] && !['roman_law', 'common_law_fast'].includes(v)) bad(where, `unknown unlock ${v}`);
    if (k === 'followup' && !eventIds.has(v.id)) bad(where, `followup to unknown event ${v.id}`);
    if (k === 'holy' && !(v.join || v.donate || v.ignore)) bad(where, 'holy needs join, donate or ignore');
    if (k === 'unrest' && !(v.n > 0 && num(v.v))) bad(where, 'unrest needs v and n');
  }
}

// ── events
const eventIds = new Set();
for (const e of [...EVENTS, ...HISTORY]) { if (eventIds.has(e.id)) bad(`event ${e.id}`, 'duplicate id'); eventIds.add(e.id); }
const stubEstates = () => Object.fromEntries([...ESTATES].map((k) => [k, { loyalty: 30, influence: 40 }]));
const stubGame = { season: () => 'autumn', atWar: () => false, maxUnrest: () => 0, countBuildings: () => 1, s: { day: 365 * 148 } };
for (const e of [...EVENTS, ...HISTORY]) {
  const w = `event ${e.id}`;
  if (!e.title || !e.desc) bad(w, 'needs title and desc');
  if (e.tag && !tags.has(e.tag)) bad(w, `unknown tag ${e.tag}`);
  if (e.options && !(e.options.length >= 1 && e.options.length <= 4)) bad(w, 'needs 1-4 options');
  for (const o of e.options || []) { if (!o.text) bad(w, 'option without text'); checkEffects(w, o.effects, eventIds); }
  if (EVENTS.includes(e) && !(e.chance >= 0 && e.chance < 1)) bad(w, 'bad chance');
  if (e.cond) for (const n of NATIONS) {
    try { e.cond({ ...n, estates: stubEstates(), legitimacy: 40, gold: 30, food: 30, warExhaustion: 8, prestige: 10 }, stubGame); } catch (x) { bad(w, `cond throws for ${n.tag}: ${x.message}`); break; }
  }
}
for (const e of EVENTS) if (e.chance === 0 && !e.system && ![...EVENTS, ...HISTORY].some((o) => (o.options || []).some((op) => op.effects.some((f) => f.followup?.id === e.id)))) bad(`event ${e.id}`, 'chance 0 but no event follows up to it');

// ── focus trees (every realm, plus the Mongol horde)
const gameStub = { nationByTag: () => ({ alive: true, name: 'X' }), ownedProvinces: () => [], map: { provinces: [] }, owner: () => -1, power: () => 1, cultureGroup: () => 'latin' };
const fnations = [...NATIONS, { tag: 'MON', name: 'Golden Horde', adj: 'Mongol', culture: 'cuman', religion: 'tengri', gov: 'tribal', id: 0 }];
for (const d of fnations) {
  const tree = buildFocusTree({ ...d, id: 0, focusRival: 'FRA' }, gameStub);
  const byId = new Map();
  for (const f of tree) { if (byId.has(f.id)) bad(`focus ${d.tag}/${f.id}`, 'duplicate id'); byId.set(f.id, f); }
  const pos = new Map();
  for (const f of tree) {
    const w = `focus ${d.tag}/${f.id}`;
    if (!f.name || !f.desc) bad(w, 'needs name and desc');
    for (const grp of f.pre) for (const p of grp) if (!byId.has(p)) bad(w, `unknown prerequisite ${p}`);
    for (const x of f.excl) { if (!byId.has(x)) bad(w, `unknown exclusion ${x}`); else if (!byId.get(x).excl.includes(f.id)) bad(w, `exclusion with ${x} is not mutual`); }
    checkEffects(w, f.effects, eventIds);
    const k = f.x + ',' + f.y;
    if (pos.has(k)) bad(w, `same grid cell as ${pos.get(k)}`); pos.set(k, f.id);
  }
}

// ── innovations
for (const i of INNOVATIONS) {
  const w = `innovation ${i.id}`;
  if (!i.name || !i.desc || !(i.era >= 0 && i.era <= 2)) bad(w, 'needs name, desc and era 0-2');
  for (const p of i.pre) if (!INNOV[p]) bad(w, `unknown prerequisite ${p}`); else if (INNOV[p].era > i.era) bad(w, `prerequisite ${p} is from a later era`);
  checkMods(w, i.mods);
  if (i.unlock && !UNITS[i.unlock] && i.unlock !== 'roman_law') bad(w, `unknown unlock ${i.unlock}`);
}

// ── formables
const fids = new Set();
for (const f of FORMABLES) {
  const w = `formable ${f.id}`;
  if (fids.has(f.id)) bad(w, 'duplicate id'); fids.add(f.id);
  for (const t of f.tags) if (!tags.has(t)) bad(w, `unknown tag ${t}`);
  if (!f.req?.region || f.req.region.length !== 4 || !(f.req.min > 0) || !(f.req.gold >= 0)) bad(w, 'bad req');
  checkEffects(w, f.effects, eventIds);
}

if (errs.length) { console.error(`data validation: ${errs.length} problem(s)\n  ` + errs.slice(0, 60).join('\n  ')); process.exit(1); }
console.log(`data OK: ${EVENTS.length} events, ${HISTORY.length} historical, ${INNOVATIONS.length} innovations, ${FORMABLES.length} formables, ${fnations.length} focus trees`);
