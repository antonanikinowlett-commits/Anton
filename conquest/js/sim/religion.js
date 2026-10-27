// Religion basics: active conversion of provinces, heresy outbreaks and their suppression.
// pr.conv = { left } (months of missionary work), pr.heresy = true. Unrest from heresy is added in economy.js.
import { clamp } from '../util.js';

const CONVERT_COST = 40, SUPPRESS_COST = 30;

export const ReligionMixin = {
  conversionMonths(nid, p) {
    const pr = this.s.prov[p], n = this.s.nations[nid];
    const clergy = n.estates.clergy ? n.estates.clergy.loyalty : 50;
    return Math.max(6, Math.round(30 - (pr.buildings.church || 0) * 4 - (clergy - 50) / 10 - this.mod(nid, 'legitimacyMonthly') * 20));
  },
  startConversion(nid, p) {
    const s = this.s, n = s.nations[nid], pr = s.prov[p];
    if (!pr || pr.owner !== nid) return 'Not our province';
    if (pr.religion === n.religion) return 'Already of our faith';
    if (pr.conv) return 'Missionaries are already at work';
    if (n.gold < CONVERT_COST) return `Missionaries cost ${CONVERT_COST} gold`;
    n.gold -= CONVERT_COST;
    pr.conv = { left: this.conversionMonths(nid, p) };
    return null;
  },
  suppressHeresy(nid, p) {
    const s = this.s, n = s.nations[nid], pr = s.prov[p];
    if (!pr || pr.owner !== nid || !pr.heresy) return 'No heresy here';
    if (n.gold < SUPPRESS_COST) return `An inquisition costs ${SUPPRESS_COST} gold`;
    n.gold -= SUPPRESS_COST;
    pr.heresy = false; pr.unrest = clamp(pr.unrest + 6, 0, 100);
    this.papalFavorChange(nid, 2);
    return null;
  },
  monthlyReligion() {
    const s = this.s, P = this.map.provinces;
    const heretic = new Map();
    for (let p = 0; p < this.L; p++) {
      const pr = s.prov[p];
      const n = s.nations[pr.owner];
      if (!n || !n.alive) { pr.conv = null; continue; }
      if (pr.conv) {
        pr.conv.left--;
        if (pr.religion === n.religion) pr.conv = null;
        else if (pr.conv.left <= 0) { pr.religion = n.religion; pr.conv = null; pr.unrest = clamp(pr.unrest - 10, 0, 100); this.emit('province', p); }
      }
      if (pr.heresy) {
        if (this.rng() < 0.004 * (1 + (pr.buildings.church || 0))) pr.heresy = false;
        else if (this.rng() < 0.03) { const e = P[p].adj[Math.floor(this.rng() * P[p].adj.length)]; if (e && e.id < this.L && s.prov[e.id].owner === pr.owner && !s.prov[e.id].heresy) heretic.set(e.id, 1); }
      }
    }
    for (const p of heretic.keys()) s.prov[p].heresy = true;
    for (const n of s.nations) {
      if (!n.alive || n.ai.horde) continue;
      const christian = n.religion === 'catholic' || n.religion === 'orthodox';
      const clergy = n.estates.clergy ? n.estates.clergy.loyalty : 50;
      // outbreaks: loosely governed churches breed preachers
      if (christian && clergy < 60 && this.rng() < 0.08 + (60 - clergy) * 0.004) {
        const ps = this.ownedProvinces(n.id).filter((p) => !s.prov[p].heresy && s.prov[p].religion === n.religion);
        if (ps.length) {
          const p = ps[Math.floor(this.rng() * ps.length)];
          s.prov[p].heresy = true;
          if (n.id === s.player) this.notify({ nation: n.id, title: 'Heresy', icon: '📕', text: `Heretical preaching has taken hold in ${this.provName(p)}.`, prov: p });
        }
      }
      if (n.id === s.player) continue;
      // AI: convert foreign-faith provinces and root out heresy when it can afford to
      if (n.gold > 90 && this.rng() < 0.3) {
        const own = this.ownedProvinces(n.id);
        const h = own.find((p) => s.prov[p].heresy);
        if (h !== undefined) this.suppressHeresy(n.id, h);
        else { const c = own.filter((p) => s.prov[p].religion !== n.religion && !s.prov[p].conv); if (c.length) this.startConversion(n.id, c[Math.floor(this.rng() * c.length)]); }
      }
    }
  },
};
