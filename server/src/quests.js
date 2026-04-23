import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const questPoolPath = path.resolve(__dirname, "..", "rpg_life_daily_quests_v2.json");
const fallbackGenerationSlots = ["BODY", "MIND", "DISCIPLINE", "RECOVERY", "SOCIAL", "ADAPTIVE"];

function readQuestConfig() {
  const raw = fs.readFileSync(questPoolPath, "utf8");
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === "object" ? parsed : {};
}

export function getQuestConfig() {
  return readQuestConfig();
}

function getDesignPrinciples() {
  return getQuestConfig()?.design_principles || {};
}

// Progressive unlock tiers by level.
// Each tier defines: pinned habit slots, random daily quest slots, and
// the highest effort_score (difficulty) a user can see at this level.
// Effort 5 quests also require an active streak of 14+ regardless of level.
const LEVEL_TIERS = [
  { minLevel: 20, pinned: 4, random: 4, maxEffort: 4 },
  { minLevel: 10, pinned: 3, random: 3, maxEffort: 4 },
  { minLevel: 5,  pinned: 3, random: 3, maxEffort: 3 },
  { minLevel: 1,  pinned: 2, random: 2, maxEffort: 3 }
];

const EFFORT_5_MIN_STREAK = 14;

// Target total effort for a random-quest group. Base table is slot×3,
// streak-14+ unlocks a slightly higher budget so combinations involving
// effort-5 quests become reachable (14 → 2+5 / 4+3, etc.).
const TARGET_EFFORT_BASE = { 2: 6, 3: 9, 4: 12 };
const TARGET_EFFORT_STREAK14 = { 2: 7, 3: 11, 4: 14 };

export function getTargetEffort(slotCount = 0, streak = 0) {
  const safeCount = Math.max(0, Math.floor(Number(slotCount) || 0));
  const safeStreak = Math.max(0, Number(streak) || 0);
  const table = safeStreak >= EFFORT_5_MIN_STREAK ? TARGET_EFFORT_STREAK14 : TARGET_EFFORT_BASE;
  return Number.isFinite(table[safeCount]) ? table[safeCount] : safeCount * 3;
}

export function getQuestSlotsForLevel(level = 1, streak = 0) {
  const safeLevel = Math.max(1, Number(level) || 1);
  const safeStreak = Math.max(0, Number(streak) || 0);
  const tier = LEVEL_TIERS.find((entry) => safeLevel >= entry.minLevel) || LEVEL_TIERS[LEVEL_TIERS.length - 1];
  const maxEffort = safeStreak >= EFFORT_5_MIN_STREAK ? 5 : tier.maxEffort;

  return {
    pinned: tier.pinned,
    random: tier.random,
    dailyTotal: tier.pinned + tier.random,
    maxEffort
  };
}

export function getDailyQuestCount(level, streak) {
  if (level === undefined && streak === undefined) {
    return Number(getDesignPrinciples()?.daily_quests_per_user) || 8;
  }
  return getQuestSlotsForLevel(level, streak).dailyTotal;
}

export function getPreferredQuestCount(level, streak) {
  if (level === undefined && streak === undefined) {
    const preferred = Number(getDesignPrinciples()?.preferred_quests_per_user);
    if (Number.isFinite(preferred) && preferred > 0) {
      return Math.min(preferred, getDailyQuestCount());
    }
    return Math.min(3, getDailyQuestCount());
  }
  return getQuestSlotsForLevel(level, streak).pinned;
}

export function getRandomQuestCount(level, streak) {
  if (level === undefined && streak === undefined) {
    const configured = Number(getDesignPrinciples()?.random_quests_per_day);
    const fallback = Math.max(0, getDailyQuestCount() - getPreferredQuestCount());

    if (Number.isFinite(configured) && configured >= 0) {
      return Math.min(configured, getDailyQuestCount());
    }

    return fallback;
  }
  return getQuestSlotsForLevel(level, streak).random;
}

export function getMaxEffortForLevel(level, streak) {
  return getQuestSlotsForLevel(level, streak).maxEffort;
}

export function getStreakRuleConfig() {
  const rule = getDesignPrinciples()?.streak_rule || {};
  return {
    successThresholdCompletedQuests: Number(rule.success_threshold_completed_quests) || 4,
    holdThresholdCompletedQuests: Number(rule.hold_threshold_completed_quests) || 3,
    resetThresholdCompletedQuestsMax: Number(rule.reset_threshold_completed_quests_max) || 2
  };
}

export function getStreakXpMultiplier(streak = 0) {
  const tiers = Array.isArray(getDesignPrinciples()?.streak_xp_multiplier)
    ? getDesignPrinciples().streak_xp_multiplier
    : [];
  const currentStreak = Number(streak) || 0;

  for (const tier of tiers) {
    const min = Number(tier?.min_streak);
    const max = Number(tier?.max_streak);
    const multiplier = Number(tier?.multiplier);

    if (Number.isFinite(min) && Number.isFinite(max) && Number.isFinite(multiplier) && currentStreak >= min && currentStreak <= max) {
      return multiplier;
    }
  }

  return 1;
}

export function getMilestoneRewardForCount(completedCount = 0) {
  const milestones = Array.isArray(getDesignPrinciples()?.milestones)
    ? getDesignPrinciples().milestones
    : [];
  const target = Number(completedCount) || 0;
  const match = milestones.find((item) => Number(item?.completed_quests) === target);

  return {
    bonusXp: Number(match?.bonus_xp) || 0,
    bonusTokens: Number(match?.bonus_token) || 0
  };
}

function getGenerationSlots() {
  const slots = getDesignPrinciples()?.daily_generation_template?.slots;
  if (!Array.isArray(slots) || slots.length === 0) {
    return fallbackGenerationSlots;
  }

  return slots.map((slot) => normalizeCategory(slot));
}

function getRawQuestPool() {
  const config = getQuestConfig();
  return Array.isArray(config?.quests) ? config.quests : [];
}

export function normalizeQuestLanguage(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized.startsWith("ru") ? "ru" : "en";
}

function getLocalizedQuestText(quest, field, language) {
  const normalizedLanguage = normalizeQuestLanguage(language);

  if (normalizedLanguage === "ru") {
    const inlineRussianField = quest?.[`${field}_ru`];
    if (typeof inlineRussianField === "string" && inlineRussianField.trim()) {
      return inlineRussianField;
    }
  }

  return String(quest?.[field] || "");
}

function normalizeCategory(category) {
  const normalized = String(category || "").trim().toUpperCase();
  return normalized || "UNCATEGORIZED";
}

function mapCategoryToStat(category) {
  switch (String(category || "").toUpperCase()) {
    case "MIND":
    case "MIND_OR_DISCIPLINE":
      return "int";
    case "SOCIAL":
    case "DISCIPLINE":
      return "str";
    case "BODY":
    case "BODY_OR_RECOVERY":
    case "RECOVERY":
    case "ADAPTIVE":
    default:
      return "sta";
  }
}

function buildQuestPool(language) {
  const rawQuestPool = getRawQuestPool();

  return rawQuestPool.map((quest, index) => ({
    id: index + 1,
    sourceId: quest.id,
    title: getLocalizedQuestText(quest, "title", language) || `Quest ${index + 1}`,
    description: getLocalizedQuestText(quest, "description", language),
    xp: Number(quest.base_xp) || 10,
    baseXp: Number(quest.base_xp) || 10,
    effortScore: Number(quest.effort_score) || 1,
    timeEstimateMin: Number(quest.time_estimate_min) || 0,
    needsTimer: Boolean(quest.needs_timer),
    category: normalizeCategory(quest.category),
    stat: mapCategoryToStat(quest.category),
    minLevel: Number(quest.min_level) || 1,
    minStreak: Number(quest.min_streak) || 0,
    weight: Number(quest.weight) || 1,
    cooldownDays: Number(quest.cooldown_days) || 0,
    maxPerWeek: Number(quest.max_per_week) || 0,
    antiRepeatGroup: String(quest.anti_repeat_group || "").trim(),
    completionType: String(quest.completion_type || "manual").trim(),
    physicalLoad: Number(quest.physical_load) || 0,
    mentalLoad: Number(quest.mental_load) || 0,
    socialPressure: Number(quest.social_pressure) || 0,
    unlockType: String(quest.unlock_type || "base").trim(),
    tags: Array.isArray(quest.tags) ? quest.tags : [],
    // Quest mechanic gates which completion endpoint the client must use.
    // "timer" uses /api/quests/timer/*; "counter" uses /api/quests/counter/tick;
    // "note"/"words" use /api/quests/note/submit. "simple" falls through to
    // the direct /api/quests/complete path.
    mechanic: (() => {
      const explicit = String(quest.quest_mechanic || "").trim().toLowerCase();
      if (explicit) return explicit;
      return Boolean(quest.needs_timer) ? "timer" : "simple";
    })(),
    targetCount: Number(quest.target_count) || 0,
    counterUnit: String(quest.counter_unit || "").trim(),
    counterCooldownMin: Number(quest.counter_cooldown_min) || 0,
    counterMaxPerTick: Number(quest.counter_max_per_tick) || 0,
    minItems: Number(quest.min_items) || 0,
    noteKinds: Array.isArray(quest.note_kinds) ? quest.note_kinds : [],
    noteMinLength: Number(quest.note_min_length) || 0
  }));
}

function pickCategoryUniqueQuests(quests, count, excludeCategories = new Set()) {
  if (!Array.isArray(quests) || count <= 0) {
    return [];
  }

  const selected = [];
  const usedCategories = new Set([...excludeCategories].map((item) => normalizeCategory(item)));

  for (const quest of quests) {
    const category = normalizeCategory(quest?.category);
    if (usedCategories.has(category)) {
      continue;
    }

    selected.push(quest);
    usedCategories.add(category);
    if (selected.length >= count) {
      return selected;
    }
  }

  return selected;
}

function pickTemplateQuests(quests, count, excludeCategories = new Set()) {
  if (!Array.isArray(quests) || count <= 0) {
    return [];
  }

  const selected = [];
  const usedIds = new Set();
  const usedCategories = new Set([...excludeCategories].map((item) => normalizeCategory(item)));

  for (const slotCategory of getGenerationSlots()) {
    if (selected.length >= count) {
      break;
    }

    let candidate = null;
    if (slotCategory === "ADAPTIVE") {
      candidate = quests.find((quest) => !usedIds.has(quest.id) && !usedCategories.has(normalizeCategory(quest.category)));
    } else if (!usedCategories.has(slotCategory)) {
      candidate = quests.find((quest) => !usedIds.has(quest.id) && normalizeCategory(quest.category) === slotCategory);
    }

    if (!candidate) {
      continue;
    }

    selected.push(candidate);
    usedIds.add(candidate.id);
    usedCategories.add(normalizeCategory(candidate.category));
  }

  if (selected.length < count) {
    const uniqueFill = pickCategoryUniqueQuests(
      quests.filter((quest) => !usedIds.has(quest.id)),
      count - selected.length,
      usedCategories
    );

    for (const quest of uniqueFill) {
      if (selected.length >= count) {
        break;
      }
      selected.push(quest);
      usedIds.add(quest.id);
      usedCategories.add(normalizeCategory(quest.category));
    }
  }

  if (selected.length < count) {
    const remaining = quests.filter((quest) => !usedIds.has(quest.id)).slice(0, count - selected.length);
    selected.push(...remaining);
  }

  return selected.slice(0, count);
}

function buildEffortBalancedCategoryUniqueQuests(quests, count, targetEffort, excludeCategories = new Set(), seed = 0) {
  if (!Array.isArray(quests) || count <= 0) {
    return [];
  }

  const normalizedExclude = new Set([...excludeCategories].map((item) => normalizeCategory(item)));
  const eligible = quests.filter((quest) => !normalizedExclude.has(normalizeCategory(quest?.category)));
  const combinations = [];

  function dfs(startIndex, selected, usedCategories, effortSum) {
    if (selected.length === count) {
      if (effortSum === targetEffort) {
        combinations.push([...selected]);
      }
      return;
    }

    for (let index = startIndex; index < eligible.length; index += 1) {
      const quest = eligible[index];
      const category = normalizeCategory(quest?.category);
      const effort = Number(quest?.effortScore) || 0;

      if (usedCategories.has(category)) {
        continue;
      }

      const nextEffort = effortSum + effort;
      if (nextEffort > targetEffort) {
        continue;
      }

      selected.push(quest);
      usedCategories.add(category);
      dfs(index + 1, selected, usedCategories, nextEffort);
      selected.pop();
      usedCategories.delete(category);
    }
  }

  dfs(0, [], new Set(), 0);

  if (combinations.length === 0) {
    return [];
  }

  // Group by effort-signature ("1-4-4", "2-3-4", "3-3-3" etc) so each
  // distinct effort pattern gets an equal chance of being picked. Without
  // this step, patterns over-represented in the pool (typically 3+3+3
  // because effort-3 has the most quests across categories) would dominate
  // the output and make the daily board look monotonous.
  const groupsBySignature = new Map();
  for (const combo of combinations) {
    const sig = combo
      .map((quest) => Number(quest.effortScore) || 0)
      .sort((a, b) => a - b)
      .join("-");
    if (!groupsBySignature.has(sig)) {
      groupsBySignature.set(sig, []);
    }
    groupsBySignature.get(sig).push(combo);
  }
  const signatures = [...groupsBySignature.keys()].sort();

  let state = seed >>> 0;
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  const chosenSig = signatures[Math.floor(rand() * signatures.length)];
  const group = groupsBySignature.get(chosenSig);
  // Sort within group deterministically so the seed reproduces the pick.
  const sortedGroup = [...group].sort((left, right) => {
    const leftKey = left.map((quest) => Number(quest.id) || 0).sort((a, b) => a - b).join("-");
    const rightKey = right.map((quest) => Number(quest.id) || 0).sort((a, b) => a - b).join("-");
    return leftKey.localeCompare(rightKey);
  });
  return sortedGroup[Math.floor(rand() * sortedGroup.length)];
}

function normalizeQuestIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0))];
}

function dateSeed(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return year * 10_000 + month * 100 + day;
}

function hashString(value) {
  const str = String(value || "");
  let hash = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle(list, seed) {
  const arr = [...list];
  let state = seed >>> 0;

  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

export function getDailyQuests(options = {}) {
  const date = options.date ?? new Date();
  const username = options.username ?? "";
  const resetSeed = Number(options.resetSeed) || 0;
  const currentStreak = Number(options.streak) || 0;
  const userLevel = Number(options.level) || 1;
  const slots = getQuestSlotsForLevel(userLevel, currentStreak);
  const pinnedQuestIds = normalizeQuestIds(options.pinnedQuestIds).slice(0, slots.pinned);
  const excludeCategories = new Set(options.excludeCategories || []);
  // Quest IDs that must NOT appear in the random group — used to avoid
  // repeating yesterday's set after a daily reset or the previous set
  // after a reroll. Does not affect pinned habits (those stay visible).
  const excludeIds = new Set(
    (Array.isArray(options.excludeIds) ? options.excludeIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
  );

  let questPool = buildQuestPool(options.language);
  const effortFiltered = questPool.filter((quest) => Number(quest.effortScore) <= slots.maxEffort);
  if (effortFiltered.length > 0) {
    questPool = effortFiltered;
  }
  const streakEligibleQuests = questPool.filter((quest) => Number(quest.minStreak) <= currentStreak);
  if (streakEligibleQuests.length > 0) {
    questPool = streakEligibleQuests;
  }

  if (questPool.length === 0) {
    return [];
  }

  const baseSeed = dateSeed(date) ^ hashString(username) ^ (resetSeed >>> 0);
  const shuffled = seededShuffle(questPool, baseSeed >>> 0);
  const pinnedSet = new Set(pinnedQuestIds);
  // Pinned quests always remain visible even if their effort exceeds the current cap;
  // otherwise a user could lose a pinned habit after a streak drop below 14.
  const unfilteredPool = buildQuestPool(options.language);
  const pinnedQuests = pinnedQuestIds
    .map((id) => unfilteredPool.find((quest) => quest.id === id))
    .filter(Boolean);
  const randomCandidatesPrimary = shuffled.filter((quest) => !pinnedSet.has(quest.id) && !excludeIds.has(quest.id));
  // Fallback if excluding previous IDs leaves too few candidates to satisfy
  // the slot count — prefer filling the board over strictly avoiding repeats.
  const totalCount = Math.min(slots.dailyTotal, unfilteredPool.length);
  const randomCount = Math.max(0, Math.min(totalCount - pinnedQuests.length, slots.random));
  const randomQuests = randomCandidatesPrimary.length >= randomCount
    ? randomCandidatesPrimary
    : shuffled.filter((quest) => !pinnedSet.has(quest.id));

  let finalOtherQuests = [];
  if (randomCount > 0) {
    const targetEffort = getTargetEffort(randomCount, currentStreak);
    const combinationSeed = hashString(`${baseSeed}_combo`);
    finalOtherQuests = buildEffortBalancedCategoryUniqueQuests(
      randomQuests,
      randomCount,
      targetEffort,
      excludeCategories,
      combinationSeed
    );
  }

  if (finalOtherQuests.length < randomCount) {
    const fallbackExclude = new Set([
      ...excludeCategories,
      ...finalOtherQuests.map((quest) => normalizeCategory(quest?.category))
    ]);
    const fallback = pickTemplateQuests(
      randomQuests.filter((quest) => !finalOtherQuests.some((picked) => picked.id === quest.id)),
      randomCount - finalOtherQuests.length,
      fallbackExclude
    );
    finalOtherQuests = [...finalOtherQuests, ...fallback];
  }

  return [...pinnedQuests, ...finalOtherQuests];
}

export function getQuestById(id, options = {}) {
  return getDailyQuests(options).find((quest) => quest.id === id);
}

export function getQuestPool(options = {}) {
  return buildQuestPool(options.language);
}
