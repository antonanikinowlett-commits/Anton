// Culture-aware naming for generated provinces and characters.
import { pick } from '../util.js';

export const CULTURE_GROUP = {
  english: 'english', scottish: 'gaelic', irish: 'gaelic', welsh: 'welsh', french: 'french', occitan: 'french', breton: 'french',
  dutch: 'dutch', german: 'german', pomeranian: 'german', czech: 'wslavic', polish: 'wslavic', russian: 'eslavic', ruthenian: 'eslavic',
  serbian: 'sslavic', croatian: 'sslavic', bulgarian: 'sslavic', hungarian: 'hungarian', greek: 'greek', italian: 'italian', sicilian: 'italian',
  castilian: 'iberian', basque: 'iberian', catalan: 'iberian', portuguese: 'iberian', danish: 'norse', norwegian: 'norse', swedish: 'norse',
  finnish: 'finnic', estonian: 'finnic', mordvin: 'finnic', komi: 'finnic', latvian: 'baltic', lithuanian: 'baltic', prussian: 'baltic',
  cuman: 'turkic', bulgar: 'turkic', turkish: 'turkic', berber: 'arabic', arabic: 'arabic', kurdish: 'arabic', persian: 'persian',
  armenian: 'caucasian', georgian: 'caucasian', alan: 'caucasian', andalusian: 'arabic', vlach: 'sslavic', slovak: 'wslavic',
};

const P = {
  english: [['Ash', 'Brad', 'Chel', 'Ded', 'Ever', 'Fern', 'Gil', 'Hal', 'Kings', 'Lang', 'Mar', 'North', 'Ox', 'Ric', 'Stan', 'Thorn', 'Wal', 'Wey', 'Whit', 'Wood', 'Ely', 'Brom', 'Sut'], ['ton', 'ham', 'bury', 'ford', 'ley', 'wick', 'by', 'field', 'stead', 'worth', 'chester', 'mouth', 'hurst']],
  gaelic: [['Bally', 'Kil', 'Dun', 'Inver', 'Glen', 'Ach', 'Ard', 'Strath', 'Lis', 'Clon', 'Tulla', 'Kin', 'Bal'], ['more', 'kenny', 'garry', 'lorn', 'ross', 'dare', 'mullen', 'ness', 'cairn', 'ock', 'roe', 'beg']],
  welsh: [['Aber', 'Llan', 'Caer', 'Pen', 'Tre', 'Bryn', 'Cwm', 'Dol', 'Maes'], ['ystwyth', 'dovey', 'gwyn', 'fawr', 'goch', 'fach', 'teifi', 'elli', 'rhos']],
  french: [['Saint-', 'Mont', 'Beau', 'Ville', 'Châtel', 'Roche', 'Clair', 'Fontaine', 'Bel', 'Mar', 'Neuf', 'Ver', 'Cha', 'Sau', 'Pont-'], ['ville', 'court', 'mont', 'fort', 'lieu', 'champ', 'bois', 'val', 'aux', 'ac', 'ignac', 'ers', 'Denis', 'Omer', 'Pierre', 'roy']],
  dutch: [['Zut', 'Dor', 'Amer', 'Har', 'Ber', 'Ven', 'Hel', 'Zw', 'Del', 'Mech', 'Tie', 'Kort'], ['dam', 'drecht', 'hoven', 'veld', 'loo', 'zeel', 'kerk', 'broek', 'rijk', 'wijk', 'gem']],
  german: [['Alt', 'Neu', 'Rot', 'Wolf', 'Eich', 'Hohen', 'Schön', 'Lauen', 'Fried', 'Mark', 'Stein', 'Ober', 'Burg', 'Kloster', 'Wald', 'Ebers', 'Lands'], ['burg', 'dorf', 'heim', 'hausen', 'stadt', 'feld', 'berg', 'au', 'bach', 'ingen', 'furt', 'stein', 'hut', 'wald']],
  wslavic: [['Bole', 'Brze', 'Prze', 'Grod', 'Krzy', 'Ostr', 'Sław', 'Wiel', 'Bystr', 'Kam', 'Mił', 'Rad', 'Zbo'], ['ów', 'ice', 'sko', 'nik', 'ec', 'owo', 'any', 'ín', 'ov', 'any', 'ica', 'ec']],
  eslavic: [['Vysh', 'Bel', 'Zvenig', 'Ostr', 'Pere', 'Star', 'Novo', 'Bogo', 'Yur', 'Vasil', 'Dmitr', 'Krem', 'Ples', 'Rzh', 'Torzh'], ['gorod', 'ov', 'sk', 'ets', 'ograd', 'ino', 'yev', 'evo', 'ichi', 'ok', 'ishche']],
  sslavic: [['Bel', 'Novo', 'Prije', 'Kru', 'Stari', 'Dobr', 'Gor', 'Zve', 'Vrh', 'Kos', 'Pri', 'Bra'], ['grad', 'ovac', 'evo', 'ica', 'je', 'polje', 'nik', 'ište', 'ane', 'ec']],
  hungarian: [['Fehér', 'Szent', 'Kis', 'Nagy', 'Vas', 'Sár', 'Tisza', 'Hód', 'Kecs', 'Ajka', 'Mező', 'Bé', 'Tata'], ['vár', 'falva', 'háza', 'egyháza', 'telek', 'hely', 'ke', 'lak', 'völgy', 'szeg']],
  greek: [['Neo', 'Palaio', 'Agia ', 'Kastro', 'Chryso', 'Kalli', 'Megalo', 'Platy', 'Lyko', 'Myri', 'Trik'], ['polis', 'kastro', 'chori', 'ia', 'ion', 'ada', 'ika', 'mos', 'ousa', 'nos']],
  italian: [['Castel', 'Monte', 'San ', 'Borgo', 'Villa', 'Rocca', 'Ponte', 'Colle', 'Fonte', 'Porto', 'Torre'], ['franco', 'vecchio', 'nuovo', 'alto', 'fiore', 'lago', 'mare', 'Giorgio', 'Marco', 'Pietro', 'bello', 'ano', 'ella']],
  iberian: [['Villa', 'Castro', 'Torre', 'Alca', 'Medina ', 'Santa ', 'Puebla ', 'Val', 'Cala', 'Mon', 'Fuente', 'Peña'], ['real', 'franca', 'nueva', 'verde', 'del Río', 'de la Sierra', 'ejo', 'ar', 'eda', 'illa', 'ón', 'oso']],
  norse: [['Ska', 'Hof', 'Lin', 'Ny', 'Øs', 'Vest', 'Nor', 'Sol', 'Eid', 'Hal', 'Gud', 'Tor', 'Fal', 'Ran'], ['by', 'vik', 'heim', 'stad', 'ø', 'fjord', 'land', 'holm', 'berg', 'købing', 'sund', 'dal']],
  finnic: [['Kar', 'Tuu', 'Hä', 'Joki', 'Mus', 'Pih', 'Rau', 'Sai', 'Vä', 'Kol', 'Oula', 'Sär'], ['la', 'nen', 'järvi', 'koski', 'saari', 'mäki', 'vaara', 'niemi', 'lahti', 'mo']],
  baltic: [['Kerna', 'Upy', 'Ragai', 'Dau', 'Šiau', 'Taura', 'Ger', 'Mede', 'Tal', 'Var', 'Žem'], ['iai', 'ava', 'ai', 'enai', 'gala', 'kiai', 'uva', 'upis', 'ys', 'uvė']],
  turkic: [['Kara', 'Ak', 'Kızıl', 'Eski', 'Yeni', 'Kum', 'Sarı', 'Altın', 'Boz', 'Ulu', 'Tash', 'Kök'], ['hisar', 'kent', 'su', 'tepe', 'kaya', 'göl', 'balık', 'kale', 'yurt', 'ova', 'saray']],
  arabic: [['Al-', 'Qasr ', 'Ras ', 'Bir ', 'Wadi ', 'Dar ', 'Ain ', 'Tell ', 'Ma\'arra ', 'Kafr ', 'Bab '], ['Hamra', 'Bayda', 'Jadida', 'Kabir', 'Malik', 'Nahr', 'Sultan', 'Zahra', 'Mansura', 'Qadim', 'Rahma', 'Salam']],
  persian: [['Shah', 'Nar', 'Gol', 'Ab', 'Dez', 'Kuh', 'Dar', 'Mar', 'Sar', 'Bah'], ['abad', 'shahr', 'dan', 'kand', 'gerd', 'van', 'stan', 'rud']],
  caucasian: [['Akhal', 'Mtsk', 'Gor', 'Sam', 'Tsi', 'Ber', 'Mar', 'Ani', 'Dzor', 'Vard', 'Kvel'], ['tsikhe', 'kalaki', 'eti', 'avan', 'aberd', 'ashen', 'ani', 'uri', 'ati', 'ovi']],
};

const FIRST = {
  english: ['William', 'Robert', 'Richard', 'Hugh', 'Walter', 'Ralph', 'Geoffrey', 'Roger', 'Gilbert', 'Henry', 'Simon', 'Stephen', 'Thomas', 'Nicholas', 'Peter'],
  gaelic: ['Domnall', 'Áed', 'Ruaidrí', 'Brian', 'Niall', 'Alexander', 'Malcolm', 'Duncan', 'Cathal', 'Tadc', 'Donnchad', 'Gillespie'],
  welsh: ['Gruffudd', 'Rhys', 'Owain', 'Madog', 'Dafydd', 'Hywel', 'Maredudd', 'Cadwgan', 'Iorwerth', 'Einion'],
  french: ['Louis', 'Philippe', 'Guillaume', 'Hugues', 'Raoul', 'Thibaut', 'Gautier', 'Guy', 'Amaury', 'Jean', 'Enguerrand', 'Mathieu', 'Raymond', 'Bertrand', 'Arnaud'],
  dutch: ['Dirk', 'Floris', 'Willem', 'Arnoud', 'Godfried', 'Boudewijn', 'Jan', 'Gerard', 'Hendrik'],
  german: ['Konrad', 'Heinrich', 'Otto', 'Friedrich', 'Ludwig', 'Albrecht', 'Hermann', 'Berthold', 'Dietrich', 'Ulrich', 'Gottfried', 'Wolfger', 'Rudolf', 'Siegfried', 'Eberhard'],
  wslavic: ['Bolesław', 'Mieszko', 'Władysław', 'Kazimierz', 'Henryk', 'Konrad', 'Vladislav', 'Soběslav', 'Bořivoj', 'Spytihněv', 'Jaroslav', 'Przemysł'],
  eslavic: ['Vladimir', 'Yaroslav', 'Mstislav', 'Sviatoslav', 'Vsevolod', 'Izyaslav', 'Rostislav', 'Gleb', 'Yuri', 'Daniil', 'Vasilko', 'Oleg', 'Igor', 'Dmitry'],
  sslavic: ['Stefan', 'Vukan', 'Radoslav', 'Ivan', 'Petar', 'Boril', 'Strez', 'Dragutin', 'Miroslav', 'Branislav', 'Kresimir'],
  hungarian: ['Béla', 'András', 'István', 'László', 'Géza', 'Kálmán', 'Miklós', 'Dénes', 'Pál', 'Csák', 'Bánk', 'Lőrinc'],
  greek: ['Alexios', 'Ioannes', 'Manuel', 'Isaac', 'Theodore', 'Michael', 'Andronikos', 'Konstantinos', 'Nikephoros', 'Georgios', 'Leo', 'Basil'],
  italian: ['Marco', 'Pietro', 'Giovanni', 'Ugolino', 'Ottone', 'Guido', 'Ranieri', 'Lotario', 'Matteo', 'Iacopo', 'Bonifacio', 'Azzo', 'Ezzelino', 'Tancredi'],
  iberian: ['Alfonso', 'Fernando', 'Sancho', 'Pedro', 'Rodrigo', 'Gonzalo', 'Diego', 'Martín', 'Álvaro', 'Nuño', 'Garcia', 'Jaume', 'Ramon', 'Afonso', 'Gomes'],
  norse: ['Haakon', 'Magnus', 'Sverre', 'Inge', 'Erik', 'Knut', 'Valdemar', 'Sigurd', 'Olaf', 'Birger', 'Absalon', 'Harald', 'Skule', 'Folke'],
  finnic: ['Kalevi', 'Väinö', 'Ilmari', 'Lembitu', 'Meelis', 'Ako', 'Tasso', 'Purgas', 'Unni', 'Vesse', 'Lauri'],
  baltic: ['Mindaugas', 'Dausprungas', 'Vykintas', 'Skirmantas', 'Traidenis', 'Žvelgaitis', 'Herkus', 'Nalšia', 'Glande', 'Diwane'],
  turkic: ['Kılıç Arslan', 'Kaykhusraw', 'Kayqubad', 'Tughril', 'Alp', 'Bilge', 'Konchak', 'Köten', 'Tugorkan', 'Bashkurt', 'Kutlu', 'Ayas', 'Toghan'],
  arabic: ['Yusuf', 'Ahmad', 'Muhammad', 'Ali', 'Umar', 'Shirkuh', 'Ismail', 'Ibrahim', 'Hasan', 'Abd al-Mumin', 'Ya\'qub', 'Idris', 'Bahram', 'Qutuz', 'Baybars'],
  persian: ['Bahram', 'Khusraw', 'Rustam', 'Farrukh', 'Manuchihr', 'Ardashir', 'Kayumars', 'Shahriyar', 'Dara'],
  caucasian: ['Davit', 'Giorgi', 'Ivane', 'Zakare', 'Levon', 'Hethum', 'Kostandin', 'Vakhtang', 'Bagrat', 'Shota', 'Smbat'],
};
const LAST = {
  english: ['de Clare', 'FitzWalter', 'Bigod', 'de Lacy', 'Marshal', 'de Vere', 'Mortimer', 'Mowbray', 'Percy', 'Beauchamp', 'Basset', 'Neville'],
  gaelic: ['Mac Carthaig', 'Ua Briain', 'Mac Domnaill', 'Comyn', 'Stewart', 'Bruce', 'Ua Néill', 'Mac Lochlainn', 'Murray', 'Douglas'],
  welsh: ['ap Gruffudd', 'ap Rhys', 'ap Madog', 'ap Owain', 'ab Iorwerth', 'Fychan'],
  french: ['de Coucy', 'de Montmorency', 'de Dreux', 'de Joinville', 'de Brienne', 'de Lusignan', 'de Beaumont', 'de Châtillon', 'de Garlande', 'des Barres', 'de Trencavel', 'de Foix'],
  dutch: ['van Holland', 'van Gelre', 'van Loon', 'van Arkel', 'van Brederode', 'van Cuijk'],
  german: ['von Andechs', 'von Zähringen', 'von Kyburg', 'von Hohenzollern', 'von Schauenburg', 'von Wied', 'von Salza', 'von Sayn', 'von Eppstein', 'von Lobdeburg'],
  wslavic: ['Gryfita', 'Awdaniec', 'Odrowąż', 'Toporczyk', 'Vítkovci', 'Hrabišic', 'Ronovci', 'Pałuka', 'Nałęcz'],
  eslavic: ['Olgovich', 'Monomakhovich', 'Rostislavich', 'Yurievich', 'Vsevolodovich', 'Igorevich', 'Davidovich', 'Glebovich'],
  sslavic: ['Nemanjić', 'Asen', 'Šubić', 'Frankopan', 'Kačić', 'Kotromanić', 'Terter', 'Smilets'],
  hungarian: ['Aba', 'Csák', 'Kán', 'Gutkeled', 'Ákos', 'Héder', 'Rátót', 'Bór-Kalán', 'Győr', 'Hont-Pázmány'],
  greek: ['Komnenos', 'Doukas', 'Laskaris', 'Palaiologos', 'Vatatzes', 'Branas', 'Kantakouzenos', 'Kamateros', 'Tornikes', 'Raoul'],
  italian: ['Doria', 'Spinola', 'Visconti', 'della Scala', 'd\'Este', 'Malatesta', 'da Romano', 'Ziani', 'Tiepolo', 'Orsini', 'Colonna', 'Uberti', 'Buondelmonti'],
  iberian: ['de Lara', 'de Haro', 'de Castro', 'Téllez', 'de Cardona', 'de Moncada', 'de Azagra', 'Girón', 'de Meneses', 'Pires', 'de Sousa'],
  norse: ['Skjalgsson', 'Haraldsson', 'Folkunge', 'Hvide', 'Erling', 'Bjelbo', 'Sigurdsson', 'Galen'],
  finnic: ['of Häme', 'of Karelia', 'of Sakala', 'of Ugaunia', 'of Savo'],
  baltic: ['of Deltuva', 'of Nalšia', 'of Samogitia', 'of Sambia', 'of Natangia', 'of Yotva'],
  turkic: ['Khan', 'Beg', 'Seljuk', 'Danishmend', 'Saltukid', 'Mengujekid', 'Artuqid', 'Bey'],
  arabic: ['ibn Ayyub', 'ibn Tumart', 'ibn Shaddad', 'al-Fadil', 'ibn Munqidh', 'al-Hakkari', 'ibn Zengi', 'al-Mashtub', 'ibn Ghaniya'],
  persian: ['Eldiguzid', 'Ildegizid', 'Bavandid', 'Kasranid', 'Shaddadid'],
  caucasian: ['Mkhargrdzeli', 'Orbeli', 'Hethumid', 'Rubenid', 'Dadiani', 'Jaqeli', 'Abuletisdze'],
};

export function groupOf(culture) { return CULTURE_GROUP[culture] || 'german'; }

export function placeName(rng, culture, used) {
  const [a, b] = P[groupOf(culture)] || P.german;
  for (let i = 0; i < 20; i++) {
    let n = pick(rng, a) + pick(rng, b);
    n = n.replace(/--/g, '-').replace(/  /g, ' ');
    if (n.endsWith('-')) n = n.slice(0, -1);
    if (!used.has(n)) { used.add(n); return n; }
  }
  const Q = ['Upper', 'Lower', 'Great', 'Little', 'North', 'South', 'East', 'West', 'Old', 'New', 'High', 'Far'];
  for (let i = 0; i < 40; i++) {
    const n = pick(rng, Q) + ' ' + pick(rng, a) + pick(rng, b);
    if (!used.has(n)) { used.add(n); return n.replace(/- /g, ' ').replace(/ -/g, ' '); }
  }
  const n = pick(rng, a) + pick(rng, b) + ' ' + (used.size % 97 + 2);
  used.add(n);
  return n;
}

export function personName(rng, culture) {
  const g = groupOf(culture);
  return [pick(rng, FIRST[g] || FIRST.german), pick(rng, LAST[g] || LAST.german)];
}
