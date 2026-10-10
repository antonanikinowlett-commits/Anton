// Dividing armies into divisions, and front lines: armies assigned to a front spread
// themselves evenly along the border with an enemy and either hold it or advance on a
// broad front, province by province.
import { UNITS } from '../data/units.js';

export const FrontsMixin = {
  // ── dividing armies
  detach(aid, indices) {
    const a = this.s.armies[aid];
    if (!a || a.battle || a.retreating) return null;
    const set = new Set(indices);
    if (!set.size || set.size >= a.regs.length) return null;
    const taken = a.regs.filter((_, i) => set.has(i));
    a.regs = a.regs.filter((_, i) => !set.has(i));
    const b = this.createArmy(a.nation, a.loc, taken, null, { doctrine: a.doctrine, rebelOf: a.rebelOf });
    b.atSea = a.atSea;
    this.emit('army', a.id);
    return b;
  },
  // Split into n divisions with the same mix of troops in each.
  splitInto(aid, n) {
    const a = this.s.armies[aid];
    if (!a || a.battle || a.retreating) return [];
    n = Math.min(n, a.regs.length);
    if (n < 2) return [a];
    const order = ['inf', 'rng', 'cav', 'siege'];
    const sorted = [...a.regs].sort((x, y) => order.indexOf(UNITS[x.type].cls) - order.indexOf(UNITS[y.type].cls) || x.type.localeCompare(y.type));
    const groups = Array.from({ length: n }, () => []);
    sorted.forEach((r, i) => groups[i % n].push(r));
    a.regs = groups[0];
    const out = [a];
    for (let k = 1; k < n; k++) {
      const b = this.createArmy(a.nation, a.loc, groups[k], null, { doctrine: a.doctrine, rebelOf: a.rebelOf });
      b.atSea = a.atSea;
      out.push(b);
    }
    this.emit('army', a.id);
    return out;
  },
  // Separate infantry, missile troops, cavalry and siege engines into their own armies.
  splitByType(aid) {
    const a = this.s.armies[aid];
    if (!a || a.battle || a.retreating) return [];
    const by = {};
    for (const r of a.regs) (by[UNITS[r.type].cls] ||= []).push(r);
    const keys = Object.keys(by);
    if (keys.length < 2) return [a];
    const names = { inf: 'Foot', rng: 'Archers', cav: 'Horse', siege: 'Siege Train' };
    a.regs = by[keys[0]];
    const out = [a];
    for (const k of keys.slice(1)) {
      const b = this.createArmy(a.nation, a.loc, by[k], `${a.name} — ${names[k]}`, { doctrine: a.doctrine, rebelOf: a.rebelOf });
      b.atSea = a.atSea;
      out.push(b);
    }
    this.emit('army', a.id);
    return out;
  },

  // ── fronts
  frontsOf(nid) { return Object.values(this.s.fronts ||= {}).filter((f) => f.nation === nid); },
  frontOfArmy(aid) { return Object.values(this.s.fronts ||= {}).find((f) => f.armies.includes(aid)); },
  // Our provinces that touch land held by the enemy (or by anyone fighting on the enemy's side).
  frontProvinces(f) {
    const s = this.s, P = this.map.provinces, L = this.L;
    const foes = this.frontFoes(f);
    const out = [];
    for (const p of this.ownedProvinces(f.nation)) {
      if (s.prov[p].controller !== f.nation) continue;
      if (P[p].adj.some((e) => e.id < L && !e.strait && foes.has(s.prov[e.id].controller))) out.push(p);
    }
    // occupied enemy land also counts as front if it borders still-enemy land
    for (let p = 0; p < L; p++) {
      if (s.prov[p].controller !== f.nation || s.prov[p].owner === f.nation) continue;
      if (P[p].adj.some((e) => e.id < L && !e.strait && foes.has(s.prov[e.id].controller))) out.push(p);
    }
    return this.orderAlongLine(out);
  },
  frontFoes(f) {
    const foes = new Set([f.enemy]);
    const w = this.warBetween(f.nation, f.enemy);
    if (w) for (const x of (w.att.includes(f.nation) ? w.def : w.att)) foes.add(x);
    return foes;
  },
  // Sort provinces along the main axis of the line so divisions are spread in order.
  orderAlongLine(list) {
    if (list.length < 3) return list;
    const P = this.map.provinces;
    let mx = 0, mz = 0;
    for (const p of list) { mx += P[p].x; mz += P[p].y; }
    mx /= list.length; mz /= list.length;
    let sxx = 0, szz = 0, sxz = 0;
    for (const p of list) { const dx = P[p].x - mx, dz = P[p].y - mz; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
    const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz);
    const ax = Math.cos(ang), az = Math.sin(ang);
    const proj = (p) => P[p].x * ax + P[p].y * az;
    // start at one end of the line, then walk to the nearest unvisited province each step
    const left = new Set(list);
    let cur = list.reduce((a, b) => (proj(b) < proj(a) ? b : a));
    const out = [cur]; left.delete(cur);
    while (left.size) {
      let best = null, bd = 1e18;
      for (const p of left) { const d = (P[p].x - P[cur].x) ** 2 + (P[p].y - P[cur].y) ** 2; if (d < bd) { bd = d; best = p; } }
      out.push(best); left.delete(best); cur = best;
    }
    return out;
  },
  createFront(nid, enemy, armyIds, mode = 'hold') {
    const s = this.s;
    s.fronts ||= {};
    if (enemy === nid || !s.nations[enemy]?.alive) return 'Choose an enemy realm';
    for (const id of armyIds) this.leaveFront(id);
    let f = this.frontsOf(nid).find((x) => x.enemy === enemy);
    if (!f) { f = { id: this.newId(), nation: nid, enemy, armies: [], mode }; s.fronts[f.id] = f; }
    f.armies.push(...armyIds.filter((id) => s.armies[id]?.nation === nid));
    if (!this.frontProvinces(f).length) { delete s.fronts[f.id]; return `We share no border with the ${s.nations[enemy].name}`; }
    this.manageFront(f);
    this.emit('fronts');
    return null;
  },
  setFrontMode(fid, mode) {
    const f = this.s.fronts?.[fid];
    if (!f) return 'No such front';
    if (mode === 'advance' && !this.atWar(f.nation, f.enemy)) return 'You must be at war to advance';
    f.mode = mode;
    this.manageFront(f);
    this.emit('fronts');
    return null;
  },
  leaveFront(aid) {
    for (const f of Object.values(this.s.fronts || {})) {
      const i = f.armies.indexOf(aid);
      if (i >= 0) { f.armies.splice(i, 1); this.emit('fronts'); }
    }
  },
  deleteFront(fid) { if (this.s.fronts) delete this.s.fronts[fid]; this.emit('fronts'); },
  // Split one army into enough divisions to cover a whole front and assign them to it.
  coverFront(aid, enemy) {
    const a = this.s.armies[aid];
    if (!a) return 'No army';
    const probe = { nation: a.nation, enemy, armies: [] };
    const line = this.frontProvinces(probe);
    if (!line.length) return `We share no border with the ${this.s.nations[enemy]?.name || 'enemy'}`;
    const n = Math.max(1, Math.min(line.length, Math.floor(a.regs.length / 2)));
    const divs = n > 1 ? this.splitInto(aid, n) : [a];
    const gens = this.charsOf(a.nation, 'general').filter((c) => !c.army);
    for (const d of divs) if (!d.general && gens.length) this.assignGeneral(d.id, gens.shift().id);
    return this.createFront(a.nation, enemy, divs.map((d) => d.id), 'hold');
  },

  // Re-deploy a front's divisions every few days.
  dailyFronts() {
    const s = this.s;
    if (!s.fronts) return;
    for (const f of Object.values(s.fronts)) {
      f.armies = f.armies.filter((id) => s.armies[id]);
      if (!s.nations[f.enemy]?.alive || !f.armies.length) { delete s.fronts[f.id]; this.emit('fronts'); continue; }
      if (f.mode === 'advance' && !this.atWar(f.nation, f.enemy)) f.mode = 'hold';
      if ((s.day + f.id) % 3 === 0) this.manageFront(f);
    }
  },
  manageFront(f) {
    const s = this.s, P = this.map.provinces;
    const line = this.frontProvinces(f);
    f.line = line;
    if (!line.length) return;
    const foes = this.frontFoes(f);
    const armies = f.armies.map((id) => s.armies[id]).filter((a) => a && !a.battle && !a.retreating);
    // keep the order of divisions along the line stable: sort them by where they stand
    const idx = new Map(line.map((p, i) => [p, i]));
    const proj = (a) => {
      if (idx.has(a.loc)) return idx.get(a.loc);
      let best = 0, bd = 1e9;
      line.forEach((p, i) => { const d = (P[p].x - P[a.loc].x) ** 2 + (P[p].y - P[a.loc].y) ** 2; if (d < bd) { bd = d; best = i; } });
      return best;
    };
    armies.sort((a, b) => proj(a) - proj(b));
    const k = armies.length, m = line.length;
    armies.forEach((a, i) => {
      const slot = line[Math.min(m - 1, Math.round((i + 0.5) * m / k - 0.5))];
      // an advancing division that is already in enemy land keeps besieging/occupying
      if (f.mode === 'advance' && a.loc < this.L && this.hostileToProvince(a, a.loc)) return;
      if (f.mode === 'advance' && (a.loc === slot || idx.has(a.loc))) {
        const here = idx.has(a.loc) ? a.loc : slot;
        const targets = P[here].adj.filter((e) => e.id < this.L && !e.strait && foes.has(s.prov[e.id].controller));
        if (!targets.length) return;
        const myPow = this.armyPower(a);
        let best = null, bs = -1e9;
        for (const e of targets) {
          const enemyPow = this.armiesAt(e.id).filter((b) => this.hostileArmies(a, b)).reduce((t, b) => t + this.armyPower(b), 0);
          if (enemyPow > myPow * 1.3) continue;
          const sc = s.prov[e.id].dev - this.fortLevel(e.id) * 4 - enemyPow * 0.5 - (e.river ? 3 : 0) + (s.prov[e.id].claims.includes(f.nation) ? 3 : 0);
          if (sc > bs) { bs = sc; best = e.id; }
        }
        if (best !== null && a.path[a.path.length - 1] !== best) this.orderMove(a.id, best);
        return;
      }
      if (a.loc !== slot && a.path[a.path.length - 1] !== slot) this.orderMove(a.id, slot);
    });
  },
};
