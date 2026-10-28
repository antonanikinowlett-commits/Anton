// Objectives: a guided opening plus follow-up goals. Each has a progress test and a reward (the shared effect vocabulary).
// test(g, n, base) -> { value, goal }; base is a snapshot taken when the campaign starts. `after` lists prerequisite ids.
// At most 3 incomplete objectives are shown at a time, in order. The first ones teach one verb each.
const levels = (g, nid) => { let t = 0; for (const p of g.ownedProvinces(nid)) for (const k in g.s.prov[p].buildings) t += g.s.prov[p].buildings[k]; return t; };
const dev = (g, nid) => g.ownedProvinces(nid).reduce((t, p) => t + g.s.prov[p].dev, 0);
export const objectiveSnap = (g, n) => ({ levels: levels(g, n.id), dev: dev(g, n.id), prov: g.ownedProvinces(n.id).length, allies: n.allies.length + n.marriages.length, won: n.stats.won, rank: n.prog?.rank ?? 0, day: g.s.day });
export const OBJECTIVES = [
  { id: 'research', icon: '📚', title: 'Open your first book', desc: 'Choose an innovation to research. Each costs research points and some close off their rivals: read the effects before you commit.', tab: 'progress',
    test: (g, n) => ({ value: n.prog.known.length || n.prog.cur ? 1 : 0, goal: 1 }), reward: [{ prestige: 10 }, { gold: 30 }], rewardText: '+10 prestige, +30 gold' },
  { id: 'generals', icon: '🎖', title: 'Give every host a commander', desc: 'An army without a general fights at -10% and breaks easily. Hire generals (Court) and assign them in the Military panel.', tab: 'military',
    test: (g, n) => { const A = g.armiesOf(n.id).filter((a) => !g.isFleet(a)); return { value: A.filter((a) => a.general).length, goal: Math.max(1, A.length) }; }, reward: [{ legitimacy: 3 }, { prestige: 10 }], rewardText: '+3 legitimacy, +10 prestige' },
  { id: 'build', icon: '🏗', title: 'Raise something lasting', desc: 'Complete 2 new building levels. Provinces have limited slots: choose what each is for.', tab: 'build', after: ['research'],
    test: (g, n, b) => ({ value: Math.min(2, levels(g, n.id) - b.levels), goal: 2 }), reward: [{ gold: 40 }, { mods_t: { mods: { buildSpeed: 0.2 }, months: 12 } }], rewardText: '+40 gold, +20% construction speed for a year' },
  { id: 'policy', icon: '⚖', title: 'Set a provincial policy', desc: 'Put three provinces on a policy other than Balanced: collect dues where you need gold, settle where you want growth, muster where you need men.', tab: 'map', after: ['research'],
    test: (g, n) => ({ value: Math.min(3, g.ownedProvinces(n.id).filter((p) => g.s.prov[p].stance).length), goal: 3 }), reward: [{ gold: 50 }], rewardText: '+50 gold' },
  { id: 'focus', icon: '🎯', title: 'Choose a national focus', desc: 'Start a national focus: a multi-month project with real rewards. Some branches exclude each other.', tab: 'focus', after: ['generals'],
    test: (g, n) => ({ value: n.focus.cur || n.focus.done.length ? 1 : 0, goal: 1 }), reward: [{ prestige: 15 }, { stability: 0.3 }], rewardText: '+15 prestige, +0.3 stability' },
  { id: 'answer', icon: '📜', title: 'Answer a demand', desc: 'Neighbours test new rulers. When an ultimatum arrives, weigh the cost of paying against the cost of war.', after: ['build'],
    test: (g, n) => ({ value: (n.world?.answered || 0) > 0 ? 1 : 0, goal: 1 }), reward: [{ prestige: 15 }, { legitimacy: 3 }], rewardText: '+15 prestige, +3 legitimacy' },
  { id: 'friend', icon: '🤝', title: 'Find a friend', desc: 'Win an alliance or marriage. Allies call you to war, and you call them. Diplomacy panel, or accept envoys when they come.', tab: 'diplomacy', after: ['policy'],
    test: (g, n, b) => ({ value: Math.min(1, Math.max(0, n.allies.length + n.marriages.length - b.allies)), goal: 1 }), reward: [{ prestige: 20 }, { gold: 40 }], rewardText: '+20 prestige, +40 gold' },
  { id: 'grow', icon: '🏘', title: 'Let the realm grow', desc: 'Raise total development by 6 (Settle & Improve policy, develop provinces, build markets).', tab: 'economy', after: ['policy'],
    test: (g, n, b) => ({ value: Math.max(0, Math.min(6, dev(g, n.id) - b.dev)), goal: 6 }), reward: [{ gold: 60 }, { mods_t: { mods: { devGrowth: 0.2 }, months: 24 } }], rewardText: '+60 gold, +20% development growth for two years' },
  { id: 'victory', icon: '⚔', title: 'Win a battle or take a province', desc: 'Fight a war you can win: pick a weaker neighbour you hold a claim on (Diplomacy), set a front to Advance, and take their land.', tab: 'wars', after: ['friend'],
    test: (g, n, b) => ({ value: Math.min(1, (n.stats.won - b.won > 0 || g.ownedProvinces(n.id).length > b.prov) ? 1 : 0), goal: 1 }), reward: [{ prestige: 25 }, { manpower: 2000 }], rewardText: '+25 prestige, +2,000 manpower' },
  { id: 'peace', icon: '🕊', title: 'Win a war', desc: 'End a war as the victor: reach a war score the enemy accepts and take the war goals at the peace table.', tab: 'wars', after: ['victory'],
    test: (g, n) => ({ value: Math.min(1, n.stats.warsWon || 0), goal: 1 }), reward: [{ prestige: 30 }, { legitimacy: 5 }, { gold: 80 }], rewardText: '+30 prestige, +5 legitimacy, +80 gold' },
  { id: 'rank', icon: '👑', title: 'Wear a greater crown', desc: 'Be raised to the next realm rank (Progress → Realm Rank).', tab: 'progress', after: ['peace'],
    test: (g, n, b) => ({ value: Math.min(1, (n.prog.rank > b.rank) ? 1 : 0), goal: 1 }), reward: [{ prestige: 40 }, { mods_t: { mods: { taxMult: 0.05 }, months: 60 } }], rewardText: '+40 prestige, +5% tax for five years' },
  { id: 'ambition', icon: '⭐', title: 'Fulfil an ambition', desc: 'Choose a royal ambition and see it through.', tab: 'progress', after: ['focus'],
    test: (g, n) => ({ value: Math.min(1, n.prog.ambDone || 0), goal: 1 }), reward: [{ prestige: 20 }, { gold: 50 }], rewardText: '+20 prestige, +50 gold' },
  { id: 'scholar', icon: '🎓', title: 'A learned court', desc: 'Learn 5 innovations.', tab: 'progress', after: ['build'],
    test: (g, n) => ({ value: Math.min(5, n.prog.known.length), goal: 5 }), reward: [{ legitimacy: 4 }, { mods_t: { mods: { researchSpeed: 0.1 }, months: 36 } }], rewardText: '+4 legitimacy, +10% research for three years' },
];
export const OBJ = Object.fromEntries(OBJECTIVES.map((o) => [o.id, o]));
