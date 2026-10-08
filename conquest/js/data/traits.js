// Character traits. mods apply to the realm (rulers/ministers) or the army (generals).
export const TRAITS = {
  // personality
  brave: { name: 'Brave', icon: '🦁', desc: 'Leads from the front.', gen: { morale: 0.08 }, mods: { prestigeMonthly: 0.05 } },
  craven: { name: 'Craven', icon: '🐇', desc: 'Values his own skin.', gen: { morale: -0.1 }, mods: { prestigeMonthly: -0.05 } },
  ambitious: { name: 'Ambitious', icon: '👑', desc: 'Hungers for more.', mods: { claimSpeed: 0.15, stabilityMonthly: -0.005 } },
  content: { name: 'Content', icon: '☺', desc: 'Satisfied with his lot.', mods: { stabilityMonthly: 0.01 } },
  cruel: { name: 'Cruel', icon: '🗡', desc: 'Rules by fear.', mods: { unrest: -2, nobleLoyalty: -5 } },
  chivalrous: { name: 'Chivalrous', icon: '🛡', desc: 'Lives by the code of chivalry.', gen: { morale: 0.05 }, mods: { prestigeMonthly: 0.08, nobleLoyalty: 5 } },
  pious: { name: 'Pious', icon: '✝', desc: 'Devout in faith.', mods: { legitimacyMonthly: 0.05, clergyLoyalty: 8 } },
  zealous: { name: 'Zealous', icon: '🔥', desc: 'A fire for the faith.', gen: { morale: 0.06 }, mods: { clergyLoyalty: 5, diplo: -5 } },
  tolerant: { name: 'Tolerant', icon: '🕊', desc: 'Suffers other faiths.', mods: { unrest: -3, clergyLoyalty: -5 } },
  shrewd: { name: 'Shrewd', icon: '🦊', desc: 'Sharp of mind.', mods: { taxMult: 0.05, claimSpeed: 0.1 } },
  greedy: { name: 'Greedy', icon: '💰', desc: 'Loves gold.', mods: { taxMult: 0.08, nobleLoyalty: -4 } },
  diligent: { name: 'Diligent', icon: '📜', desc: 'Hard-working administrator.', mods: { buildSpeed: 0.1, taxMult: 0.03 } },
  diplomat: { name: 'Gifted Diplomat', icon: '🤝', desc: 'Silver-tongued.', mods: { diplo: 15, aeDecay: 0.25 } },
  scholar: { name: 'Scholar', icon: '📚', desc: 'Learned in letters.', mods: { focusSpeed: 0.1, legitimacyMonthly: 0.02 } },
  stubborn: { name: 'Stubborn', icon: '🪨', desc: 'Never yields.', gen: { def: 0.05 }, mods: { stabilityMonthly: 0.005 } },
  drunkard: { name: 'Drunkard', icon: '🍷', desc: 'Fond of wine.', mods: { taxMult: -0.05, stabilityMonthly: -0.005 } },
  giant: { name: 'Giant', icon: '🗿', desc: 'Towering stature.', gen: { morale: 0.05 }, mods: { prestigeMonthly: 0.04 } },
  blind: { name: 'Blind', icon: '🕶', desc: 'Sightless, yet still sharp.', mods: { legitimacyMonthly: -0.02 } },
  // military
  aggressive: { name: 'Aggressive', icon: '⚔', mil: true, desc: '+15% attack, -5% defence.', gen: { atk: 0.15, def: -0.05 } },
  cavalry_commander: { name: 'Cavalry Commander', icon: '🐎', mil: true, desc: '+25% cavalry attack and charge.', gen: { cav: 0.25 } },
  horse_lord: { name: 'Horse Lord', icon: '🏇', mil: true, desc: '+20% cavalry, +20% speed for horse armies.', gen: { cav: 0.2, speed: 0.1 } },
  defensive_expert: { name: 'Defensive Expert', icon: '🏯', mil: true, desc: '+20% defence when defending.', gen: { defDefending: 0.2 } },
  ambusher: { name: 'Ambusher', icon: '🌲', mil: true, desc: 'Masters ambushes in rough terrain.', gen: { roughTerrain: 0.15 } },
  siege_master: { name: 'Siege Master', icon: '🏰', mil: true, desc: '+50% siege progress.', gen: { siege: 0.5 } },
  logistician: { name: 'Logistician', icon: '🛒', mil: true, desc: '-50% attrition, +20% supply.', gen: { attrition: -0.5, supply: 0.2 } },
  archer_lord: { name: 'Master of Archers', icon: '🏹', mil: true, desc: '+25% ranged damage.', gen: { ranged: 0.25 } },
  inspiring: { name: 'Inspiring', icon: '🚩', mil: true, desc: '+12% morale.', gen: { morale: 0.12 } },
  reckless: { name: 'Reckless', icon: '💥', mil: true, desc: '+20% attack, +15% casualties taken.', gen: { atk: 0.2, casualties: 0.15 } },
  naval_raider: { name: 'Sea Raider', icon: '⛵', mil: true, desc: 'Fast at sea, +attack on landing.', gen: { landing: 0.5, speed: 0.05 } },
  winter_soldier: { name: 'Winter Soldier', icon: '❄', mil: true, desc: 'No winter attrition.', gen: { winter: 1 } },
};
export const GEN_TRAIT_POOL = ['aggressive', 'cavalry_commander', 'defensive_expert', 'ambusher', 'siege_master', 'logistician', 'archer_lord', 'inspiring', 'reckless', 'winter_soldier', 'horse_lord'];
export const PERS_TRAIT_POOL = ['brave', 'craven', 'ambitious', 'content', 'cruel', 'chivalrous', 'pious', 'zealous', 'tolerant', 'shrewd', 'greedy', 'diligent', 'diplomat', 'scholar', 'stubborn', 'drunkard'];
