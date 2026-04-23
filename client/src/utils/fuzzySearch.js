// Lightweight "search by meaning" — intentionally NOT full semantic / AI
// embedding-based, just enough to handle the cases users actually hit:
//
//   1. Morphology: "вода" should match "воды / воду / водой" (Russian
//      declension) and "run" should match "running / runs".
//   2. Cross-language synonyms: "sport" should surface quests described
//      with "exercise", "workout", "тренировка" etc.
//
// Strategy:
//   - Normalise both sides: lowercase, strip diacritics + punctuation,
//     collapse whitespace.
//   - Stem each word with a minimal per-script stemmer (Cyrillic vs
//     Latin detected by char code).
//   - Expand query words via a hand-curated synonym map so "sport" fans
//     out into {sport, exercise, workout, спорт, тренировка, физ, …}.
//   - Match if ANY query stem is a substring of ANY target stem (or vice
//     versa) — substring handles partial input like "спо" → "спорт".

const SYNONYMS = [
  // Hydration
  ["вода", "воду", "воды", "water", "hydration", "hydrate", "drink", "sip", "glass", "стакан", "пить", "напитк", "питьё", "пьёт"],
  // Sport / exercise / physical activity
  ["sport", "exercise", "workout", "training", "cardio", "strength", "fitness", "gym", "run", "walk", "jog", "спорт", "трениров", "упражн", "зарядк", "физкультур", "физ", "бег", "ходьб", "пробежк", "зал"],
  // Sleep / rest
  ["sleep", "rest", "nap", "bed", "bedtime", "сон", "спат", "отдых", "отдохн", "постел"],
  // Meditation / calm / mindfulness
  ["meditation", "meditate", "calm", "mindful", "breath", "breathing", "медитац", "дыхан", "покой", "спокойс", "осознан"],
  // Reading / learning
  ["read", "reading", "book", "study", "learn", "learning", "чтен", "чита", "книг", "учеб", "учит", "изучен", "обучен"],
  // Language / vocabulary
  ["language", "vocabulary", "word", "translation", "english", "foreign", "язык", "слов", "перевод", "английск", "иностран", "лексик"],
  // Notes / reflection / gratitude / journaling
  ["notes", "note", "journal", "reflection", "takeaway", "gratitude", "thanks", "заметк", "записи", "дневн", "вывод", "рефлекс", "благодарн"],
  // Food / nutrition
  ["food", "meal", "eat", "nutrition", "diet", "cook", "еда", "пита", "питан", "блюд", "гото", "ест"],
  // Planning / productivity
  ["plan", "planning", "schedule", "organize", "todo", "task", "продуктивн", "план", "распис", "задач", "организ"],
  // Social / friends / family
  ["social", "friend", "family", "call", "talk", "chat", "общение", "друз", "семь", "звон", "разгов"],
  // Hygiene / self-care
  ["hygiene", "shower", "teeth", "brush", "гигиен", "душ", "зуб", "уход"],
  // Cleaning
  ["clean", "tidy", "room", "убор", "убир", "чист", "порядок"]
];

function stripDiacritics(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeTerm(str) {
  return stripDiacritics(String(str || ""))
    .toLowerCase()
    .replace(/[^a-zа-я0-9\s]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCyrillicWord(word) {
  // Rough detection — any Cyrillic letter present marks the word as RU.
  for (let i = 0; i < word.length; i += 1) {
    const code = word.charCodeAt(i);
    if (code >= 0x0400 && code <= 0x04ff) return true;
  }
  return false;
}

// Minimal Russian stemmer — strips common inflectional endings so
// "вода / воды / воду / водой / водою" all reduce to "вод".
const RU_ENDINGS = [
  "ого", "его", "ыми", "ими", "ыми", "ость", "ами", "ями", "ого", "ему", "ому",
  "ой", "ый", "ий", "ая", "яя", "ое", "ее", "ые", "ие", "ую", "юю", "ой", "ей",
  "ов", "ев", "ам", "ям", "ах", "ях", "ею", "ом", "ем", "ы", "и", "а", "я", "о", "е", "у", "ю", "й", "ь"
];

function stemRu(word) {
  let w = word;
  // Try longest ending first.
  for (const ending of RU_ENDINGS.slice().sort((a, b) => b.length - a.length)) {
    if (w.length - ending.length >= 3 && w.endsWith(ending)) {
      w = w.slice(0, -ending.length);
      break;
    }
  }
  return w;
}

const EN_ENDINGS = ["ingly", "ing", "ied", "ies", "edly", "ed", "ers", "ness", "ment", "tion", "ly", "s"];

function stemEn(word) {
  let w = word;
  for (const ending of EN_ENDINGS.slice().sort((a, b) => b.length - a.length)) {
    if (w.length - ending.length >= 3 && w.endsWith(ending)) {
      w = w.slice(0, -ending.length);
      break;
    }
  }
  return w;
}

export function stemWord(word) {
  if (!word) return "";
  return isCyrillicWord(word) ? stemRu(word) : stemEn(word);
}

function tokenize(normalized) {
  return normalized.split(/\s+/).filter(Boolean);
}

function buildSynonymIndex() {
  // Key: stem of a synonym entry. Value: array of all stems in its group.
  const index = new Map();
  for (const group of SYNONYMS) {
    const stems = group.map((term) => stemWord(normalizeTerm(term))).filter(Boolean);
    for (const stem of stems) {
      if (!index.has(stem)) index.set(stem, new Set());
      const set = index.get(stem);
      for (const other of stems) set.add(other);
    }
  }
  return index;
}

let SYNONYM_INDEX = null;
function getSynonymIndex() {
  if (!SYNONYM_INDEX) SYNONYM_INDEX = buildSynonymIndex();
  return SYNONYM_INDEX;
}

export function expandQueryStems(query) {
  const tokens = tokenize(normalizeTerm(query));
  const stems = tokens.map(stemWord).filter(Boolean);
  const expanded = new Set(stems);
  const index = getSynonymIndex();
  for (const stem of stems) {
    const bucket = index.get(stem);
    if (bucket) {
      for (const synonym of bucket) expanded.add(synonym);
    }
  }
  return [...expanded];
}

function tokenStems(text) {
  return tokenize(normalizeTerm(text)).map(stemWord).filter(Boolean);
}

// Main entrypoint. Returns true when `text` plausibly matches `query`
// in a way a user expects after typing a rough keyword.
export function fuzzyMatch(query, text) {
  if (!query || !String(query).trim()) return true;
  const queryStems = expandQueryStems(query);
  if (queryStems.length === 0) return true;
  const targetStems = tokenStems(text);
  if (targetStems.length === 0) return false;

  for (const qStem of queryStems) {
    for (const tStem of targetStems) {
      if (!qStem || !tStem) continue;
      // Substring match in either direction — handles partial inputs
      // like "спо" vs stemmed "спорт" or the reverse.
      if (tStem.includes(qStem) || qStem.includes(tStem)) {
        return true;
      }
    }
  }
  return false;
}
