// Progress panel: innovations grid (branch x era), realm rank, ambitions, achievements and score.
import { el } from '../../util.js';
import { iconize, icon, EMOJI } from '../icons.js';
// ico() swaps mapped emoji for SVG icons; give them an explicit size (no global .ic rule yet).
const ico = (html, px = 16) => iconize(html).replace(/<svg class="ic[^"]*"(?! style)/g, (m) => `${m} style="width:${px}px;height:${px}px;vertical-align:-3px"`);
import { registerPanel } from './registry.js';
import { H, subtabs, barHTML } from './common.js';
import { INNOVATIONS, INNOV, BRANCHES, ERAS } from '../../data/innovations.js';
import { RANKS, RANK_ICONS, AMBITIONS, AMBITION_ORDER, ACHIEVEMENTS, END_YEAR } from '../../sim/progression.js';
import { FORMABLES } from '../../data/formables.js';
import { UNITS } from '../../data/units.js';

// Always an SVG icon: the mapped one for an emoji, else a fallback glyph.
const sic = (emoji, fb = 'star', px = 16) => icon(EMOJI[String(emoji).replace(/\uFE0F/g, '')] || fb, { size: px }).replace('style="', 'style="vertical-align:-3px;');
const FALLBACK = { military: 'swords', civic: 'scroll', agri: 'wheat', sea: 'anchor' };
const MOD_LABELS = {
  taxMult: ['Tax income', 1], tradeMult: ['Trade income', 1], foodMult: ['Food', 1], devGrowth: ['Development growth', 1], buildCost: ['Building cost', 1], buildSpeed: ['Build speed', 1],
  siege: ['Siege power', 0], fortDefense: ['Fort defence', 1], supply: ['Supply', 1], seaSpeed: ['Sea speed', 1], rangedAtk: ['Ranged attack', 1], cavAtk: ['Cavalry attack', 1],
  infAtk: ['Infantry attack', 1], infDef: ['Infantry defence', 1], discipline: ['Discipline', 1], armyMorale: ['Army morale', 1], manpowerMult: ['Manpower', 1], focusSpeed: ['Focus speed', 1],
  legitimacyMonthly: ['Legitimacy / month', 100], researchSpeed: ['Research speed', 1], horsesMult: ['Horses', 1], prestigeMonthly: ['Prestige / month', 100], stabilityMonthly: ['Stability / month', 100],
  unrest: ['Unrest', 0], diplo: ['Diplomacy', 0], claimSpeed: ['Claim speed', 1], clergyLoyalty: ['Clergy loyalty', 0],
};
const modText = (mods) => Object.entries(mods || {}).map(([k, v]) => {
  const [name, pct] = MOD_LABELS[k] || [k, 0];
  const val = pct === 1 ? `${v > 0 ? '+' : ''}${Math.round(v * 100)}%` : pct === 100 ? `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}` : `${v > 0 ? '+' : ''}${+v.toFixed(2)}`;
  const bad = (k === 'unrest' || k === 'buildCost') ? v > 0 : v < 0;
  return `<span class="${bad ? 'neg' : 'pos'}">${val}</span> ${name}`;
}).join('<br>');

function innovTip(g, nid, i, state) {
  const inf = g.innovInfo(nid, i.id), n = g.s.nations[nid];
  let h = `<div class="tt-title">${sic(i.icon, FALLBACK[i.branch])} ${i.name}</div><div class="muted small">${BRANCHES[i.branch].name} · ${ERAS[i.era].name} · c. ${i.year}</div><p>${i.desc}</p>`;
  h += inf.effects.map((l) => `<div class="${l.good ? 'pos' : 'neg'}">${l.text}</div>`).join('');
  if (i.pre.length) h += `<div class="muted">Requires: ${i.pre.map((p) => (n.prog.known.includes(p) ? '<span class="pos">' : '<span class="neg">') + INNOV[p].name + '</span>').join(', ')}</div>`;
  if (inf.block && state !== 'done') h += `<div class="neg">${inf.block.text}</div>`;
  if (state === 'avail' && inf.forfeits.length) h += `<div class="neg">Choosing this permanently closes: ${inf.forfeits.join(', ')}</div>`;
  if (state === 'done' && i.excl.length) h += `<div class="muted">Closed off: ${i.excl.map((x) => INNOV[x].name).join(', ')}</div>`;
  if (state === 'avail' || state === 'now') h += `<div class="muted">Cost ${inf.cost} points (~${inf.months} months)<br>${inf.breakdown.map(([t, v]) => `${t}: ${v > 0 ? '+' : ''}${v}`).join(' · ')}</div>`;
  return h;
}

// ── technology graph: one branch at a time, eras as columns, prerequisite links drawn as curves
const NODE_W = 196, NODE_H = 76, GAP_Y = 12, TOP = 66, LEFT = 20;
const BRANCH_ICON = { military: 'swords', civic: 'scroll', agri: 'wheat', sea: 'anchor' };
const ERA_ICON = ['hourglass', 'castle', 'cap'];
const shortMods = (mods) => {
  const first = Object.entries(mods || {})[0];
  if (!first) return '';
  const [k, v] = first, [name, pct] = MOD_LABELS[k] || [k, 0];
  const val = pct === 1 ? `${v > 0 ? '+' : ''}${Math.round(v * 100)}%` : pct === 100 ? `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}` : `${v > 0 ? '+' : ''}${+v.toFixed(2)}`;
  const more = Object.keys(mods).length - 1;
  return `${val} ${name}${more > 0 ? ` +${more}` : ''}`;
};

function renderInnovations(ui, pb, g, n) {
  const p = n.prog, cur = p.cur ? INNOV[p.cur] : null;
  const branch = ui.subtab.techBranch && BRANCHES[ui.subtab.techBranch] ? ui.subtab.techBranch : (cur ? cur.branch : 'military');
  // header: current research and rate
  const top = el('div', { class: 'row', style: { gap: '12px', marginBottom: '12px', alignItems: 'stretch' } });
  const now = el('div', { class: 'card hl grow' });
  if (cur) {
    const c = g.innovCost(n.id, cur.id), left = Math.max(0, c - p.pts), months = p.rp > 0 ? Math.ceil(left / p.rp) : '∞';
    now.innerHTML = ico(`<div class="row"><span class="tn-ic ic-gold" style="display:inline-flex">${sic(cur.icon, FALLBACK[cur.branch], 26)}</span><div class="grow"><div class="tag">Researching</div><div style="font-family:var(--display);font-size:24px;font-weight:700;line-height:1.1">${cur.name}</div><div class="small muted">${shortMods(cur.mods)}</div></div>
      <div style="text-align:right"><div class="stat" style="background:none;border:0;padding:0"><b>${months}</b>months left</div></div></div>`) + `<div style="margin-top:8px">${barHTML(p.pts / c, 'blue')}</div><div class="tiny muted" style="margin-top:3px">${Math.floor(p.pts)} / ${c} points · +${p.rp.toFixed(1)} per month</div>`;
  } else now.innerHTML = ico(`<div class="row"><span class="ic-red" style="display:inline-flex">${icon('flask', { size: 30 })}</span><div class="grow"><div style="font-family:var(--display);font-size:22px;font-weight:700">Nothing is being researched</div><div class="small muted">+${g.researchRate(n.id).toFixed(1)} points per month${p.pts > 0 ? ` (${Math.floor(p.pts)} banked)` : ''}. Pick a glowing innovation below.</div></div></div>`);
  top.append(now);
  pb.append(top);
  // branch selector
  const sel = el('div', { class: 'grid2', style: { gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '12px' } });
  for (const b of Object.keys(BRANCHES)) {
    const all = INNOVATIONS.filter((x) => x.branch === b), done = all.filter((x) => p.known.includes(x.id)).length;
    const avail = all.some((x) => g.innovAvailable(n.id, x.id));
    const c = el('div', { class: 'card click' + (b === branch ? ' hl' : '') , onclick: () => { ui.subtab.techBranch = b; ui.renderPanel(true); } });
    c.innerHTML = ico(`<div class="row"><span class="${b === branch ? 'ic-gold' : 'muted'}">${icon(BRANCH_ICON[b], { size: 22 })}</span><div class="grow"><b>${BRANCHES[b].name}</b><div class="tiny muted">${done} of ${all.length} known</div></div>${avail && !cur ? '<span class="chip warn">ready</span>' : ''}</div>`) + `<div style="margin-top:6px">${barHTML(done / all.length, 'green')}</div>`;
    sel.append(c);
  }
  pb.append(sel);
  // layout
  const nodes = INNOVATIONS.filter((x) => x.branch === branch);
  const rowOf = {};
  for (let e = 0; e < ERAS.length; e++) {
    const list = nodes.filter((x) => x.era === e);
    const key = (x) => (x.pre.length ? x.pre.reduce((t, q) => t + (rowOf[q] ?? 0), 0) / x.pre.length : nodes.indexOf(x) % 5);
    list.sort((a, b2) => key(a) - key(b2) || nodes.indexOf(a) - nodes.indexOf(b2));
    // choices that exclude each other sit next to one another, joined by an "or"
    const seq = [], put = new Set();
    for (const x of list) {
      if (put.has(x.id)) continue;
      seq.push(x); put.add(x.id);
      for (const q of x.excl || []) { const y = INNOV[q]; if (y && y.branch === x.branch && y.era === x.era && !put.has(y.id)) { seq.push(y); put.add(y.id); } }
    }
    seq.forEach((x, i) => { rowOf[x.id] = i; });
  }
  const avail = Math.max(760, (ui.panel.clientWidth || 1000) - 48);
  const GAP_X = Math.max(100, Math.min(260, (avail - LEFT * 2 - ERAS.length * NODE_W) / (ERAS.length - 1)));
  const W = LEFT * 2 + ERAS.length * NODE_W + (ERAS.length - 1) * GAP_X, Hh = TOP + Math.max(5, ...ERAS.map((e, k) => nodes.filter((x) => x.era === k).length)) * (NODE_H + GAP_Y) + 10;
  const wrap = el('div', { class: 'tech-wrap', style: { height: Hh + 'px', minWidth: W + 'px' } });
  const pos = (x) => ({ x: LEFT + x.era * (NODE_W + GAP_X), y: TOP + rowOf[x.id] * (NODE_H + GAP_Y) });
  for (let e = 0; e < ERAS.length; e++) {
    const x0 = LEFT + e * (NODE_W + GAP_X) - GAP_X / 2 + (e ? 0 : -LEFT / 2);
    wrap.append(el('div', { class: 'tech-era', style: { left: (LEFT + e * (NODE_W + GAP_X) - 8) + 'px', width: (NODE_W + 16) + 'px', borderRight: '0' } },
      el('span', {}, ERAS[e].name), el('small', {}, `from ${ERAS[e].from}`)));
    void x0;
  }
  // links
  let svg = `<svg class="tech-svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}">`;
  for (const x of nodes) for (const q of x.pre) {
    const a = pos(INNOV[q]), b2 = pos(x);
    const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b2.x, y2 = b2.y + NODE_H / 2, mx = (x1 + x2) / 2;
    const ok = p.known.includes(q), tdone = p.known.includes(x.id);
    const col = tdone ? '#5cc08c' : ok && !p.known.some((k) => (x.excl || []).includes(k)) ? '#e8c56d' : '#3a4a66';
    svg += `<path d="M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" fill="none" stroke="${col}" stroke-width="${ok ? 2.4 : 1.6}" ${ok ? '' : 'stroke-dasharray="4 5"'} opacity="${ok ? 0.95 : 0.7}"/><circle cx="${x2}" cy="${y2}" r="3.5" fill="${col}"/>`;
  }
  wrap.insertAdjacentHTML('beforeend', svg + '</svg>');
  // "or" badges between mutually exclusive neighbours
  const orDone = new Set();
  for (const i of nodes) for (const q of i.excl || []) {
    const key2 = [i.id, q].sort().join('|');
    if (orDone.has(key2) || !(q in rowOf) || INNOV[q].branch !== branch) continue;
    orDone.add(key2);
    const a2 = pos(i), b3 = pos(INNOV[q]);
    if (a2.x !== b3.x) continue;
    const top2 = Math.min(a2.y, b3.y), bot = Math.max(a2.y, b3.y);
    const pair = Math.abs(a2.y - b3.y) <= NODE_H + GAP_Y + 1;
    wrap.append(el('div', { class: 'tech-or' + (pair ? '' : ' far'), style: { left: (a2.x + NODE_W / 2 - 17) + 'px', top: (pair ? top2 + NODE_H + GAP_Y / 2 - 9 : top2 + NODE_H - 9) + 'px' }, 'data-tip': 'Mutually exclusive: choosing one permanently closes the other' }, 'or'));
    void bot;
  }
  for (const i of nodes) {
    const { x, y } = pos(i);
    const inf = g.innovInfo(n.id, i.id);
    const state = inf.state;                                  // done | now | avail | closed | locked
    const done = state === 'done', isCur = state === 'now', avail = state === 'avail';
    const node = el('div', { class: 'tech-node ' + (isCur ? 'cur' : state), style: { left: x + 'px', top: y + 'px', width: NODE_W + 'px', height: NODE_H + 'px' }, onclick: avail ? () => { g.startResearch(n.id, i.id); ui.sfx?.('click'); ui.renderPanel(true); } : null });
    const cost = done ? '' : `<span class="ic-gold">${icon('flask', { size: 11 })}</span> ${inf.cost}`;
    const eff = inf.effects.length ? `<span class="${inf.effects[0].good ? '' : 'neg'}">${inf.effects[0].text}</span>${inf.effects.length > 1 ? ` <span class="muted">+${inf.effects.length - 1}</span>` : ''}` : '';
    node.innerHTML = ico(`<div class="tn-ic">${done ? icon('check') : state === 'closed' ? icon('ban') : state === 'locked' ? icon('lock') : sic(i.icon, FALLBACK[i.branch], 18)}</div>
      <div style="min-width:0;flex:1"><div class="tn-t">${i.name}</div><div class="tiny ${done ? 'pos' : ''}" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${eff}</div><div class="tn-c">${done ? 'Known' : isCur ? 'Researching…' : state === 'closed' ? 'Closed off' : cost}${i.unlock ? ` <span class="chip info" style="padding:0 6px;font-size:10px">unlock</span>` : ''}</div></div>`)
      + (isCur ? `<div class="tn-p"><i style="width:${Math.round(100 * p.pts / inf.cost)}%"></i></div>` : '');
    node._tip = () => innovTip(g, n.id, i, state);
    wrap.append(node);
  }
  pb.append(wrap);
}

function renderRank(ui, pb, g, n) {
  const inf = g.rankInfo(n.id);
  pb.append(H(ico(`<div class="card hl"><div class="frame-title" style="font-size:16px">${sic(RANK_ICONS[inf.rank])} ${n.name}: ${inf.name}</div>
    <div class="muted small">Rank brings diplomatic weight, legitimacy and tax. Ranks: ${RANKS.map((r, k) => (k === inf.rank ? `<b class="gold">${r}</b>` : r)).join(' → ')}</div></div>`)));
  if (inf.maxed) { pb.append(H('<p class="muted">The realm has reached the highest rank.</p>')); return; }
  const card = el('div', { class: 'card', style: { marginTop: '8px' } });
  card.innerHTML = `<b>Next: ${inf.next}</b>` + inf.checks.map(([name, v, need]) => `<div class="small">${v >= need ? '<span class="pos">✔</span>' : '<span class="neg">✕</span>'} ${name}: ${v} / ${need}</div>${barHTML(v / need, v >= need ? 'green' : '')}`).join('');
  card.append(el('div', { style: { marginTop: '8px' } }, el('div', { class: 'btn primary' + (inf.ok ? '' : ' disabled'), onclick: () => { if (g.crownRealm(n.id)) ui.renderPanel(true); } }, ico(`👑 Proclaim ${inf.next} (${inf.cost} gold)`))));
  pb.append(card);
}

function renderAmbitions(ui, pb, g, n) {
  const p = n.prog, pr = g.ambitionProgress(n.id);
  if (pr) {
    pb.append(H(ico(`<div class="card hl"><b>${sic(pr.def.icon, 'hammer')} ${pr.def.name}</b> <span class="muted small">${pr.def.desc}</span>${barHTML(pr.value / pr.goal, 'green')}
      <div class="small">${Math.min(pr.value, pr.goal)} / ${pr.goal} · ${Math.max(0, Math.ceil(pr.daysLeft / 30))} months left · reward: +${pr.def.prestige} prestige${pr.def.legit ? `, +${pr.def.legit} legitimacy` : ''}</div></div>`)));
  } else pb.append(H(`<p class="muted">${p.ambCool > 0 ? `The court rests for ${p.ambCool} more month(s) before a new ambition.` : 'Your ruler has no ambition. Choose one:'}</p>`));
  pb.append(H(`<div class="muted small">Ambitions fulfilled: ${p.ambDone}. Failing an ambition costs 10 prestige.</div>`));
  if (!pr && p.ambCool <= 0) {
    for (const id of AMBITION_ORDER) {
      const a = AMBITIONS[id];
      pb.append(el('div', { class: 'card', style: { margin: '6px 0', cursor: 'pointer' }, onclick: () => { g.chooseAmbition(n.id, id); ui.renderPanel(true); },
        html: ico(`<b>${sic(a.icon, 'hammer')} ${a.name}</b> <span class="muted small">${a.desc} ${a.months} months · +${a.prestige} prestige${a.legit ? `, +${a.legit} legitimacy` : ''}</span>`) }));
    }
  }
}

function renderDecisions(ui, pb, g, n) {
  const list = g.availableFormables(n.id);
  const done = (n.prog.formed || []).map((id) => FORMABLES.find((f) => f.id === id)).filter(Boolean);
  pb.append(H('<div class="muted small">Great realms are made, not inherited. Hold enough of the region, with the prestige and gold, to proclaim a greater crown.</div>'));
  for (const f of done) pb.append(H(ico(`<div class="card hl" style="margin-top:6px"><b>${sic(f.icon, 'crown')} ${f.name}</b> <span class="pos">✔ proclaimed</span></div>`)));
  if (!list.length && !done.length) pb.append(H('<p class="muted">No greater realm can be formed by this ruler.</p>'));
  for (const f of list) {
    const st = g.formableStatus(n.id, f);
    const card = el('div', { class: 'card', style: { marginTop: '6px' } });
    card.innerHTML = ico(`<b>${sic(f.icon, 'crown')} ${f.name}</b><div class="muted small">${f.desc}</div>`) +
      st.checks.map(([name, v, need]) => `<div class="small">${v >= need ? '<span class="pos">✔</span>' : '<span class="neg">✕</span>'} ${name}: ${v} / ${need}</div>`).join('') +
      `<div class="small muted" style="margin-top:4px">${g.describeEffects(f.effects).join(' · ')}</div>`;
    card.append(el('div', { style: { marginTop: '6px' } }, el('div', { class: 'btn primary' + (st.ok ? '' : ' disabled'), onclick: () => { if (g.formNation(n.id, f.id)) ui.renderPanel(true); } }, `Proclaim ${f.name} (${f.req.gold} gold)`)));
    pb.append(card);
  }
}

function renderPapacy(ui, pb, g, n) {
  const P = g.s.papacy, kind = g.holyWarKind(n.id), word = kind === 'jihad' ? 'Jihad' : 'Crusade';
  if (!P) return;
  if (n.religion === 'catholic' && n.tag !== 'PAP') {
    pb.append(H(`<div class="card hl"><b>Papal favour: ${Math.round(n.papalFavor)}</b>${barHTML(n.papalFavor / 100, n.papalFavor < 15 ? 'red' : 'green')}<div class="muted small">Rises with clergy loyalty, donations and crusading; falls when the realm is in disorder. Below 15 the Pope may excommunicate the ruler.</div></div>`));
    if (n.excommunicated) pb.append(el('div', { class: 'card', style: { marginTop: '6px' } }, H('<b class="neg">Excommunicated</b> <span class="muted small">−legitimacy and stability each month; every Catholic realm may declare holy war on us.</span>'),
      el('div', { class: 'btn primary', style: { marginTop: '6px' }, onclick: () => { const r = g.liftExcommunication(n.id); ui.toast('Penance', r || 'We are received back into the Church.', r ? '🚫' : '✝'); ui.renderPanel(true); } }, 'Do penance (100 gold)')));
  }
  if (!kind) { pb.append(H('<p class="muted">Our faith has no holy war to call or answer.</p>')); }
  else {
    const c = P[kind];
    if (!c) pb.append(H(`<p class="muted">No ${word.toLowerCase()} is currently proclaimed.</p>`));
    else {
      const t = g.s.nations[c.target], mine = c.members[n.id];
      const rank = Object.keys(c.members).map(Number).sort((a, b) => g.contribution(b, kind) - g.contribution(a, kind));
      const card = el('div', { class: 'card hl', style: { marginTop: '6px' } });
      card.innerHTML = ico(`<b>${word} against ${t.name}</b><div class="small muted">${c.scripted === 'fourth_crusade' ? 'The Fourth Crusade. ' : ''}Open for joiners until ${Math.max(0, Math.ceil((c.endDay - g.s.day) / 30))} more months. ${rank.length} realm(s) have taken the cross.</div>`);
      const why = g.canJoinHolyWar(n.id, kind);
      const row = el('div', { class: 'row wrap', style: { marginTop: '6px' } });
      if (!mine && n.religion === (kind === 'jihad' ? 'sunni' : 'catholic')) row.append(el('div', { class: 'btn primary' + (why ? ' disabled' : ''), onclick: () => { const r = g.joinHolyWar(n.id, kind); ui.toast(word, r || 'We take the cross!', r ? '🚫' : '✠'); ui.renderPanel(true); } }, why ? `Cannot join: ${why}` : `Take the cross`));
      if (n.religion === (kind === 'jihad' ? 'sunni' : 'catholic')) row.append(el('div', { class: 'btn', onclick: () => { const r = g.donateHolyWar(n.id, 60, kind); ui.toast(word, r || 'Donated 60 gold.', r ? '🚫' : '💰'); ui.renderPanel(true); } }, 'Donate 60 gold'));
      card.append(row);
      if (mine) card.append(H(`<div class="small pos" style="margin-top:4px">We are crusading: contribution ${Math.round(g.contribution(n.id, kind))}, rank ${rank.indexOf(n.id) + 1} of ${rank.length}.</div>`));
      pb.append(card);
      if (rank.length) pb.append(H('<div class="section">Contributors</div>' + rank.map((id, i) => `<div class="small">${i + 1}. ${g.s.nations[id].name} — ${Math.round(g.contribution(id, kind))}</div>`).join('')));
    }
  }
  if (P.history.length) pb.append(H('<div class="section">Past holy wars</div>' + P.history.slice().reverse().map((h) => `<div class="small muted">${Math.floor(h.call / 365) + 1200}–${Math.floor(h.end / 365) + 1200}: ${h.kind === 'jihad' ? 'Jihad' : 'Crusade'} vs ${h.target} (${h.members.join(', ') || 'no participants'})</div>`).join('')));
}

function renderObjectives(ui, pb, g, n) {
  const list = g.objectives(n.id);
  const done = list.filter((o) => o.done), active = list.filter((o) => o.active), locked = list.filter((o) => o.locked);
  const thr = g.threats(n.id).filter((t) => t.level >= 0.6).slice(0, 2), opp = g.opportunities(n.id).filter((o) => o.kind === 'war' || o.kind === 'alliance').slice(0, 3);
  if (thr.length) pb.append(H('<div class="section">Threats</div>' + thr.map((t) => `<div class="small neg">⚠ ${g.s.nations[t.nation].name}: ${t.why.join(', ') || 'hostile'}</div>`).join('')));
  if (opp.length) pb.append(H('<div class="section">Opportunities</div>' + opp.map((o) => `<div class="small pos">✦ ${o.text}</div>`).join('')));
  pb.append(H(`<div class="muted small">Objectives guide the realm's first decades and pay real rewards. ${done.length} of ${list.length} complete.</div>`));
  for (const o of active) {
    const card = el('div', { class: 'card hl objective', style: { marginTop: '6px', cursor: o.tab ? 'pointer' : 'default' }, onclick: () => { if (o.tab) ui.openTab(o.tab); } });
    card.innerHTML = ico(`<b>${sic(o.icon, 'star')} ${o.title}</b> <span class="muted small">${Math.min(o.value, o.goal)} / ${o.goal}</span><div class="small">${o.desc}</div><div class="small pos">Reward: ${o.rewardText}</div>`) + barHTML(o.value / o.goal, 'green');
    pb.append(card);
  }
  if (!active.length && !done.length) pb.append(H('<p class="muted">No objectives yet.</p>'));
  if (locked.length) pb.append(H(`<div class="section">Later</div>` + locked.map((o) => `<div class="small muted">🔒 ${o.title}</div>`).join('')));
  if (done.length) pb.append(H(`<div class="section">Complete</div>` + done.map((o) => `<div class="small"><span class="pos">✔</span> ${o.title} <span class="muted">(${o.rewardText})</span></div>`).join('')));
}

function renderAchievements(ui, pb, g, n) {
  const p = n.prog;
  const hist = p.score.length ? p.score.map(([yr, v]) => `${yr}: ${v}`).join(' · ') : 'recorded every 5 years';
  pb.append(H(`<div class="card hl"><div class="frame-title" style="font-size:16px">Score: ${g.nationScore(n.id)}</div>
    <div class="muted small">Development + prestige + innovations + rank + battles + achievements. The age ends in ${END_YEAR}.</div><div class="small">${hist}</div></div>`));
  for (const [id, a] of Object.entries(ACHIEVEMENTS)) {
    const done = p.ach.includes(id);
    pb.append(H(ico(`<div class="card" style="margin-top:5px;${done ? '' : 'opacity:.5'}"><b>${sic(a.icon)} ${a.name}</b> ${done ? '<span class="pos">✔</span>' : ''}<div class="muted small">${a.desc}</div></div>`)));
  }
}

registerPanel({ id: 'progress', icon: '📚', name: 'Progress', key: 'i', order: 55, wide: true, render(ui, pb) {
  const g = ui.g, n = ui.P;
  if (!n.prog) g._initProgFor(n);
  const [tabs, cur] = subtabs(ui, 'progress', [['obj', 'Objectives'], ['innov', 'Innovations'], ['rank', 'Realm Rank'], ['amb', 'Ambitions'], ['dec', 'Decisions'], ['pap', 'Papacy & Holy War'], ['ach', 'Achievements & Score']]);
  pb.style.padding = '8px';
  pb.append(tabs);
  ({ obj: renderObjectives, innov: renderInnovations, rank: renderRank, amb: renderAmbitions, dec: renderDecisions, pap: renderPapacy, ach: renderAchievements })[cur](ui, pb, g, n);
} });

// End-of-game summary (the age ends in 1453). Shown once per session by AlertsMixin.updateAlerts.
export function showEndScore(ui) {
  const g = ui.g, s = g.s, n = ui.P;
  const rows = s.nations.filter((x) => x.alive).map((x) => [x, g.nationScore(x.id)]).sort((a, b) => b[1] - a[1]);
  const pos = rows.findIndex((r) => r[0].id === n.id) + 1;
  const was = ui.speed;
  ui.setSpeed(0);
  ui.modal((m, close) => {
    m.append(el('div', { class: 'mh' }, el('div', { class: 'frame-title' }, `The Year ${END_YEAR}: An Age Ends`)));
    const mb = el('div', { class: 'mb' });
    const p = n.prog;
    const top = rows.slice(0, 8).map(([x, v], i) => `<tr${x.id === n.id ? ' class="click"' : ''}><td>${i + 1}</td><td>${x.id === n.id ? '<b class="gold">' + x.name + '</b>' : x.name}</td><td>${v}</td></tr>`).join('');
    mb.innerHTML = ico(`<div class="small">${n.name} stands as a <b>${RANKS[p.rank]}</b> with <b>${g.ownedProvinces(n.id).length}</b> provinces, ${p.known.length} innovations, ${p.ach.length} of ${Object.keys(ACHIEVEMENTS).length} achievements and ${n.stats.won} battles won.</div>
      <div class="frame-title" style="font-size:18px;margin:8px 0">Score ${g.nationScore(n.id)} — ${pos}${['st', 'nd', 'rd'][pos - 1] || 'th'} in Europe</div>
      <table class="tbl"><tr><th>#</th><th>Realm</th><th>Score</th></tr>${top}</table>
      <div class="muted small" style="margin-top:6px">You may keep ruling; the chronicle continues.</div>`);
    m.append(mb);
    const done = () => { close(); if (was) ui.setSpeed(was); };
    m.append(el('div', { class: 'mf' }, el('div', { class: 'btn primary', onclick: done }, 'Continue ruling'), el('div', { class: 'btn', onclick: () => { done(); ui.state && (ui.subtab.progress = 'ach'); ui.openTab('progress'); } }, 'Achievements & score')));
  }, { dismiss: false });
}
