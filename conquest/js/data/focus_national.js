// Extra national focus nodes, appended to the per-nation branches in focus.js.
// N(id, name, icon, x, y, desc, pre, effects, excl) — pre is a flat list (any-of group).
const N = (id, name, icon, x, y, desc, pre, effects, excl = []) =>
  ({ id, name, icon, x, y, days: 70, pre: pre.length ? [pre] : [], excl, effects, desc });

export const NAT = {
  ENG: () => [
    N('exchequer_rolls', 'The Pipe Rolls', '📜', 20, 3, 'The Exchequer records every sheriff\'s account.', ['hammer_scots', 'magna_carta', 'vis_et_voluntas'], [{ mods: { taxMult: 0.08 } }, { gold: 40 }]),
    N('common_law', 'Common Law', '⚖', 21, 4, 'Itinerant justices carry the king\'s writ to every shire.', ['exchequer_rolls'], [{ unlock: 'common_law_fast' }, { stability: 1 }]),
    N('cinque_ports', 'Cinque Ports', '⚓', 22, 4, 'Ship-service from the Channel ports.', ['exchequer_rolls'], [{ build: { type: 'port', where: 'coastal', n: 2 } }, { mods: { seaSpeed: 0.2 } }]),
    N('wool_trade', 'The Wool Staple', '🐑', 20, 5, 'English fleeces clothe Flanders.', ['common_law'], [{ mods: { tradeMult: 0.15 } }, { influence: { burghers: 5 } }]),
    N('parliament_seed', 'Great Council', '🏛', 21, 5, 'Barons and knights of the shire advise the crown.', ['common_law'], [{ loyalty: { nobles: 10 } }, { influence: { nobles: 4 } }], ['royal_prerogative']),
    N('royal_prerogative', 'Royal Prerogative', '👑', 22, 5, 'The king alone chooses his counsellors.', ['common_law'], [{ mods: { taxMult: 0.08 } }, { loyalty: { nobles: -10 } }], ['parliament_seed']),
    N('lose_normandy', 'Reconquer Normandy', '⚔', 20, 6, 'Recover the cradle of the Conqueror.', ['wool_trade', 'parliament_seed'], [{ claims: { tag: 'FRA', box: [-2, 48, 2, 50.2] } }, { cb: { kind: 'conquest', tag: 'FRA' } }]),
    N('great_chamber', 'Westminster Rebuilt', '🏰', 21, 6, 'Henry III\'s Westminster Abbey.', ['parliament_seed', 'royal_prerogative'], [{ prestige: 30 }, { legitimacy: 10 }]),
    N('statute_arms', 'Assize of Arms', '🛡', 22, 6, 'Every freeman keeps arms by his rank.', ['royal_prerogative', 'cinque_ports'], [{ mods: { manpowerMult: 0.15 } }, { mods: { infDef: 0.05 } }]),
    N('edwardian_castles', 'Ring of Iron', '🏰', 20, 7, 'Great castles ring Wales.', ['lose_normandy', 'great_chamber'], [{ mods: { fortDefense: 0.15 } }, { build: { type: 'walls', where: 'border', n: 3 } }]),
    N('model_parliament', 'The Model Realm', '🦁', 21, 7, 'The English crown at the height of its authority.', ['great_chamber', 'statute_arms'], [{ prestige: 50 }, { mods: { taxMult: 0.05, legitimacyMonthly: 0.05 } }]),
  ],
  FRA: () => [
    N('philip_walls', 'Walls of Paris', '🏰', 20, 4, 'Philip Augustus encircles Paris and builds the Louvre.', ['capetian_domain'], [{ build: { type: 'walls', where: 'capital', n: 1 } }, { mods: { fortDefense: 0.08 } }]),
    N('baillis', 'Baillis and Sénéchaux', '⚖', 22, 4, 'Salaried royal officials replace hereditary vassals.', ['capetian_domain'], [{ mods: { taxMult: 0.1 } }, { influence: { nobles: -4 } }], ['peers_of_france']),
    N('peers_of_france', 'Twelve Peers', '👑', 23, 4, 'The great vassals sit as peers of the realm.', ['capetian_domain'], [{ loyalty: { nobles: 20 } }, { influence: { nobles: 5 } }], ['baillis']),
    N('university_paris', 'University of Paris', '📚', 20, 5, 'Masters and scholars flock to the Left Bank.', ['philip_walls'], [{ mods: { focusSpeed: 0.1 } }, { loyalty: { clergy: 8 } }]),
    N('gothic_cathedrals', 'Gothic Cathedrals', '⛪', 21, 5, 'Chartres, Reims and Notre-Dame rise.', ['philip_walls', 'baillis'], [{ prestige: 30 }, { mods: { legitimacyMonthly: 0.04 } }]),
    N('champagne_fairs', 'Champagne Fairs', '💰', 22, 5, 'The great fairs of Troyes and Provins.', ['baillis', 'peers_of_france'], [{ mods: { tradeMult: 0.2 } }]),
    N('chivalry_france', 'Chivalry of France', '🐎', 23, 5, 'The heavy horse of the Île-de-France.', ['peers_of_france'], [{ mods: { cavAtk: 0.1 } }, { mods: { armyMorale: 0.03 } }]),
    N('saint_louis', 'The Justice of Saint Louis', '✝', 21, 6, 'The king sits under the oak at Vincennes.', ['university_paris', 'gothic_cathedrals'], [{ stability: 1 }, { legitimacy: 15 }, { mods: { unrest: -1 } }]),
    N('south_france', 'Absorb Aquitaine', '⚔', 22, 6, 'Gascony and the Limousin to the lilies.', ['champagne_fairs', 'chivalry_france'], [{ claims: { tag: 'ENG', box: [-1.5, 43, 2, 46] } }, { claims: { tag: 'TOU' } }]),
    N('eldest_daughter', 'Eldest Daughter of the Church', '🗝', 21, 7, 'France, the sword and shield of Rome.', ['saint_louis', 'south_france'], [{ opinion: { tag: 'PAP', v: 60 } }, { prestige: 40 }]),
  ],
  HRE: () => [
    N('hohenstaufen_lands', 'Hohenstaufen Lands', '🦅', 20, 3, 'Swabia and Alsace, the dynasty\'s heartland.', ['restore_imperium'], [{ mods: { taxMult: 0.08 } }, { legitimacy: 10 }]),
    N('diet_reichstag', 'The Reichstag', '🏛', 21, 3, 'Princes assemble at the imperial diet.', ['restore_imperium'], [{ loyalty: { nobles: 15 } }, { stability: 1 }], ['imperial_ministeriales']),
    N('imperial_ministeriales', 'Ministeriales', '🛡', 22, 3, 'Unfree knights, loyal to the emperor alone.', ['restore_imperium'], [{ mods: { manpowerMult: 0.12 } }, { loyalty: { nobles: -10 } }], ['diet_reichstag']),
    N('golden_bull_hre', 'Privilege for the Princes', '📜', 20, 4, 'Confirm the Statute in favour of the ecclesiastical princes.', ['hohenstaufen_lands', 'diet_reichstag'], [{ loyalty: { clergy: 15, nobles: 5 } }]),
    N('sicily_inherit', 'The Sicilian Inheritance', '🌋', 21, 4, 'Henry VI\'s marriage brought the Regno.', ['diet_reichstag', 'imperial_ministeriales'], [{ claims: { tag: 'SIC' } }]),
    N('landfriede', 'Landfriede', '⚖', 22, 4, 'The public peace forbids private war.', ['imperial_ministeriales'], [{ stability: 1 }, { mods: { unrest: -1 } }]),
    N('rhine_tolls', 'Rhine Tolls', '💰', 20, 5, 'Cologne, Mainz and Worms profit.', ['golden_bull_hre', 'landfriede'], [{ mods: { tradeMult: 0.15 } }, { gold: 40 }]),
    N('bohemia_vassal', 'Bohemian Crown', '🦁', 21, 5, 'Bind Bohemia as a loyal kingdom.', ['sicily_inherit'], [{ claims: { tag: 'BOH' } }]),
    N('crusader_emperor', 'The Emperor Crusades', '✠', 22, 5, 'Frederick II sails for Jerusalem.', ['sicily_inherit', 'landfriede'], [{ claims: { tag: 'JER' } }, { prestige: 40 }]),
    N('stupor_empire', 'Wonder of the World', '🌍', 21, 6, 'Court of scholars and falcons.', ['rhine_tolls', 'bohemia_vassal', 'crusader_emperor'], [{ mods: { focusSpeed: 0.1, legitimacyMonthly: 0.05 } }, { prestige: 50 }]),
  ],
  BYZ: () => [
    N('pronoia_grants', 'Pronoia System', '🏇', 20, 3, 'Land grants for military service.', ['restoration'], [{ mods: { manpowerMult: 0.15, cavAtk: 0.05 } }]),
    N('komnenian_army', 'Komnenian Army', '⚔', 21, 3, 'Reformed tagmata and heavy cataphracts.', ['restoration'], [{ mods: { discipline: 0.08 } }, { mods: { cavAtk: 0.1 } }]),
    N('greek_fire', 'Greek Fire', '🔥', 22, 3, 'The secret weapon of the imperial navy.', ['restoration'], [{ mods: { seaSpeed: 0.2, siege: 0.1 } }]),
    N('bazaar_golden_horn', 'Golden Horn Trade', '💰', 20, 4, 'The Basileus taxes the world\'s greatest market.', ['pronoia_grants'], [{ mods: { tradeMult: 0.25 } }, { build: { type: 'port', where: 'Constantinople', n: 1 } }]),
    N('autocrat', 'Basileus Autokrator', '👑', 21, 4, 'Absolute emperor, equal of the Apostles.', ['komnenian_army', 'pronoia_grants'], [{ legitimacy: 20 }, { loyalty: { nobles: -10 } }], ['senate_return']),
    N('senate_return', 'Council of the Archontes', '🏛', 22, 4, 'Share power with the great families.', ['komnenian_army', 'greek_fire'], [{ loyalty: { nobles: 20 } }, { stability: 1 }], ['autocrat']),
    N('hesychasm', 'Mount Athos Monasteries', '☦', 20, 5, 'Hesychast monks spread the light.', ['bazaar_golden_horn'], [{ loyalty: { clergy: 15 } }, { mods: { legitimacyMonthly: 0.04 } }]),
    N('reconquest_italy', 'Reconquer Italy', '🗺', 21, 5, 'Justinian\'s dream.', ['autocrat', 'senate_return'], [{ claims: { tag: 'SIC' } }, { claims: { tag: 'VEN' } }]),
    N('palaiologan', 'Palaiologan Renaissance', '🎭', 22, 5, 'Philosophy, icons and mosaics flourish.', ['senate_return'], [{ prestige: 40 }, { mods: { focusSpeed: 0.1 } }]),
    N('second_rome', 'Rome Eternal', '🦅', 21, 6, 'The City is the centre of the world.', ['reconquest_italy', 'palaiologan', 'hesychasm'], [{ prestige: 60 }, { mods: { taxMult: 0.1, legitimacyMonthly: 0.06 } }]),
  ],
};
