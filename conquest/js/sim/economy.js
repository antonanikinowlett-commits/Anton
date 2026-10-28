// Economy: province output, budgets, manpower, development, construction and trade purchases.
import { NATIONS } from '../data/nations.js';
import { GOVS, LAWS, COUNCIL_ROLES, ROLE_INFO } from '../data/government.js';
import { TRAITS, GEN_TRAIT_POOL, PERS_TRAIT_POOL } from '../data/traits.js';
import { groupOf, personName } from '../data/names.js';
import { BUILDINGS } from '../data/buildings.js';
import { clamp, dateOf, pick } from '../util.js';

export const TERRAIN_ECON = {
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

export const EconomyMixin = {
  calcMaxManpower(nid) {
    let mp = 0;
    for (const p of this.ownedProvinces(nid)) {
      const pr = this.s.prov[p];
      mp += pr.dev * 120 * (pr.controller === nid ? 1 : 0.3) * (1 + 0.25 * (pr.buildings.barracks || 0));
    }
    return Math.round(mp * (1 + this.mod(nid, 'manpowerMult')));
  },
  provinceIncome(p, nid) {
    const pr = this.s.prov[p], sp = this.map.provinces[p], b = pr.buildings, te = TERRAIN_ECON[sp.terrain];
    const ctl = pr.controller === nid ? 1 : 0;
    const unrestF = 1 - pr.unrest / 200;
    const sameFaith = pr.religion === this.s.nations[nid].religion ? 1 : 0.85;
    const devast = 1 - pr.devast / 100;
    const tax = pr.dev * 0.08 * (1 + 0.08 * (b.market || 0)) * ctl * unrestF * sameFaith * devast;
    const trade = ((b.market || 0) * 0.2 + (b.port || 0) * 0.3 + (sp.imp >= 2 ? 0.25 : 0)) * (1 + pr.dev / 20) * ctl * devast * (pr.blockadedBy !== undefined ? 0.2 : 1);
    const food = ((te.food * 0.35 * (1 + 0.6 * (b.farm || 0)) + (sp.river > 0.03 ? 0.2 : 0)) * ctl * devast - pr.dev * 0.03) * 0.45;
    const iron = ((te.iron || 0) * 0.2 + (b.mine || 0) * (0.8 + (te.iron || 0) * 0.6)) * ctl;
    const timber = ((te.timber || 0) * 0.3 + (b.lumber || 0) * 1.2) * ctl;
    const horses = ((te.horses || 0) * 0.15 + (b.stables || 0) * 0.6) * ctl;
    const goldMine = (b.mine || 0) * 0.12 * ctl;
    return { tax, trade, food, iron, timber, horses, goldMine };
  },
  // stacked income bonuses (laws, foci, innovations, ministers) have diminishing returns: +100% counts as +56%
  softMult(m) { return m > 0 ? m / (1 + m * 0.8) : m; },
  budget(nid) {
    const n = this.s.nations[nid];
    const B = { tax: 0, trade: 0, mines: 0, food: 0, iron: 0, timber: 0, horses: 0, armyUpkeep: 0, armyFood: 0, court: 0, admin: 0, interest: 0, tribute: 0 };
    for (const p of this.ownedProvinces(nid)) {
      const i = this.provinceIncome(p, nid);
      B.tax += i.tax; B.trade += i.trade; B.mines += i.goldMine; B.food += i.food; B.iron += i.iron; B.timber += i.timber; B.horses += i.horses;
    }
    B.tax *= 1 + this.softMult(this.mod(nid, 'taxMult'));
    if (this.s.difficulty === 'hard' && nid !== this.s.player && !n.ai.horde) B.tax *= 1.2; // Hard: the AI realms are richer
    B.trade *= 1 + this.softMult(this.mod(nid, 'tradeMult'));
    B.food *= B.food > 0 ? 1 + this.mod(nid, 'foodMult') : 1;
    B.iron *= 1 + this.mod(nid, 'ironMult');
    B.horses *= 1 + this.mod(nid, 'horsesMult');
    for (const a of this.armiesOf(nid)) {
      const up = this.armyUpkeep(a);
      B.armyUpkeep += up.gold; B.armyFood += up.food;
    }
    B.armyUpkeep *= 1 + this.mod(nid, 'upkeepMult');
    const owned = this.ownedProvinces(nid);
    // administration grows faster than the realm: every province, development point and building level costs upkeep
    B.admin = owned.length * 0.02 + owned.reduce((t, p) => t + this.s.prov[p].dev * 0.016 + Object.entries(this.s.prov[p].buildings).reduce((x, [k, y]) => x + y * (BUILDINGS[k]?.upkeep ?? 0.07), 0), 0);
    B.court = 0.4 * COUNCIL_ROLES.filter((r) => n.council[r]).length + 0.3 * this.charsOf(nid, 'general').length;
    if (n.gold < 0) B.interest = -n.gold * 0.02;
    // vassal tribute
    for (const v of this.s.nations) if (v.alive && v.overlord === nid) B.tribute += (1 + this.ownedProvinces(v.id).length * 0.08) * this.tributeFactor(v.id);
    if (n.overlord >= 0) B.tribute -= (1 + this.ownedProvinces(nid).length * 0.08) * this.tributeFactor(nid);
    B.nodes = this.tradeIncome(nid);
    // commerce saturates: the more a realm earns from trade, the smaller each extra coin (merchant republics saturate later)
    const T = B.trade + B.nodes;
    if (T > 0) { const K = 3.2 * Math.sqrt(this.ownedProvinces(nid).length || 1) * (n.gov === 'merchant_republic' ? 1.8 : 1), f = 1 / (1 + T / K); B.trade *= f; B.nodes *= f; }
    B.income = B.tax + B.trade + B.nodes + B.mines + Math.max(0, B.tribute);
    B.expense = B.armyUpkeep + B.court + B.admin + B.interest + Math.max(0, -B.tribute);
    B.net = B.income - B.expense;
    B.foodNet = B.food - B.armyFood;
    return B;
  },
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
      if (pr.heresy) target += 12;
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
      // slow, with diminishing returns: the richer a province, the harder it is to improve (soft cap ~20)
      const growth = 0.0011 * (1 + (pr.buildings.farm || 0) * 0.25 + (pr.buildings.market || 0) * 0.2 + this.mod(n.id, 'devGrowth')) * Math.max(0, 1 - pr.dev / 20) * (pr.unrest > 40 ? 0 : 1) * (pr.controller === pr.owner ? 1 : 0);
      if (this.rng() < growth && pr.dev < 30) { pr.dev++; }
      if (sp && pr.garrison < 1) pr.garrison = Math.min(1, pr.garrison + 0.1);
      // rebellion
      if (pr.unrest > 60 && pr.controller === pr.owner && this.rng() < (pr.unrest - 55) / 600) this.spawnRebels(p);
    }
  },
  // invest in a province: settlers, clearings, new villages
  developCost(p, nid) { const d = this.s.prov[p].dev; return Math.round((60 + d * d * 12) * (1 + (nid === undefined ? 0 : this.mod(nid, 'devCost')))); },
  developProvince(nid, p) {
    const pr = this.s.prov[p], n = this.s.nations[nid];
    if (pr.owner !== nid || pr.controller !== nid) return 'Must own and control the province';
    if (pr.dev >= 30) return 'Fully developed';
    const c = this.developCost(p, nid);
    if (n.gold < c) return `Need ${c} gold`;
    n.gold -= c; pr.dev++;
    this.emit('province', p);
    return null;
  },
  // buy strategic goods from foreign merchants
  resourcePrice(nid, k) { return { iron: 2.2, timber: 1.6, horses: 3.2, food: 0.9 }[k] * (1 - this.mod(nid, 'tradeMult') * 0.3); },
  buyResource(nid, k, qty = 10) {
    const n = this.s.nations[nid], cost = Math.round(this.resourcePrice(nid, k) * qty);
    if (n.gold < cost) return `Need ${cost} gold`;
    n.gold -= cost; n[k] += qty;
    return null;
  },
  countBuildings(nid, type) { let c = 0; for (const p of this.ownedProvinces(nid)) c += this.s.prov[p].buildings[type] || 0; return c; },
  maxUnrest(nid) { let m = 0; for (const p of this.ownedProvinces(nid)) m = Math.max(m, this.s.prov[p].unrest); return m; },
  buildCost(nid, p, type) {
    const B = BUILDINGS[type], lvl = this.s.prov[p].buildings[type] || 0;
    const f = (1 + lvl * 0.6) * (1 + this.mod(nid, 'buildCost'));
    const c = {};
    for (const [k, v] of Object.entries(B.cost)) c[k] = Math.round(v * f);
    return c;
  },
  canBuild(nid, p, type) {
    const pr = this.s.prov[p], sp = this.map.provinces[p], B = BUILDINGS[type];
    if (pr.owner !== nid) return 'Not your province';
    if (pr.controller !== nid) return 'Province is occupied';
    if (!B.allowed(sp)) return 'Not possible in this terrain';
    if (B.innov && !this.s.nations[nid].unlocks.includes('bld:' + type)) return `Requires the innovation ${B.innov}`;
    const lvl = (pr.buildings[type] || 0) + pr.queue.filter((q) => q.type === type).length;
    if (lvl >= B.max) return 'Maximum level reached';
    if (pr.queue.length >= 2) return 'Construction queue full (2)';
    const c = this.buildCost(nid, p, type), n = this.s.nations[nid];
    for (const [k, v] of Object.entries(c)) if ((n[k] || 0) < v) return `Not enough ${k}`;
    return null;
  },
  build(nid, p, type) {
    const why = this.canBuild(nid, p, type);
    if (why) return why;
    const n = this.s.nations[nid], c = this.buildCost(nid, p, type);
    for (const [k, v] of Object.entries(c)) n[k] -= v;
    const days = Math.round(BUILDINGS[type].days * (1 + (this.s.prov[p].buildings[type] || 0) * 0.4) / (1 + this.mod(nid, 'buildSpeed')));
    this.s.prov[p].queue.push({ type, days, total: days });
    this.emit('province', p);
    return null;
  },
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
  },
  fortLevel(p) { const pr = this.s.prov[p]; if (!pr) return 0; return (pr.buildings.walls || 0) + (this.s.nations[pr.owner]?.capital === p ? 1 : 0); },
};
