// Group tier-variant quests (Step Goal 2k/4k/7k/10k/12k, Hydration 4/6/7/8/9
// glasses, Language Practice 4/6/8/10/12 words, …) into a single card that
// lets the user pick the tier via chips. Backed by either the server-set
// anti_repeat_group (surfaced on the client as sourceId hints) or, if
// absent, a normalised title. Custom quests never group.

const CATEGORY_ORDER = ["BODY", "MIND", "DISCIPLINE", "RECOVERY", "SOCIAL", "ADAPTIVE"];

function normaliseTitleKey(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCustomQuest(quest) {
  return Boolean(quest?.isCustom) || String(quest?.sourceId || "").startsWith("custom_") || Number(quest?.id) >= 1_000_000;
}

export function groupKeyFor(quest) {
  if (!quest) return "";
  if (isCustomQuest(quest)) {
    return `custom:${quest.id}`;
  }
  const antiRepeat = String(quest?.antiRepeatGroup || quest?.anti_repeat_group || "").trim();
  if (antiRepeat) return `arg:${antiRepeat}`;
  return `title:${normaliseTitleKey(quest?.title)}`;
}

export function groupQuests(quests) {
  if (!Array.isArray(quests)) return [];
  const map = new Map();
  for (const quest of quests) {
    const key = groupKeyFor(quest);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(quest);
  }
  return [...map.values()].map((variants) => {
    const sorted = [...variants].sort((a, b) => (Number(a?.effortScore) || 0) - (Number(b?.effortScore) || 0));
    return {
      key: groupKeyFor(sorted[0]),
      representative: sorted[0],
      variants: sorted
    };
  });
}

// Filler words that should NOT be used as a unit label when we extract
// the unit from a quest description. "Write 5 short notes" → we want
// "5 notes", not "5 short".
const FILLER_UNIT_WORDS = new Set([
  "short", "long", "new", "fresh", "quick",
  "at", "least", "minimum", "max", "up", "to",
  "of", "a", "an",
  "коротких", "короткий", "новых", "новый", "минимум", "максимум", "не", "менее", "более"
]);

function extractUnitFromDescription(desc) {
  const numberMatch = desc.match(/([\d]{1,3}(?:[.,\s][\d]{3})+|\d+)/);
  if (!numberMatch) return null;
  const numberStr = numberMatch[1].replace(/\s/g, "");
  const rest = desc.slice(numberMatch.index + numberMatch[0].length).trim();
  const words = rest.split(/[\s.,;:!?()/]+/).filter(Boolean);
  // Walk forward, skipping fillers, until we find something real.
  const unit = words.find((w) => !FILLER_UNIT_WORDS.has(w.toLowerCase())) || words[0] || "";
  return { number: numberStr, unit };
}

// Extract a short label for a tier chip. Mechanic-aware so "X words" and
// "X notes" come out cleanly even when the localised description dresses
// the number in adjectives (Write 5 short notes → "5 notes").
export function variantLabel(quest, t) {
  if (!quest) return "";
  const mechanic = String(quest.mechanic || "").toLowerCase();
  const words = t?.variantUnitWords || "words";
  const notes = t?.variantUnitNotes || "notes";
  const glasses = t?.variantUnitGlasses || "glasses";
  const mins = t?.variantUnitMinutes || "min";

  if (mechanic === "words") {
    const n = Number(quest.targetCount) || 0;
    if (n > 0) return `${n} ${words}`;
  }
  if (mechanic === "note") {
    const n = Number(quest.minItems) || 0;
    if (n > 0) return `${n} ${notes}`;
  }
  if (mechanic === "counter") {
    const n = Number(quest.targetCount) || 0;
    if (n > 0) {
      const unit = String(quest.counterUnit || "").trim();
      return unit ? `${n} ${unit}` : `${n} ${glasses}`;
    }
  }

  const desc = String(quest.desc || quest.description || "");
  const extracted = extractUnitFromDescription(desc);
  if (extracted) {
    const cleanUnit = extracted.unit && !FILLER_UNIT_WORDS.has(extracted.unit.toLowerCase())
      ? extracted.unit
      : "";
    return cleanUnit ? `${extracted.number} ${cleanUnit}` : extracted.number;
  }

  const minutes = Number(quest.timeEstimateMin) || 0;
  if (minutes > 0) return `${minutes} ${mins}`;
  const effort = Number(quest.effortScore) || 0;
  return effort > 0 ? `T${effort}` : "";
}

export function availableCategories(quests) {
  const set = new Set();
  for (const quest of Array.isArray(quests) ? quests : []) {
    const cat = String(quest?.category || "").trim().toUpperCase();
    if (cat) set.add(cat);
  }
  return CATEGORY_ORDER.filter((c) => set.has(c));
}

export function matchesCategory(quest, filter) {
  if (!filter || filter === "ALL") return true;
  const cat = String(quest?.category || "").trim().toUpperCase();
  return cat === String(filter).toUpperCase();
}
