// A living world: what the AI realms do (news), what they do to the player (ultimatums, coalitions, proposals),
// and what is on offer (opportunities / threats). Everything the player must answer is an ordinary event in
// s.eventQueue whose definition lives in s.dynEvents (so it is saved with the game).
//   s.news        [{ day, kind, text, nations:[ids] }]  newest first
//   s.dynEvents   { id: { title, icon, desc, options:[{ text, effects, ai? }] } }
//   s.coalitions  [{ id, target, members:[ids], day, strike }]
import { clamp, dateOf } from '../util.js';

const NEWS_TYPES = { war: 'war', diplo: 'diplomacy', court: 'dynasty' };

export const WorldMixin = {
  initWorld() {
    const s = this.s;
    s.news ||= []; s.dynEvents ||= {}; s.coalitions ||= [];
    for (const w of Object.values(s.wars)) if (!w.goals) this.pickWarGoals(w);
    for (const n of s.nations) n.world ||= { lastUltimatum: -9999, ultimatums: 0, lastProposal: -9999, coalCool: -9999 };
  },
  // ── news feed
  pushNews(text, opts = {}, kind) {
    const s = this.s;
    if (/honours the call to arms|embargo|guarantees the independence/.test(text)) return;
    const k = kind || (/^(Revolt!|A pretender|The rebels)/.test(text) ? 'unrest' : NEWS_TYPES[opts.type]) || 'world';
    s.news ||= [];
    const last = s.news[0];
    if (last && last.text === text && s.day - last.day < 5) return;
    s.news.unshift({ day: s.day, kind: k, text, nations: opts.nation !== undefined ? [opts.nation] : [], important: !!opts.important });
    if (s.news.length > 300) s.news.length = 300;
    this.emit('news');
  },
  // opts: { limit, kinds:[...], nation, since }
  newsFeed(opts = {}) {
    const { limit = 40, kinds, nation, since = -1 } = opts;
    return this.s.news.filter((x) => x.day >= since && (!kinds || kinds.includes(x.kind)) && (nation === undefined || x.nations.includes(nation))).slice(0, limit);
  },

  // ── dynamic events
  // def: { title, icon, desc, options:[{ text, effects, ai }] }. The player gets a popup; an AI realm takes the option with the best `ai` weight.
  queueEvent(nid, def) {
    const s = this.s, id = 'dyn' + this.newId();
    s.dynEvents[id] = def;
    if (nid === s.player) { s.eventQueue.push({ id }); this.emit('event'); }
    else { const o = [...def.options].sort((a, b) => (b.ai ?? 0) - (a.ai ?? 0))[0]; if (o) this.applyEffects(nid, o.effects, 'event:' + id); delete s.dynEvents[id]; }
    return id;
  },
  gcDynEvents() {
    const live = new Set(s_ids(this.s.eventQueue));
    for (const k of Object.keys(this.s.dynEvents)) if (!live.has(k) && !(this.s.eventLater || []).some((x) => x.id === k)) delete this.s.dynEvents[k];
  },

  // ── threats and opportunities (data for the UI and for onboarding)
  threats(nid) {
    const s = this.s, n = s.nations[nid], myPow = this.power(nid), out = [];
    for (const o of this.neighbours(nid)) {
      const on = s.nations[o];
      if (!on?.alive || n.allies.includes(o) || on.overlord >= 0 || n.overlord === o) continue;
      const ratio = (this.power(o) + on.allies.reduce((t, x) => t + this.power(x) * 0.3, 0)) / Math.max(1, myPow);
      const truce = Math.max(0, (n.truces[o] || 0) - s.day);
      const cbs = this.cbsAgainst(o, nid).filter((c) => c !== 'conquest');
      const hostile = this.opinion(o, nid) < 0 || cbs.length > 0;
      const level = truce > 0 ? 0 : clamp((ratio - 0.6) * 1.2 + (cbs.length ? 0.5 : 0) + (hostile ? 0.3 : 0) + (on.ai.aggro - 0.5), 0, 3);
      out.push({ nation: o, ratio: Math.round(ratio * 100) / 100, cbs, truceDays: truce, opinion: Math.round(this.opinion(o, nid)), level: Math.round(level * 100) / 100, why: [ratio > 1 ? `${Math.round(ratio * 100)}% of our strength` : '', cbs.length ? `casus belli: ${cbs.join(', ')}` : '', truce ? `truce for ${Math.round(truce / 30)} more months` : ''].filter(Boolean) });
    }
    return out.sort((a, b) => b.level - a.level);
  },
  opportunities(nid) {
    const s = this.s, n = s.nations[nid], myPow = this.power(nid), out = [];
    if (n.prog && !n.prog.cur && this.hasResearchOptions(nid)) out.push({ kind: 'research', text: 'Choose an innovation to research', tab: 'progress' });
    if (!n.focus.cur && this.focusTree(nid).some((f) => this.focusStatus(nid, f) === 'available')) out.push({ kind: 'focus', text: 'Start a national focus', tab: 'focus' });
    if (n.gold > 150) out.push({ kind: 'gold', text: `${Math.round(n.gold)} gold idle: build, develop a province or hire`, tab: 'build' });
    for (const o of this.neighbours(nid)) {
      const on = s.nations[o];
      if (!on?.alive || (n.truces[o] || 0) > s.day || n.allies.includes(o) || on.overlord >= 0 || n.overlord >= 0) continue;
      const ratio = myPow / Math.max(1, this.power(o) + on.allies.reduce((t, x) => t + this.power(x) * 0.3, 0));
      const cbs = this.cbsAgainst(nid, o);
      const claim = cbs.includes('claim');
      if (ratio > 1.6 && (claim || cbs.length > 1)) out.push({ kind: 'war', nation: o, ratio: Math.round(ratio * 100) / 100, cbs, text: `${on.name} is weak (we are ${Math.round(ratio * 100)}% of their strength)${claim ? ' and we hold claims' : ''}` });
      else if (this.atWar(o) && ratio > 1.1 && cbs.length > 1) out.push({ kind: 'war', nation: o, ratio: Math.round(ratio * 100) / 100, cbs, text: `${on.name} is busy fighting elsewhere` });
    }
    for (const o of s.nations) {
      if (!o.alive || o.id === nid || o.overlord >= 0) continue;
      if (!n.allies.includes(o.id) && n.allies.length < 3 && this.neighbours(nid).some((x) => this.neighbours(o.id).includes(x)) && this.acceptance(nid, o.id, 'alliance')[0] > 5) { out.push({ kind: 'alliance', nation: o.id, text: `${o.name} would accept an alliance` }); break; }
    }
    return out.slice(0, 8);
  },

  // ── the monthly director
  monthlyWorld() {
    const s = this.s;
    this.initWorld();
    this.monthlyCoalitions();
    const p = s.nations[s.player];
    if (p && p.alive) { this.monthlyUltimatums(p); this.monthlyProposals(p); }
    this.gcDynEvents();
  },

  // Strong neighbours lean on the player. A passive realm is rarely attacked out of the blue, so they send demands first.
  monthlyUltimatums(p) {
    const s = this.s, w = p.world, hard = s.difficulty === 'hard';
    const gap = (hard ? 12 : 22) * 30;
    if (!w.warned && s.day >= (hard ? 40 : 60) && !this.atWar(p.id)) {
      const t0 = this.threats(p.id).find((t) => t.truceDays === 0 && t.ratio >= (hard ? 0.8 : 1.0));
      if (t0) { w.warned = s.day; const X0 = s.nations[t0.nation]; this.notify({ title: 'A shadow on the border', icon: '🛡', text: `${X0.name} commands ${Math.round(t0.ratio * 100)}% of our strength${t0.cbs.length ? ' and holds a casus belli against us' : ''}. Expect demands within months: raise levies, seek allies, or fortify.` }); this.pushNews(`${X0.name} eyes ${p.name}.`, { type: 'diplo', nation: p.id }); }
    }
    if (s.day < (hard ? 100 : 130) || s.day - w.lastUltimatum < gap || this.atWar(p.id) || p.overlord >= 0) return;
    const first = w.ultimatums === 0;
    if (!first && this.rng() > (hard ? 0.4 : 0.22)) return;
    const myPow = this.power(p.id);
    const cands = this.threats(p.id).filter((t) => t.truceDays === 0 && t.ratio >= (hard ? 0.8 : 1.0) && !this.atWar(t.nation) && s.nations[t.nation].stability >= 0 && s.nations[t.nation].religion !== undefined);
    if (!cands.length) return;
    const t = cands[0], X = s.nations[t.nation];
    w.lastUltimatum = s.day; w.ultimatums++;
    const B = this.budget(p.id);
    const demand = Math.round(clamp(Math.max(B.income, 10) * (first ? 5 : 8) * (1 + 0.25 * (w.paid || 0)), 40, 900));
    const claimed = this.ownedProvinces(p.id).filter((q) => s.prov[q].claims.includes(X.id));
    const cb = t.cbs[0] || 'conquest';
    const allyPow = p.allies.reduce((a, x) => a + this.power(x), 0);
    const canAppeal = p.allies.length && (allyPow + myPow) >= this.power(X.id) * 0.9;
    const opts = [
      { text: `Pay ${demand} gold and swallow the insult`, ai: 1, effects: [{ gold: -demand }, { transfer: { to: X.id, gold: demand } }, { prestige: -15 }, { legitimacy: -3 }, { truce: { with: X.id, days: 1095 } }, { oppOf: { with: X.id, v: 25 } }, { custom: 'paid' }] },
      { text: `Defy ${X.name}: let them come`, ai: 0, effects: [{ prestige: 5 }, { war: { by: X.id, cb } }] },
    ];
    if (canAppeal) opts.splice(1, 0, { text: `Show them our allies (${p.allies.map((x) => s.nations[x].adj).join(', ')} stand with us)`, ai: 0, effects: [{ prestige: 8 }, { truce: { with: X.id, days: 730 } }, { oppOf: { with: X.id, v: -15 } }] });
    if (!p.marriages.includes(X.id) && this.acceptance(p.id, X.id, 'marriage')[0] > -20) opts.push({ text: `Offer a royal marriage instead`, ai: 0, effects: [{ marry: { with: X.id } }, { truce: { with: X.id, days: 1825 } }, { oppOf: { with: X.id, v: 30 } }, { gold: -Math.round(demand * 0.3) }] });
    this.queueEvent(p.id, {
      title: `${X.name} makes demands`, icon: '📜',
      desc: `Envoys of the ${X.name} arrive with a cold message. They command ${t.ratio >= 1 ? Math.round(t.ratio * 100) + '% of our strength' : 'a host we cannot ignore'} and ${claimed.length ? 'press their claims' : 'speak of the old injustices between our realms'}. They demand ${demand} gold as "compensation", or there will be war.`, options: opts,
    });
    this.pushNews(`${X.name} sends an ultimatum to ${p.name}.`, { type: 'diplo', nation: p.id });
  },

  // Friendly realms propose treaties to the player.
  monthlyProposals(p) {
    const s = this.s, w = p.world;
    if (s.day < 200 || s.day - w.lastProposal < 240 || this.rng() > 0.18) return;
    const cands = s.nations.filter((o) => o.alive && o.id !== p.id && o.overlord < 0 && !o.ai.horde && !this.atWar(o.id, p.id) && !p.allies.includes(o.id) && (this.neighbours(p.id).includes(o.id) || this.neighbours(p.id).some((x) => this.neighbours(o.id).includes(x))) && this.opinion(o.id, p.id) > 10 && this.power(o.id) > this.power(p.id) * 0.35);
    if (!cands.length) return;
    const o = cands[Math.floor(this.rng() * cands.length)];
    w.lastProposal = s.day;
    const enemies = this.enemiesOf(o.id).map((x) => s.nations[x].name);
    const married = p.marriages.includes(o.id);
    const opts = [];
    if (p.allies.length < 4 && !(p.noAlly?.[o.id] > s.day)) opts.push({ text: `Accept: an alliance${married ? '' : ' sealed by a marriage'}`, effects: [{ ally: { with: o.id } }, ...(married || this.acceptance(p.id, o.id, 'marriage')[0] < -20 ? [] : [{ marry: { with: o.id } }]), { prestige: 5 }] });
    opts.push({ text: 'Decline politely', effects: [{ oppOf: { with: o.id, v: -5 } }] });
    this.queueEvent(p.id, {
      title: `${o.name} seeks friendship`, icon: '🤝',
      desc: `Envoys of the ${o.name} propose a pact. "${this.power(o.id) > this.power(p.id) ? 'Our' : 'Your'} swords together would be a shield for both our crowns."${enemies.length ? ` They are at war with ${enemies.join(', ')}.` : ''} An ally can be called to war, and will call on us in turn.`, options: opts,
    });
  },

  // An ally calls the player to war: the player chooses. Declining a call in the middle of a war costs honour.
  queueAllyCall(w, nid, side, callerId, urgent) {
    const s = this.s, c = s.nations[callerId];
    const pw = (s.nations[nid].world ||= {}); pw.asked ||= {};
    if (pw.asked[w.id + ':' + callerId]) return;
    if (!urgent && s.day - (pw.lastCall ?? -9999) < 180) return;
    pw.asked[w.id + ':' + callerId] = s.day; pw.lastCall = s.day;
    for (const k of Object.keys(pw.asked)) if (!s.wars[k.split(':')[0]]) delete pw.asked[k];
    const foes = (side === 'att' ? w.def : w.att).map((x) => s.nations[x].name).join(', ');
    this.queueEvent(nid, {
      title: `${c.name} calls us to war`, icon: '⚔',
      desc: `Our ally the ${c.name} is ${side === 'def' ? 'attacked' : 'marching to war'} (${w.name}) and asks us to honour the alliance. Our enemies would be: ${foes}.`,
      options: [
        { text: 'Honour the alliance: join the war', ai: 1, effects: [{ joinWar: { war: w.id, side } }, { prestige: 8 }, { oppOf: { with: callerId, v: 25 } }] },
        { text: 'Decline and break the alliance', ai: 0, effects: [{ breakAlliance: { with: callerId } }] },
      ],
    });
  },

  // ── coalitions: realms that fear a conqueror gang up on it
  monthlyCoalitions() {
    const s = this.s;
    s.coalitions = s.coalitions.filter((c) => s.nations[c.target]?.alive);
    for (const c of [...s.coalitions]) {
      c.members = c.members.filter((m) => s.nations[m]?.alive);
      if (c.members.length < 2) { s.coalitions.splice(s.coalitions.indexOf(c), 1); continue; }
      if (s.day >= c.strike) this.coalitionStrike(c);
    }
    if (dateOf(s.day).m % 2) return; // every other month is plenty
    for (const T of s.nations) {
      if (!T.alive || T.ai.horde || s.coalitions.some((c) => c.target === T.id) || s.day - (T.world?.coalCool ?? -9999) < 365 * 4) continue;
      const mem = s.nations.filter((o) => o.alive && o.id !== T.id && !o.ai.horde && o.overlord < 0 && (o.ae[T.id] || 0) >= 22 && this.opinion(o.id, T.id) < -20 && !this.isAlly(o.id, T.id) && !this.atWar(o.id, T.id) && (o.truces[T.id] || 0) < s.day && this.neighbours(T.id).includes(o.id));
      if (mem.length < 2) continue;
      const combined = mem.reduce((t, o) => t + this.power(o.id), 0);
      if (combined < this.power(T.id) * 0.7) continue;
      const c = { id: this.newId(), target: T.id, members: mem.map((o) => o.id), day: s.day, strike: s.day + 90 + Math.floor(this.rng() * 90) };
      s.coalitions.push(c);
      T.world ||= {}; T.world.coalCool = s.day;
      this.log(`A coalition forms against ${T.name}: ${mem.map((o) => o.name).join(', ')}.`, { nation: T.id, type: 'diplo', important: T.id === s.player });
      if (T.id === s.player) this.queueCoalitionEvent(c);
    }
  },
  queueCoalitionEvent(c) {
    const s = this.s, T = s.nations[c.target];
    const members = c.members.map((m) => s.nations[m]);
    const cost = Math.round(members.length * 70 + this.budget(T.id).income * 2);
    this.queueEvent(T.id, {
      title: 'A coalition forms against us', icon: '🛡',
      desc: `Our conquests have frightened our neighbours. ${members.map((m) => m.name).join(', ')} have sworn to act together. In about ${Math.round((c.strike - s.day) / 30)} months they will strike unless something is done.`,
      options: [
        { text: `Buy them off with gifts (${cost} gold, ends the coalition)`, effects: [{ gold: -cost }, { oppOf: { withAll: c.members, v: 40 } }, { custom: 'dissolve:' + c.id }] },
        { text: 'Prepare for war: raise levies and fortify the border', effects: [{ manpower: 3000 }, { loyalty: { nobles: -4 } }, { mods_t: { mods: { fortDefense: 0.15, armyMorale: 0.05 }, months: 18 } }] },
        { text: 'Let them come', effects: [{ prestige: 5 }] },
      ],
    });
  },
  coalitionStrike(c) {
    const s = this.s, T = s.nations[c.target];
    s.coalitions.splice(s.coalitions.indexOf(c), 1);
    const members = c.members.map((m) => s.nations[m]).filter((o) => o.alive && !this.isAlly(o.id, T.id) && !this.atWar(o.id, T.id) && (o.truces[T.id] || 0) < s.day).sort((a, b) => this.power(b.id) - this.power(a.id));
    if (members.length < 2) return;
    if (members.reduce((t, o) => t + this.power(o.id), 0) < this.power(T.id) * 0.7) return;
    const lead = members[0];
    const why = this.declareWar(lead.id, T.id, { kind: 'coalition' }, true);
    if (why) return;
    const w = this.warBetween(lead.id, T.id);
    for (const o of members.slice(1)) if (w) this.joinWar(w, o.id, 'att');
    for (const o of members) this.aiMobilize(o);
    this.pushNews(`The coalition strikes: ${members.map((o) => o.name).join(', ')} march against ${T.name}.`, { type: 'war', nation: T.id, important: T.id === this.s.player }, 'war');
  },
};
function s_ids(q) { return q.map((x) => x.id); }
