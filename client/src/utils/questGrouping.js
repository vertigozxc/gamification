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

// Extract a short label for a tier chip. Priority:
//   1. explicit targetCount (+ unit) — hydration / words
//   2. first number in description (steps, minutes, pages…) with inferred unit
//   3. timeEstimateMin
//   4. effort dots fallback handled by caller
export function variantLabel(quest) {
  if (!quest) return "";
  const target = Number(quest.targetCount) || 0;
  if (target > 0) {
    const unit = String(quest.counterUnit || "").trim();
    return unit ? `${target} ${unit}` : String(target);
  }
  const desc = String(quest.desc || quest.description || "");
  const numberMatch = desc.match(/([\d]{1,3}(?:[.,\s][\d]{3})+|\d+)/);
  if (numberMatch) {
    const numberStr = numberMatch[1].replace(/\s/g, "");
    const rest = desc.slice(numberMatch.index + numberMatch[0].length).trim();
    const wordMatch = rest.match(/^[^\s.,;:!?()]+/);
    const unit = wordMatch ? wordMatch[0] : "";
    return unit ? `${numberStr} ${unit}` : numberStr;
  }
  const mins = Number(quest.timeEstimateMin) || 0;
  if (mins > 0) return `${mins} min`;
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
