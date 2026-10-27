// Papal authority, excommunication and crusades (spec: docs/specs/crusades.md on branch pm).
// Two holy-war slots share the machinery: s.papacy.crusade (Catholic, called by the Pope) and
// s.papacy.jihad (Sunni, called by the leading Sunni realm). State is plain JSON, back-filled by initPapacy().
import { clamp } from '../util.js';
import { NATIONS } from '../data/nations.js';

const SLOTS = { crusade: { faith: 'catholic', verb: 'Crusade', word: 'crusade' }, jihad: { faith: 'sunni', verb: 'Jihad', word: 'jihad' } };
const CALL_WINDOW = 730;        // days the call stays open for joiners
const FIRST_CALL = 365 * 3;     // earliest random call
const GAP = [365 * 8, 365 * 14]; // random interval between calls

export const PapacyMixin = {
  initPapacy() {
    const s = this.s;
    s.papacy ||= { holder: -1, crusade: null, jihad: null, last: { crusade: 0, jihad: 0 }, fourthDone: false, history: [] };
    const pap = this.nationByTag('PAP');
    s.papacy.holder = pap && pap.alive ? pap.id : -1;
    for (const n of s.nations) if (n.alive && n.papalFavor === undefined) { n.papalFavor = 50; n.excommunicated = false; }
  },
  holyWar(kind) { return this.s.papacy?.[kind] || null; },
  holyWarKind(nid) { for (const k of Object.keys(SLOTS)) if (this.s.nations[nid]?.religion === SLOTS[k].faith) return k; return null; },

  // ── favour & excommunication
  papalFavorChange(nid, v) { const n = this.s.nations[nid]; if (n && n.religion === 'catholic' && n.papalFavor !== undefined) n.papalFavor = clamp(n.papalFavor + v, 0, 100); },
  excommunicate(nid) {
    const s = this.s, n = s.nations[nid];
    if (!n || n.religion !== 'catholic' || n.excommunicated || n.tag === 'PAP') return false;
    n.excommunicated = true; n.excommunicatedDay = s.day;
    this._setSrcMods(n, 'excomm', { legitimacyMonthly: -0.05, stabilityMonthly: -0.01 });
    this.estateDelta(n, 'clergy', -20);
    for (const o of s.nations) if (o.alive && o.id !== nid && o.religion === 'catholic' && o.tag !== 'PAP' && !o.allies.includes(nid)) o.cbs.push({ kind: 'holy_war', tag: n.tag, until: s.day + 1825 });
    this.recalcMods(nid);
    this.log(`${n.name} is excommunicated!`, { nation: nid, important: nid === s.player });
    if (nid === s.player) this.notify({ nation: nid, title: 'Excommunicated', icon: '✝', text: 'The Pope has excommunicated our ruler. Catholic realms may declare holy war on us.' });
    return true;
  },
  liftExcommunication(nid) {
    const n = this.s.nations[nid];
    if (!n?.excommunicated) return 'Not excommunicated';
    const cost = 100;
    if (n.gold < cost) return `Penance costs ${cost} gold`;
    n.gold -= cost; n.excommunicated = false; n.papalFavor = 30;
    this._setSrcMods(n, 'excomm', null);
    this.recalcMods(nid);
    for (const o of this.s.nations) o.cbs = o.cbs.filter((c) => !(c.kind === 'holy_war' && c.tag === n.tag && c.until));
    this.log(`${n.name} does penance and is received back into the Church.`, { nation: nid });
    return null;
  },

  // ── calling
  _distKm(a, b) {
    const ca = this.s.nations[a].capital, cb = this.s.nations[b].capital;
    if (ca < 0 || cb < 0) return 3000;
    const P = this.map.provinces;
    return Math.hypot(P[ca].x - P[cb].x, P[ca].y - P[cb].y) * ((P[ca].kmpx + P[cb].kmpx) / 2);
  },
  crusadeTargets(kind) {
    const s = this.s, faith = SLOTS[kind].faith, out = [];
    for (const t of s.nations) {
      if (!t.alive || t.ai.horde || t.religion === faith || t.tag === 'PAP') continue;
      if (kind === 'crusade' && !['sunni', 'pagan', 'tengri'].includes(t.religion)) continue;
      if (kind === 'jihad' && !['catholic', 'orthodox', 'armenian', 'pagan'].includes(t.religion)) continue;
      // score: border length with the faith's realms, plus a holy-land bonus
      let score = 0;
      for (const p of this.ownedProvinces(t.id)) {
        const sp = this.map.provinces[p];
        if (/Jerusalem/.test(sp.name || '')) score += 6;
        for (const e of sp.adj) { const o = this.owner(e.id); if (o >= 0 && o !== t.id && s.nations[o].religion === faith) score += 1; }
      }
      if (score > 0) out.push([t.id, score]);
    }
    return out.sort((a, b) => b[1] - a[1]);
  },
  callCrusade(targetNid, opts = {}) { return this._callHolyWar('crusade', targetNid, opts); },
  callJihad(targetNid, opts = {}) { return this._callHolyWar('jihad', targetNid, opts); },
  _callHolyWar(kind, targetNid, opts = {}) {
    const s = this.s, P = s.papacy, sl = SLOTS[kind], t = s.nations[targetNid];
    if (P[kind]) return 'A holy war is already called';
    if (!t || !t.alive) return 'No such realm';
    P[kind] = { id: this.newId(), target: targetNid, callDay: s.day, endDay: s.day + CALL_WINDOW, warId: null, members: {}, donations: {}, scripted: opts.scripted || null };
    P.last[kind] = s.day;
    this.log(`A ${sl.word} is proclaimed against ${t.name}!`, { nation: targetNid, important: true });
    const pl = s.nations[s.player];
    if (pl && pl.alive && pl.religion === sl.faith && pl.id !== targetNid && !pl.allies.includes(targetNid)) {
      s.eventQueue.push({ id: kind === 'crusade' ? 'crusade_called' : 'jihad_called', holy: kind });
      this.emit('event');
    }
    this.emit('holywar', kind);
    return null;
  },
  // can this realm take the cross?
  canJoinHolyWar(nid, kind) {
    const n = this.s.nations[nid], c = this.s.papacy[kind];
    if (!c || !n?.alive) return 'No holy war has been called';
    if (n.religion !== SLOTS[kind].faith || n.ai.horde) return 'Wrong faith';
    if (c.members[nid]) return 'Already taken the cross';
    if (nid === c.target || n.allies.includes(c.target)) return 'Allied to the target';
    if (n.overlord >= 0) return 'Vassals follow their lord';
    if (n.overlord === c.target || this.s.nations[c.target].overlord === nid) return 'Cannot attack overlord or vassal';
    if (n.truces[c.target] > this.s.day) return 'Bound by truce';
    return null;
  },
  joinHolyWar(nid, kind = 'crusade') {
    const s = this.s, c = s.papacy[kind], n = s.nations[nid];
    const why = this.canJoinHolyWar(nid, kind);
    if (why) return why;
    c.members[nid] = { won0: n.stats.won, day: s.day, bonus: 0 };
    let w = c.warId ? s.wars[c.warId] : null;
    if (!w) {
      w = this._warWith(nid, c.target);
      if (!w) {
        const r = this.declareWar(nid, c.target, { kind: 'holy_war' }, nid !== s.player);
        if (r) { delete c.members[nid]; return r; }
        w = this.warBetween(nid, c.target);
      }
      if (w) { c.warId = w.id; w.holy = kind; c.provs0 = this.ownedProvinces(c.target).length; c.targetProvs = this.ownedProvinces(c.target).slice(); c.start = s.day; }
    } else if (!w.att.includes(nid) && !w.def.includes(nid)) this.joinWar(w, nid, 'att');
    this.papalFavorChange(nid, 10);
    this.log(`${n.name} takes the cross.`, { nation: nid, important: nid === s.player });
    return null;
  },
  _warWith(nid, target) { return this.warBetween(nid, target); },
  donateHolyWar(nid, gold, kind = 'crusade') {
    const s = this.s, c = s.papacy[kind], n = s.nations[nid];
    if (!c) return 'No holy war has been called';
    if (n.gold < gold || gold <= 0) return 'Not enough gold';
    n.gold -= gold;
    c.donations[nid] = (c.donations[nid] || 0) + gold;
    const to = this.holyWarLeader(kind) ?? s.papacy.holder;
    if (to >= 0) s.nations[to].gold += gold;
    this.papalFavorChange(nid, Math.round(gold / 10));
    n.prestige += gold / 20;
    return null;
  },
  contribution(nid, kind = 'crusade') {
    const s = this.s, c = s.papacy[kind], m = c?.members[nid];
    if (!m) return 0;
    const n = s.nations[nid];
    let occ = 0;
    for (let p = 0; p < this.L; p++) { const pr = s.prov[p]; if (pr.controller === nid && pr.owner === c.target) occ++; }
    return (n.stats.won - m.won0) * 2 + occ * 3 + (c.donations[nid] || 0) / 20;
  },
  holyWarLeader(kind = 'crusade') {
    const c = this.s.papacy[kind];
    if (!c) return null;
    let best = null, bs = -1;
    for (const id of Object.keys(c.members)) { const v = this.contribution(+id, kind); if (v > bs) { bs = v; best = +id; } }
    return best;
  },

  // ── monthly driver (once per month from monthly(), after the per-nation loop)
  monthlyPapacy() {
    const s = this.s;
    this.initPapacy();
    const P = s.papacy;
    for (const n of s.nations) {
      if (!n.alive) continue;
      if (n.papalFavor === undefined) { n.papalFavor = 50; n.excommunicated = false; }
      if (n.religion !== 'catholic' || n.tag === 'PAP') continue;
      let d = 0.2 + (n.estates.clergy ? (n.estates.clergy.loyalty - 50) * 0.004 : 0);
      if (n.excommunicated) d -= 0.3;
      if (n.legitimacy < 30) d -= 0.2;
      n.papalFavor = clamp(n.papalFavor + d, 0, 100);
      if (n.id !== s.player) {
        if (!n.excommunicated && n.papalFavor < 15 && P.holder >= 0 && this.rng() < 0.3) this.excommunicate(n.id);
        else if (n.excommunicated && n.gold > 160 && this.rng() < 0.15) this.liftExcommunication(n.id);
      }
      if (n.excommunicated && s.day - n.excommunicatedDay > 365 * 5 && n.id !== s.player) { n.excommunicated = false; this._setSrcMods(n, 'excomm', null); n.papalFavor = 30; }
    }
    // a scripted possibility: the Fourth Crusade turns on Constantinople
    if (!P.fourthDone && s.day >= 365 * 2 + 170) {
      P.fourthDone = true;
      const byz = this.nationByTag('BYZ'), ven = this.nationByTag('VEN');
      const ayy = this.nationByTag('AYY');
      const tg = ayy?.alive && this.rng() < 0.5 ? ayy : byz;
      if (tg?.alive && ven?.alive && !P.crusade && this.rng() < 0.7) { this.callCrusade(tg.id, { scripted: 'fourth_crusade' }); if (ven.id !== s.player) this.joinHolyWar(ven.id, 'crusade'); }
    }
    for (const kind of Object.keys(SLOTS)) this._monthlyHolyWar(kind);
  },
  _monthlyHolyWar(kind) {
    const s = this.s, P = s.papacy, c = P[kind], sl = SLOTS[kind];
    if (!c) {
      const due = P.last[kind] + GAP[0] + (P.last[kind] % 7) * ((GAP[1] - GAP[0]) / 7);
      if (s.day < FIRST_CALL || s.day < due) return;
      if (kind === 'crusade' && (P.holder < 0 || s.nations[P.holder].tag === 'PAP' && s.player === P.holder)) return;
      const tg = this.crusadeTargets(kind);
      if (!tg.length) { P.last[kind] = s.day - GAP[0] + 365; return; }
      const [tid] = tg[Math.floor(this.rng() * Math.min(3, tg.length))];
      if (this.rng() < 0.5) this._callHolyWar(kind, tid);
      return;
    }
    const t = s.nations[c.target];
    // joining window: AI realms take the cross by zeal and distance
    if (s.day < c.endDay && t.alive) {
      for (const n of s.nations) {
        if (!n.alive || n.id === s.player || n.religion !== sl.faith || c.members[n.id] || this.canJoinHolyWar(n.id, kind)) continue;
        const d = this._distKm(n.id, c.target);
        const reach = d < 1500 ? 1 : d < 3000 ? 0.5 : 0.2;
        const zeal = 0.06 * reach * (1 + (n.estates.clergy ? n.estates.clergy.loyalty / 60 : 0.5)) * (n.ai.aggro + 0.5) * (n.excommunicated ? 0.3 : 1);
        if (this.atWar(n.id) && this.rng() < 0.7) continue;
        if (this.rng() < zeal) this.joinHolyWar(n.id, kind);
      }
    }
    // the war ended (or never began): settle the books
    const w = c.warId ? s.wars[c.warId] : null;
    const over = (c.warId && !w) || (s.day >= c.endDay && !c.warId) || !t.alive;
    if (over) this._finishHolyWar(kind);
    else if (w) {
      for (const id of Object.keys(c.members)) { if (!w.att.includes(+id) && !w.def.includes(+id)) delete c.members[id]; }
      this._holyWarAdvance(kind, c, w);
    }
  },
  // revive a fallen Latin state (Jerusalem, then Antioch) from the provinces the crusaders took, or let them keep the spoils
  _crusaderState(c, memberIds) {
    const s = this.s, taken = c.targetProvs.filter((p) => memberIds.includes(s.prov[p].owner));
    if (taken.length < 3) return;
    const tag = ['JER', 'ANT'].find((x) => { const n = this.nationByTag(x); return n && !n.alive; });
    if (!tag) { this.log('The crusaders divide the conquered lands among themselves.', { important: true }); return; }
    const n = this.nationByTag(tag);
    n.alive = true; n.overlord = -1; n.allies = []; n.marriages = []; n.truces = {}; n.cbs = []; n.mods = n.mods.filter((m) => m.src !== 'excomm');
    n.gold = 100; n.food = 100; n.legitimacy = 65; n.stability = 1; n.prestige = 25; n.warExhaustion = 0; n.excommunicated = false;
    for (const p of taken) this.setOwner(p, n.id);
    n.maxManpower = this.calcMaxManpower(n.id); n.manpower = Math.round(n.maxManpower * 0.6);
    this.initCourt(n, NATIONS[n.id], this.rng);
    n.templates = [];
    this.initTemplates(n);
    this.spawnStartingArmies(n);
    for (const o of s.nations) { if (o.id === n.id) continue; o.opinion[n.id] = this.baseOpinion(o, n); n.opinion[o.id] = this.baseOpinion(n, o); if (o.religion === 'catholic') o.opinion[n.id] += 30; }
    this.recalcMods(n.id);
    this.log(`The crusaders found the ${n.name} in the conquered lands (${taken.length} provinces).`, { nation: n.id, important: true });
  },
  // The crusading host in the field: abstracts landings, sieges and storms by the (often distant) members.
  // Each month the strength of the members against the target decides whether a province of the target falls to the host.
  _holyWarAdvance(kind, c, w) {
    const s = this.s, t = s.nations[c.target];
    const ids = Object.keys(c.members).map(Number).filter((id) => s.nations[id]?.alive);
    if (!ids.length || !t.alive) return;
    const members = ids.reduce((x, id) => x + this.power(id), 0);
    let p = clamp(0.2 * members / Math.max(1, this.power(c.target)), 0.08, 0.6);
    if (c.scripted === 'fourth_crusade' && t.tag === 'BYZ') p *= 0.6; // the walls of Constantinople
    if (this.rng() >= p) return;
    const owned = this.ownedProvinces(c.target).filter((x) => x !== t.capital && s.prov[x].controller === c.target);
    if (!owned.length) return;
    const P = this.map.provinces;
    const held = new Set(ids);
    // prefer provinces beside the host's conquests, then beside a member's land, then any harbour
    const near = (x) => P[x].adj.some((e) => e.id < this.L && (held.has(s.prov[e.id].controller) || held.has(s.prov[e.id].owner)));
    let cands = owned.filter(near);
    if (!cands.length) cands = owned.filter((x) => P[x].coastal);
    if (!cands.length) cands = owned;
    const pick = cands[Math.floor(this.rng() * cands.length)];
    const taker = this.holyWarLeader(kind) ?? ids[0];
    const pr = s.prov[pick];
    pr.controller = taker; pr.siege = null;
    c.members[taker].bonus = (c.members[taker].bonus || 0) + 1;
    w.battleScore = (w.battleScore || 0) + 4;
    this.emit('control', pick);
    if (taker === s.player || c.target === s.player) this.log(`The crusaders take ${this.provName(pick)}.`, { nation: taker, type: 'war', prov: pick });
  },
  _finishHolyWar(kind) {
    const s = this.s, P = s.papacy, c = P[kind], sl = SLOTS[kind];
    const t = s.nations[c.target];
    const ids = Object.keys(c.members).map(Number);
    const fought = c.provs0 !== undefined;
    const lost = fought ? Math.max(0, c.provs0 - (t.alive ? this.ownedProvinces(c.target).length : 0)) : 0;
    const won = fought && (lost > 0 || !t.alive);
    const outcome = !fought ? 'no war' : won ? 'victory' : 'failure';
    for (const id of ids) {
      const n = s.nations[id], v = this.contribution(id, kind);
      if (won) {
        n.prestige += Math.min(40, 8 + v); n.legitimacy = Math.min(100, n.legitimacy + 3);
        this.papalFavorChange(id, Math.min(20, 5 + v));
      } else if (fought) {
        // a crusade that gained nothing is a clear failure: lost prestige and piety
        n.prestige -= 10; this.papalFavorChange(id, -10);
        if (id === s.player) this.notify({ nation: id, title: 'Crusade failed', icon: '✠', text: `The ${sl.word} against ${t.name} has failed. Prestige −10.` });
      }
    }
    // a victorious crusade against Muslim lands may found a crusader state out of the conquered provinces
    if (won && kind === 'crusade' && t.religion === 'sunni' && c.targetProvs) this._crusaderState(c, ids);
    // the victorious leader is crowned in the conquered land
    const lead = won ? this.holyWarLeader(kind) : null;
    if (lead !== null && lost >= 3) { const L = s.nations[lead]; L.prestige += 20; L.legitimacy = Math.min(100, L.legitimacy + 5); }
    P.history.push({ kind, target: t.tag, call: c.callDay, end: s.day, members: ids.map((i) => s.nations[i].tag), scripted: c.scripted, outcome, lost });
    if (P.history.length > 20) P.history.shift();
    this.log(`The ${sl.word} against ${t.name} ends in ${outcome}${lost ? ` (${lost} provinces taken)` : ''}.`, { nation: c.target, important: ids.includes(s.player) });
    P[kind] = null;
    P.last[kind] = s.day;
  },
};
