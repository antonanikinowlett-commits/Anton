// Government forms, council offices, estates and the law code.
// Every law option declares which governments/faiths/cultures may adopt it and what it requires,
// so each realm's statute book is only ever offered choices that make sense for it.
export const GOVS = {
  feudal_monarchy: { name: 'Feudal Monarchy', ruler: 'King', rulerF: 'Queen', realm: 'Kingdom', desc: 'Power flows from the crown through oaths of fealty to great vassals who owe service in war.',
    estates: { nobles: 40, clergy: 25, burghers: 15, peasants: 20 } },
  elective_monarchy: { name: 'Elective Monarchy', ruler: 'Emperor', rulerF: 'Empress', realm: 'Empire', desc: 'Great princes elect the sovereign. Prestigious, but the electors must be courted.',
    estates: { nobles: 50, clergy: 25, burghers: 12, peasants: 13 } },
  imperial: { name: 'Imperial Autocracy', ruler: 'Basileus', rulerF: 'Basilissa', realm: 'Empire', desc: 'Roman autocracy: a salaried bureaucracy, themes and the emperor as God\'s regent on earth.',
    estates: { nobles: 35, clergy: 25, burghers: 25, peasants: 15 } },
  merchant_republic: { name: 'Merchant Republic', ruler: 'Doge', rulerF: 'Dogaressa', realm: 'Republic', desc: 'Patrician families rule through councils; trade and the fleet are the lifeblood of the state.',
    estates: { nobles: 30, clergy: 12, burghers: 45, peasants: 13 } },
  theocracy: { name: 'Theocracy', ruler: 'Pope', rulerF: 'Abbess', realm: 'Patrimony', desc: 'The Church governs directly. Legitimacy comes from God; armies from the faithful.',
    estates: { nobles: 22, clergy: 50, burghers: 16, peasants: 12 } },
  sultanate: { name: 'Sultanate', ruler: 'Sultan', rulerF: 'Sultana', realm: 'Sultanate', desc: 'Military households and iqta land grants bind emirs to the sultan; the ulema lend legitimacy.',
    estates: { nobles: 38, clergy: 28, burghers: 20, peasants: 14 } },
  caliphate: { name: 'Caliphate', ruler: 'Caliph', rulerF: 'Caliph', realm: 'Caliphate', desc: 'Successor of the Prophet: spiritual authority over the faithful, temporal power over the realm.',
    estates: { nobles: 30, clergy: 40, burghers: 18, peasants: 12 } },
  tribal: { name: 'Tribal Chiefdom', ruler: 'Chieftain', rulerF: 'Chieftess', realm: 'Tribes', desc: 'Clans bound by kinship and loot. Huge levies, little administration.',
    estates: { nobles: 45, clergy: 25, burghers: 5, peasants: 25 } },
};

export const ESTATE_NAMES = {
  default: { nobles: 'Nobility', clergy: 'Clergy', burghers: 'Burghers', peasants: 'Peasantry' },
  merchant_republic: { nobles: 'Patricians', clergy: 'Clergy', burghers: 'Guilds', peasants: 'Popolo' },
  sultanate: { nobles: 'Emirs', clergy: 'Ulema', burghers: 'Merchants', peasants: 'Fellahin' },
  caliphate: { nobles: 'Emirs', clergy: 'Ulema', burghers: 'Merchants', peasants: 'Fellahin' },
  tribal: { nobles: 'Clan Chiefs', clergy: 'Priests', burghers: 'Traders', peasants: 'Freemen' },
  imperial: { nobles: 'Dynatoi', clergy: 'Church', burghers: 'Guilds', peasants: 'Stratiotai' },
};
export const ESTATE_ICONS = { nobles: '🛡', clergy: '✝', burghers: '⚖', peasants: '🌾' };

export const COUNCIL_ROLES = ['chancellor', 'marshal', 'steward', 'spymaster', 'chaplain'];
export const ROLE_INFO = {
  chancellor: { skill: 'diplomacy', icon: '📜', desc: 'Diplomacy: better relations, faster claims, less aggressive-expansion anger.' },
  marshal: { skill: 'martial', icon: '⚔', desc: 'Martial: discipline, manpower and training speed.' },
  steward: { skill: 'stewardship', icon: '💰', desc: 'Stewardship: tax income and construction speed.' },
  spymaster: { skill: 'intrigue', icon: '🗝', desc: 'Intrigue: lower unrest, faster claims, sabotage foes.' },
  chaplain: { skill: 'learning', icon: '✝', desc: 'Learning: legitimacy, clergy loyalty and faster national focuses.' },
};
export const ROLE_TITLES = {
  default: { chancellor: 'Chancellor', marshal: 'Marshal', steward: 'Steward', spymaster: 'Spymaster', chaplain: 'Court Chaplain' },
  imperial: { chancellor: 'Logothete', marshal: 'Megas Domestikos', steward: 'Sakellarios', spymaster: 'Parakoimomenos', chaplain: 'Patriarch' },
  merchant_republic: { chancellor: 'Grand Chancellor', marshal: 'Captain-General', steward: 'Procurator', spymaster: 'Council of Ten', chaplain: 'Primicerius' },
  sultanate: { chancellor: 'Vizier', marshal: 'Amir al-Juyush', steward: 'Mustawfi', spymaster: 'Sahib al-Khabar', chaplain: 'Qadi al-Qudat' },
  caliphate: { chancellor: 'Vizier', marshal: 'Amir al-Umara', steward: 'Diwan of Treasury', spymaster: 'Sahib al-Barid', chaplain: 'Chief Qadi' },
  theocracy: { chancellor: 'Cardinal-Chancellor', marshal: 'Gonfalonier', steward: 'Camerlengo', spymaster: 'Penitentiary', chaplain: 'Cardinal-Vicar' },
  tribal: { chancellor: 'Elder Speaker', marshal: 'Warchief', steward: 'Hoard-keeper', spymaster: 'Seer', chaplain: 'High Priest' },
  elective_monarchy: { chancellor: 'Archchancellor', marshal: 'Arch-Marshal', steward: 'Arch-Steward', spymaster: 'Spymaster', chaplain: 'Arch-Chaplain' },
};

const MON = ['feudal_monarchy', 'elective_monarchy', 'imperial', 'sultanate', 'tribal'];
const NOT_REP = ['feudal_monarchy', 'elective_monarchy', 'imperial', 'sultanate', 'caliphate', 'tribal', 'theocracy'];
const CHR = ['catholic', 'orthodox', 'armenian'];
const ISL = ['sunni'];

// stance: estate opinion of the law (-2..+2). infl: change in estate influence while in force.
export const LAWS = {
  succession: { name: 'Succession', icon: '👑', desc: 'How power passes when the ruler dies.', options: {
    primogeniture: { name: 'Primogeniture', desc: 'The eldest son inherits everything. Stable, but younger sons are left landless.', govs: ['feudal_monarchy', 'imperial', 'sultanate'],
      req: [['authority', '>=', 'medium']], mods: { legitimacyMonthly: 0.06, stabilityMonthly: 0.01 }, stance: { nobles: -1, clergy: 1 } },
    gavelkind: { name: 'Partible Inheritance', desc: 'The realm is shared among all sons. Vassals love it; the realm frays.', govs: ['feudal_monarchy', 'tribal'],
      mods: { nobleLoyalty: 10, stabilityMonthly: -0.01, taxMult: -0.05 }, stance: { nobles: 2 } },
    seniority: { name: 'Agnatic Seniority', desc: 'The eldest male of the dynasty inherits, as among the Rurikids and Seljuks.', govs: ['feudal_monarchy', 'sultanate', 'tribal'], groups: ['eslavic', 'turkic', 'arabic', 'persian'],
      mods: { nobleLoyalty: 5, legitimacyMonthly: 0.02 }, stance: { nobles: 1 } },
    tanistry: { name: 'Tanistry', desc: 'The worthiest kinsman is elected heir. Rulers are capable, succession is contested.', govs: ['feudal_monarchy', 'tribal'], groups: ['gaelic', 'welsh', 'baltic', 'finnic'],
      mods: { rulerSkill: 2, stabilityMonthly: -0.005 }, stance: { nobles: 1 } },
    elective: { name: 'Princely Election', desc: 'The great princes choose the next sovereign.', govs: ['elective_monarchy'],
      mods: { legitimacyMonthly: 0.04, nobleLoyalty: 10 }, infl: { nobles: 8 }, stance: { nobles: 2 } },
    designation: { name: 'Imperial Designation', desc: 'The Basileus crowns his chosen co-emperor in life.', govs: ['imperial'],
      mods: { legitimacyMonthly: 0.04 }, stance: { clergy: 1, nobles: -1 } },
    doge_for_life: { name: 'Doge for Life', desc: 'The Great Council elects a Doge who reigns until death.', govs: ['merchant_republic'],
      mods: { stabilityMonthly: 0.01 }, stance: { nobles: 1 } },
    term_elections: { name: 'Term Elections', desc: 'Magistrates serve fixed terms, as the Florentine priori. Fresh blood, fractious politics.', govs: ['merchant_republic'],
      mods: { taxMult: 0.05, stabilityMonthly: -0.005 }, stance: { burghers: 2, nobles: -1 } },
    conclave: { name: 'Conclave', desc: 'The College of Cardinals elects the successor of Saint Peter.', govs: ['theocracy'], mods: { legitimacyMonthly: 0.05 }, stance: { clergy: 2 } },
    caliphal_designation: { name: 'Caliphal Designation', desc: 'The caliph names his heir from the dynasty of the Prophet\'s uncle.', govs: ['caliphate'], mods: { legitimacyMonthly: 0.05 }, stance: { clergy: 1 } },
  } },
  authority: { name: 'Crown Authority', icon: '⚜', desc: 'How far the ruler\'s writ runs over the great lords. Must be raised one step at a time.', ordered: ['low', 'medium', 'high', 'absolute'], options: {
    low: { name: 'Low Authority', desc: 'Great vassals are kings in all but name.', govs: NOT_REP, mods: { nobleLoyalty: 15, taxMult: -0.12, manpowerMult: 0.1 }, infl: { nobles: 10 }, stance: { nobles: 2, burghers: -1 } },
    medium: { name: 'Limited Authority', desc: 'The crown judges disputes between vassals and may summon the host.', govs: NOT_REP, mods: {}, stance: { nobles: 0 } },
    high: { name: 'High Authority', desc: 'Royal justice and royal taxes everywhere. The barons grumble.', govs: NOT_REP, req: [['stability', '>=', 0]],
      mods: { taxMult: 0.12, nobleLoyalty: -10, unrest: -1 }, infl: { nobles: -6 }, stance: { nobles: -2, burghers: 1, peasants: 1 } },
    absolute: { name: 'Absolute Authority', desc: 'The sovereign\'s will is law. Enables royal decrees that bypass the estates.', govs: ['feudal_monarchy', 'imperial', 'sultanate', 'caliphate', 'theocracy'],
      req: [['legitimacy', '>=', 70], ['influence.nobles', '<', 38]], mods: { taxMult: 0.22, nobleLoyalty: -20, decree: 1 }, infl: { nobles: -12 }, stance: { nobles: -2, clergy: -1, burghers: 1 } },
    great_council: { name: 'Great Council', desc: 'A broad council of patricians governs. Slow, but no family dominates.', govs: ['merchant_republic'], mods: { stabilityMonthly: 0.01 }, stance: { nobles: 1, burghers: 1 } },
    signoria: { name: 'Signoria', desc: 'A narrow executive of priors with real power.', govs: ['merchant_republic'], mods: { taxMult: 0.1, buildSpeed: 0.1 }, stance: { burghers: 1, nobles: -1 } },
    podesta: { name: 'Podestà', desc: 'An outsider magistrate with sweeping powers for a fixed term, to end the factional feuds.', govs: ['merchant_republic'], req: [['stability', '<', 1]],
      mods: { unrest: -3, stabilityMonthly: 0.02, taxMult: 0.05 }, stance: { peasants: 1, nobles: -1 } },
  } },
  military: { name: 'Military Organisation', icon: '⚔', desc: 'How the realm raises and pays its soldiers.', options: {
    feudal_levies: { name: 'Feudal Levies', desc: 'Vassals bring their retinues for forty days a year.', govs: NOT_REP, mods: { manpowerMult: 0.15, discipline: -0.05 }, stance: { nobles: 1 } },
    scutage: { name: 'Scutage', desc: 'Shield-money paid instead of service funds hired professionals.', govs: ['feudal_monarchy', 'elective_monarchy', 'imperial'], req: [['authority', '>=', 'medium']],
      mods: { taxMult: 0.08, manpowerMult: -0.15, recruitCost: -0.1 }, stance: { nobles: 1, burghers: 1, peasants: -1 } },
    standing_army: { name: 'Standing Army', desc: 'Paid, drilled troops under royal captains all year round.', govs: ['feudal_monarchy', 'imperial', 'sultanate', 'caliphate'], req: [['authority', '>=', 'high'], ['buildings.barracks', '>=', 2]],
      mods: { discipline: 0.12, upkeepMult: 0.2, manpowerMult: -0.1, trainSpeed: 0.2 }, stance: { nobles: -2, burghers: 1 } },
    civic_militia: { name: 'Civic Militia', desc: 'Every guildsman drills on Sunday and the carroccio leads the city host.', govs: ['merchant_republic'], mods: { manpowerMult: 0.25, upkeepMult: -0.15 }, stance: { burghers: 1, peasants: 1 } },
    condottieri: { name: 'Mercenary Contracts', desc: 'Hire professional companies. Expensive but skilled, and no citizen dies.', govs: ['merchant_republic', 'theocracy'], mods: { discipline: 0.08, recruitCost: 0.15, manpowerMult: -0.2, trainSpeed: 0.35 }, stance: { burghers: 1, peasants: 2 } },
    iqta: { name: 'Iqta Grants', desc: 'Emirs hold revenue grants in return for mounted service.', govs: ['sultanate', 'caliphate'], mods: { cavCost: -0.2, horsesMult: 0.25, nobleLoyalty: 5 }, stance: { nobles: 2, peasants: -1 } },
    warbands: { name: 'Clan Warbands', desc: 'Every free man is a warrior. Enormous hosts, little order.', govs: ['tribal'], mods: { manpowerMult: 0.35, discipline: -0.1, upkeepMult: -0.2 }, stance: { nobles: 1, peasants: 1 } },
    themata: { name: 'Theme System', desc: 'Soldier-farmers hold land in return for service, as in Rome\'s golden age.', govs: ['imperial'], req: [['authority', '>=', 'high']], mods: { manpowerMult: 0.25, discipline: 0.05, taxMult: -0.05 }, stance: { peasants: 2, nobles: -1 } },
    papal_levies: { name: 'Militia Christi', desc: 'Pilgrims and crusaders flock to the banners of the Church.', govs: ['theocracy'], mods: { manpowerMult: 0.2, armyMorale: 0.05 }, stance: { clergy: 2 } },
  } },
  taxation: { name: 'Taxation', icon: '💰', desc: 'What the realm taxes and who pays.', options: {
    feudal_dues: { name: 'Feudal Dues', desc: 'Customary rents, tolls and aids.', mods: {}, stance: {} },
    tallage: { name: 'Tallage', desc: 'Arbitrary levies on towns and royal demesne.', govs: NOT_REP, req: [['authority', '>=', 'medium']], mods: { taxMult: 0.15, burgherLoyalty: -12, unrest: 1 }, stance: { burghers: -2, nobles: 1 } },
    tithe_share: { name: 'Shared Tithe', desc: 'The crown takes a share of the tithe for holy war.', religions: CHR, mods: { taxMult: 0.08, clergyLoyalty: -10 }, stance: { clergy: -2 } },
    customs: { name: 'Customs Duties', desc: 'Tolls on every bale at port and bridge.', req: [['buildings.market', '>=', 3]], mods: { tradeMult: 0.25, burgherLoyalty: -5 }, stance: { burghers: -1, nobles: 1 } },
    kharaj: { name: 'Kharaj & Jizya', desc: 'Land tax and the poll tax on protected non-Muslims.', religions: ISL, mods: { taxMult: 0.12, unrestInfidel: 2 }, stance: { clergy: 1, peasants: -1 } },
    tribute: { name: 'Tribute & Plunder', desc: 'The tribe lives by gifts, tribute and raids.', govs: ['tribal'], mods: { lootMult: 0.5, taxMult: -0.1 }, stance: { nobles: 2 } },
  } },
  justice: { name: 'Justice', icon: '⚖', desc: 'The law courts of the realm.', options: {
    customary: { name: 'Customary Law', desc: 'Local custom and the lord\'s court.', mods: {}, stance: { nobles: 1 } },
    ordeal: { name: 'Trial by Ordeal', desc: 'God judges through fire, water and combat.', religions: ['catholic', 'orthodox', 'pagan', 'tengri'], mods: { clergyLoyalty: 8, unrest: 1 }, stance: { clergy: 1, peasants: -1 } },
    common_law: { name: 'Common Law', desc: 'Royal justices on circuit, juries and writs, as under Henry II.', religions: CHR, req: [['authority', '>=', 'medium'], ['stability', '>=', 0]], govs: NOT_REP,
      mods: { unrest: -4, taxMult: 0.04 }, stance: { peasants: 2, burghers: 1, nobles: -1 } },
    roman_law: { name: 'Roman Law', desc: 'The rediscovered Corpus Juris Civilis: princeps legibus solutus.', religions: CHR, req: [['unlock', 'roman_law']],
      mods: { taxMult: 0.07, crownBonus: 1, unrest: -1 }, stance: { burghers: 2, clergy: 1, nobles: -2 } },
    sharia: { name: 'Sharia Courts', desc: 'Qadis judge by the revealed law.', religions: ISL, mods: { clergyLoyalty: 10, stabilityMonthly: 0.01 }, stance: { clergy: 2 } },
    canon_law: { name: 'Canon Law', desc: 'Church courts judge every man in the patrimony.', govs: ['theocracy'], mods: { legitimacyMonthly: 0.05, clergyLoyalty: 10 }, stance: { clergy: 2 } },
    city_statutes: { name: 'City Statutes', desc: 'Written communal statutes, notaries and podestà courts.', govs: ['merchant_republic'], mods: { tradeMult: 0.1, unrest: -2 }, stance: { burghers: 2 } },
    blood_price: { name: 'Blood Price', desc: 'Feuds settled by weregild and the thing-assembly.', govs: ['tribal'], mods: { unrest: -2, stabilityMonthly: 0.005 }, stance: { peasants: 1, nobles: 1 } },
  } },
  church: { name: 'Faith & State', icon: '✝', desc: 'The relationship between the throne and the altar.', options: {
    papal_investiture: { name: 'Papal Investiture', desc: 'Rome appoints the bishops. The Pope smiles upon you.', religions: ['catholic'], mods: { legitimacyMonthly: 0.04, clergyLoyalty: 10, papalOpinion: 30 }, infl: { clergy: 5 }, stance: { clergy: 2 } },
    royal_investiture: { name: 'Royal Investiture', desc: 'The crown chooses its own bishops. Risks excommunication.', religions: ['catholic'], govs: NOT_REP.filter((g) => g !== 'theocracy'),
      mods: { taxMult: 0.06, clergyLoyalty: -15, papalOpinion: -60 }, infl: { clergy: -6 }, stance: { clergy: -2, nobles: 1 } },
    autocephaly: { name: 'Autocephalous Church', desc: 'A self-governing national church under its own patriarch or archbishop.', religions: ['orthodox', 'armenian'], mods: { stabilityMonthly: 0.01, clergyLoyalty: 5 }, stance: { clergy: 1 } },
    caesaropapism: { name: 'Caesaropapism', desc: 'The emperor presides over councils and names the patriarch.', religions: ['orthodox'], govs: ['imperial'], mods: { legitimacyMonthly: 0.06, clergyLoyalty: -5 }, stance: { clergy: -1 } },
    caliphal_recognition: { name: 'Caliphal Recognition', desc: 'The khutba is read in the name of the Abbasid caliph. Legitimacy flows from Baghdad.', religions: ISL, govs: ['sultanate'], mods: { legitimacyMonthly: 0.06 }, stance: { clergy: 2 } },
    independent_sultan: { name: 'Independent Sovereignty', desc: 'The sultan is answerable to no caliph.', religions: ISL, govs: ['sultanate', 'caliphate'], mods: { taxMult: 0.05, legitimacyMonthly: -0.02 }, stance: { clergy: -1, nobles: 1 } },
    old_gods: { name: 'The Old Gods', desc: 'Perkūnas, Ukko and the sacred groves. Resist the cross!', religions: ['pagan', 'tengri'], mods: { armyMorale: 0.08, defenseHome: 0.1 }, stance: { clergy: 2 } },
    baptism: { name: 'Accept Baptism', desc: 'Convert the court to Christianity. The crusaders lose their pretext; the old priests rage.', religions: ['pagan', 'tengri'], req: [['buildings.church', '>=', 1]],
      convert: true, mods: { stabilityMonthly: -0.02 }, stance: { clergy: -2, burghers: 1 } },
  } },
  peasantry: { name: 'Peasantry', icon: '🌾', desc: 'The status of those who work the land.', options: {
    serfdom: { name: 'Serfdom', desc: 'Peasants are bound to the soil and owe labour on the demesne.', govs: NOT_REP, mods: { manpowerMult: 0.1, foodMult: 0.05, unrest: 2, peasantLoyalty: -12 }, stance: { nobles: 2, peasants: -2 } },
    manumission: { name: 'Partial Manumission', desc: 'Labour services commuted to money rents.', req: [['law.justice', 'in', ['common_law', 'roman_law', 'city_statutes', 'sharia']]],
      mods: { taxMult: 0.06, devGrowth: 0.15 }, stance: { peasants: 1, burghers: 1, nobles: -1 } },
    free_peasants: { name: 'Free Peasantry', desc: 'Free tenants with rights at law; towns grow and so do revenues.', req: [['law.peasantry', 'in', ['manumission']], ['influence.burghers', '>=', 18]],
      mods: { taxMult: 0.1, devGrowth: 0.3, manpowerMult: -0.05, nobleLoyalty: -10, unrest: -2 }, stance: { peasants: 2, burghers: 2, nobles: -2 } },
    free_tribesmen: { name: 'Free Tribesmen', desc: 'Every clansman is free and armed.', govs: ['tribal'], mods: { manpowerMult: 0.1 }, stance: { peasants: 1 } },
    fellahin_iqta: { name: 'Fellahin of the Iqta', desc: 'Cultivators pay their kharaj to the iqta holder.', govs: ['sultanate', 'caliphate'], mods: { foodMult: 0.1, horsesMult: 0.1 }, stance: { nobles: 1 } },
  } },
  trade: { name: 'Trade & Towns', icon: '⚓', desc: 'How commerce and towns are regulated.', options: {
    staple: { name: 'Staple Rights', desc: 'Goods must be offered for sale in privileged staple towns first.', mods: { tradeMult: 0.05 }, stance: { burghers: 1 } },
    guild_charters: { name: 'Guild Charters', desc: 'Craft guilds regulate quality and prices.', req: [['buildings.workshop', '>=', 1]], mods: { buildCost: -0.1, recruitCost: -0.05, burgherLoyalty: 10 }, infl: { burghers: 6 }, stance: { burghers: 2, peasants: -1 } },
    free_trade: { name: 'Free Trade', desc: 'Foreign merchants welcome, tolls abolished.', req: [['buildings.port', '>=', 1]], mods: { tradeMult: 0.3, taxMult: -0.05 }, infl: { burghers: 8 }, stance: { burghers: 2, nobles: -1 } },
    monopoly: { name: 'Merchant Monopoly', desc: 'The republic\'s own merchants hold exclusive privileges in every port.', govs: ['merchant_republic'], mods: { tradeMult: 0.4, diplo: -10 }, infl: { burghers: 10 }, stance: { burghers: 2, nobles: 1 } },
  } },
  nobility: { name: 'Noble Privileges', icon: '🛡', desc: 'Liberties of the aristocracy.', options: {
    privileges: { name: 'Noble Privileges', desc: 'Tax exemptions and hereditary offices.', mods: { nobleLoyalty: 15, taxMult: -0.06 }, infl: { nobles: 5 }, stance: { nobles: 2 } },
    royal_domain: { name: 'Royal Domain', desc: 'Escheated fiefs are kept by the crown, not regranted.', govs: NOT_REP, req: [['authority', '>=', 'high']], mods: { taxMult: 0.1, nobleLoyalty: -12 }, infl: { nobles: -8 }, stance: { nobles: -2 } },
    charter: { name: 'Charter of Liberties', desc: 'The crown is bound by law and must consult the great council for new taxes (Magna Carta, 1215).', govs: NOT_REP,
      mods: { nobleLoyalty: 20, burgherLoyalty: 10, taxMult: -0.08, stabilityMonthly: 0.02, decree: -1 }, infl: { nobles: 6, burghers: 4 }, stance: { nobles: 2, burghers: 2, clergy: 1 } },
    oligarchy: { name: 'Patrician Oligarchy', desc: 'The Serrata: only old families may sit in the Great Council.', govs: ['merchant_republic'], mods: { stabilityMonthly: 0.02, nobleLoyalty: 15, burgherLoyalty: -8 }, infl: { nobles: 10 }, stance: { nobles: 2, burghers: -1 } },
  } },
};
export const LAW_ORDER = ['succession', 'authority', 'military', 'taxation', 'justice', 'church', 'peasantry', 'trade', 'nobility'];

// Default statute book for a realm at game start, before any reform.
export function defaultLaws(n) {
  const g = n.gov, r = n.religion;
  const L = {};
  L.succession = { feudal_monarchy: 'primogeniture', elective_monarchy: 'elective', imperial: 'designation', merchant_republic: 'doge_for_life', theocracy: 'conclave', sultanate: 'seniority', caliphate: 'caliphal_designation', tribal: 'tanistry' }[g];
  if (g === 'feudal_monarchy' && ['eslavic'].includes(n.group)) L.succession = 'seniority';
  if (g === 'tribal' && !['gaelic', 'welsh', 'baltic', 'finnic'].includes(n.group)) L.succession = 'gavelkind';
  L.authority = g === 'merchant_republic' ? 'great_council' : g === 'tribal' ? 'low' : g === 'imperial' || g === 'caliphate' ? 'high' : 'medium';
  L.military = { merchant_republic: 'civic_militia', theocracy: 'papal_levies', sultanate: 'iqta', caliphate: 'iqta', tribal: 'warbands' }[g] || 'feudal_levies';
  L.taxation = r === 'sunni' ? 'kharaj' : g === 'tribal' ? 'tribute' : 'feudal_dues';
  L.justice = r === 'sunni' ? 'sharia' : g === 'theocracy' ? 'canon_law' : g === 'merchant_republic' ? 'city_statutes' : g === 'tribal' ? 'blood_price' : 'customary';
  L.church = r === 'catholic' ? 'papal_investiture' : r === 'orthodox' ? (g === 'imperial' ? 'caesaropapism' : 'autocephaly') : r === 'armenian' ? 'autocephaly' : r === 'sunni' ? (g === 'caliphate' ? 'independent_sultan' : 'caliphal_recognition') : 'old_gods';
  L.peasantry = g === 'tribal' ? 'free_tribesmen' : g === 'sultanate' || g === 'caliphate' ? 'fellahin_iqta' : g === 'merchant_republic' ? 'manumission' : 'serfdom';
  L.trade = g === 'merchant_republic' ? 'monopoly' : 'staple';
  L.nobility = g === 'merchant_republic' ? 'oligarchy' : 'privileges';
  return L;
}
