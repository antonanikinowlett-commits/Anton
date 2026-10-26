// Relations, treaties, casus belli, war declaration, war score and peace treaties.
import { clamp } from '../util.js';

const CHRISTIAN = ['catholic', 'orthodox', 'armenian'];
const relGroup = (r) => (CHRISTIAN.includes(r) ? 'christian' : r === 'sunni' ? 'islam' : 'pagan');

export const CB_TYPES = {
  claim: { name: 'Reconquest of Claims', desc: 'We hold claims on their provinces.', ae: 1, stab: 0 },
  holy_war: { name: 'Holy War', desc: 'War against the enemies of the faith.', ae: 0.6, stab: 0 },
  subjugation: { name: 'Subjugation of Heathens', desc: 'Bring the pagans to heel.', ae: 0.5, stab: 0 },
  reconquista: { name: 'Reconquista', desc: 'Retake Iberia for Christendom.', ae: 0.5, stab: 0 },
  insult: { name: 'Avenge Insult', desc: 'They insulted our honour.', ae: 1.2, stab: 0 },
  conquest: { name: 'War of Conquest', desc: 'No justification. -1 stability, -15 legitimacy, double aggressive expansion.', ae: 2, stab: -1 },
};

export const DiplomacyMixin = {
  warPairs() {
    if (this._wp) return this._wp;
    const wp = new Set();
    for (const w of Object.values(this.s.wars)) for (const a of w.att) for (const d of w.def) { wp.add(a * 1000 + d); wp.add(d * 1000 + a); }
    return (this._wp = wp);
  },
  atWar(a, b) {
    if (b === undefined) return Object.values(this.s.wars).some((w) => w.att.includes(a) || w.def.includes(a));
    if (a < 0 || b < 0) return false;
    return this.warPairs().has(a * 1000 + b);
  },
  warBetween(a, b) { return Object.values(this.s.wars).find((w) => (w.att.includes(a) && w.def.includes(b)) || (w.def.includes(a) && w.att.includes(b))); },
  warsOf(nid) { return Object.values(this.s.wars).filter((w) => w.att.includes(nid) || w.def.includes(nid)); },
  enemiesOf(nid) { const r = new Set(); for (const w of this.warsOf(nid)) for (const x of w.att.includes(nid) ? w.def : w.att) r.add(x); return [...r]; },
  isAlly(a, b) { const n = this.s.nations[a]; return !!n && b >= 0 && n.allies.includes(b); },
  isSubjectOf(a, b) { const n = this.s.nations[a]; return !!n && b >= 0 && n.overlord === b; },
  neighbours(nid) {
    const r = new Set();
    for (const p of this.ownedProvinces(nid)) for (const e of this.map.provinces[p].adj) {
      if (e.id >= this.L) continue;
      const o = this.s.prov[e.id].owner;
      if (o >= 0 && o !== nid) r.add(o);
    }
    return [...r];
  },
  relGroup,

  baseOpinion(a, b) {
    let v = 0;
    if (a.religion === b.religion) v += 20;
    else if (relGroup(a.religion) === relGroup(b.religion)) v -= 5;
    else v -= 35;
    if (a.group === b.group) v += 10;
    if (a.gov === b.gov) v += 5;
    return v;
  },
  opinionBreakdown(aid, bid) {
    // how a feels about b
    const a = this.s.nations[aid], b = this.s.nations[bid];
    const parts = [];
    const base = this.baseOpinion(a, b);
    parts.push(['Faith & culture', base]);
    const drift = Math.round((a.opinion[bid] ?? base) - base);
    if (drift) parts.push(['Relations', drift]);
    if (a.allies.includes(bid)) parts.push(['Alliance', 40]);
    if (a.marriages.includes(bid)) parts.push(['Royal marriage', 25]);
    if (a.naps.includes(bid)) parts.push(['Non-aggression pact', 10]);
    if (this.atWar(aid, bid)) parts.push(['At war', -100]);
    if (a.overlord === bid) parts.push(['Overlord', -15]);
    if (b.overlord === aid) parts.push(['Vassal', 20]);
    const ae = a.ae[bid] || 0;
    if (ae > 1) parts.push(['Aggressive expansion', -Math.round(ae)]);
    const claims = this.ownedProvinces(aid).filter((p) => this.s.prov[p].claims.includes(bid)).length;
    if (claims) parts.push(['Claims on our land', -Math.min(40, 10 + claims * 3)]);
    if (this.neighbours(aid).includes(bid)) parts.push(['Border friction', -8]);
    if (a.truces[bid] > this.s.day) parts.push(['Recent war', -20]);
    const dd = a.dip;
    if (dd?.betrayed?.[bid] > this.s.day) parts.push(['Betrayed an ally', -30]);
    if (dd?.guar?.includes(bid)) parts.push(['We guarantee them', 15]);
    if (b.dip?.guar?.includes(aid)) parts.push(['Guaranteed by them', 20]);
    if (b.dip?.tribute?.to === aid && b.dip.tribute.until > this.s.day) parts.push(['Pays us tribute', 5]);
    if (a.dip?.tribute?.to === bid && a.dip.tribute.until > this.s.day) parts.push(['Pays them tribute', -20]);
    if (a.dip?.trade?.includes(bid)) parts.push(['Trade agreement', 10]);
    if (this.inCoalition(aid, bid)) parts.push(['Coalition against us', -25]);
    const pap = b.tag === 'PAP' ? 0 : a.tag === 'PAP' && b.religion === 'catholic' ? this.mod(bid, 'papalOpinion') : 0;
    if (pap) parts.push(['Investiture', Math.round(pap)]);
    const dip = this.mod(bid, 'diplo');
    if (dip) parts.push(['Their diplomacy', Math.round(dip)]);
    return parts;
  },
  opinion(aid, bid) { return clamp(this.opinionBreakdown(aid, bid).reduce((t, [, v]) => t + v, 0), -200, 200); },

  monthlyDiplomacy(n) {
    const s = this.s;
    for (const o of s.nations) {
      if (o === n || !o.alive) continue;
      const base = this.baseOpinion(n, o);
      const cur = n.opinion[o.id] ?? base;
      n.opinion[o.id] = cur + (base - cur) * 0.03;
      if (n.ae[o.id]) { n.ae[o.id] = Math.max(0, n.ae[o.id] - 0.6 * (1 + this.mod(o.id, 'aeDecay'))); if (!n.ae[o.id]) delete n.ae[o.id]; }
    }
    for (const k of Object.keys(n.truces)) if (n.truces[k] < s.day) delete n.truces[k];
    if (n.claimFab && (n.claimFab.det ?? 0) > 0 && this.rng() < 0.03) this.claimDetected(n);
    if (n.claimFab) {
      n.claimFab.days -= 30 * (1 + this.mod(n.id, 'claimSpeed'));
      if (n.claimFab.days <= 0) {
        const p = n.claimFab.prov;
        if (!this.s.prov[p].claims.includes(n.id)) this.s.prov[p].claims.push(n.id);
        if (n.id === s.player) this.log(`Our chancellor has forged a claim on ${this.provName(p)}.`, { nation: n.id, type: 'diplo', prov: p });
        n.claimFab = null;
        this.emit('claims');
      }
    }
    this.monthlyTribute(n);
    if (n.id !== s.player && n.alive) this.aiDiplomacyExtras(n);
    if (this._coDay !== s.day) { this._coDay = s.day; this.updateCoalitions(); }
    // overlong wars wear everyone down
    for (const w of this.warsOf(n.id)) this.updateWarScore(w);
  },

  // ── actions (return null on success or a reason string)
  improveRelations(aid, bid) {
    const a = this.s.nations[aid], b = this.s.nations[bid];
    if (a.gold < 15) return 'Need 15 gold';
    if ((a.lastImprove?.[bid] || -999) > this.s.day - 60) return 'Envoys already sent recently';
    a.gold -= 15;
    (a.lastImprove ||= {})[bid] = this.s.day;
    b.opinion[aid] = Math.min(150, (b.opinion[aid] ?? 0) + 20 + this.mod(aid, 'diplo') * 0.3);
    return null;
  },
  sendGift(aid, bid, gold) {
    const a = this.s.nations[aid], b = this.s.nations[bid];
    if (a.gold < gold) return 'Not enough gold';
    a.gold -= gold; b.gold += gold;
    b.opinion[aid] = Math.min(150, (b.opinion[aid] ?? 0) + gold * 0.5);
    return null;
  },
  insult(aid, bid) {
    const a = this.s.nations[aid], b = this.s.nations[bid];
    b.opinion[aid] = (b.opinion[aid] ?? 0) - 50;
    a.prestige += 3;
    b.cbs.push({ kind: 'insult', target: aid, until: this.s.day + 730 });
    return null;
  },
  acceptance(aid, bid, kind) {
    // returns [score, reasons[]] — positive accepts
    const a = this.s.nations[aid], b = this.s.nations[bid];
    const R = [];
    const op = this.opinion(bid, aid);
    R.push(['Their opinion of us', Math.round(op / 2)]);
    if (kind === 'alliance') {
      R.push(['Base reluctance', -25]);
      if (relGroup(a.religion) !== relGroup(b.religion)) R.push(['Different faith', -40]);
      const pa = this.power(aid), pb = this.power(bid);
      R.push(['Relative strength', clamp(Math.round((pa / Math.max(1, pb) - 1) * 10), -20, 20)]);
      const common = this.enemiesOf(aid).filter((e) => this.neighbours(bid).includes(e) || this.enemiesOf(bid).includes(e));
      if (common.length) R.push(['Common enemies', 25]);
      if (this.atWar(aid) && !common.length) R.push(['Would drag them into our wars', -30]);
      if (b.allies.length >= 3) R.push(['Already has many allies', -20]);
    } else if (kind === 'marriage') {
      if (['merchant_republic', 'theocracy'].includes(b.gov) || ['merchant_republic', 'theocracy'].includes(a.gov)) R.push(['No royal family', -1000]);
      if (relGroup(a.religion) !== relGroup(b.religion)) R.push(['Different faith', -60]);
      R.push(['Base', 5]);
    } else if (kind === 'nap') {
      R.push(['Base', 10]);
      if (this.power(aid) > this.power(bid) * 1.5) R.push(['They fear us', 15]);
    } else if (kind === 'vassal') {
      const ratio = this.power(aid) / Math.max(1, this.power(bid));
      R.push(['Base reluctance', -40]);
      R.push(['Relative power', Math.round(clamp((ratio - 3) * 12, -60, 60))]);
      if (this.ownedProvinces(bid).length > 12) R.push(['Too large to submit', -40]);
      if (relGroup(a.religion) !== relGroup(b.religion)) R.push(['Different faith', -30]);
    }
    else if (kind === 'tribute') {
      const ratio = this.power(aid) / Math.max(1, this.power(bid));
      R.push(['Base reluctance', -30]);
      R.push(['Relative power', Math.round(clamp((ratio - 1.5) * 25, -50, 60))]);
      if (relGroup(a.religion) !== relGroup(b.religion)) R.push(['Different faith', -15]);
      if (this.atWar(bid)) R.push(['Busy with other wars', 15]);
    } else if (kind === 'guarantee') {
      R.push(['Base', 15]);
      if (this.neighbours(aid).includes(bid)) R.push(['Distrust of the neighbour\'s protection', -10]);
    } else if (kind === 'callToArms') {
      R.push(['Obligation of alliance', 20]);
      R.push(['Dragged into war', -10]);
    } else if (kind === 'trade') {
      R.push(['Base', 15]);
      if (relGroup(a.religion) !== relGroup(b.religion)) R.push(['Different faith', -20]);
    }
    return [R.reduce((t, [, v]) => t + v, 0), R];
  },
  // Why a proposal would be (or was) refused: [accepted, "They refuse: Reason −n, …"].
  whyNot(aid, bid, kind) {
    const [sc, R] = this.acceptance(aid, bid, kind);
    if (sc >= 0) return [true, ''];
    const worst = R.filter(([, v]) => v < 0).sort((x, y) => x[1] - y[1]).slice(0, 3);
    return [false, `They refuse: ${worst.map(([k, v]) => `${k} ${v}`).join(', ')}`];
  },
  proposeAlliance(aid, bid) {
    const a = this.s.nations[aid], b = this.s.nations[bid];
    if (a.allies.includes(bid)) return 'Already allied';
    if (this.atWar(aid, bid)) return 'We are at war';
    const [ok, why] = this.whyNot(aid, bid, 'alliance');
    if (!ok) { b.opinion[aid] = (b.opinion[aid] ?? 0) - 5; return why; }
    a.allies.push(bid); b.allies.push(aid);
    this.log(`The ${a.adj} and the ${b.adj} have formed an alliance.`, { nation: aid, type: 'diplo' });
    this.emit('diplo');
    return null;
  },
  breakAlliance(aid, bid) {
    const a = this.s.nations[aid], b = this.s.nations[bid];
    const s = this.s;
    a.allies = a.allies.filter((x) => x !== bid); b.allies = b.allies.filter((x) => x !== aid);
    b.opinion[aid] = (b.opinion[aid] ?? 0) - 40; a.prestige -= 5;
    // abandoning an ally in a war is dishonourable, unless they ignored our call to arms
    if (this.warsOf(bid).length && !(this.dip(b).calls[aid] > s.day)) {
      a.stability = Math.max(-3, a.stability - 1); a.prestige -= 15;
      this.dip(b).betrayed[aid] = s.day + 3650;
      for (const x of a.allies) { const o = s.nations[x]; o.opinion[aid] = (o.opinion[aid] ?? 0) - 10; }
    }
    this.emit('diplo');
  },
  proposeMarriage(aid, bid) {
    const a = this.s.nations[aid], b = this.s.nations[bid];
    if (a.marriages.includes(bid)) return 'Already married';
    const [ok, why] = this.whyNot(aid, bid, 'marriage');
    if (!ok) return why;
    a.marriages.push(bid); b.marriages.push(aid);
    a.prestige += 5; b.prestige += 5;
    this.log(`A royal marriage unites the houses of the ${a.adj} and the ${b.adj}.`, { nation: aid, type: 'diplo' });
    this.emit('diplo');
    return null;
  },
  proposeNAP(aid, bid) {
    const a = this.s.nations[aid], b = this.s.nations[bid];
    if (a.naps.includes(bid)) return 'Already have a pact';
    const [ok, why] = this.whyNot(aid, bid, 'nap');
    if (!ok) return why;
    a.naps.push(bid); b.naps.push(aid);
    this.emit('diplo');
    return null;
  },
  demandVassal(aid, bid) {
    const b = this.s.nations[bid];
    const [ok, why] = this.whyNot(aid, bid, 'vassal');
    if (!ok) { b.opinion[aid] = (b.opinion[aid] ?? 0) - 25; return `${why} (and are offended)`; }
    this.makeVassal(aid, bid);
    return null;
  },
  makeVassal(aid, bid) {
    const a = this.s.nations[aid], b = this.s.nations[bid];
    b.overlord = aid;
    b.allies = b.allies.filter((x) => x !== aid);
    for (const w of this.warsOf(bid)) this.leaveWar(w, bid);
    this.log(`The ${b.name} swears fealty to the ${a.name}.`, { nation: aid, type: 'diplo' });
    this.emit('diplo');
  },
  releaseVassal(aid, bid) { const b = this.s.nations[bid]; if (b.overlord === aid) { b.overlord = -1; this.emit('diplo'); } },
  fabricateClaim(aid, p) {
    const a = this.s.nations[aid];
    if (a.claimFab) return 'Already fabricating a claim';
    if (!a.council.chancellor && !a.council.spymaster) return 'Appoint a chancellor or spymaster first';
    const pr = this.s.prov[p];
    if (pr.owner === aid) return 'We own it';
    if (pr.claims.includes(aid)) return 'Already claimed';
    const near = this.map.provinces[p].adj.some((e) => e.id < this.L && this.s.prov[e.id].owner === aid);
    if (!near) return 'Must border our realm';
    if (a.gold < 20) return 'Need 20 gold';
    a.gold -= 20;
    a.claimFab = { prov: p, days: 150, det: a.council.spymaster ? 0 : 1 };
    return null;
  },

  // ── extended diplomacy. Per-nation state lives in n.dip, created lazily so old saves keep working.
  dip(n) { return n.dip ||= { guar: [], trade: [], tribute: null, betrayed: {}, calls: {} }; },
  inCoalition(aid, bid) { const c = this.s.coalitions?.[bid]; return !!c && c.includes(aid); },
  monthlyTribute(n) {
    const t = n.dip?.tribute;
    if (!t) return;
    if (t.until <= this.s.day || !this.s.nations[t.to].alive || n.overlord >= 0 || this.atWar(n.id, t.to)) { n.dip.tribute = null; return; }
    const v = Math.min(t.v, Math.max(0, n.gold));
    n.gold -= v; this.s.nations[t.to].gold += v;
  },
  demandTribute(aid, bid) {
    const a = this.s.nations[aid], b = this.s.nations[bid];
    if (this.atWar(aid, bid)) return 'We are at war';
    if (this.dip(b).tribute) return 'They already pay tribute';
    if (this.opinion(bid, aid) > 100 || a.allies.includes(bid)) return 'Not against a friend';
    const [ok, why] = this.whyNot(aid, bid, 'tribute');
    if (!ok) {
      b.opinion[aid] = (b.opinion[aid] ?? 0) - 15;
      a.cbs.push({ kind: 'insult', target: bid, until: this.s.day + 365 });
      return `${why} (we gain a grievance for a year)`;
    }
    const v = clamp(Math.round(this.ownedProvinces(bid).length * 0.6), 1, 8);
    this.dip(b).tribute = { to: aid, v, until: this.s.day + 365 * 5 };
    b.opinion[aid] = (b.opinion[aid] ?? 0) - 20;
    this.log(`The ${b.name} agrees to pay tribute to the ${a.name}.`, { nation: aid, type: 'diplo' });
    this.emit('diplo');
    return null;
  },
  provinceValue(p) { return Math.round(this.s.prov[p].dev * 4 + 10); },
  // buyer purchases province p from its owner; price in gold
  tradeProvince(buyer, p) {
    const s = this.s, pr = s.prov[p], seller = pr.owner;
    const B = s.nations[buyer], S = s.nations[seller];
    if (seller < 0 || seller === buyer) return 'Not for sale';
    if (S.capital === p) return 'A capital is not for sale';
    if (pr.controller !== seller) return 'The province is occupied';
    if (this.atWar(buyer, seller)) return 'We are at war';
    if (this.ownedProvinces(seller).length < 2) return 'They would be left with nothing';
    const price = this.provinceValue(p);
    if (B.gold < price) return `Need ${price} gold`;
    if (!this.map.provinces[p].adj.some((e) => e.id < this.L && s.prov[e.id].owner === buyer) && !this.map.provinces[p].coastal) return 'Must border our realm';
    B.gold -= price; S.gold += price;
    this.setOwner(p, buyer);
    S.opinion[buyer] = (S.opinion[buyer] ?? 0) + 5;
    this.log(`The ${B.name} buys ${this.provName(p)} from the ${S.name} for ${price} gold.`, { nation: buyer, type: 'diplo' });
    this.emit('diplo');
    return null;
  },
  buyProvince(aid, p) {
    const s = this.s, o = s.prov[p].owner;
    if (o < 0) return 'Not for sale';
    const op = this.opinion(o, aid);
    if (op < -20 && !s.nations[o].ai.horde) return `They refuse: Their opinion of us ${Math.round(op / 2)}`;
    if (s.nations[o].ai.horde) return 'They refuse: the horde does not sell land';
    return this.tradeProvince(aid, p);
  },
  sellProvince(aid, bid, p) {
    const s = this.s;
    if (s.prov[p].owner !== aid) return 'Not our province';
    const b = s.nations[bid];
    if (this.opinion(bid, aid) < -20) return 'They refuse: they do not trust us';
    if (b.gold < this.provinceValue(p)) return 'They cannot afford it';
    return this.tradeProvince(bid, p);
  },
  guaranteeIndependence(aid, bid) {
    const a = this.s.nations[aid], b = this.s.nations[bid];
    const d = this.dip(a);
    if (d.guar.includes(bid)) return 'Already guaranteed';
    if (b.overlord >= 0) return 'They are a vassal';
    if (this.atWar(aid, bid)) return 'We are at war';
    if (d.guar.length >= 3) return 'We cannot guarantee more than three realms';
    const [ok, why] = this.whyNot(aid, bid, 'guarantee');
    if (!ok) return why;
    d.guar.push(bid);
    b.opinion[aid] = (b.opinion[aid] ?? 0) + 15;
    this.emit('diplo');
    return null;
  },
  revokeGuarantee(aid, bid) { const d = this.dip(this.s.nations[aid]); d.guar = d.guar.filter((x) => x !== bid); this.emit('diplo'); },
  // guarantors of the defender stand against the aggressor; those who decline lose standing
  guarantorsJoin(w, aid, bid, silent) {
    const s = this.s;
    for (const g of s.nations) {
      if (!g.alive || !g.dip?.guar?.includes(bid) || g.id === aid || w.att.includes(g.id) || w.def.includes(g.id)) continue;
      if (this.atWar(g.id, aid)) continue;
      if (g.id === s.player && !silent) { this.joinWar(w, g.id, 'def'); continue; }
      if (g.overlord < 0 && this.opinion(g.id, aid) < 40 && this.armyStrength(g.id) > 0) this.joinWar(w, g.id, 'def');
      else { g.prestige -= 10; g.dip.guar = g.dip.guar.filter((x) => x !== bid); }
    }
  },
  callToArms(aid, warId, xid) {
    const s = this.s, w = s.wars[warId], a = s.nations[aid], x = s.nations[xid];
    if (!w || !a.allies.includes(xid)) return 'Not an ally';
    const side = w.att.includes(aid) ? 'att' : w.def.includes(aid) ? 'def' : null;
    if (!side) return 'We are not in that war';
    if (w.att.includes(xid) || w.def.includes(xid)) return 'Already in the war';
    const foes = side === 'att' ? w.def : w.att;
    if (foes.some((f) => this.isAlly(xid, f))) return 'They are allied with the enemy';
    const [ok, why] = this.whyNot(aid, xid, 'callToArms');
    if (!ok) {
      this.dip(a).calls[xid] = s.day + 365;
      x.opinion[aid] = (x.opinion[aid] ?? 0) - 10;
      return `${why} (we may break the alliance without penalty for a year)`;
    }
    this.joinWar(w, xid, side);
    return null;
  },
  proposeTradeAgreement(aid, bid) {
    const a = this.s.nations[aid], b = this.s.nations[bid];
    if (this.dip(a).trade.includes(bid)) return 'Already trading';
    if (this.atWar(aid, bid)) return 'We are at war';
    if (this.dip(a).trade.length >= 4 || this.dip(b).trade.length >= 4) return 'Too many agreements';
    const [ok, why] = this.whyNot(aid, bid, 'trade');
    if (!ok) return why;
    this.dip(a).trade.push(bid); this.dip(b).trade.push(aid);
    this.applyTradeMods(aid); this.applyTradeMods(bid);
    this.emit('diplo');
    return null;
  },
  cancelTrade(aid, bid) {
    for (const [x, y] of [[aid, bid], [bid, aid]]) { const n = this.s.nations[x]; this.dip(n).trade = n.dip.trade.filter((i) => i !== y); this.applyTradeMods(x); }
    this.emit('diplo');
  },
  // hook for the economy workstream: mod key `tradeMult` (+0.04 per agreement)
  applyTradeMods(nid) {
    const n = this.s.nations[nid];
    n.mods = n.mods.filter((m) => m.src !== 'trade_agreements');
    const k = n.dip?.trade.length || 0;
    if (k) n.mods.push({ src: 'trade_agreements', mods: { tradeMult: 0.04 * k } });
    this.recalcMods(nid);
  },
  claimDetected(n) {
    const f = n.claimFab; if (!f) return;
    const o = this.s.prov[f.prov].owner;
    if (o >= 0) { this.s.nations[o].opinion[n.id] = (this.s.nations[o].opinion[n.id] ?? 0) - 30; this.s.nations[o].cbs.push({ kind: 'insult', target: n.id, until: this.s.day + 365 }); }
    n.claimFab = null;
    this.log(`Our forged claim on ${this.provName(f.prov)} was exposed!`, { nation: n.id, type: 'diplo' });
  },
  // coalitions: nations with high aggressive expansion against `tid` and a poor opinion band together
  updateCoalitions() {
    const s = this.s, co = s.coalitions = {};
    for (const t of s.nations) {
      if (!t.alive) continue;
      const m = s.nations.filter((o) => o.alive && o.id !== t.id && (o.ae[t.id] || 0) >= 30 && this.opinion(o.id, t.id) < -20 && !o.allies.includes(t.id) && o.overlord !== t.id).map((o) => o.id);
      if (m.length >= 3) co[t.id] = m;
    }
  },

  // AI use of the extended actions; one cheap random action per nation per month
  aiDiplomacyExtras(n) {
    const s = this.s, r = this.rng();
    if (n.ai.horde || n.overlord >= 0) return;
    const cand = () => { const o = s.nations[Math.floor(this.rng() * s.nations.length)]; return o && o.alive && o !== n && !o.ai.horde ? o : null; };
    const o = cand();
    if (!o) return;
    const near = this.neighbours(n.id).includes(o.id);
    const ratio = this.power(n.id) / Math.max(1, this.power(o.id));
    if (r < 0.15 && near && ratio > 2.5 && o.overlord < 0 && !this.atWar(n.id, o.id)) this.demandTribute(n.id, o.id);
    else if (r < 0.3 && n.gold > 150) {
      const ps = this.ownedProvinces(o.id).filter((p) => this.map.provinces[p].adj.some((e) => e.id < this.L && s.prov[e.id].owner === n.id));
      const p = ps[Math.floor(this.rng() * ps.length)];
      if (p !== undefined && this.provinceValue(p) < n.gold - 60) this.buyProvince(n.id, p);
    } else if (r < 0.4 && n.dip?.guar.length !== 3 && !near && ratio > 1.5 && this.opinion(o.id, n.id) > 20) this.guaranteeIndependence(n.id, o.id);
    else if (r < 0.5 && this.opinion(o.id, n.id) > 0) this.proposeTradeAgreement(n.id, o.id);
    else if (r < 0.6 && n.allies.includes(o.id) && !this.warsOf(o.id).length && this.opinion(n.id, o.id) < -20) this.breakAlliance(n.id, o.id);
    else if (r < 0.7) {
      for (const w of this.warsOf(n.id)) for (const x of n.allies) if (!this.atWar(x) && this.rng() < 0.5) { this.callToArms(n.id, w.id, x); return; }
    }
  },
  // extra peace terms for the AI: tribute from a beaten rival, release of the winner's friends
  aiPeaceExtras(w, side, n, demands, budget) {
    const losers = side === 'att' ? w.def : w.att;
    if (n.ai.horde) return budget;
    const rel = this.releasable(n.id, losers);
    if (!demands.length && rel.length && budget > 25) { demands.push({ type: 'release', nation: n.id, provs: rel }); budget -= this.demandCost(w, side, demands[0]); }
    if (budget >= 25 && !demands.some((d) => d.type === 'tribute') && demands.length) { demands.push({ type: 'tribute' }); budget -= 25; }
    return budget;
  },

  // ── casus belli
  cbsAgainst(aid, bid) {
    const a = this.s.nations[aid], b = this.s.nations[bid];
    const r = [];
    if (this.ownedProvinces(bid).some((p) => this.s.prov[p].claims.includes(aid))) r.push('claim');
    const border = this.neighbours(aid).includes(bid) || this.ownedProvinces(bid).some((p) => this.map.provinces[p].coastal) && this.ownedProvinces(aid).some((p) => this.map.provinces[p].coastal);
    const holy = a.cbs.some((c) => c.kind === 'holy_war' && (!c.tag || c.tag === b.tag));
    if (holy && relGroup(a.religion) !== relGroup(b.religion) && border) r.push('holy_war');
    if (holy && a.cbs.some((c) => c.tag === b.tag)) { if (!r.includes('holy_war')) r.push('holy_war'); }
    if (CHRISTIAN.includes(a.religion) && ['pagan', 'tengri'].includes(b.religion) && this.neighbours(aid).includes(bid)) r.push('subjugation');
    if (a.religion === 'catholic' && ['iberian', 'portuguese'].includes(a.group) && b.religion === 'sunni' && this.ownedProvinces(bid).some((p) => this.map.provinces[p].lon < 4 && this.map.provinces[p].lat > 36)) r.push('reconquista');
    if (a.cbs.some((c) => c.kind === 'insult' && c.target === bid && c.until > this.s.day)) r.push('insult');
    r.push('conquest');
    return r;
  },
  canDeclareWar(aid, bid) {
    const a = this.s.nations[aid], b = this.s.nations[bid];
    if (!b || !b.alive) return 'No such realm';
    if (aid === bid) return 'Cannot declare war on ourselves';
    if (this.atWar(aid, bid)) return 'Already at war';
    if (a.allies.includes(bid)) return 'Break the alliance first';
    if (a.overlord === bid || b.overlord === aid) return 'Cannot attack overlord or vassal';
    if (a.overlord >= 0) return 'Vassals cannot declare wars';
    return null;
  },
  declareWar(aid, bid, cb = { kind: 'conquest' }, silent = false) {
    const why = this.canDeclareWar(aid, bid);
    if (why) return why;
    const s = this.s, a = s.nations[aid], b = s.nations[bid];
    const t = CB_TYPES[cb.kind] || CB_TYPES.conquest;
    if (t.stab) { a.stability = Math.max(-3, a.stability + t.stab); a.legitimacy = Math.max(0, a.legitimacy - 15); }
    if (a.truces[bid] > s.day) { a.stability = Math.max(-3, a.stability - 2); a.prestige -= 20; }
    if (a.naps.includes(bid)) { a.stability = Math.max(-3, a.stability - 1); a.naps = a.naps.filter((x) => x !== bid); b.naps = b.naps.filter((x) => x !== aid); }
    const name = `${a.adj}-${b.adj} War`;
    const w = { id: this.newId(), name: cb.kind === 'holy_war' ? `${a.adj} ${a.religion === 'sunni' ? 'Jihad' : 'Crusade'} against ${b.name}` : name, att: [aid], def: [bid], attLeader: aid, defLeader: bid,
      cb: cb.kind, start: s.day, battleScore: 0, score: 0 };
    s.wars[w.id] = w;
    this._wp = null;
    // the defender calls allies, vassals and overlord
    const defCall = new Set([...b.allies, ...s.nations.filter((x) => x.alive && x.overlord === bid).map((x) => x.id)]);
    if (b.overlord >= 0) defCall.add(b.overlord);
    // fearful neighbours join a coalition against aggressive conquerors
    for (const o of s.nations) if (o.alive && (o.ae[aid] || 0) > 45 && this.opinion(o.id, aid) < -60) defCall.add(o.id);
    for (const x of s.coalitions?.[aid] || []) if (this.neighbours(x).includes(bid) || this.opinion(x, bid) > 0) defCall.add(x);
    for (const x of defCall) {
      if (x === aid || this.isAlly(x, aid) || w.att.includes(x) || w.def.includes(x)) continue;
      const ally = s.nations[x];
      if (!ally.alive || ally.overlord >= 0 && ally.overlord !== bid) continue;
      if (x === s.player && !silent) { this.joinWar(w, x, 'def'); continue; }
      if (this.opinion(x, bid) > -10 || ally.overlord === bid || ally.id === b.overlord) this.joinWar(w, x, 'def');
    }
    this.guarantorsJoin(w, aid, bid, silent);
    // the attacker calls allies (they may decline)
    const attCall = [...a.allies, ...s.nations.filter((x) => x.alive && x.overlord === aid).map((x) => x.id)];
    for (const x of attCall) {
      if (w.def.includes(x) || w.att.includes(x)) continue;
      if (this.isAlly(x, bid)) continue;
      const ally = s.nations[x];
      if (ally.overlord === aid || (x !== s.player && this.opinion(x, aid) > 30 && this.opinion(x, bid) < 20)) this.joinWar(w, x, 'att');
    }
    // aggressive expansion & reputation
    for (const o of s.nations) if (o.alive && o.id !== aid && this.neighbours(o.id).includes(bid)) o.ae[aid] = (o.ae[aid] || 0) + 4 * t.ae;
    a.ai.lastWar = s.day;
    this.log(`${a.name} declares war on ${b.name}! (${t.name})`, { nation: aid, type: 'war', important: [aid, bid].includes(s.player) || w.def.includes(s.player) || w.att.includes(s.player) });
    if (w.def.includes(s.player) && aid !== s.player) this.notify({ title: 'War!', icon: '⚔', text: `${a.name} has declared war on ${b.id === s.player ? 'us' : b.name}!` });
    this.emit('war', w.id);
    return null;
  },
  joinWar(w, nid, side) {
    if (w.att.includes(nid) || w.def.includes(nid)) return;
    w[side].push(nid);
    this._wp = null;
    if (nid === this.s.player) this.log(`We join the ${w.name} on the side of the ${side === 'att' ? 'attackers' : 'defenders'}.`, { nation: nid, type: 'war' });
  },
  leaveWar(w, nid) {
    w.att = w.att.filter((x) => x !== nid); w.def = w.def.filter((x) => x !== nid);
    this._wp = null;
    if (!w.att.length || !w.def.length) this.endWar(w);
    else { if (w.attLeader === nid) w.attLeader = w.att[0]; if (w.defLeader === nid) w.defLeader = w.def[0]; }
    this.returnControl(nid);
  },
  endWar(w) {
    delete this.s.wars[w.id];
    this._wp = null;
    for (const x of [...w.att, ...w.def]) this.returnControl(x);
    // any battle between former enemies stops
    for (const b of Object.values(this.s.battles)) {
      if (b.over) continue;
      if (b.attN >= 0 && b.defN >= 0 && !this.atWar(b.attN, b.defN)) {
        b.over = true; b.endDay = this.s.day;
        for (const id of [...b.att, ...b.def]) { const a = this.s.armies[id]; if (a) { a.battle = null; for (const r of a.regs) r.routed = false; } }
      }
    }
    this.emit('war', w.id);
  },
  returnControl(nid) {
    // provinces occupied by or from a nation no longer at war revert to owners; foreign armies go home
    for (let p = 0; p < this.L; p++) {
      const pr = this.s.prov[p];
      if (pr.controller >= 0 && pr.controller !== pr.owner && !this.atWar(pr.controller, pr.owner)) {
        pr.controller = pr.owner; pr.siege = null; this.emit('control', p);
      }
    }
    for (const a of Object.values(this.s.armies)) {
      if (a.nation < 0 || a.battle) continue;
      if (a.loc < this.L && !this.canEnter(a.nation, a.loc)) {
        const n = this.s.nations[a.nation];
        const home = n.capital >= 0 ? n.capital : this.ownedProvinces(a.nation)[0];
        if (home === undefined || home < 0) { this.destroyArmy(a); continue; }
        a.loc = home; a.path = []; a.prog = 0; a.atSea = false;
        this.emit('armyMoved', a.id);
      }
    }
  },

  updateWarScore(w) {
    const s = this.s;
    const devOf = (nids) => { let t = 0; for (const n of nids) for (const p of this.ownedProvinces(n)) t += s.prov[p].dev; return t || 1; };
    const occ = (attackers, defenders) => {
      let t = 0;
      for (const d of defenders) for (const p of this.ownedProvinces(d)) {
        const c = s.prov[p].controller;
        if (attackers.includes(c)) t += s.prov[p].dev * (s.nations[d].capital === p ? 2 : 1);
      }
      return t;
    };
    const attOcc = occ(w.att, w.def) / devOf(w.def) * 100;
    const defOcc = occ(w.def, w.att) / devOf(w.att) * 100;
    const months = (s.day - w.start) / 30;
    w.score = clamp(Math.round(attOcc * 0.9 - defOcc * 0.9 + (w.battleScore || 0) + (w.cb === 'conquest' ? 0 : 0) - (months > 24 ? (months - 24) * 0.2 * Math.sign(attOcc - defOcc - 0.0001) * 0 : 0)), -100, 100);
    w.attOcc = attOcc; w.defOcc = defOcc;
  },

  // Peace: demands made by `side` ('att' or 'def') of the other side.
  demandCost(w, side, d) {
    const s = this.s;
    const losers = side === 'att' ? w.def : w.att;
    let tot = 0; for (const n of losers) for (const p of this.ownedProvinces(n)) tot += s.prov[p].dev;
    tot = Math.max(1, tot);
    if (d.type === 'province') {
      const pr = s.prov[d.p];
      const capital = s.nations[pr.owner].capital === d.p;
      const claimed = pr.claims.includes(d.to);
      return Math.round((pr.dev / tot * 90 + 3 + (capital ? 10 : 0)) * (claimed ? 0.7 : 1) * (w.cb === 'conquest' ? 1.2 : 1));
    }
    if (d.type === 'gold') return Math.round(d.v / 8);
    if (d.type === 'vassal') return Math.round(55 + this.ownedProvinces(d.target).length * 1.2);
    if (d.type === 'humiliate') return 10;
    if (d.type === 'tribute') return 25;
    if (d.type === 'release') return Math.round(20 + d.provs.length * 4);
    return 0;
  },
  peaceAcceptance(w, side, demands) {
    // the other side's willingness to accept
    const cost = demands.reduce((t, d) => t + this.demandCost(w, side, d), 0);
    const score = side === 'att' ? w.score : -w.score;
    const losers = side === 'att' ? w.def : w.att;
    const leader = this.s.nations[side === 'att' ? w.defLeader : w.attLeader];
    let will = score - cost;
    will += (leader?.warExhaustion || 0) * 1.5;
    const months = (this.s.day - w.start) / 30;
    if (months > 18) will += (months - 18) * 0.5;
    // armies left?
    const ratio = losers.reduce((t, n) => t + this.armyStrength(n), 0) / Math.max(1, (side === 'att' ? w.att : w.def).reduce((t, n) => t + this.armyStrength(n), 0));
    if (ratio < 0.3) will += 15;
    if (ratio > 1.5) will -= 15;
    if (!demands.length) will += 10;
    if (leader?.ai.horde && months < 120) will -= 1000; // the horde does not sue for peace
    const reasons = [['War score', score], ['Cost of demands', -cost]];
    if (leader?.warExhaustion) reasons.push(['War exhaustion', Math.round(leader.warExhaustion * 1.5)]);
    if (months > 18) reasons.push(['War drags on', Math.round((months - 18) * 0.5)]);
    if (ratio < 0.3) reasons.push(['Their armies are broken', 15]);
    if (ratio > 1.5) reasons.push(['Their armies are strong', -15]);
    if (!demands.length) reasons.push(['White peace', 10]);
    if (leader?.ai.horde && months < 120) reasons.push(['The horde does not sue for peace', -1000]);
    return { cost, will: Math.round(will), reasons };
  },
  makePeace(w, side, demands) {
    const s = this.s;
    const winners = side === 'att' ? w.att : w.def, losers = side === 'att' ? w.def : w.att;
    const wl = side === 'att' ? w.attLeader : w.defLeader;
    for (const d of demands) {
      if (d.type === 'province') {
        const from = s.prov[d.p].owner;
        if (!losers.includes(from)) continue;
        this.setOwner(d.p, d.to ?? wl);
        for (const o of s.nations) if (o.alive && o.id !== (d.to ?? wl)) {
          const near = this.map.provinces[d.p].adj.some((e) => e.id < this.L && s.prov[e.id].owner === o.id);
          const wn = this.neighbours(d.to ?? wl).includes(o.id);
          const kin = o.group === s.nations[from].group && !near;
          const f = near ? 1 : wn ? 0.4 : kin ? 0.3 : 0;
          if (f) o.ae[d.to ?? wl] = (o.ae[d.to ?? wl] || 0) + s.prov[d.p].dev * 1.5 * (CB_TYPES[w.cb]?.ae || 1) * f;
        }
      } else if (d.type === 'gold') {
        const ln = s.nations[side === 'att' ? w.defLeader : w.attLeader];
        ln.gold -= d.v; s.nations[wl].gold += d.v;
      } else if (d.type === 'vassal') {
        this.makeVassal(wl, d.target);
      } else if (d.type === 'tribute') {
        const ln = s.nations[side === 'att' ? w.defLeader : w.attLeader];
        this.dip(ln).tribute = { to: wl, v: clamp(Math.round(this.ownedProvinces(ln.id).length * 0.6), 1, 8), until: s.day + 365 * 5 };
      } else if (d.type === 'release') {
        this.releaseNation(wl, d, losers);
      } else if (d.type === 'humiliate') {
        const ln = s.nations[side === 'att' ? w.defLeader : w.attLeader];
        ln.prestige -= 30; s.nations[wl].prestige += 30;
      }
    }
    for (const a of winners) for (const b of losers) {
      s.nations[a].truces[b] = s.day + 365 * 5; s.nations[b].truces[a] = s.day + 365 * 5;
    }
    for (const x of [...winners, ...losers]) { const n = s.nations[x]; if (n) n.warExhaustion = Math.max(0, n.warExhaustion - 3); }
    s.nations[wl].prestige += 10;
    const txt = demands.length ? demands.map((d) => (d.type === 'province' ? this.provName(d.p) : d.type === 'gold' ? `${d.v} gold` : d.type === 'vassal' ? 'vassalage' : d.type === 'tribute' ? 'tribute' : d.type === 'release' ? `release of ${s.nations[d.nation].name}` : 'humiliation')).join(', ') : 'white peace';
    this.log(`Peace: the ${w.name} ends. Terms: ${txt}.`, { nation: wl, type: 'diplo', important: [...winners, ...losers].includes(s.player) });
    this.endWar(w);
    this.emit('peace', w.id);
  },
  // provinces of `losers` whose original (map) owner was nation nid: candidates for a release demand
  releasable(nid, losers) {
    const r = [];
    for (const l of losers) for (const p of this.ownedProvinces(l)) if (this.map.owner?.[p] === nid && l !== nid && this.s.nations[l].capital !== p) r.push(p);
    return r;
  },
  releaseNation(wl, d, losers) {
    const s = this.s, n = s.nations[d.nation];
    const provs = d.provs.filter((p) => losers.includes(s.prov[p].owner));
    if (!provs.length) return;
    if (!n.alive) { n.alive = true; n.overlord = -1; n.allies = []; n.capital = -1; n.gold = Math.max(n.gold, 20); n.truces = {}; }
    for (const p of provs) this.setOwner(p, d.nation);
    if (n.capital < 0 || s.prov[n.capital].owner !== n.id) n.capital = provs[0];
    n.opinion[wl] = (n.opinion[wl] ?? 0) + 40;
    this.makeVassal(wl, d.nation);
    this.releaseVassal(wl, d.nation);
    n.allies.push(wl); s.nations[wl].allies.push(d.nation);
  },
  annihilate(nid) {
    const n = this.s.nations[nid];
    if (!n || !n.alive || n.ai.horde) return;
    n.alive = false;
    for (const a of this.armiesOf(nid)) this.destroyArmy(a);
    for (const w of this.warsOf(nid)) this.leaveWar(w, nid);
    for (const o of this.s.nations) { o.allies = o.allies.filter((x) => x !== nid); if (o.overlord === nid) o.overlord = -1; }
    for (const r of this.s.recruit.filter((r) => r.nation === nid)) this.s.recruit.splice(this.s.recruit.indexOf(r), 1);
    this.log(`The ${n.name} has fallen and is no more.`, { nation: nid, type: 'war', important: true });
    this.emit('nationGone', nid);
  },

  addClaimsBox(tagA, tagB, box, frac = 1) {
    const A = this.nationByTag(tagA), B = this.nationByTag(tagB);
    if (!A || !B) return;
    for (const p of this.ownedProvinces(B.id)) {
      const sp = this.map.provinces[p];
      if (box && !(sp.lon >= box[0] && sp.lat >= box[1] && sp.lon <= box[2] && sp.lat <= box[3])) continue;
      if (this.rng() > frac && frac < 1) continue;
      if (!this.s.prov[p].claims.includes(A.id)) this.s.prov[p].claims.push(A.id);
    }
  },
};
