// Objectives for the player: tracking, completion rewards. State: n.obj = { base, done:[ids], day:{id:dayDone} }.
import { OBJECTIVES, OBJ, objectiveSnap } from '../data/objectives.js';

export const ObjectivesMixin = {
  initObjectives() {
    const n = this.s.nations[this.s.player];
    if (n && n.alive && !n.obj) n.obj = { base: objectiveSnap(this, n), done: [], day: {} };
  },
  // [{ id, icon, title, desc, tab, value, goal, done, active, rewardText }]: done ones first (newest), then active (max 3), then locked
  objectives(nid) {
    const n = this.s.nations[nid];
    if (!n.obj) n.obj = { base: objectiveSnap(this, n), done: [], day: {} };
    const out = [];
    let active = 0;
    for (const o of OBJECTIVES) {
      const done = n.obj.done.includes(o.id);
      const unlocked = (o.after || []).every((x) => n.obj.done.includes(x));
      const pr = o.test(this, n, n.obj.base);
      const isActive = !done && unlocked && active < 3;
      if (isActive) active++;
      out.push({ id: o.id, icon: o.icon, title: o.title, desc: o.desc, tab: o.tab, value: pr.value, goal: pr.goal, done, active: isActive, locked: !done && !unlocked, rewardText: o.rewardText, doneDay: n.obj.day[o.id] });
    }
    return out;
  },
  monthlyObjectives() {
    const s = this.s, n = s.nations[s.player];
    if (!n || !n.alive) return;
    if (!n.obj) this.initObjectives();
    if (!n.obj.briefed && s.day >= 20) {
      // the opening briefing: the one threat and the best openings, once
      n.obj.briefed = s.day;
      const thr = this.threats(n.id).find((t) => t.level >= 0.8), opp = this.opportunities(n.id).filter((o) => o.kind === 'war' || o.kind === 'alliance').slice(0, 2);
      const bits = [];
      if (thr) bits.push(`Danger: ${s.nations[thr.nation].name} (${thr.why.join(', ') || 'hostile'}).`);
      for (const o of opp) bits.push(`Opening: ${o.text}.`);
      if (bits.length) this.notify({ nation: n.id, title: 'Counsel from the court', icon: '🧭', text: bits.join(' ') + ' See Progress → Objectives.' });
    }
    for (const o of this.objectives(n.id)) {
      if (!o.active || o.value < o.goal) continue;
      n.obj.done.push(o.id); n.obj.day[o.id] = s.day;
      this.applyEffects(n.id, OBJ[o.id].reward, 'objective:' + o.id);
      this.log(`Objective complete: ${o.title} (${o.rewardText}).`, { nation: n.id, important: true });
      this.notify({ nation: n.id, title: 'Objective complete', icon: o.icon, text: `${o.title}: ${o.rewardText}` });
    }
  },
};
