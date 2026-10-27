// Progress panel: innovations grid (branch x era), realm rank, ambitions, achievements and score.
import { el } from '../../util.js';
import { iconize } from '../icons.js';
// ico() swaps mapped emoji for SVG icons; give them an explicit size (no global .ic rule yet).
const ico = (html, px = 16) => iconize(html).replace(/<svg class="ic[^"]*"/g, (m) => `${m} style="width:${px}px;height:${px}px;vertical-align:-3px"`);
import { registerPanel } from './registry.js';
import { H, subtabs, barHTML } from './common.js';
import { INNOVATIONS, INNOV, BRANCHES, ERAS } from '../../data/innovations.js';
import { RANKS, RANK_ICONS, AMBITIONS, AMBITION_ORDER, ACHIEVEMENTS, END_YEAR } from '../../sim/progression.js';
import { UNITS } from '../../data/units.js';

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
  const n = g.s.nations[nid];
  let h = `<div class="tt-title">${i.name}</div><div class="muted small">${BRANCHES[i.branch].name} · ${ERAS[i.era].name} · c. ${i.year}</div><p>${i.desc}</p>${modText(i.mods)}`;
  if (i.unlock) h += `<br><b>Unlocks:</b> ${UNITS[i.unlock] ? UNITS[i.unlock].name : i.unlock === 'roman_law' ? 'Roman Law' : i.unlock}`;
  if (i.pre.length) h += `<br><span class="muted">Requires: ${i.pre.map((p) => (n.prog.known.includes(p) ? '<span class="pos">' : '<span class="neg">') + INNOV[p].name + '</span>').join(', ')}</span>`;
  if (state !== 'done') h += `<br><span class="muted">Cost: ${g.innovCost(nid, i.id)} points</span>`;
  return h;
}

function renderInnovations(ui, pb, g, n) {
  const p = n.prog, cur = p.cur ? INNOV[p.cur] : null;
  const top = el('div', { class: 'card hl', style: { marginBottom: '8px' } });
  if (cur) {
    const c = g.innovCost(n.id, cur.id);
    top.innerHTML = ico(`<b>Researching: ${cur.icon} ${cur.name}</b> <span class="muted small">${Math.floor(p.pts)} / ${c} points · +${p.rp.toFixed(1)} per month</span>`) + barHTML(p.pts / c, 'blue');
  } else top.innerHTML = ico(`<b class="neg">Nothing is being researched.</b> <span class="muted small">+${g.researchRate(n.id).toFixed(1)} points per month${p.pts > 0 ? ` (${Math.floor(p.pts)} banked)` : ''}. Choose an innovation below.</span>`);
  pb.append(top);
  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: '8px' } });
  for (const b of Object.keys(BRANCHES)) {
    const col = el('div');
    col.append(H(ico(`<div class="frame-title" style="font-size:13px;margin-bottom:4px">${BRANCHES[b].icon} ${BRANCHES[b].name}</div>`)));
    for (let e = 0; e < ERAS.length; e++) {
      col.append(H(`<div class="muted small" style="margin:6px 0 2px">${ERAS[e].name}</div>`));
      for (const i of INNOVATIONS.filter((x) => x.branch === b && x.era === e)) {
        const done = p.known.includes(i.id), now = p.cur === i.id, avail = g.innovAvailable(n.id, i.id);
        const state = done ? 'done' : now ? 'now' : avail ? 'avail' : 'locked';
        const style = { display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 6px', marginBottom: '3px', borderRadius: '3px', border: '1px solid var(--line)', fontSize: '13px', cursor: state === 'avail' ? 'pointer' : 'default' };
        if (state === 'done') { style.borderColor = '#4a7a3a'; style.background = 'rgba(100,160,70,.12)'; }
        else if (state === 'now') { style.borderColor = 'var(--gold)'; style.background = 'rgba(212,175,95,.15)'; }
        else if (state === 'avail') style.borderColor = 'var(--gold-d)';
        else style.opacity = '.45';
        const card = el('div', { style, onclick: state === 'avail' ? () => { g.startResearch(n.id, i.id); ui.renderPanel(true); } : null });
        card.innerHTML = `<span style="flex:1">${i.name}</span>` + (done ? ico('<span class="pos">✔</span>') : state === 'locked' ? ico('<span>🔒</span>') : `<span class="muted small">${g.innovCost(n.id, i.id)}</span>`);
        card._tip = () => innovTip(g, n.id, i, state);
        col.append(card);
      }
    }
    grid.append(col);
  }
  pb.append(grid);
}

function renderRank(ui, pb, g, n) {
  const inf = g.rankInfo(n.id);
  pb.append(H(ico(`<div class="card hl"><div class="frame-title" style="font-size:16px">${RANK_ICONS[inf.rank]} ${n.name}: ${inf.name}</div>
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
    pb.append(H(ico(`<div class="card hl"><b>${pr.def.icon} ${pr.def.name}</b> <span class="muted small">${pr.def.desc}</span>${barHTML(pr.value / pr.goal, 'green')}
      <div class="small">${Math.min(pr.value, pr.goal)} / ${pr.goal} · ${Math.max(0, Math.ceil(pr.daysLeft / 30))} months left · reward: +${pr.def.prestige} prestige${pr.def.legit ? `, +${pr.def.legit} legitimacy` : ''}</div></div>`)));
  } else pb.append(H(`<p class="muted">${p.ambCool > 0 ? `The court rests for ${p.ambCool} more month(s) before a new ambition.` : 'Your ruler has no ambition. Choose one:'}</p>`));
  pb.append(H(`<div class="muted small">Ambitions fulfilled: ${p.ambDone}. Failing an ambition costs 10 prestige.</div>`));
  if (!pr && p.ambCool <= 0) {
    for (const id of AMBITION_ORDER) {
      const a = AMBITIONS[id];
      pb.append(el('div', { class: 'card', style: { margin: '6px 0', cursor: 'pointer' }, onclick: () => { g.chooseAmbition(n.id, id); ui.renderPanel(true); },
        html: ico(`<b>${a.icon} ${a.name}</b> <span class="muted small">${a.desc} ${a.months} months · +${a.prestige} prestige${a.legit ? `, +${a.legit} legitimacy` : ''}</span>`) }));
    }
  }
}

function renderAchievements(ui, pb, g, n) {
  const p = n.prog;
  const hist = p.score.length ? p.score.map(([yr, v]) => `${yr}: ${v}`).join(' · ') : 'recorded every 5 years';
  pb.append(H(`<div class="card hl"><div class="frame-title" style="font-size:16px">Score: ${g.nationScore(n.id)}</div>
    <div class="muted small">Development + prestige + innovations + rank + battles + achievements. The age ends in ${END_YEAR}.</div><div class="small">${hist}</div></div>`));
  for (const [id, a] of Object.entries(ACHIEVEMENTS)) {
    const done = p.ach.includes(id);
    pb.append(H(ico(`<div class="card" style="margin-top:5px;${done ? '' : 'opacity:.5'}"><b>${a.icon} ${a.name}</b> ${done ? '<span class="pos">✔</span>' : ''}<div class="muted small">${a.desc}</div></div>`)));
  }
}

registerPanel({ id: 'progress', icon: '📚', name: 'Progress', key: 'i', order: 55, wide: true, render(ui, pb) {
  const g = ui.g, n = ui.P;
  if (!n.prog) g._initProgFor(n);
  const [tabs, cur] = subtabs(ui, 'progress', [['innov', 'Innovations'], ['rank', 'Realm Rank'], ['amb', 'Ambitions'], ['ach', 'Achievements & Score']]);
  pb.style.padding = '8px';
  pb.append(tabs);
  ({ innov: renderInnovations, rank: renderRank, amb: renderAmbitions, ach: renderAchievements })[cur](ui, pb, g, n);
} });
