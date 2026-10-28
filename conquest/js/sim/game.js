// Core game state and the daily/monthly simulation loop.
import { NATIONS } from '../data/nations.js';
import { GOVS, defaultLaws, LAWS, COUNCIL_ROLES, ROLE_INFO } from '../data/government.js';
import { TRAITS, GEN_TRAIT_POOL, PERS_TRAIT_POOL } from '../data/traits.js';
import { groupOf, personName } from '../data/names.js';
import { BUILDINGS } from '../data/buildings.js';
import { mulberry32, clamp, dateOf, season, pick, hexToRgb } from '../util.js';
import { milDoctrineMods } from '../data/mildoctrines.js';
import { MilitaryMixin } from './military.js';
import { BattleMixin } from './battle.js';
import { DiplomacyMixin } from './diplomacy.js';
import { PoliticsMixin } from './politics.js';
import { AIMixin } from './ai.js';
import { FrontsMixin } from './fronts.js';
import { CharactersMixin } from './characters.js';
import { EconomyMixin } from './economy.js';
import { EstatesMixin } from './estates.js';
import { ProgressionMixin } from './progression.js';
import { PapacyMixin } from './papacy.js';
import { ReligionMixin } from './religion.js';
import { TradeSimMixin } from './trade_sim.js';
import { VassalsMixin } from './vassals.js';
import { ProjectsMixin } from './projects.js';
import { ExplainMixin } from './explain.js';
import { ProvincesMixin } from './provinces.js';
import { WorldMixin } from './world.js';
import { kmPerPx } from '../world/proj.js';
import { MAP_VERSION } from '../world/version.js';

import { TERRAIN_ECON } from './economy.js';
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
      dev = clamp(Math.round(dev * 0.55 + (sp.imp >= 2 ? 1 : 0)), 1, 18);
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
    this.initProgression();
    this.initPapacy();
    this.initTrade();
    this.initWorld();
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
    if (opts.type === 'war' || opts.type === 'diplo' || opts.type === 'court') this.pushNews(text, opts);
    if (this.s.log.length > 250) this.s.log.length = 250;
    this.emit('log', text, opts);
  }
  notify(n) { if (n.nation === undefined || n.nation === this.s.player) this.emit('notify', n); }
  newId() { return this.s.nextId++; }
  rgb(nid) { return nid >= 0 ? hexToRgb(this.s.nations[nid].color) : [120, 120, 120]; }



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
  // trace: optional array; every contribution is pushed as [label, mods, factor] (used by modSources / explain)
  recalcMods(nid, trace) {
    const n = this.s.nations[nid];
    const M = {};
    const add = (mods, f = 1, label) => { if (mods) { for (const [k, v] of Object.entries(mods)) M[k] = (M[k] || 0) + v * f; if (trace) trace.push([label || 'Other', mods, f]); } };
    for (const [cat, opt] of Object.entries(n.laws)) add(LAWS[cat]?.options[opt]?.mods, 1, `Law: ${LAWS[cat]?.options[opt]?.name}`);
    for (const m of n.mods) if (!m.until || m.until > this.s.day) add(m.mods, 1, this.modSrcLabel(m.src));
    add(milDoctrineMods(n), 1, 'Military doctrine');
    if (n.bmods) add(n.bmods.mods, 1, 'Buildings');
    const ruler = this.s.chars[n.ruler];
    if (ruler) for (const t of ruler.traits) add(TRAITS[t].mods, 1, `Ruler trait: ${TRAITS[t].name || t}`);
    for (const role of COUNCIL_ROLES) {
      const c = this.s.chars[n.council[role]];
      if (!c) { add({ stabilityMonthly: -0.01 }, 1, `Vacant office: ${role}`); continue; }
      const sk = c.skills[ROLE_INFO[role].skill] + (ruler && role === 'chancellor' ? 0 : 0);
      const rl = `${ROLE_INFO[role] ? role[0].toUpperCase() + role.slice(1) : role} ${this.charName(c)} (skill ${sk})`;
      if (role === 'chancellor') add({ diplo: sk, aeDecay: sk * 0.02, claimSpeed: sk * 0.03 }, 1, rl);
      if (role === 'marshal') add({ discipline: sk * 0.004, manpowerMult: sk * 0.01, trainSpeed: sk * 0.02 }, 1, rl);
      if (role === 'steward') add({ taxMult: sk * 0.01, buildSpeed: sk * 0.02 }, 1, rl);
      if (role === 'spymaster') add({ unrest: -sk * 0.15, claimSpeed: sk * 0.02 }, 1, rl);
      if (role === 'chaplain') add({ legitimacyMonthly: sk * 0.006, clergyLoyalty: sk * 0.4, focusSpeed: sk * 0.01 }, 1, rl);
      for (const t of c.traits) if (TRAITS[t].mods) add(TRAITS[t].mods, 0.5, `${rl} trait`);
    }
    if (n.gov === 'merchant_republic') add({ tradeMult: 0.25, manpowerMult: -0.2 }, 1, 'Merchant republic');
    if (n.gov === 'tribal') add({ taxMult: -0.3, manpowerMult: 0.3, buildSpeed: -0.2 }, 1, 'Tribal chiefdom');
    if (n.gov === 'imperial') add({ taxMult: 0.1 }, 1, 'Imperial autocracy');
    if (n.gov === 'theocracy') add({ legitimacyMonthly: 0.05 }, 1, 'Theocracy');
    if (n.legitimacy >= 80) add({ taxMult: 0.04, armyMorale: 0.03 }, 1, 'Legitimacy above 80');
    else if (n.legitimacy < 20) add({ unrest: 3, nobleLoyalty: -12, taxMult: -0.05 }, 1, 'Illegitimate rule (below 20)');
    else if (n.legitimacy < 40) add({ unrest: 1.5, nobleLoyalty: -5 }, 1, 'Weak legitimacy (below 40)');
    if (n.stability) add({ taxMult: n.stability * 0.04, unrest: -n.stability * 1.5 }, 1, `Stability ${n.stability.toFixed(1)}`);
    if (n.warExhaustion) add({ unrest: n.warExhaustion * 0.4, manpowerMult: -n.warExhaustion * 0.01 }, 1, `War exhaustion ${n.warExhaustion.toFixed(1)}`);
    if (trace) return M;
    n._m = M;
    return M;
  }
  mod(nid, key) { const n = this.s.nations[nid]; if (!n) return 0; return (n._m || this.recalcMods(nid))[key] || 0; }




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
      this.updateBuildingMods(n);
      this.recalcMods(n.id);
      const B = this.budget(n.id);
      for (const [r, q] of Object.entries(n.bmods.use)) n[r] = Math.max(0, n[r] - q);
      n.gold += B.net;
      n.food = clamp(n.food + B.foodNet, -200, 300 + this.ownedProvinces(n.id).length * 6);
      n.iron = Math.max(0, n.iron + B.iron);
      n.timber = Math.max(0, n.timber + B.timber);
      n.horses = Math.max(0, n.horses + B.horses);
      n.maxManpower = this.calcMaxManpower(n.id);
      n.manpower = Math.min(n.maxManpower, n.manpower + n.maxManpower / 60 * (n.food < 0 ? 0.3 : 1) * (1 + this.mod(n.id, 'manpowerRegen')));
      if (n.food < 0) { n.stability = Math.max(-3, n.stability - 0.05); }
      if (n.gold < -50) { n.stability = Math.max(-3, n.stability - 0.1); this.estateDelta(n, 'nobles', -1); }
      n.prestige = clamp(n.prestige * 0.995 + this.mod(n.id, 'prestigeMonthly') * 10, -100, 500);
      n.legitimacy = clamp(n.legitimacy + 0.1 + this.mod(n.id, 'legitimacyMonthly') * 10 - (n.gold < 0 ? 0.5 : 0), 0, 100);
      n.stability = clamp(n.stability + this.mod(n.id, 'stabilityMonthly') * 3 + (n.legitimacy > 60 ? 0.02 : n.legitimacy < 30 ? -0.04 : 0), -3, 3);
      n.warExhaustion = Math.max(0, n.warExhaustion - (this.atWar(n.id) ? 0.05 : 0.4));
      if (n.legitimacy < 25 && this.rng() < 0.03 && this.ownedProvinces(n.id).length > 1) { this.spawnRebels(this.ownedProvinces(n.id).filter((p) => p !== n.capital)[0], true); this.log(`A pretender raises the banners against the ${n.name}!`, { nation: n.id, type: 'war', important: n.id === s.player }); }
      this.monthlyEstates(n);
      this.monthlyCharacters(n);
      this.monthlyDiplomacy(n);
    }
    this.monthlyProvinces();
    this.monthlyProgression();
    this.monthlyPapacy();
    this.monthlyReligion();
    this.monthlyTrade();
    this.monthlyVassals();
    this.monthlyEvents();
    this.monthlyWorld();
    this.emit('month');
  }









  // ── power estimates
  armyStrength(nid) { let s = 0; for (const a of this.armiesOf(nid)) s += this.armyPower(a); return s; }
  power(nid) {
    const n = this.s.nations[nid];
    if (!n || !n.alive) return 0;
    let dev = 0; for (const p of this.ownedProvinces(nid)) dev += this.s.prov[p].dev;
    return this.armyStrength(nid) + n.manpower / 1000 * 1.2 + dev * 0.25 + Math.max(0, n.gold) * 0.03;
  }

  // ── save / load
  serialize() { return JSON.stringify({ v: 1, map: MAP_VERSION, s: this.s, ui: this.uiState || {} }, (k, v) => (k === '_m' ? undefined : v)); }
  load(json) {
    const d = JSON.parse(json);
    // province ids differ between map versions; saves before versioning were map 1
    if ((d.map || 1) !== MAP_VERSION) throw new Error(`This save was made on a different map (v${d.map || 1}; this version uses v${MAP_VERSION}) and can't be loaded.`);
    this.s = d.s;
    this.uiState = d.ui;
    this._owned = null; this._ft = null; this._wp = null;
    this.initProgression();
    this.initPapacy();
    this.initTrade();
    this.initWorld();
    for (const n of this.s.nations) if (n.alive) this.recalcMods(n.id);
    this.emit('reset');
  }
}

for (const mixin of [CharactersMixin, ProgressionMixin, PapacyMixin, ReligionMixin, TradeSimMixin, VassalsMixin, EconomyMixin, EstatesMixin, ProjectsMixin, ExplainMixin, ProvincesMixin, WorldMixin, MilitaryMixin, BattleMixin, DiplomacyMixin, PoliticsMixin, AIMixin, FrontsMixin]) Object.assign(Game.prototype, mixin);
