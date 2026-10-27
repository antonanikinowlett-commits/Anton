// Formable nations: a ruler of one of `tags` who holds enough of `region` (and has the prestige and gold)
// may proclaim a greater realm. Effects use the focus effect vocabulary; `rename` sets the realm's name/adjective.
// req: { region: [lon0, lat0, lon1, lat1], min: provinces owned inside it, prestige, gold, religion?, rank? }
export const FORMABLES = [
  { id: 'form_iberia', name: 'Kingdom of Iberia', icon: '👑', tags: ['POR', 'CAS', 'LEO', 'ARA'], rename: { name: 'Kingdom of Iberia', adj: 'Iberian' },
    desc: 'The whole peninsula under one crown, as the Visigoths once ruled it. Christians, Moors and Jews alike become subjects of a single throne.',
    req: { region: [-10, 35.8, 3.6, 43.9], min: 240, prestige: 100, gold: 300 },
    effects: [{ prestige: 80 }, { legitimacy: 15 }, { stability: 1 }, { mods: { taxMult: 0.1, manpowerMult: 0.1, diplo: 5 } }, { claims: { tag: 'ALM', border: 4 } }] },
  { id: 'form_italy', name: 'Kingdom of Italy', icon: '🇮🇹', tags: ['SIC', 'LOM', 'VEN', 'GEN', 'FLO', 'PIS'], rename: { name: 'Kingdom of Italy', adj: 'Italian' },
    desc: 'The Iron Crown of Lombardy and the Sicilian crown united: Rome’s old peninsula under one ruler at last.',
    req: { region: [6.5, 36.5, 14, 46.5], min: 115, prestige: 100, gold: 300 },
    effects: [{ prestige: 80 }, { legitimacy: 15 }, { mods: { tradeMult: 0.15, taxMult: 0.1, diplo: 4 } }, { claims: { tag: 'PAP', border: 3 } }, { opinion: { tag: 'PAP', v: -30 } }] },
  { id: 'form_rus', name: 'Grand Principality of Rus’', icon: '👑', tags: ['VLA', 'NOV', 'KIE', 'RYA', 'SMO', 'GAL', 'CHE', 'PLT'], rename: { name: 'Grand Principality of Rus’', adj: 'Russian' },
    desc: 'The Rus’ lands gathered under one prince: Kyiv, Novgorod and Vladimir as one orthodox realm that can withstand the steppe.',
    req: { region: [24, 47, 52, 62], min: 900, prestige: 80, gold: 250, religion: 'orthodox' },
    effects: [{ prestige: 70 }, { legitimacy: 15 }, { mods: { manpowerMult: 0.15, fortDefense: 0.15, armyMorale: 0.05 } }, { loyalty: { clergy: 10 } }] },
  { id: 'form_scandinavia', name: 'Scandinavian Union', icon: '🦁', tags: ['DEN', 'NOR', 'SWE'], rename: { name: 'Kingdom of the North', adj: 'Scandinavian' },
    desc: 'Danes, Norwegians and Swedes under one crown, as the sagas dream: the whole North and the Baltic sea within one law.',
    req: { region: [4, 54.5, 32, 71.5], min: 480, prestige: 90, gold: 250 },
    effects: [{ prestige: 70 }, { legitimacy: 12 }, { mods: { seaSpeed: 0.2, tradeMult: 0.12, manpowerMult: 0.1 } }, { build: { type: 'port', where: 'coastal', n: 3 } }] },
  { id: 'form_greater_poland', name: 'Commonwealth of Greater Poland', icon: '🦅', tags: ['POL', 'LIT'], rename: { name: 'Greater Poland', adj: 'Polish' },
    desc: 'Poland and Lithuania, the plains from the Oder to the Dnieper, joined under one crown of crowned freemen and princes.',
    req: { region: [14, 48.5, 34, 56.5], min: 460, prestige: 80, gold: 250 },
    effects: [{ prestige: 60 }, { legitimacy: 12 }, { mods: { manpowerMult: 0.2, devGrowth: 0.1 } }, { influence: { nobles: 5 } }] },
];
