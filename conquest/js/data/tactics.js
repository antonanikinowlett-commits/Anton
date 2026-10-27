// Battle tactics drawn from real engagements. Generals pick one per phase; the one with
// the better tactics roll chooses second, knowing the enemy's choice, and may counter it.
// ctx: { side, enemy, share(cls|type), terrain, season, defender, general, enemyGeneral, width, reserves, river }
// mods (fractions): ranged, atk, def, charge, flank, morale (dealt), moraleTaken, enemyRanged, enemyCharge, casualtiesTaken
export const PHASES = ['opening', 'engage', 'melee', 'pursuit'];
export const PHASE_NAMES = { opening: 'Skirmish', engage: 'Charge & Clash', melee: 'Melee', pursuit: 'Rout & Pursuit' };

export const TACTICS = {
  // ── opening
  arrow_storm: { phase: 'opening', name: 'Arrow Storm', hist: 'Crécy, 1346', desc: 'Massed archers on a slope loose volley after volley before the enemy can close.',
    req: (c) => c.share('rng') >= 0.22, w: (c) => 2 + c.share('rng') * 8 + (c.terrain === 'hills' ? 2 : 0),
    mods: { ranged: 0.6, morale: 0.15 }, counters: ['pavise_wall', 'rapid_advance'] },
  horse_archer_harass: { phase: 'opening', name: 'Parthian Harassment', hist: 'Manzikert, 1071', desc: 'Horse archers circle and shoot, never letting the enemy come to grips.',
    req: (c) => c.share('horse_archers') + c.share('mamluks') * 0.5 >= 0.15, w: (c) => 3 + c.share('horse_archers') * 10 + (['steppe', 'desert', 'plains'].includes(c.terrain) ? 3 : -2),
    mods: { ranged: 0.55, morale: 0.2, moraleTaken: -0.1 }, counters: ['cavalry_screen', 'rapid_advance'] },
  skirmish_screen: { phase: 'opening', name: 'Skirmisher Screen', hist: 'Byzantine Strategikon', desc: 'Light troops harass and hide the main line from enemy missiles.',
    req: () => true, w: () => 1.5, mods: { ranged: 0.15, enemyRanged: -0.15 }, counters: [] },
  pavise_wall: { phase: 'opening', name: 'Pavise Wall', hist: 'Genoese crossbow tactics', desc: 'Large standing shields shelter the line from arrows.',
    req: (c) => c.share('crossbowmen') >= 0.1 || c.share('inf') >= 0.55, w: (c) => 1 + c.enemy.share('rng') * 9, mods: { enemyRanged: -0.45 }, counters: [] },
  rapid_advance: { phase: 'opening', name: 'Rapid Advance', hist: 'Hastings: the Norman approach', desc: 'Close the distance at the run to deny the enemy his volleys.',
    req: (c) => c.share('inf') + c.share('cav') >= 0.6, w: (c) => 1 + c.enemy.share('rng') * 6 + (c.general.trait('aggressive') ? 2 : 0),
    mods: { enemyRanged: -0.4, def: -0.1 }, counters: ['stakes_and_caltrops'] },
  stakes_and_caltrops: { phase: 'opening', name: 'Stakes & Caltrops', hist: 'Agincourt, 1415', desc: 'Sharpened stakes planted before the line. Charges die on the points.',
    req: (c) => c.defender && c.share('inf') + c.share('rng') >= 0.5, w: (c) => 1 + c.enemy.share('cav') * 8, mods: { enemyCharge: -0.6, def: 0.15 }, counters: [] },
  cavalry_screen: { phase: 'opening', name: 'Cavalry Screen', hist: 'Arsuf, 1191', desc: 'Light horse ride out to drive off enemy skirmishers.',
    req: (c) => c.share('light_cav') + c.share('horse_archers') >= 0.1, w: (c) => 1 + c.enemy.share('horse_archers') * 10, mods: { enemyRanged: -0.35 }, counters: [] },
  ambush: { phase: 'opening', name: 'Ambush', hist: 'Roncevaux Pass, 778', desc: 'The enemy column is struck from cover before it can deploy.',
    req: (c) => c.defender && ['forest', 'taiga', 'hills', 'mountains', 'marsh'].includes(c.terrain), w: (c) => 2 + (c.general.trait('ambusher') ? 8 : 0) + c.general.tactics * 0.4,
    mods: { atk: 0.3, morale: 0.35 }, counters: ['scouting'] },
  scouting: { phase: 'opening', name: 'Forward Scouting', hist: 'Mongol scout screens', desc: 'Outriders find every hidden company before battle is joined.',
    req: (c) => c.share('light_cav') + c.share('horse_archers') >= 0.08, w: (c) => 1 + (['forest', 'hills', 'mountains', 'taiga', 'marsh'].includes(c.terrain) ? 3 : 0), mods: { atk: 0.05, def: 0.05 }, counters: [] },
  // ── engage
  couched_lance: { phase: 'engage', name: 'Couched-Lance Charge', hist: 'Dorylaeum, 1097', desc: 'Knights knee to knee, lances couched: the most feared shock in Christendom.',
    req: (c) => c.share('knights') + c.share('templars') + c.share('mamluks') >= 0.12, w: (c) => 3 + (c.share('knights') + c.share('templars')) * 12 + (c.general.trait('cavalry_commander') ? 4 : 0) - (c.terrain === 'forest' || c.terrain === 'marsh' ? 4 : 0),
    mods: { charge: 1.0, morale: 0.4 }, counters: ['shield_wall', 'schiltron', 'feigned_retreat'] },
  shield_wall: { phase: 'engage', name: 'Shield Wall', hist: 'Hastings, 1066', desc: 'Interlocked shields on a ridge. Nearly unbreakable while it holds formation.',
    req: (c) => c.share('inf') >= 0.45, w: (c) => 2 + c.enemy.share('cav') * 6 + (c.defender ? 2 : 0), mods: { def: 0.3, enemyCharge: -0.55, atk: -0.1 }, counters: ['feigned_retreat'] },
  schiltron: { phase: 'engage', name: 'Schiltron', hist: 'Bannockburn, 1314', desc: 'Pike hedgehogs that impale charging horse.',
    req: (c) => c.share('pikemen') >= 0.2, w: (c) => 3 + c.enemy.share('cav') * 12 + c.share('pikemen') * 4, mods: { def: 0.35, enemyCharge: -0.8 }, counters: ['arrow_storm_follow'] },
  feigned_retreat: { phase: 'engage', name: 'Feigned Retreat', hist: 'Hastings, 1066; Kalka, 1223', desc: 'Pretend to flee, draw the enemy out of formation, then turn and cut him down.',
    req: (c) => c.share('cav') >= 0.25, w: (c) => 2 + c.share('cav') * 6 + c.general.tactics * 0.5 + (c.share('horse_archers') > 0.1 ? 3 : 0), mods: { atk: 0.25, morale: 0.25 }, enemyMods: { def: -0.3 }, counters: ['hold_the_line'] },
  hold_the_line: { phase: 'engage', name: 'Hold the Line', hist: 'Arsuf, 1191', desc: 'Iron discipline: no man breaks ranks to pursue, whatever the provocation.',
    req: () => true, w: (c) => 1 + (c.general.trait('defensive_expert') ? 3 : 0) + c.enemy.share('cav') * 3, mods: { def: 0.12 }, counters: [] },
  wedge: { phase: 'engage', name: 'Boar\'s-Head Wedge', hist: 'Lake Peipus, 1242', desc: 'A wedge of armoured men drives into the enemy centre to split it.',
    req: (c) => c.share('knights') + c.share('men_at_arms') + c.share('templars') + c.share('varangians') >= 0.3, w: (c) => 2 + c.general.trait('aggressive') * 3, mods: { atk: 0.3, morale: 0.15 }, counters: ['double_envelopment'] },
  mass_charge: { phase: 'engage', name: 'Headlong Rush', hist: 'Celtic & Baltic war bands', desc: 'The whole host hurls itself forward, screaming, before the enemy can brace.',
    req: (c) => c.share('inf') >= 0.5, w: (c) => 1 + (c.gov === 'tribal' ? 4 : 0) + (c.general.trait('brave') ? 2 : 0), mods: { atk: 0.35, charge: 0.4, def: -0.2 }, counters: ['shield_wall', 'schiltron'] },
  // ── melee
  double_envelopment: { phase: 'melee', name: 'Double Envelopment', hist: 'Cannae, 216 BC', desc: 'Let the centre bend while both wings wrap around: the perfect battle of annihilation.',
    req: (c) => c.width > c.enemy.width * 1.15 || c.share('cav') >= 0.3, w: (c) => 2 + c.general.tactics * 0.6 + (c.width > c.enemy.width ? 3 : 0), mods: { flank: 0.6, morale: 0.3 }, counters: ['reserve_line'] },
  hammer_and_anvil: { phase: 'melee', name: 'Hammer & Anvil', hist: 'Arsuf, 1191', desc: 'Infantry pins the enemy; cavalry smashes into his flank or rear.',
    req: (c) => c.share('inf') >= 0.35 && c.share('cav') >= 0.15, w: (c) => 3 + c.share('cav') * 6, mods: { flank: 0.8, atk: 0.1 }, counters: ['reserve_line', 'refused_flank'] },
  refused_flank: { phase: 'melee', name: 'Refused Flank', hist: 'Oblique order, Leuctra', desc: 'Weight one wing heavily, hold the other back out of reach.',
    req: (c) => c.share('inf') >= 0.3, w: (c) => 1 + c.general.tactics * 0.4, mods: { flank: 0.3, def: 0.1 }, counters: [] },
  reserve_line: { phase: 'melee', name: 'Reserve Line', hist: 'Roman triplex acies', desc: 'A fresh line waits behind the first to plug every breach and guard the flanks.',
    req: (c) => c.reserves > 0, w: (c) => 1.5 + c.reserves * 0.3 + (c.general.trait('defensive_expert') ? 2 : 0), mods: { moraleTaken: -0.2, def: 0.1 }, counters: [] },
  press_attack: { phase: 'melee', name: 'Press the Attack', hist: 'Las Navas de Tolosa, 1212', desc: 'Commit everything. Fortune favours the bold.',
    req: () => true, w: (c) => 1.5 + (c.general.trait('aggressive') ? 3 : 0) + (c.general.trait('brave') ? 1 : 0), mods: { atk: 0.2, def: -0.08 }, counters: [] },
  rally_banner: { phase: 'melee', name: 'Rally to the Banner', hist: 'The Oriflamme & the Carroccio', desc: 'The holy standard is raised in the thick of the fight and the line stiffens.',
    req: () => true, w: (c) => 1 + (c.general.trait('zealous') || c.general.trait('chivalrous') ? 3 : 0), mods: { moraleTaken: -0.3 }, counters: [] },
  fighting_withdrawal: { phase: 'melee', name: 'Fighting Withdrawal', hist: 'Fabius Cunctator', desc: 'Give ground in good order, trading space for lives.',
    req: () => true, w: (c) => (c.losing ? 4 : 0.2) + (c.general.trait('craven') ? 3 : 0), mods: { casualtiesTaken: -0.3, atk: -0.2 }, counters: [] },
  thirst_and_fire: { phase: 'melee', name: 'Thirst & Fire', hist: 'Hattin, 1187', desc: 'Cut the enemy from water, set the scrub alight and wait for him to break.',
    req: (c) => ['desert', 'steppe'].includes(c.terrain) && c.season === 'summer' && c.share('cav') >= 0.2, w: () => 6, mods: { morale: 0.45 }, counters: [] },
  // ── pursuit
  cavalry_pursuit: { phase: 'pursuit', name: 'Ride Them Down', hist: 'Mohi, 1241', desc: 'Horsemen run down the fleeing enemy.', req: (c) => c.share('cav') > 0.05, w: () => 3, mods: { pursuit: 0.6 }, counters: [] },
  orderly_retreat: { phase: 'pursuit', name: 'Rearguard', hist: 'Roncevaux, 778', desc: 'A rearguard sacrifices itself so the host can escape.', req: () => true, w: () => 1, mods: { casualtiesTaken: -0.35 }, counters: [] },
};
// Falkirk (1298): archers broke the schiltrons. A follow-up volley counters pike hedgehogs.
TACTICS.arrow_storm_follow = { phase: 'engage', name: 'Volley into the Pikes', hist: 'Falkirk, 1298', desc: 'Archers shoot gaps into static pike blocks before the horse goes in.',
  req: (c) => c.share('rng') >= 0.2 && c.enemy.share('pikemen') >= 0.15, w: (c) => 2 + c.enemy.share('pikemen') * 15, mods: { ranged: 0.5, morale: 0.15 }, counters: [] };

// Army doctrines: player-selectable stance that biases tactic choice and battle behaviour.
export const DOCTRINES = {
  balanced: { name: 'Balanced', desc: 'Let the general read the field.', bias: {} },
  shock: { name: 'Shock Assault', desc: 'Favour charges, wedges and pressing the attack. Higher casualties on both sides.', bias: { couched_lance: 4, wedge: 4, press_attack: 4, mass_charge: 3, rapid_advance: 3 } },
  defensive: { name: 'Defensive', desc: 'Hold ground, brace for cavalry, keep reserves. +15% defence when defending.', bias: { shield_wall: 4, schiltron: 4, hold_the_line: 4, reserve_line: 4, stakes_and_caltrops: 4, pavise_wall: 2 } },
  missile: { name: 'Missile Doctrine', desc: 'Win the battle before it is joined with volleys.', bias: { arrow_storm: 5, horse_archer_harass: 5, arrow_storm_follow: 4, skirmish_screen: 2, pavise_wall: 2 } },
  maneuver: { name: 'Maneuver', desc: 'Outflank, envelop and deceive.', bias: { feigned_retreat: 5, double_envelopment: 5, hammer_and_anvil: 4, refused_flank: 3, ambush: 4 } },
};
