// Computer-controlled realms: economy, recruitment, councils, focuses, diplomacy,
// war planning and army movement. Each realm "thinks" on a staggered schedule.
import { BUILDINGS, BUILDING_ORDER } from '../data/buildings.js';
import { UNITS, unitAvailable } from '../data/units.js';
import { LAWS, LAW_ORDER, COUNCIL_ROLES, ROLE_INFO } from '../data/government.js';
import { clamp } from '../util.js';

export const AIMixin = {
  dailyAI() {
    const s = this.s;
    const day = s.day;
    for (const n of s.nations) {
      if (!n.alive || n.id === s.player) continue;
      if ((day + n.id * 3) % 15 === 0) this.aiStrategic(n);
    }
    for (const a of Object.values(s.armies)) {
      if (a.nation === s.player) continue;
      if ((day + a.id) % 3 === 0) this.aiArmy(a);
    }
    if (day % 10 === 0) this.aiPeace();
  },

  aiStrategic(n) {
    const s = this.s;
    if (n.ai.horde) { n.gold += 25; n.manpower = Math.min(n.maxManpower = 80000, n.manpower + 3000); }
    // council
    for (const role of COUNCIL_ROLES) {
      if (n.council[role]) continue;
      const pool = this.charsOf(n.id, 'pool');
      if (!pool.length) continue;
      const best = pool.sort((a, b) => b.skills[ROLE_INFO[role].skill] - a.skills[ROLE_INFO[role].skill])[0];
      this.appoint(n.id, role, best.id);
    }
    // generals for idle armies
    for (const a of this.armiesOf(n.id)) {
      if (a.general) continue;
      const g = this.charsOf(n.id, 'general').find((c) => !c.army);
      if (g) this.assignGeneral(a.id, g.id);
      else if (n.prestige > 20 && this.charsOf(n.id, 'pool').length) this.hireGeneral(n.id, this.charsOf(n.id, 'pool').sort((x, y) => y.skills.martial - x.skills.martial)[0].id);
    }
    // focus
    if (!n.focus.cur) {
      const tree = this.focusTree(n.id).filter((f) => this.focusStatus(n.id, f) === 'available');
      if (tree.length) {
        const war = this.atWar(n.id);
        tree.sort((a, b) => (war && a.x >= 4 && a.x <= 10 ? -1 : 0) - (war && b.x >= 4 && b.x <= 10 ? -1 : 0) || a.y - b.y || this.rng() - 0.5);
        this.startFocus(n.id, tree[0].id);
      }
    }
    // laws (rarely)
    if (!n.lawVote && this.rng() < 0.08) {
      const cat = LAW_ORDER[Math.floor(this.rng() * LAW_ORDER.length)];
      const cur = this.aiLawScore(n, cat, n.laws[cat]);
      const opts = Object.keys(LAWS[cat].options).filter((o) => !this.canProposeLaw(n.id, cat, o) && this.lawVote(n.id, cat, o).yes > 0.55 && this.aiLawScore(n, cat, o) > cur + 0.5);
      opts.sort((a, b) => this.aiLawScore(n, cat, b) - this.aiLawScore(n, cat, a));
      if (opts.length) this.proposeLaw(n.id, cat, opts[0]);
    }
    // economy
    this.aiBuild(n);
    this.aiRecruit(n);
    this.aiDiplomacy(n);
  },

  aiLawScore(n, cat, opt) {
    const m = LAWS[cat].options[opt]?.mods || {};
    const W = { taxMult: 25, tradeMult: 12, manpowerMult: 10, discipline: 30, legitimacyMonthly: 25, stabilityMonthly: 80, unrest: -0.8, nobleLoyalty: 0.06, clergyLoyalty: 0.04, burgherLoyalty: 0.03,
      devGrowth: 8, armyMorale: 25, upkeepMult: -10, recruitCost: -8, foodMult: 6, buildCost: -6, decree: 2, trainSpeed: 4, horsesMult: 3, cavCost: -5, lootMult: 2, defenseHome: 6 };
    let v = 0;
    for (const [k, x] of Object.entries(m)) v += (W[k] || 0) * x;
    if (n.estates.nobles.loyalty < 35) v += (m.nobleLoyalty || 0) * 0.2;
    return v;
  },
  aiBuild(n) {
    const B = this.budget(n.id);
    let tries = n.gold > 400 ? 8 : n.gold > 150 ? 4 : 2;
    while (tries-- > 0 && n.gold > 50 + B.armyUpkeep * 3) {
      const ps = this.ownedProvinces(n.id);
      let best = null, bs = 0;
      for (let k = 0; k < 14; k++) {
        const p = ps[Math.floor(this.rng() * ps.length)];
        const pr = this.s.prov[p], sp = this.map.provinces[p];
        for (const type of BUILDING_ORDER) {
          if (this.canBuild(n.id, p, type)) continue;
          const lvl = pr.buildings[type] || 0;
          let v = 0;
          if (type === 'farm') v = (sp.terrain === 'farmland' ? 3 : 1.5) + (n.food < 50 ? 3 : 0);
          if (type === 'market') v = pr.dev / 3;
          if (type === 'mine') v = sp.terrain === 'mountains' ? 3 : 2;
          if (type === 'lumber') v = n.timber < 20 ? 3 : 0.8;
          if (type === 'stables') v = n.horses < 10 ? 2.5 : 0.6;
          if (type === 'walls') v = (this.borderProvinces(n.id).includes(p) ? 2 : 0.3) + (p === n.capital ? 2 : 0) + pr.dev / 8;
          if (type === 'church') v = pr.unrest / 15 + (pr.religion !== n.religion ? 3 : 0.5);
          if (type === 'port') v = n.gov === 'merchant_republic' ? 3 : 1;
          if (type === 'barracks') v = p === n.capital ? 2 : 0.4;
          if (type === 'workshop') v = pr.dev / 6;
          if (type === 'road') v = 0.7;
          v /= 1 + lvl;
          v *= 0.7 + this.rng() * 0.6;
          if (v > bs) { bs = v; best = [p, type]; }
        }
      }
      if (!best) break;
      if (this.build(n.id, best[0], best[1])) break;
    }
  },

  aiRecruit(n) {
    const war = this.atWar(n.id);
    const regs = this.armiesOf(n.id).reduce((t, a) => t + a.regs.length, 0) + this.s.recruit.filter((r) => r.nation === n.id).reduce((t, r) => t + Object.values(r.template.regs).reduce((x, y) => x + y, 0), 0);
    const B = this.budget(n.id);
    const want = Math.min(n.maxManpower / 1000 * (war ? 0.8 : 0.4), Math.max(3, B.income * (war ? 1.3 : 0.9) / 0.22));
    if (regs >= want) return;
    const t = (war && n.templates.length > 0 ? n.templates : n.templates).find((tt) => !this.canRecruit(n.id, n.capital, tt) && Object.keys(tt.regs).every((k) => unitAvailable(k, n, this)));
    if (!t || n.capital < 0) return;
    if (n.gold - this.templateCost(n.id, t).gold < (war ? 0 : 25)) return;
    this.recruit(n.id, n.capital, t);
  },

  aiDiplomacy(n) {
    const s = this.s;
    if (n.ai.horde) return;
    const myPow = this.power(n.id);
    const nbs = this.neighbours(n.id);
    // alliances: seek friends against strong neighbours
    if (n.allies.length < 2 && this.rng() < 0.3) {
      const threats = nbs.filter((o) => this.power(o) > myPow * 1.2);
      const cands = s.nations.filter((o) => o.alive && o.id !== n.id && !n.allies.includes(o.id) && !this.atWar(n.id, o.id) && o.id !== s.player && o.overlord < 0 &&
        (threats.some((t) => this.neighbours(o.id).includes(t)) || this.opinion(o.id, n.id) > 40));
      for (const o of cands.slice(0, 3)) if (!this.proposeAlliance(n.id, o.id)) break;
    }
    if (this.rng() < 0.25 && n.gold > 40) {
      const strong = nbs.filter((o) => this.power(o) > myPow).sort((a, b) => this.power(b) - this.power(a))[0];
      if (strong !== undefined) this.improveRelations(n.id, strong);
    }
    // claims
    if (!n.claimFab && n.council.chancellor && n.ai.aggro > 0.5 && n.gold > 60 && this.rng() < 0.2) {
      const weak = nbs.filter((o) => this.power(o) < myPow * 0.8);
      if (weak.length) {
        const t = weak[Math.floor(this.rng() * weak.length)];
        const ps = this.ownedProvinces(t).filter((p) => this.map.provinces[p].adj.some((e) => e.id < this.L && s.prov[e.id].owner === n.id) && !s.prov[p].claims.includes(n.id));
        if (ps.length) this.fabricateClaim(n.id, ps[0]);
      }
    }
    // war
    if (this.atWar(n.id) || n.overlord >= 0) return;
    if (s.day - n.ai.lastWar < 365 * 2 || s.day < 120) return;
    if (n.stability < 0 || n.warExhaustion > 5 || n.manpower < n.maxManpower * 0.4) return;
    const friends = (nid) => this.s.nations[nid].allies.reduce((t, x) => t + this.power(x) * 0.6, 0);
    const myTot = myPow + friends(n.id);
    let best = null, bs = 0;
    for (const o of nbs) {
      if (n.allies.includes(o) || (n.truces[o] || 0) > s.day || this.s.nations[o].overlord === n.id || n.overlord === o) continue;
      const cbs = this.cbsAgainst(n.id, o).filter((c) => c !== 'conquest' || n.ai.aggro > 0.75);
      if (!cbs.length) continue;
      const theirs = this.power(o) + friends(o);
      const ratio = myTot / Math.max(1, theirs);
      if (ratio < 1.4) continue;
      const sc = ratio * (cbs.includes('claim') ? 1.5 : 1) * (cbs.includes('holy_war') ? 1.3 : 1) * (o === s.player ? 0.8 : 1) * (this.opinion(n.id, o) < 0 ? 1.3 : 1);
      if (sc > bs) { bs = sc; best = [o, cbs[0]]; }
    }
    if (best && this.rng() < 0.12 * n.ai.aggro * 2) this.declareWar(n.id, best[0], { kind: best[1] });
  },

  aiPeace() {
    const s = this.s;
    for (const w of Object.values(s.wars)) {
      this.updateWarScore(w);
      const months = (s.day - w.start) / 30;
      for (const side of ['att', 'def']) {
        const leader = side === 'att' ? w.attLeader : w.defLeader;
        const other = side === 'att' ? w.defLeader : w.attLeader;
        if (leader === s.player) continue;
        const n = s.nations[leader];
        if (!n || !n.alive) continue;
        const score = side === 'att' ? w.score : -w.score;
        if (score < 15 && !(months > 30 && Math.abs(w.score) < 10)) continue;
        // build a demand list worth at most our war score
        const demands = [];
        let budget = score;
        const losers = side === 'att' ? w.def : w.att;
        const occupied = [];
        for (const ln of losers) for (const p of this.ownedProvinces(ln)) if (s.prov[p].controller === leader || (side === 'att' ? w.att : w.def).includes(s.prov[p].controller)) occupied.push(p);
        occupied.sort((a, b) => (s.prov[b].claims.includes(leader) ? 10 : 0) - (s.prov[a].claims.includes(leader) ? 10 : 0) || s.prov[b].dev - s.prov[a].dev);
        for (const p of occupied) {
          const near = this.map.provinces[p].adj.some((e) => e.id < this.L && s.prov[e.id].owner === leader) || this.map.provinces[p].coastal || n.ai.horde;
          if (!near && !s.prov[p].claims.includes(leader)) continue;
          const d = { type: 'province', p, to: leader };
          const c = this.demandCost(w, side, d);
          if (c <= budget) { demands.push(d); budget -= c; }
        }
        if (!demands.length && budget > 20 && !n.ai.horde) demands.push({ type: 'gold', v: Math.round(Math.min(150, budget * 6)) });
        if (!demands.length && months < 30) continue;
        if (other === s.player) {
          if (!s.peaceOffers?.some((o) => o.war === w.id)) {
            (s.peaceOffers ||= []).push({ war: w.id, side, demands, from: leader, day: s.day });
            this.notify({ title: 'Peace Offer', icon: '🕊', text: `${n.name} offers peace terms.`, peace: w.id });
          }
          continue;
        }
        const acc = this.peaceAcceptance(w, side, demands);
        if (acc.will >= 0) { this.makePeace(w, side, demands); break; }
      }
    }
  },

  // ── armies
  aiArmy(a) {
    const s = this.s;
    if (a.battle || a.retreating || a.atSea && a.path.length) return;
    if (a.nation < 0) return this.aiRebel(a);
    const n = s.nations[a.nation];
    if (!n || !n.alive) return;
    const P = this.map.provinces;
    const enemies = this.enemiesOf(a.nation);
    const men = this.armyMen(a), max = this.armyMax(a);
    const myPow = this.armyPower(a);
    // merge with friendly armies here
    const friends = this.armiesAt(a.loc).filter((b) => b !== a && b.nation === a.nation && !b.battle && !b.path.length && !b.retreating);
    if (friends.length && a.regs.length + friends[0].regs.length <= 30) { this.merge([a.id, friends[0].id]); return; }
    if (!enemies.length) {
      if (a.path.length) return;
      if (a.loc >= this.L || !this.canEnter(a.nation, a.loc) || s.prov[a.loc].owner !== a.nation) {
        const home = n.capital >= 0 ? n.capital : this.ownedProvinces(a.nation)[0];
        if (home !== undefined) this.orderMove(a.id, home);
      }
      return;
    }
    // exhausted armies fall back to recover
    if (men < max * 0.45 || this.armyMorale(a) < 0.35) {
      if (a.loc < this.L && s.prov[a.loc].controller === a.nation && !this.armiesAt(a.loc).some((b) => this.hostileArmies(a, b))) { a.path = []; return; }
      const t = this.retreatTarget(a);
      if (t >= 0) this.orderMove(a.id, t);
      return;
    }
    if (a.path.length && (s.day + a.id) % 9 !== 0) return;
    const here = P[a.loc];
    const dist = (p) => Math.hypot(P[p].x - here.x, P[p].y - here.y);
    // 1. strike weaker enemy armies nearby
    let target = null, best = 0;
    for (const b of Object.values(s.armies)) {
      if (!this.hostileArmies(a, b) || b.atSea) continue;
      const d = dist(b.loc);
      if (d > 140) continue;
      const theirPow = this.armiesAt(b.loc).filter((x) => !this.hostileArmies(b, x)).reduce((t, x) => t + this.armyPower(x), 0);
      if (myPow < theirPow * 1.15) continue;
      const sc = (myPow / Math.max(1, theirPow)) / (1 + d / 40) * (b.loc < this.L && s.prov[b.loc].owner === a.nation ? 2 : 1);
      if (sc > best) { best = sc; target = b.loc; }
    }
    // 2. otherwise besiege enemy-held land, preferring claims, capitals and our own occupied provinces
    if (target === null) {
      for (let p = 0; p < this.L; p++) {
        const pr = s.prov[p];
        if (!this.hostileToProvince(a, p)) continue;
        const d = dist(p);
        if (d > 260) continue;
        const enemyThere = this.armiesAt(p).filter((b) => this.hostileArmies(a, b)).reduce((t, b) => t + this.armyPower(b), 0);
        if (enemyThere > myPow * 0.9) continue;
        const fort = this.fortLevel(p);
        const hasSiege = a.regs.some((r) => UNITS[r.type].siege);
        let v = (pr.dev + 4) * (pr.claims.includes(a.nation) ? 2 : 1) * (pr.owner === a.nation ? 3 : 1) * (s.nations[pr.owner]?.capital === p ? 1.8 : 1);
        v /= 1 + fort * (hasSiege ? 0.4 : 1.2);
        // someone else of ours already sieging it?
        if (pr.siege && pr.siege.by === a.nation) v *= 0.4;
        const sc = v / (1 + d / 25);
        if (sc > best) { best = sc; target = p; }
      }
    }
    if (target !== null && target !== a.loc) {
      if (a.path.length && a.path[a.path.length - 1] === target) return;
      if (this.orderMove(a.id, target)) a.ai.fail = (a.ai.fail || 0) + 1;
    }
  },
  aiRebel(a) {
    const s = this.s;
    if (a.path.length) return;
    const n = s.nations[a.rebelOf];
    if (!n || !n.alive) { this.destroyArmy(a); return; }
    // rebels who hold provinces long enough force concessions
    const held = this.ownedProvinces(a.rebelOf).filter((p) => s.prov[p].controller === -2);
    if (held.length >= 3 && this.rng() < 0.05) {
      n.legitimacy = Math.max(0, n.legitimacy - 20); n.stability = Math.max(-3, n.stability - 1);
      for (const p of held) { s.prov[p].controller = n.id; s.prov[p].unrest = 0; this.emit('control', p); }
      this.log(`The rebels in the ${n.name} force the crown to accept their demands.`, { nation: n.id, type: 'war', important: n.id === s.player });
      this.destroyArmy(a);
      return;
    }
    const P = this.map.provinces;
    if (this.hostileToProvince(a, a.loc)) return; // keep besieging
    let best = null, bd = 1e9;
    for (const e of P[a.loc].adj) {
      if (e.id >= this.L || !this.hostileToProvince(a, e.id)) continue;
      const d = this.fortLevel(e.id) + this.rng();
      if (d < bd) { bd = d; best = e.id; }
    }
    if (best !== null) this.orderMove(a.id, best);
  },
};
