// National military doctrines. Each realm follows one, chosen from its culture and government when
// first needed; a doctrine gives permanent modifiers plus a perk that switches on once the realm has
// researched the named innovation. Mod keys are the ones game.recalcMods understands.
export const MIL_DOCTRINES = {
  feudal_levy: { name: 'Feudal Levy', icon: '🛡', desc: 'Vassals bring their retinues to the host: plentiful, cheap men, strong at home, slow to train.',
    mods: { manpowerMult: 0.15, recruitCost: -0.1, infDef: 0.04, upkeepMult: -0.05 },
    perk: { innov: 'castle_concentric', name: 'Castle Network', desc: 'Concentric castles anchor the levy: +10% fort defence, +5% defence at home.', mods: { fortDefense: 0.1, defenseHome: 0.05 } } },
  professional_retinue: { name: 'Professional Retinue', icon: '⚔', desc: 'Paid, drilled household troops and condottieri: better discipline and morale, but costly and fewer.',
    mods: { discipline: 0.08, armyMorale: 0.05, upkeepMult: 0.08, manpowerMult: -0.1 },
    perk: { innov: 'standing_retinue', name: 'Standing Army', desc: 'Permanent retinues drill year-round: +8% discipline and 20% faster training.', mods: { discipline: 0.08, trainSpeed: 0.2 } } },
  horde_crusade: { name: 'Horde & Crusading Orders', icon: '🏇', desc: 'Warrior peoples and sworn orders live for the charge: strong cavalry and morale, thin on siegecraft.',
    mods: { cavAtk: 0.1, armyMorale: 0.08, siege: -0.15 },
    perk: { innov: 'couched_lance', name: 'Shock Doctrine', desc: 'Lance drill lets the host strike as one: +8% cavalry attack and 20% more loot.', mods: { cavAtk: 0.08, lootMult: 0.2 } } },
};

export function pickMilDoctrine(n) {
  if (n.group === 'turkic' || n.group === 'mongol' || n.gov === 'tribal' || n.gov === 'horde' || ['TEU', 'HOS', 'TEM'].includes(n.tag)) return 'horde_crusade';
  if (['merchant_republic', 'sultanate', 'caliphate', 'imperial', 'theocracy'].includes(n.gov) || ['BYZ', 'VEN', 'GEN'].includes(n.tag)) return 'professional_retinue';
  return 'feudal_levy';
}

// Modifier set currently granted by nation n's doctrine (base + unlocked perk).
export function milDoctrineMods(n) {
  if (!n.milDoc) n.milDoc = pickMilDoctrine(n);
  const d = MIL_DOCTRINES[n.milDoc];
  if (!d) return null;
  const out = { ...d.mods };
  if (d.perk && n.prog && n.prog.known && n.prog.known.includes(d.perk.innov)) for (const [k, v] of Object.entries(d.perk.mods)) out[k] = (out[k] || 0) + v;
  return out;
}
