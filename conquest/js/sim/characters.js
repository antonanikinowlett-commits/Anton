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
      skills: { martial: 0, diplomacy: 0, stewardship: 0, intrigue: 0, learning: 0 }, traits: [], gen: null, army: null, seed: Math.floor(rng() * 1e9), xp: 0 };
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
    n.ruler = r.id;
    if (!['merchant_republic', 'theocracy', 'elective_monarchy'].includes(n.gov) && ra > 18) {
      const h = this.makeChar(n, 'heir', { name: [personName(rng, n.culture)[0], rd], age: Math.max(1, ra - 22 - Math.floor(rng() * 8)) });
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
    // heirs
    if (!n.heir && !['merchant_republic', 'theocracy', 'elective_monarchy', 'caliphate'].includes(n.gov) && ruler && this.age(ruler) > 20 && this.age(ruler) < 55 && this.rng() < 0.02) {
      const h = this.makeChar(n, 'heir', { name: [personName(this.rng, n.culture)[0], ruler.dyn], age: 0 });
      n.heir = h.id;
      if (n.id === s.player) this.log(`An heir is born: ${this.charName(h)}.`, { nation: n.id, type: 'court' });
    }
    // refresh candidate pool
    const pool = this.charsOf(n.id, 'pool');
    if (pool.length < 4 && this.rng() < 0.2) this.makeChar(n, 'pool', { focusSkill: pick(this.rng, ['diplomacy', 'martial', 'stewardship', 'intrigue', 'learning']) });
    if (pool.length > 8) this.killChar(pool[0], 'left court');
  },
  killChar(c, why) {
    const s = this.s, n = s.nations[c.nation];
    delete s.chars[c.id];
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
    heir.role = 'ruler'; heir.office = null;
    n.ruler = heir.id; n.heir = null;
    if (n.laws.succession === 'gavelkind') { n.stability -= 0.5; this.estateDelta(n, 'nobles', 10); }
    if (crisis) { n.legitimacy = Math.max(0, n.legitimacy - 25); n.stability = Math.max(-3, n.stability - 1); }
    else n.legitimacy = clamp(n.legitimacy - 10 + (n.laws.succession === 'primogeniture' ? 10 : 0), 0, 100);
    if (n.laws.succession === 'tanistry') heir.skills.martial += 2;
    if (old) old.role = 'dead';
    this.recalcMods(n.id);
    const t = this.rulerTitle(n);
    this.log(`${t} ${this.charName(heir)} now rules the ${n.name}${crisis ? ' — a child ruler! A regency council governs.' : '.'}`, { nation: n.id, type: 'court', important: n.id === s.player });
    if (n.id === s.player) this.notify({ title: 'Succession', icon: '👑', text: `${t} ${this.charName(heir)} has succeeded to the throne.` });
  },
};
