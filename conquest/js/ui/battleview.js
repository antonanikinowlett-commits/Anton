// Real-time battle viewer: regiments drawn as formed blocks of men that deploy, loose
// volleys, charge, clash, wheel onto the flanks and rout, driven by the live battle state.
import { el, fmt, pct, clamp, mulberry32, hexToRgb } from '../util.js';
import { coaSVG, rebelCoa } from './heraldry.js';
import { portraitSVG } from './portrait.js';
import { UNITS } from '../data/units.js';
import { TACTICS, PHASES, PHASE_NAMES, DOCTRINES } from '../data/tactics.js';
import { TRAITS } from '../data/traits.js';

const FW = 1000, FH = 600;
const TCOL = { farmland: '#8f9a52', plains: '#7f9a4c', steppe: '#b3a868', forest: '#4f6e3a', taiga: '#4a6448', hills: '#8a8456', mountains: '#7c7466', marsh: '#5c6c4c', desert: '#d2b884' };

export class BattleViewer {
  constructor(ui) { this.ui = ui; this.isOpen = false; this.vis = new WeakMap(); this.parts = []; }
  get g() { return this.ui.g; }

  open(id) {
    const b = this.g.s.battles[id];
    if (!b) return;
    if (this.isOpen) this.close();
    this.b = b; this.isOpen = true;
    this.vis = new WeakMap(); this.parts = []; this.arrows = [];
    this.lastRound = -1; this.bg = null;
    this.root = el('div', { id: 'battle' });
    const bv = el('div', { class: 'bv frame' });
    this.head = el('div', { class: 'bvh' });
    this.leftEl = el('div', { class: 'bside scroll' });
    this.rightEl = el('div', { class: 'bside scroll' });
    this.cv = el('canvas', {});
    this.logEl = el('div', { class: 'blog scroll' });
    const body = el('div', { class: 'bvb', style: { position: 'relative' } }, this.leftEl, this.cv, this.rightEl);
    this.resultEl = el('div', { class: 'bresult frame hidden' });
    body.append(this.resultEl);
    bv.append(this.head, body, this.logEl);
    this.root.append(bv);
    this.root.addEventListener('pointerdown', (e) => { if (e.target === this.root) this.close(); });
    document.body.append(this.root);
    this.renderHead();
    this.ui.emit('battleViewer', id);
  }
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.remove();
    this.ui.emit('battleViewerClosed');
  }

  renderHead() {
    const b = this.b, g = this.g;
    const sp = g.map.provinces[b.prov];
    const W = { clear: '☀ Clear', rain: '🌧 Rain', fog: '🌫 Fog', snow: '❄ Snow', heat: '🔥 Heat' }[b.weather];
    const tags = [`<span class="chip">${sp.terrain}</span>`, `<span class="chip" data-tip="Rain: missiles −30%, charges −25%. Fog: missiles −45%. Snow: −10% attack, morale. Heat: non-native troops suffer.">${W}</span>`];
    if (b.river) tags.push('<span class="chip bad" data-tip="Attacker crossing a river: −25% attack, −30% charge, narrower front">〰 River crossing</span>');
    if (b.highGround) tags.push('<span class="chip" data-tip="Defender on higher ground: +12% defence; attacker −12% attack and −15% missiles">⛰ High ground</span>');
    if (b.fort) tags.push('<span class="chip" data-tip="Defending under their own walls: +15% defence and steadier morale">🏰 Fortified</span>');
    if (b.landing) tags.push('<span class="chip bad" data-tip="Attacking straight from the ships: −30% attack">⛵ Amphibious landing</span>');
    tags.push(`<span class="chip" data-tip="Frontage: how many regiments can fight at once (terrain-dependent). Extra regiments wait in reserve; a wider line can envelop the enemy.">↔ Frontage ${g.frontWidth(b)}</span>`);
    this.head.innerHTML = `<div class="frame-title">⚔ Battle of ${sp.name}</div><div class="row wrap grow">${tags.join('')}</div>`;
    this.phaseEl = el('div', { class: 'chip', style: { fontSize: '13px' } });
    this.head.append(this.phaseEl);
    const pl = g.s.player;
    const mySide = this.sideOf(pl);
    if (mySide && !b.over) {
      const lead = g.s.armies[b[mySide][0]];
      if (lead) {
        const sel = el('select', { onchange: (e) => { for (const id of b[mySide]) { const a = g.s.armies[id]; if (a && a.nation === pl) a.doctrine = e.target.value; } } });
        for (const [k, d] of Object.entries(DOCTRINES)) sel.append(el('option', { value: k, selected: lead.doctrine === k ? 'selected' : null }, d.name));
        sel._tip = () => 'Change doctrine: affects the tactic your general picks at the next phase.';
        this.head.append(sel);
        this.head.append(el('div', { class: 'btn small danger', onclick: () => { g.withdrawBattle(b.id, mySide); }, 'data-tip': 'Order a fighting withdrawal: you lose the battle but the pursuit is far less deadly.' }, '↩ Withdraw'));
      }
    }
    this.head.append(el('span', { class: 'x', onclick: () => this.close() }, '✕'));
  }
  sideOf(nid) {
    const b = this.b, s = this.g.s;
    if (b.att.some((i) => s.armies[i]?.nation === nid) || b.attN === nid) return 'att';
    if (b.def.some((i) => s.armies[i]?.nation === nid) || b.defN === nid) return 'def';
    return null;
  }

  renderSide(side, E) {
    const b = this.b, g = this.g, s = g.s;
    const nid = side === 'att' ? b.attN : b.defN;
    const n = nid >= 0 ? s.nations[nid] : null;
    const armies = b[side].map((i) => s.armies[i]).filter(Boolean);
    const lead = armies[0];
    const gen = lead ? g.generalOf(lead) : null;
    const men = g.sideMen(b, side, true), all = g.sideMen(b, side);
    const mor = g.sideMorale(b, side);
    let h = `<div class="row">${n ? coaSVG(n.coa, 34) : rebelCoa(34)}<div><div class="frame-title" style="font-size:13px">${side === 'att' ? 'Attacker' : 'Defender'}</div><div>${n ? n.name : 'Rebels'}</div></div></div>`;
    h += `<div class="gen"><span class="portrait">${portraitSVG(gen, g, 44)}</span><div class="small">${gen ? `<b>${g.charName(gen)}</b><br>⚔${gen.gen.atk} 🛡${gen.gen.def} ♟${gen.gen.tactics}<br>${gen.traits.filter((t) => TRAITS[t]).map((t) => TRAITS[t].icon).join(' ')}` : '<span class="neg">No commander</span>'}</div></div>`;
    h += `<div class="small">Fighting: <b>${fmt(men)}</b> / ${fmt(all)} · started ${fmt(b.startMen[side])}</div>`;
    h += `<div class="small">Casualties: <b class="neg">${fmt(b.cas[side])}</b></div>`;
    h += `<div class="small">Morale ${pct(mor)}</div><div class="bar ${mor < 0.3 ? 'red' : 'green'}"><i style="width:${mor * 100}%"></i></div>`;
    const comp = { inf: 0, rng: 0, cav: 0, siege: 0 };
    for (const a of armies) for (const r of a.regs) if (!r.routed) comp[UNITS[r.type].cls]++;
    h += `<div class="small muted">🛡 ${comp.inf} infantry · 🏹 ${comp.rng} missile · 🐎 ${comp.cav} horse${comp.siege ? ' · ⚙ ' + comp.siege : ''}</div>`;
    h += `<div class="section" style="margin-top:4px">Tactics</div>`;
    for (const ph of PHASES) {
      const t = b.tac[side][ph];
      if (!t) continue;
      const T = TACTICS[t];
      const ctr = b.countered[side][ph], other = b.countered[side === 'att' ? 'def' : 'att'][ph];
      h += `<div class="btac ${ctr ? 'countered' : other ? 'counters' : ''}" data-tip="<b>${T.name}</b> <i>(${T.hist})</i><br>${T.desc}${T.counters.length ? '<br><span class=muted>Countered by: ' + T.counters.map((c) => TACTICS[c]?.name || c).join(', ') + '</span>' : ''}">
        <div class="ph2">${PHASE_NAMES[ph]}</div><b>${T.name}</b>${ctr ? ' <span class="neg">✘ countered</span>' : other ? ' <span class="pos">★ counters</span>' : ''}<div class="tiny muted">${T.hist}</div></div>`;
    }
    h += `<div class="section" style="margin-top:4px">Armies</div>` + armies.map((a) => `<div class="small">${a.name} · ${fmt(g.armyMen(a))}</div>`).join('');
    E.innerHTML = h;
  }

  update() {
    if (!this.isOpen) return;
    const b = this.b, g = this.g;
    const now = performance.now();
    if (b.round !== this.lastRound) {
      this.lastRound = b.round;
      this.renderSide('att', this.leftEl); this.renderSide('def', this.rightEl);
      this.phaseEl.textContent = b.over ? 'Battle over' : `${PHASE_NAMES[b.phase]} · day ${Math.floor((b.round - 1) / 4) + 1}, round ${b.round}`;
      this.logEl.innerHTML = b.log.slice(-40).map((l) => `<div class="${l.t.startsWith('★') ? 'star' : ''}">${l.t}</div>`).join('');
      this.logEl.scrollTop = 1e6;
      for (const f of b.fx || []) this.spawnFx(f);
      if (b.over) this.showResult();
    }
    this.draw(now);
  }
  showResult() {
    const b = this.b, g = this.g, s = g.s;
    const pl = s.player;
    const mySide = this.sideOf(pl);
    const win = b.winner;
    const title = mySide ? (mySide === win ? 'Victory!' : 'Defeat') : `${win === 'att' ? 'Attackers' : 'Defenders'} victorious`;
    const col = mySide ? (mySide === win ? '#8ad070' : '#e06a50') : '#f0d48a';
    this.resultEl.classList.remove('hidden');
    this.resultEl.innerHTML = `<div class="big" style="color:${col}">${title}</div><div style="margin-top:6px">Casualties — attacker ${fmt(b.cas.att)} · defender ${fmt(b.cas.def)}</div>
      <div class="small muted" style="margin-top:4px">${b.log.slice(-2).map((l) => l.t).join('<br>')}</div><div class="btn" style="margin-top:10px" onclick="this.closest('#battle').dispatchEvent(new PointerEvent('pointerdown'))">Close</div>`;
    this.resultEl.querySelector('.btn').onclick = () => this.close();
  }

  // ── visual simulation
  layout() {
    const b = this.b;
    const T = {};
    const phaseGap = b.over ? 30 : b.phase === 'opening' ? 210 : b.phase === 'engage' ? 70 : 16;
    for (const side of ['att', 'def']) {
      const L = b.lines[side];
      if (!L) continue;
      const sg = side === 'att' ? -1 : 1;
      const frontX = FW / 2 + sg * phaseGap;
      const slotY = (list, y0, y1) => list.map((x, i) => [x, y0 + (y1 - y0) * (i + 0.5) / Math.max(1, list.length)]);
      // the attacker's left wing faces the defender's right: both at the top
      const top = side === 'att' ? L.left : L.right, bot = side === 'att' ? L.right : L.left;
      const flankTop = (b.fx || []).some((f) => f.side === side && (f.type === 'flank' && f.wing === (side === 'att' ? 'left' : 'right') || f.type === 'envelop'));
      const flankBot = (b.fx || []).some((f) => f.side === side && (f.type === 'flank' && f.wing === (side === 'att' ? 'right' : 'left') || f.type === 'envelop'));
      const charging = b.phase === 'engage';
      for (const [x, y] of slotY(top, 60, 170)) T[key(x)] = { x: frontX + (charging ? -sg * 30 : 0) - (flankTop ? sg * 70 : 0), y: flankTop ? y + 90 : y, item: x, side };
      for (const [x, y] of slotY(L.center, 185, 415)) T[key(x)] = { x: frontX, y, item: x, side };
      for (const [x, y] of slotY(bot, 430, 540)) T[key(x)] = { x: frontX + (charging ? -sg * 30 : 0) - (flankBot ? sg * 70 : 0), y: flankBot ? y - 90 : y, item: x, side };
      for (const [x, y] of slotY(L.ranged, 150, 450)) T[key(x)] = { x: frontX + sg * 62, y, item: x, side };
      for (const [x, y] of slotY(L.reserve, 120, 480)) T[key(x)] = { x: frontX + sg * 135, y, item: x, side };
      for (const [x, y] of slotY(L.siege, 200, 400)) T[key(x)] = { x: frontX + sg * 200, y, item: x, side };
      for (const [x, y] of slotY(L.routed, 80, 520)) T[key(x)] = { x: FW / 2 + sg * 560, y, item: x, side, routed: true };
    }
    return T;
  }
  spawnFx(f) {
    const b = this.b;
    if (f.type === 'volley') {
      const L = b.lines[f.side], E = b.lines[f.side === 'att' ? 'def' : 'att'];
      if (!L || !E) return;
      const shooters = [...L.ranged, ...L.left, ...L.right].filter((x) => UNITS[x.r.type].ranged > 0);
      const targets = [...E.left, ...E.center, ...E.right];
      if (!targets.length) return;
      for (let i = 0; i < Math.min(40, shooters.length * 6); i++) {
        const s0 = this.vis.get(shooters[i % shooters.length].r), t0 = this.vis.get(targets[Math.floor(Math.random() * targets.length)].r);
        if (!s0 || !t0) continue;
        this.arrows.push({ x0: s0.x + (Math.random() - 0.5) * 20, y0: s0.y + (Math.random() - 0.5) * 30, x1: t0.x + (Math.random() - 0.5) * 24, y1: t0.y + (Math.random() - 0.5) * 30, t: -Math.random() * 0.5, d: 0.6 + Math.random() * 0.3 });
      }
    }
    if (f.type === 'charge' || f.type === 'flank' || f.type === 'envelop') {
      for (let i = 0; i < 30; i++) this.parts.push({ x: FW / 2 + (Math.random() - 0.5) * 120, y: f.wing === 'left' ? 120 : f.wing === 'right' ? 480 : 300 + (Math.random() - 0.5) * 200, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, life: 1.2, c: 'dust' });
    }
  }
  drawBackground(ctx, w, h) {
    const b = this.b;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const r = mulberry32(b.id * 13 + 7);
    const sx = w / FW, sy = h / FH;
    x.fillStyle = TCOL[b.terrain] || '#7f9a4c';
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      x.fillStyle = `rgba(${r() < 0.5 ? '255,250,220' : '20,30,10'},${0.03 + r() * 0.05})`;
      x.beginPath(); x.ellipse(r() * w, r() * h, 20 + r() * 80, 10 + r() * 40, r() * 3, 0, 7); x.fill();
    }
    if (b.terrain === 'farmland') for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${200 + r() * 40},${180 + r() * 30},90,0.25)`; x.fillRect(r() * w, r() * h, 60 + r() * 120, 30 + r() * 50); }
    if (b.terrain === 'hills' || b.terrain === 'mountains' || b.highGround) {
      for (let i = 0; i < 12; i++) {
        const cx = (b.highGround ? FW * 0.6 + r() * FW * 0.4 : r() * FW) * sx, cy = r() * h;
        const g2 = x.createRadialGradient(cx, cy, 5, cx, cy, 160 * sx);
        g2.addColorStop(0, b.terrain === 'mountains' ? 'rgba(160,150,140,.5)' : 'rgba(140,130,80,.45)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g2; x.beginPath(); x.ellipse(cx, cy, 180 * sx, 110 * sy, 0, 0, 7); x.fill();
      }
    }
    if (b.terrain === 'marsh') for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(60,90,110,.45)'; x.beginPath(); x.ellipse(r() * w, r() * h, 10 + r() * 40, 5 + r() * 15, r() * 3, 0, 7); x.fill(); }
    if (b.terrain === 'desert') { x.strokeStyle = 'rgba(160,120,70,.25)'; x.lineWidth = 2; for (let i = 0; i < 30; i++) { const y0 = r() * h; x.beginPath(); x.moveTo(0, y0); for (let k = 0; k < w; k += 30) x.lineTo(k, y0 + Math.sin(k / 70 + i) * 12); x.stroke(); } }
    if (b.terrain === 'steppe' || b.terrain === 'plains') { x.strokeStyle = 'rgba(60,80,20,.2)'; for (let i = 0; i < 400; i++) { const px = r() * w, py = r() * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 2, py - 6); x.stroke(); } }
    const trees = b.terrain === 'forest' || b.terrain === 'taiga' ? 260 : b.terrain === 'marsh' || b.terrain === 'hills' ? 60 : 18;
    for (let i = 0; i < trees; i++) {
      let px = r() * FW, py = r() * FH;
      if (Math.abs(py - 300) < 230 && Math.abs(px - 500) < 260 && trees > 100 && r() < 0.7) py = r() < 0.5 ? r() * 60 : FH - r() * 60;
      const tr = 9 + r() * 10;
      x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(px * sx + 4, py * sy + 5, tr * sx, tr * sy * 0.6, 0, 0, 7); x.fill();
      x.fillStyle = b.terrain === 'taiga' ? '#2e4a30' : `rgb(${50 + r() * 30},${85 + r() * 40},${40 + r() * 20})`;
      x.beginPath(); x.arc(px * sx, py * sy, tr * sx, 0, 7); x.fill();
    }
    if (b.river) {
      x.strokeStyle = '#4a7aa0'; x.lineWidth = 34 * sx;
      x.beginPath(); for (let yy = -10; yy <= FH + 10; yy += 20) { const xx = (FW / 2 - 110 + Math.sin(yy / 60) * 18) * sx; yy === -10 ? x.moveTo(xx, yy * sy) : x.lineTo(xx, yy * sy); } x.stroke();
      x.strokeStyle = 'rgba(200,230,255,.25)'; x.lineWidth = 3; x.stroke();
    }
    if (b.fort) {
      x.fillStyle = '#9a9488'; x.strokeStyle = '#5a564e'; x.lineWidth = 3;
      x.fillRect(FW * 0.88 * sx, 220 * sy, 90 * sx, 160 * sy); x.strokeRect(FW * 0.88 * sx, 220 * sy, 90 * sx, 160 * sy);
      for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(FW * 0.88 * sx + (k % 2) * 90 * sx, 220 * sy + Math.floor(k / 2) * 160 * sy, 16 * sx, 0, 7); x.fill(); x.stroke(); }
    }
    const vg = x.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.9);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
    x.fillStyle = vg; x.fillRect(0, 0, w, h);
    return c;
  }
  draw(now) {
    const b = this.b, g = this.g, s = g.s;
    const cv = this.cv;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth * dpr | 0, h = cv.clientHeight * dpr | 0;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; this.bg = null; }
    const ctx = cv.getContext('2d');
    if (!this.bg) this.bg = this.drawBackground(ctx, w, h);
    ctx.drawImage(this.bg, 0, 0);
    const sx = w / FW, sy = h / FH;
    const dt = Math.min(0.05, (now - (this.lastT || now)) / 1000);
    this.lastT = now;
    const t = now / 1000;
    const T = this.layout();
    const nationCol = (side) => { const nid = side === 'att' ? b.attN : b.defN; return nid >= 0 ? s.nations[nid].color : '#202020'; };
    // regiments
    const blocks = [];
    for (const k of Object.keys(T)) {
      const tg = T[k];
      const r = tg.item.r;
      let v = this.vis.get(r);
      if (!v) { const sg = tg.side === 'att' ? -1 : 1; v = { x: FW / 2 + sg * 420, y: tg.y, a: 1 }; this.vis.set(r, v); }
      const u = UNITS[r.type];
      const speed = (u.cls === 'cav' ? 160 : 70) * (tg.routed ? 2.2 : 1);
      const dx = tg.x - v.x, dy = tg.y - v.y, dd = Math.hypot(dx, dy);
      if (dd > 1) { const st = Math.min(dd, speed * dt * (b.phase === 'engage' && u.cls === 'cav' ? 2.2 : 1)); v.x += dx / dd * st; v.y += dy / dd * st; v.moving = true; } else v.moving = false;
      v.a = tg.routed ? Math.max(0.15, v.a - dt * 0.5) : Math.min(1, v.a + dt);
      blocks.push([v, r, tg]);
    }
    const contact = b.phase !== 'opening' && !b.over;
    for (const [v, r, tg] of blocks) {
      const u = UNITS[r.type];
      const col = hexToRgb(nationCol(tg.side));
      const bw = u.cls === 'cav' ? 34 : 26, bh = clamp(10 + r.men / (u.men === 500 ? 500 : 1000) * 34, 8, 52);
      const jx = contact && !tg.routed && Math.abs(v.x - FW / 2) < 60 ? Math.sin(t * 18 + v.y) * 2 : 0;
      const cx = (v.x + jx) * sx, cy = v.y * sy;
      ctx.globalAlpha = v.a;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(cx - bw * sx / 2 + 3, cy - bh * sy / 2 + 4, bw * sx, bh * sy);
      // men as dots
      const dots = clamp(Math.round(r.men / 45), 2, 44);
      const cols = u.cls === 'cav' ? 4 : 3;
      const rows = Math.ceil(dots / cols);
      const rng = mulberry32(r.max + Math.round(r.morale * 10));
      for (let i = 0; i < dots; i++) {
        const c2 = i % cols, rr = Math.floor(i / cols);
        let px = cx + (c2 - (cols - 1) / 2) * (bw * sx / cols), py = cy + (rr - (rows - 1) / 2) * (bh * sy / Math.max(1, rows));
        if (tg.routed) { px += (rng() - 0.5) * 30 * sx; py += (rng() - 0.5) * 40 * sy; }
        else if (v.moving) py += Math.sin(t * 10 + i) * 0.8;
        ctx.fillStyle = `rgb(${col[0] * 0.85 | 0},${col[1] * 0.85 | 0},${col[2] * 0.85 | 0})`;
        if (u.cls === 'cav') { ctx.fillStyle = '#5a3e26'; ctx.fillRect(px - 3 * sx, py - 1.5 * sy, 6 * sx, 3 * sy); ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`; ctx.beginPath(); ctx.arc(px, py - 2 * sy, 1.8 * sx, 0, 7); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(px, py, 2.1 * sx, 0, 7); ctx.fill(); if (u.cls === 'rng') { ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(px + 2 * sx, py, 2.5 * sx, -1.2, 1.2); ctx.stroke(); } else { ctx.strokeStyle = '#c8c0b0'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (tg.side === 'att' ? 5 : -5) * sx, py - 3 * sy); ctx.stroke(); } }
      }
      // banner & morale
      ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      const fx = cx + (tg.side === 'att' ? -bw * sx / 2 - 4 : bw * sx / 2 + 4), fy = cy - bh * sy / 2 - 10 * sy;
      ctx.beginPath(); ctx.moveTo(fx, cy - bh * sy / 2); ctx.lineTo(fx, fy - 6 * sy); ctx.stroke();
      ctx.fillRect(fx, fy - 6 * sy, 12 * sx * (tg.side === 'att' ? 1 : -1), 8 * sy);
      ctx.font = `${Math.max(9, 11 * sx)}px serif`; ctx.textAlign = 'center';
      ctx.fillStyle = '#fff'; ctx.fillText(u.icon, cx, cy - bh * sy / 2 - 3 * sy);
      ctx.fillStyle = '#000'; ctx.fillRect(cx - bw * sx / 2, cy + bh * sy / 2 + 2, bw * sx, 3);
      ctx.fillStyle = r.morale > 0.5 ? '#7ac050' : r.morale > 0.25 ? '#d0b040' : '#d04a30';
      ctx.fillRect(cx - bw * sx / 2, cy + bh * sy / 2 + 2, bw * sx * clamp(r.morale, 0, 1), 3);
      ctx.globalAlpha = 1;
    }
    // clash line sparks & dust
    if (contact) {
      for (let i = 0; i < 3; i++) if (Math.random() < 0.6) this.parts.push({ x: FW / 2 + (Math.random() - 0.5) * 30, y: 70 + Math.random() * 460, vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 40, life: 0.35, c: 'spark' });
      if (Math.random() < 0.5) this.parts.push({ x: FW / 2 + (Math.random() - 0.5) * 50, y: 70 + Math.random() * 460, vx: (Math.random() - 0.5) * 20, vy: -10, life: 1.5, c: 'dust' });
    }
    if (!b.over && b.phase !== 'melee' && Math.random() < 0.25) {
      for (const side of ['att', 'def']) {
        const L = b.lines[side];
        if (L && L.ranged.length && Math.random() < 0.5) this.spawnFx({ type: 'volley', side });
      }
    }
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    this.parts = this.parts.filter((p) => p.life > 0).slice(-400);
    for (const p of this.parts) {
      if (p.c === 'spark') { ctx.fillStyle = `rgba(255,230,150,${p.life * 2.5})`; ctx.fillRect(p.x * sx, p.y * sy, 2, 2); }
      else { ctx.fillStyle = `rgba(200,180,140,${p.life * 0.12})`; ctx.beginPath(); ctx.arc(p.x * sx, p.y * sy, (12 + (1.5 - p.life) * 20) * sx, 0, 7); ctx.fill(); }
    }
    // arrows
    ctx.strokeStyle = 'rgba(30,20,10,.85)'; ctx.lineWidth = 1.2;
    for (const a of this.arrows) {
      a.t += dt / a.d;
      if (a.t < 0 || a.t > 1) continue;
      const x = a.x0 + (a.x1 - a.x0) * a.t, y = a.y0 + (a.y1 - a.y0) * a.t - Math.sin(a.t * Math.PI) * 70;
      const x2 = a.x0 + (a.x1 - a.x0) * (a.t - 0.04), y2 = a.y0 + (a.y1 - a.y0) * (a.t - 0.04) - Math.sin((a.t - 0.04) * Math.PI) * 70;
      ctx.beginPath(); ctx.moveTo(x2 * sx, y2 * sy); ctx.lineTo(x * sx, y * sy); ctx.stroke();
    }
    this.arrows = this.arrows.filter((a) => a.t < 1).slice(-500);
    // weather
    if (b.weather === 'rain' || b.weather === 'snow') {
      ctx.strokeStyle = b.weather === 'rain' ? 'rgba(200,210,230,.35)' : 'rgba(255,255,255,.8)';
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 160; i++) {
        const px = ((i * 97.3 + t * (b.weather === 'rain' ? 60 : 15)) % FW) * sx, py = ((i * 53.1 + t * (b.weather === 'rain' ? 400 : 40)) % FH) * sy;
        if (b.weather === 'rain') { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 3, py + 12); ctx.stroke(); } else { ctx.fillRect(px, py, 2, 2); }
      }
    }
    if (b.weather === 'fog') { ctx.fillStyle = 'rgba(220,225,225,.28)'; ctx.fillRect(0, 0, w, h); }
    if (b.weather === 'heat') { ctx.fillStyle = 'rgba(255,200,120,.08)'; ctx.fillRect(0, 0, w, h); }
    // phase banner
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(w / 2 - 120 * dpr, 6 * dpr, 240 * dpr, 24 * dpr);
    ctx.fillStyle = '#f0d48a'; ctx.font = `${14 * dpr}px Cinzel, serif`; ctx.textAlign = 'center';
    ctx.fillText(b.over ? 'THE FIELD IS WON' : PHASE_NAMES[b.phase].toUpperCase(), w / 2, 23 * dpr);
    // strength bar
    const ma = g.sideMen(b, 'att', true), md = g.sideMen(b, 'def', true);
    ctx.fillStyle = nationCol('att'); ctx.fillRect(10 * dpr, h - 14 * dpr, (w - 20 * dpr) * ma / Math.max(1, ma + md), 8 * dpr);
    ctx.fillStyle = nationCol('def'); ctx.fillRect(10 * dpr + (w - 20 * dpr) * ma / Math.max(1, ma + md), h - 14 * dpr, (w - 20 * dpr) * md / Math.max(1, ma + md), 8 * dpr);
  }
}
function key(x) { return x.a + ':' + x.i; }
