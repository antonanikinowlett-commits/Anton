// Trade: value flows downstream along the nodes of js/data/trade.js and is collected by realms in
// proportion to their trade power there (docs/specs/trade.md). Merchants collect or steer, embargoes and
// trade agreements shift power, and the result is a monthly gold line in the budget (B.nodes).
// State (JSON): s.trade = { income:{nid}, nodes:{id:{value,retained,top}}, steer:{id} }, n.merchants, n.embargoes, n.tradeAgreements.
import { TRADE_NODES, TRADE_NODE_INDEX, TRADE_FLOW } from '../data/trade.js';
import { clamp } from '../util.js';

const BASE_K = 5;        // gold/month per unit of a node's exotic `base`
const LOCAL_K = 1.0;     // multiplier on the trade value of the provinces inside a node
const STEER_STEP = 0.12; // extra share of a node's value sent downstream per steering merchant
const MERCHANT_POWER = 0.25; // a collecting merchant adds this fraction of the node's total power
const EMBARGO_YEARS = 5;
const SEAT_POWER = 0.35; // the realm holding a node's seat (the province nearest its coordinates) gains this fraction of the node's power

export const TradeSimMixin = {
  initTrade() {
    const s = this.s;
    s.trade ||= { income: {}, nodes: {}, steer: {} };
    for (const n of s.nations) { n.merchants ||= []; n.embargoes ||= []; n.tradeAgreements ||= []; }
    if (!Object.keys(s.trade.nodes).length) this.monthlyTrade();
  },
  _nodeMap() {
    if (this._tnode) return this._tnode;
    const P = this.map.provinces, m = new Int16Array(this.L);
    for (let p = 0; p < this.L; p++) {
      let best = 0, bd = 1e9;
      for (let i = 0; i < TRADE_NODES.length; i++) {
        const dx = (P[p].lon - TRADE_NODES[i].lon) * Math.cos(P[p].lat * Math.PI / 180), dy = P[p].lat - TRADE_NODES[i].lat, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
      m[p] = best;
    }
    // seat of each node: the province nearest its coordinates
    this._tseat = TRADE_NODES.map((nd) => {
      let bp = -1, bd = 1e9;
      for (let p = 0; p < this.L; p++) { if (m[p] === TRADE_NODES.indexOf(nd)) { const dx = (P[p].lon - nd.lon) * Math.cos(nd.lat * Math.PI / 180), dy = P[p].lat - nd.lat, d = dx * dx + dy * dy; if (d < bd) { bd = d; bp = p; } } }
      return bp;
    });
    return (this._tnode = m);
  },
  merchantSlots(nid) {
    const n = this.s.nations[nid];
    return 1 + (n.gov === 'merchant_republic' ? 2 : 0) + (this.realmRank(nid) >= 2 ? 1 : 0);
  },
  tradeIncome(nid) { return this.s.trade?.income[nid] || 0; },

  // ── monthly: node values, power, income (one pass over provinces)
  monthlyTrade() {
    const s = this.s, T = s.trade, K = TRADE_NODES.length, nm = this._nodeMap(), P = this.map.provinces;
    const local = new Float64Array(K), power = Array.from({ length: K }, () => ({}));
    const mult = {};
    for (const n of s.nations) { n.merchants ||= []; n.embargoes ||= []; n.tradeAgreements ||= []; }
    for (const n of s.nations) if (n.alive) mult[n.id] = (1 + this.softMult(this.mod(n.id, 'tradeMult'))) * (n.gov === 'merchant_republic' ? 2 : 1);
    for (let p = 0; p < this.L; p++) {
      const pr = s.prov[p], o = pr.owner;
      if (o < 0 || mult[o] === undefined) continue;
      const b = pr.buildings, port = b.port || 0;
      const tv = ((b.market || 0) * 0.2 + port * 0.3 + (P[p].imp >= 2 ? 0.25 : 0)) * (1 + pr.dev / 20) * (1 - pr.devast / 100) * (pr.blockadedBy !== undefined ? 0.2 : 1);
      const k = nm[p];
      local[k] += tv;
      if (pr.controller === o) power[k][o] = (power[k][o] || 0) + (tv + 0.02 * pr.dev) * (1 + (port > 0 ? 1 : 0)) * mult[o];
    }
    // the seat of each node gives its owner a bonus
    for (let k = 0; k < K; k++) {
      const sp = this._tseat[k], o = sp >= 0 ? s.prov[sp].owner : -1;
      if (o >= 0 && mult[o] !== undefined && s.prov[sp].controller === o) power[k][o] = (power[k][o] || 0) + SEAT_POWER * Object.values(power[k]).reduce((x, v) => x + v, 0) + 1;
    }
    // embargoes and agreements reshape power
    for (const n of s.nations) {
      if (!n.alive) continue;
      for (const e of n.embargoes) {
        if (e.until < s.day) continue;
        for (let k = 0; k < K; k++) if (power[k][n.id] && power[k][e.id]) power[k][e.id] *= 0.5;
      }
      for (const a of n.tradeAgreements) if (a > n.id) for (let k = 0; k < K; k++) if (power[k][n.id] && power[k][a]) { power[k][n.id] *= 1.1; power[k][a] *= 1.1; }
    }
    const steer = {};
    for (const n of s.nations) {
      if (!n.alive) continue;
      for (const m of n.merchants) {
        const k = TRADE_NODE_INDEX[m.node];
        if (k === undefined) continue;
        if (m.mode === 'steer') steer[m.node] = (steer[m.node] || 0) + STEER_STEP;
        else { const tot = Object.values(power[k]).reduce((t, v) => t + v, 0); power[k][n.id] = (power[k][n.id] || 0) + Math.max(0.5, tot * MERCHANT_POWER); }
      }
    }
    const incoming = new Float64Array(K), income = {}, nodes = {};
    for (let k = 0; k < K; k++) {
      const nd = TRADE_NODES[k];
      const total = nd.base * BASE_K + local[k] * LOCAL_K + incoming[k];
      const dsi = nd.to ? TRADE_NODE_INDEX[nd.to] : -1;
      const out = dsi >= 0 ? total * clamp(TRADE_FLOW + (steer[nd.id] || 0), 0, 0.8) : 0;
      if (dsi >= 0) incoming[dsi] += out;
      const retained = total - out;
      const sum = Object.values(power[k]).reduce((t, v) => t + v, 0);
      const top = [];
      if (sum > 0) for (const [id, v] of Object.entries(power[k])) { income[id] = (income[id] || 0) + retained * v / sum; top.push([+id, v / sum]); }
      top.sort((a, b) => b[1] - a[1]);
      nodes[nd.id] = { value: total, retained, top: top.slice(0, 6), steer: steer[nd.id] || 0 };
    }
    T.income = income; T.nodes = nodes;
    for (const n of s.nations) if (n.alive) {
      n.embargoes = n.embargoes.filter((e) => e.until >= s.day && s.nations[e.id]?.alive);
      n.tradeAgreements = n.tradeAgreements.filter((x) => s.nations[x]?.alive && !this.atWar(n.id, x));
      n.merchants.length > this.merchantSlots(n.id) && n.merchants.splice(this.merchantSlots(n.id));
      if (n.id !== s.player && !n.ai.horde) this._aiTrade(n);
    }
  },

  // ── actions (return null on success or a reason)
  placeMerchant(nid, nodeId, mode = 'collect') {
    const n = this.s.nations[nid];
    if (TRADE_NODE_INDEX[nodeId] === undefined) return 'Unknown trade node';
    if (n.merchants.some((m) => m.node === nodeId)) return 'We already have a merchant there';
    if (n.merchants.length >= this.merchantSlots(nid)) return 'No free merchant';
    n.merchants.push({ node: nodeId, mode });
    return null;
  },
  recallMerchant(nid, nodeId) {
    const n = this.s.nations[nid];
    n.merchants = n.merchants.filter((m) => m.node !== nodeId);
  },
  setMerchantMode(nid, nodeId, mode) { const m = this.s.nations[nid].merchants.find((x) => x.node === nodeId); if (m) m.mode = mode; },
  embargo(aid, bid) {
    const s = this.s, a = s.nations[aid], b = s.nations[bid];
    if (!b?.alive || aid === bid) return 'No such realm';
    if (a.embargoes.some((e) => e.id === bid)) return 'Already embargoed';
    a.embargoes.push({ id: bid, until: s.day + EMBARGO_YEARS * 365 });
    if (!this.atWar(aid, bid)) b.opinion[aid] = (b.opinion[aid] ?? 0) - 50;
    this.log(`The ${a.name} declares a trade embargo on the ${b.name}.`, { nation: aid, type: 'diplo', important: aid === s.player || bid === s.player });
    this.emit('diplo');
    return null;
  },
  liftEmbargo(aid, bid) { const a = this.s.nations[aid]; a.embargoes = a.embargoes.filter((e) => e.id !== bid); this.emit('diplo'); },
  tradeAgreement(aid, bid) {
    const a = this.s.nations[aid], b = this.s.nations[bid];
    if (!b?.alive || aid === bid) return 'No such realm';
    if (a.tradeAgreements.includes(bid)) return 'Already have an agreement';
    if (this.atWar(aid, bid)) return 'We are at war';
    if (a.tradeAgreements.length >= 3 || b.tradeAgreements.length >= 3) return 'Too many agreements already';
    if (b.embargoes.some((e) => e.id === aid) || a.embargoes.some((e) => e.id === bid)) return 'There is an embargo';
    const op = this.opinion(bid, aid);
    if (op < 10) return `They refuse: opinion of us too low (${Math.round(op)} < 10)`;
    a.tradeAgreements.push(bid); b.tradeAgreements.push(aid);
    this.log(`The ${a.adj} and the ${b.adj} sign a trade agreement.`, { nation: aid, type: 'diplo' });
    this.emit('diplo');
    return null;
  },

  // ── AI: place merchants, embargo rivals, sign agreements, build ports and markets in valuable nodes
  _aiTrade(n) {
    const s = this.s, T = s.trade;
    const myShare = (id) => (T.nodes[id].top.find((t) => t[0] === n.id) || [0, 0])[1];
    if (n.merchants.length < this.merchantSlots(n.id)) {
      let best = null, bs = 0;
      for (const nd of TRADE_NODES) {
        if (n.merchants.some((m) => m.node === nd.id)) continue;
        const info = T.nodes[nd.id], sh = myShare(nd.id);
        const sc = info.retained * (sh > 0 ? 1 : 0.35) * (1 - sh * 0.5);
        if (sc > bs) { bs = sc; best = nd.id; }
      }
      if (best) this.placeMerchant(n.id, best, 'collect');
    } else if (this.rng() < 0.04 && n.merchants.length) {
      // re-evaluate: move the weakest merchant
      const worst = n.merchants.slice().sort((a, b) => T.nodes[a.node].retained * myShare(a.node) - T.nodes[b.node].retained * myShare(b.node))[0];
      this.recallMerchant(n.id, worst.node);
    }
    if (this.rng() < 0.02) {
      const rivals = new Map();
      for (const nd of TRADE_NODES) { const sh = myShare(nd.id); if (sh < 0.1) continue; for (const [id, v] of T.nodes[nd.id].top) if (id !== n.id && v >= sh * 0.6) rivals.set(id, (rivals.get(id) || 0) + T.nodes[nd.id].retained); }
      const cand = [...rivals.entries()].filter(([id]) => !n.embargoes.some((e) => e.id === id) && !n.allies.includes(id) && (this.atWar(n.id, id) || this.opinion(id, n.id) < -40)).sort((a, b) => b[1] - a[1]);
      if (cand.length) this.embargo(n.id, cand[0][0]);
      else {
        const f = this.neighbours(n.id).filter((id) => !n.tradeAgreements.includes(id) && s.nations[id]?.alive && this.opinion(id, n.id) > 25);
        if (f.length) this.tradeAgreement(n.id, f[Math.floor(this.rng() * f.length)]);
      }
    }
    if (n.gold > 150 && this.rng() < 0.1) {
      // build where the trade is rich: sample provinces and pick the best harbour or market site
      const own = this.ownedProvinces(n.id), nm = this._nodeMap();
      let bp = -1, bt = '', bv = 0;
      for (let i = 0; i < 24 && own.length; i++) {
        const p = own[Math.floor(this.rng() * own.length)], pr = s.prov[p], sp = this.map.provinces[p];
        const type = sp.coastal && !(pr.buildings.port) ? 'port' : 'market';
        const v = T.nodes[TRADE_NODES[nm[p]].id].retained * (1 + pr.dev / 10) / (1 + (pr.buildings[type] || 0));
        if (v > bv && !this.canBuild(n.id, p, type)) { bv = v; bp = p; bt = type; }
      }
      if (bp >= 0) this.build(n.id, bp, bt);
    }
  },
};
