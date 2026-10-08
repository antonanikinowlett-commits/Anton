// Regiment archetypes. Combat values are per 1,000 men (per 500 for knights/horse units marked).
// atk: melee damage, def: melee damage absorbed, armor: reduces missile & melee losses,
// charge: shock bonus on first contact, anti: bonus vs cavalry, ranged: missile volley,
// pursuit: casualties inflicted on routing foes, screen: protects flanks/ranks, siege: siege power.
export const UNITS = {
  levy_spear: { name: 'Levy Spearmen', icon: '🛡', cls: 'inf', men: 1000, atk: 1.0, def: 1.3, armor: 0.1, morale: 0.75, charge: 0, anti: 1.5, ranged: 0, pursuit: 0.2, screen: 0.4, speed: 20, cost: { gold: 5 }, upkeep: 0.10, days: 25,
    desc: 'Peasants with spear and shield raised by feudal obligation. Cheap and numerous, steady behind a shield wall but brittle when flanked.' },
  men_at_arms: { name: 'Men-at-Arms', icon: '⚔', cls: 'inf', men: 1000, atk: 2.1, def: 1.9, armor: 0.5, morale: 1.0, charge: 0.3, anti: 1.0, ranged: 0, pursuit: 0.4, screen: 0.6, speed: 20, cost: { gold: 16, iron: 3 }, upkeep: 0.30, days: 60,
    desc: 'Professional armoured infantry in mail and helm. The backbone of any serious medieval host.' },
  pikemen: { name: 'Pikemen', icon: '🔱', cls: 'inf', men: 1000, atk: 1.2, def: 2.3, armor: 0.25, morale: 0.95, charge: 0, anti: 2.6, ranged: 0, pursuit: 0.1, screen: 0.9, speed: 18, cost: { gold: 11, iron: 1, timber: 1 }, upkeep: 0.20, days: 45,
    desc: 'Dense blocks of long spears. A cavalry charge into a schiltron, as at Stirling Bridge and Bannockburn, is suicide.' },
  archers: { name: 'Bowmen', icon: '🏹', cls: 'rng', men: 1000, atk: 0.6, def: 0.6, armor: 0.05, morale: 0.75, charge: 0, anti: 0.5, ranged: 1.5, pursuit: 0.5, screen: 0.1, speed: 21, cost: { gold: 8, timber: 1 }, upkeep: 0.12, days: 35,
    desc: 'Short and self bows. Thin the enemy ranks before the lines close.' },
  longbowmen: { name: 'Longbowmen', icon: '🎯', cls: 'rng', men: 1000, atk: 0.9, def: 0.8, armor: 0.1, morale: 0.95, charge: 0, anti: 0.7, ranged: 2.7, pursuit: 0.6, screen: 0.2, speed: 21, cost: { gold: 15, timber: 2 }, upkeep: 0.22, days: 90,
    desc: 'Welsh and English yew longbows. Massed volleys broke the flower of chivalry at Crécy and Agincourt.', req: { cultures: ['english', 'welsh'], unlock: 'longbowmen' } },
  crossbowmen: { name: 'Crossbowmen', icon: '➶', cls: 'rng', men: 1000, atk: 0.8, def: 1.1, armor: 0.25, morale: 0.85, charge: 0, anti: 0.8, ranged: 2.1, pierce: 0.6, pursuit: 0.3, screen: 0.3, speed: 18, cost: { gold: 13, iron: 1, timber: 1 }, upkeep: 0.2, days: 55,
    desc: 'Pavise-sheltered crossbows that punch through mail. Genoese companies were hired across Christendom.' },
  light_cav: { name: 'Light Cavalry', icon: '🐎', cls: 'cav', men: 500, atk: 1.4, def: 0.8, armor: 0.15, morale: 0.9, charge: 1.2, anti: 0.4, ranged: 0, pursuit: 2.2, screen: 1.0, speed: 34, cost: { gold: 12, horses: 1 }, upkeep: 0.25, days: 45,
    desc: 'Hobelars, sergeants and jinetes. Scout, screen the flanks and cut down fleeing men.' },
  knights: { name: 'Knights', icon: '♞', cls: 'cav', men: 500, atk: 3.0, def: 2.3, armor: 0.75, morale: 1.3, charge: 3.6, anti: 0.6, ranged: 0, pursuit: 1.3, screen: 0.8, speed: 28, cost: { gold: 32, iron: 4, horses: 2 }, upkeep: 0.65, days: 120,
    desc: 'Mailed lancers on destriers. The couched-lance charge can shatter any line that is not braced to meet it.' },
  horse_archers: { name: 'Horse Archers', icon: '🏇', cls: 'cav', men: 500, atk: 1.1, def: 0.8, armor: 0.15, morale: 0.95, charge: 0.6, anti: 0.4, ranged: 1.7, pursuit: 2.0, screen: 1.1, speed: 38, cost: { gold: 13, horses: 1, timber: 1 }, upkeep: 0.24, days: 50,
    desc: 'Steppe riders who shoot from the saddle and never stand still: the bane of Manzikert and Liegnitz.', req: { groups: ['turkic'], govs: ['tribal'], religions: ['tengri'], unlock: 'horse_archers' } },
  mamluks: { name: 'Mamluks', icon: '☪', cls: 'cav', men: 500, atk: 2.6, def: 2.1, armor: 0.6, morale: 1.3, charge: 2.4, anti: 0.6, ranged: 1.0, pursuit: 1.5, screen: 0.9, speed: 30, cost: { gold: 30, iron: 3, horses: 2 }, upkeep: 0.6, days: 120,
    desc: 'Slave-soldier heavy cavalry, trained from boyhood with lance, sword and bow.', req: { govs: ['sultanate', 'caliphate'], unlock: 'mamluks' } },
  varangians: { name: 'Varangian Guard', icon: '🪓', cls: 'inf', men: 1000, atk: 2.8, def: 2.0, armor: 0.6, morale: 1.4, charge: 0.6, anti: 1.1, ranged: 0, pursuit: 0.4, screen: 0.6, speed: 20, cost: { gold: 30, iron: 3 }, upkeep: 0.55, days: 100,
    desc: 'The emperor\'s axe-bearing Norse and English guard. Fanatically loyal, terrifying in the press.', req: { tags: ['BYZ'], unlock: 'varangians' } },
  almogavars: { name: 'Almogàvers', icon: '🗡', cls: 'inf', men: 1000, atk: 2.2, def: 1.1, armor: 0.15, morale: 1.1, charge: 0.8, anti: 1.4, ranged: 0.5, pursuit: 0.9, screen: 0.5, speed: 24, cost: { gold: 12, iron: 1 }, upkeep: 0.2, days: 50,
    desc: 'Frontier light infantry of the Reconquista: javelins, short sword and no armour, superb in rough country.', req: { cultures: ['catalan', 'castilian', 'portuguese', 'basque'], unlock: 'almogavars' } },
  templars: { name: 'Military Order Knights', icon: '✠', cls: 'cav', men: 500, atk: 3.2, def: 2.6, armor: 0.8, morale: 1.6, charge: 3.6, anti: 0.6, ranged: 0, pursuit: 1.0, screen: 0.8, speed: 26, cost: { gold: 38, iron: 4, horses: 2 }, upkeep: 0.7, days: 140,
    desc: 'Templars, Hospitallers and Santiago knights: warrior-monks sworn never to retreat unless outnumbered three to one.', req: { religions: ['catholic'], unlock: 'templars' } },
  mangonel: { name: 'Mangonels', icon: '⚙', cls: 'siege', men: 300, atk: 0.2, def: 0.3, armor: 0, morale: 0.6, charge: 0, anti: 0, ranged: 0.6, pursuit: 0, screen: 0, siege: 1.5, speed: 14, cost: { gold: 10, timber: 4 }, upkeep: 0.15, days: 40,
    desc: 'Traction catapults to batter palisades and lob fire over walls.' },
  trebuchet: { name: 'Trebuchets', icon: '🏰', cls: 'siege', men: 300, atk: 0.1, def: 0.2, armor: 0, morale: 0.6, charge: 0, anti: 0, ranged: 0.3, pursuit: 0, screen: 0, siege: 3.2, speed: 12, cost: { gold: 22, timber: 7, iron: 1 }, upkeep: 0.3, days: 80,
    desc: 'Counterweight engines hurling 100 kg stones. Stone curtain walls finally had an answer.', req: { unlock: 'trebuchet', default: true } },
};

export const UNIT_ORDER = ['levy_spear', 'men_at_arms', 'pikemen', 'varangians', 'almogavars', 'archers', 'longbowmen', 'crossbowmen', 'light_cav', 'horse_archers', 'knights', 'mamluks', 'templars', 'mangonel', 'trebuchet'];

// Terrain multipliers on unit class effectiveness (attack/defence). Cavalry hates broken ground.
export const TERRAIN_COMBAT = {
  farmland: { inf: 1, rng: 1, cav: 1.1, width: 30 },
  plains: { inf: 1, rng: 1, cav: 1.2, width: 32 },
  steppe: { inf: 0.95, rng: 1, cav: 1.3, width: 36 },
  forest: { inf: 1.05, rng: 0.7, cav: 0.6, width: 18 },
  taiga: { inf: 1.05, rng: 0.7, cav: 0.55, width: 16 },
  hills: { inf: 1.05, rng: 1.15, cav: 0.8, width: 22 },
  mountains: { inf: 1.1, rng: 1.0, cav: 0.45, width: 14 },
  marsh: { inf: 0.85, rng: 0.85, cav: 0.4, width: 14 },
  desert: { inf: 0.9, rng: 1.0, cav: 1.15, width: 32 },
};

export function unitAvailable(type, nation, game) {
  const u = UNITS[type];
  if (!u.req) return true;
  const r = u.req;
  if (r.default) return true;
  if (nation.unlocks && nation.unlocks.includes(r.unlock)) return true;
  const grp = game.cultureGroup(nation.culture);
  if (r.cultures && r.cultures.includes(nation.culture)) return true;
  if (r.groups && r.groups.includes(grp)) return true;
  if (r.govs && r.govs.includes(nation.gov) && (type !== 'horse_archers' || ['turkic'].includes(grp) || nation.religion === 'tengri')) return true;
  if (r.religions && r.religions.includes(nation.religion) && type !== 'templars') return true;
  if (r.tags && r.tags.includes(nation.tag)) return true;
  return false;
}

export function unitReqText(type) {
  const r = UNITS[type].req;
  if (!r) return '';
  const p = [];
  if (r.cultures) p.push(r.cultures.join('/') + ' culture');
  if (r.groups) p.push(r.groups.join('/') + ' peoples');
  if (r.govs) p.push(r.govs.join('/').replace(/_/g, ' '));
  if (r.tags) p.push('realm ' + r.tags.join('/'));
  if (r.religions && type !== 'templars') p.push(r.religions.join('/'));
  p.push('or a national focus');
  return 'Requires ' + p.join(', or ');
}
