// War v2: war goals, a score the player can read, milestone reports, army/front orders, and the "what now?" advice.
//   w.goals   { att:[prov ids], def:[] }  provinces the war was declared to take (cheaper at the peace table)
//   w.mile    flags of milestones already reported
//   w.notes   [{ day, text, tone }]       newest first, shown in the wars panel
//   w.cas     { att, def }                men lost on each side
//   army.orders / front.orders  { retreat, engage }
import { clamp } from '../util.js';
import { UNITS } from '../data/units.js';

export const ORDER_DEFAULT = { retreat: 0.3, engage: 'normal' };
export const ENGAGE = {
  normal: { name: 'Standard', desc: 'Fights what comes, marches only on orders.' },
  cautious: { name: 'Cautious', desc: 'Falls back before a stack at least 25% stronger can attack it. Preserves the army, gives up ground.' },
  aggressive: { name: 'Aggressive', desc: 'Attacks any adjacent enemy stack it clearly outguns (needs 60% men and morale).' },
};
export const MILESTONES = [
  { at: 25, id: 'm25', name: 'Momentum', text: 'The war is turning our way.' },
  { at: 50, id: 'm50', name: 'Upper hand', text: 'The enemy court is in despair: peace on good terms is possible.' },
  { at: 75, id: 'm75', name: 'Decisive victory', text: 'Resistance has collapsed. They will accept almost any terms.' },
];
const WIN_LABEL = { att: 'attackers', def: 'defenders' };

export const WarPlanMixin = {
  // ── war goals
  pickWarGoals(w) {
    const s = this.s, a = s.nations[w.attLeader], d = s.nations[w.defLeader];
    const goals = { att: [], def: [] };
    const mine = new Set(this.ownedProvinces(a.id));
    const theirs = this.ownedProvinces(d.id).filter((p) => !(w.att.includes(s.prov[p].owner)));
    const adjacent = (p) => this.map.provinces[p].adj.some((e) => e.id < this.L && mine.has(e.id));
    let cands = [];
    if (w.cb === 'claim') cands = theirs.filter((p) => s.prov[p].claims.includes(a.id));
    else if (w.cb === 'holy_war' || w.cb === 'subjugation' || w.cb === 'reconquista') cands = theirs.filter((p) => s.prov[p].religion !== a.religion && adjacent(p));
    else if (w.cb === 'coalition' || w.cb === 'insult') cands = theirs.filter(adjacent).slice(0, 3);
    if (cands.length < 3) for (const p of theirs.filter(adjacent)) if (!cands.includes(p)) cands.push(p);
    cands.sort((x, y) => s.prov[y].dev - s.prov[x].dev);
    goals.att = cands.slice(0, 7);
    w.goals = goals;
    w.mile = {}; w.notes = []; w.cas = { att: 0, def: 0 };
  },
  setWarGoals(wid, nid, list) {
    const w = this.s.wars[wid];
    if (!w || w.attLeader !== nid) return 'Only the leader of the attackers sets war goals';
    const s = this.s;
    w.goals.att = list.filter((p) => w.def.includes(s.prov[p]?.owner)).slice(0, 12);
    this.emit('war', wid);
    return null;
  },
  isWarGoal(w, side, p) { return !!w.goals && w.goals[side].includes(p); },
  goalState(w, p) {
    const pr = this.s.prov[p];
    if (w.att.includes(pr.owner)) return 'taken'; // already ceded
    if (w.att.includes(pr.controller)) return 'occupied';
    if (pr.siege && w.att.includes(pr.siege.by)) return 'besieged';
    return 'enemy';
  },

  // ── score
  // Positive = attackers ahead. Every number is a visible part so the UI can show *why* the score is what it is.
  warScoreParts(w) {
    const s = this.s;
    const share = (landOf, byWho) => {
      let tot = 0, got = 0;
      for (const n of landOf) for (const p of this.ownedProvinces(n)) {
        const x = s.prov[p].dev * (s.nations[n].capital === p ? 2 : 1);
        tot += x;
        if (byWho.includes(s.prov[p].controller)) got += x;
      }
      return tot ? got / tot : 0;
    };
    const side = (me, foe, leaderFoe, key) => {
      const leader = share([leaderFoe], me) * 100;
      const others = foe.filter((x) => x !== leaderFoe);
      const rest = others.length ? share(others, me) * 100 : leader;
      const goals = (w.goals?.[key] || []);
      const gTaken = goals.filter((p) => ['taken', 'occupied'].includes(this.goalState(w, p)) === (key === 'att')).length;
      const cap = s.nations[leaderFoe].capital;
      const capHeld = cap >= 0 && s.prov[cap].owner === leaderFoe && me.includes(s.prov[cap].controller);
      return [
        { label: `Occupation of ${s.nations[leaderFoe].name}`, value: leader * 0.6 },
        ...(others.length ? [{ label: 'Occupation of their allies', value: rest * 0.15 }] : []),
        { label: 'War goals taken', value: goals.length ? 15 * (key === 'att' ? gTaken : 0) / goals.length : 0 },
        { label: 'Enemy capital held', value: capHeld ? 8 : 0 },
      ];
    };
    const A = side(w.att, w.def, w.defLeader, 'att'), D = side(w.def, w.att, w.attLeader, 'def');
    const bs = w.battleScore || 0;
    const parts = {
      att: [...A, { label: 'Battles won', value: Math.max(0, bs) }],
      def: [...D, { label: 'Battles won', value: Math.max(0, -bs) }],
    };
    const sum = (l) => l.reduce((t, x) => t + x.value, 0);
    const exh = ((s.nations[w.defLeader]?.warExhaustion || 0) - (s.nations[w.attLeader]?.warExhaustion || 0)) * 0.8;
    return { parts, att: sum(parts.att), def: sum(parts.def), exhaustion: clamp(exh, -12, 12), score: clamp(Math.round(sum(parts.att) - sum(parts.def) + clamp(exh, -12, 12)), -100, 100) };
  },
  updateWarScore(w) {
    const P = this.warScoreParts(w);
    const old = w.score ?? 0;
    w.score = P.score;
    w.attOcc = P.parts.att[0].value / 0.6; w.defOcc = P.parts.def[0].value / 0.6; // kept for older UI code
    this.checkWarMilestones(w, old);
  },
  warNote(w, text, tone = 'info', notify = false) {
    const s = this.s;
    (w.notes ||= []).unshift({ day: s.day, text, tone });
    if (w.notes.length > 40) w.notes.length = 40;
    if (notify && [...w.att, ...w.def].includes(s.player)) this.notify({ title: 'War report', icon: tone === 'bad' ? '🏴' : tone === 'good' ? '🏆' : '📜', text, war: w.id });
  },
  checkWarMilestones(w, oldScore) {
    const s = this.s;
    if (!w.mile) { w.mile = {}; w.notes ||= []; w.cas ||= { att: 0, def: 0 }; }
    const pl = s.player, inWar = [...w.att, ...w.def].includes(pl), mySide = w.att.includes(pl) ? 'att' : 'def';
    for (const key of ['att', 'def']) {
      const sc = key === 'att' ? w.score : -w.score;
      for (const m of MILESTONES) {
        const id = key + m.id;
        if (sc >= m.at && !w.mile[id]) {
          w.mile[id] = 1;
          const who = key === mySide || !inWar ? s.nations[key === 'att' ? w.attLeader : w.defLeader].name : null;
          const text = inWar ? (key === mySide ? `${m.name}: ${m.text}` : `The enemy gains the upper hand (${m.name.toLowerCase()}). ${key === 'att' ? 'Our lands are falling.' : 'Our offensive is failing.'}`) : '';
          if (inWar) this.warNote(w, text, key === mySide ? 'good' : 'bad', true);
          else if (m.at >= 50) this.pushNews(`The ${w.name}: ${s.nations[key === 'att' ? w.attLeader : w.defLeader].name} gains the upper hand.`, { type: 'war' });
        }
      }
    }
    // goals and the capital
    for (const p of w.goals?.att || []) {
      const id = 'g' + p;
      if (!w.mile[id] && ['occupied', 'taken'].includes(this.goalState(w, p))) {
        w.mile[id] = 1;
        const n = w.goals.att.filter((q) => ['occupied', 'taken'].includes(this.goalState(w, q))).length;
        if (inWar) this.warNote(w, `War goal ${mySide === 'att' ? 'taken' : 'lost'}: ${this.provName(p)} (${n} of ${w.goals.att.length})`, mySide === 'att' ? 'good' : 'bad', n === w.goals.att.length);
        if (n === w.goals.att.length && w.goals.att.length > 1) this.warNote(w, mySide === 'att' ? 'Every war goal is in our hands: we can demand them at the peace table.' : 'The enemy holds every province they came for.', mySide === 'att' ? 'good' : 'bad');
      }
    }
    for (const key of ['att', 'def']) {
      const foeLeader = key === 'att' ? w.defLeader : w.attLeader, cap = s.nations[foeLeader].capital;
      const id = 'cap' + key;
      const held = cap >= 0 && s.prov[cap].owner === foeLeader && (key === 'att' ? w.att : w.def).includes(s.prov[cap].controller);
      if (held && !w.mile[id]) {
        w.mile[id] = 1;
        if (inWar) this.warNote(w, key === mySide ? `Their capital ${this.provName(cap)} has fallen!` : `Our capital ${this.provName(cap)} has fallen!`, key === mySide ? 'good' : 'bad', true);
        else this.pushNews(`${s.nations[foeLeader].name}'s capital ${this.provName(cap)} falls to the ${WIN_LABEL[key]} in the ${w.name}.`, { type: 'war' });
      }
    }
  },

  // ── dashboard data for the wars panel
  warStatus(wid, nid) {
    const s = this.s, w = s.wars[wid];
    if (!w) return null;
    const side = w.att.includes(nid) ? 'att' : w.def.includes(nid) ? 'def' : null;
    const mine = side === 'att' ? w.att : w.def, theirs = side === 'att' ? w.def : w.att;
    const P = this.warScoreParts(w);
    const sg = side === 'def' ? -1 : 1;
    const score = (side ? sg : 1) * w.score;
    const strength = (ids) => ids.reduce((t, n) => t + this.armyStrength(n), 0);
    const us = strength(mine), them = strength(theirs);
    const men = (ids) => ids.reduce((t, n) => t + this.armiesOf(n).reduce((x, a) => x + this.armyMen(a), 0), 0);
    const leaderFoe = side === 'att' ? w.defLeader : w.attLeader;
    const wp = side ? this.peaceAcceptance(w, side, []) : null;
    const goals = (w.goals?.att || []).map((p) => ({ p, name: this.provName(p), dev: s.prov[p].dev, state: this.goalState(w, p) }));
    const lost = [], held = [];
    for (const n of mine) for (const p of this.ownedProvinces(n)) if (!mine.includes(s.prov[p].controller)) lost.push(p);
    for (const n of theirs) for (const p of this.ownedProvinces(n)) if (mine.includes(s.prov[p].controller)) held.push(p);
    const rows = (l) => l.map((x) => ({ label: x.label, value: Math.round(x.value * 10) / 10 }));
    const out = {
      id: wid, name: w.name, cb: w.cb, side, months: Math.round((s.day - w.start) / 30), score,
      scoreParts: side === 'def' ? { mine: rows(P.parts.def), theirs: rows(P.parts.att) } : { mine: rows(P.parts.att), theirs: rows(P.parts.def) },
      exhaustionEffect: Math.round(P.exhaustion * (side === 'def' ? -1 : 1) * 10) / 10,
      milestones: MILESTONES.map((m) => ({ at: m.at, name: m.name, reached: score >= m.at })),
      goals: side === 'att' ? goals : [], goalsTaken: goals.filter((g) => ['occupied', 'taken'].includes(g.state)).length,
      strength: { us: Math.round(us * 10) / 10, them: Math.round(them * 10) / 10, ratio: them ? Math.round(us / them * 100) / 100 : 99, usMen: Math.round(men(mine)), themMen: Math.round(men(theirs)) },
      casualties: { ours: Math.round(w.cas?.[side] || 0), theirs: Math.round(w.cas?.[side === 'att' ? 'def' : 'att'] || 0) },
      occupied: { byUs: held.map((p) => ({ p, name: this.provName(p) })), byThem: lost.map((p) => ({ p, name: this.provName(p) })) },
      peace: wp ? { whiteWill: wp.will, willing: wp.will >= 0, label: wp.will >= 10 ? 'They would accept a white peace' : wp.will >= 0 ? 'They hesitate' : 'They refuse for now' } : null,
      notes: (w.notes || []).slice(0, 12), leaderFoe,
    };
    out.advice = side ? this.warAdvice(w, nid, out) : [];
    return out;
  },
  warAdvice(w, nid, st) {
    const s = this.s, out = [];
    const side = st.side, foes = (side === 'att' ? w.def : w.att);
    const armies = this.armiesOf(nid).filter((a) => !this.isFleet(a));
    const idle = armies.filter((a) => !a.path.length && !a.battle && !this.frontOfArmy(a.id) && !(a.loc < this.L && this.hostileToProvince(a, a.loc)));
    if (!armies.length) out.push({ tone: 'bad', text: 'We have no army in the field: raise regiments in the Military panel.' });
    else if (idle.length) out.push({ tone: 'warn', text: `${idle.length} ${idle.length > 1 ? 'armies are' : 'army is'} idle. Put them on a front (advance) or order them against a target.` });
    const noFront = !this.frontsOf(nid).some((f) => foes.includes(f.enemy));
    if (armies.length && noFront && foes.some((f) => this.neighbours(nid).includes(f))) out.push({ tone: 'warn', text: 'No front is set against the enemy: use "Cover front" on an army to split it along the border.' });
    if (st.strength.ratio < 0.7) out.push({ tone: 'bad', text: `Their armies are stronger (${Math.round(st.strength.ratio * 100)}% of theirs): defend, avoid open battle, or call allies.` });
    else if (st.strength.ratio > 1.5) out.push({ tone: 'good', text: 'We outnumber them: press the attack and besiege their forts.' });
    const sieges = s.prov.map((pr, p) => (pr.siege && (side === 'att' ? w.att : w.def).includes(pr.siege.by) ? p : -1)).filter((p) => p >= 0);
    for (const p of sieges.slice(0, 3)) { const sg = s.prov[p].siege; out.push({ tone: 'info', text: `Siege of ${this.provName(p)}: ${Math.round(sg.prog)}%${sg.rate ? `, about ${Math.max(1, Math.ceil((100 - sg.prog) / sg.rate))} days left` : ' (not enough men to make progress)'}.` }); }
    const next = st.goals.find((g) => g.state === 'enemy' || g.state === 'besieged');
    if (next) out.push({ tone: 'info', text: `Next war goal: ${next.name} (${next.state === 'besieged' ? 'under siege' : 'not yet reached'}).` });
    if (st.peace && st.score >= 25 && st.peace.willing) out.push({ tone: 'good', text: 'The enemy would talk now: open the peace table and take what we came for.' });
    else if (st.score >= 50) out.push({ tone: 'good', text: 'Our war score is high: demands will be accepted if they cost less than the score.' });
    const n = s.nations[nid];
    if (n.warExhaustion > 5) out.push({ tone: 'bad', text: `War exhaustion ${n.warExhaustion.toFixed(1)}: unrest rising and manpower shrinking. Consider peace.` });
    if (n.manpower < n.maxManpower * 0.15) out.push({ tone: 'bad', text: 'Our manpower is nearly spent: new regiments will be small.' });
    if (n.gold < 0) out.push({ tone: 'bad', text: 'The treasury is empty: mercenaries will desert and stability falls.' });
    return out.slice(0, 7);
  },

  // ── orders
  armyOrders(a) { const f = this.frontOfArmy?.(a.id); return { ...ORDER_DEFAULT, ...(f?.orders || {}), ...(a.orders || {}) }; },
  setArmyOrders(aid, o) {
    const a = this.s.armies[aid];
    if (!a) return 'No army';
    a.orders = { ...(a.orders || {}), ...this.cleanOrders(o) };
    this.emit('army', aid);
    return null;
  },
  setFrontOrders(fid, o) {
    const f = this.s.fronts?.[fid];
    if (!f) return 'No such front';
    f.orders = { ...(f.orders || {}), ...this.cleanOrders(o) };
    for (const id of f.armies) { const a = this.s.armies[id]; if (a) delete a.orders; }
    this.emit('fronts');
    return null;
  },
  cleanOrders(o) {
    const out = {};
    if (o.retreat !== undefined) out.retreat = clamp(+o.retreat || 0, 0, 0.8);
    if (o.engage !== undefined && ENGAGE[o.engage]) out.engage = o.engage;
    return out;
  },
  // Called at the start of every battle round: armies whose morale has fallen below their retreat line leave in good order.
  checkRetreatOrders(b) {
    if (b.round < 3) return;
    for (const side of ['att', 'def']) {
      const lead = this.s.armies[b[side][0]];
      if (!lead || lead.nation < 0) continue;
      const th = Math.max(...b[side].map((i) => { const a = this.s.armies[i]; return a ? this.armyOrders(a).retreat : 0; }));
      if (th <= 0) continue;
      const m = this.sideMorale(b, side), enemyM = this.sideMorale(b, side === 'att' ? 'def' : 'att');
      if (m < th && m < enemyM) { this.warNoteBattle(b, side); this.withdrawBattle(b.id, side); return true; }
    }
    return false;
  },
  warNoteBattle(b, side) {
    const nid = side === 'att' ? b.attN : b.defN;
    if (nid === this.s.player) this.notify({ title: 'Orders obeyed', icon: '🏳', text: `Our army at ${this.provName(b.prov)} fell back at its retreat line to save the men.`, battle: b.id, prov: b.prov });
  },
  // Engage policy of idle armies: cautious ones step back from stronger stacks, aggressive ones strike weaker ones.
  dailyOrders() {
    const s = this.s;
    if ((s.day & 1) || !s.nations[s.player]) return; // the AI manages its own armies; player orders every other day
    const P = this.map.provinces;
    for (const a of this.armiesOf(s.player)) {
      if (a.battle || a.retreating || a.atSea || this.isFleet(a) || a.loc >= this.L) continue;
      const o = this.armyOrders(a);
      if (o.engage === 'normal') continue;
      const myPow = this.armiesAt(a.loc).filter((b) => b.nation === a.nation && !b.battle).reduce((t, b) => t + this.armyPower(b), 0);
      const men = this.armyMen(a) / Math.max(1, this.armyMax(a));
      let worst = 0, weakest = null, wp = 1e9;
      for (const e of P[a.loc].adj) {
        if (e.id >= this.L) continue;
        for (const b of this.armiesAt(e.id)) {
          if (!this.hostileArmies(a, b) || b.battle || b.atSea) continue;
          const pw = this.armiesAt(e.id).filter((x) => !this.hostileArmies(b, x)).reduce((t, x) => t + this.armyPower(x), 0);
          worst = Math.max(worst, pw);
          if (pw < wp && this.canEnter(a.nation, e.id)) { wp = pw; weakest = e.id; }
        }
      }
      if (o.engage === 'cautious' && worst > myPow * 1.25 && !(a.path.length && a.retreatWarned === s.day)) {
        const t = this.retreatTarget(a);
        if (t >= 0 && t !== a.loc) { this.orderMove(a.id, t); a.retreatWarned = s.day; this.notify({ title: 'Cautious orders', icon: '🏳', text: `${a.name} falls back from ${this.provName(a.loc)}: a stronger enemy is near.`, army: a.id }); }
      } else if (o.engage === 'aggressive' && weakest !== null && wp < myPow * 0.8 && men >= 0.6 && this.armyMorale(a) >= 0.6 && !a.path.length) {
        this.orderMove(a.id, weakest);
      }
    }
  },
  armyVeterancy(a) {
    let x = 0, w = 0;
    for (const r of a.regs) { x += (r.xp || 0) * r.men; w += r.men; }
    const xp = w ? x / w : 0;
    return { xp: Math.round(xp * 100) / 100, label: xp < 0.15 ? 'Green' : xp < 0.4 ? 'Seasoned' : xp < 0.7 ? 'Veteran' : 'Elite', bonus: Math.round(xp * 35) };
  },
};
