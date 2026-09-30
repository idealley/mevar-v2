// The book tables shared by the bible-reference normalizers: 65 (French),
// 66 (English) and 65b (which restores the Branham text from its source);
// below them, the helpers 65b, 65c and 65d share to align our text with its
// source.
// First entry of each row is the canonical name, the rest are accepted variants.

// The three build their regexes from these names.
export const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Aligning our text with its source (65b, 65c, 65d): a span as a regex whose
// quotes may be curly on one side and straight on the other, and the two
// words before a spot and the three after it, once `norm` has flattened the
// text the way the script compares it.
export const quotePattern = (s) => escRe(s).replace(/['‘’]/g, "['‘’]").replace(/["“”]/g, '["“”]');
export const before2 = (text, at, norm) => norm(text.slice(Math.max(0, at - 300), at)).trimEnd().split(" ").slice(-2).join(" ");
export const after3 = (text, at, norm) => norm(text.slice(at, at + 300)).trimStart().split(" ").slice(0, 3).join(" ");

// ─── French (Segond names) ───────────────────────────────────────────────────
// 65 matches them in any case, accents as written (so « Ezé » and « Ézé »
// are two aliases); its lookup (normForMatch) then ignores both.
// Goal 20 added the spellings the Mevar texts use and 65 missed (« Mathieu »,
// « Hébr », « 1 Pier »): measured, each a citation where it is followed by
// a chapter. « Pier », « Pie » and « Pi » only after the book's number.
export const BOOKS_FR = [
  // Old Testament
  ["Genèse", "Genese", "Gen", "Gn", "Gé", "Ge"],
  ["Exode", "Ex", "Exo", "Exod"],
  ["Lévitique", "Levitique", "Lev", "Lév", "Lv"],
  ["Nombres", "Nombre", "Nb", "Nbr", "Nom", "Nombr", "Nomb", "Nbre", "Nbres", "Num"],
  ["Deutéronome", "Deuteronome", "Deut", "Deu", "Dt"],
  ["Josué", "Josue", "Jos", "Js"],
  ["Juges", "Jug", "Jg", "Jgs"],
  ["Ruth", "Rt", "Ru"],
  ["1 Samuel", "1 Sam", "1Sam", "1S", "1Sm", "I Samuel", "I Sam"],
  ["2 Samuel", "2 Sam", "2Sam", "2S", "2Sm", "II Samuel", "II Sam"],
  ["1 Rois", "1 Roi", "1Roi", "1R", "1Rs", "I Rois"],
  ["2 Rois", "2 Roi", "2Roi", "2R", "2Rs", "II Rois"],
  ["1 Chroniques", "1 Chr", "1Chr", "1Ch", "1Chro", "I Chroniques", "I Chr", "1 Chronique"],
  ["2 Chroniques", "2 Chr", "2Chr", "2Ch", "2Chro", "II Chroniques", "II Chr", "2 Chron"],
  ["Esdras", "Esd"],
  ["Néhémie", "Nehemie", "Néh", "Neh", "Ne"],
  ["Esther", "Est", "Esth"],
  ["Job", "Jb"],
  ["Psaumes", "Psaume", "Ps", "Psa", "Psau"],
  ["Proverbes", "Prov", "Pro", "Pr", "Prv", "Proverbe"],
  ["Ecclésiaste", "Ecclesiaste", "Eccl", "Ecc", "Ec", "Qoh", "Qohélet", "Qo", "Ecl"],
  ["Cantique des cantiques", "Cantique", "Cant", "Ct"],
  ["Ésaïe", "Esaie", "Esaïe", "Esa", "Esaï", "Es", "És", "Is", "Isa", "Isaïe", "Isaie"],
  ["Jérémie", "Jeremie", "Jér", "Jer", "Jr", "Jerm"],
  ["Lamentations", "Lam", "Lm"],
  ["Ézéchiel", "Ezechiel", "Ézéch", "Ezech", "Ez", "Éz", "Ezékiel", "Eze", "Ezé", "Ézé"],
  ["Daniel", "Dan", "Dn"],
  ["Osée", "Osee", "Os", "Osé", "Hos"],
  ["Joël", "Joel", "Jl", "Joe"],
  ["Amos", "Am"],
  ["Abdias", "Abd", "Ab"],
  ["Jonas", "Jon", "Jna"],
  ["Michée", "Michee", "Mich", "Mic", "Mi"],
  ["Nahum", "Nah", "Na"],
  ["Habacuc", "Hab", "Ha", "Hb", "Habakuk"],
  ["Sophonie", "Soph", "Sph", "So"],
  ["Aggée", "Aggee", "Agg", "Ag"],
  ["Zacharie", "Zach", "Zac", "Za"],
  ["Malachie", "Mal", "Ml"],
  // New Testament
  ["Matthieu", "Matth", "Math", "Matt", "Mt", "Mathieu", "Mat"],
  ["Marc", "Mc", "Mr"],
  ["Luc", "Lc", "Lu"],
  ["Jean", "Jn", "Je"],
  ["Actes", "Actes des Apôtres", "Act", "Ac", "Actes des apotres", "Acte"],
  ["Romains", "Romain", "Rom", "Rm", "Ro"],
  ["1 Corinthiens", "1 Corinthien", "1 Cor", "1Cor", "1Co", "1C", "I Corinthiens", "I Corinthien", "I Cor", "1corinth"],
  ["2 Corinthiens", "2 Corinthien", "2 Cor", "2Cor", "2Co", "2C", "II Corinthiens", "II Corinthien", "II Cor"],
  ["Galates", "Galate", "Gal", "Ga"],
  ["Éphésiens", "Ephesiens", "Ephesien", "Éphésien", "Eph", "Éph", "Ep"],
  ["Philippiens", "Phil", "Phi", "Phl", "Php", "Ph"],
  ["Colossiens", "Col", "Co", "Colossien", "Colos"],
  ["1 Thessaloniciens", "1 Thes", "1Thes", "1 Th", "1Th", "I Thessaloniciens", "I Thes", "1 Thessalonique", "1 Thess", "1Thess"],
  ["2 Thessaloniciens", "2 Thes", "2Thes", "2 Th", "2Th", "II Thessaloniciens", "II Thes", "2 Thessalonic", "2 Thess", "2Thess"],
  ["1 Timothée", "1 Tim", "1Tim", "1Ti", "1T", "I Timothée", "I Tim"],
  ["2 Timothée", "2 Tim", "2Tim", "2Ti", "2T", "II Timothée", "II Tim", "2 Thim"],
  ["Tite", "Tt", "Tit", "Ti"],
  ["Philémon", "Philemon", "Phm", "Phlm", "Phlmn"],
  ["Hébreux", "Hebreux", "Hebreu", "Hébreu", "Héb", "Heb", "He", "Hébr", "Hebr"],
  ["Jacques", "Jac", "Jacq", "Jc", "Jq", "Jaques", "Jaq"],
  ["1 Pierre", "1 P", "1P", "1Pi", "1Pe", "I Pierre", "I P", "1 Pier", "1Pier", "1 Pie", "1 Pi"],
  ["2 Pierre", "2 P", "2P", "2Pi", "2Pe", "II Pierre", "II P", "2 Pier", "2Pier", "2 Pie"],
  ["1 Jean", "1 Jn", "1Jn", "1J", "I Jean", "1 Jeans"],
  ["2 Jean", "2 Jn", "2Jn", "2J", "II Jean"],
  ["3 Jean", "3 Jn", "3Jn", "3J", "III Jean"],
  ["Jude", "Jd"],
  ["Apocalypse", "Apocal", "Apoc", "Apo", "Ap"],
];

// ─── English (KJV names) ─────────────────────────────────────────────────────
// Includes the abbreviations seen in transcribed sermons.
export const BOOKS_EN = [
  // Old Testament
  ["Genesis", "Gen", "Gn", "Ge"],
  ["Exodus", "Exo", "Ex", "Exod"],
  ["Leviticus", "Lev", "Lv", "Levit"],
  ["Numbers", "Num", "Nm", "Nb", "Nu"],
  ["Deuteronomy", "Deut", "Dt", "De"],
  ["Joshua", "Josh", "Jos", "Js", "Jsh"],
  ["Judges", "Judg", "Jdg", "Jg", "Jgs"],
  ["Ruth", "Rt", "Ru"],
  ["1 Samuel", "1 Sam", "1Sam", "1S", "1Sm", "I Samuel", "I Sam", "First Samuel"],
  ["2 Samuel", "2 Sam", "2Sam", "2S", "2Sm", "II Samuel", "II Sam", "Second Samuel"],
  ["1 Kings", "1 Kgs", "1Kgs", "1K", "1Ki", "I Kings", "I Kgs", "First Kings"],
  ["2 Kings", "2 Kgs", "2Kgs", "2K", "2Ki", "II Kings", "II Kgs", "Second Kings"],
  ["1 Chronicles", "1 Chr", "1Chr", "1Ch", "I Chronicles", "I Chr", "First Chronicles"],
  ["2 Chronicles", "2 Chr", "2Chr", "2Ch", "II Chronicles", "II Chr", "Second Chronicles"],
  ["Ezra", "Ezr"],
  ["Nehemiah", "Neh", "Ne"],
  ["Esther", "Est", "Esth"],
  ["Job", "Jb"],
  ["Psalms", "Psalm", "Ps", "Psa", "Pss", "Psm"],
  ["Proverbs", "Prov", "Prv", "Pr", "Pro"],
  ["Ecclesiastes", "Eccl", "Ecc", "Ec", "Qoh", "Qoheleth"],
  ["Song of Solomon", "Song of Songs", "Song", "SoS", "Cant", "Canticles"],
  // no "Is" or "Am": in the Branham text they are the verbs ("it is. 65",
  // "I am. 14", "Is 52 here?" for a prayer card), never a citation.
  ["Isaiah", "Isa"],
  ["Jeremiah", "Jer", "Jr"],
  ["Lamentations", "Lam", "Lm", "La"],
  ["Ezekiel", "Ezek", "Ez", "Eze"],
  ["Daniel", "Dan", "Dn", "Da"],
  ["Hosea", "Hos", "Ho"],
  // "Joël" is what the French pass left in these English transcripts —
  // 47 of its 48 occurrences here are real Joel citations, mostly Joel 2:28.
  ["Joel", "Joël", "Jl"],
  ["Amos"],
  ["Obadiah", "Obad", "Ob"],
  ["Jonah", "Jon", "Jnh"],
  ["Micah", "Mic", "Mi"],
  ["Nahum", "Nah", "Na"],
  ["Habakkuk", "Hab", "Hb"],
  ["Zephaniah", "Zeph", "Zep", "Zp"],
  ["Haggai", "Hag", "Hg"],
  ["Zechariah", "Zech", "Zec", "Zc"],
  ["Malachi", "Mal", "Ml"],
  // New Testament
  ["Matthew", "Saint Matthew", "St. Matthew", "St Matthew", "Matt", "Math", "Mt"],
  ["Mark", "Saint Mark", "St. Mark", "St Mark", "Mk", "Mr"],
  ["Luke", "Saint Luke", "St. Luke", "St Luke", "Lk", "Lu"],
  ["John", "Saint John", "St. John", "St John", "Jn", "Joh", "Jhn"],
  ["Acts", "Ac", "Act", "Acts of the Apostles"],
  ["Romans", "Rom", "Rm", "Ro"],
  ["1 Corinthians", "1 Cor", "1Cor", "1Co", "1C", "I Corinthians", "I Cor", "First Corinthians"],
  ["2 Corinthians", "2 Cor", "2Cor", "2Co", "2C", "II Corinthians", "II Cor", "Second Corinthians"],
  ["Galatians", "Gal", "Ga"],
  ["Ephesians", "Eph", "Ephes", "Ep"],
  ["Philippians", "Phil", "Php", "Phl", "Ph"],
  ["Colossians", "Col", "Cl"],
  ["1 Thessalonians", "1 Thess", "1Thess", "1 Thes", "1Thes", "1 Th", "1Th", "I Thessalonians", "I Thess", "First Thessalonians"],
  ["2 Thessalonians", "2 Thess", "2Thess", "2 Thes", "2Thes", "2 Th", "2Th", "II Thessalonians", "II Thess", "Second Thessalonians"],
  ["1 Timothy", "1 Tim", "1Tim", "1Ti", "1T", "I Timothy", "I Tim", "First Timothy"],
  ["2 Timothy", "2 Tim", "2Tim", "2Ti", "2T", "II Timothy", "II Tim", "Second Timothy"],
  ["Titus", "Tit", "Ti"],
  ["Philemon", "Phlm", "Phm", "Philem"],
  ["Hebrews", "Heb", "Hbr", "He"],
  ["James", "Jas", "Jm"],
  ["1 Peter", "1 Pet", "1Pet", "1 Pt", "1Pt", "1P", "1Pe", "I Peter", "I Pet", "First Peter"],
  ["2 Peter", "2 Pet", "2Pet", "2 Pt", "2Pt", "2P", "2Pe", "II Peter", "II Pet", "Second Peter"],
  ["1 John", "1 Jn", "1Jn", "1Jo", "1J", "I John", "I Jn", "First John"],
  ["2 John", "2 Jn", "2Jn", "2Jo", "2J", "II John", "II Jn", "Second John"],
  ["3 John", "3 Jn", "3Jn", "3Jo", "3J", "III John", "III Jn", "Third John"],
  ["Jude", "Jud", "Jd"],
  // no "Re": it only ever matched the "re" of "you're 28" plus a page number.
  ["Revelation", "Revelations", "Rev", "Rv", "Apoc", "Apocalypse"],
];
