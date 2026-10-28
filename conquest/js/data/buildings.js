// Province buildings. Each level is shown as a 3D model on the map when zoomed in.
export const BUILDINGS = {
  farm: { name: 'Manorial Farms', icon: '🌾', max: 3, cost: { gold: 18, timber: 2 }, days: 90,
    desc: 'Open fields, three-field rotation and a tithe barn. +food, +development growth.',
    allowed: (p) => p.terrain !== 'mountains' && (p.terrain !== 'desert' || p.river > 0.02) },
  market: { name: 'Market Town', icon: '⚖', max: 3, cost: { gold: 30, timber: 3 }, days: 120,
    desc: 'A chartered market and annual fair. +tax and trade income, +burgher influence.', allowed: (p) => true },
  mine: { name: 'Mines', icon: '⛏', max: 3, cost: { gold: 26, timber: 4 }, days: 150,
    desc: 'Shafts and adits for iron, silver and copper. +iron, some gold.', allowed: (p) => ['hills', 'mountains'].includes(p.terrain) },
  lumber: { name: 'Lumber Camp', icon: '🪵', max: 3, cost: { gold: 12 }, days: 60,
    desc: 'Woodcutters and charcoal burners. +timber.', allowed: (p) => ['forest', 'taiga', 'hills', 'marsh'].includes(p.terrain) },
  stables: { name: 'Stud Farm', icon: '🐴', max: 3, cost: { gold: 22, timber: 2 }, days: 120,
    desc: 'Paddocks breeding destriers and coursers. +horses.', allowed: (p) => ['plains', 'farmland', 'steppe', 'hills', 'desert'].includes(p.terrain) },
  barracks: { name: 'Barracks', icon: '🏕', max: 2, cost: { gold: 28, timber: 4 }, days: 120,
    desc: 'Training grounds and armoury. Recruit here faster, +manpower, +garrison.', allowed: (p) => true },
  walls: { name: 'Castle', icon: '🏰', max: 3, cost: { gold: 40, timber: 6, iron: 2 }, days: 240,
    desc: 'Level 1 motte-and-bailey, level 2 stone keep, level 3 concentric castle. Fort level stops enemy movement until besieged.', allowed: (p) => true },
  church: { name: 'Church', icon: '⛪', max: 3, cost: { gold: 24, timber: 2 }, days: 180,
    desc: 'Parish church → abbey → cathedral (or mosque, or sacred grove). -unrest, +legitimacy, +clergy loyalty, converts faith.', allowed: (p) => true },
  port: { name: 'Harbour', icon: '⚓', max: 2, cost: { gold: 30, timber: 6 }, days: 150,
    desc: 'Quays and shipwrights. +trade, armies embark quickly and cheaply.', allowed: (p) => p.coastal },
  workshop: { name: 'Guild Workshops', icon: '🔨', max: 2, cost: { gold: 34, iron: 2, timber: 2 }, days: 150,
    desc: 'Smiths, armourers and weavers. +iron efficiency, cheaper regiments, +burgher loyalty.', allowed: (p) => true },
  road: { name: 'Roads', icon: '🛤', max: 1, cost: { gold: 16 }, days: 90,
    desc: 'Repaired Roman roads and bridges. +40% movement and +supply.', allowed: (p) => p.terrain !== 'marsh' },
};
// Higher tiers and specialised buildings. Optional fields used by the economy:
//   upkeep  gold per level per month          req    { building: level } needed in the same province
//   minDev  development needed                 slot   false = does not use a building slot
//   mods    realm-wide modifiers per level (capped by `cap`, summed over all provinces)
//   chain   production chain: { use: { resource: per level per month }, mods } — mods only apply while
//           the realm has the input in stock (shortage = chain idle)
//   ai(g, n, p, pr, sp)  build priority for the AI (same scale as the hard-coded ones in aiBuild, ~0.5–4)
Object.assign(BUILDINGS, {
  guildhall: { name: 'Guild Hall', icon: '🏛', max: 2, cost: { gold: 45, timber: 4 }, days: 180, upkeep: 0.15, req: { market: 2 },
    desc: 'Chartered guilds of merchants and craftsmen. +burghers, +tax, +trade power, +burgher loyalty.', allowed: (p) => true,
    mods: { burgherLoyalty: 0.3, taxMult: 0.02, tradeMult: 0.03 }, cap: { burgherLoyalty: 3, taxMult: 0.1, tradeMult: 0.15 }, ai: (g, n, p, pr) => pr.dev / 5 },
  university: { name: 'University', icon: '🎓', max: 1, cost: { gold: 90, timber: 4 }, days: 365, upkeep: 0.5, req: { church: 2, market: 1 }, minDev: 10,
    desc: 'A studium generale of masters and scholars. +development growth here, faster national focus, +prestige.', allowed: (p) => true,
    mods: { focusSpeed: 0.04, prestigeMonthly: 0.01, researchSpeed: 0.03 }, cap: { focusSpeed: 0.2, prestigeMonthly: 0.04, researchSpeed: 0.12 }, ai: (g, n, p, pr) => pr.dev / 6 + (n.gold > 300 ? 1 : 0) },
  cathedral: { name: 'Great Cathedral', icon: '✝', max: 1, cost: { gold: 120, timber: 10, iron: 2 }, days: 720, upkeep: 0.4, req: { church: 3 }, minDev: 12,
    desc: 'A generation of masons raise a house of God to the sky. -unrest, faster conversion, +legitimacy, +clergy loyalty.', allowed: (p) => true,
    mods: { legitimacyMonthly: 0.006, clergyLoyalty: 1, prestigeMonthly: 0.005 }, cap: { legitimacyMonthly: 0.02, clergyLoyalty: 4 }, ai: (g, n, p, pr) => (p === n.capital ? 2 : 0.6) + pr.unrest / 20 },
  tollbridge: { name: 'Toll Bridge', icon: '🌉', max: 1, cost: { gold: 30, timber: 4, iron: 1 }, days: 120, upkeep: 0.05,
    tollGold: 0.45, desc: 'A fortified bridge and toll house on the river. +0.45 gold a month per level from tolls.', allowed: (p) => p.river > 0.03,
    ai: (g, n, p, pr) => 1 + pr.dev / 10 },
  townwalls: { name: 'Town Walls', icon: '🧱', max: 1, cost: { gold: 50, timber: 4, iron: 2 }, days: 240, upkeep: 0.12, req: { market: 1 },
    desc: 'Stone curtain walls around the town. +1 fort level, burghers shelter from looting (devastation heals faster).', allowed: (p) => true,
    ai: (g, n, p, pr) => (g.borderProvinces(n.id).includes(p) ? 1.6 : 0.2) + pr.dev / 12 },
  armoury: { name: 'Armoury', icon: '🛡', max: 2, cost: { gold: 40, iron: 3, timber: 2 }, days: 150, upkeep: 0.1, req: { workshop: 1 },
    desc: 'Smiths turn iron into mail, helms and blades. Uses 1 iron/month per level; while iron lasts, regiments are cheaper to raise.', allowed: (p) => true,
    chain: { use: { iron: 1 }, mods: { recruitCost: -0.03 } }, cap: { recruitCost: -0.18 }, ai: (g, n) => (n.iron > 25 ? 1.8 : 0.3) },
  tiltyard: { name: 'Tiltyard', icon: '🏇', max: 1, cost: { gold: 35, timber: 3 }, days: 120, upkeep: 0.1, req: { stables: 1 },
    desc: 'Lists where squires train warhorses. Uses 1 horse/month; while horses last, cavalry is cheaper and hits harder.', allowed: (p) => true,
    chain: { use: { horses: 1 }, mods: { cavCost: -0.04, cavAtk: 0.02 } }, cap: { cavCost: -0.16, cavAtk: 0.08 }, ai: (g, n) => (n.horses > 15 ? 1.6 : 0.2) },
  shipyard: { name: 'Shipyard', icon: '⛵', max: 2, cost: { gold: 40, timber: 8 }, days: 180, upkeep: 0.1, req: { port: 1 },
    desc: 'Slipways for cogs and galleys. Uses 1.5 timber/month per level; while timber lasts, faster sea transport and +trade power.', allowed: (p) => p.coastal,
    chain: { use: { timber: 1.5 }, mods: { seaSpeed: 0.08 } }, cap: { seaSpeed: 0.3 }, ai: (g, n) => (n.gov === 'merchant_republic' ? 2.5 : 0.6) * (n.timber > 20 ? 1 : 0.3) },
  siegeworks: { name: 'Siege Workshop', icon: '🪚', max: 1, cost: { gold: 35, timber: 6, iron: 1 }, days: 150, upkeep: 0.1, req: { lumber: 1 },
    desc: 'Carpenters build mangonels and trebuchets. Uses 1.5 timber/month; while timber lasts, faster sieges.', allowed: (p) => ['forest', 'taiga', 'hills', 'marsh'].includes(p.terrain),
    chain: { use: { timber: 1.5 }, mods: { siege: 0.1 } }, cap: { siege: 0.3 }, ai: (g, n) => (g.atWar(n.id) ? 1.5 : 0.4) * (n.timber > 20 ? 1 : 0.3) },
});
// upkeep of the original buildings (gold per level per month)
for (const [k, v] of Object.entries({ walls: 0.08, barracks: 0.1, port: 0.04, workshop: 0.05, church: 0.03 })) BUILDINGS[k].upkeep = v;
// Buildings that must first be unlocked by an innovation (progression.js adds 'bld:<key>' to nation.unlocks).
for (const [k, v] of Object.entries({ guildhall: 'Craft Guilds', university: 'Universities', townwalls: 'Concentric Castles', siegeworks: 'Sapper Corps', shipyard: 'Harbour Works' })) BUILDINGS[k].innov = v;
BUILDINGS.road.slot = false;
BUILDINGS.walls.slot = false;

export const BUILDING_ORDER = ['farm', 'market', 'mine', 'lumber', 'stables', 'barracks', 'walls', 'church', 'port', 'workshop', 'road',
  'guildhall', 'university', 'cathedral', 'tollbridge', 'townwalls', 'armoury', 'tiltyard', 'shipyard', 'siegeworks'];

export const CHURCH_NAMES = {
  catholic: ['Parish Church', 'Abbey', 'Cathedral'], orthodox: ['Church', 'Monastery', 'Cathedral'],
  sunni: ['Masjid', 'Madrasa', 'Great Mosque'], pagan: ['Sacred Grove', 'Temple', 'Great Sanctuary'],
  tengri: ['Ovoo Shrine', 'Kurgan Temple', 'Sky Temple'], armenian: ['Church', 'Monastery', 'Cathedral'],
};
export const CASTLE_NAMES = ['Motte-and-bailey', 'Stone keep', 'Concentric castle'];
