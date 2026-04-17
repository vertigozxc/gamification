import "dotenv/config";
import cors from "cors";
import express from "express";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "./db.js";
import {
  getDailyQuests,
  getDailyQuestCount,
  getMilestoneRewardForCount as getConfiguredMilestoneRewardForCount,
  getPreferredQuestCount,
  getQuestPool,
  getRandomQuestCount,
  getStreakRuleConfig,
  normalizeQuestLanguage
} from "./quests.js";
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
  const raw = process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isAllowedLanOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/i.test(String(origin || ""));
}

const allowedOrigins = getAllowedOrigins();

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin) || isAllowedLanOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  }
}));
app.use(express.json({ limit: "8mb" }));

// In-memory store for mobile auth tokens (maps token -> user data)
const mobileAuthTokens = new Map();

// Store auth result from external browser login
app.post("/api/auth/mobile-token", (req, res) => {
  const { uid, displayName, email, photoURL, bridgeId } = req.body || {};
  if (!uid || typeof uid !== "string") {
    return res.status(400).json({ error: "uid is required" });
  }
  const key = (typeof bridgeId === "string" && bridgeId.trim())
    ? `bridge:${bridgeId.trim()}`
    : (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36));
  mobileAuthTokens.set(key, {
    uid: String(uid),
    displayName: String(displayName || "Adventurer"),
    email: String(email || ""),
    photoURL: String(photoURL || ""),
    createdAt: Date.now()
  });
  // Clean up old tokens (older than 5 min)
  for (const [k, v] of mobileAuthTokens) {
    if (Date.now() - v.createdAt > 300000) mobileAuthTokens.delete(k);
  }
  res.json({ token: key, bridgeId: bridgeId || null });
});

// Retrieve auth from token
app.get("/api/auth/mobile-token/:token", (req, res) => {
  const data = mobileAuthTokens.get(req.params.token);
  if (!data) {
    return res.status(404).json({ error: "Token not found or expired" });
  }
  mobileAuthTokens.delete(req.params.token); // one-time use
  res.json({ user: data });
});

// Retrieve auth by shared bridge id between WebView and external browser
app.get("/api/auth/mobile-bridge/:bridgeId", (req, res) => {
  const bridgeId = String(req.params.bridgeId || "").trim();
  if (!bridgeId) {
    return res.status(400).json({ error: "bridgeId is required" });
  }

  const key = `bridge:${bridgeId}`;
  const data = mobileAuthTokens.get(key);
  if (!data) {
    return res.status(404).json({ error: "Bridge auth not found or expired" });
  }

  mobileAuthTokens.delete(key); // one-time use
  res.json({ user: data });
});

// Check if bridge auth exists without consuming it (used by RN polling)
app.get("/api/auth/mobile-bridge-check/:bridgeId", (req, res) => {
  const bridgeId = String(req.params.bridgeId || "").trim();
  if (!bridgeId) {
    return res.status(400).json({ exists: false });
  }
  const key = `bridge:${bridgeId}`;
  const exists = mobileAuthTokens.has(key);
  res.json({ exists });
});

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "381152713640-o1cnhofvud2lna05gbor9o5cnplfm2e1.apps.googleusercontent.com";

// Direct Google OAuth — 302 straight to accounts.google.com (no intermediate page)
// ASWebAuthenticationSession shows "wants to use accounts.google.com to sign in"
app.get("/api/auth/google-start", (req, res) => {
  const bridgeId = String(req.query.bridgeId || "").trim();
  const returnScheme = String(req.query.returnScheme || "com.liferpg.mobile").trim();
  // Google allows localhost redirect URIs (not private IPs). On iOS simulator localhost = Mac.
  const redirectUri = `http://localhost:${port}/api/auth/google-callback`;
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const state = JSON.stringify({ bridgeId, returnScheme });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "id_token",
    scope: "openid email profile",
    nonce,
    state,
    prompt: "select_account"
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// Google OAuth callback — tiny HTML page that reads id_token from URL fragment,
// extracts user info, stores in bridge, and redirects to deep link
app.get("/api/auth/google-callback", (req, res) => {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Completing sign-in...</title>
<style>body{margin:0;background:#020617;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#94a3b8}
.spinner{width:32px;height:32px;border:3px solid #334155;border-top-color:#22d3ee;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}</style>
</head><body>
<div style="text-align:center"><div class="spinner" style="margin:0 auto 16px"></div><div id="msg">Completing sign-in...</div></div>
<script>
(function(){
  function decodeJwt(token) {
    var parts = token.split(".");
    if (parts.length !== 3) return null;
    var payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (payload.length % 4) payload += "=";
    try { return JSON.parse(atob(payload)); } catch(e) { return null; }
  }

  var hash = window.location.hash.substring(1);
  var params = {};
  hash.split("&").forEach(function(part) {
    var kv = part.split("=");
    if (kv.length === 2) params[kv[0]] = decodeURIComponent(kv[1]);
  });

  var idToken = params.id_token;
  var stateRaw = params.state;
  var state = {};
  try { state = JSON.parse(stateRaw); } catch(e) {}

  var bridgeId = state.bridgeId || "";
  var returnScheme = state.returnScheme || "com.liferpg.mobile";
  var serverOrigin = location.origin;

  if (!idToken) {
    document.getElementById("msg").textContent = "Auth failed — no token received";
    return;
  }

  var user = decodeJwt(idToken);
  if (!user || !user.sub) {
    document.getElementById("msg").textContent = "Auth failed — invalid token";
    return;
  }

  fetch(serverOrigin + "/api/auth/mobile-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uid: user.sub,
      displayName: user.name || user.email || "Adventurer",
      email: user.email || "",
      photoURL: user.picture || "",
      bridgeId: bridgeId
    })
  }).then(function() {
    location.replace(serverOrigin + "/api/auth/mobile-complete?bridgeId=" + encodeURIComponent(bridgeId) + "&scheme=" + encodeURIComponent(returnScheme));
  }).catch(function() {
    location.replace(serverOrigin + "/api/auth/mobile-complete?bridgeId=" + encodeURIComponent(bridgeId) + "&scheme=" + encodeURIComponent(returnScheme));
  });
})();
</script>
</body></html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

// Server-side redirect to deep link (HTTP 302 — reliably intercepted by ASWebAuthenticationSession)
app.get("/api/auth/mobile-complete", (req, res) => {
  const bridgeId = String(req.query.bridgeId || "").trim();
  const scheme = String(req.query.scheme || "com.liferpg.mobile").trim();
  if (!bridgeId) {
    return res.status(400).send("Missing bridgeId");
  }
  const target = `${scheme}://auth-complete?bridgeId=${encodeURIComponent(bridgeId)}`;
  res.redirect(target);
});

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

const usernameBody = z.object({ username: z.string().min(2).max(64) });

function getRequestLanguage(req) {
  const candidates = [
    req.query?.lang,
    req.query?.language,
    req.body?.lang,
    req.body?.language,
    req.headers["x-language"],
    req.headers["accept-language"]
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return normalizeQuestLanguage(candidate);
    }
    if (Array.isArray(candidate) && typeof candidate[0] === "string" && candidate[0].trim()) {
      return normalizeQuestLanguage(candidate[0]);
    }
  }

  return "en";
}

function parsePreferredQuestIds(rawValue) {
  if (!rawValue) {
    return [];
  }
  const validQuestIds = new Set(getQuestPool().map((quest) => quest.id));
  return [...new Set(String(rawValue)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0 && validQuestIds.has(item)))].slice(0, getPreferredQuestCount());
}

function serializePreferredQuestIds(questIds) {
  return [...new Set(questIds.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))].join(",");
}

function onboardingStatus(user) {
  const preferredQuestIds = parsePreferredQuestIds(user.preferredQuestIds).slice(0, getPreferredQuestCount());
  return {
    preferredQuestIds,
    needsOnboarding: preferredQuestIds.length < getPreferredQuestCount()
  };
}

function assignDynamicXp(quests, preferredQuestIds) {
  return quests;
}

function normalizeCategory(value) {
  return String(value || "").trim().toUpperCase();
}

function hasUniqueCategories(quests) {
  const categories = quests.map((quest) => normalizeCategory(quest?.category));
  return new Set(categories).size === categories.length;
}

function sumEffort(quests) {
  return quests.reduce((sum, quest) => sum + (Number(quest?.effortScore) || 0), 0);
}

function isValidRandomQuestSet(randomQuests, expectedCount) {
  if (!Array.isArray(randomQuests)) {
    return false;
  }

  if (randomQuests.length !== expectedCount) {
    return false;
  }

  if (!hasUniqueCategories(randomQuests)) {
    return false;
  }

  if (expectedCount === 3 && sumEffort(randomQuests) !== 9) {
    return false;
  }

  return true;
}

function dailyQuestsForUser(user, date = new Date(), language = "en") {
  const preferredQuestIds = parsePreferredQuestIds(user.preferredQuestIds);
  const quests = getDailyQuests({
    date,
    username: user.username,
    resetSeed: user.lastDailyResetAt?.getTime?.() ?? 0,
    pinnedQuestIds: preferredQuestIds,
    streak: user.streak || 0,
    language
  });

  return assignDynamicXp(quests, preferredQuestIds);
}

function composeDailyQuests(user, completedQuestIds = [], date = new Date(), excludeCategories = [], language = "en") {
  const preferredQuestIds = parsePreferredQuestIds(user.preferredQuestIds);
  let baseQuests = getDailyQuests({
    date,
    username: user.username,
    resetSeed: user.lastDailyResetAt?.getTime?.() ?? 0,
    pinnedQuestIds: preferredQuestIds,
    excludeCategories,
    streak: user.streak || 0,
    language
  });

  const totalCount = baseQuests.length;
  const expectedRandomCount = Math.max(0, Math.min(getRandomQuestCount(), totalCount - preferredQuestIds.length));
  const questPoolById = new Map(getQuestPool({ language }).map((quest) => [quest.id, quest]));
  const selectedQuestIds = [];
  const pinnedSet = new Set(preferredQuestIds);

  for (const questId of preferredQuestIds) {
    if (!selectedQuestIds.includes(questId)) {
      selectedQuestIds.push(questId);
    }
  }

  // If we have saved random quests, use them only when they still satisfy the random constraints.
  const savedRandomIds = user.randomQuestIds ? user.randomQuestIds.split(',').map(Number).filter(Boolean) : [];
  const savedRandomQuests = savedRandomIds
    .map((id) => questPoolById.get(id))
    .filter((quest) => Boolean(quest) && !pinnedSet.has(quest.id));

  const generatedRandomQuests = baseQuests
    .filter((quest) => !pinnedSet.has(quest.id))
    .slice(0, expectedRandomCount);

  const useSavedRandomQuests = isValidRandomQuestSet(savedRandomQuests, expectedRandomCount);
  const finalRandomQuestIds = (useSavedRandomQuests ? savedRandomQuests : generatedRandomQuests).map((quest) => quest.id);

  selectedQuestIds.push(...finalRandomQuestIds);

  const resultQuests = selectedQuestIds
    .map((questId) => questPoolById.get(questId))
    .filter(Boolean);
    
  return assignDynamicXp(resultQuests, preferredQuestIds);
}

function calculateStreak(completedCount, currentStreak) {
  const rules = getStreakRuleConfig();
  const successThreshold = Number(rules.successThresholdCompletedQuests) || 4;
  const holdThreshold = Number(rules.holdThresholdCompletedQuests) || 3;
  const resetThresholdMax = Number(rules.resetThresholdCompletedQuestsMax) || 2;

  if (completedCount >= successThreshold) return currentStreak + 1;
  if (completedCount >= holdThreshold) return currentStreak;
  if (completedCount <= resetThresholdMax) return 0;
  return currentStreak;
}

function milestoneRewardForCount(completedCount) {
  return getConfiguredMilestoneRewardForCount(completedCount);
}

function applyBonusXpProgress(state, bonusXp) {
  let xp = state.xp + bonusXp;
  let level = state.level;
  let xpNext = state.xpNext;
  
  if (level === 1 && xpNext === 300) {
    xpNext = 250;
  }

  while (xp >= xpNext) {
    xp -= xpNext;
    level += 1;
    xpNext = level === 1 ? 250 : Math.floor(xpNext * 1.1);
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

function buildRecentDayKeys(totalDays, endDate = new Date()) {
  const safeTotal = Number.isInteger(totalDays) && totalDays > 0 ? totalDays : 1;
  const keys = [];
  for (let dayOffset = 0; dayOffset < safeTotal; dayOffset += 1) {
    const date = new Date(endDate);
    date.setUTCDate(date.getUTCDate() - dayOffset);
    keys.push(getDateKey(date));
  }
  return keys;
}

function dayKeyToUtcDate(dayKey) {
  const [year, month, day] = String(dayKey).split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function countConsecutiveDaysFromLatest(completedDayKeys) {
  const daySet = completedDayKeys instanceof Set ? completedDayKeys : new Set();
  if (daySet.size === 0) {
    return 0;
  }

  const sortedKeys = [...daySet].sort();
  const latestDayKey = sortedKeys[sortedKeys.length - 1];
  const cursor = dayKeyToUtcDate(latestDayKey);
  if (!cursor) {
    return 0;
  }

  let streakCount = 0;
  while (daySet.has(getDateKey(cursor))) {
    streakCount += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streakCount;
}

async function getQuestConsecutiveDaysForUser(userId, questId) {
  const completions = await prisma.questCompletion.findMany({
    where: {
      userId,
      questId
    },
    select: { dayKey: true }
  });

  const daySet = new Set(completions.map((item) => item.dayKey));
  return countConsecutiveDaysFromLatest(daySet);
}

async function getPinnedQuestProgress21d(user, preferredQuestIds, now = new Date()) {
  const pinnedIds = Array.isArray(preferredQuestIds)
    ? preferredQuestIds.filter((id) => Number.isInteger(id))
    : [];

  if (pinnedIds.length === 0) {
    return [];
  }

  const completions = await prisma.questCompletion.findMany({
    where: {
      userId: user.id,
      questId: { in: pinnedIds }
    },
    select: { questId: true, dayKey: true }
  });

  const uniqueDaysByQuestId = new Map();
  for (const completion of completions) {
    const questId = Number(completion.questId);
    if (!uniqueDaysByQuestId.has(questId)) {
      uniqueDaysByQuestId.set(questId, new Set());
    }
    uniqueDaysByQuestId.get(questId).add(completion.dayKey);
  }

  return pinnedIds.map((questId) => {
    const completedDays = uniqueDaysByQuestId.get(questId) || new Set();
    const consecutiveDays = countConsecutiveDaysFromLatest(completedDays);

    return {
      questId,
      daysCompleted: consecutiveDays,
      totalDays: 21
    };
  });
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


app.get("/api/profile-stats/:username", async (req, res) => {
  try {
    const username = req.params.username.toLowerCase().replace(/[^a-z0-9_\-]/g, "").slice(0, 24);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "Not found" });

    const totalQuestsCompleted = await prisma.questCompletion.count({ where: { userId: user.id } });

    const dailyScores = await prisma.dailyScore.findMany({
      where: { userId: user.id, tasksCompleted: { gt: 0 } },
      orderBy: { dayKey: "asc" },
      select: { dayKey: true }
    });

    let maxStreak = 0;
    let currentStreakCounter = 0;
    let prevDate = null;
    for (const score of dailyScores) {
      const [, y, m, d] = score.dayKey.match(/^(\d{4})-(\d{2})-(\d{2})$/) || [];
      if (!y) continue;
      const date = new Date(Number(y), Number(m) - 1, Number(d));
      date.setHours(0, 0, 0, 0);

      if (!prevDate) {
        currentStreakCounter = 1;
      } else {
        const diff = Math.round((date - prevDate) / (1000 * 60 * 60 * 24));
        if (diff === 1) {
          currentStreakCounter++;
        } else if (diff > 1) {
          currentStreakCounter = 1;
        }
      }
      prevDate = date;
      if (currentStreakCounter > maxStreak) {
        maxStreak = currentStreakCounter;
      }
    }

    const allComps = await prisma.questCompletion.findMany({
      where: { userId: user.id },
      orderBy: { dayKey: "asc" },
      select: { questId: true, dayKey: true }
    });

    const questGroups = {};
    for (const c of allComps) {
      if (!questGroups[c.questId]) questGroups[c.questId] = [];
      questGroups[c.questId].push(c.dayKey);
    }

    let builtHabits = 0;
    for (const qId of Object.keys(questGroups)) {
      const dates = questGroups[qId];
      let subStreak = 0;
      let qPrev = null;
      let qMax = 0;
      for (const dStr of dates) {
        const [, y, m, d] = dStr.match(/^(\d{4})-(\d{2})-(\d{2})$/) || [];
        if (!y) continue;
        const dt = new Date(Number(y), Number(m) - 1, Number(d));
        dt.setHours(0, 0, 0, 0);

        if (!qPrev) {
          subStreak = 1;
        } else {
          const diff = Math.round((dt - qPrev) / (1000 * 60 * 60 * 24));
          if (diff === 1) {
            subStreak++;
          } else if (diff > 1) {
            subStreak = 1;
          }
        }
        qPrev = dt;
        if (subStreak > qMax) qMax = subStreak;
      }
      if (qMax >= 21) {
        builtHabits++;
      }
    }

    res.json({
      totalQuestsCompleted,
      maxStreak: Math.max(maxStreak, user.streak),
      builtHabits,
      joinedAt: user.createdAt
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "life-rpg-api" });
});

app.get("/api/quests", (req, res) => {
  const language = getRequestLanguage(req);
  const username = typeof req.query.username === "string" ? req.query.username : "";
  const resetSeed = Number(req.query.resetSeed) || 0;
  const streak = Number(req.query.streak) || 0;
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
      pinnedQuestIds,
      streak,
      language
    })
  });
});

app.get("/api/quests/all", (req, res) => {
  const language = getRequestLanguage(req);
  res.json({ quests: getQuestPool({ language }) });
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
  const language = getRequestLanguage(req);
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
  const pinnedQuestProgress21d = await getPinnedQuestProgress21d(user, preferredQuestIds, now);
  const { productivity } = await updateAndReadProductivity(user, now, { updateTierState: false });

  res.json({
    user,
    dateKey,
    completedQuestIds: completions.map((item) => item.questId),
    streak: user.streak,
    quests: composeDailyQuests(user, completions.map((item) => item.questId), now, [], language),
    streakFreezeActive,
    preferredQuestIds,
    pinnedQuestProgress21d,
    needsOnboarding,
    allQuests: needsOnboarding ? getQuestPool({ language }) : [],
    productivity,
    ...buildServerTimeMeta(now)
  });
});

app.post("/api/onboarding/complete", async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(64),
    displayName: z.string().min(1).max(64),
    photoUrl: z.string().max(2_000_000).optional(),
    preferredQuestIds: z.array(z.number().int().min(1)).length(getPreferredQuestCount())
  });

  try {
    const language = getRequestLanguage(req);
    const parsed = schema.parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const existingPreferred = parsePreferredQuestIds(user.preferredQuestIds);
    if (existingPreferred.length >= getPreferredQuestCount()) {
      return res.status(409).json({ error: "Preferred quests are already locked" });
    }

    const uniquePreferredQuestIds = [...new Set(parsed.preferredQuestIds)].slice(0, getPreferredQuestCount());
    if (uniquePreferredQuestIds.length !== getPreferredQuestCount()) {
      return res.status(400).json({ error: `Pick exactly ${getPreferredQuestCount()} unique preferred quests` });
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
    const pinnedQuestProgress21d = await getPinnedQuestProgress21d(updatedUser, uniquePreferredQuestIds, now);
    const { productivity } = await updateAndReadProductivity(updatedUser, now, { updateTierState: false });

    res.json({
      ok: true,
      user: updatedUser,
      completedQuestIds: completions.map((item) => item.questId),
      streak: updatedUser.streak,
      quests: composeDailyQuests(updatedUser, completions.map((item) => item.questId), now, [], language),
      streakFreezeActive,
      preferredQuestIds: uniquePreferredQuestIds,
      pinnedQuestProgress21d,
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
    const language = getRequestLanguage(req);
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
    const availableQuests = composeDailyQuests(user, todayCompletions.map((item) => item.questId), new Date(), [], language);
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
    const xpState = xpAfterQuest(user, quest, user.streak || 0);
    const previousPinnedQuestStreak = pinnedQuestIds.includes(quest.id)
      ? await getQuestConsecutiveDaysForUser(user.id, quest.id)
      : 0;

    await prisma.questCompletion.create({
      data: { userId: user.id, questId: quest.id, dayKey }
    });

    const todayCompletionsCount = await prisma.questCompletion.count({
      where: { userId: user.id, dayKey }
    });

    const milestoneReward = milestoneRewardForCount(todayCompletionsCount);
    const xpStateWithMilestone = applyBonusXpProgress(xpState, milestoneReward.bonusXp);

    let tokenIncrement = milestoneReward.bonusTokens;
    let habitMilestoneReached = false;
    let habitMilestoneTokens = 0;

    if (pinnedQuestIds.includes(quest.id)) {
      const nextPinnedQuestStreak = await getQuestConsecutiveDaysForUser(user.id, quest.id);
      if (previousPinnedQuestStreak < 21 && nextPinnedQuestStreak >= 21) {
        habitMilestoneReached = true;
        habitMilestoneTokens = 10;
        tokenIncrement += habitMilestoneTokens;
      }
    }
    
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
      habitMilestoneReached,
      habitMilestoneTokens,
      habitMilestoneQuestId: quest.id,
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
    const language = getRequestLanguage(req);
    const schema = z.object({
      username: z.string().min(2).max(64),
      isReroll: z.boolean().optional(),
      excludeCategories: z.array(z.string()).optional(),
      targetQuestId: z.number().int().optional().nullable(),
      keepQuestIds: z.array(z.number().int()).optional()
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
      const todayRows = await prisma.questCompletion.findMany({
        where: { userId: user.id, dayKey: today },
        select: { id: true, questId: true }
      });

      if (todayRows.length > 0) {
        const questIds = [...new Set(todayRows.map((row) => row.questId))];
        const existingRows = await prisma.questCompletion.findMany({
          where: {
            userId: user.id,
            questId: { in: questIds }
          },
          select: { questId: true, dayKey: true }
        });

        const usedDayKeysByQuestId = new Map();
        for (const row of existingRows) {
          const questId = Number(row.questId);
          if (!usedDayKeysByQuestId.has(questId)) {
            usedDayKeysByQuestId.set(questId, new Set());
          }
          usedDayKeysByQuestId.get(questId).add(row.dayKey);
        }

        const moveOps = [];
        for (const row of todayRows) {
          const usedDayKeys = usedDayKeysByQuestId.get(row.questId) || new Set();
          const targetDate = new Date(now);
          targetDate.setUTCDate(targetDate.getUTCDate() - 1);

          let targetDayKey = getDateKey(targetDate);
          while (usedDayKeys.has(targetDayKey)) {
            targetDate.setUTCDate(targetDate.getUTCDate() - 1);
            targetDayKey = getDateKey(targetDate);
          }

          usedDayKeys.add(targetDayKey);
          moveOps.push(prisma.questCompletion.update({
            where: { id: row.id },
            data: { dayKey: targetDayKey }
          }));
        }

        if (moveOps.length > 0) {
          await prisma.$transaction(moveOps);
        }
      }
    }

    let newRandomQuestIds = "";

    if (parsed.isReroll && parsed.targetQuestId && Array.isArray(parsed.keepQuestIds)) {
      const { preferredQuestIds: pinned } = onboardingStatus(user);
      const randomQuestCount = Math.max(0, Math.min(getRandomQuestCount(), getDailyQuestCount() - pinned.length));
      const questPool = getQuestPool({ language });
      const questById = new Map(questPool.map((quest) => [quest.id, quest]));
      const pinnedSet = new Set(pinned);
      const keepRandomIds = [...new Set(parsed.keepQuestIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0 && !pinnedSet.has(id) && id !== parsed.targetQuestId))]
        .slice(0, Math.max(0, randomQuestCount - 1));
      const keepRandomQuests = keepRandomIds.map((id) => questById.get(id)).filter(Boolean);

      const excludedCategories = new Set((parsed.excludeCategories || []).map((item) => normalizeCategory(item)));
      const usedCategories = new Set(keepRandomQuests.map((quest) => normalizeCategory(quest.category)));
      const keepEffort = sumEffort(keepRandomQuests);

      const requiredEffort = randomQuestCount === 3
        ? 9 - keepEffort
        : null;

      const candidates = questPool.filter((quest) => {
        if (pinnedSet.has(quest.id)) {
          return false;
        }
        if (quest.id === parsed.targetQuestId || keepRandomIds.includes(quest.id)) {
          return false;
        }

        const category = normalizeCategory(quest.category);
        if (excludedCategories.has(category) || usedCategories.has(category)) {
          return false;
        }

        if (requiredEffort !== null) {
          return Number(quest.effortScore) === requiredEffort;
        }

        return true;
      });

      const replacement = candidates[0] || null;
      if (!replacement) {
        return res.status(400).json({ error: "No valid reroll quest found for unique category and effort constraints" });
      }

      const finalNonPinnedIds = [...keepRandomIds, replacement.id].slice(0, randomQuestCount);
      const finalNonPinnedQuests = finalNonPinnedIds.map((id) => questById.get(id)).filter(Boolean);

      if (!isValidRandomQuestSet(finalNonPinnedQuests, randomQuestCount)) {
        return res.status(400).json({ error: "Reroll result violates random quest category/effort constraints" });
      }

      newRandomQuestIds = finalNonPinnedIds.join(",");
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastDailyResetAt: now,
        lastStreakIncreaseAt: parsed.isReroll ? user.lastStreakIncreaseAt : null,
        randomQuestIds: newRandomQuestIds, // Always replace or clear it!
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
    const { preferredQuestIds } = onboardingStatus(finalUser);
    const pinnedQuestProgress21d = await getPinnedQuestProgress21d(finalUser, preferredQuestIds, now);

    res.json({
      ok: true,
      user: finalUser,
      quests: composeDailyQuests(finalUser, completedQuestIds, now, parsed.excludeCategories, language),
      completedQuestIds,
      pinnedQuestProgress21d,
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
    const language = getRequestLanguage(req);
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
      pinnedQuestIds: rerolledPreferredQuestIds,
      language
    });

    res.json({
      success: true,
      tokens: updatedUser.tokens,
      lastFreeTaskRerollAt: updatedUser.lastFreeTaskRerollAt,
      preferredQuestIds: rerolledPreferredQuestIds,
      pinnedQuestProgress21d: await getPinnedQuestProgress21d(updatedUser, rerolledPreferredQuestIds, now),
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
    const language = getRequestLanguage(req);
    const schema = z.object({
      username: z.string().min(2).max(64),
      preferredQuestIds: z.array(z.number().int().min(1)).min(1).max(getPreferredQuestCount()),
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
      pinnedQuestProgress21d: await getPinnedQuestProgress21d(updatedUser, uniquePreferredQuestIds, now),
      quests: composeDailyQuests(updatedUser, completions.map((item) => item.questId), now, [], language),
      completedQuestIds: completions.map((item) => item.questId)
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/reset-hard", async (req, res) => {
  try {
    const language = getRequestLanguage(req);
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
        xpNext: 250,
        streak: 0,
        tokens: 0,
        randomQuestIds: "",
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
      quests: composeDailyQuests(updatedUser, [], now, [], language),
      preferredQuestIds: parsePreferredQuestIds(updatedUser.preferredQuestIds),
      pinnedQuestProgress21d: [],
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

app.post("/api/admin/reset-all-users", async (req, res) => {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return res.status(503).json({ error: "Admin endpoint is not configured (ADMIN_SECRET not set)" });
  }

  const authHeader = req.headers["authorization"] || "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  let authorized = false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(adminSecret);
    authorized = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    authorized = false;
  }
  if (!provided || !authorized) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const now = new Date();
    const [completions, scores, users] = await prisma.$transaction([
      prisma.questCompletion.deleteMany({}),
      prisma.dailyScore.deleteMany({}),
      prisma.user.updateMany({
        data: {
          preferredQuestIds: "",
          level: 1,
          xp: 0,
          xpNext: 250,
          strPoints: 0,
          intPoints: 0,
          staPoints: 0,
          streak: 0,
          tokens: 0,
          currentPI: null,
          currentTier: "IRON",
          weeksInCurrentTier: 0,
          rankLevel: 1,
          lastTierWeekKey: "",
          lastStreakIncreaseAt: null,
          streakFreezeExpiresAt: null,
          lastFreeTaskRerollAt: null,
          lastDailyResetAt: now
        }
      })
    ]);

    res.json({
      ok: true,
      usersReset: users.count,
      completionsDeleted: completions.count,
      dailyScoresDeleted: scores.count
    });
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

app.post("/api/profiles/theme", async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(64),
    theme: z.string().min(1).max(64)
  });
  try {
    const parsed = schema.parse(req.body);
    const username = slugifyUsername(parsed.username);
    if (!username) return res.status(400).json({ error: "Invalid username" });
    const user = await prisma.user.update({
      where: { username },
      data: { theme: parsed.theme },
    });
    res.json({ ok: true, theme: user.theme });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});
