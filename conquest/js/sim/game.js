// Core game state and the daily/monthly simulation loop.
import { NATIONS } from '../data/nations.js';
import { GOVS, defaultLaws, LAWS, COUNCIL_ROLES, ROLE_INFO } from '../data/government.js';
import { TRAITS, GEN_TRAIT_POOL, PERS_TRAIT_POOL } from '../data/traits.js';
import { groupOf, personName } from '../data/names.js';
import { BUILDINGS } from '../data/buildings.js';
import { mulberry32, clamp, dateOf, season, pick, hexToRgb } from '../util.js';
import { MilitaryMixin } from './military.js';
import { BattleMixin } from './battle.js';
import { DiplomacyMixin } from './diplomacy.js';
import { PoliticsMixin } from './politics.js';
import { AIMixin } from './ai.js';
import { FrontsMixin } from './fronts.js';
import { kmPerPx } from '../world/proj.js';

const TERRAIN_ECON = {
  farmland: { food: 3.0, dev: 3, supply: 1.3, move: 1.0, horses: 0.3 },
  plains: { food: 2.0, dev: 2, supply: 1.1, move: 1.0, horses: 0.5 },
  steppe: { food: 1.0, dev: 1, supply: 0.8, move: 1.05, horses: 1.0 },
  forest: { food: 1.0, dev: 1, supply: 0.8, move: 0.7, timber: 1.5 },
  taiga: { food: 0.5, dev: 0, supply: 0.5, move: 0.65, timber: 1.5 },
  hills: { food: 1.2, dev: 1, supply: 0.8, move: 0.7, iron: 0.5 },
  mountains: { food: 0.5, dev: 0, supply: 0.5, move: 0.45, iron: 1.0 },
  marsh: { food: 0.8, dev: 0, supply: 0.6, move: 0.5, timber: 0.5 },
  desert: { food: 0.3, dev: 0, supply: 0.4, move: 0.75, horses: 0.4 },
};
export { TERRAIN_ECON };

export class Game {
  constructor(map) {
    this.map = map;
    this.L = map.L;
    this.listeners = {};
    this.rng = mulberry32(Date.now() & 0xffffffff);
    // static derived data
    for (const p of map.provinces) p.kmpx = kmPerPx(p.cy);
    for (const p of map.provinces) {
      for (const e of p.adj) {
        const q = map.provinces[e.id];
        e.km = Math.max(15, Math.hypot(p.x - q.x, p.y - q.y) * (p.kmpx + q.kmpx) / 2);
      }
    }
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...a) { for (const f of this.listeners[ev] || []) f(...a); }

  // ── setup
  newGame(playerTag) {
    const m = this.map, rng = mulberry32(1200);
    this._owned = null; this._ft = null; this._wp = null;
    const s = this.s = { day: 0, player: -1, nextId: 1, nations: [], prov: [], armies: {}, battles: {}, wars: {}, chars: {}, log: [], notifications: [], eventQueue: [], firedHistory: [], recruit: [], fronts: {} };
    NATIONS.forEach((def, i) => {
      const n = {
        id: i, tag: def.tag, name: def.name, adj: def.adj, color: def.color, culture: def.culture, group: groupOf(def.culture), religion: def.religion, gov: def.gov,
        capital: m.capitals[i], alive: true, coa: def.coa,
        gold: 0, food: 80, iron: 10, timber: 15, horses: 6, manpower: 0, maxManpower: 0,
        prestige: 0, legitimacy: 70, stability: 1, warExhaustion: 0,
        laws: {}, lawVote: null, estates: {}, council: {}, ruler: null, heir: null,
        focus: { cur: null, prog: 0, done: [] }, opinion: {}, allies: [], naps: [], marriages: [], truces: {}, overlord: -1, cbs: [], ae: {},
        templates: [], unlocks: [], mods: [], ideas: {}, stats: { won: 0, lost: 0, killed: 0, lostMen: 0 }, ai: { aggro: 0.3 + rng() * 0.5, lastWar: -9999 },
      };
      n.laws = defaultLaws(n);
      const gi = GOVS[n.gov].estates;
      for (const k of Object.keys(gi)) n.estates[k] = { loyalty: 55 + Math.round(rng() * 15), influence: gi[k] };
      s.nations.push(n);
    });
    for (let p = 0; p < this.L; p++) {
      const sp = m.provinces[p];
      const te = TERRAIN_ECON[sp.terrain];
      const sizeF = clamp(Math.sqrt(sp.km2 / 2500), 0.6, 1.6);
      let dev = Math.round((2 + te.dev + sp.imp * 3 + (sp.river > 0.03 ? 2 : 0) + rng() * 2) * (sp.lat > 58 ? 0.6 : 1) * sizeF);
      if (sp.terrain === 'desert' && sp.river > 0.02) dev += 3;
      dev = clamp(dev, 1, 18);
      const owner = m.owner[p];
      const b = {};
      if (sp.imp >= 2) { b.market = sp.imp - 1; b.church = 1; }
      if (sp.imp >= 3) { b.walls = 2; b.church = 2; }
      else if (sp.imp >= 1 && rng() < 0.4) b.walls = 1;
      if (te.food >= 2 && rng() < 0.5) b.farm = 1;
      if (sp.coastal && sp.imp >= 2) b.port = 1;
      s.prov.push({ owner, controller: owner, dev, buildings: b, queue: [], unrest: 0, claims: [], siege: null, occ: 0, devast: 0, culture: sp.culture, religion: sp.religion, garrison: 1 });
    }
    // capitals get a castle and extra development
    for (const n of s.nations) {
      if (n.capital < 0) { const ps = this.ownedProvinces(n.id); n.capital = ps.length ? ps[0] : -1; }
      if (n.capital >= 0) {
        const cp = s.prov[n.capital];
        cp.dev += 4;
        cp.buildings.walls = Math.max(cp.buildings.walls || 0, 2);
        cp.buildings.barracks = 1;
        cp.buildings.church = Math.max(cp.buildings.church || 0, 1);
      }
      const owned = this.ownedProvinces(n.id);
      if (!owned.length) { n.alive = false; continue; }
      const dev = owned.reduce((a, p) => a + s.prov[p].dev, 0);
      n.gold = Math.round(30 + dev * 0.5);
      n.maxManpower = this.calcMaxManpower(n.id);
      n.manpower = Math.round(n.maxManpower * 0.7);
      n.prestige = Math.round(Math.sqrt(dev) * 3);
      this.initCourt(n, NATIONS[n.id], rng);
      this.initTemplates(n);
    }
    // relations
    for (const a of s.nations) for (const b of s.nations) if (a !== b) a.opinion[b.id] = this.baseOpinion(a, b);
    // a few historical alliances and marriages
    const ally = (x, y) => { const A = this.nationByTag(x), B = this.nationByTag(y); if (A && B) { A.allies.push(B.id); B.allies.push(A.id); } };
    ally('FRA', 'BRI'); ally('HRE', 'SIC'); ally('SAX', 'ENG'); ally('JER', 'CYP'); ally('JER', 'ANT'); ally('BUL', 'CUM'); ally('GEO', 'CIL'); ally('LEO', 'POR');
    ally('CAS', 'ARA'); ally('POL', 'HUN'); ally('LOM', 'PAP');
    // starting rivalries: claims that drove the wars of the age
    this.addClaimsBox('FRA', 'ENG', [-5, 42.5, 7, 51], 0.4);
    this.addClaimsBox('CAS', 'ALM', [-10, 36, 4, 42.5], 0.3);
    this.addClaimsBox('AYY', 'JER', null, 1);
    this.addClaimsBox('BUL', 'BYZ', [21, 40.8, 28, 42.6], 0.4);
    this.addClaimsBox('RUM', 'BYZ', [28, 36, 33, 41], 0.3);
    this.addClaimsBox('DEN', 'EST', null, 0.5);
    // initial armies
    for (const n of s.nations) if (n.alive) this.spawnStartingArmies(n);
    this.setPlayer(playerTag);
    for (const n of s.nations) if (n.alive) this.recalcMods(n.id);
    this.emit('reset');
  }

  setPlayer(tag) {
    const n = this.nationByTag(tag);
    this.s.player = n ? n.id : -1;
    if (n) { n.gold += 40; }
  }

  get player() { return this.s.nations[this.s.player]; }
  nationByTag(tag) { return this.s.nations.find((n) => n.tag === tag); }
  owner(p) { return p < this.L ? this.s.prov[p].owner : -1; }
  controller(p) { return p < this.L ? this.s.prov[p].controller : -1; }
  ownedProvinces(nid) {
    if (!this._owned) {
      this._owned = this.s.nations.map(() => []);
      for (let p = 0; p < this.L; p++) { const o = this.s.prov[p].owner; if (o >= 0) this._owned[o].push(p); }
    }
    return this._owned[nid] || [];
  }
  setOwner(p, nid) {
    const pr = this.s.prov[p];
    const old = pr.owner;
    pr.owner = nid; pr.controller = nid; pr.siege = null; pr.occ = 0; pr.queue = [];
    pr.claims = pr.claims.filter((c) => c !== nid);
    this._owned = null;
    for (const n of this.s.nations) if (n.capital === p && n.id !== nid) n.capital = -1;
    if (nid >= 0 && this.s.nations[nid].capital < 0) this.s.nations[nid].capital = p;
    if (old >= 0) {
      const o = this.s.nations[old];
      if (o.capital < 0) { const ps = this.ownedProvinces(old); if (ps.length) { o.capital = ps.reduce((a, b) => (this.s.prov[b].dev > this.s.prov[a].dev ? b : a)); } }
      if (!this.ownedProvinces(old).length) this.annihilate(old);
    }
    this.emit('owner', p, old, nid);
  }
  cultureGroup(c) { return groupOf(c); }
  season() { return season(this.s.day); }
  date() { return dateOf(this.s.day); }
  provName(p) { return this.map.provinces[p].name; }
  log(text, opts = {}) {
    this.s.log.unshift({ day: this.s.day, text, ...opts });
    if (this.s.log.length > 250) this.s.log.length = 250;
    this.emit('log', text, opts);
  }
  notify(n) { if (n.nation === undefined || n.nation === this.s.player) this.emit('notify', n); }
  newId() { return this.s.nextId++; }
  rgb(nid) { return nid >= 0 ? hexToRgb(this.s.nations[nid].color) : [120, 120, 120]; }
  rulerTitle(n) {
    const r = this.s.chars[n.ruler], f = r && r.female;
    const T = [['Grand Principality', 'Grand Prince', 'Grand Princess'], ['Grand Duchy', 'Grand Duke', 'Grand Duchess'], ['Principality', 'Prince', 'Princess'], ['Duchy', 'Duke', 'Duchess'],
      ['Margraviate', 'Margrave', 'Margravine'], ['County', 'Count', 'Countess'], ['Tsardom', 'Tsar', 'Tsaritsa'], ['Banate', 'Ban', 'Banica'], ['Atabegate', 'Atabeg', 'Atabeg'],
      ['Khanate', 'Khan', 'Khatun'], ['Horde', 'Khan', 'Khatun'], ['Shirvanshah', 'Shah', 'Shahbanu'], ['Zengid', 'Emir', 'Emira'], ['Novgorod', 'Posadnik', 'Posadnitsa'], ['League', 'Rector', 'Rector'],
      ['Florence', 'Gonfaloniere', 'Gonfaloniere'], ['Pisa', 'Podestà', 'Podestà'], ['Genoa', 'Podestà', 'Podestà'], ['Tribes', 'Chieftain', 'Chieftess'], ['Gwynedd', 'Prince', 'Princess'],
      ['Byzantine', 'Basileus', 'Basilissa'], ['Holy Roman', 'Emperor', 'Empress'], ['Kingdom', 'King', 'Queen']];
    for (const [k, m, w] of T) if (n.name.includes(k)) return f ? w : m;
    const g = GOVS[n.gov];
    return f ? g.rulerF : g.ruler;
  }

  // ── characters
  makeChar(n, role, opts = {}) {
    const rng = this.rng;
    const [first, dyn] = opts.name || personName(rng, n.culture);
    const c = { id: this.newId(), first, dyn, nation: n.id, role, female: !!opts.female, birth: this.s.day - (opts.age ?? (25 + Math.floor(rng() * 30))) * 365,
      skills: { martial: 0, diplomacy: 0, stewardship: 0, intrigue: 0, learning: 0 }, traits: [], gen: null, army: null, seed: Math.floor(rng() * 1e9), xp: 0 };
    for (const k of Object.keys(c.skills)) c.skills[k] = Math.round(2 + rng() * 10);
    if (opts.focusSkill) c.skills[opts.focusSkill] += 4 + Math.round(rng() * 6);
    if (opts.traits) c.traits = [...opts.traits];
    else {
      c.traits.push(pick(rng, PERS_TRAIT_POOL));
      if (rng() < 0.4) { const t = pick(rng, PERS_TRAIT_POOL); if (!c.traits.includes(t) && !(t === 'brave' && c.traits.includes('craven')) && !(t === 'craven' && c.traits.includes('brave'))) c.traits.push(t); }
    }
    if (role === 'general') this.makeGeneral(c, opts.traits);
    this.s.chars[c.id] = c;
    return c;
  }
  makeGeneral(c, traits) {
    const rng = this.rng;
    const sk = c.skills.martial;
    c.gen = { atk: Math.round(sk / 4 + rng() * 2), def: Math.round(sk / 4 + rng() * 2), tactics: Math.round(sk / 3 + rng() * 2), siege: Math.round(rng() * 3), logistics: Math.round(rng() * 3) };
    if (!traits || !traits.some((t) => TRAITS[t].mil)) {
      const t = pick(rng, GEN_TRAIT_POOL);
      if (!c.traits.includes(t)) c.traits.push(t);
    }
  }
  age(c) { return Math.floor((this.s.day - c.birth) / 365); }
  charName(c) { return c ? `${c.first} ${c.dyn}` : '—'; }
  hasTrait(c, t) { return !!c && c.traits.includes(t); }

  initCourt(n, def, rng) {
    const [rf, rd, ra, rt, sex] = def.ruler;
    const r = this.makeChar(n, 'ruler', { name: [rf, rd], age: ra, traits: rt, female: sex === 'f' });
    r.skills.martial += 3; r.skills.diplomacy += 2; r.skills.stewardship += 2;
    if (rt.some((t) => TRAITS[t].mil)) this.makeGeneral(r, rt);
    n.ruler = r.id;
    if (!['merchant_republic', 'theocracy', 'elective_monarchy'].includes(n.gov) && ra > 18) {
      const h = this.makeChar(n, 'heir', { name: [personName(rng, n.culture)[0], rd], age: Math.max(1, ra - 22 - Math.floor(rng() * 8)) });
      n.heir = h.id;
    }
    for (const role of COUNCIL_ROLES) {
      const c = this.makeChar(n, 'minister', { focusSkill: ROLE_INFO[role].skill });
      c.office = role; n.council[role] = c.id;
    }
    // generals
    const famous = def.famous || [];
    let gens = 0;
    for (const [f, d, role, age, traits] of famous) {
      const c = this.makeChar(n, role === 'general' ? 'general' : 'minister', { name: [f, d], age, traits, focusSkill: role === 'general' ? 'martial' : 'stewardship' });
      if (role === 'general') { c.skills.martial += 4; c.gen.atk += 1; c.gen.tactics += 2; c.gen.def += 1; gens++; }
      else { // replace the weakest minister
        const roleKey = c.traits.includes('scholar') ? 'chaplain' : c.traits.includes('diligent') ? 'steward' : 'chancellor';
        delete this.s.chars[n.council[roleKey]];
        c.office = roleKey; n.council[roleKey] = c.id; c.skills[ROLE_INFO[roleKey].skill] += 6;
      }
    }
    const want = clamp(Math.round(this.ownedProvinces(n.id).length / 25) + 1, 1, 4);
    for (; gens < want; gens++) this.makeChar(n, 'general', { focusSkill: 'martial' });
    // a candidate pool for appointments
    for (let i = 0; i < 4; i++) this.makeChar(n, 'pool', { focusSkill: pick(rng, ['diplomacy', 'martial', 'stewardship', 'intrigue', 'learning']) });
  }
  charsOf(nid, role) { return Object.values(this.s.chars).filter((c) => c.nation === nid && (!role || c.role === role)); }

  initTemplates(n) {
    const grp = n.group;
    const T = (name, regs, doctrine = 'balanced') => ({ id: this.newId(), name, regs, doctrine });
    n.templates = [];
    if (n.gov === 'tribal' && (n.religion === 'tengri' || grp === 'turkic')) {
      n.templates.push(T('Steppe Horde', { horse_archers: 6, light_cav: 3, levy_spear: 2 }, 'missile'), T('Raiding Party', { horse_archers: 4, light_cav: 2 }, 'maneuver'));
    } else if (n.gov === 'tribal') {
      n.templates.push(T('War Band', { levy_spear: 6, archers: 3, light_cav: 1 }), T('Forest Raiders', { levy_spear: 3, archers: 3 }, 'maneuver'));
    } else if (['sunni'].includes(n.religion)) {
      n.templates.push(T('Askar', { levy_spear: 4, archers: 3, light_cav: 2, knights: 1 }), T('Cavalry Corps', { light_cav: 3, knights: 2, archers: 1 }, 'maneuver'), T('Siege Army', { levy_spear: 3, archers: 2, trebuchet: 2 }, 'defensive'));
    } else if (n.gov === 'merchant_republic') {
      n.templates.push(T('City Militia', { levy_spear: 3, pikemen: 2, crossbowmen: 3, knights: 1 }, 'defensive'), T('Condotta', { men_at_arms: 3, crossbowmen: 2, light_cav: 2 }), T('Siege Army', { men_at_arms: 2, crossbowmen: 2, trebuchet: 2 }, 'defensive'));
    } else {
      n.templates.push(T('Feudal Host', { levy_spear: 5, men_at_arms: 2, archers: 2, knights: 1 }), T('Chevauchée', { light_cav: 2, knights: 2, men_at_arms: 2 }, 'shock'), T('Siege Army', { levy_spear: 3, men_at_arms: 2, archers: 1, trebuchet: 2 }, 'defensive'));
    }
  }

  // ── modifiers
  recalcMods(nid) {
    const n = this.s.nations[nid];
    const M = {};
    const add = (mods, f = 1) => { if (mods) for (const [k, v] of Object.entries(mods)) M[k] = (M[k] || 0) + v * f; };
    for (const [cat, opt] of Object.entries(n.laws)) add(LAWS[cat]?.options[opt]?.mods);
    for (const m of n.mods) if (!m.until || m.until > this.s.day) add(m.mods);
    const ruler = this.s.chars[n.ruler];
    if (ruler) for (const t of ruler.traits) add(TRAITS[t].mods);
    for (const role of COUNCIL_ROLES) {
      const c = this.s.chars[n.council[role]];
      if (!c) { M.stabilityMonthly = (M.stabilityMonthly || 0) - 0.01; continue; }
      const sk = c.skills[ROLE_INFO[role].skill] + (ruler && role === 'chancellor' ? 0 : 0);
      if (role === 'chancellor') add({ diplo: sk, aeDecay: sk * 0.02, claimSpeed: sk * 0.03 });
      if (role === 'marshal') add({ discipline: sk * 0.004, manpowerMult: sk * 0.01, trainSpeed: sk * 0.02 });
      if (role === 'steward') add({ taxMult: sk * 0.01, buildSpeed: sk * 0.02 });
      if (role === 'spymaster') add({ unrest: -sk * 0.15, claimSpeed: sk * 0.02 });
      if (role === 'chaplain') add({ legitimacyMonthly: sk * 0.006, clergyLoyalty: sk * 0.4, focusSpeed: sk * 0.01 });
      for (const t of c.traits) if (TRAITS[t].mods) add(TRAITS[t].mods, 0.5);
    }
    if (n.gov === 'merchant_republic') add({ tradeMult: 0.25, manpowerMult: -0.2 });
    if (n.gov === 'tribal') add({ taxMult: -0.3, manpowerMult: 0.3, buildSpeed: -0.2 });
    if (n.gov === 'imperial') add({ taxMult: 0.1 });
    if (n.gov === 'theocracy') add({ legitimacyMonthly: 0.05 });
    if (n.stability) add({ taxMult: n.stability * 0.04, unrest: -n.stability * 1.5 });
    if (n.warExhaustion) add({ unrest: n.warExhaustion * 0.4, manpowerMult: -n.warExhaustion * 0.01 });
    n._m = M;
    return M;
  }
  mod(nid, key) { const n = this.s.nations[nid]; if (!n) return 0; return (n._m || this.recalcMods(nid))[key] || 0; }

  // ── economy
  calcMaxManpower(nid) {
    let mp = 0;
    for (const p of this.ownedProvinces(nid)) {
      const pr = this.s.prov[p];
      mp += pr.dev * 120 * (pr.controller === nid ? 1 : 0.3) * (1 + 0.25 * (pr.buildings.barracks || 0));
    }
    return Math.round(mp * (1 + this.mod(nid, 'manpowerMult')));
  }

  provinceIncome(p, nid) {
    const pr = this.s.prov[p], sp = this.map.provinces[p], b = pr.buildings, te = TERRAIN_ECON[sp.terrain];
    const ctl = pr.controller === nid ? 1 : 0;
    const unrestF = 1 - pr.unrest / 200;
    const sameFaith = pr.religion === this.s.nations[nid].religion ? 1 : 0.85;
    const devast = 1 - pr.devast / 100;
    const tax = pr.dev * 0.055 * (1 + 0.15 * (b.market || 0)) * ctl * unrestF * sameFaith * devast;
    const trade = ((b.market || 0) * 0.3 + (b.port || 0) * 0.45 + (sp.imp >= 2 ? 0.25 : 0)) * (1 + pr.dev / 20) * ctl * devast;
    const food = (te.food * 0.35 * (1 + 0.6 * (b.farm || 0)) + (sp.river > 0.03 ? 0.2 : 0)) * ctl * devast - pr.dev * 0.03;
    const iron = ((te.iron || 0) * 0.2 + (b.mine || 0) * (0.8 + (te.iron || 0) * 0.6)) * ctl;
    const timber = ((te.timber || 0) * 0.3 + (b.lumber || 0) * 1.2) * ctl;
    const horses = ((te.horses || 0) * 0.15 + (b.stables || 0) * 0.6) * ctl;
    const goldMine = (b.mine || 0) * 0.3 * ctl;
    return { tax, trade, food, iron, timber, horses, goldMine };
  }

  budget(nid) {
    const n = this.s.nations[nid];
    const B = { tax: 0, trade: 0, mines: 0, food: 0, iron: 0, timber: 0, horses: 0, armyUpkeep: 0, armyFood: 0, court: 0, admin: 0, interest: 0, tribute: 0 };
    for (const p of this.ownedProvinces(nid)) {
      const i = this.provinceIncome(p, nid);
      B.tax += i.tax; B.trade += i.trade; B.mines += i.goldMine; B.food += i.food; B.iron += i.iron; B.timber += i.timber; B.horses += i.horses;
    }
    B.tax *= 1 + this.mod(nid, 'taxMult');
    B.trade *= 1 + this.mod(nid, 'tradeMult');
    B.food *= B.food > 0 ? 1 + this.mod(nid, 'foodMult') : 1;
    B.iron *= 1 + this.mod(nid, 'ironMult');
    B.horses *= 1 + this.mod(nid, 'horsesMult');
    for (const a of this.armiesOf(nid)) {
      const up = this.armyUpkeep(a);
      B.armyUpkeep += up.gold; B.armyFood += up.food;
    }
    B.armyUpkeep *= 1 + this.mod(nid, 'upkeepMult');
    const owned = this.ownedProvinces(nid);
    B.admin = owned.length * 0.06 + owned.reduce((t, p) => t + this.s.prov[p].dev, 0) * 0.006;
    B.court = 0.4 * COUNCIL_ROLES.filter((r) => n.council[r]).length + 0.3 * this.charsOf(nid, 'general').length;
    if (n.gold < 0) B.interest = -n.gold * 0.02;
    // vassal tribute
    for (const v of this.s.nations) if (v.alive && v.overlord === nid) B.tribute += 1 + this.ownedProvinces(v.id).length * 0.08;
    if (n.overlord >= 0) B.tribute -= 1 + this.ownedProvinces(nid).length * 0.08;
    B.income = B.tax + B.trade + B.mines + Math.max(0, B.tribute);
    B.expense = B.armyUpkeep + B.court + B.admin + B.interest + Math.max(0, -B.tribute);
    B.net = B.income - B.expense;
    B.foodNet = B.food - B.armyFood;
    return B;
  }

  // ── main loop
  tickDay() {
    const s = this.s;
    s.day++;
    this.dailyArmies();
    this.dailyFronts();
    this.dailyBattles();
    this.dailySieges();
    this.dailyConstruction();
    this.dailyPolitics();
    if (dateOf(s.day).d === 1) this.monthly();
    this.dailyAI();
    this.emit('day', s.day);
  }

  monthly() {
    const s = this.s;
    for (const n of s.nations) {
      if (!n.alive) continue;
      this.recalcMods(n.id);
      const B = this.budget(n.id);
      n.gold += B.net;
      n.food = clamp(n.food + B.foodNet, -200, 300 + this.ownedProvinces(n.id).length * 6);
      n.iron = Math.max(0, n.iron + B.iron);
      n.timber = Math.max(0, n.timber + B.timber);
      n.horses = Math.max(0, n.horses + B.horses);
      n.maxManpower = this.calcMaxManpower(n.id);
      n.manpower = Math.min(n.maxManpower, n.manpower + n.maxManpower / 60 * (n.food < 0 ? 0.3 : 1));
      if (n.food < 0) { n.stability = Math.max(-3, n.stability - 0.05); }
      if (n.gold < -50) { n.stability = Math.max(-3, n.stability - 0.1); this.estateDelta(n, 'nobles', -1); }
      n.prestige = clamp(n.prestige * 0.995 + this.mod(n.id, 'prestigeMonthly') * 10, -100, 500);
      n.legitimacy = clamp(n.legitimacy + 0.1 + this.mod(n.id, 'legitimacyMonthly') * 10 - (n.gold < 0 ? 0.5 : 0), 0, 100);
      n.stability = clamp(n.stability + this.mod(n.id, 'stabilityMonthly') * 3 + (n.legitimacy > 60 ? 0.02 : n.legitimacy < 30 ? -0.04 : 0), -3, 3);
      n.warExhaustion = Math.max(0, n.warExhaustion - (this.atWar(n.id) ? 0.05 : 0.4));
      this.monthlyEstates(n);
      this.monthlyCharacters(n);
      this.monthlyDiplomacy(n);
    }
    this.monthlyProvinces();
    this.monthlyEvents();
    this.emit('month');
  }

  monthlyProvinces() {
    const s = this.s;
    for (let p = 0; p < this.L; p++) {
      const pr = s.prov[p];
      if (pr.owner < 0) continue;
      const n = s.nations[pr.owner];
      const sp = this.map.provinces[p];
      let target = 0;
      if (pr.culture !== n.culture && groupOf(pr.culture) !== n.group) target += 8;
      else if (pr.culture !== n.culture) target += 3;
      if (pr.religion !== n.religion) target += 10 + this.mod(n.id, 'unrestInfidel') * 4;
      if (pr.controller !== pr.owner) target += 15;
      target += this.mod(n.id, 'unrest') * 3 + pr.devast * 0.2 - (pr.buildings.church || 0) * 4 + (n.food < 0 ? 10 : 0);
      target += (3 - (n.estates.peasants?.loyalty ?? 50) / 20);
      pr.unrest = clamp(pr.unrest + (target - pr.unrest) * 0.08, 0, 100);
      pr.devast = Math.max(0, pr.devast - 2);
      // conversion by churches
      if (pr.religion !== n.religion && (pr.buildings.church || 0) > 0 && this.rng() < 0.004 * pr.buildings.church * (1 + this.mod(n.id, 'legitimacyMonthly') * 5)) {
        pr.religion = n.religion; this.emit('province', p);
      }
      // development growth
      const growth = 0.008 * (1 + (pr.buildings.farm || 0) * 0.3 + (pr.buildings.market || 0) * 0.3 + this.mod(n.id, 'devGrowth')) * (pr.unrest > 40 ? 0 : 1) * (pr.controller === pr.owner ? 1 : 0);
      if (this.rng() < growth && pr.dev < 30) { pr.dev++; }
      if (sp && pr.garrison < 1) pr.garrison = Math.min(1, pr.garrison + 0.1);
      // rebellion
      if (pr.unrest > 60 && pr.controller === pr.owner && this.rng() < (pr.unrest - 55) / 600) this.spawnRebels(p);
    }
  }

  estateDelta(n, e, v) { if (n.estates[e]) n.estates[e].loyalty = clamp(n.estates[e].loyalty + v, 0, 100); }
  monthlyEstates(n) {
    const key = { nobles: 'nobleLoyalty', clergy: 'clergyLoyalty', burghers: 'burgherLoyalty', peasants: 'peasantLoyalty' };
    const base = GOVS[n.gov].estates;
    for (const [e, st] of Object.entries(n.estates)) {
      const target = 50 + this.mod(n.id, key[e]) + (n.stability * 3) + (e === 'nobles' && this.atWar(n.id) ? -3 : 0);
      st.loyalty = clamp(st.loyalty + (target - st.loyalty) * 0.03, 0, 100);
      let inf = base[e];
      for (const [cat, opt] of Object.entries(n.laws)) inf += LAWS[cat]?.options[opt]?.infl?.[e] || 0;
      inf += n.estateInfl?.[e] || 0;
      if (e === 'burghers') inf += Math.min(15, this.countBuildings(n.id, 'market') * 0.3);
      if (e === 'clergy') inf += Math.min(10, this.countBuildings(n.id, 'church') * 0.15);
      st.influence = clamp(st.influence + (inf - st.influence) * 0.1, 2, 80);
    }
    // estates in open revolt
    const no = n.estates.nobles;
    if (no && no.loyalty < 15 && no.influence > 40 && this.rng() < 0.05) {
      this.spawnRebels(this.ownedProvinces(n.id).filter((p) => p !== n.capital)[0] ?? n.capital, true);
      this.log(`The ${n.adj} nobility rises in revolt!`, { nation: n.id, type: 'war' });
    }
  }

  monthlyCharacters(n) {
    const s = this.s;
    const ruler = s.chars[n.ruler];
    const deathP = (c) => { const a = this.age(c); return a < 45 ? 0.0008 : 0.0008 + (a - 45) ** 2 * 0.00003; };
    for (const c of this.charsOf(n.id)) {
      if (this.rng() < deathP(c)) this.killChar(c, 'died of natural causes');
    }
    if (!s.chars[n.ruler]) this.succession(n);
    // elections in republics
    if (n.gov === 'merchant_republic' && n.laws.succession === 'term_elections' && dateOf(s.day).m === 0 && (dateOf(s.day).y % 4 === 0)) {
      if (ruler) { ruler.role = 'pool'; }
      this.succession(n);
    }
    // heirs
    if (!n.heir && !['merchant_republic', 'theocracy', 'elective_monarchy', 'caliphate'].includes(n.gov) && ruler && this.age(ruler) > 20 && this.age(ruler) < 55 && this.rng() < 0.02) {
      const h = this.makeChar(n, 'heir', { name: [personName(this.rng, n.culture)[0], ruler.dyn], age: 0 });
      n.heir = h.id;
      if (n.id === s.player) this.log(`An heir is born: ${this.charName(h)}.`, { nation: n.id, type: 'court' });
    }
    // refresh candidate pool
    const pool = this.charsOf(n.id, 'pool');
    if (pool.length < 4 && this.rng() < 0.2) this.makeChar(n, 'pool', { focusSkill: pick(this.rng, ['diplomacy', 'martial', 'stewardship', 'intrigue', 'learning']) });
    if (pool.length > 8) this.killChar(pool[0], 'left court');
  }

  killChar(c, why) {
    const s = this.s, n = s.nations[c.nation];
    delete s.chars[c.id];
    if (c.army) { const a = s.armies[c.army]; if (a) a.general = null; }
    if (!n) return;
    if (c.office && n.council[c.office] === c.id) n.council[c.office] = null;
    if (n.heir === c.id) n.heir = null;
    if (n.id === s.player && ['ruler', 'heir', 'general', 'minister'].includes(c.role)) {
      this.log(`${this.charName(c)} ${why}.`, { nation: n.id, type: 'court' });
    }
    this.recalcMods(n.id);
  }

  succession(n) {
    const s = this.s;
    const old = s.chars[n.ruler];
    let heir = s.chars[n.heir];
    let crisis = false;
    if (!heir || n.gov === 'elective_monarchy' || n.gov === 'merchant_republic' || n.gov === 'theocracy' || n.laws.succession === 'tanistry' || n.laws.succession === 'seniority') {
      // electors/council choose the most capable of a few candidates
      const cands = [heir, ...this.charsOf(n.id, 'pool'), ...this.charsOf(n.id, 'general')].filter(Boolean).filter((c) => this.age(c) >= 16);
      if (!cands.length) cands.push(this.makeChar(n, 'pool', { age: 30 + Math.floor(this.rng() * 20) }));
      cands.sort((a, b) => (b.skills.diplomacy + b.skills.martial + b.skills.stewardship) - (a.skills.diplomacy + a.skills.martial + a.skills.stewardship));
      heir = cands[0];
      if (n.gov === 'merchant_republic' || n.gov === 'theocracy') heir.birth = Math.min(heir.birth, s.day - 50 * 365);
    } else if (this.age(heir) < 16) crisis = true;
    if (heir.office && n.council[heir.office] === heir.id) n.council[heir.office] = null;
    if (heir.army) { const a = s.armies[heir.army]; if (a) a.general = heir.id; }
    heir.role = 'ruler'; heir.office = null;
    n.ruler = heir.id; n.heir = null;
    if (n.laws.succession === 'gavelkind') { n.stability -= 0.5; this.estateDelta(n, 'nobles', 10); }
    if (crisis) { n.legitimacy = Math.max(0, n.legitimacy - 25); n.stability = Math.max(-3, n.stability - 1); }
    else n.legitimacy = clamp(n.legitimacy - 10 + (n.laws.succession === 'primogeniture' ? 10 : 0), 0, 100);
    if (n.laws.succession === 'tanistry') heir.skills.martial += 2;
    if (old) old.role = 'dead';
    this.recalcMods(n.id);
    const t = this.rulerTitle(n);
    this.log(`${t} ${this.charName(heir)} now rules the ${n.name}${crisis ? ' — a child ruler! A regency council governs.' : '.'}`, { nation: n.id, type: 'court', important: n.id === s.player });
    if (n.id === s.player) this.notify({ title: 'Succession', icon: '👑', text: `${t} ${this.charName(heir)} has succeeded to the throne.` });
  }

  // invest in a province: settlers, clearings, new villages
  developCost(p) { return Math.round(30 + this.s.prov[p].dev * 7); }
  developProvince(nid, p) {
    const pr = this.s.prov[p], n = this.s.nations[nid];
    if (pr.owner !== nid || pr.controller !== nid) return 'Must own and control the province';
    if (pr.dev >= 30) return 'Fully developed';
    const c = this.developCost(p);
    if (n.gold < c) return `Need ${c} gold`;
    n.gold -= c; pr.dev++;
    this.emit('province', p);
    return null;
  }
  // buy strategic goods from foreign merchants
  resourcePrice(nid, k) { return { iron: 2.2, timber: 1.6, horses: 3.2, food: 0.9 }[k] * (1 - this.mod(nid, 'tradeMult') * 0.3); }
  buyResource(nid, k, qty = 10) {
    const n = this.s.nations[nid], cost = Math.round(this.resourcePrice(nid, k) * qty);
    if (n.gold < cost) return `Need ${cost} gold`;
    n.gold -= cost; n[k] += qty;
    return null;
  }
  countBuildings(nid, type) { let c = 0; for (const p of this.ownedProvinces(nid)) c += this.s.prov[p].buildings[type] || 0; return c; }
  maxUnrest(nid) { let m = 0; for (const p of this.ownedProvinces(nid)) m = Math.max(m, this.s.prov[p].unrest); return m; }

  // ── construction
  buildCost(nid, p, type) {
    const B = BUILDINGS[type], lvl = this.s.prov[p].buildings[type] || 0;
    const f = (1 + lvl * 0.6) * (1 + this.mod(nid, 'buildCost'));
    const c = {};
    for (const [k, v] of Object.entries(B.cost)) c[k] = Math.round(v * f);
    return c;
  }
  canBuild(nid, p, type) {
    const pr = this.s.prov[p], sp = this.map.provinces[p], B = BUILDINGS[type];
    if (pr.owner !== nid) return 'Not your province';
    if (pr.controller !== nid) return 'Province is occupied';
    if (!B.allowed(sp)) return 'Not possible in this terrain';
    const lvl = (pr.buildings[type] || 0) + pr.queue.filter((q) => q.type === type).length;
    if (lvl >= B.max) return 'Maximum level reached';
    if (pr.queue.length >= 2) return 'Construction queue full (2)';
    const c = this.buildCost(nid, p, type), n = this.s.nations[nid];
    for (const [k, v] of Object.entries(c)) if ((n[k] || 0) < v) return `Not enough ${k}`;
    return null;
  }
  build(nid, p, type) {
    const why = this.canBuild(nid, p, type);
    if (why) return why;
    const n = this.s.nations[nid], c = this.buildCost(nid, p, type);
    for (const [k, v] of Object.entries(c)) n[k] -= v;
    const days = Math.round(BUILDINGS[type].days * (1 + (this.s.prov[p].buildings[type] || 0) * 0.4) / (1 + this.mod(nid, 'buildSpeed')));
    this.s.prov[p].queue.push({ type, days, total: days });
    this.emit('province', p);
    return null;
  }
  dailyConstruction() {
    for (let p = 0; p < this.L; p++) {
      const pr = this.s.prov[p];
      if (!pr.queue.length) continue;
      if (pr.controller !== pr.owner) continue;
      const q = pr.queue[0];
      if (--q.days <= 0) {
        pr.queue.shift();
        pr.buildings[q.type] = (pr.buildings[q.type] || 0) + 1;
        if (q.type === 'walls') pr.garrison = 1;
        if (pr.owner === this.s.player) this.log(`${BUILDINGS[q.type].name} completed in ${this.provName(p)}.`, { nation: pr.owner, type: 'build', prov: p });
        this.emit('building', p, q.type);
      }
    }
  }

  fortLevel(p) { const pr = this.s.prov[p]; if (!pr) return 0; return (pr.buildings.walls || 0) + (this.s.nations[pr.owner]?.capital === p ? 1 : 0); }

  // ── power estimates
  armyStrength(nid) { let s = 0; for (const a of this.armiesOf(nid)) s += this.armyPower(a); return s; }
  power(nid) {
    const n = this.s.nations[nid];
    if (!n || !n.alive) return 0;
    let dev = 0; for (const p of this.ownedProvinces(nid)) dev += this.s.prov[p].dev;
    return this.armyStrength(nid) + n.manpower / 1000 * 1.2 + dev * 0.25 + Math.max(0, n.gold) * 0.03;
  }

  // ── save / load
  serialize() { return JSON.stringify({ v: 1, s: this.s, ui: this.uiState || {} }, (k, v) => (k === '_m' ? undefined : v)); }
  load(json) {
    const d = JSON.parse(json);
    this.s = d.s;
    this.uiState = d.ui;
    this._owned = null; this._ft = null; this._wp = null;
    for (const n of this.s.nations) if (n.alive) this.recalcMods(n.id);
    this.emit('reset');
  }
}

for (const mixin of [MilitaryMixin, BattleMixin, DiplomacyMixin, PoliticsMixin, AIMixin, FrontsMixin]) Object.assign(Game.prototype, mixin);
