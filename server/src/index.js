import "dotenv/config";
import cors from "cors";
import express from "express";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { prisma } from "./db.js";
import { getDailyQuests, getQuestPool } from "./quests.js";
import { buildInviteCode, getDateKey, slugifyUsername, xpAfterQuest } from "./utils.js";
import {
  calculatePI,
  calculateRank,
  getTier,
  getWeekKey,
  normalizeTier,
  summarizeTodayProgress
} from "./productivity.js";
const app = express();
const port = Number(process.env.PORT || 4000);

function getAllowedOrigins() {
  const raw = process.env.CLIENT_ORIGIN || "http://localhost:5173";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const allowedOrigins = getAllowedOrigins();

app.use(cors({
  origin(origin, callback) {
    // Allow requests without Origin (same-origin tools, curl, health checks).
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  }
}));
app.use(express.json({ limit: "8mb" }));

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

const usernameBody = z.object({ username: z.string().min(2).max(64) });

function parsePreferredQuestIds(rawValue) {
  if (!rawValue) {
    return [];
  }
  return [...new Set(String(rawValue)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0))];
}

function serializePreferredQuestIds(questIds) {
  return [...new Set(questIds.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))].join(",");
}

function onboardingStatus(user) {
  const preferredQuestIds = parsePreferredQuestIds(user.preferredQuestIds);
  return {
    preferredQuestIds,
    needsOnboarding: preferredQuestIds.length < 4
  };
}

function assignDynamicXp(quests, preferredQuestIds) {
  const nonPinned = quests.filter((q) => !preferredQuestIds.includes(q.id));
  const totalBaseXp = nonPinned.reduce((sum, q) => sum + (q.baseXp || q.xp || 10), 0);
  
  const assigned = {};
  if (totalBaseXp === 0 || nonPinned.length === 0) {
    nonPinned.forEach(q => assigned[q.id] = 20);
  } else {
    let remaining = 80;
    nonPinned.forEach((q, idx) => {
      if (idx === nonPinned.length - 1) {
        assigned[q.id] = Math.max(0, remaining);
      } else {
        const share = Math.round(80 * ((q.baseXp || q.xp || 10) / totalBaseXp));
        assigned[q.id] = share;
        remaining -= share;
      }
    });
  }

  return quests.map((q) => ({
    ...q,
    xp: preferredQuestIds.includes(q.id) ? 30 : Math.max(5, assigned[q.id] || 20)
  }));
}

function dailyQuestsForUser(user, date = new Date()) {
  const preferredQuestIds = parsePreferredQuestIds(user.preferredQuestIds);
  const quests = getDailyQuests({
    date,
    username: user.username,
    resetSeed: user.lastDailyResetAt?.getTime?.() ?? 0,
    pinnedQuestIds: preferredQuestIds
  });

  return assignDynamicXp(quests, preferredQuestIds);
}

function composeDailyQuests(user, completedQuestIds = [], date = new Date(), excludeCategories = []) {
  const preferredQuestIds = parsePreferredQuestIds(user.preferredQuestIds);
  const baseQuests = getDailyQuests({
    date,
    username: user.username,
    resetSeed: user.lastDailyResetAt?.getTime?.() ?? 0,
    pinnedQuestIds: preferredQuestIds,
    excludeCategories
  });

  const totalCount = baseQuests.length;
  const questPoolById = new Map(getQuestPool().map((quest) => [quest.id, quest]));
  const selectedQuestIds = [];

  for (const questId of preferredQuestIds) {
    if (!selectedQuestIds.includes(questId)) {
      selectedQuestIds.push(questId);
    }
  }

  for (const quest of baseQuests) {
    if (selectedQuestIds.length >= totalCount) {
      break;
    }
    if (!selectedQuestIds.includes(quest.id)) {
      selectedQuestIds.push(quest.id);
    }
  }

  const resultQuests = selectedQuestIds
    .map((questId) => questPoolById.get(questId))
    .filter(Boolean);
    
  return assignDynamicXp(resultQuests, preferredQuestIds);
}

function calculateStreak(completedCount, currentStreak) {
  if (completedCount >= 4) return currentStreak + 1;
  if (completedCount === 3) return currentStreak;
  return 0;
}

function milestoneRewardForCount(completedCount) {
  if (completedCount === 8) return { bonusXp: 50, bonusTokens: 1 };
  if (completedCount === 6) return { bonusXp: 30, bonusTokens: 0 };
  if (completedCount === 4) return { bonusXp: 20, bonusTokens: 0 };
  return { bonusXp: 0, bonusTokens: 0 };
}

function applyBonusXpProgress(state, bonusXp) {
  let xp = state.xp + bonusXp;
  let level = state.level;
  let xpNext = state.xpNext;

  while (xp >= xpNext) {
    xp -= xpNext;
    level += 1;
    xpNext = Math.floor(xpNext * 1.1);
  }

  return { xp, level, xpNext };
}

function getNextWeekResetAt(date = new Date()) {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = utcDate.getUTCDay() || 7;
  const daysUntilNextMonday = 8 - dayOfWeek;
  utcDate.setUTCDate(utcDate.getUTCDate() + daysUntilNextMonday);
  utcDate.setUTCHours(0, 0, 0, 0);
  return utcDate;
}

function buildServerTimeMeta(now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);
  return {
    serverNowMs: current.getTime(),
    nextWeekResetAtMs: getNextWeekResetAt(current).getTime()
  };
}

async function computeTodayProgress(user, date = new Date()) {
  const dayKey = getDateKey(date);
  const completions = await prisma.questCompletion.findMany({
    where: { userId: user.id, dayKey },
    orderBy: { completedAt: "asc" },
    select: { questId: true }
  });

  const completionIds = completions.map((item) => item.questId);
  const preferredQuestIds = parsePreferredQuestIds(user.preferredQuestIds);
  const todaysQuests = composeDailyQuests(user, completionIds, date);
  const questById = new Map(todaysQuests.map((quest) => [quest.id, quest]));
  const completedQuests = completionIds.map((id) => questById.get(id)).filter(Boolean);
  const progress = summarizeTodayProgress(completedQuests, preferredQuestIds);

  return { dayKey, preferredQuestIds, completions, completionIds, progress };
}

async function updateAndReadProductivity(user, date = new Date(), options = {}) {
  const { updateTierState = false } = options;
  const { dayKey, progress } = await computeTodayProgress(user, date);

  await prisma.dailyScore.upsert({
    where: {
      userId_dayKey: {
        userId: user.id,
        dayKey
      }
    },
    create: {
      userId: user.id,
      dayKey,
      xpToday: progress.xpToday,
      tasksCompleted: progress.tasksCompleted,
      baseTasksCompleted: progress.baseTasksCompleted,
      score: progress.dailyScore
    },
    update: {
      xpToday: progress.xpToday,
      tasksCompleted: progress.tasksCompleted,
      baseTasksCompleted: progress.baseTasksCompleted,
      score: progress.dailyScore
    }
  });

  const historyRows = await prisma.dailyScore.findMany({
    where: { userId: user.id },
    orderBy: { dayKey: "asc" },
    take: 30,
    select: {
      dayKey: true,
      score: true,
      xpToday: true,
      tasksCompleted: true,
      baseTasksCompleted: true
    }
  });

  const scoreSeries = historyRows.map((row) => Number(row.score) || 0);
  const pi = calculatePI(scoreSeries, progress.dailyScore);

  let currentTier = normalizeTier(user.currentTier);
  let weeksInCurrentTier = Math.max(0, Number(user.weeksInCurrentTier) || 0);
  let lastTierWeekKey = user.lastTierWeekKey || "";

  if (pi !== null) {
    const nextTier = getTier(pi);
    const currentWeekKey = getWeekKey(date);

    if (nextTier !== currentTier) {
      currentTier = nextTier;
      weeksInCurrentTier = 0;
      lastTierWeekKey = currentWeekKey;
    } else if (lastTierWeekKey !== currentWeekKey) {
      weeksInCurrentTier += 1;
      lastTierWeekKey = currentWeekKey;
    }
  }

  const rank = calculateRank(currentTier, weeksInCurrentTier);
  let effectiveUser = user;

  if (updateTierState) {
    effectiveUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        currentPI: pi,
        currentTier,
        weeksInCurrentTier,
        rankLevel: rank.rankLevel,
        lastTierWeekKey
      }
    });
  }

  return {
    user: effectiveUser,
    productivity: {
      xpToday: progress.xpToday,
      tasksCompletedToday: progress.tasksCompleted,
      baseTasksCompletedToday: progress.baseTasksCompleted,
      dailyScore: progress.dailyScore,
      dailyScoreHistory: historyRows,
      currentPI: pi,
      piStatus: pi === null ? "calibrating" : "ready",
      currentTier,
      weeksInCurrentTier,
      rankLevel: rank.rankLevel,
      rankLabel: `${currentTier} ${["I", "II", "III", "IV", "V"][Math.max(1, rank.rankLevel) - 1]}`
    }
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "life-rpg-api" });
});

app.get("/api/quests", (req, res) => {
  const username = typeof req.query.username === "string" ? req.query.username : "";
  const resetSeed = Number(req.query.resetSeed) || 0;
  const dateParam = typeof req.query.date === "string" ? req.query.date : "";
  const parsedDate = dateParam ? new Date(dateParam) : new Date();
  const date = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const pinnedQuestIds = typeof req.query.pinnedQuestIds === "string"
    ? req.query.pinnedQuestIds.split(",").map((item) => Number(item.trim())).filter((item) => Number.isInteger(item) && item > 0)
    : [];

  res.json({
    quests: getDailyQuests({
      date,
      username,
      resetSeed,
      pinnedQuestIds
    })
  });
});

app.get("/api/quests/all", (_req, res) => {
  res.json({ quests: getQuestPool() });
});

app.post("/api/profiles/upsert", async (req, res) => {
  const upsertBody = z.object({
    username: z.string().min(2).max(64),
    displayName: z.string().min(1).max(64).optional(),
    photoUrl: z.string().max(2_000_000).optional(),
  });
  try {
    const parsed = upsertBody.parse(req.body);
    const username = slugifyUsername(parsed.username);
    if (!username) {
      return res.status(400).json({ error: "Invalid username" });
    }
    const displayName = (parsed.displayName || parsed.username).trim().slice(0, 64);
    const photo = parsed.photoUrl ?? "";
    const user = await prisma.user.upsert({
      where: { username },
      create: { username, displayName, photoUrl: photo },
      update: { displayName, photoUrl: photo }
    });
    res.json({ user });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.get("/api/game-state/:username", async (req, res) => {
  const username = slugifyUsername(req.params.username);
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const now = new Date();

  const dateKey = getDateKey(now);
  const completions = await prisma.questCompletion.findMany({
    where: { userId: user.id, dayKey: dateKey },
    select: { questId: true }
  });

  const todayKey = getDateKey(now);
  const streakFreezeActive = user.streakFreezeExpiresAt
    ? getDateKey(new Date(user.streakFreezeExpiresAt)) >= todayKey
    : false;
  const { preferredQuestIds, needsOnboarding } = onboardingStatus(user);
  const { productivity } = await updateAndReadProductivity(user, now, { updateTierState: false });

  res.json({
    user,
    dateKey,
    completedQuestIds: completions.map((item) => item.questId),
    streak: user.streak,
    quests: composeDailyQuests(user, completions.map((item) => item.questId)),
    streakFreezeActive,
    preferredQuestIds,
    needsOnboarding,
    allQuests: needsOnboarding ? getQuestPool() : [],
    productivity,
    ...buildServerTimeMeta(now)
  });
});

app.post("/api/onboarding/complete", async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(64),
    displayName: z.string().min(1).max(64),
    photoUrl: z.string().max(2_000_000).optional(),
    preferredQuestIds: z.array(z.number().int().min(1)).length(4)
  });

  try {
    const parsed = schema.parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const existingPreferred = parsePreferredQuestIds(user.preferredQuestIds);
    if (existingPreferred.length === 4) {
      return res.status(409).json({ error: "Preferred quests are already locked" });
    }

    const uniquePreferredQuestIds = [...new Set(parsed.preferredQuestIds)];
    if (uniquePreferredQuestIds.length !== 4) {
      return res.status(400).json({ error: "Pick exactly 4 unique preferred quests" });
    }

    const allQuestIds = new Set(getQuestPool().map((quest) => quest.id));
    const invalidQuestId = uniquePreferredQuestIds.find((id) => !allQuestIds.has(id));
    if (invalidQuestId) {
      return res.status(400).json({ error: `Invalid quest id: ${invalidQuestId}` });
    }

    const displayName = parsed.displayName.trim().slice(0, 64);
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName,
        photoUrl: parsed.photoUrl ?? user.photoUrl,
        preferredQuestIds: serializePreferredQuestIds(uniquePreferredQuestIds)
      }
    });

    const now = new Date();
    const dayKey = getDateKey(now);
    const completions = await prisma.questCompletion.findMany({
      where: { userId: user.id, dayKey },
      select: { questId: true }
    });

    const todayKey = getDateKey(now);
    const streakFreezeActive = updatedUser.streakFreezeExpiresAt
      ? getDateKey(new Date(updatedUser.streakFreezeExpiresAt)) >= todayKey
      : false;
    const { productivity } = await updateAndReadProductivity(updatedUser, now, { updateTierState: false });

    res.json({
      ok: true,
      user: updatedUser,
      completedQuestIds: completions.map((item) => item.questId),
      streak: updatedUser.streak,
      quests: composeDailyQuests(updatedUser, completions.map((item) => item.questId)),
      streakFreezeActive,
      preferredQuestIds: uniquePreferredQuestIds,
      needsOnboarding: false,
      productivity,
      ...buildServerTimeMeta(now)
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/quests/complete", async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(64),
    questId: z.number().int().min(1)
  });

  try {
    const parsed = schema.parse(req.body);
    const username = slugifyUsername(parsed.username);

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const dayKey = getDateKey(new Date());
    const todayCompletions = await prisma.questCompletion.findMany({
      where: { userId: user.id, dayKey },
      orderBy: { completedAt: "asc" },
      select: { questId: true }
    });
    const availableQuests = composeDailyQuests(user, todayCompletions.map((item) => item.questId));
    const quest = availableQuests.find((item) => item.id === parsed.questId);

    if (!quest) {
      return res.status(404).json({ error: "Quest not found" });
    }

    const existing = await prisma.questCompletion.findUnique({
      where: {
        userId_questId_dayKey: {
          userId: user.id,
          questId: quest.id,
          dayKey
        }
      }
    });

    if (existing) {
      return res.status(409).json({ error: "Quest already completed today" });
    }

    const pinnedQuestIds = parsePreferredQuestIds(user.preferredQuestIds);
    const questBaseXp = pinnedQuestIds.includes(quest.id) ? 30 : 20;
    const xpState = xpAfterQuest(user, { ...quest, xp: questBaseXp }, user.streak || 0);

    await prisma.questCompletion.create({
      data: { userId: user.id, questId: quest.id, dayKey }
    });

    const todayCompletionsCount = await prisma.questCompletion.count({
      where: { userId: user.id, dayKey }
    });

    const milestoneReward = milestoneRewardForCount(todayCompletionsCount);
    const xpStateWithMilestone = applyBonusXpProgress(xpState, milestoneReward.bonusXp);

    let tokenIncrement = milestoneReward.bonusTokens;
    
    // Level up reward logic
    if (xpStateWithMilestone.level > user.level) {
      const levelsGained = xpStateWithMilestone.level - user.level;
      for (let lvl = user.level + 1; lvl <= xpStateWithMilestone.level; lvl++) {
        if (lvl > 10) {
          tokenIncrement += 2;
        } else {
          tokenIncrement += 1;
        }
      }
    }

    const newStreak = calculateStreak(todayCompletionsCount, user.streak);
    const streakIncreased = newStreak > user.streak;
    const now = new Date();
    const todayKey = getDateKey(now);
    const lastIncreaseKey = user.lastStreakIncreaseAt ? getDateKey(user.lastStreakIncreaseAt) : null;
    const canIncreaseStreakToday = lastIncreaseKey !== todayKey;

    const updateData = {
      xp: xpStateWithMilestone.xp,
      level: xpStateWithMilestone.level,
      xpNext: xpStateWithMilestone.xpNext
    };

    if (tokenIncrement > 0) {
      updateData.tokens = { increment: tokenIncrement };
    }

    if (streakIncreased && canIncreaseStreakToday) {
      updateData.streak = newStreak;
      updateData.lastStreakIncreaseAt = now;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });

    const productivityState = await updateAndReadProductivity(updatedUser, now, { updateTierState: true });
    const finalUser = productivityState.user;

    res.json({
      ok: true,
      streak: finalUser.streak,
      awardedXp: xpState.awardedXp,
      multiplier: xpState.multiplier,
      milestoneBonusXp: milestoneReward.bonusXp,
      milestoneTokens: milestoneReward.bonusTokens,
      totalAwardedXp: xpState.awardedXp + milestoneReward.bonusXp,
      tokens: finalUser.tokens,
      productivity: productivityState.productivity,
      ...buildServerTimeMeta(now)
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/reset-daily", async (req, res) => {
  try {
    const schema = z.object({
      username: z.string().min(2).max(64),
      isReroll: z.boolean().optional(),
      excludeCategories: z.array(z.string()).optional()
    });
    const parsed = schema.parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();
    const today = getDateKey(now);
    const streakDecayData = {};

    if (!parsed.isReroll) {
      const todayCompletions = await prisma.questCompletion.count({
        where: { userId: user.id, dayKey: today }
      });
      const freezeActive = user.streakFreezeExpiresAt
        ? getDateKey(new Date(user.streakFreezeExpiresAt)) >= today
        : false;
      if (todayCompletions < 3 && !freezeActive && user.streak > 0) {
        streakDecayData.streak = 0;
      }
    }

    if (!parsed.isReroll) {
      await prisma.questCompletion.deleteMany({
        where: { userId: user.id, dayKey: today }
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastDailyResetAt: now,
        lastStreakIncreaseAt: parsed.isReroll ? user.lastStreakIncreaseAt : null,
        ...streakDecayData
      }
    });

    const completions = await prisma.questCompletion.findMany({
      where: { userId: user.id, dayKey: today },
      orderBy: { completedAt: "asc" },
      select: { questId: true }
    });
    const completedQuestIds = completions.map((item) => item.questId);

    const productivityState = await updateAndReadProductivity(updatedUser, now, { updateTierState: true });
    const finalUser = productivityState.user;

    res.json({
      ok: true,
      user: finalUser,
      quests: composeDailyQuests(finalUser, completedQuestIds, now, parsed.excludeCategories),
      completedQuestIds,
      productivity: productivityState.productivity,
      ...buildServerTimeMeta(now)
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/shop/freeze-streak", async (req, res) => {
  try {
    const parsed = usernameBody.parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const today = getDateKey(new Date());
    const alreadyFrozen = user.streakFreezeExpiresAt
      ? getDateKey(new Date(user.streakFreezeExpiresAt)) >= today
      : false;
    if (alreadyFrozen) {
      return res.status(400).json({ error: "Streak is already frozen for today" });
    }
    if (user.tokens < 3) {
      return res.status(400).json({ error: "Not enough tokens" });
    }
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { tokens: { decrement: 3 }, streakFreezeExpiresAt: tomorrow }
    });
    res.json({ ok: true, tokens: updatedUser.tokens, streakFreezeActive: true });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/shop/extra-reroll", async (req, res) => {
  try {
    const parsed = usernameBody.parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (user.tokens < 1) {
      return res.status(400).json({ error: "Not enough tokens" });
    }
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { tokens: { decrement: 1 } }
    });
    res.json({ ok: true, tokens: updatedUser.tokens });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/quests/reroll-pinned", async (req, res) => {
  try {
    const schema = z.object({
      username: z.string().min(2).max(64),
      useTokens: z.boolean().default(false)
    });
    const parsed = schema.parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const preferredList = parsePreferredQuestIds(user.preferredQuestIds);
    if (preferredList.length === 0) {
      return res.status(400).json({ error: "No pinned quests to reroll" });
    }

    const now = new Date();
    const msIn30Days = 30 * 24 * 60 * 60 * 1000;
    const isFreeAvailable = !user.lastFreeTaskRerollAt || (now.getTime() - new Date(user.lastFreeTaskRerollAt).getTime() >= msIn30Days);
    const shouldUseTokens = parsed.useTokens || !isFreeAvailable;

    if (shouldUseTokens && user.tokens < 7) {
      return res.status(400).json({ error: "Not enough tokens" });
    }
    if (!shouldUseTokens && !isFreeAvailable) {
      return res.status(400).json({ error: "Free reroll used in the last 30 days" });
    }

    const questPool = getQuestPool();
    const currentPinnedSet = new Set(preferredList);
    const usedNewIds = new Set();
    const rerolledPreferredQuestIds = preferredList.map((oldId) => {
      const oldQuest = questPool.find((quest) => quest.id === oldId);
      let candidates = questPool.filter((quest) => !currentPinnedSet.has(quest.id) && !usedNewIds.has(quest.id) && quest.category === oldQuest?.category);
      if (candidates.length === 0) {
        candidates = questPool.filter((quest) => !currentPinnedSet.has(quest.id) && !usedNewIds.has(quest.id));
      }
      if (candidates.length === 0) {
        return oldId;
      }
      const replacement = candidates[Math.floor(Math.random() * candidates.length)];
      usedNewIds.add(replacement.id);
      return replacement.id;
    });

    if (!rerolledPreferredQuestIds.some((id, index) => id !== preferredList[index])) {
      return res.status(400).json({ error: "No quests available to swap" });
    }

    const updateData = {
      preferredQuestIds: serializePreferredQuestIds(rerolledPreferredQuestIds)
    };
    if (shouldUseTokens) {
      updateData.tokens = { decrement: 7 };
    } else {
      updateData.lastFreeTaskRerollAt = now;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });

    const dayKey = getDateKey(now);
    const completions = await prisma.questCompletion.findMany({
      where: { userId: user.id, dayKey },
      select: { questId: true }
    });
    const completedQuestIds = completions.map((c) => c.questId);
    
    const resetSeed = user.lastDailyResetAt?.getTime?.() ?? 0;
    const quests = getDailyQuests({
      date: now,
      username: user.username,
      resetSeed,
      pinnedQuestIds: rerolledPreferredQuestIds
    });

    res.json({
      success: true,
      tokens: updatedUser.tokens,
      lastFreeTaskRerollAt: updatedUser.lastFreeTaskRerollAt,
      preferredQuestIds: rerolledPreferredQuestIds,
      completedQuestIds,
      quests
    });

  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: err.errors });
    }
    console.error("Reroll pinned error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


app.post("/api/quests/reroll-pinned_ORIG", async (req, res) => {
  try {
    const schema = z.object({
      username: z.string().min(2).max(64),
      questIdToReroll: z.number().int().min(1),
      useTokens: z.boolean().default(false)
    });
    const parsed = schema.parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const preferredList = parsePreferredQuestIds(user.preferredQuestIds);
    if (!preferredList.includes(parsed.questIdToReroll)) {
      return res.status(400).json({ error: "Quest is not pinned" });
    }

    const now = new Date();
    let isFree = !parsed.useTokens;

    if (isFree) {
      const msIn30Days = 30 * 24 * 60 * 60 * 1000;
      if (user.lastFreeTaskRerollAt && (now.getTime() - new Date(user.lastFreeTaskRerollAt).getTime() < msIn30Days)) {
         return res.status(400).json({ error: "Free reroll used in the last 30 days" });
      }
    } else {
      if (user.tokens < 5) {
        return res.status(400).json({ error: "Not enough tokens" });
      }
    }

    const allQuestIds = new Set(getQuestPool().map((quest) => quest.id));
    const oldQuest = getQuestById(parsed.questIdToReroll);
    
    // Generate valid replacement candidate (same category if possible, or any left)
    const available = getQuestPool().filter(q => !preferredList.includes(q.id));
    if (available.length === 0) return res.status(400).json({ error: "No quests available to swap" });
    
    let matchedCategoryQuests = available.filter(q => q.category === oldQuest?.category);
    if (matchedCategoryQuests.length === 0) matchedCategoryQuests = available;
    const newQuest = matchedCategoryQuests[Math.floor(Math.random() * matchedCategoryQuests.length)];

    const uniquePreferredQuestIds = [...new Set(preferredList.map(id => id === parsed.questIdToReroll ? newQuest.id : id))];

    const updateData = {
      preferredQuestIds: serializePreferredQuestIds(uniquePreferredQuestIds)
    };
    if (!isFree) {
      updateData.tokens = { decrement: 5 };
    } else {
      updateData.lastFreeTaskRerollAt = now;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });

    const dayKey = getDateKey(now);
    const completions = await prisma.questCompletion.findMany({
      where: { userId: user.id, dayKey },
      select: { questId: true }
    });
    const completedQuestIds = completions.map((c) => c.questId);
    
    const quests = getDailyQuests({
      date: now,
      username: user.username,
      resetSeed: 0,
      pinnedQuestIds: uniquePreferredQuestIds
    });

    res.json({
      success: true,
      tokens: updatedUser.tokens,
      lastFreeTaskRerollAt: updatedUser.lastFreeTaskRerollAt,
      preferredQuestIds: uniquePreferredQuestIds,
      completedQuestIds,
      quests
    });

  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: err.errors });
    }
    console.error("Reroll pinned error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


app.post("/api/quests/reroll-pinned_LEGACY", async (req, res) => {
  try {
    const schema = z.object({
      username: z.string().min(2).max(64),
      questIdToReroll: z.number().int().min(1),
      useTokens: z.boolean().default(false)
    });
    const parsed = schema.parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const preferredList = parsePreferredQuestIds(user.preferredQuestIds);
    if (!preferredList.includes(parsed.questIdToReroll)) {
      return res.status(400).json({ error: "Quest is not pinned" });
    }

    const now = new Date();
    let isFree = !parsed.useTokens;

    if (isFree) {
      const msIn30Days = 30 * 24 * 60 * 60 * 1000;
      if (user.lastFreeTaskRerollAt && (now.getTime() - new Date(user.lastFreeTaskRerollAt).getTime() < msIn30Days)) {
         return res.status(400).json({ error: "Free reroll used in the last 30 days" });
      }
    } else {
      if (user.tokens < 5) {
        return res.status(400).json({ error: "Not enough tokens" });
      }
    }

    const allQuestIds = new Set(getQuestPool().map((quest) => quest.id));
    const oldQuest = getQuestPool().find((q) => q.id === parsed.questIdToReroll);
    
    // Generate valid replacement candidate (same category if possible, or any left)
    const available = getQuestPool().filter(q => !preferredList.includes(q.id));
    if (available.length === 0) return res.status(400).json({ error: "No quests available to swap" });
    
    let matchedCategoryQuests = available.filter(q => q.category === oldQuest?.category);
    if (matchedCategoryQuests.length === 0) matchedCategoryQuests = available;
    const newQuest = matchedCategoryQuests[Math.floor(Math.random() * matchedCategoryQuests.length)];

    const uniquePreferredQuestIds = [...new Set(preferredList.map(id => id === parsed.questIdToReroll ? newQuest.id : id))];

    const updateData = {
      preferredQuestIds: serializePreferredQuestIds(uniquePreferredQuestIds)
    };
    if (!isFree) {
      updateData.tokens = { decrement: 5 };
    } else {
      updateData.lastFreeTaskRerollAt = now;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });

    const dayKey = getDateKey(now);
    const completions = await prisma.questCompletion.findMany({
      where: { userId: user.id, dayKey },
      select: { questId: true }
    });
    const completedQuestIds = completions.map((c) => c.questId);
    
    const resetSeed = user.lastDailyResetAt?.getTime?.() ?? 0;
    const quests = getDailyQuests({
      date: now,
      username: user.username,
      resetSeed,
      pinnedQuestIds: uniquePreferredQuestIds
    });

    res.json({
      success: true,
      tokens: updatedUser.tokens,
      lastFreeTaskRerollAt: updatedUser.lastFreeTaskRerollAt,
      preferredQuestIds: uniquePreferredQuestIds,
      completedQuestIds,
      quests
    });

  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: err.errors });
    }
    console.error("Reroll pinned error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


app.post("/api/shop/replace-pinned-quests", async (req, res) => {
  try {
    const schema = z.object({
      username: z.string().min(2).max(64),
      preferredQuestIds: z.array(z.number().int().min(1)).min(1).max(4),
      useTokens: z.boolean().default(true)
    });
    const parsed = schema.parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();
    const msIn30Days = 30 * 24 * 60 * 60 * 1000;
    const isFreeAvailable = !user.lastFreeTaskRerollAt || (now.getTime() - new Date(user.lastFreeTaskRerollAt).getTime() >= msIn30Days);
    // If free monthly reroll is available, always use it regardless of client flag.
    const shouldUseTokens = !isFreeAvailable;

    if (shouldUseTokens && user.tokens < 7) {
      return res.status(400).json({ error: "Not enough tokens" });
    }

    const uniquePreferredQuestIds = [...new Set(parsed.preferredQuestIds)];
    if (uniquePreferredQuestIds.length !== parsed.preferredQuestIds.length) {
      return res.status(400).json({ error: "Preferred quests must be different" });
    }

    const allQuestIds = new Set(getQuestPool().map((quest) => quest.id));
    const invalidQuestId = uniquePreferredQuestIds.find((id) => !allQuestIds.has(id));
    if (invalidQuestId) {
      return res.status(400).json({ error: `Invalid quest id: ${invalidQuestId}` });
    }

    const updateData = {
      preferredQuestIds: serializePreferredQuestIds(uniquePreferredQuestIds)
    };
    if (shouldUseTokens) {
      updateData.tokens = { decrement: 7 };
    } else {
      updateData.lastFreeTaskRerollAt = now;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });

    const dayKey = getDateKey(new Date());
    const completions = await prisma.questCompletion.findMany({
      where: { userId: user.id, dayKey },
      select: { questId: true }
    });

    res.json({
      ok: true,
      tokens: updatedUser.tokens,
      lastFreeTaskRerollAt: updatedUser.lastFreeTaskRerollAt,
      preferredQuestIds: uniquePreferredQuestIds,
      quests: composeDailyQuests(updatedUser, completions.map((item) => item.questId)),
      completedQuestIds: completions.map((item) => item.questId)
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/reset-hard", async (req, res) => {
  try {
    const parsed = usernameBody.parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();

    await prisma.questCompletion.deleteMany({
      where: { userId: user.id }
    });

    await prisma.dailyScore.deleteMany({
      where: { userId: user.id }
    });

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        level: 1,
        xp: 0,
        xpNext: 300,
        streak: 0,
        tokens: 0,
        currentPI: null,
        currentTier: "IRON",
        weeksInCurrentTier: 0,
        rankLevel: 1,
        lastTierWeekKey: "",
        lastStreakIncreaseAt: null,
        streakFreezeExpiresAt: null,
        lastDailyResetAt: now
      }
    });

    res.json({
      ok: true,
      user: updatedUser,
      completedQuestIds: [],
      quests: dailyQuestsForUser(updatedUser, now),
      preferredQuestIds: parsePreferredQuestIds(updatedUser.preferredQuestIds),
      ...buildServerTimeMeta(now)
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/invites/create", async (req, res) => {
  const schema = z.object({ inviterUsername: z.string().min(2).max(24) });

  try {
    const parsed = schema.parse(req.body);
    const inviterUsername = slugifyUsername(parsed.inviterUsername);
    const inviter = await prisma.user.findUnique({ where: { username: inviterUsername } });

    if (!inviter) {
      return res.status(404).json({ error: "Inviter not found" });
    }

    let code = buildInviteCode();
    for (let i = 0; i < 5; i += 1) {
      const exists = await prisma.invite.findUnique({ where: { code } });
      if (!exists) break;
      code = buildInviteCode();
    }

    const invite = await prisma.invite.create({
      data: { code, inviterId: inviter.id }
    });

    res.json({
      inviteCode: invite.code,
      inviteLink: `${process.env.CLIENT_ORIGIN || "http://localhost:5173"}/?invite=${invite.code}`
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/invites/accept", async (req, res) => {
  const schema = z.object({
    code: z.string().min(4).max(20),
    invitedUsername: z.string().min(2).max(24)
  });

  try {
    const parsed = schema.parse(req.body);
    const invitedUsername = slugifyUsername(parsed.invitedUsername);
    const invite = await prisma.invite.findUnique({ where: { code: parsed.code.toUpperCase() } });

    if (!invite || invite.status !== "PENDING") {
      return res.status(404).json({ error: "Invite is invalid or expired" });
    }

    const inviter = await prisma.user.findUnique({ where: { id: invite.inviterId } });
    const invited = await prisma.user.findUnique({ where: { username: invitedUsername } });

    if (!inviter || !invited) {
      return res.status(404).json({ error: "Inviter or invited user not found" });
    }
    if (inviter.id === invited.id) {
      return res.status(400).json({ error: "You cannot accept your own invite" });
    }

    const [aId, bId] = [inviter.id, invited.id].sort();

    await prisma.$transaction([
      prisma.invite.update({
        where: { id: invite.id },
        data: {
          status: "ACCEPTED",
          invitedUserId: invited.id,
          acceptedAt: new Date()
        }
      }),
      prisma.friendship.upsert({
        where: { userAId_userBId: { userAId: aId, userBId: bId } },
        create: { userAId: aId, userBId: bId },
        update: {}
      })
    ]);

    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.get("/api/friends/:username", async (req, res) => {
  const username = slugifyUsername(req.params.username);
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const links = await prisma.friendship.findMany({
    where: {
      OR: [{ userAId: user.id }, { userBId: user.id }]
    },
    include: {
      userA: true,
      userB: true
    }
  });

  const friends = links.map((link) => {
    const friend = link.userAId === user.id ? link.userB : link.userA;
    return {
      username: friend.username,
      displayName: friend.displayName,
      level: friend.level,
      xp: friend.xp,
      xpNext: friend.xpNext
    };
  });

  res.json({ friends });
});

app.post("/api/sync-state", async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(64),
    level: z.number().int().min(1),
    xp: z.number().int().min(0),
    xpNext: z.number().int().min(1),
  });
  try {
    const parsed = schema.parse(req.body);
    const username = slugifyUsername(parsed.username);
    if (!username) return res.status(400).json({ error: "Invalid username" });
    await prisma.user.update({
      where: { username },
      data: { level: parsed.level, xp: parsed.xp, xpNext: parsed.xpNext },
    });
    res.json({ ok: true });
  } catch {
    // user may not exist yet; silently succeed
    res.json({ ok: false });
  }
});

app.get("/api/leaderboard", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        username: true,
        displayName: true,
        photoUrl: true,
        level: true,
        xp: true,
        xpNext: true,
        streak: true,
        createdAt: true,
      },
      orderBy: [{ level: "desc" }, { xp: "desc" }],
      take: 100,
    });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

app.post("/api/quest-feedback", async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(64),
    questId: z.union([z.string().min(1), z.number().int().positive()]).transform((value) => String(value)),
    rating: z.number().int().min(0).max(10),
    textNotes: z.string().trim().max(1000).optional().nullable(),
    questionType: z.string().trim().min(1).max(200).default("How useful was this task?")
  });

  try {
    const parsed = schema.parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const feedback = await prisma.questFeedback.create({
      data: {
        userId: user.id,
        questId: parsed.questId,
        rating: parsed.rating,
        textNotes: parsed.textNotes || null,
        questionType: parsed.questionType || "How useful was this task?"
      }
    });

    res.json({ ok: true, feedback });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.get("/api/analytics/feedback", async (_req, res) => {
  try {
    const questPool = getQuestPool();
    const feedbacksRaw = await prisma.questFeedback.findMany({
      orderBy: { createdAt: "desc" },
      take: 100
    });

    const userIds = [...new Set(feedbacksRaw.map((f) => f.userId))];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, displayName: true, username: true }
        })
      : [];

    const userMap = new Map(users.map((u) => [u.id, u]));
    const feedbacks = feedbacksRaw.map((f) => ({
      ...f,
      user: userMap.get(f.userId) || null
    }));

    const stats = await prisma.questFeedback.groupBy({
      by: ["questId", "questionType"],
      _avg: { rating: true },
      _count: { rating: true }
    });

    const questStats = await prisma.questFeedback.groupBy({
      by: ["questId"],
      _avg: { rating: true },
      _count: { rating: true }
    });

    const questStatMap = new Map(questStats.map((entry) => [String(entry.questId), entry]));
    const questRatings = questPool.map((quest) => {
      const questId = String(quest.id);
      const stat = questStatMap.get(questId);
      return {
        questId,
        questTitle: quest.title,
        questDescription: quest.description || "",
        avgRating: typeof stat?._avg?.rating === "number" ? stat._avg.rating : null,
        ratingCount: stat?._count?.rating || 0
      };
    });

    res.json({ feedbacks, stats, questRatings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  app.listen(port, () => {
    console.log(`Life RPG API running on http://localhost:${port}`);
  });
}

export default app;

