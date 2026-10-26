// Characters: rulers, heirs, ministers, generals and courtiers; ageing, death and succession.
import { NATIONS } from '../data/nations.js';
import { GOVS, LAWS, COUNCIL_ROLES, ROLE_INFO } from '../data/government.js';
import { TRAITS, GEN_TRAIT_POOL, PERS_TRAIT_POOL } from '../data/traits.js';
import { groupOf, personName } from '../data/names.js';
import { BUILDINGS } from '../data/buildings.js';
import { clamp, dateOf, pick } from '../util.js';

export const CharactersMixin = {
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
  },
  makeChar(n, role, opts = {}) {
    const rng = this.rng;
    const [first, dyn] = opts.name || personName(rng, n.culture);
    const c = { id: this.newId(), first, dyn, nation: n.id, role, female: !!opts.female, birth: this.s.day - (opts.age ?? (25 + Math.floor(rng() * 30))) * 365,
      skills: { martial: 0, diplomacy: 0, stewardship: 0, intrigue: 0, learning: 0 }, traits: [], gen: null, army: null, seed: Math.floor(rng() * 1e9), xp: 0,
      father: opts.father ?? null, mother: opts.mother ?? null, spouse: null, dynastic: !!opts.dynastic, loyalty: 60 + Math.round(rng() * 30), ambition: Math.round(rng() * 100) };
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
  },
  makeGeneral(c, traits) {
    const rng = this.rng;
    const sk = c.skills.martial;
    c.gen = { atk: Math.round(sk / 4 + rng() * 2), def: Math.round(sk / 4 + rng() * 2), tactics: Math.round(sk / 3 + rng() * 2), siege: Math.round(rng() * 3), logistics: Math.round(rng() * 3) };
    if (!traits || !traits.some((t) => TRAITS[t].mil)) {
      const t = pick(rng, GEN_TRAIT_POOL);
      if (!c.traits.includes(t)) c.traits.push(t);
    }
  },
  age(c) { return Math.floor((this.s.day - c.birth) / 365); },
  charName(c) { return c ? `${c.first} ${c.dyn}` : '—'; },
  hasTrait(c, t) { return !!c && c.traits.includes(t); },
  initCourt(n, def, rng) {
    const [rf, rd, ra, rt, sex] = def.ruler;
    const r = this.makeChar(n, 'ruler', { name: [rf, rd], age: ra, traits: rt, female: sex === 'f' });
    r.skills.martial += 3; r.skills.diplomacy += 2; r.skills.stewardship += 2;
    if (rt.some((t) => TRAITS[t].mil)) this.makeGeneral(r, rt);
    n.ruler = r.id; r.dynastic = true;
    if (!['merchant_republic', 'theocracy'].includes(n.gov) && ra >= 18 && !rt.includes('celibate')) {
      const sp = this.makeChar(n, 'family', { name: [personName(rng, n.culture)[0], rd], age: Math.max(16, ra - 3 + Math.floor(rng() * 7)), female: sex !== 'f' });
      sp.dyn = personName(rng, n.culture)[1]; sp.spouse = r.id; r.spouse = sp.id;
    }
    if (!['merchant_republic', 'theocracy', 'elective_monarchy'].includes(n.gov) && ra > 18) {
      const h = this.makeChar(n, 'heir', { name: [personName(rng, n.culture)[0], rd], age: Math.max(1, ra - 22 - Math.floor(rng() * 8)), father: r.id, dynastic: true, female: rng() < 0.2 });
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
  },
  charsOf(nid, role) { return Object.values(this.s.chars).filter((c) => c.nation === nid && (!role || c.role === role)); },
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
    // births, regency, claimants
    this.monthlyDynasty(n, ruler);
    // refresh candidate pool
    const pool = this.charsOf(n.id, 'pool');
    if (pool.length < 4 && this.rng() < 0.2) this.makeChar(n, 'pool', { focusSkill: pick(this.rng, ['diplomacy', 'martial', 'stewardship', 'intrigue', 'learning']) });
    if (pool.length > 8) this.killChar(pool[0], 'left court');
  },
  killChar(c, why) {
    const s = this.s, n = s.nations[c.nation];
    delete s.chars[c.id];
    if (c.dynastic || c.role === 'family' || c.role === 'heir' || c.role === 'claimant') {
      (s.dead ||= []).push({ id: c.id, first: c.first, dyn: c.dyn, nation: c.nation, birth: c.birth, death: s.day, father: c.father, mother: c.mother, female: c.female, ruler: c.role === 'ruler' });
      if (s.dead.length > 400) s.dead.shift();
    }
    if (c.spouse && s.chars[c.spouse]) s.chars[c.spouse].spouse = null;
    if (n && n.pretender && n.pretender.char === c.id) n.pretender = null;
    if (c.army) { const a = s.armies[c.army]; if (a) a.general = null; }
    if (!n) return;
    if (c.office && n.council[c.office] === c.id) n.council[c.office] = null;
    if (n.heir === c.id) n.heir = null;
    if (n.id === s.player && ['ruler', 'heir', 'general', 'minister'].includes(c.role)) {
      this.log(`${this.charName(c)} ${why}.`, { nation: n.id, type: 'court' });
    }
    this.recalcMods(n.id);
  },
  succession(n) {
    const s = this.s;
    const old = s.chars[n.ruler];
    if (old) old.dynastic = true;
    if (!s.chars[n.heir] && !['elective_monarchy', 'merchant_republic', 'theocracy'].includes(n.gov)) { const h = this.pickHeir(n, old); if (h) n.heir = h.id; }
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
    heir.role = 'ruler'; heir.office = null; heir.dynastic = true;
    n.ruler = heir.id; n.heir = null;
    if (this.age(heir) < 16) n.regent = { until: heir.birth + 16 * 365 }; else n.regent = null;
    if (n.pretender) { const pc = s.chars[n.pretender.char]; if (pc) this.exile(pc); n.pretender = null; }
    // heirs of the dead ruler's line: spouse becomes courtier, other adult dynasts may press claims
    for (const c of this.charsOf(n.id, 'family')) if (c.dynastic && this.age(c) >= 16 && c.id !== heir.id && c.spouse !== heir.id && this.rng() < 0.5) c.role = 'claimant';
    if (n.laws.succession === 'gavelkind') { n.stability -= 0.5; this.estateDelta(n, 'nobles', 10); }
    if (crisis) { n.legitimacy = Math.max(0, n.legitimacy - 25); n.stability = Math.max(-3, n.stability - 1); }
    else n.legitimacy = clamp(n.legitimacy - 10 + (n.laws.succession === 'primogeniture' ? 10 : 0), 0, 100);
    if (n.laws.succession === 'tanistry') heir.skills.martial += 2;
    if (old) old.role = 'dead';
    if (old && old.spouse && s.chars[old.spouse]) s.chars[old.spouse].role = 'family';
    this.recalcMods(n.id);
    const t = this.rulerTitle(n);
    this.log(`${t} ${this.charName(heir)} now rules the ${n.name}${crisis ? ' — a child ruler! A regency council governs.' : '.'}`, { nation: n.id, type: 'court', important: n.id === s.player });
    if (n.id === s.player) this.notify({ title: 'Succession', icon: '👑', text: `${t} ${this.charName(heir)} has succeeded to the throne.` });
  },
  backfillPolitics() {
    const s = this.s;
    s.dead ||= []; s.polEvents ||= {}; s.papacy ||= { authority: 60, excommunicated: [] };
    for (const c of Object.values(s.chars)) {
      if (c.father === undefined) { c.father = null; c.mother = null; c.spouse = null; c.dynastic = c.role === 'ruler' || c.role === 'heir'; c.loyalty = 70; c.ambition = 50; }
    }
    for (const n of s.nations) { if (n.regent === undefined) n.regent = null; if (n.pretender === undefined) n.pretender = null; if (!n.privileges) n.privileges = {}; if (!n.lawCd) n.lawCd = {}; }
  },
  // ── dynasty
  dynasts(n) { return Object.values(this.s.chars).filter((c) => c.nation === n.id && c.dynastic && c.role !== 'dead'); },
  // heir by succession law: primogeniture = eldest son, then daughter; seniority = eldest adult male dynast;
  // tanistry = most capable adult dynast; gavelkind/others = eldest child
  pickHeir(n, ruler) {
    const law = n.laws.succession;
    const kin = Object.values(this.s.chars).filter((c) => c.nation === n.id && c.dynastic && c.id !== n.ruler && c.role !== 'ruler' && c.role !== 'dead' && c.id !== ruler?.spouse && c.role !== 'claimant');
    const kids = kin.filter((c) => ruler && c.father === ruler.id || ruler && c.mother === ruler.id);
    const byAge = (a, b) => a.birth - b.birth;
    const adult = (c) => this.age(c) >= 16;
    if (law === 'seniority') { const m = kin.filter((c) => !c.female && adult(c)).sort(byAge); if (m.length) return m[0]; }
    if (law === 'tanistry') { const m = kin.filter(adult).sort((a, b) => this.charScore(b) - this.charScore(a)); if (m.length) return m[0]; }
    const sons = kids.filter((c) => !c.female).sort(byAge);
    const daus = kids.filter((c) => c.female).sort(byAge);
    if (sons.length) return sons[0];
    if (daus.length && law !== 'agnatic') return daus[0];
    return kin.sort(byAge)[0] || null;
  },
  charScore(c) { return c.skills.diplomacy + c.skills.martial + c.skills.stewardship + c.skills.intrigue; },
  exile(c) { if (c) this.killChar(c, 'went into exile'); },
  monthlyDynasty(n, ruler) {
    const s = this.s, rng = this.rng;
    const nonDyn = ['merchant_republic', 'theocracy'].includes(n.gov);
    if (!ruler || nonDyn) return;
    const age = this.age(ruler);
    // marriage of a widowed or unmarried ruler
    if (!ruler.spouse && age >= 18 && age < 50 && !ruler.traits.includes('celibate') && rng() < 0.03) {
      const sp = this.makeChar(n, 'family', { age: Math.max(16, age - 5 + Math.floor(rng() * 8)), female: !ruler.female });
      sp.dyn = personName(rng, n.culture)[1]; sp.spouse = ruler.id; ruler.spouse = sp.id;
      if (n.id === s.player) this.log(`${this.charName(ruler)} marries ${this.charName(sp)}.`, { nation: n.id, type: 'court' });
    }
    // children
    const sp = s.chars[ruler.spouse];
    const mother = ruler.female ? ruler : sp && sp.female ? sp : null;
    if (sp && mother && this.age(mother) >= 16 && this.age(mother) < 42 && this.dynasts(n).filter((c) => this.age(c) < 16).length < 6 && rng() < 0.03) {
      const f = ruler.female ? sp : ruler;
      const child = this.makeChar(n, n.heir ? 'family' : 'heir', { name: [personName(rng, n.culture)[0], ruler.dyn], age: 0, father: f.id, mother: mother.id, dynastic: true, female: rng() < 0.48 });
      child.dyn = ruler.dyn;
      if (!n.heir) n.heir = child.id;
      if (n.id === s.player) this.log(`A ${child.female ? 'daughter' : 'son'} is born: ${this.charName(child)}.`, { nation: n.id, type: 'court' });
    }
    // an heir for realms whose line has run out
    if (!n.heir && age > 20 && age < 55 && !sp && rng() < 0.01) {
      const h = this.makeChar(n, 'heir', { name: [personName(rng, n.culture)[0], ruler.dyn], age: 0, father: ruler.id, dynastic: true });
      n.heir = h.id;
    }
    // child mortality
    for (const c of this.dynasts(n)) if (this.age(c) < 10 && c.role !== 'ruler' && rng() < 0.002) this.killChar(c, 'died in childhood');
    // regency ends
    if (n.regent && s.day >= n.regent.until) { n.regent = null; this.recalcMods(n.id); }
    // claimants and pretender revolts
    const pt = n.pretender;
    if (pt) {
      const a = s.armies[pt.army], c = s.chars[pt.char];
      if (!a || !c) { if (c) { this.exile(c); this.log(`The pretender's rising against ${n.name} is crushed.`, { nation: n.id, type: 'war' }); } n.pretender = null; }
      else if (s.day - pt.since > 360 || this.ownedProvinces(n.id).filter((p) => s.prov[p].controller === -2).length >= 3) this.usurp(n, c, a);
    } else {
      const unstable = n.stability < 0 || n.legitimacy < 35;
      for (const c of this.charsOf(n.id, 'claimant')) {
        if (this.age(c) < 16) continue;
        if (rng() < 0.004 + (unstable ? 0.015 : 0) + (c.ambition > 70 ? 0.005 : 0)) { this.raisePretender(n, c); break; }
      }
    }
  },
  raisePretender(n, c) {
    const ps = this.ownedProvinces(n.id).filter((p) => p !== n.capital);
    if (!ps.length) return;
    const a = this.spawnRebels(pick(this.rng, ps), true);
    if (!a) return;
    a.name = `${this.charName(c)}'s Host`;
    n.pretender = { char: c.id, army: a.id, since: this.s.day };
    this.log(`${this.charName(c)} claims the throne of ${n.name}!`, { nation: n.id, type: 'war', important: n.id === this.s.player });
  },
  usurp(n, c, a) {
    const s = this.s, old = s.chars[n.ruler];
    if (a) this.disband(a.id);
    n.pretender = null;
    if (old) { old.role = 'family'; old.office = null; this.exile(old); }
    c.role = 'ruler'; n.ruler = c.id; c.dynastic = true; n.heir = null;
    n.legitimacy = Math.max(10, n.legitimacy - 30);
    this.recalcMods(n.id);
    this.log(`${this.charName(c)} seizes the throne of ${n.name}!`, { nation: n.id, type: 'court', important: true });
    if (n.id === s.player) this.notify({ title: 'Usurper', icon: '🗡', text: `${this.charName(c)} has overthrown the ruler and taken the crown.` });
  },
  politicsMods(n, add) {
    if (n.regent) add({ stabilityMonthly: -0.01, taxMult: -0.05 });
  },
};
