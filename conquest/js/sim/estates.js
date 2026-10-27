// Estates: the loyalty and influence of nobles, clergy, burghers and peasants.
import { NATIONS } from '../data/nations.js';
import { GOVS, LAWS, COUNCIL_ROLES, ROLE_INFO } from '../data/government.js';
import { TRAITS, GEN_TRAIT_POOL, PERS_TRAIT_POOL } from '../data/traits.js';
import { groupOf, personName } from '../data/names.js';
import { BUILDINGS } from '../data/buildings.js';
import { clamp, dateOf, pick } from '../util.js';

export const EstatesMixin = {
  estateDelta(n, e, v) { if (n.estates[e]) n.estates[e].loyalty = clamp(n.estates[e].loyalty + v, 0, 100); },
  monthlyEstates(n) {
    const key = { nobles: 'nobleLoyalty', clergy: 'clergyLoyalty', burghers: 'burgherLoyalty', peasants: 'peasantLoyalty' };
    const base = GOVS[n.gov].estates;
    for (const [e, st] of Object.entries(n.estates)) {
      const target = 50 + this.mod(n.id, key[e]) + (n.stability * 3) + (e === 'nobles' && this.atWar(n.id) ? -3 : 0);
      st.loyalty = clamp(st.loyalty + (target - st.loyalty) * 0.03, 0, 100);
      let inf = base[e];
      for (const [cat, opt] of Object.entries(n.laws)) inf += LAWS[cat]?.options[opt]?.infl?.[e] || 0;
      inf += n.estateInfl?.[e] || 0;
      if (e === 'burghers') inf += Math.min(15, this.countBuildings(n.id, 'market') * 0.3);
      if (e === 'clergy') inf += Math.min(10, this.countBuildings(n.id, 'church') * 0.15);
      st.influence = clamp(st.influence + (inf - st.influence) * 0.1, 2, 80);
    }
    // estates in open revolt
    const no = n.estates.nobles;
    if (no && no.loyalty < 15 && no.influence > 40 && this.rng() < 0.05) {
      this.spawnRebels(this.ownedProvinces(n.id).filter((p) => p !== n.capital)[0] ?? n.capital, true);
      this.log(`The ${n.adj} nobility rises in revolt!`, { nation: n.id, type: 'war' });
    }
  },
};
