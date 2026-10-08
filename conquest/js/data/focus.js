// National focus trees. Every realm gets a tree assembled from branches that fit it:
// a shared economy/military/diplomacy core, a faith branch, a government branch and,
// for the great powers of 1200, a unique branch built on their real ambitions.
//
// Effect kinds: mods, gold, prestige, legitimacy, stability, manpower, iron, timber, horses,
// claims {tag, box?}, cb {tag, kind}, unlock (unit/law key), build {type, where, n}, dev {where, v},
// gov {gov, name?}, religion, law {cat, opt}, opinion {tag|group, v}, loyalty {estate:v}, influence {estate:v}
const F = (id, name, icon, x, y, opt = {}) => ({ id, name, icon, x, y, days: 70, pre: [], excl: [], effects: [], ...opt });

function rivalOf(n, game) {
  if (n.focusRival && game.nationByTag(n.focusRival)?.alive) return n.focusRival;
  const share = new Map();
  for (const pid of game.ownedProvinces(n.id)) {
    for (const e of game.map.provinces[pid].adj) {
      const o = game.owner(e.id);
      if (o >= 0 && o !== n.id) share.set(o, (share.get(o) || 0) + e.len);
    }
  }
  let best = null, bs = -1;
  for (const [o, s] of share) {
    const m = game.s.nations[o];
    const score = s * (game.power(n.id) > game.power(o) ? 1.6 : 1) * (m.religion === n.religion ? 0.8 : 1.2);
    if (score > bs) { bs = score; best = m.tag; }
  }
  n.focusRival = best;
  return best;
}

function coreBranches(n, game) {
  const rival = rivalOf(n, game);
  const rn = rival ? game.nationByTag(rival).name : 'our rivals';
  const tribal = n.gov === 'tribal', steppe = n.religion === 'tengri' || game.cultureGroup(n.culture) === 'turkic';
  return [
    // ── Economy
    F('royal_survey', tribal ? 'Count the Herds' : 'Royal Survey', '📜', 1, 0, { desc: 'A Domesday-style survey of every manor and hide of land.', effects: [{ mods: { taxMult: 0.05 } }, { gold: 30 }] }),
    F('assart_forests', 'Clear the Wildwood', '🌳', 0, 1, { pre: [['royal_survey']], desc: 'Assarting and drainage bring new land under the plough.', effects: [{ mods: { foodMult: 0.1 } }, { build: { type: 'farm', where: 'random', n: 5 } }] }),
    F('open_mines', 'Open the Mines', '⛏', 2, 1, { pre: [['royal_survey']], desc: 'Prospectors from Saxony and the Harz sink new shafts.', effects: [{ mods: { ironMult: 0.15 } }, { build: { type: 'mine', where: 'random', n: 3 } }] }),
    F('chartered_towns', 'Charter the Towns', '🏘', 1, 2, { pre: [['assart_forests', 'open_mines']], desc: 'Grant charters, markets and liberties to the growing towns.', effects: [{ mods: { tradeMult: 0.1, devGrowth: 0.1 } }, { influence: { burghers: 5 } }, { build: { type: 'market', where: 'capital', n: 1 } }] }),
    F('great_fairs', 'Great Fairs', '🎪', 0, 3, { pre: [['chartered_towns']], desc: 'Like the fairs of Champagne, merchants from all Christendom will come.', effects: [{ mods: { tradeMult: 0.15 } }, { gold: 60 }] }),
    F('royal_mint', tribal ? 'Silver Hoards' : 'Royal Mint', '🪙', 2, 3, { pre: [['chartered_towns']], desc: 'A sound coinage, struck in the ruler\'s name.', effects: [{ mods: { taxMult: 0.08 } }, { legitimacy: 5 }] }),
    F('university', 'Found a University', '🎓', 1, 4, { pre: [['great_fairs', 'royal_mint']], desc: 'Masters and scholars, as at Bologna, Paris and Oxford. Unlocks Roman Law.', effects: [{ unlock: 'roman_law' }, { mods: { focusSpeed: 0.1, legitimacyMonthly: 0.03 } }] }),
    // ── Military
    F('muster_host', 'Muster the Host', '📯', 5, 0, { desc: 'Call every man who owes service to the banners.', effects: [{ mods: { manpowerMult: 0.1 } }, { manpower: 3000 }] }),
    F('castle_building', 'Castle Building', '🏰', 4, 1, { pre: [['muster_host']], desc: 'Raise stone castles on the marches.', effects: [{ mods: { fortDefense: 0.1 } }, { build: { type: 'walls', where: 'capital', n: 1 } }, { build: { type: 'walls', where: 'border', n: 2 } }] }),
    F('drill_sergeants', 'Professional Sergeants', '🎖', 6, 1, { pre: [['muster_host']], desc: 'Paid sergeants drill the levies year-round.', effects: [{ mods: { discipline: 0.05, trainSpeed: 0.1 } }] }),
    steppe
      ? F('horse_tradition', 'Horse Lords', '🏇', 4, 2, { pre: [['castle_building', 'drill_sergeants']], excl: ['infantry_reform'], desc: 'Every warrior a rider, every rider an archer.', effects: [{ unlock: 'horse_archers' }, { mods: { cavAtk: 0.1, horsesMult: 0.2 } }] })
      : F('chivalric_host', n.religion === 'sunni' ? 'Furusiyya' : 'Chivalric Host', '🐎', 4, 2, { pre: [['castle_building', 'drill_sergeants']], excl: ['infantry_reform'], desc: 'Heavy cavalry is the queen of battle.', effects: [{ mods: { cavAtk: 0.1, cavCost: -0.1 } }] }),
    F('infantry_reform', 'Infantry Reform', '🛡', 6, 2, { pre: [['castle_building', 'drill_sergeants']], excl: [steppe ? 'horse_tradition' : 'chivalric_host'], desc: 'Disciplined foot that can stand against horse: the lesson of Legnano.', effects: [{ mods: { infDef: 0.1, infAtk: 0.05 } }] }),
    F('siegecraft', 'Siege Engineers', '⚙', 5, 3, { pre: [[steppe ? 'horse_tradition' : 'chivalric_host', 'infantry_reform']], desc: 'Engineers, sappers and trebuchet-masters.', effects: [{ mods: { siege: 0.25 } }] }),
    F('art_of_war', 'De Re Militari', '📖', 5, 4, { pre: [['siegecraft']], desc: 'Vegetius is copied and studied by every captain.', effects: [{ mods: { armyMorale: 0.05, generalTactics: 1 } }] }),
    // ── Diplomacy & expansion
    F('royal_court', tribal ? 'Hall of the Chieftain' : 'Court of Chivalry', '👑', 9, 0, { desc: 'Tournaments, troubadours and largesse.', effects: [{ prestige: 20 }, { legitimacy: 5 }] }),
    F('dynastic_marriages', 'Dynastic Marriages', '💍', 8, 1, { pre: [['royal_court']], desc: 'Marry our daughters to every throne.', effects: [{ mods: { diplo: 15 } }] }),
    F('press_claims', rival ? `Claims on ${rn}` : 'Ancestral Claims', '📜', 10, 1, { pre: [['royal_court']], desc: rival ? `Our heralds proclaim ancient rights to the borderlands of ${rn}.` : 'Our heralds proclaim ancient rights.', effects: rival ? [{ claims: { tag: rival, border: 2 } }] : [{ prestige: 10 }] }),
    F('conquest', rival ? `Conquest of ${rn}` : 'Wars of Conquest', '⚔', 10, 2, { pre: [['press_claims']], desc: 'The whole realm shall be ours.', effects: rival ? [{ claims: { tag: rival } }, { mods: { armyMorale: 0.03 } }] : [{ mods: { armyMorale: 0.03 } }] }),
    F('web_of_alliances', 'Web of Alliances', '🕸', 8, 2, { pre: [['dynastic_marriages']], desc: 'Friends in every court.', effects: [{ mods: { diplo: 15, aeDecay: 0.25 } }] }),
    F('hegemony', 'Hegemony', '🌟', 9, 3, { pre: [['conquest', 'web_of_alliances']], desc: 'None may stand against us.', effects: [{ prestige: 50 }, { stability: 1 }] }),
  ];
}

function faithBranch(n) {
  const r = n.religion, X = 12;
  if (r === 'catholic') return [
    F('cistercians', 'Patronise the Cistercians', '⛪', X + 1, 0, { desc: 'White monks drain marshes and clear forests for God.', effects: [{ build: { type: 'church', where: 'random', n: 3 } }, { loyalty: { clergy: 10 } }] }),
    F('lateran_reform', 'Lateran Reforms', '📿', X, 1, { pre: [['cistercians']], desc: 'Annual confession, an educated clergy.', effects: [{ mods: { legitimacyMonthly: 0.05, unrest: -1 } }] }),
    F('take_the_cross', 'Take the Cross', '✠', X + 2, 1, { pre: [['cistercians']], desc: 'Deus vult! Holy war against the infidel and the heathen.', effects: [{ cb: { kind: 'holy_war' } }, { mods: { armyMorale: 0.05 } }] }),
    F('military_orders', 'The Military Orders', '🛡', X + 2, 2, { pre: [['take_the_cross']], desc: 'Templars, Hospitallers and Teutonic Knights take up commanderies in our lands.', effects: [{ unlock: 'templars' }] }),
    F('friars', 'Mendicant Friars', '🙏', X, 2, { pre: [['lateran_reform']], desc: 'Franciscans and Dominicans preach in the towns.', effects: [{ mods: { unrest: -2, clergyLoyalty: 5 } }, { stability: 1 }] }),
  ];
  if (r === 'orthodox' || r === 'armenian') return [
    F('monasteries', 'Endow Monasteries', '⛪', X + 1, 0, { desc: 'Royal monasteries in the wilderness, from Athos to the Volga.', effects: [{ build: { type: 'church', where: 'random', n: 3 } }, { loyalty: { clergy: 10 } }] }),
    F('icons', 'Wonder-working Icons', '🖼', X, 1, { pre: [['monasteries']], desc: 'The Theotokos protects the city.', effects: [{ mods: { legitimacyMonthly: 0.05, fortDefense: 0.05 } }] }),
    F('defenders_faith', 'Defenders of the Faith', '☦', X + 2, 1, { pre: [['monasteries']], desc: 'Holy war against the infidel, the heathen and the Latin.', effects: [{ cb: { kind: 'holy_war' } }, { mods: { armyMorale: 0.05 } }] }),
    F('third_rome', 'Heirs of Rome', '🦅', X + 1, 2, { pre: [['icons', 'defenders_faith']], desc: 'The light of Orthodoxy shines from our throne.', effects: [{ prestige: 40 }, { mods: { diplo: 10 } }] }),
  ];
  if (r === 'sunni') return [
    F('madrasas', 'Found Madrasas', '🕌', X + 1, 0, { desc: 'Sunni colleges train qadis and scholars, as Nizam al-Mulk did.', effects: [{ build: { type: 'church', where: 'random', n: 3 } }, { loyalty: { clergy: 10 } }] }),
    F('sufi_orders', 'Patronise Sufi Orders', '🌀', X, 1, { pre: [['madrasas']], desc: 'Dervish lodges calm the countryside.', effects: [{ mods: { unrest: -2, stabilityMonthly: 0.01 } }] }),
    F('jihad', 'Proclaim Jihad', '⚔', X + 2, 1, { pre: [['madrasas']], desc: 'Holy war against the Franks and the infidel.', effects: [{ cb: { kind: 'holy_war' } }, { mods: { armyMorale: 0.05 } }] }),
    F('ghazi_spirit', 'Ghazi Spirit', '🔥', X + 2, 2, { pre: [['jihad']], desc: 'Frontier warriors flock to the banner.', effects: [{ mods: { manpowerMult: 0.1, armyMorale: 0.03 } }] }),
  ];
  return [
    F('honor_gods', 'Honour the Old Gods', '🌳', X + 1, 0, { desc: 'Sacrifices at the sacred groves.', effects: [{ loyalty: { clergy: 15 } }, { mods: { armyMorale: 0.03 } }] }),
    F('defend_groves', 'Defend the Groves', '🛡', X, 1, { pre: [['honor_gods']], excl: ['missionaries'], desc: 'Never shall the cross be planted here.', effects: [{ mods: { defenseHome: 0.15, armyMorale: 0.05 } }, { law: { cat: 'church', opt: 'old_gods' } }] }),
    F('missionaries', 'Invite Missionaries', '✝', X + 2, 1, { pre: [['honor_gods']], excl: ['defend_groves'], desc: 'Welcome the priests, and with them recognition from the Christian kings.', effects: [{ build: { type: 'church', where: 'capital', n: 1 } }, { opinion: { group: 'christian', v: 30 } }] }),
    F('pagan_resurgence', 'Pagan Resurgence', '⚡', X, 2, { pre: [['defend_groves']], desc: 'Perkūnas strikes the invaders.', effects: [{ mods: { manpowerMult: 0.15 } }, { cb: { kind: 'holy_war' } }] }),
    F('christian_crown', 'A Christian Crown', '👑', X + 2, 2, { pre: [['missionaries']], desc: 'Receive baptism and a crown from Rome or Constantinople.', effects: [{ religion: 'auto' }, { gov: { gov: 'feudal_monarchy' } }, { legitimacy: 20 }] }),
  ];
}

function govBranch(n) {
  const X = 16, g = n.gov;
  if (g === 'feudal_monarchy') return [
    F('royal_justice', 'Royal Justice', '⚖', X + 1, 0, { desc: 'The king\'s justices ride on circuit.', effects: [{ mods: { unrest: -1 } }, { unlock: 'common_law_fast' }] }),
    F('curia_regis', 'Curia Regis', '🏛', X + 1, 1, { pre: [['royal_justice']], desc: 'A permanent royal council and exchequer.', effects: [{ mods: { taxMult: 0.05, legitimacyMonthly: 0.03 } }] }),
    F('centralization', 'Centralisation', '⚜', X, 2, { pre: [['curia_regis']], excl: ['feudal_contract'], desc: 'Bring the barons to heel.', effects: [{ influence: { nobles: -8 } }, { mods: { taxMult: 0.08 } }, { loyalty: { nobles: -10 } }] }),
    F('feudal_contract', 'Feudal Contract', '🤝', X + 2, 2, { pre: [['curia_regis']], excl: ['centralization'], desc: 'Honour the vassals\' rights; they shall honour their service.', effects: [{ loyalty: { nobles: 20 } }, { mods: { manpowerMult: 0.1 } }] }),
  ];
  if (g === 'elective_monarchy') return [
    F('imperial_diet', 'Summon the Diet', '🏛', X + 1, 0, { desc: 'The princes of the realm assemble.', effects: [{ loyalty: { nobles: 10 } }, { legitimacy: 10 }] }),
    F('golden_bull', 'Golden Bull', '📜', X, 1, { pre: [['imperial_diet']], excl: ['hereditary_crown'], desc: 'Fix the electors and their privileges forever.', effects: [{ stability: 1 }, { loyalty: { nobles: 15 } }, { mods: { stabilityMonthly: 0.01 } }] }),
    F('hereditary_crown', 'Hereditary Crown', '👑', X + 2, 1, { pre: [['imperial_diet']], excl: ['golden_bull'], desc: 'The Hohenstaufen dream: make the crown hereditary.', effects: [{ gov: { gov: 'feudal_monarchy' } }, { law: { cat: 'succession', opt: 'primogeniture' } }, { loyalty: { nobles: -25 } }] }),
  ];
  if (g === 'imperial') return [
    F('pronoia', 'Pronoia Grants', '🏛', X + 1, 0, { desc: 'Grant tax revenues to soldiers for service.', effects: [{ mods: { manpowerMult: 0.1 } }, { loyalty: { nobles: 10 } }] }),
    F('restore_themes', 'Restore the Themes', '🛡', X + 1, 1, { pre: [['pronoia']], desc: 'Rebuild the soldier-farmer armies of old.', effects: [{ law: { cat: 'military', opt: 'themata' } }, { mods: { discipline: 0.05 } }] }),
    F('komnenian_restoration', 'Komnenian Restoration', '🦅', X + 1, 2, { pre: [['restore_themes']], desc: 'Retake what Manzikert lost.', effects: [{ claims: { tag: 'RUM' } }, { prestige: 30 }] }),
  ];
  if (g === 'merchant_republic') return [
    F('arsenal', 'Build an Arsenal', '⚓', X + 1, 0, { desc: 'State shipyards turn out a galley a day.', effects: [{ build: { type: 'port', where: 'coastal', n: 3 } }, { mods: { seaSpeed: 0.3 } }] }),
    F('merchant_fleets', 'Merchant Galleys', '⛵', X, 1, { pre: [['arsenal']], desc: 'Convoys to Alexandria, Constantinople and Bruges.', effects: [{ mods: { tradeMult: 0.2 } }] }),
    F('stato_da_mar', 'Overseas Empire', '🗺', X + 2, 1, { pre: [['arsenal']], desc: 'Fortified ports and islands along the trade routes.', effects: [{ claims: { coastalNear: 6 } }] }),
    F('trade_league', 'Trade League', '🤝', X + 1, 2, { pre: [['merchant_fleets', 'stato_da_mar']], desc: 'Common cause with the other merchant cities.', effects: [{ opinion: { gov: 'merchant_republic', v: 40 } }, { mods: { tradeMult: 0.1 } }] }),
  ];
  if (g === 'theocracy') return [
    F('papal_bulls', 'Papal Bulls', '📜', X + 1, 0, { desc: 'Rome speaks; Christendom listens.', effects: [{ opinion: { religion: 'catholic', v: 20 } }, { legitimacy: 10 }] }),
    F('fourth_lateran', 'Fourth Lateran Council', '⛪', X, 1, { pre: [['papal_bulls']], desc: 'The greatest council of the age, 1215.', effects: [{ mods: { legitimacyMonthly: 0.05, diplo: 15 } }, { stability: 1 }] }),
    F('great_crusade', 'Proclaim a Crusade', '✠', X + 2, 1, { pre: [['papal_bulls']], desc: 'Call all Christendom to retake Jerusalem.', effects: [{ claims: { tag: 'AYY', box: [33.5, 30.5, 36.8, 34] } }, { cb: { kind: 'holy_war' } }, { unlock: 'templars' }] }),
  ];
  if (g === 'sultanate' || g === 'caliphate') return [
    F('iqta_reform', 'Iqta Reform', '🏛', X + 1, 0, { desc: 'Rotate iqta grants so no emir grows too strong.', effects: [{ mods: { taxMult: 0.05 } }, { influence: { nobles: -5 } }] }),
    F('mamluk_corps', 'Mamluk Corps', '☪', X + 1, 1, { pre: [['iqta_reform']], desc: 'Buy Kipchak boys on the Black Sea and raise them as slave-soldiers.', effects: [{ unlock: 'mamluks' }] }),
    F('great_sultan', g === 'caliphate' ? 'Commander of the Faithful' : 'Sultan of Islam', '🌙', X + 1, 2, { pre: [['mamluk_corps']], desc: 'Every Muslim prince should bow.', effects: [{ claims: { sameReligionNeighbors: true } }, { prestige: 30 }] }),
  ];
  if (g === 'tribal') return [
    F('unite_clans', 'Unite the Clans', '🔥', X + 1, 0, { desc: 'One people, one war-leader.', effects: [{ claims: { tribalNeighbors: true } }, { loyalty: { nobles: 10 } }] }),
    F('great_assembly', 'The Great Assembly', '🏛', X + 1, 1, { pre: [['unite_clans']], desc: 'A thing of all free men.', effects: [{ stability: 1 }, { mods: { stabilityMonthly: 0.01 } }] }),
    F('found_kingdom', 'Found a Kingdom', '👑', X + 1, 2, { pre: [['great_assembly']], desc: 'Become a true kingdom with laws, castles and a court.', req: { provinces: 15 }, effects: [{ gov: { gov: 'feudal_monarchy' } }, { legitimacy: 15 }, { prestige: 30 }] }),
  ];
  return [];
}

// Unique branches for the great powers.
const U = {
  ENG: () => [
    F('angevin_empire', 'Defend the Angevin Empire', '🦁', 20, 0, { desc: 'Hold Normandy, Anjou and Aquitaine against Philip Augustus.', effects: [{ mods: { fortDefense: 0.15 } }, { build: { type: 'walls', where: 'Rouen', n: 1 } }] }),
    F('welsh_longbow', 'The Welsh Longbow', '🎯', 20, 1, { pre: [['angevin_empire']], desc: 'Learn from the archers of Gwent who shot through oak doors.', effects: [{ unlock: 'longbowmen' }, { claims: { tag: 'WAL' } }] }),
    F('lordship_ireland', 'Lordship of Ireland', '☘', 22, 1, { pre: [['angevin_empire']], desc: 'Complete the conquest begun by Strongbow.', effects: [{ claims: { tag: 'IRE' } }] }),
    F('hammer_scots', 'Hammer of the Scots', '⚒', 21, 2, { pre: [['welsh_longbow', 'lordship_ireland']], desc: 'Bring the northern kingdom to heel.', effects: [{ claims: { tag: 'SCO' } }, { mods: { armyMorale: 0.03 } }] }),
    F('magna_carta', 'Magna Carta', '📜', 23, 0, { excl: ['vis_et_voluntas'], desc: 'Seal the Great Charter at Runnymede.', effects: [{ law: { cat: 'nobility', opt: 'charter' } }, { stability: 1 }] }),
    F('vis_et_voluntas', 'Vis et Voluntas', '⚜', 23, 1, { excl: ['magna_carta'], desc: 'The king is above the law.', effects: [{ mods: { taxMult: 0.1 } }, { loyalty: { nobles: -20 } }] }),
  ],
  FRA: () => [
    F('oriflamme', 'The Oriflamme', '🚩', 20, 0, { desc: 'The sacred banner of Saint-Denis goes before the host.', effects: [{ mods: { armyMorale: 0.06 } }] }),
    F('bouvines', 'Road to Bouvines', '⚔', 20, 1, { pre: [['oriflamme']], desc: 'Seize the Plantagenet lands in France.', effects: [{ claims: { tag: 'ENG', box: [-5, 42.5, 7, 51] } }, { claims: { tag: 'FLA' } }] }),
    F('albigensian', 'Albigensian Crusade', '🔥', 22, 1, { pre: [['oriflamme']], desc: 'Root out the Cathar heresy in the south.', effects: [{ claims: { tag: 'TOU' } }, { cb: { kind: 'holy_war', tag: 'TOU' } }] }),
    F('capetian_domain', 'The Royal Domain', '⚜', 21, 2, { pre: [['bouvines', 'albigensian']], desc: 'Baillis and sénéchaux govern the new lands.', effects: [{ mods: { taxMult: 0.1 } }, { prestige: 30 }] }),
    F('capetian_miracle', 'Capetian Miracle', '👑', 21, 3, { pre: [['capetian_domain']], desc: 'An unbroken line of sons for three centuries.', effects: [{ mods: { legitimacyMonthly: 0.08 } }, { stability: 1 }] }),
  ],
  CAS: () => [
    F('spanish_orders', 'Orders of Calatrava & Santiago', '✠', 20, 0, { desc: 'Frontier knights to hold the Tagus line.', effects: [{ unlock: 'templars' }] }),
    F('las_navas', 'Las Navas de Tolosa', '⚔', 20, 1, { pre: [['spanish_orders']], desc: 'Break the Almohads in a great battle.', effects: [{ claims: { tag: 'ALM', box: [-10, 36, 4, 42.5] } }, { mods: { armyMorale: 0.05 } }] }),
    F('union_leon', 'Union of the Crowns', '👑', 22, 1, { pre: [['spanish_orders']], desc: 'León and Castile shall be one.', effects: [{ claims: { tag: 'LEO' } }] }),
    F('repoblacion', 'Repoblación', '🏘', 21, 2, { pre: [['las_navas']], desc: 'Settle the empty frontier with fueros and free colonists.', effects: [{ mods: { devGrowth: 0.2, manpowerMult: 0.1 } }] }),
    F('siete_partidas', 'Siete Partidas', '📜', 21, 3, { pre: [['repoblacion', 'union_leon']], desc: 'Alfonso X\'s great code of law.', effects: [{ unlock: 'roman_law' }, { stability: 1 }] }),
  ],
  LEO: () => [
    F('cortes', 'Cortes of León', '🏛', 20, 0, { desc: 'The first parliament of Europe with town representatives (1188).', effects: [{ influence: { burghers: 8 } }, { stability: 1 }] }),
    F('extremadura', 'Reconquer Extremadura', '⚔', 20, 1, { pre: [['cortes']], desc: 'Cáceres, Mérida and Badajoz.', effects: [{ claims: { tag: 'ALM', box: [-7.6, 37.6, -5, 40] } }] }),
    F('leonese_crown', 'Claim Castile', '👑', 21, 1, { pre: [['cortes']], desc: 'León is the elder crown.', effects: [{ claims: { tag: 'CAS' } }] }),
  ],
  ARA: () => [
    F('almogavars', 'Almogàver Companies', '🗡', 20, 0, { desc: 'Hire the wild frontier infantry.', effects: [{ unlock: 'almogavars' }] }),
    F('majorca', 'Conquest of Majorca', '⛵', 20, 1, { pre: [['almogavars']], desc: 'Take the Balearics from the Moors.', effects: [{ claims: { tag: 'ALM', box: [1, 38.5, 4.5, 40.2] } }] }),
    F('valencia', 'Conquest of Valencia', '🍊', 21, 1, { pre: [['almogavars']], desc: 'The huerta of Valencia.', effects: [{ claims: { tag: 'ALM', box: [-1.6, 38, 0.5, 40.6] } }] }),
    F('consolat', 'Consulate of the Sea', '⚓', 20, 2, { pre: [['majorca']], desc: 'Barcelona\'s maritime code rules the western Mediterranean.', effects: [{ mods: { tradeMult: 0.2 } }] }),
    F('vespers', 'Sicilian Vespers', '🔔', 21, 2, { pre: [['valencia']], desc: 'The crown of Sicily for the house of Barcelona.', effects: [{ claims: { tag: 'SIC', box: [12, 36.5, 15.7, 38.4] } }] }),
  ],
  POR: () => [
    F('algarve', 'Reconquer the Algarve', '⚔', 20, 0, { desc: 'Drive the Moors from the south coast.', effects: [{ claims: { tag: 'ALM', box: [-9.6, 36.8, -6.9, 39.5] } }] }),
    F('aviz', 'Order of Aviz', '✠', 21, 0, { desc: 'Portuguese warrior-monks.', effects: [{ unlock: 'templars' }] }),
    F('atlantic_ports', 'Atlantic Ports', '⚓', 20, 1, { pre: [['algarve']], desc: 'Lisbon and Porto open to the sea.', effects: [{ build: { type: 'port', where: 'coastal', n: 3 } }, { mods: { tradeMult: 0.1 } }] }),
  ],
  HRE: () => [
    F('italian_expedition', 'Italian Expedition', '🇮🇹', 20, 0, { desc: 'Cross the Alps and bring the Lombard cities to obedience.', effects: [{ claims: { tag: 'LOM' } }] }),
    F('ostsiedlung', 'Ostsiedlung', '🏘', 22, 0, { desc: 'German settlers clear forests east of the Elbe.', effects: [{ mods: { devGrowth: 0.2 } }, { claims: { tag: 'POM' } }] }),
    F('teutonic_order', 'Teutonic Order', '✠', 22, 1, { pre: [['ostsiedlung']], desc: 'Sword-brothers for the Baltic crusade.', effects: [{ unlock: 'templars' }, { claims: { tag: 'PRU' } }] }),
    F('reichsstadt', 'Free Imperial Cities', '🏙', 20, 1, { pre: [['italian_expedition']], desc: 'Cities answerable only to the emperor.', effects: [{ mods: { tradeMult: 0.15 } }, { influence: { burghers: 5 } }] }),
    F('restore_imperium', 'Renovatio Imperii', '🦅', 21, 2, { pre: [['reichsstadt', 'teutonic_order']], desc: 'Restore the empire of Charlemagne and Barbarossa.', effects: [{ claims: { tag: 'SAX' } }, { claims: { tag: 'BAV' } }, { prestige: 50 }] }),
  ],
  SAX: () => [
    F('welf_claim', 'The Welf Claim', '🦁', 20, 0, { desc: 'Henry the Lion\'s heirs reclaim the empire.', effects: [{ claims: { tag: 'HRE', box: [6.5, 50, 12, 53.5] } }] }),
    F('hansa', 'Hanseatic League', '🚢', 21, 0, { desc: 'Lübeck, Hamburg and Bremen bound in a trading league.', effects: [{ mods: { tradeMult: 0.2 } }, { build: { type: 'port', where: 'coastal', n: 2 } }] }),
  ],
  BYZ: () => [
    F('varangians', 'Pay the Varangians', '🪓', 20, 0, { desc: 'The emperor\'s axe-bearers must be paid on time.', effects: [{ unlock: 'varangians' }, { gold: -40 }] }),
    F('theodosian_walls', 'Repair the Theodosian Walls', '🏰', 22, 0, { desc: 'No army has breached them in eight centuries.', effects: [{ build: { type: 'walls', where: 'Constantinople', n: 1 } }, { mods: { fortDefense: 0.2 } }] }),
    F('reconquer_anatolia', 'Reconquer Anatolia', '⚔', 20, 1, { pre: [['varangians']], desc: 'Avenge Manzikert and Myriokephalon.', effects: [{ claims: { tag: 'RUM' } }] }),
    F('bulgaria_theme', 'Restore Bulgaria', '🦅', 22, 1, { pre: [['theodosian_walls']], desc: 'Basil the Bulgar-slayer did it once.', effects: [{ claims: { tag: 'BUL' } }, { claims: { tag: 'SER' } }] }),
    F('restoration', 'Renovatio Romanorum', '👑', 21, 2, { pre: [['reconquer_anatolia', 'bulgaria_theme']], desc: 'Rome rises again.', effects: [{ prestige: 60 }, { claims: { tag: 'SIC', box: [15, 39.5, 18.6, 42] } }] }),
  ],
  VEN: () => [
    F('fourth_crusade', 'Divert the Crusade', '⛵', 20, 0, { desc: 'The crusaders cannot pay for their ships... Zara and Constantinople beckon.', effects: [{ claims: { tag: 'HUN', box: [14.5, 43.5, 17, 44.6] } }, { claims: { tag: 'BYZ', box: [26, 40, 30, 42] } }] }),
    F('arsenale', 'The Arsenale', '⚓', 22, 0, { desc: 'Europe\'s greatest shipyard.', effects: [{ build: { type: 'port', where: 'coastal', n: 2 } }, { mods: { seaSpeed: 0.3 } }] }),
    F('stato_mar_ven', 'Stato da Mar', '🗺', 21, 1, { pre: [['fourth_crusade', 'arsenale']], desc: 'Crete, Negroponte, Modon and Coron.', effects: [{ claims: { tag: 'BYZ', box: [19, 34.5, 28, 39.8] } }] }),
    F('st_mark_treasure', 'Treasure of St Mark', '💰', 21, 2, { pre: [['stato_mar_ven']], desc: 'The loot of an empire fills the treasury.', effects: [{ gold: 250 }, { prestige: 30 }] }),
  ],
  GEN: () => [
    F('genoese_crossbows', 'Genoese Crossbowmen', '➶', 20, 0, { desc: 'The finest crossbowmen for hire in Christendom.', effects: [{ mods: { rangedAtk: 0.15 } }] }),
    F('black_sea', 'Black Sea Colonies', '⛵', 21, 0, { desc: 'Caffa and the grain of the steppe.', effects: [{ claims: { tag: 'CUM', box: [32.5, 44.3, 37, 46] } }, { claims: { tag: 'BYZ', box: [32.5, 44.3, 37, 46] } }] }),
    F('meloria', 'Rivalry with Pisa', '⚔', 20, 1, { pre: [['genoese_crossbows']], desc: 'Crush Pisa at sea once and for all.', effects: [{ claims: { tag: 'PIS' } }] }),
  ],
  HUN: () => [
    F('golden_bull_hun', 'Golden Bull of 1222', '📜', 20, 0, { desc: 'Confirm the rights of the servientes against the barons.', effects: [{ law: { cat: 'nobility', opt: 'charter' } }, { stability: 1 }] }),
    F('cuman_settlers', 'Settle the Cumans', '🏇', 21, 0, { desc: 'Welcome Köten\'s horde as royal horse archers.', effects: [{ unlock: 'horse_archers' }] }),
    F('galician_crown', 'Crown of Galicia', '👑', 20, 1, { pre: [['golden_bull_hun']], desc: 'Andrew II was crowned King of Halych.', effects: [{ claims: { tag: 'GAL' } }] }),
    F('dalmatia', 'Dalmatian Coast', '⚓', 21, 1, { pre: [['cuman_settlers']], desc: 'Hold Zara and the Bosnian banate.', effects: [{ claims: { tag: 'BOS' } }, { claims: { tag: 'VEN', box: [17, 42, 19, 43.5] } }] }),
  ],
  POL: () => [
    F('piast_unity', 'Reunite the Piast Realm', '🦅', 20, 0, { desc: 'End the fragmentation of the Testament of Bolesław.', effects: [{ legitimacy: 15 }, { stability: 1 }] }),
    F('prussian_crusade', 'Crusade against the Prussians', '✠', 20, 1, { pre: [['piast_unity']], desc: 'Convert the heathen north.', effects: [{ claims: { tag: 'PRU' } }, { cb: { kind: 'holy_war', tag: 'PRU' } }] }),
    F('pomerelia', 'Pomeranian Coast', '⚓', 21, 1, { pre: [['piast_unity']], desc: 'Gdańsk and the mouth of the Vistula.', effects: [{ claims: { tag: 'POM' } }] }),
    F('magdeburg_rights', 'Magdeburg Rights', '🏙', 21, 0, { desc: 'German town law for new cities.', effects: [{ mods: { tradeMult: 0.1, devGrowth: 0.15 } }] }),
  ],
  DEN: () => [
    F('dannebrog', 'Dannebrog', '🚩', 20, 0, { desc: 'A banner fell from the sky at Lyndanisse, 1219.', effects: [{ mods: { armyMorale: 0.08 } }] }),
    F('estonia', 'Baltic Empire', '⛵', 20, 1, { pre: [['dannebrog']], desc: 'Valdemar\'s conquest of Estonia.', effects: [{ claims: { tag: 'EST' } }, { claims: { tag: 'LIV' } }] }),
    F('holstein', 'Holstein & Lübeck', '🏰', 21, 1, { pre: [['dannebrog']], desc: 'Lord of the north German coast.', effects: [{ claims: { tag: 'SAX', box: [9, 53, 12.5, 54.6] } }, { claims: { tag: 'POM' } }] }),
    F('jyske_lov', 'Code of Jutland', '📜', 21, 0, { desc: 'With law shall the land be built.', effects: [{ stability: 1 }, { mods: { unrest: -1 } }] }),
  ],
  SWE: () => [
    F('finnish_crusade', 'Crusade into Finland', '✠', 20, 0, { desc: 'Bring Tavastia under the cross.', effects: [{ claims: { tag: 'FIN' } }, { cb: { kind: 'holy_war', tag: 'FIN' } }] }),
    F('birger_jarl', 'Birger Jarl', '🏰', 21, 0, { desc: 'Found Stockholm and tame the folkungar.', effects: [{ legitimacy: 15 }, { build: { type: 'walls', where: 'capital', n: 1 } }] }),
  ],
  NOR: () => [
    F('sudreyjar', 'Kingdom of the Isles', '⛵', 20, 0, { desc: 'Hold the Hebrides and Man against the Scots.', effects: [{ claims: { tag: 'SCO', box: [-8, 55.5, -5, 58.6] } }] }),
    F('hird', 'The King\'s Hird', '🛡', 21, 0, { desc: 'A sworn household of professional warriors.', effects: [{ mods: { discipline: 0.08 } }] }),
  ],
  SCO: () => [
    F('schiltrons', 'Schiltron Drill', '🔱', 20, 0, { desc: 'Spearmen drilled to form hedgehogs against English horse.', effects: [{ mods: { infDef: 0.12 } }] }),
    F('auld_alliance', 'The Auld Alliance', '🤝', 21, 0, { desc: 'France and Scotland against England.', effects: [{ opinion: { tag: 'FRA', v: 60 } }] }),
    F('northumbria', 'Claims on Northumbria', '⚔', 20, 1, { pre: [['schiltrons']], desc: 'William the Lion\'s great desire.', effects: [{ claims: { tag: 'ENG', box: [-3.7, 54.3, -1, 55.9] } }] }),
  ],
  PAP: () => [
    F('patrimony', 'Patrimony of Saint Peter', '🗝', 20, 0, { desc: 'Recover the papal lands from imperial vicars.', effects: [{ claims: { tag: 'SIC', box: [13, 41, 15.5, 42.6] } }, { claims: { tag: 'LOM', box: [10.5, 44.2, 12.5, 45] } }] }),
    F('inquisition', 'Papal Inquisition', '🔥', 21, 0, { desc: 'Hunt the heretics of Languedoc and Lombardy.', effects: [{ mods: { unrest: -2, clergyLoyalty: 10 } }] }),
  ],
  SIC: () => [
    F('stupor_mundi', 'Stupor Mundi', '🦅', 20, 0, { desc: 'The young Frederick will be the wonder of the world.', effects: [{ mods: { focusSpeed: 0.15, legitimacyMonthly: 0.04 } }] }),
    F('lucera', 'Saracens of Lucera', '🏹', 21, 0, { desc: 'Resettle Sicilian Muslims as loyal archers.', effects: [{ mods: { rangedAtk: 0.15 } }, { unlock: 'horse_archers' }] }),
    F('melfi', 'Constitutions of Melfi', '📜', 20, 1, { pre: [['stupor_mundi']], desc: 'A centralised state run by trained jurists.', effects: [{ unlock: 'roman_law' }, { mods: { taxMult: 0.1 } }] }),
    F('imperial_crown_sic', 'The Imperial Crown', '👑', 21, 1, { pre: [['stupor_mundi']], desc: 'Claim the Hohenstaufen inheritance in Italy and Germany.', effects: [{ claims: { tag: 'LOM' } }, { claims: { tag: 'HRE', box: [8, 46.5, 11.5, 49.5] } }] }),
  ],
  AYY: () => [
    F('saladin_legacy', 'Saladin\'s Legacy', '🌙', 20, 0, { desc: 'Hold together the realm of the great sultan.', effects: [{ mods: { armyMorale: 0.05 } }, { legitimacy: 10 }] }),
    F('expel_franks', 'Expel the Franks', '⚔', 20, 1, { pre: [['saladin_legacy']], desc: 'Acre, Tyre and Antioch must fall.', effects: [{ claims: { tag: 'JER' } }, { claims: { tag: 'ANT' } }, { cb: { kind: 'holy_war', tag: 'JER' } }] }),
    F('jazira', 'Reunite the Jazira', '🏰', 21, 1, { pre: [['saladin_legacy']], desc: 'Bring Mosul and the Zengids to heel.', effects: [{ claims: { tag: 'ZEN' } }] }),
  ],
  ALM: () => [
    F('jihad_andalus', 'Jihad in al-Andalus', '⚔', 20, 0, { desc: 'Avenge Alarcos with a greater victory.', effects: [{ claims: { tag: 'CAS', box: [-6, 38.5, -1.5, 41] } }, { claims: { tag: 'POR', box: [-9.6, 38, -7, 40] } }] }),
    F('tawhid', 'Doctrine of Tawhid', '🌙', 21, 0, { desc: 'The Mahdi Ibn Tumart\'s strict unity of God.', effects: [{ legitimacy: 15 }, { mods: { armyMorale: 0.04 } }] }),
    F('ribats', 'Ribat Fortresses', '🏰', 20, 1, { pre: [['jihad_andalus']], desc: 'Fortified frontier monasteries.', effects: [{ mods: { fortDefense: 0.15 } }, { build: { type: 'walls', where: 'border', n: 3 } }] }),
  ],
  RUM: () => [
    F('antalya', 'Conquest of Antalya', '⚓', 20, 0, { desc: 'Win a port on the Mediterranean.', effects: [{ claims: { tag: 'BYZ', box: [29, 36, 32.5, 37.6] } }] }),
    F('caravanserais', 'Caravanserais', '🐫', 21, 0, { desc: 'Fortified inns every 30 km along the trade roads.', effects: [{ mods: { tradeMult: 0.25 } }, { build: { type: 'road', where: 'random', n: 6 } }] }),
    F('sultan_rum', 'Sultan of Rome', '🌙', 20, 1, { pre: [['antalya']], desc: 'All Anatolia for the Seljuks.', effects: [{ claims: { tag: 'BYZ', box: [26, 36, 42, 42.5] } }, { claims: { tag: 'CIL' } }] }),
  ],
  GEO: () => [
    F('tamar_golden_age', 'Golden Age of Tamar', '👑', 20, 0, { desc: 'Rustaveli sings, cathedrals rise.', effects: [{ stability: 1 }, { legitimacy: 15 }] }),
    F('shirvan', 'Subdue Shirvan', '⚔', 20, 1, { pre: [['tamar_golden_age']], desc: 'The Shirvanshahs shall be vassals.', effects: [{ claims: { tag: 'SHI' } }] }),
    F('trebizond', 'Empire of Trebizond', '🦅', 21, 1, { pre: [['tamar_golden_age']], desc: 'Set our Komnenian cousins on the throne of Trebizond.', effects: [{ claims: { tag: 'BYZ', box: [37, 40, 42, 41.6] } }] }),
  ],
  LIT: () => [
    F('baltic_unity', 'Unite the Baltic Tribes', '⚡', 20, 0, { desc: 'Samogitians, Prussians and Latgalians under one war-king.', effects: [{ claims: { tag: 'PRU' } }, { claims: { tag: 'LIV' } }] }),
    F('grand_duchy', 'Grand Duchy of Lithuania', '🐎', 20, 1, { pre: [['baltic_unity']], desc: 'Mindaugas\' realm.', effects: [{ gov: { gov: 'feudal_monarchy', name: 'Grand Duchy of Lithuania' } }, { prestige: 30 }] }),
    F('eastward', 'Gather the Ruthenian Lands', '⚔', 21, 1, { pre: [['baltic_unity']], desc: 'The broken Rus\' principalities are ripe.', effects: [{ claims: { tag: 'PLT' } }, { claims: { tag: 'SMO' } }] }),
  ],
  VLA: () => [
    F('big_nest', 'The Big Nest', '🪺', 20, 0, { desc: 'Vsevolod\'s many sons rule his towns.', effects: [{ legitimacy: 10 }, { mods: { manpowerMult: 0.1 } }] }),
    F('gather_rus', 'Gather the Rus\' Lands', '⚔', 20, 1, { pre: [['big_nest']], desc: 'Ryazan and Novgorod must obey Vladimir.', effects: [{ claims: { tag: 'RYA' } }, { claims: { tag: 'NOV', box: [30, 56, 40, 60] } }] }),
    F('volga_bulgars', 'Subdue the Volga Bulgars', '🌙', 21, 1, { pre: [['big_nest']], desc: 'Control the Volga trade.', effects: [{ claims: { tag: 'VOL' } }, { claims: { tag: 'MOR' } }] }),
  ],
  NOV: () => [
    F('veche', 'The Veche', '🔔', 20, 0, { desc: 'The bell of Saint Sophia summons the assembly.', effects: [{ stability: 1 }] }),
    F('peterhof', 'The Peterhof', '🚢', 21, 0, { desc: 'Hanseatic merchants\' court in Novgorod.', effects: [{ mods: { tradeMult: 0.25 } }] }),
    F('northern_tribute', 'Northern Tribute', '🦊', 20, 1, { pre: [['veche']], desc: 'Furs from Perm and the Karelians.', effects: [{ claims: { tag: 'PER' } }, { claims: { tag: 'FIN', box: [26, 60, 32, 64] } }] }),
  ],
  GAL: () => [
    F('roman_great', 'Roman the Great', '⚔', 20, 0, { desc: 'Scourge of the Cumans.', effects: [{ mods: { armyMorale: 0.05 } }, { claims: { tag: 'KIE' } }] }),
    F('rex_russiae', 'Rex Russiae', '👑', 20, 1, { pre: [['roman_great']], desc: 'A crown from the Pope for Daniel of Galicia.', effects: [{ gov: { gov: 'feudal_monarchy', name: 'Kingdom of Ruthenia' } }, { prestige: 40 }] }),
  ],
  KIE: () => [
    F('mother_cities', 'Mother of Rus\' Cities', '⛪', 20, 0, { desc: 'Kiev\'s prestige still commands respect.', effects: [{ prestige: 30 }] }),
    F('reclaim_kiev_throne', 'Senior Throne', '👑', 20, 1, { pre: [['mother_cities']], desc: 'Bring Chernigov and Turov back under the Grand Prince.', effects: [{ claims: { tag: 'CHE' } }] }),
  ],
  BUL: () => [
    F('asen_dynasty', 'Tsar of the Bulgarians', '👑', 20, 0, { desc: 'Kaloyan seeks a crown from the Pope.', effects: [{ legitimacy: 15 }, { prestige: 20 }] }),
    F('thrace', 'Thrace & Macedonia', '⚔', 20, 1, { pre: [['asen_dynasty']], desc: 'Romaioktonos: the Roman-slayer.', effects: [{ claims: { tag: 'BYZ', box: [21, 40.5, 28, 42.6] } }] }),
    F('cuman_allies', 'Cuman Allies', '🐎', 21, 0, { desc: 'Our Cuman kin ride with us.', effects: [{ opinion: { tag: 'CUM', v: 60 } }, { unlock: 'horse_archers' }] }),
  ],
  SER: () => [
    F('nemanjic_church', 'Autocephalous Church', '☦', 20, 0, { desc: 'Saint Sava wins independence for the Serbian church.', effects: [{ law: { cat: 'church', opt: 'autocephaly' } }, { legitimacy: 15 }] }),
    F('serbian_mines', 'Saxon Miners of Novo Brdo', '⛏', 21, 0, { desc: 'German miners open silver mines.', effects: [{ build: { type: 'mine', where: 'random', n: 3 } }, { gold: 40 }] }),
    F('southern_lands', 'Southern Expansion', '⚔', 20, 1, { pre: [['nemanjic_church']], desc: 'Skopje and Macedonia.', effects: [{ claims: { tag: 'BYZ', box: [19, 40.6, 22.5, 42.6] } }] }),
  ],
  CUM: () => [
    F('steppe_raids', 'Steppe Raids', '🔥', 20, 0, { desc: 'Raid the Rus\' and the Bulgarians for slaves and silver.', effects: [{ mods: { lootMult: 0.5 } }, { claims: { tag: 'KIE' } }] }),
    F('kurultai', 'Great Kurultai', '⛺', 21, 0, { desc: 'All khans assemble.', effects: [{ stability: 1 }, { manpower: 5000 }] }),
  ],
  ABB: () => [
    F('caliphal_revival', 'Caliphal Revival', '🌙', 20, 0, { desc: 'Al-Nasir restores the caliph\'s temporal power.', effects: [{ legitimacy: 20 }, { mods: { diplo: 10 } }] }),
    F('futuwwa', 'Futuwwa Brotherhoods', '⚔', 21, 0, { desc: 'Chivalric orders sworn to the caliph.', effects: [{ mods: { armyMorale: 0.06 } }] }),
    F('reclaim_iraq', 'Reclaim the Jazira', '🏰', 20, 1, { pre: [['caliphal_revival']], desc: 'Mosul and the Jibal.', effects: [{ claims: { tag: 'ZEN' } }, { claims: { tag: 'ELD', box: [44, 33, 50, 36] } }] }),
  ],
  JER: () => [
    F('military_orders_jer', 'Templars & Hospitallers', '✠', 20, 0, { desc: 'Krak des Chevaliers and Safed.', effects: [{ unlock: 'templars' }] }),
    F('retake_jerusalem', 'Retake Jerusalem', '⚔', 20, 1, { pre: [['military_orders_jer']], desc: 'The Holy City, lost in 1187.', effects: [{ claims: { tag: 'AYY', box: [34, 30.8, 36.2, 33.4] } }, { cb: { kind: 'holy_war', tag: 'AYY' } }] }),
    F('call_west', 'Appeal to the West', '📯', 21, 0, { desc: 'Letters to Rome, Paris and London.', effects: [{ opinion: { religion: 'catholic', v: 25 } }] }),
  ],
};

export function buildFocusTree(n, game) {
  const tree = [...coreBranches(n, game), ...faithBranch(n), ...govBranch(n), ...(U[n.tag] ? U[n.tag]() : [])];
  return tree;
}
