// Treasury projects: priced gold sinks for the player (and later the AI).
// State: n.proj = { id: dayAvailable } is created lazily, so old saves need no back-fill.
// Mixed into Game.prototype (this = the game).

const PROJECTS = {
  cathedral: { icon: '⛪', name: 'Fund a cathedral', cost: 220, cool: 24, tip: '+20 prestige, +4 legitimacy and the clergy grow loyal (+8).' },
  scholars: { icon: '📚', name: 'Endow scholars', cost: 150, cool: 12, tip: 'Six months of research points at once.' },
  feast: { icon: '🍷', name: 'Feast the nobles', cost: 100, cool: 12, tip: 'Bribe the nobility: +12 loyalty with the nobles.' },
  sellswords: { icon: '🗡', name: 'Hire sellswords', cost: 160, cool: 6, tip: '+3,000 manpower in your reserve, ready to muster into regiments.' },
};

export const ProjectsMixin = {
  projectList(nid) {
    const n = this.s.nations[nid], day = this.s.day, out = [];
    for (const [id, d] of Object.entries(PROJECTS)) out.push({ id, ...d, cooldown: Math.max(0, Math.ceil(((n.proj?.[id] || 0) - day) / 30)), affordable: n.gold >= d.cost });
    const dp = this.cheapestDevelopment(nid);
    if (dp >= 0) out.push({ id: 'develop', icon: '🏘', name: `Develop ${this.provName(dp)}`, cost: this.developCost(dp), cooldown: 0, tip: '+1 development: more tax, manpower and building slots.', affordable: n.gold >= this.developCost(dp), p: dp });
    const k = ['iron', 'timber', 'horses'].sort((a, b) => n[a] - n[b])[0];
    out.push({ id: 'buy:' + k, icon: { iron: '⚒', timber: '🪵', horses: '🐎' }[k], name: `Buy 20 ${k}`, cost: Math.round(this.resourcePrice(nid, k) * 20), cooldown: 0, tip: `Your scarcest strategic good (${Math.floor(n[k])} in stock), bought from foreign merchants.`, affordable: n.gold >= Math.round(this.resourcePrice(nid, k) * 20) });
    return out;
  },
  cheapestDevelopment(nid) {
    let best = -1;
    for (const p of this.ownedProvinces(nid)) { const pr = this.s.prov[p]; if (pr.controller === nid && pr.dev < 30 && (best < 0 || pr.dev < this.s.prov[best].dev)) best = p; }
    return best;
  },
  // returns null on success or a reason string
  doProject(nid, id) {
    const n = this.s.nations[nid], day = this.s.day;
    if (id === 'develop') { const p = this.cheapestDevelopment(nid); return p < 0 ? 'Nothing to develop' : this.developProvince(nid, p); }
    if (id.startsWith('buy:')) return this.buyResource(nid, id.slice(4), 20);
    const d = PROJECTS[id];
    if (!d) return 'Unknown project';
    n.proj ||= {};
    if ((n.proj[id] || 0) > day) return `Available again in ${Math.ceil((n.proj[id] - day) / 30)} month(s)`;
    if (n.gold < d.cost) return `Need ${d.cost} gold`;
    n.gold -= d.cost; n.proj[id] = day + d.cool * 30;
    if (id === 'cathedral') { n.prestige += 20; n.legitimacy = Math.min(100, n.legitimacy + 4); this.estateDelta(n, 'clergy', 8); }
    else if (id === 'scholars') { if (n.prog) n.prog.pts += Math.max(10, (n.prog.rp || this.researchRate(nid)) * 6); }
    else if (id === 'feast') this.estateDelta(n, 'nobles', 12);
    else if (id === 'sellswords') n.manpower += 3000;
    return null;
  },
};
