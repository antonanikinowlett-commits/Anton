// Field battles. Each day has four rounds. Armies deploy into wings, centre, a missile
// line and reserves according to the frontage the terrain allows; generals choose a
// tactic for every phase and the better tactician may counter his opponent's choice.
// Victory is decided by morale far more often than by casualties, as it was in reality.
import { UNITS, TERRAIN_COMBAT } from '../data/units.js';
import { TACTICS, PHASES, PHASE_NAMES, DOCTRINES } from '../data/tactics.js';
import { TRAITS } from '../data/traits.js';
import { clamp } from '../util.js';

const ROUNDS_PER_DAY = 4;
const MAX_ROUNDS = 48;

function cls(type) { return UNITS[type].cls; }

export const BattleMixin = {
  startBattle(p, attackers, defenders) {
    const s = this.s, sp = this.map.provinces[p];
    const id = this.newId();
    const se = this.season();
    const r = this.rng();
    let weather = 'clear';
    if (se === 'winter' && sp.lat > 47) weather = r < 0.35 ? 'snow' : r < 0.5 ? 'fog' : 'clear';
    else if (se === 'spring' || se === 'autumn') weather = r < 0.3 ? 'rain' : r < 0.42 ? 'fog' : 'clear';
    else if (se === 'summer' && ['desert', 'steppe'].includes(sp.terrain)) weather = r < 0.6 ? 'heat' : 'clear';
    else weather = r < 0.12 ? 'rain' : 'clear';
    const a0 = attackers[0];
    const fromEdge = a0.lastFrom !== undefined ? sp.adj.find((e) => e.id === a0.lastFrom) : null;
    const b = {
      id, prov: p, att: attackers.map((a) => a.id), def: defenders.map((a) => a.id), round: 0, phase: 'opening', phaseRound: 0,
      attN: this.side(attackers[0]), defN: this.side(defenders[0]),
      terrain: sp.terrain, weather, season: se, river: !!(fromEdge && fromEdge.river), strait: !!(fromEdge && fromEdge.strait),
      landing: a0.landed === s.day, fort: this.fortLevel(p) > 0 && defenders.some((d) => s.prov[p]?.controller === d.nation),
      highGround: false, tac: { att: {}, def: {} }, countered: { att: {}, def: {} }, log: [], cas: { att: 0, def: 0 }, fx: [], lines: { att: null, def: null },
      startMen: { att: 0, def: 0 }, over: false, winner: null, hist: [], startDay: s.day,
    };
    if (fromEdge) b.highGround = sp.elev - this.map.provinces[a0.lastFrom].elev > 150;
    for (const a of attackers) { a.battle = id; a.path = []; a.prog = 0; }
    for (const a of defenders) { a.battle = id; a.path = []; a.prog = 0; }
    b.startMen.att = attackers.reduce((t, a) => t + this.armyMen(a), 0);
    b.startMen.def = defenders.reduce((t, a) => t + this.armyMen(a), 0);
    s.battles[id] = b;
    const W = { clear: 'clear skies', rain: 'driving rain', fog: 'thick fog', snow: 'falling snow', heat: 'blistering heat' }[weather];
    this.blog(b, `Battle of ${sp.name} begins under ${W}. ${this.sideName(b, 'att')} attack ${this.sideName(b, 'def')}${b.river ? ' across the river' : ''}${b.landing ? ' straight from the boats' : ''}.`);
    if (b.highGround) this.blog(b, `The defenders hold the high ground.`);
    const pl = s.player;
    if (attackers.some((a) => a.nation === pl) || defenders.some((a) => a.nation === pl)) {
      this.notify({ title: 'Battle!', icon: '⚔', text: `Battle of ${sp.name}`, battle: id, prov: p });
    }
    this.emit('battle', id);
    return b;
  },
  sideName(b, side) {
    const nid = side === 'att' ? b.attN : b.defN;
    return nid >= 0 ? `the ${this.s.nations[nid].adj}` : 'the rebels';
  },
  blog(b, t) { t = t.charAt(0) === '★' ? t : t.charAt(0).toUpperCase() + t.slice(1); b.log.push({ r: b.round, t }); if (b.log.length > 80) b.log.shift(); },
  joinBattle(b, a) {
    const sideArmies = (side) => b[side].map((i) => this.s.armies[i]).filter(Boolean);
    const att = sideArmies('att'), def = sideArmies('def');
    let side = null;
    if (att.some((x) => !this.hostileArmies(x, a)) && def.some((x) => this.hostileArmies(x, a))) side = 'att';
    else if (def.some((x) => !this.hostileArmies(x, a)) && att.some((x) => this.hostileArmies(x, a))) side = 'def';
    if (!side) return;
    b[side].push(a.id); a.battle = b.id; a.path = []; a.prog = 0;
    b.startMen[side] += this.armyMen(a);
    this.blog(b, `${a.name} arrives to reinforce ${this.sideName(b, side)}!`);
  },

  // Build the tactic context for one side.
  battleCtx(b, side) {
    const other = side === 'att' ? 'def' : 'att';
    const mk = (sd) => {
      const armies = b[sd].map((i) => this.s.armies[i]).filter(Boolean);
      const regs = armies.flatMap((a) => a.regs.filter((r) => r.men > 0 && !r.routed));
      const total = regs.reduce((t, r) => t + r.men, 0) || 1;
      const shareOf = (k) => regs.filter((r) => r.type === k || cls(r.type) === k).reduce((t, r) => t + r.men, 0) / total;
      const lead = armies.reduce((best, a) => (this.genStat(a, 'tactics') > this.genStat(best, 'tactics') ? a : best), armies[0]);
      const g = lead ? this.generalOf(lead) : null;
      return { armies, regs, lead, share: shareOf, width: b.lines[sd] ? b.lines[sd].frontCount : Math.min(regs.length, this.frontWidth(b)),
        general: { tactics: lead ? this.genStat(lead, 'tactics') : 0, trait: (t) => !!(g && g.traits.includes(t)) }, doctrine: lead ? lead.doctrine : 'balanced',
        nation: armies[0]?.nation };
    };
    const me = mk(side), en = mk(other);
    const nat = me.nation >= 0 ? this.s.nations[me.nation] : null;
    return { ...me, enemy: en, terrain: b.terrain, season: b.season, defender: side === 'def', reserves: b.lines[side] ? b.lines[side].reserve.length : 0,
      gov: nat ? nat.gov : 'tribal', losing: this.sideMorale(b, side) < this.sideMorale(b, other) - 0.15 };
  },
  frontWidth(b) {
    let w = TERRAIN_COMBAT[b.terrain]?.width || 24;
    if (b.river) w *= 0.7;
    if (b.weather === 'fog') w *= 0.85;
    return Math.max(6, Math.round(w / 2));
  },
  chooseTactics(b, phase) {
    const ctx = { att: this.battleCtx(b, 'att'), def: this.battleCtx(b, 'def') };
    const pickFor = (side, knowEnemy) => {
      const c = ctx[side];
      const bias = DOCTRINES[c.doctrine]?.bias || {};
      const opts = Object.entries(TACTICS).filter(([, t]) => t.phase === phase && t.req(c));
      if (!opts.length) return null;
      if (knowEnemy) {
        const et = TACTICS[knowEnemy];
        const counter = opts.find(([id]) => et && et.counters.includes(id));
        if (counter && this.rng() < 0.75) return counter[0];
      }
      let tot = 0;
      const ws = opts.map(([id, t]) => { const w = Math.max(0.05, t.w(c) + (bias[id] || 0)); tot += w; return [id, w]; });
      let r = this.rng() * tot;
      for (const [id, w] of ws) { r -= w; if (r <= 0) return id; }
      return ws[ws.length - 1][0];
    };
    const rollA = ctx.att.general.tactics + this.rng() * 6 + (b.weather === 'fog' ? 0 : 0);
    const rollD = ctx.def.general.tactics + this.rng() * 6 + (ctx.def.general.trait('defensive_expert') ? 1 : 0);
    let ta, td;
    if (rollA >= rollD) { td = pickFor('def'); ta = pickFor('att', td); } else { ta = pickFor('att'); td = pickFor('def', ta); }
    b.tac.att[phase] = ta; b.tac.def[phase] = td;
    b.countered.att[phase] = !!(ta && td && TACTICS[ta].counters.includes(td));
    b.countered.def[phase] = !!(ta && td && TACTICS[td].counters.includes(ta));
    const nm = (id) => (id ? `${TACTICS[id].name}` : 'no particular tactic');
    this.blog(b, `${PHASE_NAMES[phase]}: ${this.sideName(b, 'att')} use ${nm(ta)}; ${this.sideName(b, 'def')} answer with ${nm(td)}.`);
    if (b.countered.att[phase]) this.blog(b, `★ ${nm(td)} counters ${nm(ta)}! The attackers are outmanoeuvred.`);
    if (b.countered.def[phase]) this.blog(b, `★ ${nm(ta)} counters ${nm(td)}! The defenders are outmanoeuvred.`);
  },
  // Effective modifiers for a side this round, from tactics, generals, nation and conditions.
  sideMods(b, side) {
    const other = side === 'att' ? 'def' : 'att';
    const M = { ranged: 0, atk: 0, def: 0, charge: 0, flank: 0, morale: 0, moraleTaken: 0, enemyRanged: 0, enemyCharge: 0, casualtiesTaken: 0, pursuit: 0, cav: 0, inf: 0, rng: 0 };
    const add = (m, f = 1) => { if (m) for (const [k, v] of Object.entries(m)) M[k] = (M[k] || 0) + v * f; };
    for (const ph of PHASES) {
      const t = b.tac[side][ph];
      const active = ph === b.phase || (ph === 'opening' && b.phase === 'engage');
      if (!t || !active) continue;
      if (b.countered[side][ph]) { add(TACTICS[t].mods, -0.5); M.moraleTaken += 0.15; }
      else add(TACTICS[t].mods);
      const et = b.tac[other][ph];
      if (et && TACTICS[et].enemyMods && !b.countered[other][ph]) add(TACTICS[et].enemyMods);
    }
    // enemy tactic effects that hit us
    for (const ph of PHASES) {
      const et = b.tac[other][ph];
      if (!et || b.countered[other][ph] || ph !== b.phase) continue;
      const em = TACTICS[et].mods;
      if (em.enemyRanged) M.ranged += em.enemyRanged;
      if (em.enemyCharge) M.charge += em.enemyCharge;
    }
    const armies = b[side].map((i) => this.s.armies[i]).filter(Boolean);
    const lead = armies[0];
    const nid = lead ? lead.nation : -1;
    if (lead) {
      const g = this.generalOf(lead);
      M.atk += this.genStat(lead, 'atk') * 0.05;
      M.def += this.genStat(lead, 'def') * 0.05;
      if (g) for (const t of g.traits) {
        const gm = TRAITS[t].gen;
        if (!gm) continue;
        if (gm.atk) M.atk += gm.atk; if (gm.def) M.def += gm.def; if (gm.morale) M.moraleTaken -= gm.morale;
        if (gm.cav) M.cav += gm.cav; if (gm.ranged) M.rng += gm.ranged; if (gm.casualties) M.casualtiesTaken += gm.casualties;
        if (gm.defDefending && side === 'def') M.def += gm.defDefending;
        if (gm.roughTerrain && ['forest', 'hills', 'mountains', 'marsh', 'taiga'].includes(b.terrain)) { M.atk += gm.roughTerrain; M.def += gm.roughTerrain; }
        if (gm.landing && b.landing) M.atk += gm.landing * 0.5;
      }
      if (!g) { M.atk -= 0.1; M.moraleTaken += 0.1; }
      if (lead.doctrine === 'defensive' && side === 'def') M.def += 0.15;
      if (lead.doctrine === 'shock') { M.atk += 0.1; M.casualtiesTaken += 0.1; }
    }
    if (nid >= 0) {
      M.atk += this.mod(nid, 'discipline'); M.def += this.mod(nid, 'discipline');
      M.moraleTaken -= this.mod(nid, 'armyMorale');
      M.cav += this.mod(nid, 'cavAtk'); M.inf += this.mod(nid, 'infAtk'); M.rng += this.mod(nid, 'rangedAtk');
      if (side === 'def') M.def += this.mod(nid, 'infDef') * 0.5;
      const pr = this.s.prov[b.prov];
      if (pr && pr.owner === nid) { M.def += this.mod(nid, 'defenseHome'); M.moraleTaken -= 0.05; }
      const n = this.s.nations[nid];
      if (n.food < 0) M.moraleTaken += 0.2;
      M.moraleTaken += Math.max(0, -n.stability) * 0.03;
    } else { M.atk -= 0.1; M.def -= 0.1; }
    // conditions
    if (side === 'att') {
      if (b.river) { M.atk -= 0.25; M.charge -= 0.3; }
      if (b.strait) M.atk -= 0.2;
      if (b.landing) M.atk -= 0.3;
      if (b.highGround) { M.atk -= 0.12; M.ranged -= 0.15; }
    } else {
      if (b.highGround) { M.def += 0.12; M.ranged += 0.1; }
      if (b.fort) { M.def += 0.15; M.moraleTaken -= 0.1; }
      const ent = Math.max(...armies.map((a) => a.entrench || 0), 0);
      M.def += Math.min(0.15, ent * 0.01);
    }
    if (b.weather === 'rain') { M.ranged -= 0.3; M.charge -= 0.25; }
    if (b.weather === 'fog') M.ranged -= 0.45;
    if (b.weather === 'snow') { M.atk -= 0.1; M.ranged -= 0.2; M.moraleTaken += 0.1; }
    if (b.weather === 'heat') {
      const natives = nid >= 0 && ['arabic', 'turkic', 'berber', 'persian'].includes(this.s.nations[nid].group);
      if (!natives) { M.moraleTaken += 0.2; M.atk -= 0.1; }
    }
    return M;
  },

  // Deploy regiments into battle lines.
  deploy(b, side) {
    const W = this.frontWidth(b);
    const armies = b[side].map((i) => this.s.armies[i]).filter(Boolean);
    const all = armies.flatMap((a) => a.regs.map((r, i) => ({ a: a.id, i, r }))).filter((x) => x.r.men > 0);
    const fighting = all.filter((x) => !x.r.routed);
    const inf = fighting.filter((x) => cls(x.r.type) === 'inf');
    const cav = fighting.filter((x) => cls(x.r.type) === 'cav');
    const rng = fighting.filter((x) => cls(x.r.type) === 'rng');
    const siege = fighting.filter((x) => cls(x.r.type) === 'siege');
    const wingW = Math.max(1, Math.round(W * 0.2)), centerW = W - wingW * 2;
    const L = { left: [], center: [], right: [], ranged: [], reserve: [], siege, routed: all.filter((x) => x.r.routed) };
    // keep previously engaged regiments in place for continuity
    const prev = b.lines[side];
    const keep = (slot, pool, max) => {
      if (!prev) return;
      for (const x of prev[slot]) {
        const f = pool.find((y) => y.a === x.a && y.i === x.i);
        if (f && L[slot].length < max) { L[slot].push(f); pool.splice(pool.indexOf(f), 1); }
      }
    };
    const infP = [...inf], cavP = [...cav], rngP = [...rng];
    keep('center', infP, centerW); keep('left', cavP, wingW); keep('right', cavP, wingW); keep('left', infP, wingW); keep('right', infP, wingW);
    keep('ranged', rngP, Math.ceil(W * 0.6));
    while (cavP.length && (L.left.length < wingW || L.right.length < wingW)) (L.left.length <= L.right.length && L.left.length < wingW ? L.left : L.right).push(cavP.shift());
    while (infP.length && L.center.length < centerW) L.center.push(infP.shift());
    while (infP.length && (L.left.length < wingW || L.right.length < wingW)) (L.left.length <= L.right.length && L.left.length < wingW ? L.left : L.right).push(infP.shift());
    while (rngP.length && L.ranged.length < Math.ceil(W * 0.6)) L.ranged.push(rngP.shift());
    // ranged troops fill an empty centre if nothing else can
    while (rngP.length && L.center.length < Math.min(3, centerW) && !infP.length) L.center.push(rngP.shift());
    if (!L.center.length && cavP.length) L.center.push(cavP.shift());
    L.reserve = [...infP, ...cavP, ...rngP];
    L.frontCount = L.left.length + L.center.length + L.right.length;
    b.lines[side] = L;
    return L;
  },
  sideMorale(b, side) {
    let m = 0, w = 0;
    for (const id of b[side]) { const a = this.s.armies[id]; if (!a) continue; for (const r of a.regs) { m += (r.routed ? 0 : r.morale) * r.men; w += r.men; } }
    return w ? m / w : 0;
  },
  sideMen(b, side, fightingOnly) {
    let t = 0;
    for (const id of b[side]) { const a = this.s.armies[id]; if (!a) continue; for (const r of a.regs) if (!fightingOnly || !r.routed) t += r.men; }
    return t;
  },

  dailyBattles() {
    for (const b of Object.values(this.s.battles)) {
      if (b.over) { if (this.s.day - b.endDay > 3) delete this.s.battles[b.id]; continue; }
      for (let i = 0; i < ROUNDS_PER_DAY && !b.over; i++) this.battleRound(b);
    }
  },

  battleRound(b) {
    b.round++;
    b.fx = [];
    // phase transitions
    const prevPhase = b.phase;
    if (b.round <= 3) b.phase = 'opening';
    else if (b.round <= 5) b.phase = 'engage';
    else b.phase = 'melee';
    if (b.phase !== prevPhase || b.round === 1) this.chooseTactics(b, b.phase);
    const La = this.deploy(b, 'att'), Ld = this.deploy(b, 'def');
    const Ma = this.sideMods(b, 'att'), Md = this.sideMods(b, 'def');
    const tc = TERRAIN_COMBAT[b.terrain] || TERRAIN_COMBAT.plains;
    const dmg = { att: new Map(), def: new Map() }; // reg -> casualties taken
    const mdmg = { att: new Map(), def: new Map() }; // reg -> extra morale damage
    const hit = (side, target, cas, moraleX = 0) => {
      if (!target || cas <= 0) return;
      dmg[side].set(target, (dmg[side].get(target) || 0) + cas);
      if (moraleX) mdmg[side].set(target, (mdmg[side].get(target) || 0) + moraleX);
    };
    const distribute = (side, targets, cas, moraleX) => {
      const tot = targets.reduce((t, x) => t + x.r.men, 0);
      if (!tot) return;
      for (const x of targets) hit(side, x.r, cas * x.r.men / tot, moraleX);
    };
    const classMult = (type, M) => {
      const c = cls(type);
      return (tc[c] || 1) * (1 + (c === 'cav' ? M.cav : c === 'rng' ? M.rng : c === 'inf' ? M.inf : 0));
    };
    const xpF = (r) => 1 + (r.xp || 0) * 0.25;
    const morF = (r) => 0.55 + 0.45 * Math.max(0, r.morale);
    // ── missile fire
    const volley = (side, M, EM, shooters, targets, f) => {
      if (!shooters.length || !targets.length) return 0;
      let R = 0, pierce = 0, tot = 0;
      for (const x of shooters) {
        const u = UNITS[x.r.type];
        const v = (x.r.men / 1000) * u.ranged * classMult(x.r.type, M) * xpF(x.r) * morF(x.r);
        R += v; pierce += (u.pierce || 0) * v; tot += v;
      }
      if (!R) return 0;
      pierce = tot ? pierce / tot : 0;
      R *= f * (1 + M.ranged);
      const armor = targets.reduce((t, x) => t + UNITS[x.r.type].armor * x.r.men, 0) / Math.max(1, targets.reduce((t, x) => t + x.r.men, 0));
      const cas = 95 * R * (1 - armor * 0.7 * (1 - pierce)) * (0.8 + this.rng() * 0.4) * (1 + EM.casualtiesTaken);
      distribute(side === 'att' ? 'def' : 'att', targets, cas, R * 0.006 * (1 + M.morale));
      b.fx.push({ type: 'volley', side, n: shooters.length });
      return cas;
    };
    const frontOf = (L) => [...L.left, ...L.center, ...L.right];
    const rangedFactor = b.phase === 'opening' ? 1 : b.phase === 'engage' ? 0.5 : 0.25;
    const haA = [...La.ranged, ...La.left, ...La.right].filter((x) => UNITS[x.r.type].ranged > 0 && cls(x.r.type) !== 'inf');
    const haD = [...Ld.ranged, ...Ld.left, ...Ld.right].filter((x) => UNITS[x.r.type].ranged > 0 && cls(x.r.type) !== 'inf');
    volley('att', Ma, Md, haA, frontOf(Ld).length ? frontOf(Ld) : Ld.ranged, rangedFactor);
    volley('def', Md, Ma, haD, frontOf(La).length ? frontOf(La) : La.ranged, rangedFactor);
    // ── melee & charges
    if (b.phase !== 'opening') {
      const charge = b.phase === 'engage' && b.phaseRoundCharge !== b.round;
      const fight = (side, M, EM, mine, theirs, flank) => {
        if (!mine.length || !theirs.length) return;
        const enemyCav = theirs.filter((x) => cls(x.r.type) === 'cav').reduce((t, x) => t + x.r.men, 0) / Math.max(1, theirs.reduce((t, x) => t + x.r.men, 0));
        const enemyBrace = theirs.reduce((t, x) => t + UNITS[x.r.type].anti * x.r.men, 0) / Math.max(1, theirs.reduce((t, x) => t + x.r.men, 0));
        let P = 0;
        for (const x of mine) {
          const u = UNITS[x.r.type];
          let a = u.atk + enemyCav * (u.anti - 1) * 0.8;
          if (charge && u.charge) a += u.charge * Math.max(0, 1 + M.charge) * Math.max(0.2, 1 - (enemyBrace - 1) * 0.45) * (cls(x.r.type) === 'cav' ? tc.cav : 1);
          P += (x.r.men / 1000) * Math.max(0.1, a) * classMult(x.r.type, M) * xpF(x.r) * morF(x.r);
        }
        P *= (1 + M.atk) * (1 + flank);
        const D = theirs.reduce((t, x) => t + UNITS[x.r.type].def * x.r.men, 0) / Math.max(1, theirs.reduce((t, x) => t + x.r.men, 0)) * (1 + EM.def);
        const armor = theirs.reduce((t, x) => t + UNITS[x.r.type].armor * x.r.men, 0) / Math.max(1, theirs.reduce((t, x) => t + x.r.men, 0));
        const cas = 125 * P / (D + 1) * (1 - armor * 0.45) * (0.8 + this.rng() * 0.4) * (1 + EM.casualtiesTaken);
        distribute(side === 'att' ? 'def' : 'att', theirs, cas, (flank ? 0.06 : 0) + P * 0.002 * (1 + M.morale));
      };
      const engageSector = (sa, sd, label) => {
        const A = La[sa], D = Ld[sd];
        fight('att', Ma, Md, A, D.length ? D : Ld.center, 0);
        fight('def', Md, Ma, D, A.length ? A : La.center, 0);
        if (charge && (A.some((x) => cls(x.r.type) === 'cav') || D.some((x) => cls(x.r.type) === 'cav'))) b.fx.push({ type: 'charge', wing: label, side: A.some((x) => cls(x.r.type) === 'cav') ? 'att' : 'def' });
      };
      // wings and centre engage
      engageSector('left', 'right', 'left');
      engageSector('right', 'left', 'right');
      engageSector('center', 'center', 'center');
      // flanking: a wing with no opposition turns on the enemy centre; wider lines overlap
      const flankBonus = (M) => 0.4 + M.flank;
      for (const [mineL, theirL, side, M, EM] of [[La, Ld, 'att', Ma, Md], [Ld, La, 'def', Md, Ma]]) {
        for (const [w, ow] of [['left', 'right'], ['right', 'left']]) {
          if (mineL[w].length && !theirL[ow].length && theirL.center.length) {
            fight(side, M, EM, mineL[w], theirL.center, flankBonus(M));
            b.fx.push({ type: 'flank', side, wing: w });
          }
        }
        const overlap = mineL.frontCount - theirL.frontCount;
        if (overlap >= 3 && theirL.center.length) {
          fight(side, M, EM, [...mineL.left, ...mineL.right].slice(0, overlap), theirL.center, flankBonus(M) * 0.5);
          if (!b.fx.some((f) => f.type === 'flank' && f.side === side)) b.fx.push({ type: 'envelop', side });
        }
      }
      if (charge) b.phaseRoundCharge = b.round;
    }
    // ── apply damage and morale
    let casA = 0, casD = 0;
    for (const side of ['att', 'def']) {
      const EM = side === 'att' ? Ma : Md;
      for (const [r, c] of dmg[side]) {
        const cas = Math.min(r.men, c);
        r.men -= cas;
        if (side === 'att') casA += cas; else casD += cas;
        const u = UNITS[r.type];
        const mloss = (cas / Math.max(200, r.men + cas)) * 2.6 / u.morale * (1 + EM.moraleTaken) + (mdmg[side].get(r) || 0) / u.morale * (1 + EM.moraleTaken);
        r.morale -= Math.max(0, mloss);
      }
      // seeing comrades run is contagious
      const L = b.lines[side];
      const routedNow = [];
      for (const x of [...L.left, ...L.center, ...L.right, ...L.ranged, ...L.reserve, ...L.siege]) {
        if (x.r.morale <= 0 || x.r.men < 40) { x.r.routed = true; x.r.morale = 0; routedNow.push(x); }
      }
      if (routedNow.length) {
        b.fx.push({ type: 'rout', side, n: routedNow.length });
        for (const x of [...L.center, ...L.left, ...L.right]) if (!x.r.routed) x.r.morale -= 0.025 * routedNow.length;
      }
    }
    b.cas.att += casA; b.cas.def += casD;
    b.hist.push({ r: b.round, a: this.sideMen(b, 'att', true), d: this.sideMen(b, 'def', true), ma: this.sideMorale(b, 'att'), md: this.sideMorale(b, 'def') });
    if (b.hist.length > 60) b.hist.shift();
    // ── resolution
    const broken = (side) => {
      const fm = this.sideMen(b, side, true);
      return fm < 150 || this.sideMorale(b, side) < 0.1 || fm < b.startMen[side] * 0.12;
    };
    const ab = broken('att'), db = broken('def');
    if (ab || db || b.round >= MAX_ROUNDS) {
      let winner = ab && !db ? 'def' : db && !ab ? 'att' : this.sideMorale(b, 'att') > this.sideMorale(b, 'def') + 0.05 && b.round < MAX_ROUNDS ? 'att' : 'def';
      this.endBattle(b, winner);
    }
  },

  endBattle(b, winner) {
    const s = this.s;
    const loser = winner === 'att' ? 'def' : 'att';
    b.over = true; b.winner = winner; b.endDay = s.day; b.phase = 'pursuit';
    this.chooseTactics(b, 'pursuit');
    const Mw = this.sideMods(b, winner), Ml = this.sideMods(b, loser);
    const tc = TERRAIN_COMBAT[b.terrain] || TERRAIN_COMBAT.plains;
    const winArmies = b[winner].map((i) => s.armies[i]).filter(Boolean);
    const loseArmies = b[loser].map((i) => s.armies[i]).filter(Boolean);
    let pursuit = 0;
    for (const a of winArmies) for (const r of a.regs) if (!r.routed) pursuit += (r.men / 1000) * UNITS[r.type].pursuit * (cls(r.type) === 'cav' ? tc.cav : 1) * Math.max(0.3, r.morale);
    pursuit *= 1 + (Mw.pursuit || 0);
    if (b.withdraw === loser) pursuit *= 0.35;
    const loserMen = loseArmies.reduce((t, a) => t + this.armyMen(a), 0);
    const winnerMen = winArmies.reduce((t, a) => t + this.armyMen(a), 0);
    const pursuitCas = Math.min(loserMen * 0.45, 260 * pursuit * (1 + Ml.casualtiesTaken) * (0.7 + this.rng() * 0.6));
    for (const a of loseArmies) {
      const share = this.armyMen(a) / Math.max(1, loserMen);
      for (const r of a.regs) r.men -= Math.min(r.men, pursuitCas * share * r.men / Math.max(1, this.armyMen(a)));
    }
    b.cas[loser] += pursuitCas;
    const prov = this.map.provinces[b.prov].name;
    this.blog(b, `${this.sideName(b, loser)} break and flee! ${Math.round(pursuitCas)} are cut down in the pursuit.`);
    // rewards & bookkeeping
    const nidW = winner === 'att' ? b.attN : b.defN, nidL = loser === 'att' ? b.attN : b.defN;
    const casW = b.cas[winner], casL = b.cas[loser];
    if (nidW >= 0) { const n = s.nations[nidW]; n.prestige += Math.min(15, casL / 1500); n.stats.won++; n.stats.killed += casL; n.stats.lostMen += casW; }
    if (nidL >= 0) { const n = s.nations[nidL]; n.prestige -= Math.min(10, casL / 2500); n.stats.lost++; n.stats.lostMen += casL; n.warExhaustion += casL / 4000; n.stats.killed += casW; }
    if (nidW >= 0) s.nations[nidW].warExhaustion += casW / 6000;
    for (const a of winArmies) {
      for (const r of a.regs) { r.routed = false; r.xp = Math.min(1, (r.xp || 0) + 0.06); r.morale = Math.max(r.morale, 0.25); }
      const g = this.generalOf(a);
      if (g) { g.xp = (g.xp || 0) + 10; if (g.xp >= 30 && g.gen) { g.xp = 0; const k = ['atk', 'def', 'tactics'][Math.floor(this.rng() * 3)]; g.gen[k]++; } }
    }
    // battle score for the war
    const w = nidW >= 0 && nidL >= 0 ? this.warBetween(nidW, nidL) : null;
    if (w) {
      const attacker = w.att.includes(nidW);
      const pts = clamp((casL - casW * 0.5) / 1500, 1, 15) * (attacker ? 1 : -1);
      w.battleScore = clamp((w.battleScore || 0) + pts, -40, 40);
      this.updateWarScore(w);
    }
    // the loser retreats or is annihilated
    for (const a of loseArmies) {
      a.battle = null;
      for (const r of a.regs) { r.routed = false; r.morale = Math.max(0.02, r.morale * 0.5); }
      a.regs = a.regs.filter((r) => r.men >= 40);
      const g = this.generalOf(a);
      if (g && this.rng() < 0.06) { this.blog(b, `${this.charName(g)} is slain on the field!`); this.killChar(g, `was slain at the Battle of ${prov}`); }
      const men = this.armyMen(a);
      if (!a.regs.length || men < 300 || (men < winnerMen * 0.12 && pursuit > 1)) { this.blog(b, `${a.name} is annihilated.`); this.destroyArmy(a, `was destroyed at the Battle of ${prov}`); continue; }
      const dest = this.retreatTarget(a);
      if (dest < 0) { this.blog(b, `${a.name} is trapped and surrenders.`); this.destroyArmy(a, `surrendered at ${prov}`); continue; }
      const path = this.findRetreatPath(a, dest);
      a.path = path || []; a.prog = 0; a.retreating = !!(path && path.length);
    }
    for (const a of winArmies) a.battle = null;
    const pl = s.player;
    const playerSide = b.att.some((i) => s.armies[i]?.nation === pl || false) || (winner === 'att' ? nidW : nidL) === pl ? 'att' : 'def';
    const involved = [b.attN, b.defN].includes(pl);
    if (involved) {
      const won = (winner === 'att' ? b.attN : b.defN) === pl;
      this.log(`${won ? 'Victory' : 'Defeat'} at the Battle of ${prov}! Losses: ours ${Math.round(won ? casW : casL)}, theirs ${Math.round(won ? casL : casW)}.`, { nation: pl, type: won ? 'victory' : 'defeat', prov: b.prov, battle: b.id, important: true });
      this.emit('battleEnd', b.id, won);
    }
    void playerSide;
    this.emit('battleOver', b.id);
  },
  withdrawBattle(bid, side) {
    const b = this.s.battles[bid];
    if (!b || b.over) return;
    b.withdraw = side;
    this.blog(b, `${this.sideName(b, side)} sound the retreat and withdraw in good order.`);
    this.endBattle(b, side === 'att' ? 'def' : 'att');
  },
  retreatTarget(a) {
    // nearest province the army may enter that is controlled by itself or a friend and has no enemies
    const P = this.map.provinces, L = this.L;
    const seen = new Set([a.loc]);
    let frontier = [a.loc];
    for (let depth = 0; depth < 12 && frontier.length; depth++) {
      const next = [];
      for (const c of frontier) for (const e of P[c].adj) {
        const q = e.id;
        if (seen.has(q) || q >= L) continue;
        seen.add(q);
        if (!this.canEnter(a.nation, q, a.rebelOf)) continue;
        const pr = this.s.prov[q];
        const friendly = a.nation >= 0 ? pr.controller === a.nation || this.isAlly(a.nation, pr.controller) : pr.controller === -2 || pr.owner === a.rebelOf;
        const enemies = this.armiesAt(q).some((b) => this.hostileArmies(a, b));
        if (friendly && !enemies && depth >= 0) return q;
        next.push(q);
      }
      frontier = next;
    }
    return -1;
  },
  findRetreatPath(a, dest) {
    const r = a.retreating;
    a.retreating = true;
    const p = this.findPath(a, dest);
    a.retreating = r;
    return p;
  },
};
