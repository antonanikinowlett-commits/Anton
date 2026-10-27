// Progression: innovations (research), realm rank, ambitions, achievements and score.
import { INNOVATIONS, INNOV } from '../data/innovations.js';
import { dateOf } from '../util.js';
import { FORMABLES } from '../data/formables.js';

export const RANKS = ['County', 'Duchy', 'Kingdom', 'Empire'];
export const RANK_ICONS = ['⚜', '🛡', '👑', '🦅'];
// requirements to be crowned into rank r+1 (index r): provinces, prestige, gold
export const RANK_REQ = [{ prov: 40, prestige: 20, gold: 50 }, { prov: 120, prestige: 60, gold: 150 }, { prov: 300, prestige: 150, gold: 400 }];
const RANK_MODS = [{}, { diplo: 1, legitimacyMonthly: 0.003 }, { diplo: 2, legitimacyMonthly: 0.006, taxMult: 0.02 }, { diplo: 3, legitimacyMonthly: 0.01, taxMult: 0.04, prestigeMonthly: 0.003 }];
export const END_YEAR = 1453;
const RESEARCH_CAP = 80;

const totalLevels = (g, nid, key) => { let t = 0; for (const p of g.ownedProvinces(nid)) { const b = g.s.prov[p].buildings; if (key) t += b[key] || 0; else for (const k in b) t += b[k]; } return t; };
const totalDev = (g, nid) => { let t = 0; for (const p of g.ownedProvinces(nid)) t += g.s.prov[p].dev; return t; };

// Ambition definitions: measure(g, n, snap) returns progress toward goal; snap is taken at start.
export const AMBITIONS = {
  win_battles: { name: 'Glory in Arms', icon: '⚔', desc: 'Win 3 battles.', goal: 3, months: 36, prestige: 25, legit: 5, snap: (g, n) => n.stats.won, measure: (g, n, s) => n.stats.won - s },
  cathedral: { name: 'Build a Cathedral', icon: '⛪', desc: 'Raise the realm’s church levels by about 10%.', goal: (g, n) => Math.max(3, Math.round(totalLevels(g, n.id, 'church') * 0.1)), months: 48, prestige: 20, legit: 8, snap: (g, n) => totalLevels(g, n.id, 'church'), measure: (g, n, s) => totalLevels(g, n.id, 'church') - s },
  great_works: { name: 'Great Works', icon: '🏗', desc: 'Complete new building levels worth about 12% of the realm’s total.', goal: (g, n) => Math.max(8, Math.round(totalLevels(g, n.id) * 0.12)), months: 48, prestige: 15, legit: 4, snap: (g, n) => totalLevels(g, n.id), measure: (g, n, s) => totalLevels(g, n.id) - s },
  flourish: { name: 'A Flourishing Realm', icon: '🏘', desc: 'Raise total development by about 6%.', goal: (g, n) => Math.max(12, Math.round(totalDev(g, n.id) * 0.06)), months: 60, prestige: 25, legit: 6, snap: (g, n) => totalDev(g, n.id), measure: (g, n, s) => totalDev(g, n.id) - s },
  conquest: { name: 'Expand the Realm', icon: '🗺', desc: 'Expand the realm by about 5% in provinces.', goal: (g, n) => Math.max(3, Math.round(g.ownedProvinces(n.id).length * 0.05)), months: 48, prestige: 30, legit: 0, snap: (g, n) => g.ownedProvinces(n.id).length, measure: (g, n, s) => g.ownedProvinces(n.id).length - s },
  treasury: { name: 'Fill the Treasury', icon: '💰', desc: 'Fill the treasury with considerably more gold.', goal: (g, n) => Math.max(150, Math.round(g.ownedProvinces(n.id).length * 1.5)), months: 36, prestige: 15, legit: 3, snap: (g, n) => n.gold, measure: (g, n, s) => Math.round(n.gold - s) },
  scholar: { name: 'Patron of Learning', icon: '📚', desc: 'Learn 2 innovations.', goal: 2, months: 48, prestige: 15, legit: 3, snap: (g, n) => n.prog.known.length, measure: (g, n, s) => n.prog.known.length - s },
  grand_match: { name: 'A Great Marriage', icon: '💍', desc: 'Marry into a kingdom-rank house.', goal: 1, months: 60, prestige: 30, legit: 5, snap: (g, n) => n.marriages.length, measure: (g, n, s) => n.marriages.slice(s).some((o) => g.realmRank(o) >= 2) ? 1 : 0 },
};
export const AMBITION_ORDER = Object.keys(AMBITIONS);

export const ACHIEVEMENTS = {
  first_blood: { name: 'First Blood', icon: '⚔', desc: 'Win a battle.', test: (g, n) => n.stats.won >= 1 },
  veteran: { name: 'Veteran Captain', icon: '🎖', desc: 'Win 10 battles.', test: (g, n) => n.stats.won >= 10 },
  scholar: { name: 'Age of Learning', icon: '🎓', desc: 'Learn 15 innovations.', test: (g, n) => n.prog.known.length >= 15 },
  polymath: { name: 'Polymath', icon: '📚', desc: 'Learn an innovation in every branch.', test: (g, n) => new Set(n.prog.known.map((i) => INNOV[i].branch)).size >= 4 },
  duke: { name: 'Ducal Coronet', icon: '🛡', desc: 'Be raised to the rank of Duchy.', test: (g, n) => n.prog.crowned >= 1 },
  king: { name: 'Crowned King', icon: '👑', desc: 'Be raised to the rank of Kingdom.', test: (g, n) => n.prog.crowned >= 2 },
  emperor: { name: 'Imperial Purple', icon: '🦅', desc: 'Be raised to the rank of Empire.', test: (g, n) => n.prog.crowned >= 3 },
  rich: { name: 'Fat Purse', icon: '💰', desc: 'Hold 1000 gold.', test: (g, n) => n.gold >= 1000 },
  builder: { name: 'Master Builder', icon: '🏗', desc: 'Hold building levels worth 4 per province.', test: (g, n) => totalLevels(g, n.id) >= 4 * g.ownedProvinces(n.id).length },
  realm20: { name: 'Broad Dominions', icon: '🗺', desc: 'Rule 300 provinces.', test: (g, n) => g.ownedProvinces(n.id).length >= 300 },
  devoted: { name: 'Fulfilled Ambitions', icon: '🎯', desc: 'Complete 3 ambitions.', test: (g, n) => n.prog.ambDone >= 3 },
  renown: { name: 'Renowned', icon: '✨', desc: 'Reach 200 prestige.', test: (g, n) => n.prestige >= 200 },
  decade: { name: 'Steadfast', icon: '⏳', desc: 'Survive until 1300.', test: (g) => dateOf(g.s.day).y >= 1300 },
};

const defaultProg = () => ({ known: [], cur: null, pts: 0, rank: 0, amb: null, ambDone: 0, ambCool: 0, ach: [], score: [], rp: 0 });

export const ProgressionMixin = {
  initProgression() {
    for (const n of this.s.nations) if (n.alive) this._initProgFor(n);
  },
  _initProgFor(n) {
    if (n.prog) return;
    n.prog = defaultProg();
    const np = this.ownedProvinces(n.id).length;
    let r = 0; while (r < 2 && np >= RANK_REQ[r].prov) r++;
    // historical titles outrank size: kingdoms, caliphates and sultanates start as kingdoms, duchies and the like as duchies
    if (/^(Kingdom|Crown|Caliphate|Abbasid|Almohad|Sultanate|Ayyubid|Papal|Tsardom)/.test(n.name)) r = Math.max(r, 2);
    else if (/^(Duchy|Principality|Grand|Republic|Lombard|Golden|Margraviate|Banate|Novgorod|Galicia|Vladimir)/.test(n.name)) r = Math.max(r, 1);
    if (n.gov === 'imperial' || n.tag === 'HRE' || n.tag === 'BYZ') r = 3;
    n.prog.rank = r;
    this._applyRankMods(n);
  },
  _setSrcMods(n, src, mods) {
    n.mods = n.mods.filter((m) => m.src !== src);
    if (mods && Object.keys(mods).length) n.mods.push({ src, mods });
  },
  _applyRankMods(n) { this._setSrcMods(n, 'rank', RANK_MODS[n.prog.rank]); },

  // ── innovations
  hasInnov(nid, id) { return this.s.nations[nid].prog?.known.includes(id) || false; },
  innovAvailable(nid, id) {
    const n = this.s.nations[nid], i = INNOV[id];
    if (!i || !n.prog || n.prog.known.includes(id)) return false;
    return i.pre.every((p) => n.prog.known.includes(p));
  },
  hasResearchOptions(nid) { return INNOVATIONS.some((i) => this.innovAvailable(nid, i.id)); },
  innovCost(nid, id) {
    const i = INNOV[id], n = this.s.nations[nid];
    let c = 260 * (1 + i.era * 0.7);
    const yr = dateOf(this.s.day).y;
    if (i.year > yr) c *= 1 + Math.min(1.5, (i.year - yr) / 50);
    const nb = this._neighbours ? this._neighbours[nid] : null;
    let known = 0;
    if (nb) for (const o of nb) if (this.s.nations[o].prog?.known.includes(id)) known++;
    c *= 1 - Math.min(0.4, known * 0.1);
    c *= 0.55 + 0.45 * Math.min(1, n.prog.known.length / 6);
    return Math.round(c);
  },
  researchRate(nid) {
    const n = this.s.nations[nid];
    const ch = this.s.chars[n.council.chaplain], ru = this.s.chars[n.ruler];
    let r = 3 + (ch ? ch.skills.learning * 0.25 : 0) + (ru ? ru.skills.learning * 0.12 : 0) + Math.sqrt(totalDev(this, nid)) * 0.3 + totalLevels(this, nid, 'church') * 0.04;
    if (n.focus.done.includes('university')) r += 2;
    return Math.max(0.5, r * (1 + this.mod(nid, 'researchSpeed')));
  },
  startResearch(nid, id) {
    const n = this.s.nations[nid];
    if (!this.innovAvailable(nid, id)) return false;
    n.prog.cur = id;
    return true;
  },
  _learn(n, id) {
    const i = INNOV[id];
    n.prog.known.push(id);
    // income bonuses are halved: dozens of innovations stack additively and would otherwise run the economy away
    const mods = {};
    for (const [k, v] of Object.entries(i.mods)) mods[k] = ['taxMult', 'tradeMult', 'foodMult', 'devGrowth'].includes(k) ? v * 0.5 : v;
    n.mods.push({ src: 'innov:' + id, mods });
    if (i.unlock && !n.unlocks.includes(i.unlock) && (i.unlock !== 'longbowmen' || ['english', 'welsh'].includes(n.culture))) n.unlocks.push(i.unlock);
    this.recalcMods(n.id);
    this.log(`${n.name} masters ${i.name}.`, { nation: n.id });
    if (n.id === this.s.player) this.notify({ nation: n.id, text: `Innovation: ${i.icon} ${i.name}` });
  },
  aiResearch(n) {
    const war = this.atWar(n.id);
    let best = null, bs = -1e9;
    for (const i of INNOVATIONS) {
      if (!this.innovAvailable(n.id, i.id)) continue;
      const s = -this.innovCost(n.id, i.id) + (i.branch === 'military' && war ? 40 : 0) + (i.branch === 'civic' || i.branch === 'agri' ? 15 : 0) + this.rng() * 30;
      if (s > bs) { bs = s; best = i.id; }
    }
    if (best) n.prog.cur = best;
  },
  _scanNeighbours() {
    const s = this.s, nb = {};
    for (const n of s.nations) if (n.alive) nb[n.id] = new Set();
    const P = this.map.provinces;
    for (let p = 0; p < this.L; p++) {
      const a = s.prov[p].owner;
      if (!nb[a]) continue;
      for (const e of P[p].adj) { const b = e.id < this.L ? s.prov[e.id].owner : -1; if (b >= 0 && b !== a && nb[b]) { nb[a].add(b); } }
    }
    this._neighbours = nb;
  },

  // ── rank
  realmRank(nid) { return this.s.nations[nid]?.prog?.rank ?? 0; },
  rankInfo(nid) {
    const n = this.s.nations[nid], r = n.prog.rank;
    if (r >= 3) return { rank: r, name: RANKS[r], maxed: true };
    const q = RANK_REQ[r], np = this.ownedProvinces(nid).length;
    const checks = [['Provinces', np, q.prov], ['Prestige', Math.round(n.prestige), q.prestige], ['Gold', Math.round(n.gold), q.gold]];
    return { rank: r, name: RANKS[r], next: RANKS[r + 1], checks, ok: checks.every((c) => c[1] >= c[2]), cost: q.gold };
  },
  crownRealm(nid) {
    const n = this.s.nations[nid], inf = this.rankInfo(nid);
    if (inf.maxed || !inf.ok) return false;
    n.gold -= inf.cost;
    n.prog.rank++;
    n.prog.crowned = Math.max(n.prog.crowned || 0, n.prog.rank);
    n.prestige += 15; n.legitimacy = Math.min(100, n.legitimacy + 5);
    this._applyRankMods(n);
    this.recalcMods(nid);
    this.log(`${n.name} is raised to a ${RANKS[n.prog.rank]}.`, { nation: nid });
    this.emit('coronation', nid, n.prog.rank);
    return true;
  },

  // ── formable nations
  formableStatus(nid, f, ai = false) {
    const n = this.s.nations[nid], r = f.req;
    const inBox = this.ownedProvinces(nid).filter((p) => { const sp = this.map.provinces[p]; return sp.lon >= r.region[0] && sp.lat >= r.region[1] && sp.lon <= r.region[2] && sp.lat <= r.region[3]; }).length;
    const checks = [['Provinces in the region', inBox, r.min], ['Prestige', Math.round(n.prestige), r.prestige]];
    if (!ai) checks.push(['Gold', Math.round(n.gold), r.gold]); // AI realms rarely hoard gold: they pay what they have
    if (r.religion) checks.push([`Faith: ${r.religion}`, n.religion === r.religion ? 1 : 0, 1]);
    return { ok: checks.every((c) => c[1] >= c[2]), checks };
  },
  availableFormables(nid) {
    const n = this.s.nations[nid], done = n.prog.formed || [];
    return FORMABLES.filter((f) => f.tags.includes(n.tag) && !done.includes(f.id) && !this.s.nations.some((x) => x.prog?.formed?.includes(f.id)));
  },
  formNation(nid, id, ai = false) {
    const n = this.s.nations[nid], f = FORMABLES.find((x) => x.id === id);
    if (!f || !f.tags.includes(n.tag) || this.s.nations.some((x) => x.prog?.formed?.includes(id)) || !this.formableStatus(nid, f, ai).ok) return false;
    n.gold -= ai ? Math.min(Math.max(0, n.gold), f.req.gold) : f.req.gold;
    (n.prog.formed ||= []).push(id);
    if (f.rename) { n.name = f.rename.name; n.adj = f.rename.adj; }
    this.applyEffects(nid, f.effects, 'form:' + id);
    if (n.prog.rank < 2) { n.prog.rank = 2; this._applyRankMods(n); this.recalcMods(nid); }
    this.log(`${n.name} is proclaimed.`, { nation: nid, important: nid === this.s.player });
    if (nid === this.s.player) this.notify({ nation: nid, text: `${f.name} proclaimed!` });
    return true;
  },

  // ── ambitions
  chooseAmbition(nid, id) {
    const n = this.s.nations[nid], a = AMBITIONS[id];
    if (!a || n.prog.amb || n.prog.ambCool > 0) return false;
    n.prog.amb = { id, snap: a.snap(this, n), end: this.s.day + a.months * 30, goal: typeof a.goal === 'function' ? a.goal(this, n) : a.goal };
    return true;
  },
  ambitionProgress(nid) {
    const n = this.s.nations[nid], am = n.prog.amb;
    if (!am) return null;
    const d = AMBITIONS[am.id];
    return { def: d, value: Math.max(0, d.measure(this, n, am.snap)), goal: am.goal ?? d.goal, daysLeft: am.end - this.s.day };
  },
  _monthlyAmbition(n) {
    const p = n.prog;
    if (p.ambCool > 0) p.ambCool--;
    if (!p.amb) {
      if (n.id !== this.s.player && p.ambCool <= 0 && this.rng() < 0.15) this.chooseAmbition(n.id, AMBITION_ORDER[Math.floor(this.rng() * AMBITION_ORDER.length)]);
      return;
    }
    const pr = this.ambitionProgress(n.id), d = pr.def;
    if (pr.value >= pr.goal) {
      n.prestige += d.prestige; n.legitimacy = Math.min(100, n.legitimacy + d.legit);
      p.ambDone++; p.amb = null; p.ambCool = 6;
      this.log(`${n.name} fulfils the ambition "${d.name}".`, { nation: n.id });
      if (n.id === this.s.player) this.notify({ nation: n.id, text: `Ambition fulfilled: ${d.icon} ${d.name}` });
    } else if (pr.daysLeft <= 0) {
      n.prestige -= 10; p.amb = null; p.ambCool = 6;
      if (n.id === this.s.player) this.notify({ nation: n.id, text: `Ambition failed: ${d.icon} ${d.name}` });
    }
  },

  // ── achievements & score
  nationScore(nid) {
    const n = this.s.nations[nid], p = n.prog;
    return Math.round(totalDev(this, nid) + n.prestige + p.known.length * 5 + p.rank * 25 + n.stats.won * 2 + p.ach.length * 10);
  },
  _checkAchievements(n) {
    for (const [id, a] of Object.entries(ACHIEVEMENTS)) {
      if (n.prog.ach.includes(id) || !a.test(this, n)) continue;
      n.prog.ach.push(id);
      if (n.id === this.s.player) this.notify({ nation: n.id, text: `Achievement: ${a.icon} ${a.name}` });
    }
  },

  // ── monthly hook (called once from monthly(), after the per-nation loop)
  monthlyProgression() {
    const s = this.s, dt = dateOf(s.day);
    this._scanNeighbours();
    for (const n of s.nations) {
      if (!n.alive) continue;
      this._initProgFor(n);
      const p = n.prog;
      p.rp = this.researchRate(n.id);
      if (!p.cur && n.id !== s.player) this.aiResearch(n);
      p.pts += p.rp;
      if (p.cur) {
        const c = this.innovCost(n.id, p.cur);
        if (p.pts >= c) { p.pts -= c; const id = p.cur; p.cur = null; this._learn(n, id); }
      } else p.pts = Math.min(p.pts, RESEARCH_CAP);
      // rank: AI crowns when able; everyone loses rank when the realm collapses
      if (n.id !== s.player && p.rank < 3 && this.rankInfo(n.id).ok && n.gold > RANK_REQ[p.rank].gold * 1.5) this.crownRealm(n.id);
      if (p.rank > 0 && this.ownedProvinces(n.id).length < RANK_REQ[p.rank - 1].prov * 0.6 && n.gov !== 'imperial') {
        p.rank--; this._applyRankMods(n); n.prestige -= 10;
        if (n.id === s.player) this.notify({ nation: n.id, text: `Our realm has shrunk: reduced to a ${RANKS[p.rank]}.` });
      }
      this._monthlyAmbition(n);
      if (n.id !== s.player && this.rng() < 0.05) for (const f of this.availableFormables(n.id)) if (this.formableStatus(n.id, f, true).ok) { this.formNation(n.id, f.id, true); break; }
      if (n.id === s.player) this._checkAchievements(n);
      if (dt.m === 0) {
        if (dt.y % 5 === 0) { p.score.push([dt.y, this.nationScore(n.id)]); if (p.score.length > 40) p.score.shift(); }
        if (n.id !== s.player) this._checkAchievements(n);
      }
    }
    if (dt.y >= END_YEAR && !s.ended) {
      s.ended = true;
      const ranking = s.nations.filter((n) => n.alive).map((n) => [n.id, this.nationScore(n.id)]).sort((a, b) => b[1] - a[1]);
      this.log('The year 1453 has come: an age ends.', {});
      this.emit('gameEnd', ranking);
    }
  },
};
