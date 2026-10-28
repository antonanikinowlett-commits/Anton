// Province stances: the standing policy a province is run under. Every stance trades something for something else.
// tax/res/mp: output multipliers; unrest: added to the province's unrest target; grow: development growth multiplier;
// fort: extra fort level; garrison: garrison regrowth multiplier. All numbers are shown to the player by the UI.
export const STANCES = {
  balanced: { name: 'Balanced', icon: '⚖', desc: 'Ordinary administration. No bonuses, no penalties.', tax: 1, res: 1, mp: 1, unrest: 0, grow: 1, fort: 0 },
  tax: { name: 'Collect Dues', icon: '💰', desc: 'Sheriffs and tax farmers squeeze the province for every coin.', tax: 1.35, res: 1, mp: 0.9, unrest: 4, grow: 0.4, fort: 0 },
  grow: { name: 'Settle & Improve', icon: '🌱', desc: 'Light taxes, new villages and drained fields: the province grows several times faster.', tax: 0.7, res: 1, mp: 1, unrest: -2, grow: 3, fort: 0 },
  levy: { name: 'Muster Rolls', icon: '🛡', desc: 'Every able man is registered and drilled. Many more recruits, fewer taxes.', tax: 0.8, res: 1, mp: 1.7, unrest: 1.5, grow: 0.7, fort: 0 },
  fortify: { name: 'Fortify', icon: '🏰', desc: 'Corvée labour on walls and beacons: +1 fort level for sieges, slightly lower output.', tax: 0.85, res: 0.9, mp: 1.1, unrest: 1, grow: 0.5, fort: 1 },
  stockpile: { name: 'Stockpile', icon: '📦', desc: 'Granaries, smithies and woodyards work for the crown: +50% food, iron, timber and horses.', tax: 0.85, res: 1.5, mp: 1, unrest: 0.5, grow: 0.8, fort: 0 },
};
export const STANCE_ORDER = ['balanced', 'tax', 'grow', 'levy', 'fortify', 'stockpile'];
export const STANCE_COOLDOWN = 120; // days before a province can change stance again
// Building slots: levels of slot-using buildings a province can hold.
export const slotsFor = (dev) => 3 + Math.floor(dev / 2.5);
