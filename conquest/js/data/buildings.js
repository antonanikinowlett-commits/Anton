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
export const BUILDING_ORDER = ['farm', 'market', 'mine', 'lumber', 'stables', 'barracks', 'walls', 'church', 'port', 'workshop', 'road'];

export const CHURCH_NAMES = {
  catholic: ['Parish Church', 'Abbey', 'Cathedral'], orthodox: ['Church', 'Monastery', 'Cathedral'],
  sunni: ['Masjid', 'Madrasa', 'Great Mosque'], pagan: ['Sacred Grove', 'Temple', 'Great Sanctuary'],
  tengri: ['Ovoo Shrine', 'Kurgan Temple', 'Sky Temple'], armenian: ['Church', 'Monastery', 'Cathedral'],
};
export const CASTLE_NAMES = ['Motte-and-bailey', 'Stone keep', 'Concentric castle'];
