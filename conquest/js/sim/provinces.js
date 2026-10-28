// Province identity and the monthly choices a province offers: stance, building slots, what it is good at.
import { BUILDINGS, BUILDING_ORDER } from '../data/buildings.js';
import { STANCES, STANCE_ORDER, STANCE_COOLDOWN, slotsFor } from '../data/stances.js';
import { TERRAIN_ECON } from './economy.js';

export const ProvincesMixin = {
  provinceSlots(p) {
    const pr = this.s.prov[p];
    const queued = pr.queue.filter((q) => BUILDINGS[q.type].slot !== false).length;
    return { used: this.slotsUsed(p), queued, total: slotsFor(pr.dev), free: Math.max(0, slotsFor(pr.dev) - this.slotsUsed(p) - queued), nextAt: Math.ceil(((slotsFor(pr.dev) - 2) * 2.5)) };
  },
  stanceOptions(nid, p) {
    const pr = this.s.prov[p];
    const wait = Math.max(0, (pr.stanceDay ?? -9999) + STANCE_COOLDOWN - this.s.day);
    return STANCE_ORDER.map((k) => ({ id: k, ...STANCES[k], current: (pr.stance || 'balanced') === k, cost: this.stanceCost(p), wait }));
  },
  stanceCost(p) { return Math.round(5 + this.s.prov[p].dev * 0.6); },
  setStance(nid, p, stance) {
    const pr = this.s.prov[p], n = this.s.nations[nid];
    if (!STANCES[stance]) return 'Unknown stance';
    if (pr.owner !== nid || pr.controller !== nid) return 'Must own and control the province';
    if ((pr.stance || 'balanced') === stance) return 'Already in force';
    const wait = (pr.stanceDay ?? -9999) + STANCE_COOLDOWN - this.s.day;
    if (wait > 0) return `Province administration can change again in ${Math.ceil(wait / 30)} month(s)`;
    const c = this.stanceCost(p);
    if (n.gold < c) return `Need ${c} gold`;
    n.gold -= c;
    pr.stance = stance === 'balanced' ? undefined : stance; pr.stanceDay = this.s.day;
    this.emit('province', p);
    return null;
  },
  // What a province is good at, for the "identity" line: [{ tag, text }]
  provinceIdentity(p) {
    const pr = this.s.prov[p], sp = this.map.provinces[p], te = TERRAIN_ECON[sp.terrain], out = [];
    if (te.food >= 2) out.push({ tag: 'food', text: 'Breadbasket: rich fields feed armies and towns' });
    if (sp.terrain === 'mountains' || sp.terrain === 'hills') out.push({ tag: 'iron', text: 'Ore-bearing hills: mines, iron and a natural fortress' });
    if (te.timber) out.push({ tag: 'timber', text: 'Forest: timber for ships and siege engines' });
    if (te.horses >= 0.5) out.push({ tag: 'horses', text: 'Grazing land: horses for cavalry' });
    if (sp.river > 0.03) out.push({ tag: 'river', text: 'River: tolls, fertile soil, hard to cross in war' });
    if (sp.coastal) out.push({ tag: 'coast', text: 'Coast: harbours, trade and sea raids' });
    if (sp.imp >= 2) out.push({ tag: 'town', text: 'Town: markets and a wealthier population' });
    if (pr.dev >= 10) out.push({ tag: 'core', text: 'Densely settled heartland' });
    if (te.move <= 0.65) out.push({ tag: 'rough', text: 'Difficult terrain: slow marching, strong defence' });
    return out;
  },
  provinceInfo(p) {
    const pr = this.s.prov[p], sp = this.map.provinces[p], n = this.s.nations[pr.owner];
    return {
      id: p, name: sp.name, terrain: sp.terrain, dev: pr.dev, culture: pr.culture, religion: pr.religion, owner: pr.owner, controller: pr.controller,
      foreignCulture: !!n && pr.culture !== n.culture, foreignFaith: !!n && pr.religion !== n.religion,
      stance: pr.stance || 'balanced', slots: this.provinceSlots(p), identity: this.provinceIdentity(p), buildings: Object.entries(pr.buildings).map(([k, v]) => ({ id: k, name: BUILDINGS[k]?.name || k, level: v })),
      income: n ? this.provinceIncome(p, pr.owner) : null, unrest: pr.unrest, fort: this.fortLevel(p),
    };
  },
  // The AI chooses stances for its provinces: border provinces fortify when threatened, rich realms settle, poor ones tax.
  aiStances(n) {
    const s = this.s, threatened = this.atWar(n.id) || n.warExhaustion > 1;
    const border = new Set(this.borderProvinces(n.id));
    let k = 0;
    for (const p of this.ownedProvinces(n.id)) {
      const pr = s.prov[p];
      if (pr.controller !== n.id || (pr.stanceDay ?? -9999) + STANCE_COOLDOWN > s.day || ((p + s.day) & 7)) continue;
      let want = 'balanced';
      if (n.gold < 15 && n.food >= 0) want = 'tax';
      else if (n.food < -10) want = 'stockpile';
      else if (border.has(p) && threatened && pr.dev >= 6) want = n.manpower < n.maxManpower * 0.4 ? 'levy' : 'fortify';
      else if (n.gold > 150 && !threatened && pr.unrest < 15 && pr.dev < 12) want = 'grow';
      else if (p === n.capital) want = 'balanced';
      const cur = pr.stance || 'balanced';
      if (want !== cur && n.gold > this.stanceCost(p) && ++k < 4) this.setStance(n.id, p, want);
    }
  },
};
