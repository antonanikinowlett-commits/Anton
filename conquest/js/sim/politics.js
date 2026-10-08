// Laws and their passage through the estates, the royal council, estate interactions,
// national focuses and the shared effect system used by focuses and events.
import { LAWS, GOVS, defaultLaws, ROLE_INFO } from '../data/government.js';
import { buildFocusTree } from '../data/focus.js';
import { BUILDINGS } from '../data/buildings.js';
import { EVENTS, HISTORY } from '../data/events.js';
import { UNITS } from '../data/units.js';
import { clamp, pick } from '../util.js';

const ESTATES = ['nobles', 'clergy', 'burghers', 'peasants'];
const OPNAME = { '>=': 'at least', '<': 'below', '<=': 'at most', '>': 'above', in: 'one of' };

export const PoliticsMixin = {
  // ── laws
  lawReqs(nid, cat, opt) {
    const n = this.s.nations[nid];
    const L = LAWS[cat], o = L.options[opt];
    const out = []; // [text, ok]
    if (o.govs) out.push([`Government: ${o.govs.map((g) => GOVS[g].name).join(' / ')}`, o.govs.includes(n.gov)]);
    if (o.religions) out.push([`Faith: ${o.religions.join(' / ')}`, o.religions.includes(n.religion)]);
    if (o.groups) out.push([`Culture: ${o.groups.join(' / ')}`, o.groups.includes(n.group)]);
    for (const [k, op, v] of o.req || []) {
      let cur, ok, label;
      if (k === 'authority') {
        const ord = LAWS.authority.ordered;
        cur = ord.indexOf(n.laws.authority); ok = cur >= ord.indexOf(v); label = `Crown authority ${OPNAME[op]} ${LAWS.authority.options[v].name}`;
      } else if (k === 'unlock') { ok = n.unlocks.includes(v); label = v === 'roman_law' ? 'Unlocked by founding a University (focus)' : `Unlock: ${v}`; }
      else if (k.startsWith('law.')) { const c = k.slice(4); ok = v.includes(n.laws[c]); label = `${LAWS[c].name}: ${v.map((x) => LAWS[c].options[x].name).join(' or ')}`; }
      else {
        if (k === 'stability') cur = n.stability; else if (k === 'legitimacy') cur = n.legitimacy;
        else if (k.startsWith('influence.')) cur = n.estates[k.slice(10)].influence;
        else if (k.startsWith('buildings.')) cur = this.countBuildings(nid, k.slice(10));
        ok = op === '>=' ? cur >= v : op === '<' ? cur < v : op === '>' ? cur > v : cur <= v;
        const nm = k.startsWith('buildings.') ? `${BUILDINGS[k.slice(10)].name} (total levels)` : k.startsWith('influence.') ? `${k.slice(10)} influence` : k;
        label = `${nm} ${OPNAME[op]} ${v} (now ${Math.round(cur * 10) / 10})`;
      }
      out.push([label, ok]);
    }
    if (cat === 'authority' && L.ordered.includes(opt) && L.ordered.includes(n.laws.authority)) {
      const d = Math.abs(L.ordered.indexOf(opt) - L.ordered.indexOf(n.laws.authority));
      out.push(['Must change one step at a time', d <= 1]);
    }
    return out;
  },
  lawVisible(nid, cat, opt) {
    const n = this.s.nations[nid], o = LAWS[cat].options[opt];
    if (o.govs && !o.govs.includes(n.gov)) return false;
    if (o.religions && !o.religions.includes(n.religion)) return false;
    return true;
  },
  lawVote(nid, cat, opt) {
    const n = this.s.nations[nid], o = LAWS[cat].options[opt];
    const res = {};
    let yes = 0, tot = 0;
    for (const e of ESTATES) {
      const st = n.estates[e];
      const stance = o.stance?.[e] || 0;
      const sup = clamp(0.5 + stance * 0.22 + (st.loyalty - 50) / 160, 0, 1);
      res[e] = { stance, support: sup, influence: st.influence };
      yes += sup * st.influence; tot += st.influence;
    }
    return { estates: res, yes: yes / tot };
  },
  canProposeLaw(nid, cat, opt) {
    const n = this.s.nations[nid];
    if (n.laws[cat] === opt) return 'Already in force';
    if (n.lawVote) return 'Another law is being debated';
    if (!this.lawVisible(nid, cat, opt)) return 'Not available to our realm';
    const reqs = this.lawReqs(nid, cat, opt);
    const bad = reqs.find(([, ok]) => !ok);
    if (bad) return bad[0];
    if (n.prestige < 10) return 'Requires 10 prestige';
    return null;
  },
  proposeLaw(nid, cat, opt) {
    const why = this.canProposeLaw(nid, cat, opt);
    if (why) return why;
    const n = this.s.nations[nid];
    n.prestige -= 10;
    n.lawVote = { cat, opt, days: 45, total: 45 };
    if (nid === this.s.player) this.log(`The council begins debating ${LAWS[cat].options[opt].name}.`, { nation: nid, type: 'law' });
    this.emit('law');
    return null;
  },
  canDecree(nid) { return this.mod(nid, 'decree') > 0; },
  decreeLaw(nid, cat, opt) {
    if (!this.canDecree(nid)) return 'Only absolute rulers may decree';
    const n = this.s.nations[nid];
    const why = this.canProposeLaw(nid, cat, opt);
    if (why && !why.startsWith('Another')) return why;
    n.legitimacy = Math.max(0, n.legitimacy - 15);
    this.estateDelta(n, 'nobles', -10);
    this.enactLaw(nid, cat, opt);
    return null;
  },
  enactLaw(nid, cat, opt) {
    const n = this.s.nations[nid], o = LAWS[cat].options[opt];
    n.laws[cat] = opt;
    for (const e of ESTATES) this.estateDelta(n, e, (o.stance?.[e] || 0) * 6);
    if (o.convert) this.convertNation(nid);
    this.recalcMods(nid);
    if (nid === this.s.player) this.log(`${n.name} adopts ${o.name}.`, { nation: nid, type: 'law', important: true });
    this.emit('law');
  },
  dailyPolitics() {
    const s = this.s;
    for (const n of s.nations) {
      if (!n.alive) continue;
      if (n.lawVote && --n.lawVote.days <= 0) {
        const { cat, opt } = n.lawVote;
        n.lawVote = null;
        const v = this.lawVote(n.id, cat, opt);
        if (v.yes >= 0.5 && !this.lawReqs(n.id, cat, opt).some(([, ok]) => !ok)) this.enactLaw(n.id, cat, opt);
        else {
          n.legitimacy = Math.max(0, n.legitimacy - 5);
          if (n.id === s.player) { this.log(`The estates reject ${LAWS[cat].options[opt].name} (${Math.round(v.yes * 100)}% in favour).`, { nation: n.id, type: 'law', important: true }); this.emit('law'); }
        }
      }
      if (n.focus.cur) {
        n.focus.prog += 1 + this.mod(n.id, 'focusSpeed');
        const f = this.focusTree(n.id).find((x) => x.id === n.focus.cur);
        if (f && n.focus.prog >= f.days) this.completeFocus(n.id, f);
      }
    }
  },

  // ── council & characters
  appoint(nid, role, cid) {
    const n = this.s.nations[nid], c = this.s.chars[cid];
    if (!c || c.nation !== nid) return 'Invalid character';
    if (c.role === 'ruler') return 'The ruler cannot hold office';
    const old = this.s.chars[n.council[role]];
    if (old) { old.office = null; old.role = 'pool'; }
    if (c.office && n.council[c.office] === c.id) n.council[c.office] = null;
    if (c.army) this.unassignGeneral(c.army);
    c.role = 'minister'; c.office = role; n.council[role] = cid;
    this.recalcMods(nid);
    this.emit('court');
    return null;
  },
  dismiss(nid, role) {
    const n = this.s.nations[nid], c = this.s.chars[n.council[role]];
    if (c) { c.office = null; c.role = 'pool'; }
    n.council[role] = null;
    this.estateDelta(n, 'nobles', -3);
    this.recalcMods(nid);
    this.emit('court');
  },
  hireGeneral(nid, cid) {
    const n = this.s.nations[nid], c = this.s.chars[cid];
    if (n.prestige < 10) return 'Requires 10 prestige';
    if (!c || c.role !== 'pool') return 'Invalid candidate';
    n.prestige -= 10;
    c.role = 'general';
    if (!c.gen) this.makeGeneral(c);
    this.emit('court');
    return null;
  },
  dismissGeneral(cid) {
    const c = this.s.chars[cid];
    if (!c) return;
    if (c.army) this.unassignGeneral(c.army);
    c.role = 'pool';
    this.emit('court');
  },
  recruitCandidate(nid, skill) {
    const n = this.s.nations[nid];
    if (n.gold < 25) return 'Need 25 gold';
    n.gold -= 25;
    this.makeChar(n, 'pool', { focusSkill: skill });
    this.emit('court');
    return null;
  },
  ESTATE_ACTIONS: {
    grant: { name: 'Grant Privileges', desc: '+20 loyalty, +5 influence, -5 legitimacy.', cd: 365 },
    funds: { name: 'Demand Funds', desc: 'Gold from the estate; -15 loyalty.', cd: 365 },
    levies: { name: 'Demand Levies', desc: 'Nobles raise extra manpower; -12 loyalty.', cd: 365, only: ['nobles'] },
    curb: { name: 'Curb Power', desc: '-8 influence, -20 loyalty. Risky if they are strong.', cd: 730 },
  },
  estateAction(nid, e, act) {
    const n = this.s.nations[nid], st = n.estates[e];
    const key = e + act;
    n.estateCd ||= {};
    if ((n.estateCd[key] || 0) > this.s.day) return 'Not yet possible again';
    const A = this.ESTATE_ACTIONS[act];
    if (A.only && !A.only.includes(e)) return 'Not possible for this estate';
    if (act === 'grant') { this.estateDelta(n, e, 20); (n.estateInfl ||= {})[e] = (n.estateInfl[e] || 0) + 5; n.legitimacy = Math.max(0, n.legitimacy - 5); }
    if (act === 'funds') { const g = Math.round(15 + st.influence * 1.2 + this.ownedProvinces(nid).length * 0.6); n.gold += g; this.estateDelta(n, e, -15); }
    if (act === 'levies') { n.manpower += n.maxManpower * 0.25; this.estateDelta(n, e, -12); }
    if (act === 'curb') { (n.estateInfl ||= {})[e] = (n.estateInfl[e] || 0) - 8; this.estateDelta(n, e, -20); if (st.influence > 45 && this.rng() < 0.4) this.spawnRebels(this.ownedProvinces(nid).find((p) => p !== n.capital) ?? n.capital, e === 'nobles'); }
    n.estateCd[key] = this.s.day + A.cd;
    this.emit('court');
    return null;
  },

  // ── focus trees
  focusTree(nid) {
    this._ft ||= {};
    const n = this.s.nations[nid];
    const key = nid + ':' + n.gov + ':' + n.religion;
    if (!this._ft[key]) this._ft[key] = buildFocusTree(n, this);
    return this._ft[key];
  },
  focusStatus(nid, f) {
    const n = this.s.nations[nid];
    if (n.focus.done.includes(f.id)) return 'done';
    if (n.focus.cur === f.id) return 'active';
    if (f.excl.some((x) => n.focus.done.includes(x) || n.focus.cur === x)) return 'excluded';
    if (!f.pre.every((grp) => grp.some((x) => n.focus.done.includes(x)))) return 'locked';
    if (f.req?.provinces && this.ownedProvinces(nid).length < f.req.provinces) return 'locked';
    return 'available';
  },
  startFocus(nid, fid) {
    const n = this.s.nations[nid];
    const f = this.focusTree(nid).find((x) => x.id === fid);
    if (!f) return 'Unknown focus';
    const st = this.focusStatus(nid, f);
    if (st !== 'available') return st === 'locked' ? 'Prerequisites not met' : st === 'excluded' ? 'Mutually exclusive with a chosen focus' : 'Not available';
    if (n.focus.cur) return 'Already pursuing a focus';
    n.focus.cur = fid; n.focus.prog = 0;
    this.emit('focus');
    return null;
  },
  cancelFocus(nid) { const n = this.s.nations[nid]; n.focus.cur = null; n.focus.prog = 0; this.emit('focus'); },
  completeFocus(nid, f) {
    const n = this.s.nations[nid];
    n.focus.done.push(f.id); n.focus.cur = null; n.focus.prog = 0;
    this.applyEffects(nid, f.effects, 'focus:' + f.id);
    if (nid === this.s.player) {
      this.log(`National focus completed: ${f.name}.`, { nation: nid, type: 'focus', important: true });
      this.notify({ title: 'Focus Complete', icon: f.icon, text: f.name });
    }
    this._ft = null;
    this.emit('focus');
  },

  // ── effects
  applyEffects(nid, effects, src = 'effect') {
    const s = this.s, n = s.nations[nid];
    for (const e of effects) {
      if (e.mods) n.mods.push({ src, mods: e.mods });
      if (e.mods_t) n.mods.push({ src, mods: e.mods_t.mods, until: s.day + e.mods_t.months * 30 });
      for (const k of ['gold', 'prestige', 'iron', 'timber', 'horses', 'food']) if (e[k] !== undefined) n[k] += e[k];
      if (e.legitimacy) n.legitimacy = clamp(n.legitimacy + e.legitimacy, 0, 100);
      if (e.stability) n.stability = clamp(n.stability + e.stability, -3, 3);
      if (e.manpower) n.manpower = Math.max(0, n.manpower + e.manpower);
      if (e.claims) this.effectClaims(nid, e.claims);
      if (e.cb) n.cbs.push({ kind: e.cb.kind, tag: e.cb.tag });
      if (e.unlock) n.unlocks.push(e.unlock);
      if (e.build) this.effectBuild(nid, e.build);
      if (e.law) { if (LAWS[e.law.cat]?.options[e.law.opt]) { n.laws[e.law.cat] = e.law.opt; } }
      if (e.loyalty) for (const [k, v] of Object.entries(e.loyalty)) this.estateDelta(n, k, v);
      if (e.influence) for (const [k, v] of Object.entries(e.influence)) { (n.estateInfl ||= {})[k] = (n.estateInfl[k] || 0) + v; }
      if (e.opinion) {
        for (const o of s.nations) {
          if (!o.alive || o.id === nid) continue;
          const O = e.opinion;
          const match = (O.tag && o.tag === O.tag) || (O.group === 'christian' && this.relGroup(o.religion) === 'christian') || (O.religion && o.religion === O.religion) || (O.gov && o.gov === O.gov);
          if (match) o.opinion[nid] = (o.opinion[nid] ?? 0) + O.v;
        }
      }
      if (e.gov) this.changeGov(nid, e.gov.gov, e.gov.name);
      if (e.religion) this.convertNation(nid, e.religion === 'auto' ? null : e.religion);
      if (e.unrest) { const ps = this.ownedProvinces(nid); for (let i = 0; i < e.unrest.n && ps.length; i++) { const p = pick(this.rng, ps); s.prov[p].unrest = clamp(s.prov[p].unrest + e.unrest.v, 0, 100); } }
      if (e.devLoss) { const ps = this.ownedProvinces(nid); for (let i = 0; i < e.devLoss.n && ps.length; i++) { const p = pick(this.rng, ps); s.prov[p].dev = Math.max(1, s.prov[p].dev - 1); } }
      if (e.revolt) { const ps = this.ownedProvinces(nid).filter((p) => p !== n.capital); for (let i = 0; i < e.revolt.n && ps.length; i++) this.spawnRebels(pick(this.rng, ps), e.revolt.nobles); }
      if (e.mercs && n.capital >= 0) {
        const regs = [];
        for (const [t, c] of Object.entries(e.mercs.regs)) for (let i = 0; i < c; i++) regs.push(this.newReg(t));
        const a = this.createArmy(nid, n.capital, regs, 'Free Company');
        for (const r of a.regs) r.xp = 0.4;
      }
    }
    this.recalcMods(nid);
    this.emit('effects', nid);
  },
  effectClaims(nid, c) {
    const s = this.s, n = s.nations[nid];
    let targets = [];
    const inBox = (p, b) => { const sp = this.map.provinces[p]; return sp.lon >= b[0] && sp.lat >= b[1] && sp.lon <= b[2] && sp.lat <= b[3]; };
    if (c.tag) {
      const t = this.nationByTag(c.tag);
      if (!t || !t.alive) return;
      targets = this.ownedProvinces(t.id);
      if (c.box) targets = targets.filter((p) => inBox(p, c.box));
      if (c.border) {
        // provinces within N steps of our border
        const mine = new Set(this.ownedProvinces(nid));
        let frontier = new Set(targets.filter((p) => this.map.provinces[p].adj.some((e) => mine.has(e.id))));
        const all = new Set(frontier);
        for (let i = 1; i < c.border; i++) {
          const next = new Set();
          for (const p of frontier) for (const e of this.map.provinces[p].adj) if (e.id < this.L && s.prov[e.id].owner === t.id && !all.has(e.id)) { next.add(e.id); all.add(e.id); }
          frontier = next;
        }
        targets = [...all];
      }
    } else if (c.coastalNear) {
      const mine = this.ownedProvinces(nid).filter((p) => this.map.provinces[p].coastal);
      const seas = new Set(mine.flatMap((p) => this.map.provinces[p].seas));
      for (const sz of [...seas]) for (const e of this.map.provinces[sz].adj) if (e.id >= this.L) seas.add(e.id);
      targets = [];
      for (let p = 0; p < this.L; p++) {
        const pr = s.prov[p];
        if (pr.owner === nid || pr.owner < 0) continue;
        if (this.map.provinces[p].seas.some((x) => seas.has(x)) && this.power(pr.owner) < this.power(nid) * 1.2) targets.push(p);
      }
      targets = targets.sort((a, b) => s.prov[b].dev - s.prov[a].dev).slice(0, c.coastalNear);
    } else if (c.sameReligionNeighbors) {
      for (const o of this.neighbours(nid)) if (s.nations[o].religion === n.religion) targets.push(...this.ownedProvinces(o).filter((p) => this.map.provinces[p].adj.some((e) => e.id < this.L && s.prov[e.id].owner === nid)));
    } else if (c.tribalNeighbors) {
      for (const o of this.neighbours(nid)) if (s.nations[o].gov === 'tribal' && s.nations[o].group === n.group) targets.push(...this.ownedProvinces(o));
    }
    for (const p of targets) if (!s.prov[p].claims.includes(nid)) s.prov[p].claims.push(nid);
    this.emit('claims');
  },
  effectBuild(nid, b) {
    const s = this.s, n = s.nations[nid];
    let cands = this.ownedProvinces(nid).filter((p) => BUILDINGS[b.type].allowed(this.map.provinces[p]) && (s.prov[p].buildings[b.type] || 0) < BUILDINGS[b.type].max);
    if (b.where === 'capital') cands = cands.filter((p) => p === n.capital);
    else if (b.where === 'border') { const bp = new Set(this.borderProvinces(nid)); cands = cands.filter((p) => bp.has(p)).sort((a, c) => s.prov[c].dev - s.prov[a].dev); }
    else if (b.where === 'coastal') cands = cands.filter((p) => this.map.provinces[p].coastal).sort((a, c) => s.prov[c].dev - s.prov[a].dev);
    else if (b.where === 'random') cands = cands.sort((a, c) => s.prov[c].dev - s.prov[a].dev + (this.rng() - 0.5) * 6);
    else cands = cands.filter((p) => this.map.provinces[p].name === b.where);
    for (const p of cands.slice(0, b.n || 1)) { s.prov[p].buildings[b.type] = (s.prov[p].buildings[b.type] || 0) + 1; this.emit('building', p, b.type); }
  },
  changeGov(nid, gov, name) {
    const n = this.s.nations[nid];
    const old = n.gov;
    n.gov = gov;
    if (name) n.name = name;
    else if (old === 'tribal' && gov === 'feudal_monarchy') n.name = `Kingdom of ${n.adj === 'Lithuanian' ? 'Lithuania' : n.adj}`;
    const def = defaultLaws(n);
    for (const cat of Object.keys(LAWS)) {
      const o = LAWS[cat].options[n.laws[cat]];
      if (!o || (o.govs && !o.govs.includes(gov)) || (o.religions && !o.religions.includes(n.religion))) n.laws[cat] = def[cat];
    }
    if (gov === 'feudal_monarchy' && n.laws.authority === 'low') n.laws.authority = 'medium';
    this._ft = null;
    this.recalcMods(nid);
    this.log(`The ${n.adj} realm becomes a ${GOVS[gov].name}: ${n.name}.`, { nation: nid, type: 'law', important: true });
    this.emit('nationChanged', nid);
  },
  convertNation(nid, rel) {
    const s = this.s, n = s.nations[nid];
    if (!rel) {
      let cath = 0, orth = 0;
      for (const o of this.neighbours(nid)) { if (s.nations[o].religion === 'catholic') cath++; if (s.nations[o].religion === 'orthodox') orth++; }
      rel = orth > cath ? 'orthodox' : 'catholic';
    }
    n.religion = rel;
    const ps = this.ownedProvinces(nid);
    for (const p of ps) if (p === n.capital || this.rng() < 0.35) s.prov[p].religion = rel;
    const def = defaultLaws(n);
    n.laws.church = def.church; n.laws.justice = def.justice;
    for (const cat of Object.keys(LAWS)) { const o = LAWS[cat].options[n.laws[cat]]; if (!o || (o.religions && !o.religions.includes(rel))) n.laws[cat] = def[cat]; }
    n.cbs = n.cbs.filter((c) => c.kind !== 'holy_war');
    this._ft = null;
    this.recalcMods(nid);
    this.log(`The ${n.adj} court accepts ${rel === 'catholic' ? 'Catholic' : rel === 'orthodox' ? 'Orthodox' : rel} Christianity!`, { nation: nid, type: 'law', important: true });
    this.emit('nationChanged', nid);
  },
  describeEffects(effects) {
    const out = [];
    const pctS = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
    const MOD_NAMES = { taxMult: 'Tax income', tradeMult: 'Trade income', foodMult: 'Food', ironMult: 'Iron', manpowerMult: 'Manpower', devGrowth: 'Development growth', fortDefense: 'Fort defence', discipline: 'Discipline',
      trainSpeed: 'Training speed', cavAtk: 'Cavalry attack', cavCost: 'Cavalry cost', infDef: 'Infantry defence', infAtk: 'Infantry attack', siege: 'Siege speed', armyMorale: 'Army morale', generalTactics: 'General tactics',
      diplo: 'Diplomatic reputation', aeDecay: 'AE decay', focusSpeed: 'Focus speed', legitimacyMonthly: 'Monthly legitimacy', unrest: 'Unrest', clergyLoyalty: 'Clergy loyalty', stabilityMonthly: 'Monthly stability',
      seaSpeed: 'Sea transport speed', nobleLoyalty: 'Noble loyalty', burgherLoyalty: 'Burgher loyalty', peasantLoyalty: 'Peasant loyalty', decree: 'Royal decrees', rulerSkill: 'Ruler skill', papalOpinion: 'Papal opinion', upkeepMult: 'Army upkeep', supply: 'Supply', unrestInfidel: 'Unrest (other faiths)', crownBonus: 'Crown power', cavCostX: '', rangedAtk: 'Missile damage', defenseHome: 'Defence in own lands', lootMult: 'Loot', horsesMult: 'Horses', buildSpeed: 'Build speed', buildCost: 'Building cost', recruitCost: 'Recruit cost' };
    const flatK = ['diplo', 'unrest', 'clergyLoyalty', 'nobleLoyalty', 'burgherLoyalty', 'peasantLoyalty', 'generalTactics', 'decree', 'rulerSkill', 'papalOpinion', 'crownBonus', 'unrestInfidel'];
    for (const e of effects) {
      const m = e.mods || e.mods_t?.mods;
      if (m) for (const [k, v] of Object.entries(m)) out.push(`${MOD_NAMES[k] || k}: ${flatK.includes(k) ? (v > 0 ? '+' : '') + v : k.endsWith('Monthly') ? (v > 0 ? '+' : '') + v * 10 : pctS(v)}${e.mods_t ? ` for ${e.mods_t.months} months` : ''}`);
      for (const k of ['gold', 'prestige', 'legitimacy', 'stability', 'manpower', 'iron', 'timber', 'horses', 'food']) if (e[k]) out.push(`${k[0].toUpperCase() + k.slice(1)} ${e[k] > 0 ? '+' : ''}${e[k]}`);
      if (e.claims) out.push(e.claims.tag ? `Claims on ${e.claims.box ? 'part of ' : e.claims.border ? 'the borderlands of ' : 'all of '}${this.nationByTag(e.claims.tag)?.name || e.claims.tag}` : e.claims.coastalNear ? 'Claims on nearby coastal provinces' : 'Claims on neighbouring lands');
      if (e.cb) out.push(`Casus belli: ${e.cb.kind === 'holy_war' ? 'Holy War' : e.cb.kind}${e.cb.tag ? ' vs ' + (this.nationByTag(e.cb.tag)?.name || e.cb.tag) : ''}`);
      if (e.unlock) out.push(UNITS[e.unlock] ? `Unlocks ${UNITS[e.unlock].name}` : e.unlock === 'roman_law' ? 'Unlocks Roman Law' : `Unlocks ${e.unlock}`);
      if (e.build) out.push(`Free ${BUILDINGS[e.build.type].name} ×${e.build.n || 1} (${e.build.where})`);
      if (e.law) out.push(`Adopt law: ${LAWS[e.law.cat]?.options[e.law.opt]?.name}`);
      if (e.loyalty) for (const [k, v] of Object.entries(e.loyalty)) out.push(`${k} loyalty ${v > 0 ? '+' : ''}${v}`);
      if (e.influence) for (const [k, v] of Object.entries(e.influence)) out.push(`${k} influence ${v > 0 ? '+' : ''}${v}`);
      if (e.opinion) out.push(`Opinion of us ${e.opinion.v > 0 ? '+' : ''}${e.opinion.v} (${e.opinion.tag || e.opinion.group || e.opinion.religion || e.opinion.gov})`);
      if (e.gov) out.push(`Government becomes ${GOVS[e.gov.gov].name}${e.gov.name ? ` (${e.gov.name})` : ''}`);
      if (e.religion) out.push('Convert to Christianity');
      if (e.unrest) out.push(`Unrest ${e.unrest.v > 0 ? '+' : ''}${e.unrest.v} in ${e.unrest.n} provinces`);
      if (e.devLoss) out.push(`-1 development in ${e.devLoss.n} provinces`);
      if (e.revolt) out.push(`${e.revolt.nobles ? 'Baronial' : 'Peasant'} revolt`);
      if (e.mercs) out.push('A mercenary company joins us');
    }
    return out;
  },

  // ── events
  monthlyEvents() {
    const s = this.s;
    for (const h of HISTORY) {
      if (s.firedHistory.includes(h.id) || s.day < h.day) continue;
      s.firedHistory.push(h.id);
      if (h.tag) {
        const n = this.nationByTag(h.tag);
        if (!n || !n.alive) continue;
        if (n.id === s.player) s.eventQueue.push({ id: h.id, hist: true });
        else this.applyEffects(n.id, h.options[0].effects, 'event:' + h.id);
      } else {
        if (h.spawnMongols) this.spawnMongols();
        if (h.id === 'fourth_crusade') {
          const V = this.nationByTag('VEN'), B = this.nationByTag('BYZ');
          if (V && B && V.alive && B.alive) { this.effectClaims(V.id, { tag: 'BYZ', box: [26, 40, 30, 42] }); V.cbs.push({ kind: 'holy_war', tag: 'BYZ' }); }
        }
        s.eventQueue.push({ id: h.id, hist: true, info: true });
      }
    }
    for (const n of s.nations) {
      if (!n.alive || n.ai.horde) continue;
      for (const ev of EVENTS) {
        if (this.rng() >= ev.chance) continue;
        if (ev.cond && !ev.cond(n, this)) continue;
        if (n.id === s.player) s.eventQueue.push({ id: ev.id });
        else this.applyEffects(n.id, ev.options[Math.floor(this.rng() * ev.options.length)].effects, 'event:' + ev.id);
        break;
      }
    }
    if (s.eventQueue.length) this.emit('event');
  },
  eventDef(id) { return EVENTS.find((e) => e.id === id) || HISTORY.find((e) => e.id === id); },
  chooseEvent(idx) {
    const s = this.s;
    const q = s.eventQueue.shift();
    if (!q) return;
    const ev = this.eventDef(q.id);
    if (ev && ev.options && ev.options[idx]) this.applyEffects(s.player, ev.options[idx].effects, 'event:' + ev.id);
    this.emit('event');
  },
};
