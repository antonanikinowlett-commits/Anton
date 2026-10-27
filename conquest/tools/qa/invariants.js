// State invariants for the all-AI long run. check(game) returns an array of short violation strings.
function nanScan(v, path, out, depth = 0) {
  if (out.length > 20 || depth > 6) return;
  if (typeof v === 'number') { if (!Number.isFinite(v)) out.push(`non-finite ${path}=${v}`); return; }
  if (v && typeof v === 'object') for (const k of Object.keys(v)) { if (k === '_m') continue; nanScan(v[k], `${path}.${k}`, out, depth + 1); }
}

export function check(g) {
  const s = g.s, v = [], L = g.L, N = s.nations.length;
  const nat = (i) => Number.isInteger(i) && i >= 0 && i < N;
  s.prov.forEach((p, i) => {
    if (!nat(p.owner) || !s.nations[p.owner].alive) v.push(`prov ${i} owner ${p.owner} invalid/dead`);
    if (!nat(p.controller)) v.push(`prov ${i} controller ${p.controller} invalid`);
    if (!(p.dev >= 0)) v.push(`prov ${i} dev ${p.dev}`);
  });
  for (const n of s.nations) {
    if (!n.alive) { if (g.ownedProvinces(n.id).length) v.push(`dead nation ${n.tag} owns provinces`); continue; }
    if (!g.ownedProvinces(n.id).length) v.push(`alive nation ${n.tag} owns 0 provinces`);
    if (n.manpower < 0) v.push(`${n.tag} negative manpower ${n.manpower}`);
    if (n.capital >= 0 && n.capital < L && s.prov[n.capital].owner !== n.id && g.ownedProvinces(n.id).length) v.push(`${n.tag} capital ${n.capital} not owned`);
    for (const a of n.allies) if (!nat(a) || !s.nations[a].alive) v.push(`${n.tag} allied with dead/invalid ${a}`);
    for (const a of n.allies) if (nat(a) && !s.nations[a].allies.includes(n.id)) v.push(`${n.tag} alliance with ${s.nations[a].tag} not mutual`);
    if (n.overlord >= 0 && !(nat(n.overlord) && s.nations[n.overlord].alive)) v.push(`${n.tag} overlord ${n.overlord} dead/invalid`);
  }
  for (const a of Object.values(s.armies)) {
    if (!nat(a.nation) && a.rebelOf < 0) v.push(`army ${a.id} nation ${a.nation} invalid`);
    if (!(a.loc >= 0 && a.loc < s.prov.length + 200)) v.push(`army ${a.id} loc ${a.loc} invalid`);
    if (!a.regs.length) v.push(`army ${a.id} has no regiments`);
    for (const r of a.regs) if (!(r.men >= 0) || !(r.morale >= 0 || r.morale === undefined)) { v.push(`army ${a.id} reg men=${r.men} morale=${r.morale}`); break; }
    if (a.battle && !s.battles[a.battle]) v.push(`army ${a.id} in missing battle ${a.battle}`);
    for (const p of a.path) if (!(p >= 0)) { v.push(`army ${a.id} bad path`); break; }
  }
  for (const w of Object.values(s.wars)) {
    if (!w.att.length || !w.def.length) v.push(`war ${w.id} ${w.name} empty side att=${w.att.length} def=${w.def.length}`);
    if (!w.att.includes(w.attLeader) || !w.def.includes(w.defLeader)) v.push(`war ${w.id} leader not on own side`);
    for (const x of [...w.att, ...w.def]) if (!nat(x) || !s.nations[x].alive) v.push(`war ${w.id} participant ${x} dead/invalid`);
    for (const x of w.att) if (w.def.includes(x)) v.push(`war ${w.id} nation ${x} on both sides`);
  }
  for (const [id, b] of Object.entries(s.battles)) {
    if (![...b.att, ...b.def].some((i) => s.armies[i])) v.push(`battle ${id} has no living armies`);
  }
  nanScan(s.nations, 'nations', v); nanScan(s.armies, 'armies', v);
  for (let i = 0; i < s.prov.length && v.length < 60; i += 1) nanScan(s.prov[i], `prov[${i}]`, v, 4);
  return v;
}
