const MAX_DAILY_XP = 200;

const TIER_CONFIG = {
  IRON: { min: 0, max: 40, weeksRequired: 1 },
  BRONZE: { min: 40, max: 55, weeksRequired: 1 },
  SILVER: { min: 55, max: 70, weeksRequired: 2 },
  GOLD: { min: 70, max: 80, weeksRequired: 2 },
  PLATINUM: { min: 80, max: 90, weeksRequired: 3 },
  DIAMOND: { min: 90, max: 100, weeksRequired: 5 }
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

export function disciplineFactor(tasksCompleted) {
  if (tasksCompleted >= 6) return 1.0;
  if (tasksCompleted >= 4) return 0.85;
  if (tasksCompleted >= 2) return 0.65;
  return 0.4;
}

// TS signature:
// calculateDailyScore(xpToday: number, baseTasksCompleted: number, tasksCompleted: number): number
export function calculateDailyScore(xpToday, baseTasksCompleted, tasksCompleted) {
  const safeXpToday = clamp(Number(xpToday) || 0, 0, MAX_DAILY_XP);
  const safeBaseCompleted = clamp(Number(baseTasksCompleted) || 0, 0, 4);
  const safeTasksCompleted = clamp(Number(tasksCompleted) || 0, 0, 8);

  const score =
    (safeXpToday / MAX_DAILY_XP) *
    (0.7 + 0.3 * (safeBaseCompleted / 4)) *
    disciplineFactor(safeTasksCompleted) *
    100;

  return round2(clamp(score, 0, 100));
}

// TS signature:
// calculatePI(dailyScores: number[], todayScore: number): number | null
export function calculatePI(dailyScores, todayScore) {
  const sanitized = (Array.isArray(dailyScores) ? dailyScores : [])
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));

  if (sanitized.length < 3) {
    return null;
  }

  const last3 = sanitized.slice(-3);
  const last7 = sanitized.slice(-7);

  const avg = (arr) => arr.reduce((sum, value) => sum + value, 0) / arr.length;

  const pi =
    0.6 * avg(last3) +
    0.3 * avg(last7) +
    0.1 * (Number(todayScore) || 0);

  return round2(clamp(pi, 0, 100));
}

// TS signature:
// getTier(pi: number): "IRON" | "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND"
export function getTier(pi) {
  const score = clamp(Number(pi) || 0, 0, 100);

  if (score >= TIER_CONFIG.DIAMOND.min) return "DIAMOND";
  if (score >= TIER_CONFIG.PLATINUM.min) return "PLATINUM";
  if (score >= TIER_CONFIG.GOLD.min) return "GOLD";
  if (score >= TIER_CONFIG.SILVER.min) return "SILVER";
  if (score >= TIER_CONFIG.BRONZE.min) return "BRONZE";
  return "IRON";
}

// TS signature:
// calculateRank(tier: string, weeksInTier: number): { tier: string; rankLevel: number; weeksRequired: number }
export function calculateRank(tier, weeksInTier) {
  const normalizedTier = String(tier || "IRON").toUpperCase();
  const tierConfig = TIER_CONFIG[normalizedTier] || TIER_CONFIG.IRON;
  const safeWeeks = Math.max(0, Number(weeksInTier) || 0);

  const computedRank = Math.floor(safeWeeks / tierConfig.weeksRequired);
  const rankLevel = clamp(computedRank, 1, 5);

  return {
    tier: normalizedTier,
    rankLevel,
    weeksRequired: tierConfig.weeksRequired
  };
}

export function getWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function summarizeTodayProgress(completedQuests = [], preferredQuestIds = []) {
  const pinnedSet = new Set(preferredQuestIds);
  const tasksCompleted = completedQuests.length;
  const baseTasksCompleted = completedQuests.filter((quest) => pinnedSet.has(quest.id)).length;
  const xpToday = completedQuests.reduce((sum, quest) => sum + (Number(quest.xp) || 0), 0);

  return {
    xpToday,
    tasksCompleted,
    baseTasksCompleted,
    dailyScore: calculateDailyScore(xpToday, baseTasksCompleted, tasksCompleted)
  };
}

export function normalizeTier(value) {
  const tier = String(value || "IRON").toUpperCase();
  if (Object.hasOwn(TIER_CONFIG, tier)) {
    return tier;
  }
  return "IRON";
}
