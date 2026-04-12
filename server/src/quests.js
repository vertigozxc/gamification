import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLocalizedQuestText } from "./quest-localization.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const questPoolPath = path.resolve(__dirname, "..", "rpg_life_daily_quests_v2.json");

function readQuestConfig() {
  const raw = fs.readFileSync(questPoolPath, "utf8");
  return JSON.parse(raw);
}

const questConfig = readQuestConfig();
const dailyQuestCount = Number(questConfig?.design_principles?.daily_quests_per_user) || 8;
const rawQuestPool = Array.isArray(questConfig?.quests) ? questConfig.quests : [];

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
      return "str";
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
  return rawQuestPool.map((quest, index) => ({
    id: index + 1,
    sourceId: quest.id,
    title: getLocalizedQuestText(quest, "title", language) || `Quest ${index + 1}`,
    description: getLocalizedQuestText(quest, "description", language),
    xp: Number(quest.base_xp) || 10,
    category: normalizeCategory(quest.category),
    stat: mapCategoryToStat(quest.category)
  }));
}

function pickCategoryUniqueQuests(quests, count, excludeCategories = new Set()) {
  if (!Array.isArray(quests) || count <= 0) {
    return [];
  }

  const selected = [];
  const usedCategories = new Set(excludeCategories);

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
  const pinnedQuestIds = normalizeQuestIds(options.pinnedQuestIds);
  const excludeCategories = new Set(options.excludeCategories || []);
  const questPool = buildQuestPool(options.language);

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
  const totalCount = Math.min(dailyQuestCount, questPool.length);
  const randomCount = Math.max(0, totalCount - pinnedQuests.length);

  // Enforce category uniqueness only for the first 4 non-pinned slots shown to users.
  const constrainedOtherCount = Math.min(4, randomCount);
  const uniqueOtherQuests = pickCategoryUniqueQuests(randomQuests, constrainedOtherCount, excludeCategories);
  const selectedOtherIds = new Set(uniqueOtherQuests.map((quest) => quest.id));
  const remainingOtherQuests = randomQuests.filter((quest) => !selectedOtherIds.has(quest.id));
  const finalOtherQuests = [...uniqueOtherQuests, ...remainingOtherQuests].slice(0, randomCount);

  return [...pinnedQuests, ...finalOtherQuests];
}

export function getQuestById(id, options = {}) {
  return getDailyQuests(options).find((quest) => quest.id === id);
}

export function getQuestPool(options = {}) {
  return buildQuestPool(options.language);
}
