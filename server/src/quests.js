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

export function getDailyQuestCount() {
  return Number(getDesignPrinciples()?.daily_quests_per_user) || 8;
}

export function getPreferredQuestCount() {
  const preferred = Number(getDesignPrinciples()?.preferred_quests_per_user);
  if (Number.isFinite(preferred) && preferred > 0) {
    return Math.min(preferred, getDailyQuestCount());
  }
  return Math.min(3, getDailyQuestCount());
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
    category: normalizeCategory(quest.category),
    stat: mapCategoryToStat(quest.category),
    minLevel: Number(quest.min_level) || 1,
    minStr: Number(quest.min_str) || 0,
    minInt: Number(quest.min_int) || 0,
    minSta: Number(quest.min_sta) || 0,
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
    tags: Array.isArray(quest.tags) ? quest.tags : []
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
  const pinnedQuestIds = normalizeQuestIds(options.pinnedQuestIds).slice(0, getPreferredQuestCount());
  const excludeCategories = new Set(options.excludeCategories || []);
  const currentStreak = Number(options.streak) || 0;

  let questPool = buildQuestPool(options.language);
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
  const pinnedQuests = pinnedQuestIds
    .map((id) => questPool.find((quest) => quest.id === id))
    .filter(Boolean);
  const randomQuests = shuffled.filter((quest) => !pinnedSet.has(quest.id));
  const totalCount = Math.min(getDailyQuestCount(), questPool.length);
  const randomCount = Math.max(0, totalCount - pinnedQuests.length);
  const finalOtherQuests = pickTemplateQuests(randomQuests, randomCount, excludeCategories);

  return [...pinnedQuests, ...finalOtherQuests];
}

export function getQuestById(id, options = {}) {
  return getDailyQuests(options).find((quest) => quest.id === id);
}

export function getQuestPool(options = {}) {
  return buildQuestPool(options.language);
}
