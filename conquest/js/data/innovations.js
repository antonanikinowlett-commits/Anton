// Innovations: the medieval "tech tree", v2.
// 4 branches x 3 eras. Era 0 is cheap and free of conflict. Eras 1 and 2 are built from FORKS: pairs (or triples)
// of innovations that exclude each other (`excl`), so a realm's history is a set of choices, not a checklist.
// Nearly every entry has a price as well as a gain (negative mods).
// Fields: id, name, icon, branch, era, year (historical date; learning it early costs more), pre (ids),
//   cost (research points; each entry has its own), mods (n.mods keys), desc,
//   excl (ids that can no longer be learned once this one is known),
//   unlock (unit key), bld (building key it unlocks), law (law key it unlocks), note (extra rule text).
// Everything that matters in play is in `mods`/`unlock`/`bld`/`law`, so UIs can render it with innovEffects().
export const BRANCHES = {
  military: { name: 'Military', icon: '⚔', blurb: 'Weapons, drill and fortification.' },
  civic: { name: 'Civic', icon: '📜', blurb: 'Law, learning and finance.' },
  agri: { name: 'Agriculture', icon: '🌾', blurb: 'Fields, mills and the peasant.' },
  sea: { name: 'Maritime', icon: '⚓', blurb: 'Ships, ports and commerce.' },
};
export const ERAS = [
  { name: 'Early High Medieval', from: 1200, gate: 0 },
  { name: 'High Medieval', from: 1250, gate: 2 }, // innovations of the previous era needed in the same branch
  { name: 'Late Medieval', from: 1300, gate: 3 },
];

// How each modifier is shown: label, kind ('pct' = ×100 %, 'flat' = number, 'month' = ×10 per month), whether higher is better.
export const MOD_INFO = {
  taxMult: ['Tax income', 'pct', 1], tradeMult: ['Trade income', 'pct', 1], foodMult: ['Food output', 'pct', 1], ironMult: ['Iron output', 'pct', 1], horsesMult: ['Horse output', 'pct', 1],
  devGrowth: ['Development growth', 'pct', 1], manpowerMult: ['Manpower', 'pct', 1], manpowerRegen: ['Manpower recovery', 'pct', 1],
  buildCost: ['Building cost', 'pct', -1], buildSpeed: ['Construction speed', 'pct', 1], devCost: ['Development cost', 'pct', -1],
  recruitCost: ['Recruitment cost', 'pct', -1], cavCost: ['Cavalry cost', 'pct', -1], upkeepMult: ['Army upkeep', 'pct', -1], trainSpeed: ['Training speed', 'pct', 1],
  discipline: ['Discipline', 'pct', 1], armyMorale: ['Army morale', 'pct', 1], moraleRecovery: ['Morale recovery', 'pct', 1], xpGain: ['Veterancy gain', 'pct', 1],
  cavAtk: ['Cavalry attack', 'pct', 1], infAtk: ['Infantry attack', 'pct', 1], infDef: ['Infantry defence', 'pct', 1], rangedAtk: ['Missile attack', 'pct', 1],
  fortDefense: ['Fort defence', 'pct', 1], siege: ['Siege power', 'pct', 1], defenseHome: ['Defence at home', 'pct', 1], supply: ['Supply range', 'pct', 1], seaSpeed: ['Sea speed', 'pct', 1],
  lootMult: ['Plunder', 'pct', 1], generalTactics: ['General tactics', 'flat', 1],
  researchSpeed: ['Research speed', 'pct', 1], focusSpeed: ['Focus speed', 'pct', 1], claimSpeed: ['Claim fabrication speed', 'pct', 1], aeDecay: ['Aggressive expansion decay', 'pct', 1],
  legitimacyMonthly: ['Legitimacy per month', 'month', 1], stabilityMonthly: ['Stability per month', 'month', 1], prestigeMonthly: ['Prestige per month', 'month', 1],
  unrest: ['Unrest', 'flat', -1], unrestInfidel: ['Unrest from other faiths', 'flat', -1], diplo: ['Diplomatic reputation', 'flat', 1], decree: ['Royal decrees', 'flat', 1], crownBonus: ['Crown power', 'flat', 1],
  nobleLoyalty: ['Noble loyalty', 'flat', 1], clergyLoyalty: ['Clergy loyalty', 'flat', 1], burgherLoyalty: ['Burgher loyalty', 'flat', 1], peasantLoyalty: ['Peasant loyalty', 'flat', 1],
  papalOpinion: ['Papal opinion', 'flat', 1], rulerSkill: ['Ruler skill', 'flat', 1],
};
// [{ text, good }] for a mods object, e.g. { text: 'Tax income +5%', good: true }
export function modLines(mods) {
  const out = [];
  for (const [k, v] of Object.entries(mods || {})) {
    const [name, kind, dir] = MOD_INFO[k] || [k, 'flat', 1];
    const val = kind === 'pct' ? `${v > 0 ? '+' : ''}${Math.round(v * 100)}%` : kind === 'month' ? `${v > 0 ? '+' : ''}${+(v * 10).toFixed(2)}` : `${v > 0 ? '+' : ''}${+v.toFixed(2)}`;
    out.push({ text: `${name} ${val}`, good: v * dir > 0, key: k, value: v });
  }
  return out;
}

const I = (id, name, icon, branch, era, year, cost, pre, mods, desc, extra = {}) => ({ id, name, icon, branch, era, year, cost, pre, mods, desc, excl: [], ...extra });
export const INNOVATIONS = [
  // ── MILITARY ───────────────────────────────────────────────────────────────
  I('couched_lance', 'Couched Lance', '♞', 'military', 0, 1190, 190, [], { cavAtk: 0.08, cavCost: 0.1 }, 'Knights lock the lance under the arm for a shattering charge. The destriers are dearer.', { excl: ['mail_hauberk'] }),
  I('mail_hauberk', 'Chain Mail Hauberks', '🛡', 'military', 0, 1190, 170, [], { infDef: 0.08, upkeepMult: 0.04 }, 'Mail for every man-at-arms, not just the rich. Smiths are never cheap.', { excl: ['couched_lance'] }),
  I('crossbow_guilds', 'Crossbow Companies', '➶', 'military', 0, 1200, 180, [], { rangedAtk: 0.08, recruitCost: 0.03 }, 'Professional crossbowmen under contract.'),
  I('castle_concentric', 'Concentric Castles', '🏰', 'military', 0, 1200, 220, [], { fortDefense: 0.15, buildCost: 0.04 }, 'Ring within ring of walls, as at Krak des Chevaliers. Unlocks Town Walls.', { bld: 'townwalls', excl: ['trebuchet_counter'] }),
  I('trebuchet_counter', 'Counterweight Trebuchet', '⚙', 'military', 0, 1200, 210, [], { siege: 0.3, supply: -0.03 }, 'Heavier stones, longer range, a baggage train to match. Unlocks Trebuchets.', { unlock: 'trebuchet', excl: ['castle_concentric'] }),
  // era 1 forks
  I('longbow_mass', 'Massed Longbow', '🎯', 'military', 1, 1270, 430, ['crossbow_guilds'], { rangedAtk: 0.14, infDef: -0.03 }, 'Disciplined archery in volleys. English and Welsh archers gain the longbow unit.', { unlock: 'longbowmen', excl: ['pavise'] }),
  I('pavise', 'Pavise Shields', '🛡', 'military', 1, 1250, 380, ['crossbow_guilds'], { rangedAtk: 0.05, infDef: 0.06, fortDefense: 0.05 }, 'Large shields to shelter crossbowmen behind a wall of wood: slower to kill, slower to win.', { excl: ['longbow_mass'] }),
  I('plate_cuirass', 'Plate Cuirass', '🛡', 'military', 1, 1290, 470, ['mail_hauberk'], { cavAtk: 0.06, infDef: 0.07, upkeepMult: 0.06 }, 'Plates over mail for those who can afford them.', { excl: ['pike_schiltron'] }),
  I('pike_schiltron', 'Schiltron Drill', '🔱', 'military', 1, 1280, 400, ['mail_hauberk'], { infDef: 0.1, upkeepMult: -0.04, cavAtk: -0.03 }, 'Dense spear hedgehogs repel cavalry and cost nothing to feed.', { excl: ['plate_cuirass'] }),
  I('standing_retinue', 'Paid Retinues', '💰', 'military', 1, 1270, 460, ['castle_concentric'], { discipline: 0.04, trainSpeed: 0.15, upkeepMult: 0.08, manpowerMult: -0.06 }, 'Indentured captains and wages instead of feudal service: better soldiers, fewer of them, all of them paid.', { excl: ['arriere_ban'] }),
  I('arriere_ban', 'Arrière-Ban', '📯', 'military', 1, 1260, 380, [], { manpowerMult: 0.12, discipline: -0.03, upkeepMult: -0.05, manpowerRegen: 0.1 }, 'The general summons of every able man: vast, cheap, ill-drilled hosts.', { excl: ['standing_retinue'] }),
  I('sapper_corps', 'Sapper Corps', '⛏', 'military', 1, 1280, 350, ['trebuchet_counter'], { siege: 0.25, supply: 0.05 }, 'Miners and engineers follow the army. Unlocks the Siege Workshop.', { bld: 'siegeworks' }),
  // era 2 forks
  I('full_plate', 'Full Plate Harness', '♞', 'military', 2, 1350, 760, ['plate_cuirass'], { cavAtk: 0.1, infDef: 0.08, upkeepMult: 0.08, cavCost: 0.1 }, 'Articulated steel from head to toe, at the price of a manor.', { excl: ['halberd_drill'] }),
  I('halberd_drill', 'Halberd Drill', '🪓', 'military', 2, 1380, 700, ['pike_schiltron'], { infAtk: 0.12, infDef: 0.04, cavCost: 0.05 }, 'Swiss-style polearm blocks that can attack as well as hold.', { excl: ['full_plate'] }),
  I('bombard', 'Bombards', '💥', 'military', 2, 1340, 800, ['sapper_corps'], { siege: 0.6, upkeepMult: 0.05, fortDefense: -0.05 }, 'Gunpowder arrives at the siege: walls fall faster, treasuries empty faster.', { excl: ['star_forts'] }),
  I('star_forts', 'Bastioned Walls', '🏯', 'military', 2, 1400, 820, ['castle_concentric'], { fortDefense: 0.25, buildCost: 0.06, siege: -0.05 }, 'Low thick walls laughing at cannon. Expensive to raise.', { excl: ['bombard'] }),
  I('mercenary_cond', 'Condottieri', '⚔', 'military', 2, 1330, 700, ['standing_retinue'], { discipline: 0.05, armyMorale: 0.05, recruitCost: -0.15, upkeepMult: 0.1 }, 'Free companies selling their swords: raise armies in a week, pay for them forever.', { excl: ['town_militias'] }),
  I('town_militias', 'Town Militias', '🔔', 'military', 2, 1320, 640, [], { manpowerMult: 0.12, defenseHome: 0.08, armyMorale: 0.03, discipline: -0.02 }, 'Every burgher drills on Sunday and answers the bell.', { excl: ['mercenary_cond'] }),
  I('veteran_cadres', 'Veteran Cadres', '🎖', 'military', 2, 1360, 620, [], { xpGain: 0.6, moraleRecovery: 0.2, generalTactics: 1 }, 'Old soldiers train the new: regiments gain veteran experience far faster.'),
  // ── CIVIC ──────────────────────────────────────────────────────────────────
  I('cathedral_schools', 'Cathedral Schools', '📚', 'civic', 0, 1190, 160, [], { researchSpeed: 0.08, clergyLoyalty: 3 }, 'Clergy teach the trivium and quadrivium.'),
  I('charters', 'Town Charters', '📜', 'civic', 0, 1190, 190, [], { taxMult: 0.05, nobleLoyalty: -3, burgherLoyalty: 4 }, 'Self-governing boroughs pay fixed dues, to the barons\' annoyance.', { excl: ['canon_law'] }),
  I('guild_system', 'Craft Guilds', '🔨', 'civic', 0, 1200, 200, [], { tradeMult: 0.06, buildSpeed: 0.08, devCost: 0.05 }, 'Masters, journeymen and apprentices. Unlocks Guild Halls.', { bld: 'guildhall', excl: ['royal_chancery'] }),
  I('canon_law', 'Canon Law', '✝', 'civic', 0, 1190, 170, [], { legitimacyMonthly: 0.02, clergyLoyalty: 4, papalOpinion: 10 }, 'Gratian\'s Decretum orders the Church courts.', { excl: ['charters'] }),
  I('royal_chancery', 'Royal Chancery', '🖋', 'civic', 0, 1200, 220, [], { diplo: 1, claimSpeed: 0.15, aeDecay: 0.1, upkeepMult: 0.02 }, 'Written writs and records: a diplomatic service of clerks.', { excl: ['guild_system'] }),
  // era 1
  I('universities', 'Universities', '🎓', 'civic', 1, 1250, 460, ['cathedral_schools'], { researchSpeed: 0.15, clergyLoyalty: -3 }, 'Bologna, Paris and Oxford. Unlocks the University building.', { bld: 'university', excl: ['scholasticism'] }),
  I('scholasticism', 'Scholastic Orthodoxy', '🕯', 'civic', 1, 1260, 400, ['canon_law'], { clergyLoyalty: 6, legitimacyMonthly: 0.03, unrest: -0.5, researchSpeed: 0.03 }, 'Aquinas reconciles reason and faith: the learned serve the Church.', { excl: ['universities'] }),
  I('roman_law_rev', 'Revival of Roman Law', '⚖', 'civic', 1, 1250, 480, ['canon_law'], { taxMult: 0.04, nobleLoyalty: -6, unrest: -0.4 }, 'Justinian\'s code rediscovered: the prince is not bound by custom. Unlocks Roman Law.', { law: 'roman_law', unlock: 'roman_law', excl: ['parliaments'] }),
  I('parliaments', 'Estates General', '🏛', 'civic', 1, 1265, 440, ['charters'], { stabilityMonthly: 0.01, nobleLoyalty: 4, burgherLoyalty: 5, taxMult: 0.03, decree: -1 }, 'Consent to taxation in return for a voice: the realm is governed with, not over, its estates.', { excl: ['roman_law_rev'] }),
  I('double_entry', 'Double-Entry Bookkeeping', '🧮', 'civic', 1, 1290, 520, ['guild_system'], { taxMult: 0.07, tradeMult: 0.05, devCost: 0.04 }, 'Italian merchants master the ledger.', { excl: ['mendicant_orders'] }),
  I('mendicant_orders', 'Mendicant Preaching', '🕯', 'civic', 1, 1260, 400, ['canon_law'], { peasantLoyalty: 6, unrest: -0.8, taxMult: 0.02, clergyLoyalty: 3 }, 'Friars among the towns and villages keep the poor content.', { excl: ['double_entry'] }),
  I('written_records', 'Written Records', '📖', 'civic', 1, 1280, 360, ['royal_chancery'], { buildCost: -0.06, claimSpeed: 0.1, aeDecay: 0.05 }, 'Cadastres, rolls and registers: the state knows what it owns.'),
  // era 2
  I('banking_houses', 'Banking Houses', '🏦', 'civic', 2, 1340, 800, ['double_entry'], { taxMult: 0.08, tradeMult: 0.08, clergyLoyalty: -4 }, 'Bardi and Peruzzi finance kings. The Church frowns on usury.', { excl: ['royal_exchequer'] }),
  I('royal_exchequer', 'Royal Exchequer', '👑', 'civic', 2, 1330, 720, ['written_records'], { taxMult: 0.1, nobleLoyalty: -6, burgherLoyalty: -3 }, 'Every shilling accounted for at Westminster: sharp, unloved royal fiscality.', { excl: ['banking_houses'] }),
  I('humanism', 'Early Humanism', '🎨', 'civic', 2, 1350, 760, [], { prestigeMonthly: 0.01, focusSpeed: 0.08, researchSpeed: 0.06, clergyLoyalty: -3 }, 'Petrarch rediscovers the classics; the court becomes brilliant and a little worldly.', { excl: ['vernacular_law'] }),
  I('vernacular_law', 'Vernacular Records', '📖', 'civic', 2, 1320, 680, [], { stabilityMonthly: 0.01, unrest: -1, diplo: 1 }, 'Law and letters in the native tongue: the realm understands itself.', { excl: ['humanism'] }),
  I('standing_courts', 'Royal Courts of Justice', '⚖', 'civic', 2, 1320, 680, [], { unrest: -1, legitimacyMonthly: 0.02, upkeepMult: 0.02 }, 'Permanent benches replace roving justice.', { excl: ['inquisition'] }),
  I('inquisition', 'Inquisitorial Courts', '🔥', 'civic', 2, 1330, 620, ['canon_law'], { unrest: -1.5, unrestInfidel: -2, clergyLoyalty: 6, burgherLoyalty: -4, diplo: -1 }, 'Heresy is a crime: conformity is bought with fear.', { excl: ['standing_courts'] }),
  I('printing_prelude', 'Paper & Scriptoria', '📜', 'civic', 2, 1350, 600, ['written_records'], { researchSpeed: 0.1, buildCost: -0.04 }, 'Cheap rag paper spreads learning.'),
  // ── AGRICULTURE ────────────────────────────────────────────────────────────
  I('heavy_plough', 'Heavy Plough', '🌾', 'agri', 0, 1190, 170, [], { foodMult: 0.08, devGrowth: 0.08, horsesMult: -0.04 }, 'Wheeled mouldboard ploughs turn northern clays; the ox team eats the horses\' share.', { excl: ['horse_collar'] }),
  I('horse_collar', 'Horse Collar', '🐴', 'agri', 0, 1190, 160, [], { foodMult: 0.04, horsesMult: 0.12 }, 'Horses pull harder than oxen.', { excl: ['heavy_plough'] }),
  I('watermill', 'Watermills', '💧', 'agri', 0, 1190, 190, [], { taxMult: 0.03, foodMult: 0.04, buildCost: 0.02 }, 'Every stream grinds corn.', { excl: ['assarting'] }),
  I('assarting', 'Assarting', '🌳', 'agri', 0, 1200, 180, [], { devGrowth: 0.12, unrest: 0.2 }, 'Clearing forest and fen: new land, new quarrels.', { excl: ['watermill'] }),
  I('monastic_farms', 'Monastic Granges', '⛪', 'agri', 0, 1200, 170, [], { foodMult: 0.05, clergyLoyalty: 4, nobleLoyalty: -2 }, 'Cistercian estate management.'),
  // era 1
  I('three_field', 'Three-Field Rotation', '🌱', 'agri', 1, 1250, 420, ['heavy_plough'], { foodMult: 0.12, devGrowth: 0.05 }, 'Wheat, oats, fallow: the land never rests idle.', { excl: ['sheep_farming'] }),
  I('sheep_farming', 'Wool Staple', '🐑', 'agri', 1, 1270, 400, ['monastic_farms'], { tradeMult: 0.1, taxMult: 0.03, foodMult: -0.04 }, 'English wool feeds Flemish looms; sheep eat men, said More.', { excl: ['three_field'] }),
  I('windmill', 'Windmills', '🌬', 'agri', 1, 1250, 380, ['watermill'], { taxMult: 0.05, foodMult: 0.04 }, 'Mills where there is no river.', { excl: ['drainage'] }),
  I('drainage', 'Polders & Drainage', '🌊', 'agri', 1, 1260, 440, ['assarting'], { devGrowth: 0.16, devCost: -0.08 }, 'Dutch dyke-builders win land from the sea.', { excl: ['windmill'] }),
  I('manumission_chrt', 'Manumission Charters', '🗝', 'agri', 1, 1270, 430, [], { peasantLoyalty: 8, taxMult: 0.03, devGrowth: 0.08, nobleLoyalty: -6 }, 'Villeins buy their freedom: the barons lose, the realm gains.', { excl: ['seigneurial_reaction'] }),
  I('seigneurial_reaction', 'Seigneurial Reaction', '⛓', 'agri', 1, 1290, 400, [], { nobleLoyalty: 8, manpowerMult: 0.08, peasantLoyalty: -8, unrest: 0.5 }, 'The lords bind the peasants harder: more levies, more resentment.', { excl: ['manumission_chrt'] }),
  I('manorial_surplus', 'Market Gardening', '🥕', 'agri', 1, 1280, 360, ['heavy_plough'], { tradeMult: 0.04, foodMult: 0.05 }, 'Surplus sold in town.'),
  // era 2
  I('crop_selection', 'Selective Seed', '🌾', 'agri', 2, 1330, 700, [], { foodMult: 0.1, devGrowth: 0.05 }, 'Better strains, bigger yields.', { excl: ['enclosure'] }),
  I('enclosure', 'Enclosure of Commons', '🧱', 'agri', 2, 1350, 680, [], { taxMult: 0.08, unrest: 0.6, peasantLoyalty: -6, foodMult: -0.03 }, 'Efficient but hated.', { excl: ['crop_selection'] }),
  I('viticulture', 'Vineyard Terraces', '🍇', 'agri', 2, 1320, 620, [], { tradeMult: 0.08, foodMult: -0.02 }, 'Wine for export.', { excl: ['famine_relief'] }),
  I('famine_relief', 'Granary Reserves', '🏚', 'agri', 2, 1330, 640, [], { stabilityMonthly: 0.01, foodMult: 0.06, upkeepMult: 0.01 }, 'Stored grain against bad harvests.', { excl: ['viticulture'] }),
  I('post_mill', 'Tower Mills', '🏗', 'agri', 2, 1340, 600, [], { taxMult: 0.05, devGrowth: 0.05 }, 'Rotating caps catch every wind.'),
  // ── MARITIME ───────────────────────────────────────────────────────────────
  I('clinker_ship', 'Clinker Ships', '⛵', 'sea', 0, 1190, 150, [], { seaSpeed: 0.08 }, 'Overlapping planks.', { excl: ['galley_fleets'] }),
  I('harbour_works', 'Harbour Works', '⚓', 'sea', 0, 1200, 190, [], { tradeMult: 0.05, buildCost: 0.02 }, 'Moles and quays. Unlocks Shipyards.', { bld: 'shipyard', excl: ['merchant_law'] }),
  I('portolan', 'Portolan Charts', '🗺', 'sea', 0, 1270, 200, [], { seaSpeed: 0.06, supply: 0.03 }, 'Coastal pilots draw rhumb lines.'),
  I('merchant_law', 'Law Merchant', '⚖', 'sea', 0, 1200, 190, [], { tradeMult: 0.05, diplo: 1, nobleLoyalty: -2 }, 'Common commercial customs.', { excl: ['harbour_works'] }),
  I('galley_fleets', 'State Galleys', '🚣', 'sea', 0, 1200, 210, [], { seaSpeed: 0.05, supply: 0.05, upkeepMult: 0.02 }, 'Venetian arsenal methods.', { excl: ['clinker_ship'] }),
  // era 1
  I('cog', 'The Cog', '🛳', 'sea', 1, 1250, 420, ['clinker_ship'], { tradeMult: 0.09, seaSpeed: 0.04 }, 'Hanseatic bulk carriers.', { excl: ['naval_ordnance'] }),
  I('naval_ordnance', 'Shipborne Archers', '🏹', 'sea', 1, 1280, 400, ['galley_fleets'], { rangedAtk: 0.04, supply: 0.08, seaSpeed: 0.03 }, 'Castles on decks.', { excl: ['cog'] }),
  I('compass', 'Mariner\'s Compass', '🧭', 'sea', 1, 1270, 430, ['portolan'], { seaSpeed: 0.12, supply: 0.03 }, 'A needle on a pivot.', { excl: ['lighthouses'] }),
  I('lighthouses', 'Lighthouses & Pilots', '🗼', 'sea', 1, 1260, 380, ['harbour_works'], { tradeMult: 0.06, taxMult: 0.02 }, 'Safe approaches.', { excl: ['compass'] }),
  I('marine_insurance', 'Marine Insurance', '📑', 'sea', 1, 1290, 460, ['merchant_law'], { tradeMult: 0.08, taxMult: 0.03 }, 'Spreading the risk of loss at sea.', { excl: ['privateering'] }),
  I('privateering', 'Privateering Licences', '🏴', 'sea', 1, 1280, 380, [], { lootMult: 0.4, tradeMult: 0.02, diplo: -1 }, 'Letters of marque turn pirates into patriots.', { excl: ['marine_insurance'] }),
  I('fishing_fleets', 'Fishing Fleets', '🐟', 'sea', 1, 1260, 340, [], { foodMult: 0.05, manpowerMult: 0.03 }, 'Herring, cod and sailors by the thousand.'),
  // era 2
  I('carrack', 'Carrack', '🚢', 'sea', 2, 1340, 760, [], { tradeMult: 0.1, seaSpeed: 0.1, upkeepMult: 0.03 }, 'Large three-masted ships.', { excl: ['lateen_rig'] }),
  I('lateen_rig', 'Lateen Rig', '⛵', 'sea', 2, 1320, 620, [], { seaSpeed: 0.08, supply: 0.08 }, 'Sail close to the wind.', { excl: ['carrack'] }),
  I('hanse_league', 'Trade League Privileges', '🤝', 'sea', 2, 1330, 780, [], { tradeMult: 0.12, diplo: -1, nobleLoyalty: -2 }, 'Monopolies on the Baltic: rich, and disliked.', { excl: ['arsenal'] }),
  I('arsenal', 'Great Arsenals', '🏭', 'sea', 2, 1350, 740, [], { buildCost: -0.08, manpowerMult: 0.04, recruitCost: -0.05 }, 'Assembly-line shipbuilding.', { excl: ['hanse_league'] }),
  I('ocean_pilots', 'Atlantic Pilots', '🌍', 'sea', 2, 1380, 700, [], { tradeMult: 0.08, prestigeMonthly: 0.005 }, 'Pioneers beyond the Pillars of Hercules.'),
];
export const INNOV = Object.fromEntries(INNOVATIONS.map((i) => [i.id, i]));

// Every effect of an innovation as UI-ready lines: [{ text, good, kind }]
export function innovEffects(i) {
  const out = modLines(i.mods).map((l) => ({ ...l, kind: 'mod' }));
  if (i.unlock) out.push({ text: `Unlocks: ${i.unlock === 'roman_law' ? 'Roman Law' : i.unlock}`, good: true, kind: 'unlock' });
  if (i.bld) out.push({ text: `Unlocks building: ${i.bld}`, good: true, kind: 'building' });
  return out;
}
