// Subject realms: autonomy, tribute scaling, independence wars and integration.
// v.autonomy (0-100) and v.vassalSince are set when a realm becomes a vassal; v.integrating = { left } months.
import { clamp } from '../util.js';

const INTEGRATE_YEARS = 10, INTEGRATE_MONTHS = 12;

export const VassalsMixin = {
  vassalsOf(nid) { return this.s.nations.filter((x) => x.alive && x.overlord === nid); },
  vassalStart(v, overlord) { v.autonomy = 40; v.vassalSince = this.s.day; v.integrating = null; },
  tributeFactor(vid) { const v = this.s.nations[vid]; return clamp(1.5 - (v.autonomy ?? 50) / 100, 0.5, 1.5); },
  integrationStatus(aid, bid) {
    const s = this.s, v = s.nations[bid];
    if (!v?.alive || v.overlord !== aid) return 'Not our vassal';
    if (v.integrating) return 'Integration already under way';
    if (s.day - (v.vassalSince ?? 0) < INTEGRATE_YEARS * 365) return `Vassal for ${Math.floor((s.day - (v.vassalSince ?? 0)) / 365)} of ${INTEGRATE_YEARS} years`;
    if ((v.autonomy ?? 50) > 50) return `Autonomy ${Math.round(v.autonomy)}% (must be at most 50%)`;
    if (s.nations[aid].prestige < 30) return 'Needs 30 prestige';
    return null;
  },
  integrateVassal(aid, bid) {
    const why = this.integrationStatus(aid, bid);
    if (why) return why;
    this.s.nations[aid].prestige -= 30;
    this.s.nations[bid].integrating = { left: INTEGRATE_MONTHS };
    this.log(`The ${this.s.nations[aid].name} begins to integrate the ${this.s.nations[bid].name}.`, { nation: aid, type: 'diplo' });
    return null;
  },
  strengthenControl(aid, bid) {
    const a = this.s.nations[aid], v = this.s.nations[bid];
    if (!v?.alive || v.overlord !== aid) return 'Not our vassal';
    if (a.gold < 40) return 'Needs 40 gold';
    a.gold -= 40; v.autonomy = clamp((v.autonomy ?? 50) - 15, 0, 100);
    v.opinion[aid] = (v.opinion[aid] ?? 0) - 10;
    return null;
  },
  monthlyVassals() {
    const s = this.s;
    for (const v of s.nations) {
      if (!v.alive || v.overlord < 0) continue;
      const o = s.nations[v.overlord];
      if (!o?.alive) { v.overlord = -1; continue; }
      if (v.autonomy === undefined) this.vassalStart(v, o);
      // autonomy creeps up, faster when the overlord is weak or distracted
      let d = 0.4;
      if (o.legitimacy < 40) d += 0.4;
      if (o.gold < 0) d += 0.2;
      if (this.atWar(o.id)) d += 0.2;
      if (this.power(o.id) < this.power(v.id) * 1.5) d += 0.3;
      if (v.opinion[o.id] < -20) d += 0.2;
      v.autonomy = clamp(v.autonomy + d, 0, 100);
      if (v.integrating) {
        if (--v.integrating.left <= 0) { this._finishIntegration(o.id, v.id); continue; }
      } else if (v.autonomy > 85 && this.rng() < 0.08 && !this.atWar(v.id, o.id)) {
        this._vassalRebels(v, o);
        continue;
      }
      if (o.id !== s.player) {
        if (v.autonomy > 70 && o.gold > 80 && this.rng() < 0.3) this.strengthenControl(o.id, v.id);
        else if (!v.integrating && !this.integrationStatus(o.id, v.id) && this.rng() < 0.05) this.integrateVassal(o.id, v.id);
      }
    }
  },
  _vassalRebels(v, o) {
    v.overlord = -1; v.autonomy = undefined; v.integrating = null;
    this.log(`The ${v.name} throws off the yoke of the ${o.name}!`, { nation: v.id, type: 'war', important: o.id === this.s.player });
    if (o.id === this.s.player) this.notify({ nation: o.id, title: 'Vassal rebels', icon: '⚔', text: `The ${v.name} has declared independence from us!` });
    this.declareWar(v.id, o.id, { kind: 'conquest' }, true);
  },
  _finishIntegration(aid, bid) {
    const s = this.s, v = s.nations[bid], a = s.nations[aid];
    for (const p of [...this.ownedProvinces(bid)]) this.setOwner(p, aid);
    v.integrating = null; v.overlord = -1;
    a.prestige += 20;
    this.log(`The ${v.name} is integrated into the ${a.name}.`, { nation: aid, type: 'diplo', important: aid === s.player });
    if (v.alive) this.annihilate(bid);
  },
};
