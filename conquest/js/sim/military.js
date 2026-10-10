// Armies: recruitment, movement, pathfinding, supply, attrition, sieges and occupation.
import { UNITS, unitAvailable } from '../data/units.js';
import { TERRAIN_ECON } from './game.js';
import { Heap, clamp } from '../util.js';
import { NATIONS } from '../data/nations.js';

const SEA_KMPD = 75;

export const MilitaryMixin = {
  armiesOf(nid) { return Object.values(this.s.armies).filter((a) => a.nation === nid); },
  armiesAt(p) { return Object.values(this.s.armies).filter((a) => a.loc === p); },
  armyMen(a) { let m = 0; for (const r of a.regs) m += r.men; return m; },
  armyMax(a) { let m = 0; for (const r of a.regs) m += r.max; return m; },
  armyMorale(a) { let m = 0, w = 0; for (const r of a.regs) { m += r.morale * r.men; w += r.men; } return w ? m / w : 0; },
  armyComp(a) {
    const c = {};
    for (const r of a.regs) c[r.type] = (c[r.type] || 0) + 1;
    return c;
  },
  armyPower(a) {
    let p = 0;
    for (const r of a.regs) { const u = UNITS[r.type]; p += (r.men / 1000) * (u.atk + u.def + u.ranged + u.charge * 0.3) * (0.5 + r.morale * 0.5) * (u.men === 500 ? 2 : 1); }
    return p;
  },
  armySpeed(a) {
    let s = 99;
    for (const r of a.regs) s = Math.min(s, UNITS[r.type].speed);
    const g = this.s.chars[a.general];
    if (g && g.traits.includes('horse_lord') && a.regs.every((r) => UNITS[r.type].cls === 'cav')) s *= 1.2;
    return s === 99 ? 20 : s;
  },
  armyUpkeep(a) {
    let gold = 0, food = 0;
    const own = a.loc < this.L && this.s.prov[a.loc].owner === a.nation;
    for (const r of a.regs) { gold += UNITS[r.type].upkeep * (r.men / r.max * 0.5 + 0.5); food += r.men / 1000 * (UNITS[r.type].cls === 'cav' ? 0.5 : 0.3); }
    return { gold, food: food * (own ? 1 : 0.5) };
  },
  regsFromTemplate(t) {
    const regs = [];
    for (const [type, count] of Object.entries(t.regs)) for (let i = 0; i < count; i++) regs.push(this.newReg(type));
    return regs;
  },
  newReg(type, frac = 1) { const u = UNITS[type]; return { type, men: Math.round(u.men * frac), max: u.men, morale: 1, xp: 0 }; },
  templateCost(nid, t) {
    const c = { gold: 0, iron: 0, timber: 0, horses: 0, manpower: 0 }, days = [];
    const rc = 1 + this.mod(nid, 'recruitCost');
    for (const [type, count] of Object.entries(t.regs)) {
      const u = UNITS[type];
      const cav = u.cls === 'cav' ? 1 + this.mod(nid, 'cavCost') : 1;
      for (const [k, v] of Object.entries(u.cost)) c[k] += v * count * rc * cav;
      c.manpower += u.men * count;
      if (count) days.push(u.days);
    }
    for (const k of Object.keys(c)) c[k] = Math.round(c[k]);
    c.days = Math.round((days.length ? Math.max(...days) : 0) / (1 + this.mod(nid, 'trainSpeed')));
    return c;
  },
  templateStats(nid, t) {
    let men = 0, atk = 0, def = 0, rng = 0, charge = 0, pursuit = 0, siege = 0, armor = 0, upkeep = 0, speed = 99, n = 0, cav = 0, inf = 0, rgd = 0, anti = 0;
    for (const [type, count] of Object.entries(t.regs)) {
      if (!count) continue;
      const u = UNITS[type], k = u.men / 1000 * count;
      men += u.men * count; atk += u.atk * k; def += u.def * k; rng += u.ranged * k; charge += u.charge * k; pursuit += u.pursuit * k; siege += (u.siege || 0) * count;
      armor += u.armor * count; upkeep += u.upkeep * count; speed = Math.min(speed, u.speed); n += count; anti += u.anti * k;
      if (u.cls === 'cav') cav += count; else if (u.cls === 'rng') rgd += count; else if (u.cls === 'inf') inf += count;
    }
    return { men, atk, def, rng, charge, pursuit, siege, armor: n ? armor / n : 0, upkeep: upkeep * (1 + this.mod(nid, 'upkeepMult')), speed: speed === 99 ? 0 : speed, regs: n, cav, inf, rgd, anti };
  },

  createArmy(nid, loc, regs, name, opts = {}) {
    const a = { id: this.newId(), nation: nid, name: name || this.armyName(nid), loc, path: [], prog: 0, regs, general: null, doctrine: opts.doctrine || 'balanced',
      battle: null, retreating: false, entrench: 0, rebelOf: opts.rebelOf ?? -1, ai: {}, atSea: loc >= this.L, home: loc };
    this.s.armies[a.id] = a;
    this.emit('army', a.id);
    return a;
  },
  armyName(nid) {
    const n = this.s.nations[nid];
    const k = this.armiesOf(nid).length + 1;
    const ord = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'][k - 1] || `${k}th`;
    if (!n) return 'Rebel Host';
    if (n.gov === 'tribal') return `${ord} War Band`;
    if (['sunni'].includes(n.religion)) return `${ord} Askar`;
    if (n.gov === 'merchant_republic') return `${ord} Company`;
    return `${ord} Host`;
  },
  spawnStartingArmies(n) {
    const owned = this.ownedProvinces(n.id);
    if (!owned.length || n.capital < 0) return;
    const dev = owned.reduce((s, p) => s + this.s.prov[p].dev, 0);
    const regsN = clamp(Math.round(dev / 18), 3, 26);
    const t = n.templates[0];
    const armies = clamp(Math.round(regsN / 9), 1, 3);
    for (let i = 0; i < armies; i++) {
      const regs = [];
      const per = Math.ceil(regsN / armies);
      const keys = Object.entries(t.regs).flatMap(([k, c]) => Array(c).fill(k));
      for (let j = 0; j < per; j++) regs.push(this.newReg(keys[j % keys.length], 0.9));
      let loc = n.capital;
      if (i > 0) { const border = this.borderProvinces(n.id); if (border.length) loc = border[Math.floor(this.rng() * border.length)]; }
      const a = this.createArmy(n.id, loc, regs, null, { doctrine: t.doctrine });
      a.template = t.id;
      const gen = this.charsOf(n.id, 'general').find((c) => !c.army);
      if (gen) this.assignGeneral(a.id, gen.id);
    }
  },
  borderProvinces(nid) {
    const r = [];
    for (const p of this.ownedProvinces(nid)) if (this.map.provinces[p].adj.some((e) => e.id < this.L && this.s.prov[e.id].owner !== nid)) r.push(p);
    return r;
  },

  // ── recruitment
  canRecruit(nid, p, t) {
    const n = this.s.nations[nid], pr = this.s.prov[p];
    if (!pr || pr.owner !== nid || pr.controller !== nid) return 'Must recruit in a province you control';
    for (const type of Object.keys(t.regs)) if (t.regs[type] > 0 && !unitAvailable(type, n, this)) return `${UNITS[type].name} not available`;
    const c = this.templateCost(nid, t);
    if (!Object.values(t.regs).some((v) => v > 0)) return 'Template is empty';
    for (const k of ['gold', 'iron', 'timber', 'horses']) if (c[k] > (n[k] || 0)) return `Not enough ${k} (${c[k]} needed)`;
    if (c.manpower > n.manpower) return `Not enough manpower (${Math.round(c.manpower)} needed)`;
    return null;
  },
  recruit(nid, p, t) {
    const why = this.canRecruit(nid, p, t);
    if (why) return why;
    const n = this.s.nations[nid], c = this.templateCost(nid, t);
    for (const k of ['gold', 'iron', 'timber', 'horses', 'manpower']) n[k] -= c[k];
    const barracks = this.s.prov[p].buildings.barracks || 0;
    const days = Math.max(10, Math.round(c.days * (1 - barracks * 0.2)));
    this.s.recruit.push({ id: this.newId(), nation: nid, prov: p, template: { ...t, regs: { ...t.regs } }, days, total: days });
    if (nid === this.s.player) this.log(`Mustering "${t.name}" at ${this.provName(p)} (${days} days).`, { nation: nid, type: 'mil', prov: p });
    this.emit('recruit');
    return null;
  },
  cancelRecruit(id) {
    const i = this.s.recruit.findIndex((r) => r.id === id);
    if (i < 0) return;
    const r = this.s.recruit[i], n = this.s.nations[r.nation];
    const c = this.templateCost(r.nation, r.template);
    for (const k of ['gold', 'iron', 'timber', 'horses']) n[k] += c[k] * 0.5;
    n.manpower += c.manpower;
    this.s.recruit.splice(i, 1);
    this.emit('recruit');
  },

  // ── generals & orders
  assignGeneral(aid, cid) {
    const a = this.s.armies[aid], c = this.s.chars[cid];
    if (!a || !c) return;
    if (c.army && this.s.armies[c.army]) this.s.armies[c.army].general = null;
    if (a.general && this.s.chars[a.general]) this.s.chars[a.general].army = null;
    a.general = cid; c.army = aid;
    this.emit('army', aid);
  },
  unassignGeneral(aid) { const a = this.s.armies[aid]; if (a && a.general) { const c = this.s.chars[a.general]; if (c) c.army = null; a.general = null; } },
  generalOf(a) { return this.s.chars[a.general] || null; },
  genStat(a, k) { const g = this.generalOf(a); return g && g.gen ? g.gen[k] + (k === 'tactics' ? this.mod(a.nation, 'generalTactics') : 0) : 0; },

  disband(aid) {
    const a = this.s.armies[aid];
    if (!a || a.battle) return;
    const n = this.s.nations[a.nation];
    if (n) n.manpower = Math.min(n.maxManpower, n.manpower + this.armyMen(a) * 0.6);
    this.unassignGeneral(aid);
    delete this.s.armies[aid];
    this.emit('armyGone', aid);
  },
  merge(ids) {
    const as = ids.map((i) => this.s.armies[i]).filter((a) => a && !a.battle);
    if (as.length < 2) return;
    const main = as[0];
    for (const a of as.slice(1)) {
      if (a.loc !== main.loc || a.nation !== main.nation) continue;
      main.regs.push(...a.regs);
      if (!main.general && a.general) { const g = a.general; this.unassignGeneral(a.id); this.assignGeneral(main.id, g); }
      this.unassignGeneral(a.id);
      delete this.s.armies[a.id];
      this.emit('armyGone', a.id);
    }
    this.emit('army', main.id);
  },
  // Merge armies wherever they are: the others march to the first army and join it on arrival.
  mergeOrder(ids) {
    const as = ids.map((i) => this.s.armies[i]).filter((a) => a && !a.retreating);
    if (as.length < 2) return 'Select at least two armies';
    if (as.some((a) => a.nation !== as[0].nation)) return 'Only armies of the same realm can merge';
    const main = as.find((a) => !a.path.length && !a.battle) || as[0];
    const here = as.filter((a) => a.loc === main.loc && !a.battle);
    for (const a of as) this.leaveFront?.(a.id);
    if (here.length > 1) this.merge([main.id, ...here.filter((a) => a !== main).map((a) => a.id)]);
    let marching = 0;
    for (const a of as) {
      if (a === main || !this.s.armies[a.id]) continue;
      a.mergeInto = main.id;
      if (!a.battle && this.orderMove(a.id, main.loc)) { a.mergeInto = null; continue; }
      marching++;
    }
    main.path = []; main.prog = 0;
    this.emit('army', main.id);
    return marching ? `${marching} march to join ${main.name}` : null;
  },
  split(aid) {
    const a = this.s.armies[aid];
    if (!a || a.battle || a.regs.length < 2) return null;
    const half = a.regs.splice(Math.floor(a.regs.length / 2));
    const b = this.createArmy(a.nation, a.loc, half, null, { doctrine: a.doctrine, rebelOf: a.rebelOf });
    b.atSea = a.atSea;
    this.emit('army', a.id);
    return b;
  },

  // ── access & hostility
  side(a) { return a.nation >= 0 ? a.nation : -100 - a.rebelOf; },
  hostileArmies(a, b) {
    if (a.nation < 0 && b.nation < 0) return false;
    if (a.nation < 0) return b.nation === a.rebelOf;
    if (b.nation < 0) return a.nation === b.rebelOf;
    return this.atWar(a.nation, b.nation);
  },
  hostileToProvince(a, p) {
    const pr = this.s.prov[p];
    if (!pr) return false;
    if (a.nation < 0) return pr.owner === a.rebelOf && pr.controller !== -2;
    if (pr.controller === -2) return pr.owner === a.nation || this.isAlly(a.nation, pr.owner);
    return pr.controller !== a.nation && this.atWar(a.nation, pr.controller);
  },
  canEnter(nid, p, rebelOf = -1) {
    if (p >= this.L) return true;
    const pr = this.s.prov[p];
    if (nid < 0) return pr.owner === rebelOf;
    if (pr.owner === nid || pr.controller === nid || pr.owner < 0) return true;
    if (this.isAlly(nid, pr.owner) || this.isSubjectOf(nid, pr.owner) || this.isSubjectOf(pr.owner, nid)) return true;
    if (this.atWar(nid, pr.owner) || (pr.controller >= 0 && this.atWar(nid, pr.controller))) return true;
    return false;
  },

  // ── pathfinding (A* on the province graph, cost in days)
  terrainMove(p) { const sp = this.map.provinces[p]; return sp.sea ? 1 : TERRAIN_ECON[sp.terrain].move; },
  stepDays(nid, from, e, speed, seaMult = 1) {
    const to = e.id, P = this.map.provinces;
    if (P[to].sea || P[from].sea) return e.km / (SEA_KMPD * seaMult) + (P[from].sea ? 0 : 2);
    const road = this.s.prov[to].buildings.road && this.s.prov[from].buildings.road ? 1.4 : this.s.prov[to].buildings.road ? 1.2 : 1;
    let d = e.km / (speed * this.terrainMove(to) * road * this.seasonMove(to));
    if (e.river) d += 0.6;
    if (e.strait) d += 2;
    return d;
  },
  seasonMove(p) {
    const s = this.season(), sp = this.map.provinces[p];
    if (s === 'winter') return sp.lat > 52 || sp.terrain === 'mountains' ? 0.6 : 0.8;
    if (s === 'spring' || s === 'autumn') return sp.terrain === 'marsh' || sp.terrain === 'farmland' ? 0.85 : 0.95;
    return 1;
  },
  findPath(a, to) {
    const from = a.loc;
    if (from === to) return [];
    const P = this.map.provinces, L = this.L;
    const nid = a.nation, speed = this.armySpeed(a), seaMult = 1 + this.mod(nid, 'seaSpeed');
    if (!this.canEnter(nid, to, a.rebelOf)) return null;
    const g = new Float64Array(P.length).fill(Infinity), prev = new Int32Array(P.length).fill(-1);
    const h = new Heap(256);
    const tx = P[to].x, ty = P[to].y;
    const heur = (p) => Math.hypot(P[p].x - tx, P[p].y - ty) * P[p].kmpx / SEA_KMPD / seaMult;
    g[from] = 0; h.push(heur(from), from);
    let found = false, iter = 0;
    while (h.n) {
      const c = h.pop();
      if (c === to) { found = true; break; }
      if (++iter > 40000) break;
      const sp = P[c];
      for (const e of sp.adj) {
        const q = e.id;
        if (P[q].sea && !sp.sea && !sp.coastal) continue;
        if (q < L && !this.canEnter(nid, q, a.rebelOf)) continue;
        // enemy forts block passage: you can enter them but not move through
        if (c !== from && c < L && this.blocksPassage(a, c)) continue;
        const nd = g[c] + this.stepDays(nid, c, e, speed, seaMult);
        if (nd < g[q]) { g[q] = nd; prev[q] = c; h.push(nd + heur(q), q); }
      }
    }
    if (!found) return null;
    const path = [];
    for (let c = to; c !== from; c = prev[c]) path.unshift(c);
    return path;
  },
  blocksPassage(a, p) {
    const pr = this.s.prov[p];
    return this.fortLevel(p) > 0 && this.hostileToProvince(a, p);
  },
  pathDays(a, path) {
    let d = 0, c = a.loc;
    const speed = this.armySpeed(a), seaMult = 1 + this.mod(a.nation, 'seaSpeed');
    for (const p of path) { const e = this.map.provinces[c].adj.find((x) => x.id === p); if (e) d += this.stepDays(a.nation, c, e, speed, seaMult); c = p; }
    return d;
  },
  orderMove(aid, to) {
    const a = this.s.armies[aid];
    if (!a) return 'No army';
    if (a.battle) return 'Army is in battle';
    if (a.retreating) return 'Army is retreating';
    const path = this.findPath(a, to);
    if (!path) return 'No route (closed borders or impassable)';
    if (a.path.length && a.path[0] === path[0]) { /* keep progress */ } else a.prog = 0;
    a.path = path;
    a.entrench = 0;
    this.emit('army', aid);
    return null;
  },
  stop(aid) { const a = this.s.armies[aid]; if (a && !a.retreating) { a.path = []; a.prog = 0; this.emit('army', aid); } },

  // ── daily
  dailyArmies() {
    this.dailyRecruit();
    const s = this.s;
    for (const a of Object.values(s.armies)) {
      if (a.battle) continue;
      if (!a.regs.length || this.armyMen(a) < 50) { this.destroyArmy(a, 'disbanded'); continue; }
      if (a.path.length) this.advance(a);
      else a.entrench = Math.min(30, a.entrench + 1);
    }
    for (const a of Object.values(s.armies)) {
      if (!s.armies[a.id] || a.battle) continue;
      this.checkContact(a);
    }
    for (const a of Object.values(s.armies)) if (s.armies[a.id] && !a.battle) this.supplyAndRecovery(a);
    // armies ordered to merge join their target once they share a province
    for (const a of Object.values(s.armies)) {
      if (!a.mergeInto || !s.armies[a.id]) continue;
      const t = s.armies[a.mergeInto];
      if (!t) { a.mergeInto = null; continue; }
      if (a.loc === t.loc && !a.battle && !t.battle && !a.path.length) {
        a.mergeInto = null;
        this.merge([t.id, a.id]);
        if (t.nation === s.player) this.log(`${a.name} has joined ${t.name}.`, { nation: t.nation, type: 'mil', prov: t.loc });
      } else if (!a.path.length && !a.battle && !a.retreating && a.loc !== t.loc) {
        if (this.orderMove(a.id, t.loc)) a.mergeInto = null; // the target moved: follow it
      }
    }
  },
  advance(a) {
    const P = this.map.provinces;
    const next = a.path[0];
    const e = P[a.loc].adj.find((x) => x.id === next);
    if (!e) { a.path = []; return; }
    if (!this.canEnter(a.nation, next, a.rebelOf) && !a.retreating) { a.path = []; a.prog = 0; return; }
    const total = this.stepDays(a.nation, a.loc, e, this.armySpeed(a), 1 + this.mod(a.nation, 'seaSpeed'));
    a.rate = 1 / Math.max(0.2, total);
    a.prog += a.rate;
    if (a.prog >= 1) {
      const leaving = a.loc;
      if (!P[leaving].sea && P[next].sea) {
        const n = this.s.nations[a.nation];
        if (n) n.gold -= a.regs.length * 0.15 * (this.s.prov[leaving]?.buildings.port ? 0.5 : 1);
      }
      a.lastFrom = leaving;
      a.loc = next; a.prog = 0; a.path.shift(); a.entrench = 0;
      a.atSea = P[next].sea;
      a.landed = !P[next].sea && P[leaving].sea ? this.s.day : a.landed;
      if (a.retreating && !a.path.length) a.retreating = false;
      // walking into an enemy fort zone stops the march (zone of control)
      if (!a.retreating && next < this.L && this.blocksPassage(a, next)) a.path = [];
      this.emit('armyMoved', a.id);
    }
  },
  checkContact(a) {
    if (a.retreating) return;
    const here = this.armiesAt(a.loc).filter((b) => b !== a && !b.retreating && this.hostileArmies(a, b));
    if (!here.length || a.atSea) return;
    const existing = Object.values(this.s.battles).find((b) => b.prov === a.loc && !b.over);
    if (existing) { this.joinBattle(existing, a); return; }
    // the army that has been sitting there longer is the defender
    const def = here.filter((b) => !b.battle);
    if (!def.length) return;
    const attackersFirst = def.some((b) => b.entrench > a.entrench);
    if (attackersFirst || def.every((b) => !b.path.length)) this.startBattle(a.loc, [a, ...this.armiesAt(a.loc).filter((b) => b !== a && !b.battle && !this.hostileArmies(a, b) && !b.retreating)], def);
    else this.startBattle(a.loc, def, [a]);
  },
  supplyLimit(p, nid) {
    const sp = this.map.provinces[p];
    if (sp.sea) return 999;
    const pr = this.s.prov[p], te = TERRAIN_ECON[sp.terrain];
    let lim = (3 + pr.dev * 0.5 + (pr.buildings.farm || 0) * 1.5 + (pr.buildings.road || 0) * 2) * te.supply;
    const s = this.season();
    if (s === 'winter') lim *= sp.lat > 52 || ['mountains', 'taiga'].includes(sp.terrain) ? 0.45 : 0.75;
    if (pr.owner === nid || this.isAlly(nid, pr.owner)) lim *= 1.3; else lim *= 0.8;
    lim *= 1 - pr.devast / 200;
    return lim * (1 + this.mod(nid, 'supply'));
  },
  supplyAndRecovery(a) {
    const s = this.s, n = s.nations[a.nation];
    const sp = this.map.provinces[a.loc];
    const g = this.generalOf(a);
    let attr = 0;
    if (sp.sea) attr += 0.003;
    else {
      const regs = this.armiesAt(a.loc).filter((b) => b.nation === a.nation).reduce((t, b) => t + b.regs.length, 0);
      const lim = this.supplyLimit(a.loc, a.nation) * (1 + (g?.gen?.logistics || 0) * 0.1);
      if (regs > lim) attr += 0.0015 * (regs / lim - 1) * 3;
      const se = this.season();
      if (se === 'winter' && (sp.lat > 55 || ['mountains', 'taiga'].includes(sp.terrain)) && !(g && g.traits.includes('winter_soldier'))) attr += 0.001;
      if (se === 'summer' && sp.terrain === 'desert') attr += 0.0008;
      if (n && n.food < 0) attr += 0.001;
      if (g && g.traits.includes('logistician')) attr *= 0.5;
      // foraging devastates enemy land
      const pr = s.prov[a.loc];
      if (pr.owner !== a.nation) pr.devast = Math.min(100, pr.devast + 0.15 * a.regs.length / 5);
    }
    if (n && n.ai.horde) attr = 0; // the horde lives off the land and its remounts
    a.attrition = attr;
    const own = !sp.sea && (s.prov[a.loc].controller === a.nation || !!(n && n.ai.horde));
    for (const r of a.regs) {
      if (attr) r.men = Math.max(0, r.men - r.men * attr);
      r.morale = Math.min(1, r.morale + (own ? 0.05 : 0.025) * (n && n.food < 0 ? 0.3 : 1));
      // reinforcement from manpower in friendly territory
      if (own && n && r.men < r.max && n.manpower > 0) {
        const add = Math.min(r.max - r.men, r.max * 0.03, n.manpower);
        r.men += add; n.manpower -= add;
      }
    }
    if (a.regs.some((r) => r.men < 30)) a.regs = a.regs.filter((r) => r.men >= 30);
  },
  dailyRecruit() {
    const s = this.s;
    for (const r of [...s.recruit]) {
      if (s.prov[r.prov].controller !== r.nation) continue;
      r.days -= 1;
      if (r.days <= 0) {
        s.recruit.splice(s.recruit.indexOf(r), 1);
        const regs = this.regsFromTemplate(r.template);
        const a = this.createArmy(r.nation, r.prov, regs, r.template.name, { doctrine: r.template.doctrine });
        a.template = r.template.id;
        if (r.nation === s.player) { this.log(`${a.name} has mustered at ${this.provName(r.prov)}.`, { nation: r.nation, type: 'mil', prov: r.prov, army: a.id }); this.emit('mustered', a.id); }
        // auto-assign an idle general to AI armies
        if (r.nation !== s.player) { const gen = this.charsOf(r.nation, 'general').find((c) => !c.army); if (gen) this.assignGeneral(a.id, gen.id); }
      }
    }
  },
  destroyArmy(a, why) {
    this.unassignGeneral(a.id);
    delete this.s.armies[a.id];
    this.emit('armyGone', a.id);
    if (a.nation === this.s.player && why) this.log(`${a.name} ${why}.`, { nation: a.nation, type: 'mil' });
  },

  // ── sieges & occupation
  dailySieges() {
    const s = this.s;
    const byProv = new Map();
    for (const a of Object.values(s.armies)) {
      if (a.battle || a.atSea || a.path.length || a.retreating) continue;
      if (!this.hostileToProvince(a, a.loc)) continue;
      if (!byProv.has(a.loc)) byProv.set(a.loc, []);
      byProv.get(a.loc).push(a);
    }
    for (let p = 0; p < this.L; p++) {
      const pr = s.prov[p];
      if (pr.siege && !byProv.has(p)) { pr.siege = null; this.emit('siege', p); }
    }
    for (const [p, armies] of byProv) {
      const pr = s.prov[p];
      // a battle in the province pauses the siege
      if (Object.values(s.battles).some((b) => b.prov === p && !b.over)) continue;
      const lead = armies[0];
      const nid = lead.nation >= 0 ? lead.nation : -2;
      const fort = this.fortLevel(p);
      if (fort === 0) {
        pr.occ = (pr.occ || 0) + 1;
        if (pr.occ >= 3) this.occupy(p, nid, lead);
        continue;
      }
      if (!pr.siege || pr.siege.by !== nid) { pr.siege = { by: nid, prog: 0, days: 0, events: [] }; this.emit('siege', p); if (pr.owner === s.player) this.notify({ title: 'Under Siege', icon: '🏰', text: `${this.provName(p)} is besieged!`, prov: p }); }
      const sg = pr.siege;
      sg.days++;
      let men = 0, power = 0, siegeGen = 0;
      for (const a of armies) {
        men += this.armyMen(a);
        for (const r of a.regs) power += (UNITS[r.type].siege || 0) * (r.men / r.max);
        siegeGen = Math.max(siegeGen, this.genStat(a, 'siege') + (this.generalOf(a)?.traits.includes('siege_master') ? 3 : 0));
      }
      const garrison = fort * 1000 * pr.garrison;
      if (men < garrison * 1.5) { sg.blockade = false; continue; }
      sg.blockade = true;
      const ownerN = s.nations[pr.owner];
      let rate = 1.5 * (1 + power / (fort * 2)) * (1 + siegeGen * 0.12 + (nid >= 0 ? this.mod(nid, 'siege') : 0)) / (1 + fort * 0.8 * (1 + (ownerN ? this.mod(ownerN.id, 'fortDefense') : 0)));
      rate *= 1 + sg.days / 250; // starvation
      if (this.map.provinces[p].coastal && ownerN && ownerN.gov === 'merchant_republic') rate *= 0.7; // resupplied by sea
      sg.prog += rate * (0.4 + this.rng() * 1.2);
      // siege events
      if (this.rng() < 0.012) { sg.events.unshift({ day: s.day, t: 'Disease in the siege camp' }); for (const a of armies) for (const r of a.regs) r.men *= 0.97; }
      else if (this.rng() < 0.01 && power > 0) { sg.events.unshift({ day: s.day, t: 'A breach in the walls!' }); sg.prog += 12; }
      else if (this.rng() < 0.008) { sg.events.unshift({ day: s.day, t: 'The garrison sallies out' }); for (const a of armies) for (const r of a.regs) r.men *= 0.985; }
      if (sg.events.length > 6) sg.events.length = 6;
      if (sg.prog >= 100) this.occupy(p, nid, lead, true);
    }
  },
  assault(p) {
    const pr = this.s.prov[p];
    if (!pr.siege) return 'No siege';
    const armies = this.armiesAt(p).filter((a) => this.hostileToProvince(a, p) && !a.battle);
    if (!armies.length) return 'No besiegers';
    const fort = this.fortLevel(p);
    const garrison = fort * 1000 * pr.garrison;
    let men = 0; for (const a of armies) men += this.armyMen(a);
    const chance = clamp(0.15 + pr.siege.prog / 120 + (men / Math.max(1, garrison) - 3) * 0.05, 0.05, 0.9);
    const loss = garrison * (2.2 - pr.siege.prog / 80) * (0.7 + this.rng() * 0.6);
    let left = loss;
    for (const a of armies) for (const r of a.regs) { const l = Math.min(r.men * 0.4, left * r.men / men); r.men -= l; r.morale *= 0.85; }
    const n = this.s.nations[armies[0].nation];
    if (n) n.stats.lostMen += loss;
    if (this.rng() < chance) {
      this.occupy(p, armies[0].nation >= 0 ? armies[0].nation : -2, armies[0], true);
      this.log(`The walls of ${this.provName(p)} are stormed! (${Math.round(loss)} men lost)`, { nation: armies[0].nation, type: 'war', prov: p });
      return null;
    }
    pr.siege.prog = Math.max(0, pr.siege.prog - 10);
    pr.garrison = Math.max(0.3, pr.garrison - 0.15);
    this.log(`The assault on ${this.provName(p)} is thrown back with ${Math.round(loss)} casualties.`, { nation: armies[0].nation, type: 'war', prov: p });
    return 'Assault failed';
  },
  occupy(p, nid, army, sacked) {
    const s = this.s, pr = s.prov[p];
    const prevCtl = pr.controller;
    pr.siege = null; pr.occ = 0;
    if (nid === -2 || (army && army.nation < 0)) {
      pr.controller = -2;
    } else if (pr.owner === nid || (pr.controller === -2 && pr.owner === nid)) {
      pr.controller = pr.owner;
    } else {
      // liberating an ally's province hands it back
      pr.controller = this.isAlly(nid, pr.owner) && this.atWar(nid, prevCtl) ? pr.owner : nid;
    }
    pr.garrison = 0.2;
    if (sacked && army && army.nation >= 0) {
      const loot = pr.dev * 0.8 * (1 + this.mod(army.nation, 'lootMult'));
      s.nations[army.nation].gold += loot;
      pr.devast = Math.min(100, pr.devast + 25);
    }
    this.emit('control', p);
    const w = this.warBetween(nid, prevCtl >= 0 ? prevCtl : pr.owner);
    if (w) this.updateWarScore(w);
    if (pr.owner === s.player && pr.controller !== s.player) this.notify({ title: 'Province Lost', icon: '🏴', text: `${this.provName(p)} has fallen to the ${nid >= 0 ? s.nations[nid].adj : 'rebels'}.`, prov: p });
    if (nid === s.player) this.log(`${this.provName(p)} has been ${this.fortLevel(p) ? 'captured' : 'occupied'}.`, { nation: nid, type: 'war', prov: p });
  },

  spawnRebels(p, nobles = false) {
    const pr = this.s.prov[p];
    if (!pr || pr.owner < 0) return;
    const n = this.s.nations[pr.owner];
    const size = clamp(Math.round(pr.dev / 2 + (nobles ? 4 : 1)), 2, 14);
    const regs = [];
    for (let i = 0; i < size; i++) regs.push(this.newReg(nobles ? (i % 3 === 0 ? 'knights' : i % 3 === 1 ? 'men_at_arms' : 'levy_spear') : (i % 4 === 3 ? 'archers' : 'levy_spear'), 0.9));
    const name = nobles ? `${n.adj} Barons' Host` : pr.religion !== n.religion ? `${this.provName(p)} Zealots` : `${this.provName(p)} Peasant Rising`;
    const a = this.createArmy(-1, p, regs, name, { rebelOf: n.id });
    a.ai.rebel = true;
    pr.unrest = Math.max(0, pr.unrest - 30);
    this.log(`Revolt! ${name} rises in ${this.provName(p)}.`, { nation: n.id, type: 'war', prov: p, important: n.id === this.s.player });
    if (n.id === this.s.player) this.notify({ title: 'Revolt', icon: '🔥', text: `${name} has risen in ${this.provName(p)}!`, prov: p });
    return a;
  },

  spawnMongols() {
    const s = this.s;
    if (this.nationByTag('MON')) return;
    const id = s.nations.length;
    const n = { id, tag: 'MON', name: 'Golden Horde', adj: 'Mongol', color: '#c2b280', culture: 'cuman', group: 'turkic', religion: 'tengri', gov: 'tribal', capital: -1, alive: true, coa: ['or', 'horse', 'sable'],
      gold: 600, food: 300, iron: 80, timber: 80, horses: 200, manpower: 60000, maxManpower: 60000, prestige: 200, legitimacy: 100, stability: 3, warExhaustion: 0,
      laws: { succession: 'gavelkind', authority: 'medium', military: 'warbands', taxation: 'tribute', justice: 'blood_price', church: 'old_gods', peasantry: 'free_tribesmen', trade: 'staple', nobility: 'privileges' },
      lawVote: null, estates: { nobles: { loyalty: 90, influence: 50 }, clergy: { loyalty: 70, influence: 20 }, burghers: { loyalty: 50, influence: 5 }, peasants: { loyalty: 70, influence: 25 } },
      council: {}, ruler: null, heir: null, focus: { cur: null, prog: 0, done: [] }, opinion: {}, allies: [], naps: [], marriages: [], truces: {}, overlord: -1, cbs: [], ae: {},
      templates: [], unlocks: ['horse_archers'], mods: [{ src: 'horde', mods: { discipline: 0.4, armyMorale: 0.3, cavAtk: 0.25, rangedAtk: 0.25, siege: 1.0 } }], ideas: {}, stats: { won: 0, lost: 0, killed: 0, lostMen: 0 }, ai: { aggro: 1, lastWar: -9999, horde: true } };
    s.nations.push(n);
    this._owned = null;
    for (const o of s.nations) { o.opinion[id] = -100; n.opinion[o.id] = -100; }
    this.initCourt(n, { ruler: ['Batu', 'Borjigin', 30, ['ambitious', 'horse_lord']], famous: [['Subutai', 'Uriankhai', 'general', 62, ['cavalry_commander', 'inspiring']], ['Berke', 'Borjigin', 'general', 28, ['aggressive', 'horse_lord']]] }, this.rng);
    n.templates = [{ id: this.newId(), name: 'Tumen', regs: { horse_archers: 12, light_cav: 4, knights: 3, trebuchet: 2 }, doctrine: 'maneuver' }];
    // the horde crosses the Volga
    const P = this.map.provinces;
    const east = [];
    for (let p = 0; p < this.L; p++) if (P[p].lon > 45.5 && P[p].lat > 50 && P[p].lat < 56.5) east.push(p);
    east.sort((a, b) => P[b].lon - P[a].lon);
    const gens = this.charsOf(id, 'general').concat([this.s.chars[n.ruler]]);
    for (let i = 0; i < 8 && i < east.length; i++) {
      const regs = this.regsFromTemplate(n.templates[0]);
      const a = this.createArmy(id, east[i * 2] ?? east[0], regs, `Tumen of ${['Batu', 'Subutai', 'Berke', 'Möngke', 'Orda', 'Güyük', 'Kadan', 'Büri'][i]}`, { doctrine: 'maneuver' });
      if (gens[i]) this.assignGeneral(a.id, gens[i].id);
    }
    // war on everyone in the east
    const targets = ['VOL', 'RYA', 'VLA', 'CUM', 'MOR', 'CHE', 'KIE'].map((t) => this.nationByTag(t)).filter((x) => x && x.alive);
    for (const t of targets) this.declareWar(id, t.id, { kind: 'conquest' }, true);
  },
};
