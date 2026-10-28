// Events with consequences: multi-step chains where a choice now changes what happens later.
// Same vocabulary as events.js; `followup {id, months}` schedules the next step (chance 0 entries are chain steps).
export const EVENTS_V2 = [
  // ── The barons' demands: grant now, or face an ultimatum, or a war
  { id: 'barons_demand', title: 'The Barons Present Their Demands', icon: '🛡', chance: 0.02,
    cond: (n, g) => n.estates.nobles && n.estates.nobles.influence > 28 && n.estates.nobles.loyalty < 52 && !g.atWar(n.id) && n.gov !== 'tribal',
    desc: 'The great lords gather at the royal hall and read a list of grievances: royal justices have overruled their courts, and taxes were raised without their counsel. They ask for a charter and a share in the council.',
    options: [
      { text: 'Seal their charter (nobles +25 loyalty, +8 influence, taxes −6% for 3 years)', effects: [{ loyalty: { nobles: 25 } }, { influence: { nobles: 8 } }, { mods_t: { mods: { taxMult: -0.06 }, months: 36 } }] },
      { text: 'Promise to consider it (a way to buy time)', effects: [{ loyalty: { nobles: 5 } }, { followup: { id: 'barons_ultimatum', months: 5 } }] },
      { text: 'Refuse: the crown does not bargain', effects: [{ legitimacy: 3 }, { loyalty: { nobles: -15 } }, { followup: { id: 'barons_ultimatum', months: 4 } }] },
    ] },
  { id: 'barons_ultimatum', title: 'The Barons Lose Patience', icon: '⚔', chance: 0,
    desc: 'The lords have waited and received nothing. Their banners are unfurled in three counties. "Sign, or we choose another king."',
    options: [
      { text: 'Concede everything', effects: [{ loyalty: { nobles: 20 } }, { influence: { nobles: 10 } }, { legitimacy: -8 }, { mods_t: { mods: { taxMult: -0.08 }, months: 48 } }] },
      { text: 'Pay off the ringleaders (120 gold)', effects: [{ gold: -120 }, { loyalty: { nobles: 10 } }, { legitimacy: -3 }] },
      { text: 'Fight: crush the rebellion', effects: [{ revolt: { n: 2, nobles: true } }, { prestige: 10 }, { loyalty: { nobles: -10 } }, { followup: { id: 'barons_aftermath', months: 10 } }] },
    ] },
  { id: 'barons_aftermath', title: 'The Rebel Lords Are Judged', icon: '⚖', chance: 0,
    desc: 'The rebellion has been put down. The captured barons await judgement in chains, and the whole realm waits to see what kind of king this is.',
    options: [
      { text: 'Execute the leaders and confiscate their lands', effects: [{ gold: 100 }, { legitimacy: -4 }, { loyalty: { nobles: -15 } }, { influence: { nobles: -6 } }] },
      { text: 'Pardon them and take hostages', effects: [{ legitimacy: 6 }, { loyalty: { nobles: 8 } }, { prestige: 10 }] },
    ] },
  // ── A loan from the Lombard bankers: gold now, a bill later
  { id: 'banker_offer', title: 'Lombard Bankers Offer a Loan', icon: '🏦', chance: 0.01, cond: (n) => n.gold < 220 && n.estates.burghers && n.estates.burghers.influence > 12,
    desc: 'Bankers from Siena and Florence offer ready gold against the crown\'s revenues. The interest is high, and they are patient, but not forgiving.',
    options: [
      { text: 'Borrow 300 gold (repay 400 in two years)', effects: [{ gold: 300 }, { followup: { id: 'loan_due', months: 24 } }] },
      { text: 'Borrow 150 gold (repay 190 in two years)', effects: [{ gold: 150 }, { followup: { id: 'loan_due_small', months: 24 } }] },
      { text: 'Decline: debts enslave kings', effects: [{ legitimacy: 2 }] },
    ] },
  { id: 'loan_due', title: 'The Bankers Call In the Loan', icon: '🏦', chance: 0,
    desc: 'The agents of the bankers arrive with the ledger: 400 gold is due.',
    options: [
      { text: 'Repay 400 gold', effects: [{ gold: -400 }, { prestige: 5 }] },
      { text: 'Default: let them sue', effects: [{ prestige: -25 }, { legitimacy: -6 }, { loyalty: { burghers: -25 } }, { mods_t: { mods: { tradeMult: -0.15 }, months: 36 } }] },
    ] },
  { id: 'loan_due_small', title: 'The Bankers Call In the Loan', icon: '🏦', chance: 0,
    desc: 'The agents of the bankers arrive with the ledger: 190 gold is due.',
    options: [
      { text: 'Repay 190 gold', effects: [{ gold: -190 }, { prestige: 5 }] },
      { text: 'Default: let them sue', effects: [{ prestige: -20 }, { legitimacy: -4 }, { loyalty: { burghers: -20 } }, { mods_t: { mods: { tradeMult: -0.1 }, months: 24 } }] },
    ] },
  // ── Hunger: relief now or riots later
  { id: 'hungry_winter', title: 'Hunger in the Towns', icon: '🌾', chance: 0.012, cond: (n, g) => n.food < 60 && g.season() !== 'autumn',
    desc: 'Bread prices have doubled and the poor are leaving the villages for the towns. The burghers fear riots; the lords fear empty barns.',
    options: [
      { text: 'Open the granaries and fix the price (food −40)', effects: [{ food: -40 }, { loyalty: { peasants: 12, burghers: 6 } }] },
      { text: 'Import grain from abroad (80 gold)', effects: [{ gold: -80 }, { food: 60 }] },
      { text: 'Do nothing: grain is the lords\' to sell', effects: [{ loyalty: { nobles: 8, peasants: -12 } }, { followup: { id: 'bread_riots', months: 3 } }] },
    ] },
  { id: 'bread_riots', title: 'Bread Riots', icon: '🔥', chance: 0,
    desc: 'The mob has sacked the granaries of the town and the reeve is dead. The rest of the towns are watching.',
    options: [
      { text: 'Send in the soldiers', effects: [{ revolt: { n: 1 } }, { loyalty: { peasants: -12, nobles: 6 } }, { prestige: 5 }] },
      { text: 'Open the granaries and pardon the rioters', effects: [{ food: -60 }, { loyalty: { peasants: 15 } }, { legitimacy: -3 }] },
    ] },
  // ── A famous captain
  { id: 'captain_offer', title: 'A Famous Captain Seeks Service', icon: '🎖', chance: 0.008, cond: (n, g) => n.gold > 60 && n.estates.nobles,
    desc: 'A veteran captain of a hundred sieges offers to lead our armies. His price is a lordship and the right to hire his own company.',
    options: [
      { text: 'Hire him with a company (80 gold)', effects: [{ gold: -80 }, { mercs: { regs: { men_at_arms: 4, crossbowmen: 2, light_cav: 2 } } }, { loyalty: { nobles: -6 } }, { mods_t: { mods: { generalTactics: 1, xpGain: 0.3 }, months: 36 } }] },
      { text: 'Grant him a fief for loyal service', effects: [{ loyalty: { nobles: 8 } }, { mods_t: { mods: { discipline: 0.03, armyMorale: 0.03 }, months: 48 } }, { influence: { nobles: 3 } }] },
      { text: 'Send him away', effects: [{ legitimacy: 1 }] },
    ] },
  // ── The heir's schooling
  { id: 'heir_schooling', title: 'The Heir\'s Schooling', icon: '📚', chance: 0.01, cond: (n, g) => !!n.heir && !!g.s.chars[n.heir] && g.age(g.s.chars[n.heir]) >= 6 && g.age(g.s.chars[n.heir]) <= 14 && !['merchant_republic', 'theocracy'].includes(n.gov),
    desc: 'The heir is old enough for a tutor. The court argues about what a king must learn first.',
    options: [
      { text: 'A knight to teach arms and command', effects: [{ custom: 'tutor:martial' }, { loyalty: { nobles: 4 } }] },
      { text: 'A reeve to teach the ledger and law', effects: [{ custom: 'tutor:stewardship' }, { loyalty: { burghers: 4 } }] },
      { text: 'A bishop to teach letters and virtue', effects: [{ custom: 'tutor:learning' }, { loyalty: { clergy: 6 } }] },
      { text: 'A diplomat to teach the courts of Europe', effects: [{ custom: 'tutor:diplomacy' }] },
    ] },
];
