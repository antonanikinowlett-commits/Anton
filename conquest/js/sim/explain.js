// "Why did this number change?" helpers. Every explain*() returns plain data the UI can render as a tooltip or panel:
//   { key, title, value, change, unit, parts: [{ label, value, note? }], recent: [{ day, d, why }] }
// parts add up to `change` (the monthly change) where that makes sense. Nothing here mutates state.
// ledger: game.bump(nid, stat, delta, why) records a one-off change so the UI can say "−5 legitimacy: estates rejected the law".
import { LAWS } from '../data/government.js';
import { INNOV } from '../data/innovations.js';
import { BUILDINGS } from '../data/buildings.js';
import { STANCES } from '../data/stances.js';
import { clamp, dateOf } from '../util.js';

const r1 = (x) => Math.round(x * 100) / 100;

export const ExplainMixin = {
  modSrcLabel(src) {
    if (!src) return 'Other';
    const [k, id] = src.split(':');
    if (k === 'innov') return `Innovation: ${INNOV[id]?.name || id}`;
    if (k === 'focus') { const f = this.s.nations.length && this._ft ? Object.values(this._ft).flat().find((x) => x.id === id) : null; return `Focus: ${f?.name || id}`; }
    if (k === 'event') return `Event: ${this.eventDef(id)?.title || id}`;
    if (k === 'rank') return 'Realm rank';
    if (k === 'form') return 'Proclaimed realm';
    return src;
  },
  // Who contributes to modifier `key`: [{ label, value }] sorted by size, summing to mod(nid, key).
  modSources(nid, key) {
    const trace = [];
    this.recalcMods(nid, trace);
    const by = {};
    for (const [label, mods, f] of trace) if (mods[key]) by[label] = (by[label] || 0) + mods[key] * f;
    return Object.entries(by).map(([label, value]) => ({ label, value })).filter((x) => Math.abs(x.value) > 1e-9).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  },
  // ledger of recent one-off changes
  bump(nid, stat, delta, why) {
    const n = this.s.nations[nid];
    if (!n || !delta) return;
    (n.ledger ||= []).unshift({ day: this.s.day, stat, d: Math.round(delta * 100) / 100, why });
    if (n.ledger.length > 60) n.ledger.length = 60;
  },
  recentChanges(nid, stat, days = 365) {
    const n = this.s.nations[nid];
    return (n.ledger || []).filter((x) => x.stat === stat && this.s.day - x.day <= days).slice(0, 8);
  },
  explain(nid, key, p) {
    const f = this['explain_' + key];
    return f ? f.call(this, nid, p) : null;
  },

  explain_gold(nid) {
    const n = this.s.nations[nid], B = this.budget(nid);
    const parts = [];
    const bonus = B.taxRaw ? B.tax - B.taxRaw : 0;
    parts.push({ label: 'Land taxes (development, markets, faith, unrest)', value: r1(B.taxRaw) });
    if (Math.abs(bonus) > 0.01) parts.push({ label: 'Tax modifiers (laws, innovations, council, stability)', value: r1(bonus), note: this.modSources(nid, 'taxMult').map((x) => `${x.label} ${x.value > 0 ? '+' : ''}${Math.round(x.value * 100)}%`).join('; ') + ' (diminishing returns)' });
    parts.push({ label: 'Trade (markets, harbours, trade nodes)', value: r1(B.trade + B.nodes) });
    if (B.mines) parts.push({ label: 'Mines and tolls', value: r1(B.mines) });
    if (B.tribute) parts.push({ label: B.tribute > 0 ? 'Tribute from vassals' : 'Tribute to our overlord', value: r1(B.tribute) });
    parts.push({ label: 'Army upkeep', value: -r1(B.armyUpkeep), note: `${this.armiesOf(nid).length} armies` });
    parts.push({ label: 'Court and generals', value: -r1(B.court) });
    parts.push({ label: 'Administration (provinces, development, buildings)', value: -r1(B.admin) });
    if (B.interest) parts.push({ label: 'Interest on debt', value: -r1(B.interest) });
    return { key: 'gold', title: 'Treasury', value: Math.round(n.gold), change: r1(B.net), unit: 'gold/month', parts, recent: this.recentChanges(nid, 'gold') };
  },
  explain_manpower(nid) {
    const n = this.s.nations[nid];
    let base = 0, barracks = 0, stance = 0;
    for (const p of this.ownedProvinces(nid)) {
      const pr = this.s.prov[p], b = pr.dev * 120;
      const ctl = pr.controller === nid ? 1 : 0.3;
      base += b * ctl; barracks += b * ctl * 0.25 * (pr.buildings.barracks || 0);
      stance += b * ctl * (1 + 0.25 * (pr.buildings.barracks || 0)) * ((STANCES[pr.stance]?.mp ?? 1) - 1);
    }
    const m = this.mod(nid, 'manpowerMult'), sub = base + barracks + stance;
    const parts = [{ label: 'Development of provinces (120 men per point; occupied provinces yield 30%)', value: Math.round(base) }];
    if (barracks) parts.push({ label: 'Barracks', value: Math.round(barracks) });
    if (Math.abs(stance) > 1) parts.push({ label: 'Province stances', value: Math.round(stance) });
    for (const x of this.modSources(nid, 'manpowerMult')) parts.push({ label: x.label, value: Math.round(sub * x.value), note: `${x.value > 0 ? '+' : ''}${Math.round(x.value * 100)}%` });
    const regen = n.maxManpower / 60 * (n.food < 0 ? 0.3 : 1) * (1 + this.mod(nid, 'manpowerRegen'));
    return { key: 'manpower', title: 'Manpower', value: Math.round(n.manpower), max: n.maxManpower, change: Math.round(Math.min(regen, n.maxManpower - n.manpower)), unit: 'men/month', parts, recent: this.recentChanges(nid, 'manpower'), note: n.food < 0 ? 'Starvation slows recovery to 30%.' : 'Recovery is 1/60th of the maximum per month.' };
  },
  explain_food(nid) {
    const n = this.s.nations[nid], B = this.budget(nid);
    let prod = 0, eat = 0;
    for (const p of this.ownedProvinces(nid)) { const f = this.provinceIncome(p, nid).food; if (f >= 0) prod += f; else eat += f; }
    const parts = [{ label: 'Harvests and farms', value: r1(prod) }, { label: 'Population (development eats)', value: r1(eat) }];
    const fm = this.mod(nid, 'foodMult');
    if (fm && B.food > 0) parts.push({ label: 'Food modifiers', value: r1(B.food - (prod + eat)), note: this.modSources(nid, 'foodMult').map((x) => `${x.label} ${Math.round(x.value * 100)}%`).join('; ') });
    parts.push({ label: 'Army rations', value: -r1(B.armyFood) });
    return { key: 'food', title: 'Food', value: Math.round(n.food), change: r1(B.foodNet), unit: 'food/month', parts, recent: this.recentChanges(nid, 'food'), note: n.food < 0 ? 'Famine: -0.05 stability a month, weaker armies, slow manpower.' : '' };
  },
  explain_stability(nid) {
    const n = this.s.nations[nid];
    const parts = [];
    for (const x of this.modSources(nid, 'stabilityMonthly')) parts.push({ label: x.label, value: r1(x.value * 3) });
    if (n.legitimacy > 60) parts.push({ label: 'Legitimate rule (above 60)', value: 0.02 });
    else if (n.legitimacy < 30) parts.push({ label: 'Illegitimate rule (below 30)', value: -0.04 });
    if (n.food < 0) parts.push({ label: 'Famine', value: -0.05 });
    if (n.gold < -50) parts.push({ label: 'Debt', value: -0.1 });
    if (n.stability > 2) parts.push({ label: 'Content realms do not stay perfect', value: -0.05 });
    const ch = parts.reduce((t, x) => t + x.value, 0);
    return { key: 'stability', title: 'Stability', value: r1(n.stability), min: -3, max: 3, change: r1(ch), unit: 'per month', parts, recent: this.recentChanges(nid, 'stability'),
      effects: [`Tax ${n.stability >= 0 ? '+' : ''}${Math.round(n.stability * 4)}%`, `Unrest ${n.stability >= 0 ? '-' : '+'}${Math.abs(n.stability * 1.5).toFixed(1)}`, `Estate loyalty target ${n.stability >= 0 ? '+' : ''}${Math.round(n.stability * 3)}`, n.stability < 0 ? `Army morale −${Math.round(-n.stability * 3)}%` : ''].filter(Boolean) };
  },
  explain_legitimacy(nid) {
    const n = this.s.nations[nid];
    const parts = [{ label: 'The crown endures', value: 0.1 }];
    for (const x of this.modSources(nid, 'legitimacyMonthly')) parts.push({ label: x.label, value: r1(x.value * 10) });
    if (n.gold < 0) parts.push({ label: 'The treasury is empty', value: -0.5 });
    if (n.legitimacy > 80) parts.push({ label: 'Standing fades without deeds', value: this.s.difficulty === 'hard' ? -0.4 : -0.25 });
    const ch = parts.reduce((t, x) => t + x.value, 0);
    return { key: 'legitimacy', title: 'Legitimacy', value: Math.round(n.legitimacy), min: 0, max: 100, change: r1(ch), unit: 'per month', parts, recent: this.recentChanges(nid, 'legitimacy'),
      effects: ['80+: +4% tax, +3% army morale', 'Above 60: +0.02 stability a month', 'Below 40: +1.5 unrest, −5 noble loyalty', 'Below 30: −0.04 stability a month', 'Below 25: pretenders may raise rebels', 'Below 20: +3 unrest, −12 noble loyalty, −5% tax'] };
  },
  explain_admin(nid) {
    const o = this.overextension(nid), n = this.s.nations[nid];
    const parts = [{ label: 'Realm rank and inherited administration', value: o.parts[0][1] }];
    for (const x of this.modSources(nid, 'adminCap')) parts.push({ label: x.label, value: Math.round(o.parts[0][1] * x.value), note: `${x.value > 0 ? '+' : ''}${Math.round(x.value * 100)}%` });
    const ch = this.s.chars[n.council.steward];
    if (ch) parts.push({ label: `Steward ${this.charName(ch)} (stewardship ${ch.skills.stewardship})`, value: Math.round(o.parts[0][1] * ch.skills.stewardship * 0.008) });
    return { key: 'admin', title: 'Administrative capacity', value: o.load, max: o.cap, change: o.cap - o.load, unit: 'provinces of headroom', parts, note: o.over > 0 ? `Overextended by ${Math.round(o.over * 100)}%: tax −${Math.round(o.over * 25)}%, unrest +${(o.over * 2).toFixed(1)}, legitimacy −${(o.over * 3).toFixed(1)}/month.` : 'Provinces beyond capacity cost taxes, order and legitimacy. Raise it with laws (authority), chancery and records, a good steward, or higher rank.' };
  },
  explain_prestige(nid) {
    const n = this.s.nations[nid];
    const parts = [{ label: 'Prestige fades (0.5% of the stock)', value: r1(-n.prestige * 0.005) }];
    for (const x of this.modSources(nid, 'prestigeMonthly')) parts.push({ label: x.label, value: r1(x.value * 10) });
    return { key: 'prestige', title: 'Prestige', value: Math.round(n.prestige), change: r1(parts.reduce((t, x) => t + x.value, 0)), unit: 'per month', parts, recent: this.recentChanges(nid, 'prestige'), note: 'Won battles, ambitions and great works add prestige; laws, generals and ranks spend it.' };
  },
  explain_research(nid) {
    const R = this.researchBreakdown(nid);
    return { key: 'research', title: 'Research', value: Math.round(this.s.nations[nid].prog.pts), change: r1(R.total), unit: 'points/month', parts: R.parts.map(([label, value]) => ({ label, value: r1(value) })) };
  },
  // province unrest: target and the current drift
  explain_unrest(nid, p) {
    const pr = this.s.prov[p], n = this.s.nations[pr.owner];
    if (!n) return null;
    const parts = [];
    const cg = this.cultureGroup(pr.culture);
    if (pr.culture !== n.culture) parts.push({ label: cg !== n.group ? 'Foreign culture' : 'Related culture', value: cg !== n.group ? 8 : 3 });
    if (pr.religion !== n.religion) parts.push({ label: 'Different faith', value: 10 + this.mod(n.id, 'unrestInfidel') * 4 });
    if (pr.heresy) parts.push({ label: 'Heresy', value: 12 });
    if (pr.controller !== pr.owner) parts.push({ label: 'Under enemy occupation', value: 15 });
    const st = STANCES[pr.stance]?.unrest; if (st) parts.push({ label: `Stance: ${STANCES[pr.stance].name}`, value: st });
    const um = this.mod(n.id, 'unrest') * 3; if (Math.abs(um) > 0.01) parts.push({ label: 'Laws, council and realm stability', value: r1(um), note: this.modSources(n.id, 'unrest').slice(0, 4).map((x) => `${x.label} ${x.value > 0 ? '+' : ''}${r1(x.value * 3)}`).join('; ') });
    if (pr.devast) parts.push({ label: 'Devastation', value: r1(pr.devast * 0.2) });
    if (pr.buildings.church) parts.push({ label: 'Church', value: -pr.buildings.church * 4 });
    if (n.food < 0) parts.push({ label: 'Famine in the realm', value: 10 });
    parts.push({ label: 'Peasant mood', value: r1(3 - (n.estates.peasants?.loyalty ?? 50) / 20) });
    const target = parts.reduce((t, x) => t + x.value, 0);
    return { key: 'unrest', title: 'Unrest', value: Math.round(pr.unrest), target: Math.round(clamp(target, 0, 100)), change: r1((clamp(target, 0, 100) - pr.unrest) * 0.08), unit: 'per month', parts, note: 'Unrest drifts 8% a month towards the target. Above 60 revolts become likely; output falls with unrest.' };
  },
  // tax/trade/manpower etc. of one province broken into factors
  explainProvince(p) {
    const pr = this.s.prov[p], sp = this.map.provinces[p], nid = pr.owner;
    if (nid < 0) return null;
    const n = this.s.nations[nid], b = pr.buildings;
    const st = STANCES[pr.stance] || STANCES.balanced;
    const tax = [{ label: `Development ${pr.dev} × 0.08`, value: r1(pr.dev * 0.08) }];
    const f = [];
    if (b.market) f.push([`Market town ×${b.market}`, 1 + 0.08 * b.market]);
    if (pr.unrest > 0) f.push([`Unrest ${Math.round(pr.unrest)}`, 1 - pr.unrest / 200]);
    if (pr.religion !== n.religion) f.push(['Different faith', 0.85]);
    if (pr.devast) f.push(['Devastation', 1 - pr.devast / 100]);
    if (pr.controller !== nid) f.push(['Occupied', 0]);
    if (st.tax !== 1) f.push([`Stance: ${st.name}`, st.tax]);
    return { tax, taxFactors: f.map(([label, factor]) => ({ label, factor: r1(factor) })), income: this.provinceIncome(p, nid), unrest: this.explain_unrest(nid, p), slots: this.provinceSlots(p) };
  },
};
