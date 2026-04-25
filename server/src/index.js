import "dotenv/config";
import cors from "cors";
import express from "express";
import { fileURLToPath } from "node:url";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "./db.js";
import {
  getDailyQuests,
  getDailyQuestCount,
  getMaxEffortForLevel,
  getMilestoneRewardForCount as getConfiguredMilestoneRewardForCount,
  getPreferredQuestCount,
  getQuestPool,
  getQuestSlotsForLevel,
  getRandomQuestCount,
  getStreakRuleConfig,
  getTargetEffort,
  getEffortRange,
  normalizeQuestLanguage
} from "./quests.js";
import {
  buildInviteCode,
  getDateKey,
  slugifyUsername,
  xpAfterQuest,
  normalizeHandle,
  isValidHandleShape,
  seedHandleFromDisplayName,
  appendHandleSuffix,
  HANDLE_MIN_LENGTH,
  HANDLE_MAX_LENGTH
} from "./utils.js";
import {
  getWeekKey,
  summarizeTodayProgress
} from "./productivity.js";
import {
  ACHIEVEMENT_CODES,
  ACHIEVEMENT_REWARDS,
  evaluateAchievements,
  fetchUserAchievements
} from "./achievements.js";
import {
  evaluateStreakDecay,
  previousUtcDayKey,
  streakDecayAlreadyDoneForUtcDay
} from "./streakDecay.js";

// Fire-and-forget achievement evaluation. Never lets a failure break the
// triggering action — every caller should await this at the end of a
// handler and swallow errors.
function trackAchievements(userId) {
  if (!userId) return Promise.resolve([]);
  return evaluateAchievements(prisma, userId).catch((err) => {
    try { console.warn("[achievements] evaluation failed", err?.message); } catch {}
    return [];
  });
}
const app = express();
const port = Number(process.env.PORT || 4000);
const FREE_PINNED_REROLL_INTERVAL_MS = 21 * 24 * 60 * 60 * 1000;

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

const productionClientOriginPattern = /^https:\/\/([a-z0-9-]+\.)?life-rpg\.app$/i;

function isAllowedProductionClientOrigin(origin) {
  try {
    const parsed = new URL(String(origin || ""));
    return productionClientOriginPattern.test(`${parsed.protocol}//${parsed.hostname}`);
  } catch {
    return false;
  }
}

const allowedOrigins = getAllowedOrigins();
const oauthCallbackAllowedHosts = new Set([
  "life-rpg-api.onrender.com",
  "life-rpg-api-eu.onrender.com",
  "life-rpg-api-router.evgeny-mahnach.workers.dev",
  "api.life-rpg.app",
  "localhost",
  "127.0.0.1"
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    // Allow same-origin (this server's own host) — needed by OAuth callback HTML
    // which fetches /api/auth/mobile-token from itself.
    try {
      const u = new URL(origin);
      if (oauthCallbackAllowedHosts.has((u.hostname || "").toLowerCase())) {
        callback(null, true);
        return;
      }
    } catch (_) {}

    if (
      allowedOrigins.includes("*") ||
      allowedOrigins.includes(origin) ||
      isAllowedLanOrigin(origin) ||
      isAllowedProductionClientOrigin(origin)
    ) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  }
}));
// Limit: keep small to protect event loop. Largest legitimate payload is an
// avatar dataURL (~25–40 KB after client-side compressImage(256, 0.7)).
// 512 KB gives ~10x headroom while blocking abusive payloads.
app.use(express.json({ limit: "512kb" }));

// ============================================================================
// Observability / Analytics — event ingestion + admin panel
// ============================================================================

const ADMIN_TOKEN = String(process.env.ADMIN_TOKEN || "life-rpg-admin-dev-token");
const EVENT_INGEST_MAX_PER_MIN = 240;
const MAX_EVENT_LEN = 8000;

const eventRateLimit = new Map(); // key -> { windowStart, count }

function allowEventIngest(key) {
  const now = Date.now();
  const entry = eventRateLimit.get(key) || { windowStart: now, count: 0 };
  if (now - entry.windowStart > 60_000) {
    entry.windowStart = now;
    entry.count = 0;
  }
  entry.count += 1;
  eventRateLimit.set(key, entry);
  return entry.count <= EVENT_INGEST_MAX_PER_MIN;
}

function clipString(value, max = 2000) {
  if (value === undefined || value === null) return "";
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.length > max ? s.slice(0, max) : s;
}

function safeJsonStringify(value) {
  if (value === undefined || value === null) return "";
  try {
    const s = typeof value === "string" ? value : JSON.stringify(value);
    return s.length > MAX_EVENT_LEN ? s.slice(0, MAX_EVENT_LEN) : s;
  } catch {
    return "";
  }
}

async function recordEvent(partial = {}) {
  try {
    await prisma.event.create({
      data: {
        type: clipString(partial.type || "unknown", 120),
        level: clipString(partial.level || "info", 40),
        userId: clipString(partial.userId || "", 200),
        username: clipString(partial.username || "", 200),
        platform: clipString(partial.platform || "", 60),
        message: clipString(partial.message || "", 2000),
        stack: clipString(partial.stack || "", 4000),
        url: clipString(partial.url || "", 500),
        userAgent: clipString(partial.userAgent || "", 400),
        meta: safeJsonStringify(partial.meta)
      }
    });
  } catch (err) {
    console.error("Failed to persist event:", err?.message || err);
  }
}

function requireAdmin(req, res, next) {
  const header = String(req.headers["x-admin-token"] || "").trim();
  const query = String(req.query?.token || "").trim();
  const provided = header || query;
  if (!provided || provided !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function extractFirstEmail(value) {
  if (!value) return "";
  const match = String(value).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : "";
}

function parseMetaObject(metaRaw) {
  if (!metaRaw) return null;
  if (metaRaw && typeof metaRaw === "object" && !Array.isArray(metaRaw)) return metaRaw;
  if (typeof metaRaw !== "string") return null;
  try {
    const parsed = JSON.parse(metaRaw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function resolveEventEmail(event) {
  const metaObj = parseMetaObject(event?.meta);
  if (metaObj) {
    if (metaObj.actorEmail) return String(metaObj.actorEmail);
    if (metaObj.email) return String(metaObj.email);
    if (metaObj.userEmail) return String(metaObj.userEmail);
  }

  return (
    extractFirstEmail(event?.username) ||
    extractFirstEmail(event?.message) ||
    extractFirstEmail(event?.meta) ||
    ""
  );
}

function getTotalXp(level, xp) {
  const safeLevel = Math.max(1, Number(level) || 1);
  const safeXp = Math.max(0, Number(xp) || 0);
  let total = safeXp;
  let xpNext = 250;
  for (let currentLevel = 1; currentLevel < safeLevel; currentLevel += 1) {
    total += xpNext;
    xpNext = Math.floor(xpNext * 1.1);
  }
  return total;
}

// Admin: users list for management tab
app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    const search = String(req.query.search || "").trim();
    const where = search
      ? {
          OR: [
            { username: { contains: search, mode: "insensitive" } },
            { displayName: { contains: search, mode: "insensitive" } }
          ]
        }
      : undefined;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        displayName: true,
        level: true,
        xp: true,
        xpNext: true,
        streak: true,
        maxStreak: true,
        isDevTester: true,
        // Streak-protection diagnostic fields — let admins see at a glance
        // why a user's streak survived (or didn't) after a daily reset.
        streakFreezeCharges: true,
        streakFreezeExpiresAt: true,
        vacationEndsAt: true,
        lastDailyResetAt: true,
        lastStreakIncreaseAt: true,
        updatedAt: true,
        createdAt: true
      },
      orderBy: [{ level: "desc" }, { xp: "desc" }, { updatedAt: "desc" }],
      take: limit
    });

    const userIds = users.map((user) => user.id);
    const emailByUserId = new Map();
    if (userIds.length > 0) {
      const events = await prisma.event.findMany({
        where: {
          userId: { in: userIds },
          OR: [
            { username: { contains: "@" } },
            { message: { contains: "@" } },
            { meta: { contains: "@" } }
          ]
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
        select: {
          userId: true,
          username: true,
          message: true,
          meta: true
        }
      });

      for (const event of events) {
        const userId = String(event.userId || "").trim();
        if (!userId || emailByUserId.has(userId)) continue;
        const email = resolveEventEmail(event);
        if (email) {
          emailByUserId.set(userId, email);
        }
      }
    }

    res.json({
      users: users.map((user) => ({
        id: user.id,
        username: user.username,
        name: user.displayName,
        email: emailByUserId.get(user.id) || "",
        level: user.level,
        xp: user.xp,
        xpNext: user.xpNext,
        totalXp: getTotalXp(user.level, user.xp),
        streak: user.streak,
        maxStreak: user.maxStreak,
        isDevTester: Boolean(user.isDevTester),
        streakFreezeCharges: user.streakFreezeCharges ?? 0,
        streakFreezeExpiresAt: user.streakFreezeExpiresAt,
        vacationEndsAt: user.vacationEndsAt,
        lastDailyResetAt: user.lastDailyResetAt,
        lastStreakIncreaseAt: user.lastStreakIncreaseAt,
        updatedAt: user.updatedAt,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load users", detail: error.message });
  }
});

// Admin: toggle the DEV panel (floating +1 LVL / +S / +5 🪙 / RESET
// buttons) for a specific user. Flip this from the /admin UI.
// Admin: streak-burn diagnostic for a single user.
// Returns the 4 protections that can save a streak after a daily reset
// plus the user's completion count for yesterday (the day the decay
// logic evaluates against on the first reset of a new UTC day).
app.get("/api/admin/users/:userId/streak-diag", requireAdmin, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: {
        username: true,
        displayName: true,
        streak: true,
        maxStreak: true,
        streakFreezeCharges: true,
        streakFreezeExpiresAt: true,
        vacationEndsAt: true,
        lastDailyResetAt: true,
        lastStreakIncreaseAt: true
      }
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const now = new Date();
    const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayKey = getDateKey(yesterday);
    const todayKey = getDateKey(now);

    const [yesterdayRows, todayRows] = await Promise.all([
      prisma.questCompletion.findMany({
        where: { userId: req.params.userId, dayKey: yesterdayKey },
        select: { questId: true, completedAt: true }
      }),
      prisma.questCompletion.findMany({
        where: { userId: req.params.userId, dayKey: todayKey },
        select: { questId: true, completedAt: true }
      })
    ]);

    const lastResetKey = user.lastDailyResetAt ? getDateKey(new Date(user.lastDailyResetAt)) : null;
    const freezeActive = user.streakFreezeExpiresAt
      ? getDateKey(new Date(user.streakFreezeExpiresAt)) >= yesterdayKey
      : false;
    const vacationActive = user.vacationEndsAt ? new Date(user.vacationEndsAt) > now : false;
    const isFirstResetForUtcDay = lastResetKey !== todayKey;
    const streakWouldBurn = yesterdayRows.length < 3 && user.streak > 0;

    const protectedBy =
      !streakWouldBurn ? "not_at_risk (≥3 completions yesterday, or streak already 0)"
        : freezeActive ? "active_freeze"
        : vacationActive ? "vacation"
        : (Number(user.streakFreezeCharges) || 0) > 0 ? "freeze_charge_would_auto_consume"
        : "no_protection";

    res.json({
      user,
      yesterday: { dayKey: yesterdayKey, completions: yesterdayRows.length, rows: yesterdayRows },
      today: { dayKey: todayKey, completions: todayRows.length, rows: todayRows },
      protections: {
        lastDailyResetAt: user.lastDailyResetAt,
        lastDailyResetDayKey: lastResetKey,
        isFirstResetForUtcDay,
        freezeActive,
        vacationActive,
        streakFreezeCharges: Number(user.streakFreezeCharges) || 0,
        streakFreezeExpiresAt: user.streakFreezeExpiresAt,
        vacationEndsAt: user.vacationEndsAt,
        streakWouldBurn,
        protectedBy
      },
      serverNow: now.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: "Failed streak diag", detail: error?.message || String(error) });
  }
});

app.post("/api/admin/users/:userId/set-dev-tester", requireAdmin, async (req, res) => {
  try {
    const parsed = z.object({ enabled: z.boolean() }).parse(req.body || {});
    const userId = String(req.params.userId || "").trim();
    if (!userId) return res.status(400).json({ error: "userId is required" });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { isDevTester: parsed.enabled },
      select: { id: true, username: true, displayName: true, isDevTester: true }
    });
    res.json({ ok: true, user: updated });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Admin: grant fixed XP amount to user
app.post("/api/admin/users/:userId/grant-xp", requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      amount: z.number().int().min(1).max(100000).default(500)
    });
    const parsed = schema.parse(req.body || {});
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const nextXpState = applyBonusXpProgress({
      level: user.level,
      xp: user.xp,
      xpNext: user.xpNext
    }, parsed.amount);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        level: nextXpState.level,
        xp: nextXpState.xp,
        xpNext: nextXpState.xpNext
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        level: true,
        xp: true,
        xpNext: true,
        streak: true,
        updatedAt: true
      }
    });

    res.json({
      ok: true,
      grantedXp: parsed.amount,
      user: {
        ...updatedUser,
        totalXp: getTotalXp(updatedUser.level, updatedUser.xp)
      }
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Dev-only test grants used by floating dashboard buttons. Gated to the
// hardcoded original developer UID plus any user flipped via
// /api/admin/users/:userId/set-dev-tester. The hardcoded UID keeps the
// original tester working even before the isDevTester column is backfilled.
const LEGACY_DEV_TEST_USER_ID = "C0x6GY9LeyVhY12L1yF5QRHp3DP2";

async function assertDevTester(username) {
  const trimmed = String(username || "").trim();
  if (!trimmed) return false;
  if (trimmed === LEGACY_DEV_TEST_USER_ID) return true;
  try {
    const user = await prisma.user.findUnique({
      where: { username: slugifyUsername(trimmed) },
      select: { isDevTester: true }
    });
    return Boolean(user?.isDevTester);
  } catch {
    return false;
  }
}

app.post("/api/dev/grant-xp", async (req, res) => {
  try {
    const schema = z.object({
      username: z.string().min(2).max(64),
      amount: z.number().int().min(1).max(100000).default(500)
    });
    const parsed = schema.parse(req.body || {});
    if (!(await assertDevTester(parsed.username))) {
      return res.status(403).json({ error: "Dev test grants are restricted" });
    }
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const nextXpState = applyBonusXpProgress({
      level: user.level,
      xp: user.xp,
      xpNext: user.xpNext
    }, parsed.amount);
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        level: nextXpState.level,
        xp: nextXpState.xp,
        xpNext: nextXpState.xpNext
      }
    });
    res.json({ ok: true, grantedXp: parsed.amount, user: updatedUser });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/dev/reset-me", async (req, res) => {
  try {
    const parsed = z.object({
      username: z.string().min(2).max(64)
    }).parse(req.body || {});
    if (!(await assertDevTester(parsed.username))) {
      return res.status(403).json({ error: "Dev test grants are restricted" });
    }
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const now = new Date();
    await prisma.$transaction([
      prisma.questCompletion.deleteMany({ where: { userId: user.id } }),
      prisma.dailyScore.deleteMany({ where: { userId: user.id } }),
      prisma.questTimerSession.deleteMany({ where: { userId: user.id } }),
      prisma.questCounter.deleteMany({ where: { userId: user.id } }),
      prisma.questNote.deleteMany({ where: { userId: user.id } }),
      prisma.customQuest.deleteMany({ where: { userId: user.id } }),
      prisma.questFeedback.deleteMany({ where: { userId: user.id } }),
      prisma.userAchievement.deleteMany({ where: { userId: user.id } }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          displayName: "",
          photoUrl: "",
          preferredQuestIds: "",
          randomQuestIds: "",
          previousRandomQuestIds: "",
          level: 1,
          xp: 0,
          xpNext: 250,
          streak: 0,
          maxStreak: 0,
          tokens: 0,
          tokensSpentTotal: 0,
          theme: "adventure",
          lastStreakIncreaseAt: null,
          streakFreezeExpiresAt: null,
          lastFreeTaskRerollAt: null,
          lastDailyRerollAt: null,
          extraRerollsToday: 0,
          lastDailyResetAt: now,
          lastCitySpinDayKey: "",
          districtLevels: "0,0,0,0,0",
          lastCitySpinAt: null,
          lastBusinessClaimDayKey: "",
          lastSquareBonusDayKey: "",
          monthlyFreezeClaims: "",
          vacationStartedAt: null,
          vacationEndsAt: null,
          lastVacationAt: null,
          streakFreezeCharges: 0,
          lastFreezePurchaseWeekKey: "",
          xpBoostExpiresAt: null,
          cityResetsPaid: 0,
          // Clear the "I'll do it later" flag so onboarding re-runs after a
          // full reset. Without this, needsOnboarding stays false even
          // though the account is wiped, and the dev tester lands on a
          // nameless empty dashboard instead of the onboarding screen.
          onboardingSkippedAt: null,
          // Also clear the animated tour flag so the full intro walkthrough
          // fires again on next login — same rationale as the skip flag.
          onboardingTourCompletedAt: null,
          // Drop the public @handle too — onboarding will reassign it.
          handle: null
        }
      })
    ]);

    res.json({ ok: true, message: "Your account was fully reset. Onboarding will re-run on next sync." });
  } catch (error) {
    console.error(`[dev reset-me error] ${error?.message || error}`);
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Dev-only. Backdates all challenges the user created since UTC
// midnight today so the MAX_CHALLENGES_CREATED_PER_DAY cap no longer
// blocks them. Lets a tester iterate on challenge flows without having
// to wait for the next day boundary.
app.post("/api/dev/reset-challenge-daily-count", async (req, res) => {
  try {
    const parsed = z.object({ username: z.string().min(2).max(64) }).parse(req.body || {});
    if (!(await assertDevTester(parsed.username))) {
      return res.status(403).json({ error: "Dev test grants are restricted" });
    }
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const now = new Date();
    const startUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    // Push createdAt back 25 hours so the "createdAt >= startUtc" filter
    // in challengesCreatedTodayCount() excludes these rows.
    const backdated = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    const { count } = await prisma.groupChallenge.updateMany({
      where: { creatorId: user.id, createdAt: { gte: startUtc } },
      data: { createdAt: backdated }
    });
    res.json({ ok: true, reset: count, limit: MAX_CHALLENGES_CREATED_PER_DAY });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/dev/grant-streak", async (req, res) => {
  try {
    const schema = z.object({
      username: z.string().min(2).max(64),
      amount: z.number().int().min(-999).max(999).default(1)
    });
    const parsed = schema.parse(req.body || {});
    if (!(await assertDevTester(parsed.username))) {
      return res.status(403).json({ error: "Dev test grants are restricted" });
    }
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const nextStreak = Math.max(0, Number(user.streak || 0) + parsed.amount);
    const nextMaxStreak = Math.max(Number(user.maxStreak || 0), nextStreak);
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { streak: nextStreak, maxStreak: nextMaxStreak, lastStreakIncreaseAt: new Date() }
    });
    res.json({ ok: true, streak: updatedUser.streak });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/dev/grant-tokens", async (req, res) => {
  try {
    const schema = z.object({
      username: z.string().min(2).max(64),
      amount: z.number().int().min(1).max(1000).default(5)
    });
    const parsed = schema.parse(req.body || {});
    if (!(await assertDevTester(parsed.username))) {
      return res.status(403).json({ error: "Dev test grants are restricted" });
    }
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { tokens: { increment: parsed.amount } }
    });
    res.json({ ok: true, grantedTokens: parsed.amount, tokens: updatedUser.tokens });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Admin: reset daily quests for user (today only)
app.post("/api/admin/users/:userId/reset-daily", requireAdmin, async (req, res) => {
  try {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();
    const dayKey = getDateKey(now);

    const [deletedTodayCompletions, updatedUser] = await prisma.$transaction([
      prisma.questCompletion.deleteMany({
        where: {
          userId: user.id,
          dayKey
        }
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          lastDailyResetAt: now,
          lastDailyRerollAt: null,
          extraRerollsToday: 0,
          randomQuestIds: ""
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          level: true,
          xp: true,
          xpNext: true,
          streak: true,
          updatedAt: true
        }
      })
    ]);

    res.json({
      ok: true,
      dayKey,
      deletedTodayCompletions: deletedTodayCompletions.count,
      user: {
        ...updatedUser,
        totalXp: getTotalXp(updatedUser.level, updatedUser.xp)
      }
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Admin: hard reset user progress (level + quests)
app.post("/api/admin/users/:userId/reset-hard", requireAdmin, async (req, res) => {
  try {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();
    const [, , , , , updatedUser] = await prisma.$transaction([
      prisma.questCompletion.deleteMany({ where: { userId: user.id } }),
      prisma.dailyScore.deleteMany({ where: { userId: user.id } }),
      prisma.questTimerSession.deleteMany({ where: { userId: user.id } }),
      prisma.questCounter.deleteMany({ where: { userId: user.id } }),
      prisma.questNote.deleteMany({ where: { userId: user.id } }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          level: 1,
          xp: 0,
          xpNext: 250,
          streak: 0,
          maxStreak: 0,
          tokens: 0,
          randomQuestIds: "",
          previousRandomQuestIds: "",
          lastStreakIncreaseAt: null,
          streakFreezeExpiresAt: null,
          lastDailyRerollAt: null,
          extraRerollsToday: 0,
          lastDailyResetAt: now,
          streakFreezeCharges: 0,
          lastFreezePurchaseWeekKey: "",
          xpBoostExpiresAt: null
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          level: true,
          xp: true,
          xpNext: true,
          streak: true,
          updatedAt: true
        }
      })
    ]);

    res.json({
      ok: true,
      user: {
        ...updatedUser,
        totalXp: getTotalXp(updatedUser.level, updatedUser.xp)
      }
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Admin: full reset user profile/data and force next client session logout.
app.post("/api/admin/users/:userId/reset-full", requireAdmin, async (req, res) => {
  try {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();
    const [, , , , , , , , , updatedUser] = await prisma.$transaction([
      prisma.questCompletion.deleteMany({ where: { userId: user.id } }),
      prisma.dailyScore.deleteMany({ where: { userId: user.id } }),
      prisma.questTimerSession.deleteMany({ where: { userId: user.id } }),
      prisma.questCounter.deleteMany({ where: { userId: user.id } }),
      prisma.questNote.deleteMany({ where: { userId: user.id } }),
      prisma.customQuest.deleteMany({ where: { userId: user.id } }),
      prisma.questFeedback.deleteMany({ where: { userId: user.id } }),
      prisma.friendship.deleteMany({ where: { OR: [{ userAId: user.id }, { userBId: user.id }] } }),
      prisma.invite.deleteMany({ where: { OR: [{ inviterId: user.id }, { invitedUserId: user.id }] } }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          displayName: "",
          photoUrl: "",
          preferredQuestIds: "",
          randomQuestIds: "",
          previousRandomQuestIds: "",
          level: 1,
          xp: 0,
          xpNext: 250,
          streak: 0,
          maxStreak: 0,
          tokens: 0,
          theme: "adventure",
          lastStreakIncreaseAt: null,
          streakFreezeExpiresAt: null,
          lastFreeTaskRerollAt: null,
          lastDailyRerollAt: null,
          extraRerollsToday: 0,
          lastDailyResetAt: now,
          streakFreezeCharges: 0,
          lastFreezePurchaseWeekKey: "",
          xpBoostExpiresAt: null
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          level: true,
          xp: true,
          xpNext: true,
          streak: true,
          updatedAt: true
        }
      })
    ]);

    await prisma.event.deleteMany({
      where: {
        userId: user.id,
        type: "admin_force_logout_pending"
      }
    });

    await prisma.event.create({
      data: {
        type: "admin_force_logout_pending",
        level: "warn",
        userId: user.id,
        username: user.username,
        platform: "server",
        message: "Admin full reset requested. Force logout on next game-state sync.",
        meta: JSON.stringify({ reason: "admin_full_reset", at: now.toISOString() })
      }
    });

    res.json({
      ok: true,
      forcedLogout: true,
      user: {
        ...updatedUser,
        totalXp: getTotalXp(updatedUser.level, updatedUser.xp)
      }
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Public event ingestion (rate-limited per IP/userId)
// Levels that actually warrant a row in the admin events table. Anything
// below warn (info / debug / analytics pings) is treated as noise and
// dropped without touching the DB — even if an older client build is
// still sending it. This is the last line of defence; the web and mobile
// event loggers also filter at the source (see `ADMIN_LEVELS` in both
// eventLogger modules).
const INGEST_ADMIN_LEVELS = new Set(["warn", "warning", "error", "fatal", "critical", "problem"]);

// Event types that are PURELY analytics/telemetry and should never reach
// the admin panel regardless of the level field. Older mobile builds
// shipped `mobile_app_state` pings at info level; client_session_start
// is the web equivalent; ab_assigned powers an experiments view that is
// not currently used. If one of these ever needs to come back, carve it
// out here rather than punching a hole in the level filter.
const INGEST_NOISE_TYPES = new Set([
  "mobile_app_state",
  "client_session_start",
  "ab_assigned",
  "auth_login",
  "quest_completed",
  "level_up",
  "extra_reroll_purchased",
  "streak_freeze_activated",
  "pinned_quests_rerolled"
]);

function shouldPersistEvent(evt) {
  const level = String(evt?.level || "").toLowerCase();
  if (!INGEST_ADMIN_LEVELS.has(level)) return false;
  const type = String(evt?.type || "").toLowerCase();
  if (INGEST_NOISE_TYPES.has(type)) return false;
  // Defensive: a client that still logs every 4xx as warn would flood
  // admin with expected business rejections. Drop those here too.
  if (type === "api_error") {
    let status = 0;
    const meta = evt?.meta;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      status = Number(meta.status) || 0;
    }
    if (status > 0 && status < 500) return false;
  }
  return true;
}

app.post("/api/events/ingest", async (req, res) => {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const body = req.body || {};
  const key = String(body.userId || ip);

  if (!allowEventIngest(key)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const ua = String(req.headers["user-agent"] || "");
  const events = Array.isArray(body.events) ? body.events : [body];
  const kept = events.slice(0, 50).filter(shouldPersistEvent);

  await Promise.all(kept.map((evt) =>
    recordEvent({
      type: evt.type,
      level: evt.level,
      userId: evt.userId || body.userId,
      username: evt.username || body.username,
      platform: evt.platform || body.platform,
      message: evt.message,
      stack: evt.stack,
      url: evt.url,
      userAgent: evt.userAgent || ua,
      meta: evt.meta
    })
  ));

  res.json({ ok: true, count: kept.length, dropped: events.length - kept.length });
});

// Admin: list recent events (filterable)
app.get("/api/admin/events", requireAdmin, async (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  const type = String(req.query.type || "").trim();
  const level = String(req.query.level || "").trim();
  const userId = String(req.query.userId || "").trim();
  const since = req.query.since ? new Date(String(req.query.since)) : null;

  const where = {};
  if (type) where.type = type;
  if (level) where.level = level;
  if (userId) where.userId = userId;
  if (since && !Number.isNaN(since.getTime())) where.createdAt = { gte: since };

  const events = await prisma.event.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit
  });

  res.json({ events });
});

// Admin: aggregate summary for dashboard
app.get("/api/admin/summary", requireAdmin, async (_req, res) => {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalEvents,
    eventsLast24h,
    eventsLast7d,
    errorsLast24h,
    byType,
    byLevel,
    activeUsers24h,
    recentErrors
  ] = await Promise.all([
    prisma.user.count(),
    prisma.event.count(),
    prisma.event.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.event.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.event.count({ where: { createdAt: { gte: dayAgo }, level: { in: ["error", "fatal"] } } }),
    prisma.event.groupBy({
      by: ["type"],
      where: { createdAt: { gte: dayAgo } },
      _count: { _all: true },
      orderBy: { type: "asc" },
      take: 50
    }),
    prisma.event.groupBy({
      by: ["level"],
      where: { createdAt: { gte: dayAgo } },
      _count: { _all: true },
      orderBy: { level: "asc" }
    }),
    prisma.event.findMany({
      where: { createdAt: { gte: dayAgo }, userId: { not: "" } },
      distinct: ["userId"],
      select: { userId: true, username: true }
    }),
    prisma.event.findMany({
      where: { createdAt: { gte: dayAgo }, level: { in: ["error", "fatal"] } },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);

  res.json({
    now: now.toISOString(),
    totals: {
      users: totalUsers,
      events: totalEvents,
      eventsLast24h,
      eventsLast7d,
      errorsLast24h,
      activeUsers24h: activeUsers24h.length
    },
    byType: byType
      .map((b) => ({ type: b.type, count: b._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    byLevel: byLevel.map((b) => ({ level: b.level, count: b._count._all })),
    recentErrors,
    activeUsers: activeUsers24h
  });
});

// Admin: basic server health
app.get("/api/admin/health", requireAdmin, async (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    ok: true,
    pid: process.pid,
    uptimeSec: Math.round(process.uptime()),
    node: process.version,
    memory: {
      rssMB: Math.round(mem.rss / 1024 / 1024),
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024)
    }
  });
});

// Admin: reset city spin cooldown for all users (keeps XP/level/tokens intact).
app.post("/api/admin/spin/reset-cooldown-all", requireAdmin, async (_req, res) => {
  try {
    const result = await prisma.user.updateMany({ data: { lastCitySpinDayKey: "" } });
    if (typeof citySpinFallbackDayByUserId?.clear === "function") {
      citySpinFallbackDayByUserId.clear();
    }
    res.json({ ok: true, resetUsers: result.count });
  } catch (error) {
    console.error("[Admin Spin Cooldown Reset Error]", error?.message || error);
    res.status(500).json({ error: "Failed to reset city spin cooldown", detail: error?.message || String(error) });
  }
});

// Admin: A/B experiment overview — assignments, conversions, error rate per variant.
// Conversion event types are heuristic but capture the funnel we care about.
const AB_CONVERSION_TYPES = new Set([
  "auth_login",
  "quest_completed",
  "level_up",
  "extra_reroll_purchased",
  "streak_freeze_activated",
  "pinned_quests_rerolled"
]);


// Admin: targeted wipe of the events/audit log table only. Users,
// quests, friendships, all gameplay data stay untouched. Useful when
// stale analytics or noise events are polluting the admin dashboard
// and we want a clean baseline without resetting accounts.
app.post("/api/admin/wipe-events", requireAdmin, async (_req, res) => {
  try {
    const result = await prisma.event.deleteMany({});
    res.json({ ok: true, deleted: { events: result.count } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error", detail: String(error?.message || error) });
  }
});

// Admin: destructive full wipe of app data + admin/event logs.
app.post("/api/admin/wipe-all-data", requireAdmin, async (_req, res) => {
  try {
    const [events, feedback, completions, scores, customQuests, friendships, invites, users] = await prisma.$transaction([
      prisma.event.deleteMany({}),
      prisma.questFeedback.deleteMany({}),
      prisma.questCompletion.deleteMany({}),
      prisma.dailyScore.deleteMany({}),
      prisma.customQuest.deleteMany({}),
      prisma.friendship.deleteMany({}),
      prisma.invite.deleteMany({}),
      prisma.user.deleteMany({})
    ]);

    res.json({
      ok: true,
      deleted: {
        events: events.count,
        feedback: feedback.count,
        completions: completions.count,
        dailyScores: scores.count,
        customQuests: customQuests.count,
        friendships: friendships.count,
        invites: invites.count,
        users: users.count
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.get("/api/admin/ab", requireAdmin, async (_req, res) => {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const events = await prisma.event.findMany({
    where: { createdAt: { gte: since }, NOT: { meta: "" } },
    orderBy: { createdAt: "asc" },
    take: 20000
  });

  // experiments[expKey][variant] = { users:Set, events:0, errors:0, conversions:{type:count}, lastSeen }
  const experiments = {};

  for (const evt of events) {
    let meta;
    try {
      meta = evt.meta ? JSON.parse(evt.meta) : null;
    } catch {
      meta = null;
    }
    if (!meta) continue;

    if (evt.type === "ab_assigned" && meta.experiment && meta.variant) {
      const exp = (experiments[meta.experiment] = experiments[meta.experiment] || {});
      const v = (exp[meta.variant] = exp[meta.variant] || {
        users: new Set(),
        events: 0,
        errors: 0,
        conversions: {},
        lastSeen: null
      });
      if (evt.userId) v.users.add(evt.userId);
      v.events += 1;
      v.lastSeen = evt.createdAt;
      continue;
    }

    if (!meta.ab || typeof meta.ab !== "object") continue;
    for (const [expKey, variant] of Object.entries(meta.ab)) {
      if (!variant) continue;
      const exp = (experiments[expKey] = experiments[expKey] || {});
      const v = (exp[variant] = exp[variant] || {
        users: new Set(),
        events: 0,
        errors: 0,
        conversions: {},
        lastSeen: null
      });
      if (evt.userId) v.users.add(evt.userId);
      v.events += 1;
      v.lastSeen = evt.createdAt;
      if (evt.level === "error" || evt.level === "fatal") v.errors += 1;
      if (AB_CONVERSION_TYPES.has(evt.type)) {
        v.conversions[evt.type] = (v.conversions[evt.type] || 0) + 1;
      }
    }
  }

  const out = Object.entries(experiments).map(([experiment, variants]) => ({
    experiment,
    variants: Object.entries(variants).map(([variant, stats]) => ({
      variant,
      users: stats.users.size,
      events: stats.events,
      errors: stats.errors,
      errorRate: stats.events > 0 ? Number((stats.errors / stats.events).toFixed(4)) : 0,
      conversions: stats.conversions,
      lastSeen: stats.lastSeen
    })).sort((a, b) => a.variant.localeCompare(b.variant))
  })).sort((a, b) => a.experiment.localeCompare(b.experiment));

  res.json({ since: since.toISOString(), experiments: out });
});

// In-memory store for mobile auth tokens (maps token -> user data)
const mobileAuthTokens = new Map();

// Firebase Web API key (public) — used to exchange Google id_token for Firebase UID
// via Identity Toolkit REST API, so mobile and web share the same Firebase UID.
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || "AIzaSyBpG0jinIwaHgF2h1oOA45xyG0bs0kOSos";
const FIREBASE_AUTH_DOMAIN = process.env.FIREBASE_AUTH_DOMAIN || "life-rpg-83c0a.firebaseapp.com";
const FIREBASE_REQUEST_URI = process.env.FIREBASE_REQUEST_URI || `https://${FIREBASE_AUTH_DOMAIN}`;

function resolveFirebaseRequestUri(candidate) {
  const fallback = FIREBASE_REQUEST_URI;
  const raw = String(candidate || "").trim();
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = new URL(raw);
    const host = (parsed.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost";
    }
  } catch {
    // Ignore malformed candidate and use fallback.
  }

  return fallback;
}

async function exchangeGoogleIdTokenForFirebaseUser(idToken, requestUri = "http://localhost") {
  if (!idToken || typeof idToken !== "string") {
    throw new Error("id_token is required");
  }

  const safeRequestUri = resolveFirebaseRequestUri(requestUri);

  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(FIREBASE_API_KEY)}`;
  const body = {
    postBody: `id_token=${encodeURIComponent(idToken)}&providerId=google.com`,
    requestUri: safeRequestUri,
    returnSecureToken: true,
    returnIdpCredential: true
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Firebase signInWithIdp failed: ${response.status} ${errText}`);
  }

  const data = await response.json();
  if (!data || typeof data.localId !== "string" || !data.localId) {
    throw new Error("Firebase signInWithIdp returned no localId");
  }

  return {
    uid: data.localId,
    displayName: data.displayName || data.fullName || data.email || "Adventurer",
    email: data.email || "",
    photoURL: data.photoUrl || ""
  };
}

// Exchange Google id_token -> Firebase user and store in bridge (mobile flow).
app.post("/api/auth/mobile-google-exchange", async (req, res) => {
  try {
    const { id_token: idToken, bridgeId } = req.body || {};
    if (!idToken || typeof idToken !== "string") {
      return res.status(400).json({ error: "id_token is required" });
    }

      const origin = req.headers.origin || req.headers.referer?.split("?")[0] || "http://localhost";
      const user = await exchangeGoogleIdTokenForFirebaseUser(idToken, origin);
    const key = (typeof bridgeId === "string" && bridgeId.trim())
      ? `bridge:${bridgeId.trim()}`
      : (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36));

    mobileAuthTokens.set(key, {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      createdAt: Date.now()
    });

    for (const [k, v] of mobileAuthTokens) {
      if (Date.now() - v.createdAt > 300000) mobileAuthTokens.delete(k);
    }

    res.json({ ok: true, bridgeId: bridgeId || null });
  } catch (error) {
    console.error("mobile-google-exchange failed:", error?.message || error);
    res.status(500).json({ error: "Exchange failed" });
  }
});

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

// Retrieve auth by shared bridge id between WebView and external browser.
// NOT one-time-use: the embedded webapp may fetch this multiple times (e.g.
// Firebase fires onAuthStateChanged more than once during init, the WebView
// is remounted by native after auth, etc.). Entries expire via TTL cleanup.
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
<title>Initializing world...</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#020617;color:#cbd5e1;font-family:system-ui;min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden}
.portal-preloader-shell{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;padding:32px 20px;background:radial-gradient(circle at top,rgba(251,191,36,.12),transparent 24%),radial-gradient(circle at 80% 20%,rgba(56,189,248,.10),transparent 22%),linear-gradient(180deg,rgba(2,6,23,.98),rgba(15,23,42,.99))}
.portal-preloader{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(100%,420px);text-align:center}
.portal-preloader__scene{position:relative;width:min(72vw,320px);aspect-ratio:1;display:grid;place-items:center;overflow:hidden}
.portal-preloader__aurora,.portal-preloader__stars,.portal-preloader__beam,.portal-preloader__ring,.portal-preloader__core,.portal-preloader__orbit,.portal-preloader__cityline,.portal-preloader__platform{position:absolute}
.portal-preloader__aurora{width:52%;height:52%;border-radius:50%;filter:blur(24px);opacity:.65;animation:portal-breathe 5s ease-in-out infinite}
.portal-preloader__aurora--left{left:14%;top:12%;background:rgba(56,189,248,.24)}
.portal-preloader__aurora--right{right:14%;top:8%;background:rgba(251,191,36,.18);animation-delay:-2.2s}
.portal-preloader__stars{inset:18% 18% auto;height:45%;background-image:radial-gradient(circle,rgba(255,255,255,.9) 0 1px,transparent 1.5px),radial-gradient(circle,rgba(255,255,255,.65) 0 1px,transparent 1.5px),radial-gradient(circle,rgba(251,191,36,.7) 0 1px,transparent 1.5px);background-position:0 0,38px 28px,74px 12px;background-size:108px 72px;opacity:.4;animation:portal-stars 8s linear infinite}
.portal-preloader__cityline{bottom:18%;display:flex;align-items:flex-end;gap:7px}
.portal-preloader__cityline span{display:block;background:linear-gradient(180deg,rgba(30,41,59,.75),rgba(15,23,42,.96));border:1px solid rgba(148,163,184,.14);border-bottom:none;border-top-left-radius:10px;border-top-right-radius:10px}
.portal-preloader__cityline span:nth-child(1){width:16px;height:48px}
.portal-preloader__cityline span:nth-child(2){width:21px;height:64px}
.portal-preloader__cityline span:nth-child(3){width:14px;height:38px}
.portal-preloader__cityline span:nth-child(4){width:24px;height:82px}
.portal-preloader__cityline span:nth-child(5){width:17px;height:54px}
.portal-preloader__cityline span:nth-child(6){width:19px;height:66px}
.portal-preloader__platform{bottom:13%;width:56%;height:6%;border-radius:999px;background:rgba(15,23,42,.96);border:1px solid rgba(251,191,36,.22);box-shadow:0 0 0 1px rgba(56,189,248,.08) inset}
.portal-preloader__beam{width:28%;height:62%;border-radius:999px;background:linear-gradient(180deg,rgba(56,189,248,.02),rgba(56,189,248,.18),rgba(251,191,36,.08));filter:blur(4px)}
.portal-preloader__ring{border-radius:50%;inset:50%;translate:-50% -50%}
.portal-preloader__ring--outer{width:58%;height:58%;border:2px solid rgba(251,191,36,.34);border-top-color:rgba(251,191,36,.98);border-bottom-color:rgba(56,189,248,.72);animation:portal-spin 7s linear infinite}
.portal-preloader__ring--middle{width:41%;height:41%;border:2px solid rgba(56,189,248,.22);border-left-color:rgba(56,189,248,.98);border-right-color:rgba(251,191,36,.62);animation:portal-spin-reverse 5.2s linear infinite}
.portal-preloader__ring--inner{width:23%;height:23%;border:1px solid rgba(248,250,252,.14);border-top-color:rgba(248,250,252,.75);animation:portal-spin 3.8s linear infinite}
.portal-preloader__core{width:21%;height:21%;inset:50%;translate:-50% -50%;border-radius:50%;background:radial-gradient(circle,rgba(251,191,36,.18),rgba(15,23,42,.96) 62%);border:2px solid rgba(251,191,36,.72);display:grid;place-items:center;box-shadow:0 0 28px rgba(251,191,36,.24),0 0 18px rgba(56,189,248,.18)}
.portal-preloader__core-glow{position:absolute;inset:-20%;border-radius:50%;background:radial-gradient(circle,rgba(251,191,36,.24),transparent 62%);animation:portal-breathe 3s ease-in-out infinite}
.portal-preloader__sigil{width:32%;height:32%;border-radius:4px;border:2px solid rgba(248,250,252,.85);rotate:45deg}
.portal-preloader__orbit{width:10px;height:10px;border-radius:50%;left:50%;top:50%;margin-left:-5px;margin-top:-5px;box-shadow:0 0 14px currentColor}
.portal-preloader__orbit--a{color:#38bdf8;background:currentColor;animation:portal-orbit-a 3.2s ease-in-out infinite}
.portal-preloader__orbit--b{color:#fbbf24;background:currentColor;animation:portal-orbit-b 4s ease-in-out infinite}
.portal-preloader__orbit--c{color:#f8fafc;background:currentColor;animation:portal-orbit-c 2.8s ease-in-out infinite}
.portal-preloader__title{margin:0;color:#f8fafc;font-size:clamp(22px,2.6vw,30px);font-weight:800;letter-spacing:.04em;text-transform:uppercase}
@keyframes portal-spin{from{transform:translate(-50%,-50%) rotate(0deg)}to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes portal-spin-reverse{from{transform:translate(-50%,-50%) rotate(360deg)}to{transform:translate(-50%,-50%) rotate(0deg)}}
@keyframes portal-breathe{0%,100%{transform:scale(.92);opacity:.45}50%{transform:scale(1.06);opacity:.78}}
@keyframes portal-stars{from{transform:translateY(0);opacity:.28}50%{opacity:.46}to{transform:translateY(8px);opacity:.28}}
@keyframes portal-orbit-a{0%,100%{transform:translate(-74px,-22px) scale(.86);opacity:.55}50%{transform:translate(-90px,-40px) scale(1.08);opacity:1}}
@keyframes portal-orbit-b{0%,100%{transform:translate(78px,-12px) scale(.82);opacity:.52}50%{transform:translate(94px,-34px) scale(1.06);opacity:1}}
@keyframes portal-orbit-c{0%,100%{transform:translate(0,-92px) scale(.8);opacity:.42}50%{transform:translate(0,-114px) scale(1.02);opacity:.95}}
@media (max-width:640px){.portal-preloader__scene{width:min(82vw,280px)}.portal-preloader__title{font-size:21px}}
#log{display:none}
</style>
</head><body>
<div class="portal-preloader-shell">
  <div class="portal-preloader">
    <div class="portal-preloader__scene">
      <div class="portal-preloader__aurora portal-preloader__aurora--left"></div>
      <div class="portal-preloader__aurora portal-preloader__aurora--right"></div>
      <div class="portal-preloader__stars"></div>
      <div class="portal-preloader__cityline">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="portal-preloader__platform"></div>
      <div class="portal-preloader__beam"></div>
      <div class="portal-preloader__ring portal-preloader__ring--outer"></div>
      <div class="portal-preloader__ring portal-preloader__ring--middle"></div>
      <div class="portal-preloader__ring portal-preloader__ring--inner"></div>
      <div class="portal-preloader__core">
        <div class="portal-preloader__core-glow"></div>
        <div class="portal-preloader__sigil"></div>
      </div>
      <div class="portal-preloader__orbit portal-preloader__orbit--a"></div>
      <div class="portal-preloader__orbit portal-preloader__orbit--b"></div>
      <div class="portal-preloader__orbit portal-preloader__orbit--c"></div>
    </div>
    <div id="msg" class="portal-preloader__title">Initializing world...</div>
    <div id="log"></div>
  </div>
</div>
<script>
(function(){
  var logEl = document.getElementById("log");
  function log(s) {
    void s;
    void logEl;
  }
  function setMsg(text) {
    var el = document.getElementById("msg");
    if (el) el.textContent = text;
  }

  var appLanguage = "";
  try {
    appLanguage = String(localStorage.getItem("rpg_language") || "").toLowerCase();
  } catch (e) {
    appLanguage = "";
  }

  var initialLoadingLabel = (appLanguage.indexOf("ru") === 0 || (navigator.language || "").toLowerCase().indexOf("ru") === 0)
    ? "Инициализация мира..."
    : "Initializing world...";
  document.title = initialLoadingLabel;
  setMsg(initialLoadingLabel);

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

  log("origin=" + serverOrigin);
  log("bridgeId=" + bridgeId);
  log("scheme=" + returnScheme);
  log("idToken=" + (idToken ? (idToken.substring(0,20) + "...") : "MISSING"));

  if (!idToken) {
    return;
  }
  if (!bridgeId) {
    return;
  }

  var user = decodeJwt(idToken);
  log("user.sub=" + (user && user.sub ? user.sub : "MISSING"));
  log("user.email=" + (user && user.email ? user.email : "MISSING"));

  if (!user || !user.sub) {
    return;
  }

  function storeViaToken() {
    log("POST /mobile-token...");
    return fetch(serverOrigin + "/api/auth/mobile-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: user.sub,
        displayName: user.name || user.email || "Adventurer",
        email: user.email || "",
        photoURL: user.picture || "",
        bridgeId: bridgeId
      })
    }).then(function(r){
      log("mobile-token status=" + r.status);
      if (!r.ok) {
        return r.text().then(function(t){
          if (t) log("mobile-token body=" + t.substring(0, 400));
          return r;
        }).catch(function(){ return r; });
      }
      return r;
    }).catch(function(e){
      log("mobile-token ERR=" + (e && e.message ? e.message : e));
      throw e;
    });
  }

  function storeViaExchange() {
    log("POST /mobile-google-exchange...");
    return fetch(serverOrigin + "/api/auth/mobile-google-exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: idToken, bridgeId: bridgeId })
    }).then(function(r){
      log("mobile-google-exchange status=" + r.status);
      if (!r.ok) {
        return r.text().then(function(t){
          if (t) log("mobile-google-exchange body=" + t.substring(0, 400));
          return r;
        }).catch(function(){ return r; });
      }
      return r;
    }).catch(function(e){
      log("exchange ERR=" + (e && e.message ? e.message : e));
      return null;
    });
  }

  function verify() {
    return fetch(serverOrigin + "/api/auth/mobile-bridge-check/" + encodeURIComponent(bridgeId))
      .then(function(r){
        log("bridge-check status=" + r.status);
        return r.ok ? r.json() : { exists: false };
      })
      .then(function(b){
        log("bridge-check exists=" + !!(b && b.exists));
        return !!(b && b.exists);
      })
      .catch(function(e){
        log("bridge-check ERR=" + (e && e.message ? e.message : e));
        return false;
      });
  }

  function writeBridge() {
    // Prefer Firebase UID alignment via exchange; if it fails, fall back to direct token write.
    return storeViaExchange().then(function(r) {
      if (r && r.ok) {
        log("bridge-write mode=exchange");
        return true;
      }
      return storeViaToken().then(function(r2) {
        var ok = !!(r2 && r2.ok);
        log("bridge-write mode=token fallback ok=" + ok);
        return ok;
      }).catch(function() {
        log("bridge-write mode=token fallback ok=false");
        return false;
      });
    }).catch(function() {
      return storeViaToken().then(function(r2) {
        var ok = !!(r2 && r2.ok);
        log("bridge-write mode=token fallback ok=" + ok);
        return ok;
      }).catch(function() {
        log("bridge-write mode=token fallback ok=false");
        return false;
      });
    });
  }

  function attempt(n) {
    var maxAttempts = 4;
    var retryDelayMs = 500;
    log("--- attempt " + n + " ---");
    // Do bridge write once, then mostly poll for visibility.
    var writePromise = n === 1 ? writeBridge() : Promise.resolve(false);
    return writePromise
      .then(verify)
      .then(function(ok){
        if (ok) return true;
        if (n >= maxAttempts) return false;
        return new Promise(function(res){ setTimeout(res, retryDelayMs); }).then(function(){ return attempt(n + 1); });
      });
  }

  attempt(1).then(function(ok){
    if (ok) {
      setTimeout(function(){
        location.replace(serverOrigin + "/api/auth/mobile-complete?bridgeId=" + encodeURIComponent(bridgeId) + "&scheme=" + encodeURIComponent(returnScheme));
      }, 300);
    }
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

function parsePreferredQuestIds(rawValue, allowedCustomIds = []) {
  if (!rawValue) {
    return [];
  }
  const validQuestIds = new Set(getQuestPool().map((quest) => quest.id));
  const customAllow = new Set(allowedCustomIds.filter((id) => Number.isInteger(id) && id >= CUSTOM_QUEST_ID_OFFSET));
  // Keep all valid ids; callers slice to their per-level cap via getPreferredQuestCount(level, streak).
  return [...new Set(String(rawValue)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0 && (validQuestIds.has(item) || customAllow.has(item))))];
}

const CUSTOM_QUEST_ID_OFFSET = 1_000_000;
const CUSTOM_QUEST_TITLE_MAX = 40;
const CUSTOM_QUEST_DESC_MAX = 120;

function isCustomQuestVirtualId(id) {
  return Number.isInteger(id) && id >= CUSTOM_QUEST_ID_OFFSET;
}

function toCustomVirtualId(dbId) {
  return CUSTOM_QUEST_ID_OFFSET + Number(dbId);
}

function fromCustomVirtualId(virtualId) {
  return Number(virtualId) - CUSTOM_QUEST_ID_OFFSET;
}

// XP payout for a custom habit — flat 30 when no timer, or scaled with
// the user's chosen session length when the habit runs under a timer:
//   ≤ 39 min → 30 XP,  40–49 min → 40 XP,  ≥ 50 min → 50 XP.
function customHabitXpForMinutes(needsTimer, minutes) {
  if (!needsTimer) return 30;
  const safe = Math.max(0, Number(minutes) || 0);
  if (safe >= 50) return 50;
  if (safe >= 40) return 40;
  return 30;
}

function buildCustomQuestEntry(customQuest) {
  const needsTimer = Boolean(customQuest.needsTimer);
  const timeEstimateMin = Math.max(0, Number(customQuest.timeEstimateMin) || 0);
  const xp = customHabitXpForMinutes(needsTimer, timeEstimateMin);
  return {
    id: toCustomVirtualId(customQuest.id),
    title: customQuest.title,
    desc: customQuest.description || "",
    xp,
    baseXp: xp,
    category: "CUSTOM",
    effortScore: 3,
    needsTimer,
    timeEstimateMin,
    icon: "",
    isCustom: true,
    sourceId: `custom_${customQuest.id}`
  };
}

async function fetchUserCustomQuests(userId) {
  if (!userId) return [];
  return prisma.customQuest.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" }
  });
}

function serializePreferredQuestIds(questIds) {
  return [...new Set(questIds.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))].join(",");
}

function onboardingStatus(user, customQuests = []) {
  const customIds = customQuests.map((cq) => toCustomVirtualId(cq.id));
  const maxPinned = getPreferredQuestCount(user.level || 1, user.streak || 0);
  const allPreferred = parsePreferredQuestIds(user.preferredQuestIds, customIds);
  // Onboarding only requires the level-1 minimum (2 habits). Anything beyond
  // the user's current per-level cap is hidden but retained in DB.
  const preferredQuestIds = allPreferred.slice(0, maxPinned);
  const onboardingMinimum = getPreferredQuestCount(1, 0);
  // "I'll do it later" escape hatch: once the user has taped skip and set
  // their displayName, stop forcing the onboarding gate even if they never
  // come back to pick habits. Empty habit slots will render as add-habit
  // placeholders in the main UI.
  const hasSkipped = Boolean(user.onboardingSkippedAt);
  return {
    preferredQuestIds,
    needsOnboarding: !hasSkipped && allPreferred.length < onboardingMinimum,
    // Animated tour flag — independent from setup. A user who skipped the
    // setup can still be shown the tour, and the tour is marked done only
    // after the user finishes it (or taps skip explicitly).
    needsTour: !user.onboardingTourCompletedAt
  };
}

// Find an unused @handle starting from `seed`. If taken, append a random
// numeric suffix and retry. `excludeUserId` lets self-check pass during an
// onboarding edit where the user's own handle is already claimed by them.
async function ensureUniqueHandle(seed, { excludeUserId = null, maxTries = 12 } = {}) {
  const safeSeed = normalizeHandle(seed);
  const base = safeSeed.length >= HANDLE_MIN_LENGTH ? safeSeed : seedHandleFromDisplayName(safeSeed);
  const whereForCandidate = (value) => excludeUserId
    ? { handle: value, NOT: { id: excludeUserId } }
    : { handle: value };

  const first = normalizeHandle(base);
  if (isValidHandleShape(first)) {
    const clash = await prisma.user.findFirst({ where: whereForCandidate(first), select: { id: true } });
    if (!clash) return first;
  }

  for (let i = 0; i < maxTries; i += 1) {
    const candidate = normalizeHandle(appendHandleSuffix(base));
    if (!isValidHandleShape(candidate)) continue;
    const clash = await prisma.user.findFirst({ where: whereForCandidate(candidate), select: { id: true } });
    if (!clash) return candidate;
  }
  // Extremely unlikely fallback — every attempt collided. Use timestamp.
  const stamp = Date.now().toString(36).slice(-6);
  return normalizeHandle((base + stamp).slice(0, HANDLE_MAX_LENGTH)) || `user${stamp}`;
}

// Idempotent: returns existing handle if set, otherwise generates + saves
// one for this user. Safe to call from hot paths like /game-state.
async function ensureUserHandle(user) {
  if (user?.handle) return user.handle;
  const seed = seedHandleFromDisplayName(user?.displayName || user?.username || "user");
  const handle = await ensureUniqueHandle(seed, { excludeUserId: user?.id });
  try {
    await prisma.user.update({ where: { id: user.id }, data: { handle } });
    user.handle = handle;
  } catch (err) {
    // If a concurrent request raced us and set a different handle first,
    // re-read what stuck. Either way, return something non-empty.
    const fresh = await prisma.user.findUnique({ where: { id: user.id }, select: { handle: true } });
    if (fresh?.handle) {
      user.handle = fresh.handle;
      return fresh.handle;
    }
    console.error(`[handle] ensureUserHandle failed for ${user?.username}: ${err?.message || err}`);
  }
  return user.handle || handle;
}

function hasUsedDailyRerollToday(user, now = new Date()) {
  if (!user?.lastDailyRerollAt) {
    return false;
  }

  return getDateKey(new Date(user.lastDailyRerollAt)) === getDateKey(now);
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

function isValidRandomQuestSet(randomQuests, expectedCount, streak = 0) {
  if (!Array.isArray(randomQuests)) {
    return false;
  }

  if (randomQuests.length !== expectedCount) {
    return false;
  }

  if (!hasUniqueCategories(randomQuests)) {
    return false;
  }

  const effortRange = getEffortRange(expectedCount, streak);
  if (effortRange.max > 0) {
    const actualEffort = sumEffort(randomQuests);
    if (actualEffort < effortRange.min || actualEffort > effortRange.max) {
      return false;
    }
  }

  return true;
}

function findReplacementQuestCombination({
  questPool,
  pinnedSet,
  keepRandomQuests,
  excludeCategories,
  unavailableQuestIds,
  replacementCount,
  expectedRandomCount,
  streak = 0
}) {
  if (!replacementCount) {
    return [];
  }

  const usedCategories = new Set(keepRandomQuests.map((quest) => normalizeCategory(quest?.category)));
  const effortRange = getEffortRange(expectedRandomCount, streak);
  // Remaining effort the replacement picks must contribute so the final
  // group still fits inside the streak-aware range. For the level-1 tier
  // the range is wider (e.g. 3..6) so any sum inside [requiredMin,
  // requiredMax] is accepted.
  const keepEffort = sumEffort(keepRandomQuests);
  const requiredMin = effortRange.max > 0 ? Math.max(0, effortRange.min - keepEffort) : null;
  const requiredMax = effortRange.max > 0 ? effortRange.max - keepEffort : null;

  const candidates = questPool.filter((quest) => {
    if (pinnedSet.has(quest.id) || unavailableQuestIds.has(quest.id)) {
      return false;
    }

    const category = normalizeCategory(quest.category);
    return !excludeCategories.has(category) && !usedCategories.has(category);
  });

  // Shuffle so repeated reroll calls with the same user state don't always
  // produce the same "first valid combination" (which was giving users the
  // feeling that reroll returns the same quest back).
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  let solution = null;

  function backtrack(startIndex, chosen, chosenCategories, chosenEffort) {
    if (solution) {
      return;
    }

    if (chosen.length === replacementCount) {
      if (requiredMax !== null && (chosenEffort < requiredMin || chosenEffort > requiredMax)) {
        return;
      }

      solution = [...chosen];
      return;
    }

    for (let index = startIndex; index < candidates.length; index += 1) {
      const quest = candidates[index];
      const category = normalizeCategory(quest.category);
      if (chosenCategories.has(category)) {
        continue;
      }

      const nextEffort = chosenEffort + (Number(quest.effortScore) || 0);
      if (requiredMax !== null && nextEffort > requiredMax) {
        continue;
      }

      chosen.push(quest);
      chosenCategories.add(category);
      backtrack(index + 1, chosen, chosenCategories, nextEffort);
      chosen.pop();
      chosenCategories.delete(category);

      if (solution) {
        return;
      }
    }
  }

  backtrack(0, [], new Set(), 0);
  return solution;
}

function dailyQuestsForUser(user, date = new Date(), language = "en") {
  const preferredQuestIds = parsePreferredQuestIds(user.preferredQuestIds);
  const quests = getDailyQuests({
    date,
    username: user.username,
    resetSeed: user.lastDailyResetAt?.getTime?.() ?? 0,
    pinnedQuestIds: preferredQuestIds,
    level: user.level || 1,
    streak: user.streak || 0,
    language
  });

  return assignDynamicXp(quests, preferredQuestIds);
}

function composeDailyQuests(user, completedQuestIds = [], date = new Date(), excludeCategories = [], language = "en", customQuests = []) {
  const customById = new Map(customQuests.map((cq) => [toCustomVirtualId(cq.id), cq]));
  const allPreferredIds = parsePreferredQuestIds(user.preferredQuestIds, [...customById.keys()]);
  const regularPinnedIds = allPreferredIds.filter((id) => !isCustomQuestVirtualId(id));
  const customPinnedIds = allPreferredIds.filter(isCustomQuestVirtualId);

  const userLevel = user.level || 1;
  const userStreak = user.streak || 0;
  // Exclude the previous random quest IDs so a fresh daily-reset or reroll
  // cannot repeat the user's last rotation. Stored when the daily-reset /
  // reroll endpoint runs and cleared once this new rotation is persisted.
  const previousRandomIds = (user.previousRandomQuestIds || "")
    .split(",")
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  let baseQuests = getDailyQuests({
    date,
    username: user.username,
    resetSeed: user.lastDailyResetAt?.getTime?.() ?? 0,
    pinnedQuestIds: regularPinnedIds,
    excludeCategories,
    excludeIds: previousRandomIds,
    level: userLevel,
    streak: userStreak,
    language
  });

  // `baseQuests` is composed using only regular pinned ids. Keep the random-slot
  // count anchored to those regular slots so custom pinned habits do not reduce
  // daily random quest count.
  const expectedRandomCount = Math.max(
    0,
    Math.min(getRandomQuestCount(userLevel, userStreak), baseQuests.length - regularPinnedIds.length)
  );
  const questPoolById = new Map(getQuestPool({ language }).map((quest) => [quest.id, quest]));
  const pinnedSet = new Set(allPreferredIds);

  // Build ordered pinned entries exactly as user saved them.
  const pinnedEntries = allPreferredIds
    .map((id) => {
      if (isCustomQuestVirtualId(id)) {
        const cq = customById.get(id);
        return cq ? buildCustomQuestEntry(cq) : null;
      }
      return questPoolById.get(id) || null;
    })
    .filter(Boolean);

  // Random-quest selection as before, excluding any pinned ids.
  const savedRandomIds = user.randomQuestIds ? user.randomQuestIds.split(',').map(Number).filter(Boolean) : [];
  const savedRandomQuests = savedRandomIds
    .map((id) => questPoolById.get(id))
    .filter((quest) => Boolean(quest) && !pinnedSet.has(quest.id));

  const generatedRandomQuests = baseQuests
    .filter((quest) => !pinnedSet.has(quest.id))
    .slice(0, expectedRandomCount);

  const useSavedRandomQuests = isValidRandomQuestSet(savedRandomQuests, expectedRandomCount, userStreak);
  const randomQuests = useSavedRandomQuests ? savedRandomQuests : generatedRandomQuests;

  const resultQuests = [...pinnedEntries, ...randomQuests];

  return assignDynamicXp(resultQuests, allPreferredIds);
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

// Token rewards per level reached: 1 base, +1 more after every major
// milestone (11+ → 2, 21+ → 3, 31+ → 4, 51+ → 5).
function tokensForLevel(level) {
  const lvl = Number(level) || 0;
  if (lvl >= 51) return 5;
  if (lvl >= 31) return 4;
  if (lvl >= 21) return 3;
  if (lvl >= 11) return 2;
  return 1;
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

function buildServerTimeMeta(now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);
  return {
    serverNowMs: current.getTime()
  };
}

function getXpNextForLevel(level) {
  const safeLevel = Math.max(1, Number(level) || 1);
  let xpNext = 250;
  for (let currentLevel = 1; currentLevel < safeLevel; currentLevel += 1) {
    xpNext = Math.floor(xpNext * 1.1);
  }
  return xpNext;
}

async function ensureLeaderboardTestUsers() {
  const baseLevel = 10;
  const totalUsers = 10;

  for (let index = 0; index < totalUsers; index += 1) {
    const userNumber = String(index + 1).padStart(2, "0");
    const level = baseLevel + index;
    const username = `leader_test_${userNumber}`;

    await prisma.user.upsert({
      where: { username },
      create: {
        username,
        displayName: `Leaderboard Test ${userNumber}`,
        photoUrl: "",
        level,
        xp: 0,
        xpNext: getXpNextForLevel(level),
        streak: Math.max(0, index - 1),
        tokens: 0
      },
      update: {
        displayName: `Leaderboard Test ${userNumber}`,
        level,
        xp: 0,
        xpNext: getXpNextForLevel(level),
        streak: Math.max(0, index - 1)
      }
    });
  }
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

function buildTodayProgressSnapshot(user, completionIds, customQuests, date = new Date()) {
  const normalizedCompletionIds = Array.isArray(completionIds)
    ? completionIds.map((item) => Number(item)).filter((item) => Number.isInteger(item))
    : [];
  const normalizedCustomQuests = Array.isArray(customQuests) ? customQuests : [];
  const customVirtualIds = normalizedCustomQuests.map((cq) => toCustomVirtualId(cq.id));
  const preferredQuestIds = parsePreferredQuestIds(user.preferredQuestIds, customVirtualIds);
  const todaysQuests = composeDailyQuests(user, normalizedCompletionIds, date, [], "en", normalizedCustomQuests);
  const questById = new Map(todaysQuests.map((quest) => [quest.id, quest]));
  const pinnedSet = new Set(preferredQuestIds);
  const completedQuests = normalizedCompletionIds
    .map((id) => questById.get(id))
    .filter(Boolean)
    .map((quest) => {
      // Apply the same XP cap that /api/quests/complete uses for habits,
      // so xpToday in productivity matches the XP actually awarded.
      const isHabit = pinnedSet.has(quest.id) || isCustomQuestVirtualId(quest.id);
      return isHabit ? { ...quest, xp: 30 } : quest;
    });
  const progress = summarizeTodayProgress(completedQuests, preferredQuestIds);
  return {
    dayKey: getDateKey(date),
    progress
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
  const customQuests = await fetchUserCustomQuests(user.id);
  const { progress } = buildTodayProgressSnapshot(user, completionIds, customQuests, date);

  return { dayKey, progress };
}

async function updateAndReadProductivity(user, date = new Date(), options = {}) {
  const { precomputedProgress = null } = options;
  const { dayKey, progress } = precomputedProgress || await computeTodayProgress(user, date);

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
      tasksCompleted: progress.tasksCompleted
    },
    update: {
      xpToday: progress.xpToday,
      tasksCompleted: progress.tasksCompleted
    }
  });

  return {
    user,
    productivity: {
      xpToday: progress.xpToday,
      tasksCompletedToday: progress.tasksCompleted,
      baseTasksCompletedToday: progress.baseTasksCompleted
    }
  };
}


app.get("/api/profile-stats/:username", async (req, res) => {
  try {
    const username = slugifyUsername(req.params.username);
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

    // How many group challenges has this user seen through to full
    // group-completion (award fired). Joins on accepted + not-left
    // participations whose challenge has completionAwarded=true.
    const completedGroupChallenges = await prisma.challengeParticipant.count({
      where: {
        userId: user.id,
        leftAt: null,
        acceptedAt: { not: null },
        challenge: { completionAwarded: true }
      }
    });

    res.json({
      totalQuestsCompleted,
      maxStreak: Math.max(maxStreak, user.streak),
      builtHabits,
      completedGroupChallenges,
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
  const level = Number(req.query.level) || 1;
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
      level,
      streak,
      language
    })
  });
});

app.get("/api/quests/all", (req, res) => {
  const language = getRequestLanguage(req);
  const level = Number(req.query.level) || 0;
  const streak = Number(req.query.streak) || 0;
  const pool = getQuestPool({ language });
  if (!level) {
    return res.json({ quests: pool });
  }
  const maxEffort = getMaxEffortForLevel(level, streak);
  const filtered = pool.filter((q) => Number(q.effortScore) <= maxEffort && Number(q.minStreak) <= streak);
  res.json({ quests: filtered });
});

// ── Custom habit CRUD ──
const customQuestSchema = z.object({
  username: z.string().min(2).max(64),
  title: z.string().trim().min(1).max(CUSTOM_QUEST_TITLE_MAX),
  description: z.string().trim().max(CUSTOM_QUEST_DESC_MAX).optional().default(""),
  needsTimer: z.boolean().optional().default(false),
  timeEstimateMin: z.number().int().min(0).max(480).optional().default(0)
});

app.get("/api/custom-quests/:username", async (req, res) => {
  try {
    const username = slugifyUsername(req.params.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });
    const customQuests = await fetchUserCustomQuests(user.id);
    res.json({ customQuests: customQuests.map(buildCustomQuestEntry) });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/custom-quests", async (req, res) => {
  try {
    const parsed = customQuestSchema.parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const existingCount = await prisma.customQuest.count({ where: { userId: user.id } });
    if (existingCount >= 20) {
      return res.status(400).json({ error: "Custom habit limit reached (max 20)" });
    }

    const created = await prisma.customQuest.create({
      data: {
        userId: user.id,
        title: parsed.title,
        description: parsed.description || "",
        needsTimer: Boolean(parsed.needsTimer),
        timeEstimateMin: Boolean(parsed.needsTimer) ? Math.max(1, Number(parsed.timeEstimateMin) || 0) : 0
      }
    });
    res.json({ ok: true, customQuest: buildCustomQuestEntry(created) });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.patch("/api/custom-quests/:id", async (req, res) => {
  try {
    const schema = z.object({
      username: z.string().min(2).max(64),
      title: z.string().trim().min(1).max(CUSTOM_QUEST_TITLE_MAX).optional(),
      description: z.string().trim().max(CUSTOM_QUEST_DESC_MAX).optional(),
      needsTimer: z.boolean().optional(),
      timeEstimateMin: z.number().int().min(0).max(480).optional()
    });
    const parsed = schema.parse(req.body);
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const existing = await prisma.customQuest.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return res.status(404).json({ error: "Custom quest not found" });
    }

    const data = {};
    if (parsed.title !== undefined) data.title = parsed.title;
    if (parsed.description !== undefined) data.description = parsed.description;
    if (parsed.needsTimer !== undefined) data.needsTimer = Boolean(parsed.needsTimer);
    if (parsed.timeEstimateMin !== undefined) {
      data.timeEstimateMin = Math.max(0, Number(parsed.timeEstimateMin) || 0);
    }
    // If timer is being turned off, zero out the minutes to keep invariants.
    if (data.needsTimer === false) data.timeEstimateMin = 0;

    const updated = await prisma.customQuest.update({ where: { id }, data });
    res.json({ ok: true, customQuest: buildCustomQuestEntry(updated) });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.delete("/api/custom-quests/:id", async (req, res) => {
  try {
    const schema = z.object({ username: z.string().min(2).max(64) });
    const parsed = schema.parse(req.body || {});
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const existing = await prisma.customQuest.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return res.status(404).json({ error: "Custom quest not found" });
    }

    // Remove this virtual id from user's preferredQuestIds if present.
    const virtualId = toCustomVirtualId(id);
    const currentCsv = user.preferredQuestIds || "";
    const filtered = currentCsv
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0 && n !== virtualId);
    const nextCsv = filtered.join(",");

    await prisma.$transaction([
      prisma.customQuest.delete({ where: { id } }),
      ...(nextCsv !== currentCsv
        ? [prisma.user.update({ where: { id: user.id }, data: { preferredQuestIds: nextCsv } })]
        : [])
    ]);

    const remaining = await fetchUserCustomQuests(user.id);
    res.json({
      ok: true,
      customQuests: remaining.map(buildCustomQuestEntry),
      preferredQuestIds: filtered
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/profiles/upsert", async (req, res) => {
  const upsertBody = z.object({
    username: z.string().min(2).max(64),
    displayName: z.string().min(1).max(64).optional(),
    // Avatar dataURL after client-side compressImage(256, 0.7) ≈ 25–40 KB.
    // 150 KB allows ~4x headroom for higher-quality variants.
    photoUrl: z.string().max(150_000).optional(),
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

  const pendingForceLogout = await prisma.event.findFirst({
    where: {
      userId: user.id,
      type: "admin_force_logout_pending"
    },
    orderBy: { createdAt: "desc" }
  });

  if (pendingForceLogout) {
    await prisma.event.deleteMany({
      where: {
        userId: user.id,
        type: "admin_force_logout_pending"
      }
    });

    return res.json({
      forceLogout: true,
      reason: "admin_full_reset",
      ...buildServerTimeMeta(new Date())
    });
  }

  const now = new Date();

  // Self-heal: correct xpNext if it drifted out of sync with level.
  // This can happen for users who received multiple dev-grant bumps before
  // the dev-grant endpoint started recomputing xpNext on each level change.
  const correctXpNext = getXpNextForLevel(user.level);
  if (Number(user.xpNext) !== correctXpNext) {
    await prisma.user.update({
      where: { id: user.id },
      data: { xpNext: correctXpNext }
    });
    user.xpNext = correctXpNext;
  }

  // Residential auto-grant — apply any pending free-freeze cycles or
  // vacation bundle before composing the response so the client sees
  // the freshly granted charges in the same payload. We surface the
  // delta in `pendingGrants` so the City tab can pop a confirmation.
  let pendingGrants = { freeze: 0, vacation: 0 };
  try {
    const grantResult = computeResidentialAutoGrants(user, now);
    if (grantResult.freezeGranted > 0 || grantResult.vacationGranted > 0 || Object.keys(grantResult.dataPatch).length > 0) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: grantResult.dataPatch,
        select: { streakFreezeCharges: true, monthlyFreezeClaims: true, lastVacationAt: true }
      });
      user.streakFreezeCharges = updated.streakFreezeCharges;
      user.monthlyFreezeClaims = updated.monthlyFreezeClaims;
      user.lastVacationAt = updated.lastVacationAt;
      pendingGrants = {
        freeze: grantResult.freezeGranted,
        vacation: grantResult.vacationGranted
      };
    }
  } catch (grantErr) {
    console.error(`[game-state] residential auto-grant failed: ${grantErr?.message || grantErr}`);
  }

  // Lazy-backfill the public @handle for accounts created before the
  // feature existed. Onboarding-path already assigns one, but legacy
  // users hit this path on their first login after the deploy.
  if (!user.handle) {
    try {
      await ensureUserHandle(user);
    } catch (handleErr) {
      console.error(`[game-state] ensureUserHandle failed: ${handleErr?.message || handleErr}`);
    }
  }

  const dateKey = getDateKey(now);
  const [completions, customQuests] = await Promise.all([
    prisma.questCompletion.findMany({
      where: { userId: user.id, dayKey: dateKey },
      select: { questId: true }
    }),
    fetchUserCustomQuests(user.id)
  ]);
  const completionIds = completions.map((item) => item.questId);

  const todayKey = getDateKey(now);
  const streakFreezeActive = user.streakFreezeExpiresAt
    ? getDateKey(new Date(user.streakFreezeExpiresAt)) >= todayKey
    : false;
  const { preferredQuestIds, needsOnboarding, needsTour } = onboardingStatus(user, customQuests);
  const precomputedProgress = buildTodayProgressSnapshot(user, completionIds, customQuests, now);
  const [pinnedQuestProgress21d, { productivity }] = await Promise.all([
    getPinnedQuestProgress21d(user, preferredQuestIds, now),
    updateAndReadProductivity(user, now, { precomputedProgress })
  ]);

  // Persist the random-quest IDs the user will actually see today when the
  // stored set is out of date (e.g. first fetch after reset-daily cleared
  // randomQuestIds). We DO NOT touch previousRandomQuestIds here — it is a
  // server-side memory of "quests the user has already seen or rerolled
  // today" that reset-daily manages. Clearing it mid-day would let a
  // subsequent reroll hand back a quest the user just paid to replace.
  try {
    const composedToday = composeDailyQuests(user, completionIds, now, [], language, customQuests);
    const pinnedSetToday = new Set(preferredQuestIds);
    const randomIdsToday = composedToday
      .filter((q) => q && !pinnedSetToday.has(q.id) && !isCustomQuestVirtualId(q.id))
      .map((q) => q.id);
    const storedRandomIds = (user.randomQuestIds || "").split(",").map(Number).filter(Boolean);
    const ordersDiffer = randomIdsToday.join(",") !== storedRandomIds.join(",");
    if (ordersDiffer && randomIdsToday.length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          randomQuestIds: randomIdsToday.join(",")
        }
      });
      user.randomQuestIds = randomIdsToday.join(",");
    }
  } catch (persistErr) {
    console.error(`[game-state] persist random quest rotation failed: ${persistErr?.message || persistErr}`);
  }

  const questSlots = getQuestSlotsForLevel(user.level || 1, user.streak || 0);
  // These queries touch new columns/tables added in the 2026-04-21 timer
  // migration. If a region restarts before its schema is synced we must not
  // crash the whole game-state endpoint — degrade gracefully so the user
  // still gets their quests, and the timer features unlock on next request
  // once the migration lands.
  let activeTimers = [];
  try {
    const activeTimerRows = await prisma.questTimerSession.findMany({
      where: { userId: user.id, dayKey: dateKey, status: { in: ["running", "paused"] } },
      orderBy: { createdAt: "desc" }
    });
    activeTimers = activeTimerRows.map((row) => serializeTimerSession(row, now));
  } catch (timerErr) {
    console.error(`[game-state] active timer read failed: ${timerErr?.message || timerErr}`);
  }
  let activeCompletionRows = [];
  try {
    activeCompletionRows = await prisma.questCompletion.findMany({
      where: { userId: user.id, dayKey: dateKey },
      select: { questId: true, completionPercent: true, elapsedMs: true }
    });
  } catch (completionsErr) {
    console.error(`[game-state] completion metadata read failed: ${completionsErr?.message || completionsErr}`);
  }
  let activeCounters = [];
  try {
    const counterRows = await prisma.questCounter.findMany({
      where: { userId: user.id, dayKey: dateKey }
    });
    activeCounters = counterRows.map((row) => ({
      questId: row.questId,
      count: Number(row.count || 0),
      target: Number(row.target || 0),
      lastTickAt: row.lastTickAt ?? null,
      windowStartAt: row.windowStartAt ?? null,
      windowTicks: Number(row.windowTicks || 0)
    }));
  } catch (counterErr) {
    console.error(`[game-state] counter read failed: ${counterErr?.message || counterErr}`);
  }
  res.json({
    user,
    dateKey,
    completedQuestIds: completionIds,
    completions: activeCompletionRows,
    streak: user.streak,
    hasRerolledToday: hasUsedDailyRerollToday(user, now),
    extraRerollsToday: Number(user.extraRerollsToday || 0),
    quests: composeDailyQuests(user, completionIds, now, [], language, customQuests),
    streakFreezeActive,
    preferredQuestIds,
    pinnedQuestProgress21d,
    needsOnboarding,
    needsTour,
    allQuests: needsOnboarding
      ? getQuestPool({ language }).filter((q) => Number(q.effortScore) <= questSlots.maxEffort && Number(q.minStreak) <= (user.streak || 0))
      : [],
    customQuests: customQuests.map(buildCustomQuestEntry),
    productivity,
    questSlots,
    activeTimers,
    activeCounters,
    isDevTester: Boolean(user.isDevTester) || user.username === LEGACY_DEV_TEST_USER_ID,
    pendingGrants,
    ...buildServerTimeMeta(now)
  });
});

app.post("/api/onboarding/complete", async (req, res) => {
  // Onboarding happens at level 1: user picks exactly the level-1 pinned count.
  const onboardingPinnedCount = getPreferredQuestCount(1, 0);
  const schema = z.object({
    username: z.string().min(2).max(64),
    displayName: z.string().min(1).max(64),
    // See /api/profiles/upsert for rationale on the 150 KB cap.
    photoUrl: z.string().max(150_000).optional(),
    preferredQuestIds: z.array(z.number().int().min(1)).length(onboardingPinnedCount),
    // Optional public @handle. If the client sent one, validate + reserve
    // it; otherwise we auto-generate a unique fallback from displayName.
    handle: z.string().max(HANDLE_MAX_LENGTH + 4).optional()
  });

  try {
    const language = getRequestLanguage(req);
    const parsed = schema.parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const customQuests = await fetchUserCustomQuests(user.id);
    const customVirtualIds = new Set(customQuests.map((cq) => toCustomVirtualId(cq.id)));

    const existingPreferred = parsePreferredQuestIds(user.preferredQuestIds, [...customVirtualIds]);
    if (existingPreferred.length >= onboardingPinnedCount) {
      return res.status(409).json({ error: "Preferred quests are already locked" });
    }

    const uniquePreferredQuestIds = [...new Set(parsed.preferredQuestIds)].slice(0, onboardingPinnedCount);
    if (uniquePreferredQuestIds.length !== onboardingPinnedCount) {
      return res.status(400).json({ error: `Pick exactly ${onboardingPinnedCount} unique preferred quests` });
    }

    const questPool = getQuestPool();
    const questById = new Map(questPool.map((quest) => [quest.id, quest]));
    const invalidQuestId = uniquePreferredQuestIds.find((id) => !questById.has(id) && !customVirtualIds.has(id));
    if (invalidQuestId) {
      return res.status(400).json({ error: `Invalid quest id: ${invalidQuestId}` });
    }
    const onboardingMaxEffort = getMaxEffortForLevel(1, 0);
    const overDifficultQuest = uniquePreferredQuestIds.find((id) => {
      const quest = questById.get(id);
      return quest && Number(quest.effortScore) > onboardingMaxEffort;
    });
    if (overDifficultQuest) {
      return res.status(400).json({ error: `Quest ${overDifficultQuest} exceeds the difficulty available at your level` });
    }

    const displayName = parsed.displayName.trim().slice(0, 64);
    // Resolve the @handle: prefer the client's submitted value (normalized
    // + uniqueness-enforced), fall back to a displayName-seeded generator.
    // If the user already has a handle, only overwrite when the client
    // explicitly submitted a new one. Race-safe: ensureUniqueHandle
    // re-checks the DB under a suffix loop.
    let resolvedHandle = user.handle || null;
    if (parsed.handle !== undefined) {
      const requested = normalizeHandle(parsed.handle);
      if (requested.length > 0 && !isValidHandleShape(requested)) {
        return res.status(400).json({ error: "Invalid handle", detail: "Use 3..20 letters/digits/underscore" });
      }
      const seed = requested.length > 0 ? requested : seedHandleFromDisplayName(displayName);
      resolvedHandle = await ensureUniqueHandle(seed, { excludeUserId: user.id });
    } else if (!resolvedHandle) {
      resolvedHandle = await ensureUniqueHandle(seedHandleFromDisplayName(displayName), { excludeUserId: user.id });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName,
        photoUrl: parsed.photoUrl ?? user.photoUrl,
        preferredQuestIds: serializePreferredQuestIds(uniquePreferredQuestIds),
        handle: resolvedHandle
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
    const { productivity } = await updateAndReadProductivity(updatedUser, now);

    res.json({
      ok: true,
      user: updatedUser,
      completedQuestIds: completions.map((item) => item.questId),
      streak: updatedUser.streak,
      hasRerolledToday: hasUsedDailyRerollToday(updatedUser, now),
      extraRerollsToday: Number(updatedUser.extraRerollsToday || 0),
      quests: composeDailyQuests(updatedUser, completions.map((item) => item.questId), now, [], language, customQuests),
      streakFreezeActive,
      preferredQuestIds: uniquePreferredQuestIds,
      pinnedQuestProgress21d,
      needsOnboarding: false,
      needsTour: !updatedUser.onboardingTourCompletedAt,
      customQuests: customQuests.map(buildCustomQuestEntry),
      productivity,
      questSlots: getQuestSlotsForLevel(updatedUser.level || 1, updatedUser.streak || 0),
      ...buildServerTimeMeta(now)
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// "I'll do it later" path from the onboarding screen. Saves the displayName
// (still required — it's their nickname) and stamps onboardingSkippedAt so
// the gate doesn't come back. Habit slots remain empty and will render as
// + add-habit placeholders in the daily board.
app.post("/api/onboarding/skip", async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(64),
    displayName: z.string().min(1).max(64),
    photoUrl: z.string().max(150_000).optional(),
    handle: z.string().max(HANDLE_MAX_LENGTH + 4).optional()
  });

  try {
    const language = getRequestLanguage(req);
    const parsed = schema.parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const displayName = parsed.displayName.trim().slice(0, 64);
    // Resolve @handle same way as /complete (see that handler for detail).
    let resolvedHandle = user.handle || null;
    if (parsed.handle !== undefined) {
      const requested = normalizeHandle(parsed.handle);
      if (requested.length > 0 && !isValidHandleShape(requested)) {
        return res.status(400).json({ error: "Invalid handle", detail: "Use 3..20 letters/digits/underscore" });
      }
      const seed = requested.length > 0 ? requested : seedHandleFromDisplayName(displayName);
      resolvedHandle = await ensureUniqueHandle(seed, { excludeUserId: user.id });
    } else if (!resolvedHandle) {
      resolvedHandle = await ensureUniqueHandle(seedHandleFromDisplayName(displayName), { excludeUserId: user.id });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName,
        photoUrl: parsed.photoUrl ?? user.photoUrl,
        onboardingSkippedAt: new Date(),
        handle: resolvedHandle
      }
    });

    const customQuests = await fetchUserCustomQuests(user.id);
    const customVirtualIds = customQuests.map((cq) => toCustomVirtualId(cq.id));
    const parsedPreferred = parsePreferredQuestIds(updatedUser.preferredQuestIds, customVirtualIds);
    const now = new Date();
    const dayKey = getDateKey(now);
    const completions = await prisma.questCompletion.findMany({
      where: { userId: user.id, dayKey },
      select: { questId: true }
    });
    const completedIds = completions.map((item) => item.questId);
    const streakFreezeActive = updatedUser.streakFreezeExpiresAt
      ? getDateKey(new Date(updatedUser.streakFreezeExpiresAt)) >= dayKey
      : false;
    const pinnedQuestProgress21d = await getPinnedQuestProgress21d(updatedUser, parsedPreferred, now);
    const { productivity } = await updateAndReadProductivity(updatedUser, now);

    res.json({
      ok: true,
      user: updatedUser,
      completedQuestIds: completedIds,
      streak: updatedUser.streak,
      hasRerolledToday: hasUsedDailyRerollToday(updatedUser, now),
      extraRerollsToday: Number(updatedUser.extraRerollsToday || 0),
      quests: composeDailyQuests(updatedUser, completedIds, now, [], language, customQuests),
      streakFreezeActive,
      preferredQuestIds: parsedPreferred,
      pinnedQuestProgress21d,
      needsOnboarding: false,
      needsTour: !updatedUser.onboardingTourCompletedAt,
      customQuests: customQuests.map(buildCustomQuestEntry),
      productivity,
      questSlots: getQuestSlotsForLevel(updatedUser.level || 1, updatedUser.streak || 0),
      ...buildServerTimeMeta(now)
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Finish the animated onboarding tour. Awards +1 level (xp reset to 0,
// xpNext grows by 10% just like a normal level-up) and stamps the tour
// completion timestamp so the gate stops firing on future logins.
app.post("/api/onboarding/tour/complete", async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(64),
    // If the user tapped "Skip" instead of walking through, we still mark
    // the tour as seen, but do NOT award the +1 level bonus.
    awardLevel: z.boolean().optional()
  });
  try {
    const parsed = schema.parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.onboardingTourCompletedAt) {
      return res.json({
        ok: true,
        alreadyCompleted: true,
        awarded: false,
        user
      });
    }

    const shouldAward = parsed.awardLevel !== false;
    const nextData = { onboardingTourCompletedAt: new Date() };
    if (shouldAward) {
      nextData.level = (user.level || 1) + 1;
      nextData.xp = 0;
      nextData.xpNext = Math.floor((user.xpNext || 250) * 1.1);
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: nextData
    });

    return res.json({
      ok: true,
      alreadyCompleted: false,
      awarded: shouldAward,
      user: updatedUser
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Replay the animated tour from Profile → Settings. Clears the timestamp
// so the client's next render sees needsTour: true and auto-opens the tour.
app.post("/api/onboarding/tour/reset", async (req, res) => {
  const schema = z.object({ username: z.string().min(2).max(64) });
  try {
    const { username } = schema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username: slugifyUsername(username) } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { onboardingTourCompletedAt: null }
    });
    return res.json({ ok: true, user: updatedUser });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Quantize a raw completion percent to the scoring tiers: <50 → 0 (rejected),
// 50-74 → 50, 75-99 → 75, >=100 → 100.
function quantizeCompletionPercent(rawPercent) {
  const safe = Math.max(0, Math.min(200, Number(rawPercent) || 0));
  if (safe < 50) return 0;
  if (safe < 75) return 50;
  if (safe < 100) return 75;
  return 100;
}

async function processQuestCompletion({ user, quest, dayKey, availableQuests, customQuests, completionPercent, elapsedMs, now }) {
  const customIds = customQuests.map((cq) => toCustomVirtualId(cq.id));
  const pinnedQuestIds = parsePreferredQuestIds(user.preferredQuestIds, customIds);
  const isHabit = pinnedQuestIds.includes(quest.id) || isCustomQuestVirtualId(quest.id);
  // Regular pinned habits pay a flat 30 XP regardless of their pool base_xp.
  // Custom habits already carry the correct XP from buildCustomQuestEntry
  // (30/40/50 based on their timeEstimateMin), so trust quest.xp for those.
  const baseXpQuest = isHabit && !isCustomQuestVirtualId(quest.id)
    ? { ...quest, xp: 30 }
    : quest;
  // Scale awarded XP by completion percent. xpAfterQuest applies streak and
  // level multipliers; we scale its XP-pre-multiplier input so downstream
  // logic stays consistent.
  const scaledBaseXp = Math.max(0, Math.round(Number(baseXpQuest.xp || 0) * completionPercent / 100));
  const questForXp = { ...baseXpQuest, xp: scaledBaseXp };
  const previousPinnedQuestStreak = pinnedQuestIds.includes(quest.id)
    ? await getQuestConsecutiveDaysForUser(user.id, quest.id)
    : 0;

  await prisma.questCompletion.create({
    data: { userId: user.id, questId: quest.id, dayKey, completionPercent, elapsedMs }
  });

  const todayRows = await prisma.questCompletion.findMany({
    where: { userId: user.id, dayKey },
    select: { completionPercent: true }
  });
  const todayCompletionsCount = todayRows.length;
  const todayHundredCount = todayRows.filter((row) => Number(row.completionPercent) >= 100).length;

  const milestoneReward = milestoneRewardForCount(todayCompletionsCount);
  let habitMilestoneReached = false;
  let habitMilestoneTokens = 0;

  if (pinnedQuestIds.includes(quest.id) && completionPercent >= 100) {
    const nextPinnedQuestStreak = await getQuestConsecutiveDaysForUser(user.id, quest.id);
    if (previousPinnedQuestStreak < 21 && nextPinnedQuestStreak >= 21) {
      habitMilestoneReached = true;
      habitMilestoneTokens = 20;
    }
  }

  // Streak counts only 100%-completions (timer full-time or no-timer quest).
  const newStreak = calculateStreak(todayHundredCount, user.streak);

  return {
    pinnedQuestIds,
    questForXp,
    milestoneReward,
    habitMilestoneReached,
    habitMilestoneTokens,
    todayCompletionsCount,
    todayHundredCount,
    newStreak
  };
}

// Run the XP award + token/streak bookkeeping transaction shared by
// /api/quests/complete and the timer stop endpoint.
async function awardQuestCompletion({ user, quest, dayKey, availableQuests, customQuests, completionPercent, elapsedMs, now }) {
  // Snapshot the user's tier slots BEFORE awarding XP so we can detect
  // a tier crossing (more habit/daily slots, higher difficulty cap)
  // after the transaction settles. The diff travels back to the client
  // as `tierUnlock` and triggers the mandatory progression popup.
  const prevSlots = getQuestSlotsForLevel(user.level || 1, user.streak || 0);

  const {
    questForXp,
    milestoneReward,
    habitMilestoneReached,
    habitMilestoneTokens,
    todayCompletionsCount,
    todayHundredCount,
    newStreak
  } = await processQuestCompletion({
    user,
    quest,
    dayKey,
    availableQuests,
    customQuests,
    completionPercent,
    elapsedMs,
    now
  });
  const streakIncreased = newStreak > user.streak;
  const lastIncreaseKey = user.lastStreakIncreaseAt ? getDateKey(user.lastStreakIncreaseAt) : null;
  const canIncreaseStreakToday = lastIncreaseKey !== dayKey;

  // Atomic XP read+compute+write: lock the user row so concurrent completions
  // (e.g. mobile + web simultaneously) cannot both read the same stale XP and
  // overwrite each other, causing lost XP.
  const baseTokenIncrement = milestoneReward.bonusTokens + (habitMilestoneReached ? habitMilestoneTokens : 0);
  const { updatedUser, xpState, sportBonusXp, squareBonusTokens, isFullBoard } = await prisma.$transaction(async (tx) => {
    try {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
    } catch (lockErr) {
      const msg = String(lockErr?.message || "");
      if (!/FOR/i.test(msg)) throw lockErr;
    }
    const freshUser = await tx.user.findUnique({ where: { id: user.id } });
    const freshXpState = xpAfterQuest(freshUser, questForXp, freshUser.streak || 0);

    const sportLvl = districtLevelOf(freshUser.districtLevels, "sport");
    const sportMultiplier = sportXpBonus(sportLvl);
    const sportBonusXpInner = Math.max(0, Math.round(freshXpState.awardedXp * (sportMultiplier - 1)));

    const xpBoostActiveInner = xpBoostActiveFor(freshUser, now);
    const xpBoostBonusXpInner = xpBoostActiveInner
      ? Math.max(0, Math.round(freshXpState.awardedXp * (XP_BOOST_MULTIPLIER - 1)))
      : 0;

    const freshXpStateWithMilestone = applyBonusXpProgress(
      freshXpState,
      milestoneReward.bonusXp + sportBonusXpInner + xpBoostBonusXpInner
    );

    let freshTokenIncrement = baseTokenIncrement;
    if (freshXpStateWithMilestone.level > freshUser.level) {
      for (let lvl = freshUser.level + 1; lvl <= freshXpStateWithMilestone.level; lvl++) {
        freshTokenIncrement += tokensForLevel(lvl);
      }
    }

    const squareLvl = districtLevelOf(freshUser.districtLevels, "square");
    const isFullBoardInner = todayCompletionsCount >= availableQuests.length && availableQuests.length > 0;
    const alreadyGranted = freshUser.lastSquareBonusDayKey === dayKey;
    const squareBonusTokensInner = (squareLvl > 0 && isFullBoardInner && !alreadyGranted) ? squareLvl : 0;
    if (squareBonusTokensInner > 0) {
      freshTokenIncrement += squareBonusTokensInner;
    }

    const txUpdateData = {
      xp: freshXpStateWithMilestone.xp,
      level: freshXpStateWithMilestone.level,
      xpNext: freshXpStateWithMilestone.xpNext
    };
    if (freshTokenIncrement > 0) {
      txUpdateData.tokens = { increment: freshTokenIncrement };
    }
    if (streakIncreased && canIncreaseStreakToday) {
      txUpdateData.streak = newStreak;
      txUpdateData.lastStreakIncreaseAt = now;
      if (newStreak > (freshUser.maxStreak || 0)) {
        txUpdateData.maxStreak = newStreak;
      }
    }
    if (squareBonusTokensInner > 0) {
      txUpdateData.lastSquareBonusDayKey = dayKey;
    }

    const updated = await tx.user.update({ where: { id: user.id }, data: txUpdateData });
    return {
      updatedUser: updated,
      xpState: freshXpState,
      sportBonusXp: sportBonusXpInner,
      squareBonusTokens: squareBonusTokensInner,
      isFullBoard: isFullBoardInner
    };
  });

  const productivityState = await updateAndReadProductivity(updatedUser, now);
  const finalUser = productivityState.user;

  // Fire-and-forget achievement evaluation (streak-based unlocks + mentor
  // chain via inviter). Swallow any failure — must never block the reply.
  trackAchievements(finalUser.id);
  try {
    const invitesAsInvited = await prisma.invite.findMany({
      where: { invitedUserId: finalUser.id, status: "ACCEPTED" },
      select: { inviterId: true }
    });
    const seen = new Set();
    for (const row of invitesAsInvited) {
      if (row.inviterId && !seen.has(row.inviterId)) {
        seen.add(row.inviterId);
        trackAchievements(row.inviterId);
      }
    }
  } catch {}

  return {
    ok: true,
    streak: finalUser.streak,
    awardedXp: xpState.awardedXp,
    multiplier: xpState.multiplier,
    milestoneBonusXp: milestoneReward.bonusXp,
    milestoneTokens: milestoneReward.bonusTokens,
    sportBonusXp: sportBonusXp || 0,
    squareBonusTokens: squareBonusTokens || 0,
    fullBoardCompleted: !!isFullBoard,
    totalAwardedXp: xpState.awardedXp + milestoneReward.bonusXp + (sportBonusXp || 0),
    habitMilestoneReached,
    habitMilestoneTokens,
    habitMilestoneQuestId: quest.id,
    tokens: finalUser.tokens,
    productivity: productivityState.productivity,
    questSlots: getQuestSlotsForLevel(finalUser.level || 1, finalUser.streak || 0),
    completionPercent,
    elapsedMs,
    // Surface the current-day streak progress so the client can render
    // "X more to grow your streak" dynamically.
    todayHundredCount,
    streakThreshold: Number(getStreakRuleConfig().successThresholdCompletedQuests) || 4,
    // tierUnlock fires when this completion crossed a level / streak
    // boundary that changed the user's slot mix or difficulty cap.
    // Client treats this as a mandatory popup explaining what just
    // unlocked (extra habit slot, extra daily, harder quests, etc.).
    tierUnlock: (() => {
      const next = getQuestSlotsForLevel(finalUser.level || 1, finalUser.streak || 0);
      const pinnedDelta = next.pinned - prevSlots.pinned;
      const randomDelta = next.random - prevSlots.random;
      const effortDelta = next.maxEffort - prevSlots.maxEffort;
      if (pinnedDelta <= 0 && randomDelta <= 0 && effortDelta <= 0) return null;
      return {
        previous: prevSlots,
        current: next,
        diff: { pinned: pinnedDelta, random: randomDelta, maxEffort: effortDelta },
        reachedLevel: finalUser.level || 1,
        reachedStreak: finalUser.streak || 0
      };
    })(),
    ...buildServerTimeMeta(now)
  };
}

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
    const customQuests = await fetchUserCustomQuests(user.id);
    const availableQuests = composeDailyQuests(user, todayCompletions.map((item) => item.questId), new Date(), [], language, customQuests);
    const quest = availableQuests.find((item) => item.id === parsed.questId);

    if (!quest) {
      return res.status(404).json({ error: "Quest not found" });
    }

    if (quest.needsTimer && !isCustomQuestVirtualId(quest.id)) {
      return res.status(400).json({ error: "This quest requires a timer. Use /api/quests/timer/start.", code: "timer_required" });
    }

    // Counter/note/words quests must go through their dedicated endpoints so
    // we can enforce anti-cheat (hydration cooldown, note text submission,
    // vocab pair submission). The /complete endpoint only handles "simple"
    // and (implicitly) custom quests.
    if (!isCustomQuestVirtualId(quest.id)) {
      if (quest.mechanic === "counter") {
        return res.status(400).json({ error: "This quest uses a counter.", code: "counter_required" });
      }
      if (quest.mechanic === "note" || quest.mechanic === "words") {
        return res.status(400).json({ error: "This quest requires a note submission.", code: "note_required" });
      }
    }

    const existing = await prisma.questCompletion.findUnique({
      where: {
        userId_questId_dayKey: { userId: user.id, questId: quest.id, dayKey }
      }
    });
    if (existing) {
      return res.status(409).json({ error: "Quest already completed today" });
    }

    const now = new Date();
    const payload = await awardQuestCompletion({
      user,
      quest,
      dayKey,
      availableQuests,
      customQuests,
      completionPercent: 100,
      elapsedMs: 0,
      now
    });
    res.json(payload);
  } catch (error) {
    console.error(`[Quest Complete Error] ${error?.message || error}`, error);
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Quest timer endpoints. Lifecycle: start → (pause → resume)* → stop.
// On stop, elapsed time is compared to quest.timeEstimateMin. The
// completion is finalized (partial XP 50/75/100%, or no award when
// <50%). Only 100% completions count toward the streak; <100%
// completions still register on the daily board.
// ─────────────────────────────────────────────────────────────

function computeTimerElapsedMs(session, now = new Date()) {
  const started = session.startedAt ? new Date(session.startedAt).getTime() : 0;
  if (!started) return 0;
  const pauseBaseline = session.pausedAt ? new Date(session.pausedAt).getTime() : now.getTime();
  const raw = Math.max(0, pauseBaseline - started - Number(session.totalPausedMs || 0));
  return raw;
}

async function loadActiveTimerSession(userId, questId, dayKey) {
  return prisma.questTimerSession.findFirst({
    where: { userId, questId, dayKey, status: { in: ["running", "paused"] } },
    orderBy: { createdAt: "desc" }
  });
}

// A user may have at most this many timer sessions active (running OR paused)
// at any moment — prevents opening Start on every timed quest at once.
const MAX_CONCURRENT_TIMERS = 2;

app.post("/api/quests/timer/start", async (req, res) => {
  try {
    const language = getRequestLanguage(req);
    const parsed = z.object({
      username: z.string().min(2).max(64),
      questId: z.number().int().min(1)
    }).parse(req.body);

    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const now = new Date();
    const dayKey = getDateKey(now);
    const todayCompletions = await prisma.questCompletion.findMany({
      where: { userId: user.id, dayKey },
      select: { questId: true }
    });
    const customQuests = await fetchUserCustomQuests(user.id);
    const available = composeDailyQuests(user, todayCompletions.map((t) => t.questId), now, [], language, customQuests);
    const quest = available.find((q) => q.id === parsed.questId);
    if (!quest) return res.status(404).json({ error: "Quest not on today's board" });
    if (!quest.needsTimer) return res.status(400).json({ error: "Quest has no timer" });

    const already = await prisma.questCompletion.findUnique({
      where: { userId_questId_dayKey: { userId: user.id, questId: quest.id, dayKey } }
    });
    if (already) return res.status(409).json({ error: "Quest already completed today" });

    const existing = await loadActiveTimerSession(user.id, quest.id, dayKey);
    if (existing) {
      return res.json({ ok: true, session: serializeTimerSession(existing, now), reused: true });
    }

    // Concurrency gate — a user may only run MAX_CONCURRENT_TIMERS timer
    // sessions at once. Counts any running/paused session for today except
    // the one this request is starting (the quest itself had no active
    // session at this point — `existing` was null above).
    const activeCount = await prisma.questTimerSession.count({
      where: { userId: user.id, dayKey, status: { in: ["running", "paused"] } }
    });
    if (activeCount >= MAX_CONCURRENT_TIMERS) {
      return res.status(409).json({
        error: "Timer limit reached",
        code: "timer_limit",
        limit: MAX_CONCURRENT_TIMERS,
        activeCount
      });
    }

    const created = await prisma.questTimerSession.create({
      data: {
        userId: user.id,
        questId: quest.id,
        dayKey,
        startedAt: now,
        status: "running"
      }
    });
    res.json({ ok: true, session: serializeTimerSession(created, now) });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/quests/timer/pause", async (req, res) => {
  try {
    const parsed = z.object({
      username: z.string().min(2).max(64),
      questId: z.number().int().min(1)
    }).parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const now = new Date();
    const dayKey = getDateKey(now);
    const session = await loadActiveTimerSession(user.id, parsed.questId, dayKey);
    if (!session) return res.status(404).json({ error: "No active timer" });
    if (session.status === "paused") {
      return res.json({ ok: true, session: serializeTimerSession(session, now) });
    }

    const updated = await prisma.questTimerSession.update({
      where: { id: session.id },
      data: { status: "paused", pausedAt: now }
    });
    res.json({ ok: true, session: serializeTimerSession(updated, now) });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/quests/timer/resume", async (req, res) => {
  try {
    const parsed = z.object({
      username: z.string().min(2).max(64),
      questId: z.number().int().min(1)
    }).parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const now = new Date();
    const dayKey = getDateKey(now);
    const session = await loadActiveTimerSession(user.id, parsed.questId, dayKey);
    if (!session) return res.status(404).json({ error: "No timer to resume" });
    if (session.status === "running") {
      return res.json({ ok: true, session: serializeTimerSession(session, now) });
    }

    const pausedMsAdded = session.pausedAt
      ? Math.max(0, now.getTime() - new Date(session.pausedAt).getTime())
      : 0;
    const updated = await prisma.questTimerSession.update({
      where: { id: session.id },
      data: {
        status: "running",
        pausedAt: null,
        totalPausedMs: Number(session.totalPausedMs || 0) + pausedMsAdded
      }
    });
    res.json({ ok: true, session: serializeTimerSession(updated, now) });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/quests/timer/stop", async (req, res) => {
  try {
    const language = getRequestLanguage(req);
    const parsed = z.object({
      username: z.string().min(2).max(64),
      questId: z.number().int().min(1)
    }).parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const now = new Date();
    const dayKey = getDateKey(now);
    const session = await loadActiveTimerSession(user.id, parsed.questId, dayKey);
    if (!session) return res.status(404).json({ error: "No active timer" });

    // If we stop while paused, finalize paused duration into totalPausedMs
    // so elapsed excludes pause time.
    const pausedMsAdded = session.pausedAt
      ? Math.max(0, now.getTime() - new Date(session.pausedAt).getTime())
      : 0;
    const totalPausedMs = Number(session.totalPausedMs || 0) + pausedMsAdded;
    const elapsedMs = Math.max(0, now.getTime() - new Date(session.startedAt).getTime() - totalPausedMs);

    const todayCompletions = await prisma.questCompletion.findMany({
      where: { userId: user.id, dayKey },
      select: { questId: true }
    });
    const customQuests = await fetchUserCustomQuests(user.id);
    const availableQuests = composeDailyQuests(user, todayCompletions.map((t) => t.questId), now, [], language, customQuests);
    const quest = availableQuests.find((q) => q.id === parsed.questId);
    if (!quest) return res.status(404).json({ error: "Quest not on today's board" });

    const targetMs = Math.max(1, Number(quest.timeEstimateMin || 0) * 60 * 1000);
    const rawPercent = (elapsedMs / targetMs) * 100;
    const completionPercent = quantizeCompletionPercent(rawPercent);

    // Always finalize the timer session, even when below threshold, so the
    // user is not stuck with a stale "running" session on their board.
    await prisma.questTimerSession.update({
      where: { id: session.id },
      data: {
        status: "stopped",
        pausedAt: null,
        totalPausedMs,
        stoppedAt: now,
        elapsedMs,
        percent: completionPercent
      }
    });

    if (completionPercent < 50) {
      return res.json({
        ok: true,
        completed: false,
        completionPercent: 0,
        elapsedMs,
        rawPercent: Math.round(rawPercent),
        message: "Below 50% threshold — no XP awarded."
      });
    }

    const alreadyCompleted = await prisma.questCompletion.findUnique({
      where: { userId_questId_dayKey: { userId: user.id, questId: quest.id, dayKey } }
    });
    if (alreadyCompleted) {
      return res.status(409).json({ error: "Quest already completed today" });
    }

    const payload = await awardQuestCompletion({
      user,
      quest,
      dayKey,
      availableQuests,
      customQuests,
      completionPercent,
      elapsedMs,
      now
    });
    res.json({ ...payload, completed: true, rawPercent: Math.round(rawPercent) });
  } catch (error) {
    console.error(`[Timer Stop Error] ${error?.message || error}`, error);
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

function serializeTimerSession(session, now = new Date()) {
  return {
    id: session.id,
    questId: session.questId,
    status: session.status,
    startedAt: session.startedAt,
    pausedAt: session.pausedAt ?? null,
    totalPausedMs: Number(session.totalPausedMs || 0),
    elapsedMs: session.status === "stopped"
      ? Number(session.elapsedMs || 0)
      : computeTimerElapsedMs(session, now)
  };
}

// ─────────────────────────────────────────────────────────────
// Counter-mechanic quests (hydration). Each "tick" increments
// count by delta (1..counterMaxPerTick) with a cooldown window
// between ticks to block spam-taps. When count >= target the
// quest is finalized via awardQuestCompletion.
// ─────────────────────────────────────────────────────────────

function serializeCounter(counter, quest, now = new Date()) {
  // Rolling-window model: user may tick up to counterMaxPerTick times
  // within a counterCooldownMin-minute window; once the window is full
  // they must wait until the window's start + cooldown elapses.
  const windowMs = Math.max(0, Number(quest?.counterCooldownMin || 0)) * 60_000;
  const maxInWindow = Math.max(1, Number(quest?.counterMaxPerTick || 1));
  const windowStartMs = counter?.windowStartAt ? new Date(counter.windowStartAt).getTime() : 0;
  const windowTicks = Number(counter?.windowTicks || 0);
  const windowEndsMs = windowStartMs ? windowStartMs + windowMs : 0;
  const windowActive = windowStartMs > 0 && now.getTime() < windowEndsMs;
  const cooldownActive = windowActive && windowTicks >= maxInWindow;
  const nextAllowedAt = cooldownActive ? new Date(windowEndsMs) : now;
  const ticksLeftInWindow = windowActive ? Math.max(0, maxInWindow - windowTicks) : maxInWindow;
  return {
    count: Number(counter?.count || 0),
    target: Number(quest?.targetCount || counter?.target || 0),
    lastTickAt: counter?.lastTickAt ?? null,
    windowStartAt: counter?.windowStartAt ?? null,
    windowTicks,
    windowEndsAt: windowActive ? new Date(windowEndsMs).toISOString() : null,
    nextAllowedAt: nextAllowedAt.toISOString(),
    cooldownMin: Math.max(0, Number(quest?.counterCooldownMin || 0)),
    maxPerTick: 1,
    maxInWindow,
    ticksLeftInWindow,
    unit: String(quest?.counterUnit || "")
  };
}

app.get("/api/quests/counter/:username/:questId", async (req, res) => {
  try {
    const language = getRequestLanguage(req);
    const username = slugifyUsername(req.params.username);
    const questId = Number(req.params.questId);
    if (!Number.isInteger(questId) || questId < 1) {
      return res.status(400).json({ error: "Invalid questId" });
    }
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const now = new Date();
    const dayKey = getDateKey(now);
    const todayCompletions = await prisma.questCompletion.findMany({
      where: { userId: user.id, dayKey },
      select: { questId: true }
    });
    const customQuests = await fetchUserCustomQuests(user.id);
    const available = composeDailyQuests(user, todayCompletions.map((t) => t.questId), now, [], language, customQuests);
    const quest = available.find((q) => q.id === questId);
    if (!quest) return res.status(404).json({ error: "Quest not on today's board" });
    if (quest.mechanic !== "counter") return res.status(400).json({ error: "Quest is not a counter" });

    const counter = await prisma.questCounter.findUnique({
      where: { userId_questId_dayKey: { userId: user.id, questId, dayKey } }
    });
    res.json({ ok: true, counter: serializeCounter(counter, quest, now) });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/quests/counter/tick", async (req, res) => {
  try {
    const language = getRequestLanguage(req);
    const parsed = z.object({
      username: z.string().min(2).max(64),
      questId: z.number().int().min(1)
    }).parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const now = new Date();
    const dayKey = getDateKey(now);
    const todayCompletions = await prisma.questCompletion.findMany({
      where: { userId: user.id, dayKey },
      orderBy: { completedAt: "asc" },
      select: { questId: true }
    });
    const customQuests = await fetchUserCustomQuests(user.id);
    const availableQuests = composeDailyQuests(user, todayCompletions.map((t) => t.questId), now, [], language, customQuests);
    const quest = availableQuests.find((q) => q.id === parsed.questId);
    if (!quest) return res.status(404).json({ error: "Quest not on today's board" });
    if (quest.mechanic !== "counter") return res.status(400).json({ error: "Quest is not a counter" });

    const target = Math.max(1, Number(quest.targetCount) || 1);
    // Each tick is always +1. Rolling window: up to counterMaxPerTick
    // (default 3) ticks per counterCooldownMin-minute window; the window
    // starts on the first tick and resets once the window expires.
    const maxInWindow = Math.max(1, Number(quest.counterMaxPerTick) || 1);
    const windowMs = Math.max(0, Number(quest.counterCooldownMin) || 0) * 60_000;

    const already = await prisma.questCompletion.findUnique({
      where: { userId_questId_dayKey: { userId: user.id, questId: quest.id, dayKey } }
    });
    if (already) {
      return res.status(409).json({ error: "Quest already completed today", code: "already_complete" });
    }

    const existing = await prisma.questCounter.findUnique({
      where: { userId_questId_dayKey: { userId: user.id, questId: quest.id, dayKey } }
    });

    const windowStartMs = existing?.windowStartAt ? new Date(existing.windowStartAt).getTime() : 0;
    const windowTicks = Number(existing?.windowTicks || 0);
    const windowOpen = windowStartMs > 0 && now.getTime() < windowStartMs + windowMs;

    let nextWindowStartAt;
    let nextWindowTicks;
    if (!windowOpen) {
      nextWindowStartAt = now;
      nextWindowTicks = 1;
    } else if (windowTicks < maxInWindow) {
      nextWindowStartAt = new Date(windowStartMs);
      nextWindowTicks = windowTicks + 1;
    } else {
      const nextAt = new Date(windowStartMs + windowMs);
      return res.status(429).json({
        error: "Cooldown active",
        code: "counter_cooldown",
        nextAllowedAt: nextAt.toISOString(),
        counter: serializeCounter(existing, quest, now)
      });
    }

    const prevCount = Number(existing?.count || 0);
    const newCount = Math.min(target, prevCount + 1);

    const saved = await prisma.questCounter.upsert({
      where: { userId_questId_dayKey: { userId: user.id, questId: quest.id, dayKey } },
      create: {
        userId: user.id,
        questId: quest.id,
        dayKey,
        count: newCount,
        target,
        lastTickAt: now,
        windowStartAt: nextWindowStartAt,
        windowTicks: nextWindowTicks
      },
      update: {
        count: newCount,
        target,
        lastTickAt: now,
        windowStartAt: nextWindowStartAt,
        windowTicks: nextWindowTicks
      }
    });

    if (newCount >= target) {
      const payload = await awardQuestCompletion({
        user,
        quest,
        dayKey,
        availableQuests,
        customQuests,
        completionPercent: 100,
        elapsedMs: 0,
        now
      });
      return res.json({ ok: true, completed: true, counter: serializeCounter(saved, quest, now), ...payload });
    }

    res.json({ ok: true, completed: false, counter: serializeCounter(saved, quest, now) });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Note-mechanic quests (reflection/gratitude) and words-mechanic
// (English vocab pairs). Submission validates the payload and
// finalizes the completion in one shot. Notes persist in
// QuestNote so users can review history in the profile.
// ─────────────────────────────────────────────────────────────

app.post("/api/quests/note/submit", async (req, res) => {
  try {
    const language = getRequestLanguage(req);
    const parsed = z.object({
      username: z.string().min(2).max(64),
      questId: z.number().int().min(1),
      kind: z.enum(["reflection", "gratitude", "words"]).default("reflection"),
      items: z.array(z.object({
        text: z.string().max(2000).optional(),
        word: z.string().max(120).optional(),
        translation: z.string().max(240).optional()
      })).min(1).max(50)
    }).parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const now = new Date();
    const dayKey = getDateKey(now);
    const todayCompletions = await prisma.questCompletion.findMany({
      where: { userId: user.id, dayKey },
      orderBy: { completedAt: "asc" },
      select: { questId: true }
    });
    const customQuests = await fetchUserCustomQuests(user.id);
    const availableQuests = composeDailyQuests(user, todayCompletions.map((t) => t.questId), now, [], language, customQuests);
    const quest = availableQuests.find((q) => q.id === parsed.questId);
    if (!quest) return res.status(404).json({ error: "Quest not on today's board" });

    const already = await prisma.questCompletion.findUnique({
      where: { userId_questId_dayKey: { userId: user.id, questId: quest.id, dayKey } }
    });
    if (already) return res.status(409).json({ error: "Quest already completed today", code: "already_complete" });

    // Validate payload shape against the quest mechanic.
    if (quest.mechanic === "note") {
      const requiredItems = Math.max(1, Number(quest.minItems) || 1);
      const minLength = Math.max(1, Number(quest.noteMinLength) || 10);
      const cleaned = parsed.items
        .map((item) => ({ text: String(item?.text || "").trim() }))
        .filter((item) => item.text.length >= minLength);
      if (cleaned.length < requiredItems) {
        return res.status(400).json({
          error: "Not enough notes",
          code: "note_too_short",
          required: requiredItems,
          minLength,
          received: cleaned.length
        });
      }
      await prisma.questNote.create({
        data: {
          userId: user.id,
          questId: quest.id,
          dayKey,
          kind: parsed.kind === "words" ? "reflection" : parsed.kind,
          payload: JSON.stringify({ kind: parsed.kind, items: cleaned })
        }
      });
    } else if (quest.mechanic === "words") {
      const required = Math.max(1, Number(quest.targetCount) || 1);
      const cleaned = parsed.items
        .map((item) => ({
          word: String(item?.word || "").trim(),
          translation: String(item?.translation || "").trim()
        }))
        .filter((pair) => pair.word.length >= 1 && pair.translation.length >= 1);
      if (cleaned.length < required) {
        return res.status(400).json({
          error: "Not enough word pairs",
          code: "words_incomplete",
          required,
          received: cleaned.length
        });
      }
      await prisma.questNote.create({
        data: {
          userId: user.id,
          questId: quest.id,
          dayKey,
          kind: "words",
          payload: JSON.stringify({ kind: "words", items: cleaned.slice(0, required) })
        }
      });
    } else {
      return res.status(400).json({ error: "Quest does not accept notes" });
    }

    const payload = await awardQuestCompletion({
      user,
      quest,
      dayKey,
      availableQuests,
      customQuests,
      completionPercent: 100,
      elapsedMs: 0,
      now
    });
    res.json({ ok: true, ...payload });
  } catch (error) {
    console.error(`[Note Submit Error] ${error?.message || error}`, error);
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Personal notes — free-form journal entries not tied to any quest.
// Stored in QuestNote with questId=0 + kind="personal" so history queries
// pick them up alongside quest-generated notes without a schema change.
app.post("/api/notes/personal/create", async (req, res) => {
  try {
    const parsed = z.object({
      username: z.string().min(2).max(64),
      text: z.string().min(1).max(4000)
    }).parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const text = parsed.text.trim();
    if (!text) return res.status(400).json({ error: "Text required", code: "text_required" });

    const now = new Date();
    const dayKey = getDateKey(now);
    const note = await prisma.questNote.create({
      data: {
        userId: user.id,
        questId: 0,
        dayKey,
        kind: "personal",
        payload: JSON.stringify({ kind: "personal", items: [{ text }] })
      }
    });
    res.json({
      ok: true,
      entry: {
        id: note.id,
        questId: 0,
        dayKey,
        kind: "personal",
        items: [{ text }],
        createdAt: note.createdAt
      }
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// PATCH /api/notes/personal/:id — edit a previously-created personal note.
// Only the owner can edit, and only notes of kind="personal" (vocabulary
// and reflection notes belong to completed quests and stay immutable).
app.patch("/api/notes/personal/:id", async (req, res) => {
  try {
    const parsed = z.object({
      username: z.string().min(2).max(64),
      text: z.string().min(1).max(4000)
    }).parse(req.body);
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "id required" });
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const note = await prisma.questNote.findUnique({ where: { id } });
    if (!note || note.userId !== user.id) {
      return res.status(404).json({ error: "Note not found" });
    }
    if (note.kind !== "personal") {
      return res.status(403).json({ error: "Only personal notes can be edited", code: "forbidden_kind" });
    }

    const text = parsed.text.trim();
    if (!text) return res.status(400).json({ error: "Text required", code: "text_required" });

    const updated = await prisma.questNote.update({
      where: { id },
      data: { payload: JSON.stringify({ kind: "personal", items: [{ text }] }) }
    });
    res.json({
      ok: true,
      entry: {
        id: updated.id,
        questId: 0,
        dayKey: updated.dayKey,
        kind: "personal",
        items: [{ text }],
        createdAt: updated.createdAt
      }
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.delete("/api/notes/personal/:id", async (req, res) => {
  try {
    const parsed = z.object({ username: z.string().min(2).max(64) }).parse(req.query);
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "id required" });
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const note = await prisma.questNote.findUnique({ where: { id } });
    if (!note || note.userId !== user.id) {
      return res.status(404).json({ error: "Note not found" });
    }
    if (note.kind !== "personal") {
      return res.status(403).json({ error: "Only personal notes can be deleted", code: "forbidden_kind" });
    }
    await prisma.questNote.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.get("/api/notes/history/:username", async (req, res) => {
  try {
    const username = slugifyUsername(req.params.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 60));
    const notes = await prisma.questNote.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit
    });

    const entries = notes.map((note) => {
      let parsed = {};
      try { parsed = JSON.parse(note.payload || "{}"); } catch { parsed = {}; }
      return {
        id: note.id,
        questId: note.questId,
        dayKey: note.dayKey,
        kind: String(parsed.kind || note.kind || "reflection"),
        items: Array.isArray(parsed.items) ? parsed.items : [],
        createdAt: note.createdAt
      };
    });
    res.json({ ok: true, entries });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

const CITY_SPIN_REWARDS = [
  { id: 1,  type: "xp",    amount: 25,  weight: 25 },
  { id: 2,  type: "token", amount: 1,   weight: 25 },
  { id: 3,  type: "token", amount: 3,   weight: 15 },
  { id: 4,  type: "xp",    amount: 50,  weight: 15 },
  { id: 5,  type: "xp",    amount: 75,  weight: 5  },
  { id: 6,  type: "xp",    amount: 100, weight: 5  },
  { id: 7,  type: "token", amount: 5,   weight: 3  },
  { id: 8,  type: "token", amount: 10,  weight: 3  },
  { id: 9,  type: "xp",    amount: 300, weight: 3  },
  { id: 10, type: "level", amount: 1,   weight: 1  },
];
const SPIN_CLAIM_SECRET = String(process.env.SPIN_CLAIM_SECRET || process.env.ADMIN_TOKEN || "life-rpg-spin-claim-dev-secret");

// Fallback for environments where Prisma client wasn't regenerated yet and
// still rejects the lastCitySpinDayKey field. Process-local, server-side only.
const citySpinFallbackDayByUserId = new Map();

function isMissingCitySpinFieldError(error) {
  const msg = String(error?.message || "");
  return msg.includes("lastCitySpinDayKey") && msg.includes("Unknown argument");
}

function toBase64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function safeParseBase64UrlJson(value) {
  try {
    return JSON.parse(Buffer.from(String(value || ""), "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function signSpinClaimPayload(payloadB64) {
  return createHmac("sha256", SPIN_CLAIM_SECRET).update(payloadB64).digest("base64url");
}

function createSpinClaimToken({ userId, username, reward, dayKey, expiresAtMs }) {
  const payload = {
    v: 1,
    userId,
    username,
    reward: { id: reward.id, type: reward.type, amount: reward.amount },
    dayKey,
    exp: expiresAtMs
  };
  const payloadB64 = toBase64UrlJson(payload);
  const signature = signSpinClaimPayload(payloadB64);
  return `${payloadB64}.${signature}`;
}

function verifySpinClaimToken(token) {
  const [payloadB64, signature] = String(token || "").split(".");
  if (!payloadB64 || !signature) return null;

  const expected = signSpinClaimPayload(payloadB64);
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (signatureBuf.length !== expectedBuf.length || !timingSafeEqual(signatureBuf, expectedBuf)) {
    return null;
  }

  const payload = safeParseBase64UrlJson(payloadB64);
  if (!payload || typeof payload !== "object") return null;
  if (!Number.isFinite(Number(payload.exp)) || Date.now() > Number(payload.exp)) return null;
  return payload;
}

function pickCitySpinReward() {
  const totalWeight = CITY_SPIN_REWARDS.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const r of CITY_SPIN_REWARDS) {
    roll -= r.weight;
    if (roll <= 0) return r;
  }
  return CITY_SPIN_REWARDS[0];
}

function findSpinRewardById(id) {
  const rewardId = Number(id);
  return CITY_SPIN_REWARDS.find((item) => item.id === rewardId) || null;
}

function nextMidnightUTC(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function isAlreadySpunToday(user, todayKey) {
  const alreadySpunByField = user?.lastCitySpinDayKey === todayKey;
  const alreadySpunByFallback = user?.id ? citySpinFallbackDayByUserId.get(user.id) === todayKey : false;
  return alreadySpunByField || alreadySpunByFallback;
}

// Returns next allowed spin time based on Park district level.
function computeNextSpinAt(user, now = new Date()) {
  const parkLvl = districtLevelOf(user?.districtLevels, "park");
  const hours = PARK_SPIN_COOLDOWN_HOURS[Math.max(0, Math.min(5, parkLvl))];
  if (user?.lastCitySpinAt) {
    return new Date(new Date(user.lastCitySpinAt).getTime() + hours * 3600_000);
  }
  // Legacy path: timestamp not stamped yet. If the day-key marks today as spun,
  // approximate cooldown from start-of-today + perk hours so the Park perk
  // still takes effect. Otherwise the user hasn't spun — no cooldown.
  const todayKey = getDateKey(now);
  const legacyDone = user?.lastCitySpinDayKey === todayKey
    || (user?.id && citySpinFallbackDayByUserId.get(user.id) === todayKey);
  if (!legacyDone) return now;
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  return new Date(startOfToday.getTime() + hours * 3600_000);
}
function isSpinOnCooldown(user, now = new Date()) {
  const next = computeNextSpinAt(user, now);
  return next.getTime() > now.getTime();
}

async function applyCitySpinReward(user, reward, todayKey) {
  const updateData = { lastCitySpinDayKey: todayKey };

  if (reward.type === "xp") {
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    let xp = fresh.xp + reward.amount;
    let level = fresh.level;
    let xpNext = fresh.xpNext;
    while (xp >= xpNext) {
      xp -= xpNext;
      level += 1;
      xpNext = Math.floor(xpNext * 1.1);
    }
    try {
      return await prisma.user.update({ where: { id: user.id }, data: { ...updateData, xp, level, xpNext } });
    } catch (error) {
      if (!isMissingCitySpinFieldError(error)) throw error;
      console.warn("[City Spin] Fallback cooldown mode active: missing lastCitySpinDayKey in Prisma client");
      citySpinFallbackDayByUserId.set(user.id, todayKey);
      return await prisma.user.update({ where: { id: user.id }, data: { xp, level, xpNext } });
    }
  }

  if (reward.type === "token") {
    try {
      return await prisma.user.update({ where: { id: user.id }, data: { ...updateData, tokens: { increment: reward.amount } } });
    } catch (error) {
      if (!isMissingCitySpinFieldError(error)) throw error;
      console.warn("[City Spin] Fallback cooldown mode active: missing lastCitySpinDayKey in Prisma client");
      citySpinFallbackDayByUserId.set(user.id, todayKey);
      return await prisma.user.update({ where: { id: user.id }, data: { tokens: { increment: reward.amount } } });
    }
  }

  if (reward.type === "level") {
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    const newLevel = fresh.level + 1;
    const newXpNext = Math.floor(fresh.xpNext * 1.1);
    try {
      return await prisma.user.update({ where: { id: user.id }, data: { ...updateData, level: newLevel, xp: 0, xpNext: newXpNext } });
    } catch (error) {
      if (!isMissingCitySpinFieldError(error)) throw error;
      console.warn("[City Spin] Fallback cooldown mode active: missing lastCitySpinDayKey in Prisma client");
      citySpinFallbackDayByUserId.set(user.id, todayKey);
      return await prisma.user.update({ where: { id: user.id }, data: { level: newLevel, xp: 0, xpNext: newXpNext } });
    }
  }

  throw new Error("Unsupported city spin reward type");
}

app.get("/api/city/spin-status/:username", async (req, res) => {
  try {
    const username = slugifyUsername(req.params.username);
    const user = await prisma.user.findUnique({
      where: { username },
      select: { lastCitySpinDayKey: true, lastCitySpinAt: true, districtLevels: true }
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    const now = new Date();
    const parkLvl = districtLevelOf(user.districtLevels, "park");
    // Park 0 → wheel is hard-locked. Surface that state so the client
    // can render a "Upgrade Park to spin" CTA distinct from cooldown.
    const locked = parkLvl < 1;
    const next = computeNextSpinAt(user, now);
    const alreadySpun = !locked && next.getTime() > now.getTime();
    return res.json({ locked, alreadySpun, nextSpinAt: next.toISOString() });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Single-shot spin: pick a reward, apply it, and stamp the cooldown in one
// request. This replaces the old two-step spin→claim dance — if the user
// closed the app after spinning the reward was silently dropped and the
// cooldown never reset. Now everything happens atomically server-side, and
// the client just animates the wheel to the correct segment.
app.post("/api/city/spin", async (req, res) => {
  const schema = z.object({ username: z.string().min(2).max(64) });
  try {
    const { username } = schema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username: slugifyUsername(username) } });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Park gate — Wheel of Fortune is fully locked until Park is
    // upgraded to level 1. The 48h "cooldown" entry in the table is
    // never reached for spins; it stays only as a defensive default.
    const parkLvl = districtLevelOf(user.districtLevels, "park");
    if (parkLvl < 1) {
      return res.status(400).json({
        ok: false,
        error: "Wheel of Fortune is locked — upgrade Park to level 1 to spin.",
        code: "park_locked"
      });
    }

    const now = new Date();
    const todayKey = getDateKey(now);
    if (isSpinOnCooldown(user, now)) {
      return res.json({
        ok: false,
        alreadySpun: true,
        nextSpinAt: computeNextSpinAt(user, now).toISOString()
      });
    }

    const reward = pickCitySpinReward();

    // Apply the reward AND stamp lastCitySpinAt so the cooldown resets
    // immediately after the click — even if the user closes the app before
    // the animation finishes, they still got credit for the spin.
    const rewardedUser = await applyCitySpinReward(user, reward, todayKey);
    // Fire-and-forget eval — covers level-up via wheel (lvl_10/30/100).
    trackAchievements(user.id);
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastCitySpinAt: now }
      });
    } catch (e) {
      console.warn("[City Spin] failed to set lastCitySpinAt:", e?.message || e);
    }

    const nextSpinAt = computeNextSpinAt(
      { ...rewardedUser, lastCitySpinAt: now, districtLevels: user.districtLevels },
      now
    ).toISOString();

    return res.json({
      ok: true,
      claimed: true,
      reward: { id: reward.id, type: reward.type, amount: reward.amount },
      user: {
        level: rewardedUser.level,
        xp: rewardedUser.xp,
        xpNext: rewardedUser.xpNext,
        tokens: rewardedUser.tokens
      },
      nextSpinAt
    });
  } catch (error) {
    console.error(`[City Spin Error] ${error?.message || error}`);
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/city/spin/claim", async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(64),
    claimToken: z.string().min(12)
  });

  try {
    const { username, claimToken } = schema.parse(req.body);
    const normalizedUsername = slugifyUsername(username);
    const user = await prisma.user.findUnique({ where: { username: normalizedUsername } });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Park gate — same lockout as /api/city/spin so claim tokens
    // minted before a downgrade can't be replayed.
    const parkLvl = districtLevelOf(user.districtLevels, "park");
    if (parkLvl < 1) {
      return res.status(400).json({
        ok: false,
        error: "Wheel of Fortune is locked — upgrade Park to level 1 to spin.",
        code: "park_locked"
      });
    }

    const payload = verifySpinClaimToken(claimToken);
    if (!payload) {
      return res.status(400).json({ error: "Invalid or expired claim token" });
    }

    const now = new Date();
    const todayKey = getDateKey(now);
    if (isSpinOnCooldown(user, now)) {
      return res.json({ ok: false, alreadySpun: true, nextSpinAt: computeNextSpinAt(user, now).toISOString() });
    }

    if (
      payload.v !== 1 ||
      payload.userId !== user.id ||
      payload.username !== user.username ||
      payload.dayKey !== todayKey
    ) {
      return res.status(400).json({ error: "Claim token does not match current user/session" });
    }

    const reward = findSpinRewardById(payload?.reward?.id);
    if (!reward || reward.type !== payload?.reward?.type || reward.amount !== Number(payload?.reward?.amount)) {
      return res.status(400).json({ error: "Invalid claim reward payload" });
    }

    const finalUser = await applyCitySpinReward(user, reward, todayKey);
    // Stamp actual spin time so cooldown starts from now
    try {
      await prisma.user.update({ where: { id: user.id }, data: { lastCitySpinAt: now } });
    } catch (e) {
      console.warn("[City Spin] failed to set lastCitySpinAt:", e?.message || e);
    }
    const nextSpinAt = computeNextSpinAt({ ...finalUser, lastCitySpinAt: now, districtLevels: user.districtLevels }, now).toISOString();

    return res.json({
      ok: true,
      claimed: true,
      reward: { id: reward.id, type: reward.type, amount: reward.amount },
      user: { level: finalUser.level, xp: finalUser.xp, xpNext: finalUser.xpNext, tokens: finalUser.tokens },
      nextSpinAt
    });
  } catch (error) {
    console.error(`[City Spin Claim Error] ${error?.message || error}`);
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

const DISTRICT_IDS = ["sport", "business", "park", "square", "residential"];
const DISTRICT_UPGRADE_REQS = [
  { level: 2,  tokens: 5,   streak: 0  },
  { level: 7,  tokens: 15,  streak: 0  },
  { level: 13, tokens: 25,  streak: 5  },
  { level: 21, tokens: 50,  streak: 10 },
  { level: 33, tokens: 100, streak: 21 }
];
const DISTRICT_MAX_LEVEL = 5;

function districtLevelOf(levelsStr, id) {
  const idx = DISTRICT_IDS.indexOf(id);
  if (idx < 0) return 0;
  const raw = String(levelsStr || "0,0,0,0,0").split(",");
  const n = Number(raw[idx]);
  return Number.isFinite(n) ? Math.max(0, Math.min(DISTRICT_MAX_LEVEL, Math.floor(n))) : 0;
}
// Spin Wheel cooldown in hours, by Park district level (0..5)
const PARK_SPIN_COOLDOWN_HOURS = [48, 24, 20, 16, 12, 8];
// Sport XP multiplier: +5% per level
function sportXpBonus(lvl) { return 1 + Math.max(0, Math.min(5, lvl)) * 0.05; }
// Square: tokens on full daily board = district level
// Residential shop discount tokens
function residentialShopDiscount(lvl) {
  if (lvl >= 5) return 2;
  if (lvl >= 1) return 1;
  return 0;
}
// Residential monthly freeze grants (0/0/1/1/2/2)
function residentialMonthlyFreezeCap(lvl) {
  if (lvl >= 4) return 2;
  if (lvl >= 2) return 1;
  return 0;
}

function parseDistrictLevels(value) {
  const raw = String(value || "0,0,0,0,0").split(",");
  const out = [0, 0, 0, 0, 0];
  for (let i = 0; i < 5; i++) {
    const n = Number(raw[i]);
    out[i] = Number.isFinite(n) ? Math.max(0, Math.min(DISTRICT_MAX_LEVEL, Math.floor(n))) : 0;
  }
  return out;
}

function serializeDistrictLevels(levels) {
  return levels.slice(0, 5).map((n) => String(Math.max(0, Math.min(DISTRICT_MAX_LEVEL, Math.floor(Number(n) || 0))))).join(",");
}

app.post("/api/city/upgrade-district", async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(64),
    districtId: z.enum(DISTRICT_IDS)
  });
  try {
    const { username, districtId } = schema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username: slugifyUsername(username) } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const levels = parseDistrictLevels(user.districtLevels);
    const idx = DISTRICT_IDS.indexOf(districtId);
    const currentLevel = levels[idx];
    if (currentLevel >= DISTRICT_MAX_LEVEL) {
      return res.status(400).json({ error: "District already at max level", code: "max_level" });
    }
    const req_ = DISTRICT_UPGRADE_REQS[currentLevel];
    const userLevel = Number(user.level) || 0;
    const userTokens = Number(user.tokens) || 0;
    const userStreak = Number(user.streak) || 0;
    // Onboarding freebie: while the animated tour is still in progress
    // (onboardingTourCompletedAt == null), the user can lift Park from
    // level 0 → 1 once without paying tokens or meeting streak/level
    // requirements. This powers the "let's upgrade Park together" tour
    // step. Every other upgrade keeps the normal gates.
    const isTourFreebie = (
      !user.onboardingTourCompletedAt
      && districtId === "park"
      && currentLevel === 0
    );
    if (!isTourFreebie) {
      if (userLevel < req_.level) {
        return res.status(400).json({ error: "Player level too low", code: "insufficient_level", required: req_.level, current: userLevel });
      }
      if (userTokens < req_.tokens) {
        return res.status(400).json({ error: "Not enough tokens", code: "insufficient_tokens", required: req_.tokens, current: userTokens });
      }
      if (userStreak < req_.streak) {
        return res.status(400).json({ error: "Streak too low", code: "insufficient_streak", required: req_.streak, current: userStreak });
      }
    }

    levels[idx] = currentLevel + 1;
    const nextLevelsStr = serializeDistrictLevels(levels);

    // Residential threshold grants — when a level transition raises the
    // player's monthly-freeze cap (lvl 1→2 unlocks 1/mo, lvl 3→4 doubles
    // to 2/mo) we hand out a charge immediately and start the 30-day
    // cycle clock from now. First time crossing into lvl 3 also unlocks
    // the Vacation perk (one-shot 20-charge bundle, 365-day cooldown).
    const now = new Date();
    let residentialFreezeGranted = 0;
    let residentialVacationGranted = 0;
    const residentialPatch = {};
    if (districtId === "residential") {
      const oldCap = residentialMonthlyFreezeCap(currentLevel);
      const newCap = residentialMonthlyFreezeCap(levels[idx]);
      if (newCap > oldCap) {
        residentialFreezeGranted = 1;
        residentialPatch.monthlyFreezeClaims = serializeResidentialFreezeState(now);
      }
      if (levels[idx] >= 3 && !user.lastVacationAt) {
        residentialVacationGranted = 20;
        residentialPatch.lastVacationAt = now;
      }
    }

    const data = {
      tokens: isTourFreebie ? undefined : { decrement: req_.tokens },
      districtLevels: nextLevelsStr,
      ...residentialPatch
    };
    const totalChargeBump = residentialFreezeGranted + residentialVacationGranted;
    if (totalChargeBump > 0) {
      data.streakFreezeCharges = { increment: totalChargeBump };
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
      select: { tokens: true, districtLevels: true, streakFreezeCharges: true }
    });

    return res.json({
      ok: true,
      districtId,
      level: levels[idx],
      cost: isTourFreebie ? 0 : req_.tokens,
      tourFreebie: isTourFreebie,
      tokens: updated.tokens,
      districtLevels: parseDistrictLevels(updated.districtLevels),
      streakFreezeCharges: updated.streakFreezeCharges,
      grants: {
        freeze: residentialFreezeGranted,
        vacation: residentialVacationGranted
      }
    });
  } catch (error) {
    console.error(`[District Upgrade Error] ${error?.message || error}`);
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/city/downgrade-district", async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(64),
    districtId: z.enum(DISTRICT_IDS)
  });
  try {
    const { username, districtId } = schema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username: slugifyUsername(username) } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const levels = parseDistrictLevels(user.districtLevels);
    const idx = DISTRICT_IDS.indexOf(districtId);
    const currentLevel = levels[idx];
    if (currentLevel <= 0) {
      return res.status(400).json({ error: "District already at minimum level", code: "min_level" });
    }

    levels[idx] = currentLevel - 1;
    const nextLevelsStr = serializeDistrictLevels(levels);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { districtLevels: nextLevelsStr },
      select: { tokens: true, districtLevels: true }
    });

    return res.json({
      ok: true,
      districtId,
      level: levels[idx],
      tokens: updated.tokens,
      districtLevels: parseDistrictLevels(updated.districtLevels)
    });
  } catch (error) {
    console.error(`[District Downgrade Error] ${error?.message || error}`);
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Business district — daily token claim (1 token/day per business level).
// Uses server day-key so users across zones share one reset.
app.post("/api/city/business/claim", async (req, res) => {
  const schema = z.object({ username: z.string().min(2).max(64) });
  try {
    const { username } = schema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username: slugifyUsername(username) } });
    if (!user) return res.status(404).json({ error: "User not found" });
    const businessLvl = districtLevelOf(user.districtLevels, "business");
    if (businessLvl <= 0) {
      return res.status(400).json({ error: "Business district not upgraded", code: "not_unlocked" });
    }
    const today = getDateKey(new Date());
    if (user.lastBusinessClaimDayKey === today) {
      return res.status(400).json({ error: "Already claimed today", code: "already_claimed", nextClaimAt: nextMidnightUTC().toISOString() });
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        tokens: { increment: businessLvl },
        lastBusinessClaimDayKey: today
      },
      select: { tokens: true, lastBusinessClaimDayKey: true }
    });
    return res.json({
      ok: true,
      granted: businessLvl,
      tokens: updated.tokens,
      lastBusinessClaimDayKey: updated.lastBusinessClaimDayKey,
      nextClaimAt: nextMidnightUTC().toISOString()
    });
  } catch (error) {
    console.error(`[Business Claim Error] ${error?.message || error}`);
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Residential — auto-grant free streak freezes on a 30-day rolling cycle
// (lvl 2–3 = 1 per cycle, lvl ≥4 = 2 per cycle). Charges land in the
// Profile pool and auto-consume on missed days. No manual claim — the
// grants happen on (a) the threshold upgrade itself (lvl 1→2 and 3→4),
// and (b) lazily during /api/game-state when a 30-day cycle has elapsed
// since the last grant. We persist `lastGrantAt` (ISO) inside the
// `monthlyFreezeClaims` field; legacy `{cycleStartAt,count}` rows are
// read forward by treating cycleStartAt as the previous lastGrantAt.
const FREEZE_CYCLE_DAYS = 30;
const FREEZE_CYCLE_MS = FREEZE_CYCLE_DAYS * 24 * 3600_000;
const VACATION_COOLDOWN_DAYS = 365;
const VACATION_COOLDOWN_MS = VACATION_COOLDOWN_DAYS * 24 * 3600_000;
// Sane cap on backfill so a user returning after a year-long absence
// doesn't suddenly get 12 charges in one shot. Keep modest.
const MAX_RESIDENTIAL_BACKFILL_CYCLES = 6;

function parseResidentialFreezeState(rawJson) {
  let parsed = null;
  try { parsed = JSON.parse(rawJson || "{}"); } catch { parsed = null; }
  if (!parsed || typeof parsed !== "object") return { lastGrantAt: null };
  if (parsed.lastGrantAt) {
    const d = new Date(parsed.lastGrantAt);
    if (!Number.isNaN(d.getTime())) return { lastGrantAt: d };
  }
  // Legacy migration — treat the old `cycleStartAt` as the previous
  // lastGrantAt so existing players keep their cycle clock.
  if (parsed.cycleStartAt) {
    const d = new Date(parsed.cycleStartAt);
    if (!Number.isNaN(d.getTime())) return { lastGrantAt: d };
  }
  return { lastGrantAt: null };
}

function serializeResidentialFreezeState(lastGrantAt) {
  return JSON.stringify({ lastGrantAt: new Date(lastGrantAt).toISOString() });
}

// Pure: compute the auto-grant deltas for a user's residential perks.
// Returns { freezeGranted, vacationGranted, dataPatch } where dataPatch
// is a Prisma update payload the caller merges into its own update.
// Idempotent if no time has elapsed.
function computeResidentialAutoGrants(user, now) {
  const resLvl = districtLevelOf(user.districtLevels, "residential");
  const cap = residentialMonthlyFreezeCap(resLvl);
  let freezeGranted = 0;
  let vacationGranted = 0;
  const dataPatch = {};

  if (cap > 0) {
    const { lastGrantAt } = parseResidentialFreezeState(user.monthlyFreezeClaims);
    if (!lastGrantAt) {
      // No history — start the clock now without granting. The threshold
      // grant on the upgrade endpoint covers the "you just unlocked it"
      // moment; lazy fetches should never retroactively reward an old
      // upgrade we never tracked.
      dataPatch.monthlyFreezeClaims = serializeResidentialFreezeState(now);
    } else {
      const elapsedMs = now.getTime() - lastGrantAt.getTime();
      if (elapsedMs >= FREEZE_CYCLE_MS) {
        const cycles = Math.min(MAX_RESIDENTIAL_BACKFILL_CYCLES, Math.floor(elapsedMs / FREEZE_CYCLE_MS));
        freezeGranted = cycles * cap;
        const nextLastGrantAt = new Date(lastGrantAt.getTime() + cycles * FREEZE_CYCLE_MS);
        dataPatch.monthlyFreezeClaims = serializeResidentialFreezeState(nextLastGrantAt);
      }
    }
  }

  if (resLvl >= 3) {
    if (!user.lastVacationAt) {
      // Same rationale as above — don't backfill vacation for an old
      // upgrade. Threshold grant in the upgrade endpoint owns this.
      // We still set lastVacationAt = now so the cooldown clock starts.
      dataPatch.lastVacationAt = now;
    } else {
      const elapsed = now.getTime() - new Date(user.lastVacationAt).getTime();
      if (elapsed >= VACATION_COOLDOWN_MS) {
        vacationGranted = 20;
        dataPatch.lastVacationAt = now;
      }
    }
  }

  const totalCharges = freezeGranted + vacationGranted;
  if (totalCharges > 0) {
    dataPatch.streakFreezeCharges = { increment: totalCharges };
  }
  return { freezeGranted, vacationGranted, dataPatch };
}

// Deprecated: residential perks now grant automatically — on the
// threshold upgrade itself and lazily when a 30-day cycle has elapsed
// (game-state endpoint runs computeResidentialAutoGrants on each fetch).
// The endpoints below stay 410-Gone so any cached old client gets a
// clean error instead of double-granting via the legacy logic.
app.post("/api/city/residential/claim-freeze", (_req, res) => {
  res.status(410).json({
    error: "Manual claim removed — Residential charges grant automatically.",
    code: "auto_grant_only"
  });
});

app.post("/api/city/residential/start-vacation", (_req, res) => {
  res.status(410).json({
    error: "Manual vacation start removed — the 20-charge bundle grants automatically when the cooldown elapses.",
    code: "auto_grant_only"
  });
});

// Consume N freeze charges to extend streak freeze expiry by N days.
// If not already frozen, starts at tomorrow; otherwise extends beyond current expiry.
app.post("/api/streak/use-freeze", async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(64),
    days: z.number().int().min(1).max(365).default(1)
  });
  try {
    const { username, days } = schema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username: slugifyUsername(username) } });
    if (!user) return res.status(404).json({ error: "User not found" });
    const charges = Number(user.streakFreezeCharges) || 0;
    if (charges < days) {
      return res.status(400).json({ error: "Not enough freeze charges", code: "insufficient_charges", available: charges, requested: days });
    }
    const now = new Date();
    const base = user.streakFreezeExpiresAt && new Date(user.streakFreezeExpiresAt) > now
      ? new Date(user.streakFreezeExpiresAt)
      : now;
    const extendedTo = new Date(base);
    extendedTo.setUTCDate(extendedTo.getUTCDate() + days);
    extendedTo.setUTCHours(0, 0, 0, 0);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        streakFreezeCharges: { decrement: days },
        streakFreezeExpiresAt: extendedTo
      },
      select: { streakFreezeCharges: true, streakFreezeExpiresAt: true }
    });
    return res.json({
      ok: true,
      days,
      streakFreezeCharges: updated.streakFreezeCharges,
      streakFreezeExpiresAt: updated.streakFreezeExpiresAt
    });
  } catch (error) {
    console.error(`[Use Freeze Error] ${error?.message || error}`);
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Client calls this once after the "your streak burned out" dialog
// closes, so the next /game-state no longer surfaces the notice. Both
// burn fields are cleared together — `streakBurnedFromValue` keeps no
// independent meaning once the at-timestamp is null.
app.post("/api/streak/dismiss-burn-notice", async (req, res) => {
  const schema = z.object({ username: z.string().min(2).max(64) });
  try {
    const { username } = schema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username: slugifyUsername(username) } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.streakBurnedAt) {
      return res.json({ ok: true, alreadyDismissed: true });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { streakBurnedAt: null, streakBurnedFromValue: 0 }
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error(`[Dismiss Burn Notice Error] ${error?.message || error}`);
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Dev helper: bumps level/tokens/streak by +1 each. Not gated — used by the
// testing button next to +1 in the district controls while gating mechanics
// are tuned.
app.post("/api/city/dev-grant-stats", async (req, res) => {
  const schema = z.object({ username: z.string().min(2).max(64) });
  try {
    const { username } = schema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username: slugifyUsername(username) } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const nextLevel = (user.level || 1) + 1;
    const bumpedStreak = (user.streak || 0) + 1;
    const bumpedMaxStreak = Math.max(user.maxStreak || 0, bumpedStreak);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        level: nextLevel,
        xpNext: getXpNextForLevel(nextLevel),
        tokens: { increment: 1 },
        streak: { increment: 1 },
        maxStreak: bumpedMaxStreak
      },
      select: { level: true, xp: true, xpNext: true, tokens: true, streak: true }
    });

    return res.json({
      ok: true,
      level: updated.level,
      xp: updated.xp,
      xpNext: updated.xpNext,
      tokens: updated.tokens,
      streak: updated.streak
    });
  } catch (error) {
    console.error(`[Dev Grant Stats Error] ${error?.message || error}`);
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/reset-daily", async (req, res) => {
  const requestStartedAt = Date.now();
  const timingParts = [];
  const pushTiming = (name, startedAt) => {
    const dur = Math.max(0, Date.now() - startedAt);
    timingParts.push(`${name};dur=${dur}`);
  };

  try {
    const tParse = Date.now();
    const language = getRequestLanguage(req);
    const schema = z.object({
      username: z.string().min(2).max(64),
      isReroll: z.boolean().optional(),
      // Forces the day rotation even if the same UTC day has already been
      // processed — used by the explicit "Reset Day" user action. Plain app
      // mounts leave this undefined so the call becomes an idempotent no-op.
      force: z.boolean().optional(),
      excludeCategories: z.array(z.string()).optional(),
      targetQuestIds: z.array(z.number().int()).optional(),
      targetQuestId: z.number().int().optional().nullable(),
      keepQuestIds: z.array(z.number().int()).optional()
    });
    const parsed = schema.parse(req.body);
    pushTiming("parse", tParse);

    const tUserLoad = Date.now();
    const username = slugifyUsername(parsed.username);
    let user = await prisma.user.findUnique({ where: { username } });
    pushTiming("db_user", tUserLoad);

    if (!user) {
      timingParts.push(`total;dur=${Math.max(0, Date.now() - requestStartedAt)}`);
      res.setHeader("Server-Timing", timingParts.join(", "));
      res.setHeader("Timing-Allow-Origin", "*");
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();
    const today = getDateKey(now);
    let todayRows = [];

    // Streak decay — runs at most once per UTC day per user, BEFORE the
    // rotation idempotency check below. Independent of `isReroll`,
    // `force`, and admin endpoints because the bookkeeping rides on
    // its own column (`lastStreakDecayCheckAt`), not on the shared
    // `lastDailyResetAt`. This is what stops a reroll or an admin
    // reset from silently swallowing the day's burn evaluation.
    if (!streakDecayAlreadyDoneForUtcDay(user, now)) {
      const evaluationDayKey = previousUtcDayKey(now);
      const tDecayRows = Date.now();
      const decayCount = await prisma.questCompletion.count({
        where: { userId: user.id, dayKey: evaluationDayKey }
      });
      pushTiming("db_decay_rows", tDecayRows);

      const decayResult = evaluateStreakDecay({
        user,
        now,
        evaluationDayKey,
        decayCompletionsCount: decayCount
      });

      // Apply the ledger + any streak/freeze change atomically. Re-read
      // user so the rest of the handler (rotation, productivity, quest
      // composition) sees the post-decay numbers — important when a
      // streak just burned to 0, since quest slots and streak-XP
      // multipliers depend on it.
      user = await prisma.user.update({
        where: { id: user.id },
        data: decayResult.streakDecayData
      });

      if (decayResult.kind === "burned" || decayResult.kind === "freeze_consumed") {
        recordEvent({
          type: decayResult.kind === "burned" ? "streak_burned" : "streak_freeze_auto_consumed",
          level: "info",
          userId: user.id,
          username: user.username,
          message: decayResult.kind === "burned"
            ? `streak burned out (was ${decayResult.previousStreak})`
            : `freeze charge auto-consumed (streak ${decayResult.previousStreak} preserved)`,
          meta: {
            evaluationDayKey,
            previousStreak: decayResult.previousStreak,
            completions: decayCount,
            source: "reset-daily"
          }
        }).catch(() => {});
      }
    }

    // Idempotency: the client calls /api/reset-daily on every fresh mount of
    // the app to handle day rollover. If it's already been called today for a
    // non-reroll reset we must NOT rotate the random-quest pool again —
    // otherwise opening the app twice on the same day gives a fresh set each
    // session (and the "previous" stash overwrites itself so we lose track of
    // which quests to exclude across days). Return the current state instead.
    if (!parsed.isReroll && !parsed.force) {
      const lastDailyResetKey = user.lastDailyResetAt ? getDateKey(new Date(user.lastDailyResetAt)) : null;
      if (lastDailyResetKey === today) {
        const userCustomQuestsEarly = await fetchUserCustomQuests(user.id);
        const completedRows = await prisma.questCompletion.findMany({
          where: { userId: user.id, dayKey: today },
          orderBy: { completedAt: "asc" },
          select: { questId: true }
        });
        const completedQuestIdsEarly = completedRows.map((item) => item.questId);
        const productivityStateEarly = await updateAndReadProductivity(user, now);
        const finalUserEarly = productivityStateEarly.user;
        const { preferredQuestIds: preferredEarly } = onboardingStatus(finalUserEarly, userCustomQuestsEarly);
        const pinnedQuestProgress21dEarly = preferredEarly.length > 0
          ? await getPinnedQuestProgress21d(finalUserEarly, preferredEarly, now)
          : [];
        return res.json({
          ok: true,
          user: finalUserEarly,
          hasRerolledToday: hasUsedDailyRerollToday(finalUserEarly, now),
          extraRerollsToday: Number(finalUserEarly.extraRerollsToday || 0),
          quests: composeDailyQuests(finalUserEarly, completedQuestIdsEarly, now, [], language, userCustomQuestsEarly),
          completedQuestIds: completedQuestIdsEarly,
          pinnedQuestProgress21d: pinnedQuestProgress21dEarly,
          customQuests: userCustomQuestsEarly.map(buildCustomQuestEntry),
          productivity: productivityStateEarly.productivity,
          questSlots: getQuestSlotsForLevel(finalUserEarly.level || 1, finalUserEarly.streak || 0),
          ...buildServerTimeMeta(now)
        });
      }
    }

    // Move-back step: completions stamped with today's dayKey but
    // submitted before the user's first reset-daily of the day belong
    // to "yesterday" semantically — they happened before the rollover
    // animation. Reroll keeps today's completions intact (the user is
    // mid-day, not crossing a boundary), so the move only runs on
    // non-reroll calls.
    if (!parsed.isReroll) {
      const tTodayRows = Date.now();
      todayRows = await prisma.questCompletion.findMany({
        where: { userId: user.id, dayKey: today },
        select: { id: true, questId: true }
      });
      pushTiming("db_today_rows", tTodayRows);

      if (todayRows.length > 0) {
        const questIds = [...new Set(todayRows.map((row) => row.questId))];
        const tExistingRows = Date.now();
        const existingRows = await prisma.questCompletion.findMany({
          where: {
            userId: user.id,
            questId: { in: questIds }
          },
          select: { questId: true, dayKey: true }
        });
        pushTiming("db_existing_rows", tExistingRows);

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
          const tMoveTx = Date.now();
          await prisma.$transaction(moveOps);
          pushTiming("db_move_tx", tMoveTx);
        }
      }
    }

    let newRandomQuestIds = "";

  const tCustomQuests = Date.now();
  const userCustomQuests = await fetchUserCustomQuests(user.id);
  pushTiming("db_custom_quests", tCustomQuests);

    const requestedTargetQuestIds = [...new Set([
      ...(Array.isArray(parsed.targetQuestIds) ? parsed.targetQuestIds : []),
      ...(Number.isInteger(parsed.targetQuestId) ? [parsed.targetQuestId] : [])
    ])];

    if (parsed.isReroll && requestedTargetQuestIds.length > 0) {
      const { preferredQuestIds: pinned } = onboardingStatus(user, userCustomQuests);
      const randomQuestCount = Math.max(0, Math.min(
        getRandomQuestCount(user.level || 1, user.streak || 0),
        getDailyQuestCount(user.level || 1, user.streak || 0) - pinned.length
      ));
      const questPool = getQuestPool({ language });
      const questById = new Map(questPool.map((quest) => [quest.id, quest]));
      const pinnedSet = new Set(pinned);
      const targetQuestIds = requestedTargetQuestIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0 && !pinnedSet.has(id));

      if (targetQuestIds.length === 0) {
        return res.status(400).json({ error: "No valid reroll quests selected" });
      }

      if (targetQuestIds.length > randomQuestCount) {
        return res.status(400).json({ error: `You can reroll up to ${randomQuestCount} quests at once` });
      }

      const keepRandomIds = [...new Set((parsed.keepQuestIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0 && !pinnedSet.has(id) && !targetQuestIds.includes(id)))]
        .slice(0, Math.max(0, randomQuestCount - targetQuestIds.length));

      if (keepRandomIds.length + targetQuestIds.length !== randomQuestCount) {
        return res.status(400).json({ error: "Invalid reroll selection" });
      }

      const keepRandomQuests = keepRandomIds.map((id) => questById.get(id)).filter(Boolean);

      const excludedCategories = new Set((parsed.excludeCategories || []).map((item) => normalizeCategory(item)));
      // Exclude the quests being rerolled PLUS anything from the previous
      // rotation so the replacements can't repeat what the user just saw.
      const previousRandomIds = (user.previousRandomQuestIds || "")
        .split(",")
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);
      const replacementQuests = findReplacementQuestCombination({
        questPool,
        pinnedSet,
        keepRandomQuests,
        excludeCategories: excludedCategories,
        unavailableQuestIds: new Set([...keepRandomIds, ...targetQuestIds, ...previousRandomIds]),
        replacementCount: targetQuestIds.length,
        expectedRandomCount: randomQuestCount,
        streak: user.streak || 0
      });

      if (!replacementQuests || replacementQuests.length !== targetQuestIds.length) {
        return res.status(400).json({ error: "No valid reroll quest found for unique category and effort constraints" });
      }

      const finalNonPinnedIds = [...keepRandomIds, ...replacementQuests.map((quest) => quest.id)].slice(0, randomQuestCount);
      const finalNonPinnedQuests = finalNonPinnedIds.map((id) => questById.get(id)).filter(Boolean);

      if (!isValidRandomQuestSet(finalNonPinnedQuests, randomQuestCount, user.streak || 0)) {
        return res.status(400).json({ error: "Reroll result violates random quest category/effort constraints" });
      }

      newRandomQuestIds = finalNonPinnedIds.join(",");
    }

    const hasRerolledToday = hasUsedDailyRerollToday(user, now);
    const extraRerollsToday = Number(user.extraRerollsToday || 0);

    if (parsed.isReroll && hasRerolledToday && extraRerollsToday <= 0) {
      return res.status(400).json({ error: "Daily reroll already used" });
    }

    const rerollStateData = parsed.isReroll
      ? (hasRerolledToday
          ? { extraRerollsToday: { decrement: 1 } }
          : { lastDailyRerollAt: now })
      : { lastDailyRerollAt: null, extraRerollsToday: 0 };

    // Stash the "quests the user has already seen today" so subsequent
    // composeDailyQuests / reroll calls can avoid them.
    // - Non-reroll (day rollover): stash yesterday's full random set so
    //   today's new generation won't repeat it.
    // - Reroll: ACCUMULATE the rerolled target IDs on top of the existing
    //   previous set — otherwise a second reroll on the same day has no
    //   memory of the first reroll's victims and could hand back a quest
    //   the user just paid to get rid of.
    const previousRandomIdsNext = (() => {
      if (!parsed.isReroll) return user.randomQuestIds || "";
      const carryOver = (user.previousRandomQuestIds || "")
        .split(",")
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);
      const rerolledTargets = (requestedTargetQuestIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);
      const merged = [...new Set([...carryOver, ...rerolledTargets])];
      return merged.join(",");
    })();

    const tUserUpdate = Date.now();
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastDailyResetAt: now,
        lastStreakIncreaseAt: parsed.isReroll ? user.lastStreakIncreaseAt : null,
        randomQuestIds: newRandomQuestIds, // Always replace or clear it!
        previousRandomQuestIds: previousRandomIdsNext,
        ...rerollStateData
      }
    });
    pushTiming("db_user_update", tUserUpdate);

    const completedQuestIdsPromise = parsed.isReroll
      ? prisma.questCompletion.findMany({
          where: { userId: user.id, dayKey: today },
          orderBy: { completedAt: "asc" },
          select: { questId: true }
        }).then((rows) => rows.map((item) => item.questId))
      : Promise.resolve([]);

    const tPostUpdate = Date.now();
    const [productivityState, completedQuestIds] = await Promise.all([
      updateAndReadProductivity(updatedUser, now),
      completedQuestIdsPromise
    ]);
    pushTiming("post_update", tPostUpdate);

    const finalUser = productivityState.user;
    const { preferredQuestIds } = onboardingStatus(finalUser, userCustomQuests);
    const tPinnedProgress = Date.now();
    const pinnedQuestProgress21d = preferredQuestIds.length > 0
      ? await getPinnedQuestProgress21d(finalUser, preferredQuestIds, now)
      : [];
    pushTiming("pinned_progress", tPinnedProgress);

    timingParts.push(`total;dur=${Math.max(0, Date.now() - requestStartedAt)}`);
    res.setHeader("Server-Timing", timingParts.join(", "));
    res.setHeader("Timing-Allow-Origin", "*");

    res.json({
      ok: true,
      user: finalUser,
      hasRerolledToday: hasUsedDailyRerollToday(finalUser, now),
      extraRerollsToday: Number(finalUser.extraRerollsToday || 0),
      quests: composeDailyQuests(finalUser, completedQuestIds, now, parsed.excludeCategories, language, userCustomQuests),
      completedQuestIds,
      pinnedQuestProgress21d,
      customQuests: userCustomQuests.map(buildCustomQuestEntry),
      productivity: productivityState.productivity,
      questSlots: getQuestSlotsForLevel(finalUser.level || 1, finalUser.streak || 0),
      ...buildServerTimeMeta(now)
    });
  } catch (error) {
    timingParts.push(`total;dur=${Math.max(0, Date.now() - requestStartedAt)}`);
    res.setHeader("Server-Timing", timingParts.join(", "));
    res.setHeader("Timing-Allow-Origin", "*");
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Streak Freeze shop — 7 tokens base (minus Residential discount), limited to
// one purchase per calendar week (resets Monday UTC 00:00 alongside daily reset).
app.post("/api/shop/freeze-streak", async (req, res) => {
  try {
    const parsed = usernameBody.parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();
    const weekKey = getWeekKey(now);

    // Weekly limit: one Streak Freeze charge per user per week.
    if (user.lastFreezePurchaseWeekKey === weekKey) {
      return res.status(400).json({
        error: "Weekly limit reached",
        code: "weekly_limit",
        weekKey,
        nextAvailableAt: nextMondayUtc(now).toISOString()
      });
    }

    // Residential district shop discount
    const resLvl = districtLevelOf(user.districtLevels, "residential");
    const discount = residentialShopDiscount(resLvl);
    const freezeCost = Math.max(0, 7 - discount);

    if (user.tokens < freezeCost) {
      return res.status(400).json({ error: "Not enough tokens" });
    }

    // Streak Freeze adds a charge to the pool (redeem via profile).
    const freezeData = {
      tokens: { decrement: freezeCost },
      streakFreezeCharges: { increment: 1 },
      lastFreezePurchaseWeekKey: weekKey
    };
    if (freezeCost > 0) freezeData.tokensSpentTotal = { increment: freezeCost };
    const updated = await prisma.user.update({ where: { id: user.id }, data: freezeData });
    trackAchievements(user.id);
    res.json({
      ok: true,
      tokens: updated.tokens,
      cost: freezeCost,
      discount,
      streakFreezeCharges: updated.streakFreezeCharges,
      lastFreezePurchaseWeekKey: updated.lastFreezePurchaseWeekKey,
      nextAvailableAt: nextMondayUtc(now).toISOString()
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

function nextMondayUtc(from = new Date()) {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const dayOffsetFromMonday = (d.getUTCDay() + 6) % 7;
  // Move to current Monday, then +7 days.
  d.setUTCDate(d.getUTCDate() - dayOffsetFromMonday + 7);
  return d;
}

app.post("/api/shop/extra-reroll", async (req, res) => {
  try {
    const parsed = usernameBody.parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const resLvl = districtLevelOf(user.districtLevels, "residential");
    const discount = residentialShopDiscount(resLvl);
    const rerollCost = Math.max(0, 3 - discount);
    if (user.tokens < rerollCost) {
      return res.status(400).json({ error: "Not enough tokens" });
    }
    // Always grant +1 extra reroll, even for free purchases (rerollCost === 0
    // when the residential discount is large enough). Without the increment,
    // the daily-reroll guard in /api/reset-daily ("Daily reroll already used")
    // rejects the next reroll because user.extraRerollsToday stayed at 0 —
    // the symptom the user saw: tokens debited, quests didn't change.
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(rerollCost > 0 ? {
          tokens: { decrement: rerollCost },
          tokensSpentTotal: { increment: rerollCost }
        } : {}),
        extraRerollsToday: { increment: 1 }
      }
    });
    if (rerollCost > 0) trackAchievements(user.id);
    res.json({
      ok: true,
      tokens: updatedUser.tokens,
      cost: rerollCost,
      discount,
      extraRerollsToday: Number(updatedUser.extraRerollsToday || 0)
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// XP Boost: 15 tokens → +15% XP on every quest completion for 7 days.
// Buying while active extends expiry by +7 days from current expiry (not now).
const XP_BOOST_COST = 15;
const XP_BOOST_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const XP_BOOST_MULTIPLIER = 1.15;

function xpBoostActiveFor(user, now = new Date()) {
  return Boolean(user?.xpBoostExpiresAt && new Date(user.xpBoostExpiresAt).getTime() > now.getTime());
}

app.post("/api/shop/buy-xp-boost", async (req, res) => {
  try {
    const parsed = usernameBody.parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const now = new Date();
    const resLvl = districtLevelOf(user.districtLevels, "residential");
    const discount = residentialShopDiscount(resLvl);
    const cost = Math.max(0, XP_BOOST_COST - discount);
    if (user.tokens < cost) {
      return res.status(400).json({ error: "Not enough tokens", code: "not_enough_tokens" });
    }
    const base = user.xpBoostExpiresAt && new Date(user.xpBoostExpiresAt).getTime() > now.getTime()
      ? new Date(user.xpBoostExpiresAt)
      : now;
    const newExpiry = new Date(base.getTime() + XP_BOOST_DURATION_MS);
    const xpBoostData = {
      tokens: { decrement: cost },
      xpBoostExpiresAt: newExpiry
    };
    if (cost > 0) xpBoostData.tokensSpentTotal = { increment: cost };
    const updated = await prisma.user.update({ where: { id: user.id }, data: xpBoostData });
    if (cost > 0) trackAchievements(user.id);
    res.json({
      ok: true,
      tokens: updated.tokens,
      cost,
      discount,
      xpBoostExpiresAt: updated.xpBoostExpiresAt
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Escalating cost per reset: 10, 20, 30, 40, 50, 50, 50…
// (caps at 50 tokens for the 5th reset and every subsequent one).
function computeCityResetCost(resetsPaidSoFar) {
  const idx = Math.max(0, Number(resetsPaidSoFar) || 0) + 1;
  return Math.min(50, 10 * idx);
}

// Sum of all upgrade-step costs for a district currently at level L.
// DISTRICT_UPGRADE_REQS[i] is the cost to reach level i+1 from i, so
// a district at level L has paid costs[0..L-1].
function computeDistrictRefundForLevel(level) {
  let total = 0;
  for (let i = 0; i < Math.max(0, Math.min(DISTRICT_MAX_LEVEL, level)); i += 1) {
    total += Number(DISTRICT_UPGRADE_REQS[i]?.tokens) || 0;
  }
  return total;
}

function computeCityRefund(districtLevelsStr) {
  const levels = parseDistrictLevels(districtLevelsStr);
  return levels.reduce((sum, lvl) => sum + computeDistrictRefundForLevel(lvl), 0);
}

app.post("/api/shop/reset-city", async (req, res) => {
  try {
    const parsed = usernameBody.parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const cost = computeCityResetCost(user.cityResetsPaid);
    if ((Number(user.tokens) || 0) < cost) {
      return res.status(400).json({
        error: "Not enough tokens",
        code: "not_enough_tokens",
        required: cost,
        current: Number(user.tokens) || 0
      });
    }

    const refund = computeCityRefund(user.districtLevels);
    // Net delta = refund − cost. Could be positive (refund wins) or
    // negative (cost wins, e.g. you reset an empty city).
    const netDelta = refund - cost;

    const resetData = {
      tokens: Math.max(0, (Number(user.tokens) || 0) + netDelta),
      districtLevels: "0,0,0,0,0",
      cityResetsPaid: { increment: 1 }
    };
    if (cost > 0) resetData.tokensSpentTotal = { increment: cost };
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: resetData,
      select: {
        tokens: true,
        districtLevels: true,
        cityResetsPaid: true
      }
    });
    trackAchievements(user.id);

    res.json({
      ok: true,
      cost,
      refund,
      tokens: updated.tokens,
      districtLevels: parseDistrictLevels(updated.districtLevels),
      cityResetsPaid: updated.cityResetsPaid,
      nextResetCost: computeCityResetCost(updated.cityResetsPaid)
    });
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

    const preferredList = parsePreferredQuestIds(user.preferredQuestIds, (await fetchUserCustomQuests(user.id)).map((cq) => toCustomVirtualId(cq.id)));
    if (preferredList.length === 0) {
      return res.status(400).json({ error: "No pinned quests to reroll" });
    }

    const now = new Date();
    const isFreeAvailable = !user.lastFreeTaskRerollAt || (now.getTime() - new Date(user.lastFreeTaskRerollAt).getTime() >= FREE_PINNED_REROLL_INTERVAL_MS);
    const shouldUseTokens = parsed.useTokens || !isFreeAvailable;
    const resLvlRr = districtLevelOf(user.districtLevels, "residential");
    const rerollCost = Math.max(0, 7 - residentialShopDiscount(resLvlRr));

    if (shouldUseTokens && user.tokens < rerollCost) {
      return res.status(400).json({ error: "Not enough tokens" });
    }
    if (!shouldUseTokens && !isFreeAvailable) {
      return res.status(400).json({ error: "Free reroll used in the last 21 days" });
    }

    const questPool = getQuestPool();
    const currentPinnedSet = new Set(preferredList);
    const usedNewIds = new Set();
    const rerolledPreferredQuestIds = preferredList.map((oldId) => {
      // Custom habits are user-authored — reroll does not replace them.
      if (isCustomQuestVirtualId(oldId)) {
        return oldId;
      }
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
      updateData.tokens = { decrement: rerollCost };
      if (rerollCost > 0) updateData.tokensSpentTotal = { increment: rerollCost };
    } else {
      updateData.lastFreeTaskRerollAt = now;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });
    if (shouldUseTokens && rerollCost > 0) trackAchievements(user.id);

    const dayKey = getDateKey(now);
    const completions = await prisma.questCompletion.findMany({
      where: { userId: user.id, dayKey },
      select: { questId: true }
    });
    const completedQuestIds = completions.map((c) => c.questId);
    
    const customQuestsForResult = await fetchUserCustomQuests(user.id);
    const quests = composeDailyQuests(updatedUser, completedQuestIds, now, [], language, customQuestsForResult);

    res.json({
      success: true,
      tokens: updatedUser.tokens,
      lastFreeTaskRerollAt: updatedUser.lastFreeTaskRerollAt,
      preferredQuestIds: rerolledPreferredQuestIds,
      pinnedQuestProgress21d: await getPinnedQuestProgress21d(updatedUser, rerolledPreferredQuestIds, now),
      completedQuestIds,
      quests,
      customQuests: customQuestsForResult.map(buildCustomQuestEntry)
    });

  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: err.errors });
    }
    console.error("Reroll pinned error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// Append a single habit to the user's pinned list (no cost, no reroll).
// Used by the empty-slot card on the dashboard when a level tier unlocks
// a new habit slot.
app.post("/api/habits/pin-one", async (req, res) => {
  try {
    const parsed = z.object({
      username: z.string().min(2).max(64),
      questId: z.number().int().min(1)
    }).parse(req.body);
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const maxPinned = getPreferredQuestCount(user.level || 1, user.streak || 0);
    const customQuests = await fetchUserCustomQuests(user.id);
    const customVirtualIds = new Set(customQuests.map((cq) => toCustomVirtualId(cq.id)));
    const current = parsePreferredQuestIds(user.preferredQuestIds, [...customVirtualIds]);

    if (current.length >= maxPinned) {
      return res.status(400).json({ error: "No free habit slots at your level" });
    }
    if (current.includes(parsed.questId)) {
      return res.status(409).json({ error: "Habit already pinned" });
    }

    const questPool = getQuestPool();
    const questById = new Map(questPool.map((q) => [q.id, q]));
    const isKnown = questById.has(parsed.questId) || customVirtualIds.has(parsed.questId);
    if (!isKnown) {
      return res.status(400).json({ error: `Invalid quest id: ${parsed.questId}` });
    }
    const quest = questById.get(parsed.questId);
    const maxEffort = getMaxEffortForLevel(user.level || 1, user.streak || 0);
    if (quest && Number(quest.effortScore) > maxEffort) {
      return res.status(400).json({ error: `Quest ${parsed.questId} exceeds the difficulty available at your level` });
    }

    const nextPinned = [...current, parsed.questId];
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { preferredQuestIds: serializePreferredQuestIds(nextPinned) }
    });
    res.json({
      ok: true,
      preferredQuestIds: nextPinned,
      user: updatedUser
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/shop/replace-pinned-quests", async (req, res) => {
  try {
    const language = getRequestLanguage(req);
    // Upper bound 4 = the max pinned slots possible at any level; actual per-user cap
    // is checked below against the requesting user's current level tier.
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
    const maxPinned = getPreferredQuestCount(user.level || 1, user.streak || 0);
    if (parsed.preferredQuestIds.length > maxPinned) {
      return res.status(400).json({ error: `At level ${user.level} you can pin at most ${maxPinned} habits` });
    }

    const now = new Date();
    const isFreeAvailable = !user.lastFreeTaskRerollAt || (now.getTime() - new Date(user.lastFreeTaskRerollAt).getTime() >= FREE_PINNED_REROLL_INTERVAL_MS);
    // If free reroll is available, always use it regardless of client flag.
    const shouldUseTokens = !isFreeAvailable;
    const resLvlPinned = districtLevelOf(user.districtLevels, "residential");
    const pinnedRerollCost = Math.max(0, 7 - residentialShopDiscount(resLvlPinned));

    if (shouldUseTokens && user.tokens < pinnedRerollCost) {
      return res.status(400).json({ error: "Not enough tokens" });
    }

    const uniquePreferredQuestIds = [...new Set(parsed.preferredQuestIds)];
    if (uniquePreferredQuestIds.length !== parsed.preferredQuestIds.length) {
      return res.status(400).json({ error: "Preferred quests must be different" });
    }

    const customQuests = await fetchUserCustomQuests(user.id);
    const customVirtualIds = new Set(customQuests.map((cq) => toCustomVirtualId(cq.id)));
    const questPool = getQuestPool();
    const questById = new Map(questPool.map((quest) => [quest.id, quest]));
    const invalidQuestId = uniquePreferredQuestIds.find((id) => !questById.has(id) && !customVirtualIds.has(id));
    if (invalidQuestId) {
      return res.status(400).json({ error: `Invalid quest id: ${invalidQuestId}` });
    }
    const userMaxEffort = getMaxEffortForLevel(user.level || 1, user.streak || 0);
    const overDifficultQuest = uniquePreferredQuestIds.find((id) => {
      const quest = questById.get(id);
      return quest && Number(quest.effortScore) > userMaxEffort;
    });
    if (overDifficultQuest) {
      return res.status(400).json({ error: `Quest ${overDifficultQuest} exceeds the difficulty available at your level` });
    }

    const updateData = {
      preferredQuestIds: serializePreferredQuestIds(uniquePreferredQuestIds)
    };
    if (shouldUseTokens) {
      updateData.tokens = { decrement: pinnedRerollCost };
      if (pinnedRerollCost > 0) updateData.tokensSpentTotal = { increment: pinnedRerollCost };
    } else {
      updateData.lastFreeTaskRerollAt = now;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });
    if (shouldUseTokens && pinnedRerollCost > 0) trackAchievements(user.id);

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
      quests: composeDailyQuests(updatedUser, completions.map((item) => item.questId), now, [], language, customQuests),
      completedQuestIds: completions.map((item) => item.questId),
      customQuests: customQuests.map(buildCustomQuestEntry)
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

    await prisma.questTimerSession.deleteMany({ where: { userId: user.id } });
    await prisma.questCounter.deleteMany({ where: { userId: user.id } });
    await prisma.questNote.deleteMany({ where: { userId: user.id } });

    const customQuests = await fetchUserCustomQuests(user.id);
    const customVirtualIds = customQuests.map((cq) => toCustomVirtualId(cq.id));

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        level: 1,
        xp: 0,
        xpNext: 250,
        streak: 0,
        maxStreak: 0,
        tokens: 0,
        randomQuestIds: "",
        previousRandomQuestIds: "",
        lastStreakIncreaseAt: null,
        streakFreezeExpiresAt: null,
        lastDailyRerollAt: null,
        extraRerollsToday: 0,
        lastDailyResetAt: now,
        streakFreezeCharges: 0,
        lastFreezePurchaseWeekKey: "",
        xpBoostExpiresAt: null
      }
    });

    res.json({
      ok: true,
      user: updatedUser,
      completedQuestIds: [],
      quests: composeDailyQuests(updatedUser, [], now, [], language, customQuests),
      preferredQuestIds: parsePreferredQuestIds(updatedUser.preferredQuestIds, customVirtualIds),
      customQuests: customQuests.map(buildCustomQuestEntry),
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

    // Mentor achievement lives on the inviter — re-evaluate on accept.
    trackAchievements(inviter.id);

    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Legacy /api/friends/:username endpoint removed — superseded by /api/friends/list/:username
// (keeping a ":username" route at /api/friends/ would shadow /api/friends/relation, /request, etc.)

app.post("/api/sync-state", async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(64),
    level: z.number().int().min(1),
    xp: z.number().int().min(0),
    xpNext: z.number().int().min(1),
    tokens: z.number().int().min(0).optional(),
  });
  try {
    const parsed = schema.parse(req.body);
    const username = slugifyUsername(parsed.username);
    if (!username) return res.status(400).json({ error: "Invalid username" });

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (!existingUser) {
      return res.json({ ok: false });
    }

    // Guard against stale mobile/web payloads that can otherwise overwrite
    // newer server progress (e.g. setting XP back to 0 after quest completion).
    const incomingTotalXp = getTotalXp(parsed.level, parsed.xp);
    const currentTotalXp = getTotalXp(existingUser.level, existingUser.xp);

    const updateData = {};
    if (incomingTotalXp > currentTotalXp) {
      updateData.level = parsed.level;
      updateData.xp = parsed.xp;
      updateData.xpNext = parsed.xpNext;
    }

    if (typeof parsed.tokens === "number" && parsed.tokens > Number(existingUser.tokens || 0)) {
      updateData.tokens = parsed.tokens;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { username },
        data: updateData,
      });
    }

    res.json({
      ok: true,
      skippedStaleXpSync: incomingTotalXp <= currentTotalXp
    });
  } catch {
    // user may not exist yet; silently succeed
    res.json({ ok: false });
  }
});

app.get("/api/leaderboard", async (_req, res) => {
  try {
    const LEADERBOARD_TEST_USERNAME_PREFIX = "leader_test_";
    const LEADERBOARD_TEST_DISPLAY_PREFIX = "Leaderboard Test";
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { username: { not: { startsWith: LEADERBOARD_TEST_USERNAME_PREFIX } } },
          { displayName: { not: { startsWith: LEADERBOARD_TEST_DISPLAY_PREFIX } } }
        ]
      },
      select: {
        username: true,
        displayName: true,
        handle: true,
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
          streak: 0,
          maxStreak: 0,
          tokens: 0,
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

app.use((err, req, res, _next) => {
  console.error(err);
  recordEvent({
    type: "server_error",
    level: "error",
    platform: "server",
    message: String(err?.message || err),
    stack: String(err?.stack || ""),
    url: `${req.method} ${req.originalUrl || req.url || ""}`,
    userAgent: String(req.headers?.["user-agent"] || ""),
    meta: { status: 500 }
  });
  res.status(500).json({ error: "Internal server error" });
});

process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection", reason);
  recordEvent({
    type: "unhandled_rejection",
    level: "fatal",
    platform: "server",
    message: String(reason?.message || reason),
    stack: String(reason?.stack || "")
  });
});

process.on("uncaughtException", (err) => {
  console.error("uncaughtException", err);
  recordEvent({
    type: "uncaught_exception",
    level: "fatal",
    platform: "server",
    message: String(err?.message || err),
    stack: String(err?.stack || "")
  });
});

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

// One-shot wipe of the Event audit table before this cutoff. Event was
// briefly surfaced inside Activity Logs and polluted the per-user feed
// with system errors / admin pings. We've since stopped reading it
// from that endpoint; the cutoff-gated deleteMany clears the historical
// noise so anyone re-opening Activity Logs sees a fresh slate. Safe to
// keep indefinitely — once executed, the WHERE clause matches nothing
// and the call becomes a no-op on every subsequent boot.
const EVENT_WIPE_BEFORE = new Date("2026-04-26T00:00:00Z");
async function wipeStaleEventLog() {
  try {
    const result = await prisma.event.deleteMany({
      where: { createdAt: { lt: EVENT_WIPE_BEFORE } }
    });
    if (result.count > 0) {
      console.log(`[boot] wiped ${result.count} pre-cutoff Event rows`);
    }
  } catch (err) {
    console.warn(`[boot] event wipe skipped: ${err?.message || err}`);
  }
}

if (isMainModule) {
  const bootstrap = async () => {
    await ensureLeaderboardTestUsers();
    await wipeStaleEventLog();
    app.listen(port, () => {
      console.log(`GoHabit API running on http://localhost:${port}`);
    });
  };

  bootstrap().catch((error) => {
    console.error("Failed to bootstrap server", error);
    process.exit(1);
  });
}

export default app;

app.delete("/api/profiles/:userId", async (req, res) => {
  const rawIdentifier = req.params.userId;
  if (!rawIdentifier || typeof rawIdentifier !== "string" || rawIdentifier.length > 128) {
    return res.status(400).json({ error: "Invalid userId" });
  }

  const normalizedUsername = slugifyUsername(rawIdentifier);

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: rawIdentifier },
          ...(normalizedUsername ? [{ username: normalizedUsername }] : [])
        ]
      }
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    await prisma.$transaction([
      prisma.questCompletion.deleteMany({ where: { userId: user.id } }),
      prisma.dailyScore.deleteMany({ where: { userId: user.id } }),
      prisma.customQuest.deleteMany({ where: { userId: user.id } }),
      prisma.questFeedback.deleteMany({ where: { userId: user.id } }),
      prisma.friendship.deleteMany({ where: { OR: [{ userAId: user.id }, { userBId: user.id }] } }),
      prisma.invite.deleteMany({ where: { OR: [{ inviterId: user.id }, { invitedUserId: user.id }] } }),
      prisma.event.deleteMany({ where: { OR: [{ userId: user.id }, { username: user.username }] } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete profile", detail: error.message });
  }
});

// Persist the user's custom city name shown in the City tab header.
// 1..24 characters, any printable unicode. Empty string on the server
// means "use the translated default" (Embervale / Эмбервейл) — the
// client falls back automatically. No authenticity check beyond the
// username ownership implied by the request context — this is purely
// cosmetic (no leaderboard, no XP).
app.post("/api/profiles/city-name", async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(64),
    cityName: z.string().max(64)
  });
  try {
    const parsed = schema.parse(req.body);
    const username = slugifyUsername(parsed.username);
    if (!username) return res.status(400).json({ error: "Invalid username" });
    const cleaned = String(parsed.cityName || "")
      // Strip ASCII/Unicode control chars. Emoji & letters pass through.
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
      .trim()
      .slice(0, 24);
    const user = await prisma.user.update({
      where: { username },
      data: { cityName: cleaned }
    });
    res.json({ ok: true, cityName: user.cityName });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Persist the user's chosen UI language on the server so achievements
// like `polyglot` can unlock (and so we remember across devices).
app.post("/api/profiles/language", async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(64),
    language: z.string().min(1).max(8)
  });
  try {
    const parsed = schema.parse(req.body);
    const username = slugifyUsername(parsed.username);
    if (!username) return res.status(400).json({ error: "Invalid username" });
    const lang = String(parsed.language || "").toLowerCase().slice(0, 8);
    const user = await prisma.user.update({
      where: { username },
      data: { preferredLanguage: lang }
    });
    // AWAIT the evaluation so the response is consistent with DB state.
    // Previously this was fire-and-forget, which meant the client saw
    // ok:true before the polyglot achievement row was actually written —
    // and the next /api/users/:u/achievements call could still miss it.
    // Now the response only returns after the row is in (or evaluation
    // failed and was logged).
    const newlyUnlocked = await trackAchievements(user.id);
    res.json({
      ok: true,
      preferredLanguage: user.preferredLanguage,
      newlyUnlocked
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// GET achievements for a user (public). Runs a retroactive evaluation
// first so any milestone the user has already earned but never had the
// chance to claim (pre-release activity, cross-device desync) is unlocked
// on first view.
app.get("/api/users/:username/achievements", async (req, res) => {
  try {
    const username = slugifyUsername(req.params.username);
    if (!username) return res.status(400).json({ error: "Invalid username" });
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    await evaluateAchievements(prisma, user.id).catch(() => {});
    const achievements = await fetchUserAchievements(prisma, user.id);
    const unlockedCount = achievements.filter((a) => a.unlocked).length;
    res.json({
      codes: ACHIEVEMENT_CODES,
      total: ACHIEVEMENT_CODES.length,
      unlockedCount,
      achievements
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch achievements", detail: error.message });
  }
});

// Activity feed — synthesizes a unified event log from the user's
// existing tables (questCompletion, userAchievement, friendship,
// challengeParticipant, groupChallenge, event). No dedicated audit
// table; rows live where they always did, the endpoint just
// normalizes them to a common shape and merges by createdAt desc.
//
// Each item: { id, kind, at, title, subtitle?, meta? }. The client
// renders it directly and supports substring search across title +
// subtitle. Pagination is single-page top-N (default 200) — covers
// typical session use without server-side cursor complexity.
app.get("/api/users/:username/activity", async (req, res) => {
  try {
    const username = slugifyUsername(req.params.username);
    if (!username) return res.status(400).json({ error: "Invalid username" });
    const language = getRequestLanguage(req);
    const limit = Math.min(500, Math.max(20, Number(req.query.limit) || 200));
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, displayName: true }
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Pre-build a id→title lookup so quest completion rows can be
    // labelled with human-readable titles in the active language.
    const pool = getQuestPool({ language });
    const questTitleById = new Map(pool.map((q) => [Number(q.id), q.title || `#${q.id}`]));

    const customQuestRows = await prisma.customQuest.findMany({
      where: { userId: user.id },
      select: { id: true, title: true }
    });
    const customTitleByVirtualId = new Map(customQuestRows.map((row) => [
      // mirror toCustomVirtualId: -1, -2, … (negative ints).
      -Number(row.id),
      row.title || ""
    ]));

    const items = [];

    // 1. Quest completions (most recent 100) — cap to keep payload small
    //    on long-time users.
    const completions = await prisma.questCompletion.findMany({
      where: { userId: user.id },
      orderBy: { completedAt: "desc" },
      take: 100,
      select: { id: true, questId: true, dayKey: true, completedAt: true, completionPercent: true }
    });
    for (const row of completions) {
      const qid = Number(row.questId);
      const title = qid < 0
        ? (customTitleByVirtualId.get(qid) || `Custom #${Math.abs(qid)}`)
        : (questTitleById.get(qid) || `Quest #${qid}`);
      items.push({
        id: `qc:${row.id}`,
        kind: "quest_completed",
        at: row.completedAt,
        title,
        subtitle: row.completionPercent < 100
          ? `Partial · ${row.completionPercent}%`
          : null,
        meta: { questId: qid, completionPercent: row.completionPercent }
      });
    }

    // 2. Achievement unlocks + claims (separate items so search lights
    //    up on both states).
    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId: user.id },
      orderBy: { unlockedAt: "desc" },
      take: 60
    });
    for (const row of userAchievements) {
      items.push({
        id: `ua:${row.id}:u`,
        kind: "achievement_unlocked",
        at: row.unlockedAt,
        title: row.code,
        subtitle: null,
        meta: { code: row.code }
      });
      if (row.claimedAt) {
        items.push({
          id: `ua:${row.id}:c`,
          kind: "achievement_claimed",
          at: row.claimedAt,
          title: row.code,
          subtitle: null,
          meta: { code: row.code }
        });
      }
    }

    // 3. Friendships (created → friend added).
    const friendships = await prisma.friendship.findMany({
      where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        userA: { select: { username: true, displayName: true, handle: true } },
        userB: { select: { username: true, displayName: true, handle: true } }
      }
    });
    for (const row of friendships) {
      const other = row.userAId === user.id ? row.userB : row.userA;
      const handle = other?.handle ? `@${other.handle}` : (other?.displayName || other?.username || "user");
      items.push({
        id: `fr:${row.id}`,
        kind: "friend_added",
        at: row.createdAt,
        title: handle,
        subtitle: null,
        meta: { username: other?.username || null }
      });
    }

    // 4. Challenge memberships (joined / created).
    const myParticipants = await prisma.challengeParticipant.findMany({
      where: { userId: user.id, acceptedAt: { not: null } },
      orderBy: { acceptedAt: "desc" },
      take: 40,
      include: { challenge: { select: { id: true, title: true, durationDays: true, creatorId: true } } }
    });
    for (const p of myParticipants) {
      const c = p.challenge;
      if (!c) continue;
      const isCreator = c.creatorId === user.id;
      items.push({
        id: `cp:${p.id}`,
        kind: isCreator ? "challenge_created" : "challenge_joined",
        at: p.acceptedAt,
        title: c.title || `Challenge #${c.id}`,
        subtitle: c.durationDays ? `${c.durationDays} days` : null,
        meta: { challengeId: c.id }
      });
    }

    // The Event table is a server-side audit / error log — it carries
    // admin actions, error reports, force-logout pings and other
    // operational noise the player has no business seeing in their
    // own action history. Activity Logs is for "what I did", not
    // "what the server logged about me", so we deliberately do NOT
    // synthesize Event rows here.

    // Sort merged feed desc by `at` and cap at limit.
    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    res.json({ items: items.slice(0, limit), total: items.length });
  } catch (error) {
    console.error(`[Activity Feed Error] ${error?.message || error}`);
    res.status(500).json({ error: "Failed to load activity", detail: error?.message });
  }
});

// Knowledge Quiz — unlock-only. The achievement row is created here
// when the user scores 10/10 for the first time; the token reward is
// claimed separately via POST /api/achievements/claim, same flow as
// every other achievement. Subsequent quiz passes return justUnlocked:
// false (the row already exists) and the user simply re-sees their
// score, with no extra token grant.
app.post("/api/quiz/scholar/claim", async (req, res) => {
  const schema = z.object({ username: z.string().min(2).max(64) });
  try {
    const { username } = schema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { username: slugifyUsername(username) },
      select: { id: true, tokens: true }
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const existing = await prisma.userAchievement.findUnique({
      where: { userId_code: { userId: user.id, code: "scholar" } }
    }).catch(() => null);

    if (existing) {
      return res.json({
        ok: true,
        justUnlocked: false,
        tokens: Number(user.tokens) || 0
      });
    }

    try {
      await prisma.userAchievement.create({
        data: { userId: user.id, code: "scholar", unlockedAt: new Date() }
      });
    } catch (createErr) {
      // Likely a race against another claim — the unique (userId, code)
      // constraint will reject the duplicate. Treat as already-unlocked.
      return res.json({
        ok: true,
        justUnlocked: false,
        tokens: Number(user.tokens) || 0
      });
    }

    return res.json({
      ok: true,
      justUnlocked: true,
      tokens: Number(user.tokens) || 0
    });
  } catch (error) {
    console.error(`[Quiz Claim Error] ${error?.message || error}`);
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Achievement reward claim — unified flow for every code. Idempotent:
// the achievement must be unlocked AND not yet claimed; we set
// claimedAt and credit the reward atomically. Repeat calls after a
// successful claim return tokensGranted: 0.
app.post("/api/achievements/claim", async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(64),
    code: z.string().min(1).max(64)
  });
  try {
    const { username, code } = schema.parse(req.body);
    if (!ACHIEVEMENT_CODES.includes(code)) {
      return res.status(400).json({ error: "Unknown achievement code", code: "unknown_code" });
    }
    const reward = Number(ACHIEVEMENT_REWARDS[code]) || 0;
    if (reward <= 0) {
      return res.status(400).json({ error: "Achievement has no claimable reward", code: "no_reward" });
    }
    const user = await prisma.user.findUnique({
      where: { username: slugifyUsername(username) },
      select: { id: true, tokens: true }
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const ach = await prisma.userAchievement.findUnique({
      where: { userId_code: { userId: user.id, code } }
    }).catch(() => null);

    if (!ach) {
      return res.status(400).json({ error: "Achievement not unlocked", code: "not_unlocked" });
    }
    if (ach.claimedAt) {
      return res.json({
        ok: true,
        alreadyClaimed: true,
        tokensGranted: 0,
        tokens: Number(user.tokens) || 0,
        claimedAt: ach.claimedAt
      });
    }

    const now = new Date();
    try {
      const updated = await prisma.$transaction(async (tx) => {
        // Guard against race: only credit if claimedAt is still null.
        const fresh = await tx.userAchievement.findUnique({
          where: { userId_code: { userId: user.id, code } }
        });
        if (!fresh || fresh.claimedAt) {
          return { tokens: Number(user.tokens) || 0, claimedAt: fresh?.claimedAt || now, raced: true };
        }
        await tx.userAchievement.update({
          where: { userId_code: { userId: user.id, code } },
          data: { claimedAt: now }
        });
        const u = await tx.user.update({
          where: { id: user.id },
          data: { tokens: { increment: reward } },
          select: { tokens: true }
        });
        return { tokens: u.tokens, claimedAt: now, raced: false };
      });
      if (updated.raced) {
        return res.json({
          ok: true,
          alreadyClaimed: true,
          tokensGranted: 0,
          tokens: updated.tokens,
          claimedAt: updated.claimedAt
        });
      }
      return res.json({
        ok: true,
        alreadyClaimed: false,
        tokensGranted: reward,
        tokens: updated.tokens,
        claimedAt: updated.claimedAt
      });
    } catch (txErr) {
      console.error(`[Achievement Claim Tx Error] ${txErr?.message || txErr}`);
      return res.status(500).json({ error: "Claim failed", detail: txErr?.message });
    }
  } catch (error) {
    console.error(`[Achievement Claim Error] ${error?.message || error}`);
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// Per-code unlock rate, expressed as a fraction of all eligible users
// (anyone with at least one quest completion — keeps freshly registered
// dormant accounts from depressing the percentages). Cached in-process
// for ACHIEVEMENT_STATS_TTL_MS to avoid hammering the DB on every popup
// open. The cache is single-instance (each Render worker has its own),
// which is fine for this read-only stat — staleness up to the TTL is
// acceptable, and exact precision matters less than freshness.
const ACHIEVEMENT_STATS_TTL_MS = 60 * 60 * 1000; // 60 minutes
let achievementStatsCache = { at: 0, payload: null };

async function buildAchievementStats() {
  // Total active player base: distinct users with at least one quest
  // completion. Falls back to total user count if zero (e.g. fresh DB).
  const activeRows = await prisma.questCompletion.findMany({
    distinct: ["userId"],
    select: { userId: true }
  });
  let total = activeRows.length;
  if (!total) {
    total = await prisma.user.count();
  }
  const safeTotal = Math.max(1, total);

  const grouped = await prisma.userAchievement.groupBy({
    by: ["code"],
    _count: { _all: true }
  });
  const counts = new Map(grouped.map((r) => [r.code, r._count._all]));
  const stats = {};
  for (const code of ACHIEVEMENT_CODES) {
    const c = Number(counts.get(code)) || 0;
    // Cap at 100% — the unlocked count can briefly exceed the active
    // user denominator (e.g. dormant accounts that earned a milestone
    // before unlocking quest-completion tracking, or a stat cache that
    // beat a fresh wave of unlocks). The popup must never read
    // "120% of players unlocked this".
    const raw = (c / safeTotal) * 100;
    stats[code] = {
      unlockedCount: c,
      eligibleTotal: safeTotal,
      percent: Math.min(100, raw)
    };
  }
  return { totalActiveUsers: safeTotal, stats };
}

app.get("/api/achievements/stats", async (_req, res) => {
  try {
    const now = Date.now();
    if (achievementStatsCache.payload && (now - achievementStatsCache.at) < ACHIEVEMENT_STATS_TTL_MS) {
      return res.json(achievementStatsCache.payload);
    }
    const fresh = await buildAchievementStats();
    achievementStatsCache = { at: now, payload: fresh };
    res.json(fresh);
  } catch (error) {
    console.error(`[Achievement Stats Error] ${error?.message || error}`);
    res.status(500).json({ error: "Failed to load stats", detail: error?.message });
  }
});

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

// =============================================================================
// SOCIAL BLOCK: weekly leaderboard, search, public profile, friends, challenges
// =============================================================================

const LEADERBOARD_TEST_USERNAME_PREFIX = "leader_test_";
const LEADERBOARD_TEST_DISPLAY_PREFIX = "Leaderboard Test";

function currentWeekDayKeys(now = new Date()) {
  // Monday 00:00 UTC → today inclusive. Server runs UTC; dayKey is UTC-based.
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = today.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;
  const keys = [];
  for (let i = daysSinceMonday; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    keys.push(getDateKey(d));
  }
  return keys;
}

// GET /api/leaderboard/weekly?me=<uid> — top 100 by weekly XP (this week Mon→today UTC).
// When ?me is provided and the user is outside top 100, a separate `me` field
// carries their current rank so the client can render a sticky "your rank" card.
app.get("/api/leaderboard/weekly", async (req, res) => {
  try {
    const dayKeys = currentWeekDayKeys();
    const grouped = await prisma.dailyScore.groupBy({
      by: ["userId"],
      where: { dayKey: { in: dayKeys } },
      _sum: { xpToday: true, tasksCompleted: true }
    });
    grouped.sort((a, b) => (b._sum.xpToday || 0) - (a._sum.xpToday || 0));
    const topIds = grouped.slice(0, 100).map((g) => g.userId);
    // Community-wide weekly XP — summed across ALL ranked users, not just
    // top 100, so the hero stat in the Community header reflects the real
    // total effort of every active player this week.
    const totalWeeklyXp = grouped.reduce((acc, g) => acc + (g._sum.xpToday || 0), 0);

    let meUserId = null;
    const rawMe = String(req.query.me || "").trim().slice(0, 128);
    if (rawMe) {
      const me = await prisma.user.findUnique({ where: { username: rawMe }, select: { id: true } });
      meUserId = me?.id || null;
    }
    const meRankIdx = meUserId ? grouped.findIndex((g) => g.userId === meUserId) : -1;
    const needMeLookup = meUserId && meRankIdx >= 0 && meRankIdx >= 100;

    const lookupIds = [...topIds];
    if (needMeLookup) lookupIds.push(meUserId);

    if (lookupIds.length === 0) {
      return res.json({
        users: [],
        me: null,
        weekStartDayKey: dayKeys[0],
        weekDayCount: dayKeys.length,
        dayKeys,
        totalRanked: grouped.length,
        totalWeeklyXp,
        serverNowMs: Date.now()
      });
    }
    const users = await prisma.user.findMany({
      where: {
        id: { in: lookupIds },
        username: { not: { startsWith: LEADERBOARD_TEST_USERNAME_PREFIX } },
        displayName: { not: { startsWith: LEADERBOARD_TEST_DISPLAY_PREFIX } }
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        handle: true,
        photoUrl: true,
        level: true,
        streak: true,
        maxStreak: true
      }
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    function toEntry(g, rank) {
      const u = userMap.get(g.userId);
      if (!u) return null;
      return {
        rank,
        username: u.username,
        displayName: u.displayName,
        handle: u.handle,
        photoUrl: u.photoUrl,
        level: u.level,
        streak: u.streak,
        maxStreak: u.maxStreak,
        weeklyXp: g._sum.xpToday || 0,
        weeklyTasks: g._sum.tasksCompleted || 0
      };
    }

    const enriched = grouped.slice(0, 100).map((g, i) => toEntry(g, i + 1)).filter(Boolean);

    let me = null;
    if (meUserId) {
      if (meRankIdx >= 0) {
        if (meRankIdx < 100) {
          me = enriched[meRankIdx] || null;
        } else {
          me = toEntry(grouped[meRankIdx], meRankIdx + 1);
        }
      } else {
        // Ranked but zero XP this week — still show the user card with rank=null
        const meUser = await prisma.user.findUnique({
          where: { id: meUserId },
          select: { username: true, displayName: true, photoUrl: true, level: true, streak: true, maxStreak: true }
        });
        if (meUser) me = { rank: null, ...meUser, weeklyXp: 0, weeklyTasks: 0 };
      }
    }

    res.json({
      users: enriched,
      me,
      weekStartDayKey: dayKeys[0],
      weekDayCount: dayKeys.length,
      dayKeys,
      totalRanked: grouped.length,
      totalWeeklyXp,
      serverNowMs: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch weekly leaderboard", detail: error.message });
  }
});

// GET /api/users/search?q=nick&limit=20 — username / displayName / handle fuzzy search
app.get("/api/users/search", async (req, res) => {
  try {
    const rawQ = String(req.query.q || "").trim().slice(0, 64);
    if (rawQ.length < 2) return res.json({ users: [] });
    // Strip a leading "@" so `@alice` still matches handle="alice".
    const q = rawQ.replace(/^@+/, "");
    // Handles are stored lowercase; match against a lowercased variant too
    // to support `@Alice` inputs.
    const handleQ = q.toLowerCase();
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    // Prisma `mode: "insensitive"` is postgres-only. To keep SQLite-dev compatibility,
    // we match case-sensitively here and rely on the client to lowercase display text if needed.
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { username: { contains: q } },
              { displayName: { contains: q } },
              { handle: { contains: handleQ } }
            ]
          },
          { username: { not: { startsWith: LEADERBOARD_TEST_USERNAME_PREFIX } } },
          { displayName: { not: { startsWith: LEADERBOARD_TEST_DISPLAY_PREFIX } } }
        ]
      },
      select: {
        username: true,
        displayName: true,
        handle: true,
        photoUrl: true,
        level: true,
        streak: true,
        maxStreak: true
      },
      orderBy: [{ level: "desc" }, { xp: "desc" }],
      take: limit
    });
    res.json({ users });
  } catch (error) {
    res.status(400).json({ error: "Search failed", detail: error.message });
  }
});

// GET /api/handle/suggest?displayName=John → { handle: "john" | "john4821" }
// Returns an unclaimed handle seeded from displayName. Used by the
// onboarding screen as the default value for the @handle input.
app.get("/api/handle/suggest", async (req, res) => {
  try {
    const displayName = String(req.query.displayName || "").trim().slice(0, 64);
    const seed = seedHandleFromDisplayName(displayName);
    const handle = await ensureUniqueHandle(seed);
    res.json({ handle });
  } catch (error) {
    res.status(400).json({ error: "Failed to suggest handle", detail: error.message });
  }
});

// GET /api/handle/check?value=foo&username=me → { available, reason? }
// Client-side availability check for the onboarding @handle input.
// Passing `username` (Firebase UID) excludes the user's own current
// handle from the collision check, so re-confirming their own handle
// doesn't report "taken".
app.get("/api/handle/check", async (req, res) => {
  try {
    const raw = String(req.query.value || "");
    const candidate = normalizeHandle(raw);
    if (candidate.length < HANDLE_MIN_LENGTH) {
      return res.json({ available: false, reason: "too_short", normalized: candidate });
    }
    if (!isValidHandleShape(candidate)) {
      return res.json({ available: false, reason: "invalid", normalized: candidate });
    }
    let excludeUserId = null;
    const callerUsername = slugifyUsername(req.query.username || "");
    if (callerUsername) {
      const caller = await prisma.user.findUnique({ where: { username: callerUsername }, select: { id: true } });
      excludeUserId = caller?.id || null;
    }
    const clash = await prisma.user.findFirst({
      where: excludeUserId ? { handle: candidate, NOT: { id: excludeUserId } } : { handle: candidate },
      select: { id: true }
    });
    res.json({ available: !clash, normalized: candidate });
  } catch (error) {
    res.status(400).json({ error: "Handle check failed", detail: error.message });
  }
});

// GET /api/users/:username/public — read-only profile card for the leaderboard/search
app.get("/api/users/:username/public", async (req, res) => {
  try {
    const username = slugifyUsername(req.params.username);
    if (!username) return res.status(400).json({ error: "Invalid username" });
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        handle: true,
        photoUrl: true,
        level: true,
        xp: true,
        xpNext: true,
        streak: true,
        maxStreak: true,
        districtLevels: true,
        createdAt: true
      }
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Friend count + this-week XP + lifetime XP (cheap aggregates).
    const [friendCount, weeklyAgg, totalAgg] = await Promise.all([
      prisma.friendship.count({
        where: { OR: [{ userAId: user.id }, { userBId: user.id }] }
      }),
      prisma.dailyScore.aggregate({
        where: { userId: user.id, dayKey: { in: currentWeekDayKeys() } },
        _sum: { xpToday: true, tasksCompleted: true }
      }),
      prisma.dailyScore.aggregate({
        where: { userId: user.id },
        _sum: { xpToday: true }
      })
    ]);

    const { id: _omit, ...publicUser } = user;
    res.json({
      user: {
        ...publicUser,
        friendCount,
        weeklyXp: weeklyAgg._sum.xpToday || 0,
        weeklyTasks: weeklyAgg._sum.tasksCompleted || 0,
        totalXp: totalAgg._sum.xpToday || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch public profile", detail: error.message });
  }
});

// ---- Friend requests ----

function sortedFriendshipTuple(aId, bId) {
  return aId < bId ? [aId, bId] : [bId, aId];
}

async function loadUserByUsername(raw) {
  const username = slugifyUsername(raw);
  if (!username) return null;
  return prisma.user.findUnique({ where: { username } });
}

// GET /api/friends/relation?me=<username>&them=<username> — UI-button state
app.get("/api/friends/relation", async (req, res) => {
  try {
    const me = await loadUserByUsername(req.query.me);
    const them = await loadUserByUsername(req.query.them);
    if (!me || !them) return res.status(404).json({ error: "User not found" });
    if (me.id === them.id) return res.json({ state: "self" });

    const [aId, bId] = sortedFriendshipTuple(me.id, them.id);
    const friendship = await prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId: aId, userBId: bId } }
    });
    if (friendship) return res.json({ state: "friends" });

    const outgoing = await prisma.friendRequest.findUnique({
      where: { fromUserId_toUserId: { fromUserId: me.id, toUserId: them.id } }
    });
    const incoming = await prisma.friendRequest.findUnique({
      where: { fromUserId_toUserId: { fromUserId: them.id, toUserId: me.id } }
    });

    if (incoming && incoming.status === "PENDING") {
      return res.json({ state: "incoming_pending", requestId: incoming.id });
    }
    if (outgoing && outgoing.status === "PENDING") {
      return res.json({ state: "outgoing_pending", requestId: outgoing.id });
    }
    if (outgoing && outgoing.status === "DECLINED") {
      return res.json({ state: "declined_by_them" });
    }
    if (incoming && incoming.status === "DECLINED") {
      return res.json({ state: "can_add" });
    }
    return res.json({ state: "can_add" });
  } catch (error) {
    res.status(500).json({ error: "Failed to load relation", detail: error.message });
  }
});

// POST /api/friends/request { fromUsername, toUsername }
app.post("/api/friends/request", async (req, res) => {
  const schema = z.object({
    fromUsername: z.string().min(2).max(128),
    toUsername: z.string().min(2).max(128)
  });
  try {
    const parsed = schema.parse(req.body);
    const from = await loadUserByUsername(parsed.fromUsername);
    const to = await loadUserByUsername(parsed.toUsername);
    if (!from || !to) return res.status(404).json({ error: "User not found" });
    if (from.id === to.id) return res.status(400).json({ error: "Cannot friend yourself" });

    const [aId, bId] = sortedFriendshipTuple(from.id, to.id);
    const existingFriendship = await prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId: aId, userBId: bId } }
    });
    if (existingFriendship) return res.status(409).json({ error: "Already friends" });

    const incoming = await prisma.friendRequest.findUnique({
      where: { fromUserId_toUserId: { fromUserId: to.id, toUserId: from.id } }
    });
    if (incoming && incoming.status === "PENDING") {
      return res.status(409).json({ error: "You have an incoming request from this user" });
    }

    const outgoing = await prisma.friendRequest.findUnique({
      where: { fromUserId_toUserId: { fromUserId: from.id, toUserId: to.id } }
    });
    if (outgoing) {
      if (outgoing.status === "PENDING") {
        return res.status(409).json({ error: "Request already pending" });
      }
      if (outgoing.status === "DECLINED") {
        return res.status(403).json({ error: "Previous request was declined; only the other user can initiate" });
      }
    }

    const reqRow = await prisma.friendRequest.create({
      data: { fromUserId: from.id, toUserId: to.id, status: "PENDING" }
    });
    res.json({ ok: true, requestId: reqRow.id });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// POST /api/friends/respond { username, requestId, response: "accept"|"decline" }
app.post("/api/friends/respond", async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(128),
    requestId: z.string().min(1),
    response: z.enum(["accept", "decline"])
  });
  try {
    const parsed = schema.parse(req.body);
    const me = await loadUserByUsername(parsed.username);
    if (!me) return res.status(404).json({ error: "User not found" });
    const request = await prisma.friendRequest.findUnique({ where: { id: parsed.requestId } });
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.toUserId !== me.id) return res.status(403).json({ error: "Not your request to answer" });
    if (request.status !== "PENDING") return res.status(409).json({ error: "Already answered" });

    if (parsed.response === "decline") {
      await prisma.friendRequest.update({
        where: { id: request.id },
        data: { status: "DECLINED", respondedAt: new Date() }
      });
      return res.json({ ok: true, state: "declined" });
    }

    const [aId, bId] = sortedFriendshipTuple(request.fromUserId, request.toUserId);
    await prisma.$transaction([
      prisma.friendRequest.update({
        where: { id: request.id },
        data: { status: "ACCEPTED", respondedAt: new Date() }
      }),
      prisma.friendship.upsert({
        where: { userAId_userBId: { userAId: aId, userBId: bId } },
        create: { userAId: aId, userBId: bId },
        update: {}
      })
    ]);
    res.json({ ok: true, state: "accepted" });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// DELETE /api/friends/remove — { myUsername, theirUsername } — remove accepted friendship
app.delete("/api/friends/remove", async (req, res) => {
  const schema = z.object({
    myUsername: z.string().min(2).max(128),
    theirUsername: z.string().min(2).max(128)
  });
  try {
    const parsed = schema.parse(req.body);
    const me = await loadUserByUsername(parsed.myUsername);
    const them = await loadUserByUsername(parsed.theirUsername);
    if (!me || !them) return res.status(404).json({ error: "User not found" });

    const [aId, bId] = sortedFriendshipTuple(me.id, them.id);
    await prisma.$transaction([
      prisma.friendship.deleteMany({ where: { userAId: aId, userBId: bId } }),
      prisma.friendRequest.deleteMany({
        where: {
          OR: [
            { fromUserId: me.id, toUserId: them.id },
            { fromUserId: them.id, toUserId: me.id }
          ]
        }
      })
    ]);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// POST /api/friends/cancel — { fromUsername, toUsername } — cancel my outgoing pending
app.post("/api/friends/cancel", async (req, res) => {
  const schema = z.object({
    fromUsername: z.string().min(2).max(128),
    toUsername: z.string().min(2).max(128)
  });
  try {
    const parsed = schema.parse(req.body);
    const from = await loadUserByUsername(parsed.fromUsername);
    const to = await loadUserByUsername(parsed.toUsername);
    if (!from || !to) return res.status(404).json({ error: "User not found" });
    await prisma.friendRequest.deleteMany({
      where: { fromUserId: from.id, toUserId: to.id, status: "PENDING" }
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// GET /api/friends/requests/:username — incoming pending list for the bell
app.get("/api/friends/requests/:username", async (req, res) => {
  try {
    const me = await loadUserByUsername(req.params.username);
    if (!me) return res.status(404).json({ error: "User not found" });
    const rows = await prisma.friendRequest.findMany({
      where: { toUserId: me.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        fromUser: {
          select: { username: true, displayName: true, photoUrl: true, level: true, streak: true, maxStreak: true }
        }
      }
    });
    const requests = rows.map((r) => ({
      requestId: r.id,
      createdAt: r.createdAt,
      from: r.fromUser
    }));
    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch requests", detail: error.message });
  }
});

// GET /api/friends/list/:username — full friends list with stats + weekly XP
app.get("/api/friends/list/:username", async (req, res) => {
  try {
    const me = await loadUserByUsername(req.params.username);
    if (!me) return res.status(404).json({ error: "User not found" });

    const links = await prisma.friendship.findMany({
      where: { OR: [{ userAId: me.id }, { userBId: me.id }] },
      include: { userA: true, userB: true }
    });

    const friends = links.map((link) => {
      const friend = link.userAId === me.id ? link.userB : link.userA;
      return {
        id: friend.id,
        username: friend.username,
        displayName: friend.displayName,
        photoUrl: friend.photoUrl,
        level: friend.level,
        xp: friend.xp,
        xpNext: friend.xpNext,
        streak: friend.streak,
        maxStreak: friend.maxStreak,
        friendshipCreatedAt: link.createdAt
      };
    });

    // Attach weekly XP
    if (friends.length > 0) {
      const dayKeys = currentWeekDayKeys();
      const grouped = await prisma.dailyScore.groupBy({
        by: ["userId"],
        where: { userId: { in: friends.map((f) => f.id) }, dayKey: { in: dayKeys } },
        _sum: { xpToday: true }
      });
      const weeklyMap = new Map(grouped.map((g) => [g.userId, g._sum.xpToday || 0]));
      for (const f of friends) {
        f.weeklyXp = weeklyMap.get(f.id) || 0;
        delete f.id;
      }
    }

    res.json({ friends });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch friends", detail: error.message });
  }
});

// ---- Group challenges ----

const MAX_ACTIVE_CHALLENGES_PER_USER = 2;
const MAX_PARTICIPANTS_PER_CHALLENGE = 6; // creator + up to 5 friends
const MAX_CHALLENGES_CREATED_PER_DAY = 2;

// Count of challenges the user is an accepted, still-active participant in.
// Pending invites (acceptedAt=null) don't count — the user hasn't committed
// yet and shouldn't be blocked from creating or accepting more.
async function activeParticipationCount(userId) {
  const now = new Date();
  return prisma.challengeParticipant.count({
    where: {
      userId,
      leftAt: null,
      acceptedAt: { not: null },
      challenge: { endsAt: { gt: now } }
    }
  });
}

// Count of challenges this user has CREATED since UTC midnight today.
// Used to rate-limit challenge creation per user per day.
async function challengesCreatedTodayCount(userId) {
  const now = new Date();
  const startUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return prisma.groupChallenge.count({
    where: { creatorId: userId, createdAt: { gte: startUtc } }
  });
}

// POST /api/challenges — create a new group challenge
app.post("/api/challenges", async (req, res) => {
  const schema = z.object({
    creatorUsername: z.string().min(2).max(128),
    title: z.string().min(1).max(80),
    description: z.string().max(300).optional(),
    questTitle: z.string().min(1).max(80),
    questDescription: z.string().max(300).optional(),
    needsTimer: z.boolean().optional(),
    timeEstimateMin: z.number().int().min(0).max(180).optional(),
    durationDays: z.number().int().min(1).max(30),
    inviteeUsernames: z.array(z.string().min(2).max(128)).max(5)
  });
  try {
    const parsed = schema.parse(req.body);
    const creator = await loadUserByUsername(parsed.creatorUsername);
    if (!creator) return res.status(404).json({ error: "Creator not found" });

    const activeCount = await activeParticipationCount(creator.id);
    if (activeCount >= MAX_ACTIVE_CHALLENGES_PER_USER) {
      return res.status(409).json({ error: "Max active challenges reached", limit: MAX_ACTIVE_CHALLENGES_PER_USER });
    }

    // Per-day creation cap — prevents spamming invites at reset time.
    const createdToday = await challengesCreatedTodayCount(creator.id);
    if (createdToday >= MAX_CHALLENGES_CREATED_PER_DAY) {
      return res.status(429).json({
        error: "Daily challenge creation limit reached",
        code: "daily_create_limit",
        limit: MAX_CHALLENGES_CREATED_PER_DAY
      });
    }

    // Resolve invitees (must be friends of creator)
    const inviteeUsers = [];
    if (parsed.inviteeUsernames && parsed.inviteeUsernames.length > 0) {
      const uniq = Array.from(new Set(parsed.inviteeUsernames.map((u) => slugifyUsername(u)).filter(Boolean)));
      const users = await prisma.user.findMany({ where: { username: { in: uniq } } });
      if (users.length !== uniq.length) {
        return res.status(400).json({ error: "One or more invitees not found" });
      }
      // Verify each is a friend
      const friendLinks = await prisma.friendship.findMany({
        where: {
          OR: users.flatMap((u) => {
            const [aId, bId] = sortedFriendshipTuple(creator.id, u.id);
            return [{ userAId: aId, userBId: bId }];
          })
        }
      });
      if (friendLinks.length !== users.length) {
        return res.status(403).json({ error: "All invitees must be friends of the creator" });
      }
      // Each invitee must also have capacity — a challenge counts the same
      // against every participant's limit.
      const overLimit = [];
      for (const u of users) {
        const count = await activeParticipationCount(u.id);
        if (count >= MAX_ACTIVE_CHALLENGES_PER_USER) overLimit.push(u.username);
      }
      if (overLimit.length > 0) {
        return res.status(409).json({
          error: "Invitee at challenge limit",
          code: "invitee_limit",
          usernames: overLimit,
          limit: MAX_ACTIVE_CHALLENGES_PER_USER
        });
      }
      inviteeUsers.push(...users);
    }

    if (inviteeUsers.length + 1 > MAX_PARTICIPANTS_PER_CHALLENGE) {
      return res.status(400).json({ error: "Too many participants" });
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + parsed.durationDays * 24 * 60 * 60 * 1000);

    const challenge = await prisma.$transaction(async (tx) => {
      const created = await tx.groupChallenge.create({
        data: {
          creatorId: creator.id,
          title: parsed.title,
          description: parsed.description || "",
          questTitle: parsed.questTitle,
          questDescription: parsed.questDescription || "",
          needsTimer: !!parsed.needsTimer,
          timeEstimateMin: parsed.timeEstimateMin || 0,
          durationDays: parsed.durationDays,
          startedAt: now,
          endsAt
        }
      });
      // Creator accepts implicitly. Invitees are pending (acceptedAt=null)
      // until they tap Accept; the challenge is not activated until at
      // least 2 participants have acceptedAt != null.
      await tx.challengeParticipant.create({
        data: { challengeId: created.id, userId: creator.id, acceptedAt: now }
      });
      await tx.challengeLogEntry.create({
        data: { challengeId: created.id, userId: creator.id, type: "created" }
      });
      for (const invitee of inviteeUsers) {
        await tx.challengeParticipant.create({
          data: { challengeId: created.id, userId: invitee.id, acceptedAt: null }
        });
        await tx.challengeLogEntry.create({
          data: { challengeId: created.id, userId: invitee.id, type: "invited" }
        });
      }
      return created;
    });

    res.json({ ok: true, challengeId: challenge.id });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// POST /api/challenges/:id/leave { username }
app.post("/api/challenges/:id/leave", async (req, res) => {
  const schema = z.object({ username: z.string().min(2).max(128) });
  try {
    const parsed = schema.parse(req.body);
    const me = await loadUserByUsername(parsed.username);
    if (!me) return res.status(404).json({ error: "User not found" });
    const participant = await prisma.challengeParticipant.findUnique({
      where: { challengeId_userId: { challengeId: req.params.id, userId: me.id } }
    });
    if (!participant || participant.leftAt) {
      return res.status(404).json({ error: "Not an active participant" });
    }
    await prisma.$transaction([
      prisma.challengeParticipant.update({
        where: { id: participant.id },
        data: { leftAt: new Date() }
      }),
      prisma.challengeLogEntry.create({
        data: { challengeId: req.params.id, userId: me.id, type: "left" }
      })
    ]);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// POST /api/challenges/:id/invite { inviterUsername, inviteeUsernames[] }
// Creator-only. Creates pending ChallengeParticipant rows for each
// invitee (friends only, under the global participant cap).
app.post("/api/challenges/:id/invite", async (req, res) => {
  const schema = z.object({
    inviterUsername: z.string().min(2).max(128),
    inviteeUsernames: z.array(z.string().min(2).max(128)).min(1).max(10)
  });
  try {
    const parsed = schema.parse(req.body);
    const inviter = await loadUserByUsername(parsed.inviterUsername);
    if (!inviter) return res.status(404).json({ error: "User not found" });
    const challenge = await prisma.groupChallenge.findUnique({
      where: { id: req.params.id },
      include: { participants: true }
    });
    if (!challenge) return res.status(404).json({ error: "Challenge not found" });
    if (challenge.creatorId !== inviter.id) {
      return res.status(403).json({ error: "Only the creator can invite" });
    }
    if (new Date(challenge.endsAt) <= new Date()) {
      return res.status(409).json({ error: "Challenge already ended" });
    }

    const uniq = Array.from(new Set(parsed.inviteeUsernames.map((u) => slugifyUsername(u)).filter(Boolean)));
    const users = await prisma.user.findMany({ where: { username: { in: uniq } } });
    if (users.length !== uniq.length) {
      return res.status(400).json({ error: "One or more invitees not found" });
    }

    const friendLinks = await prisma.friendship.findMany({
      where: {
        OR: users.flatMap((u) => {
          const [aId, bId] = sortedFriendshipTuple(inviter.id, u.id);
          return [{ userAId: aId, userBId: bId }];
        })
      }
    });
    if (friendLinks.length !== users.length) {
      return res.status(403).json({ error: "All invitees must be friends of the creator" });
    }

    const existingByUserId = new Map(challenge.participants.map((p) => [p.userId, p]));
    const activeCount = challenge.participants.filter((p) => !p.leftAt).length;
    const newlyAddable = users.filter((u) => {
      const existing = existingByUserId.get(u.id);
      return !existing || existing.leftAt; // absent, or previously left → can re-invite
    });
    if (activeCount + newlyAddable.length > MAX_PARTICIPANTS_PER_CHALLENGE) {
      return res.status(409).json({
        error: "Too many participants",
        code: "challenge_full",
        limit: MAX_PARTICIPANTS_PER_CHALLENGE
      });
    }

    const nowTs = new Date();
    const ops = [];
    const added = [];
    for (const u of newlyAddable) {
      const existing = existingByUserId.get(u.id);
      if (existing) {
        // Previously left → reset to pending invite (acceptedAt cleared).
        ops.push(prisma.challengeParticipant.update({
          where: { id: existing.id },
          data: { leftAt: null, acceptedAt: null }
        }));
      } else {
        ops.push(prisma.challengeParticipant.create({
          data: { challengeId: challenge.id, userId: u.id }
        }));
      }
      ops.push(prisma.challengeLogEntry.create({
        data: { challengeId: challenge.id, userId: u.id, type: "invited" }
      }));
      added.push(u.username);
    }
    await prisma.$transaction(ops);
    res.json({ ok: true, added, skipped: users.filter((u) => !newlyAddable.includes(u)).map((u) => u.username) });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// POST /api/challenges/:id/remove-participant { requesterUsername, username }
// Creator-only. Marks the target participant as left (preserves history).
app.post("/api/challenges/:id/remove-participant", async (req, res) => {
  const schema = z.object({
    requesterUsername: z.string().min(2).max(128),
    username: z.string().min(2).max(128)
  });
  try {
    const parsed = schema.parse(req.body);
    const requester = await loadUserByUsername(parsed.requesterUsername);
    if (!requester) return res.status(404).json({ error: "Requester not found" });
    const target = await loadUserByUsername(parsed.username);
    if (!target) return res.status(404).json({ error: "Target user not found" });

    const challenge = await prisma.groupChallenge.findUnique({
      where: { id: req.params.id }
    });
    if (!challenge) return res.status(404).json({ error: "Challenge not found" });
    if (challenge.creatorId !== requester.id) {
      return res.status(403).json({ error: "Only the creator can remove participants" });
    }
    if (target.id === requester.id) {
      return res.status(400).json({ error: "Creator cannot remove themselves — use leave instead" });
    }

    const participant = await prisma.challengeParticipant.findUnique({
      where: { challengeId_userId: { challengeId: challenge.id, userId: target.id } }
    });
    if (!participant || participant.leftAt) {
      return res.status(404).json({ error: "Not an active participant" });
    }
    await prisma.$transaction([
      prisma.challengeParticipant.update({
        where: { id: participant.id },
        data: { leftAt: new Date() }
      }),
      prisma.challengeLogEntry.create({
        data: { challengeId: challenge.id, userId: target.id, type: "removed" }
      })
    ]);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// POST /api/challenges/:id/join { username } — rejoin after leaving (or be invited later)
app.post("/api/challenges/:id/join", async (req, res) => {
  const schema = z.object({ username: z.string().min(2).max(128) });
  try {
    const parsed = schema.parse(req.body);
    const me = await loadUserByUsername(parsed.username);
    if (!me) return res.status(404).json({ error: "User not found" });
    const challenge = await prisma.groupChallenge.findUnique({
      where: { id: req.params.id },
      include: { participants: true }
    });
    if (!challenge) return res.status(404).json({ error: "Challenge not found" });
    if (new Date(challenge.endsAt) <= new Date()) {
      return res.status(409).json({ error: "Challenge already ended" });
    }
    const activeParticipants = challenge.participants.filter((p) => !p.leftAt);
    if (activeParticipants.length >= MAX_PARTICIPANTS_PER_CHALLENGE) {
      return res.status(409).json({ error: "Challenge is full" });
    }
    const activeCount = await activeParticipationCount(me.id);
    if (activeCount >= MAX_ACTIVE_CHALLENGES_PER_USER) {
      return res.status(409).json({ error: "Max active challenges reached", limit: MAX_ACTIVE_CHALLENGES_PER_USER });
    }

    const existing = challenge.participants.find((p) => p.userId === me.id);
    const nowTs = new Date();
    await prisma.$transaction([
      existing
        ? prisma.challengeParticipant.update({
            where: { id: existing.id },
            // Clear leftAt (rejoin) AND stamp acceptedAt (accept pending invite).
            data: { leftAt: null, acceptedAt: existing.acceptedAt || nowTs }
          })
        : prisma.challengeParticipant.create({
            data: { challengeId: challenge.id, userId: me.id, acceptedAt: nowTs }
          }),
      prisma.challengeLogEntry.create({
        data: { challengeId: challenge.id, userId: me.id, type: "joined" }
      })
    ]);
    trackAchievements(me.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// POST /api/challenges/:id/complete { username } — log a completion for today
// Award 10 XP per day of the challenge when every active participant
// has successfully completed every single day of its duration.
const CHALLENGE_XP_PER_DAY = 10;

app.post("/api/challenges/:id/complete", async (req, res) => {
  const schema = z.object({ username: z.string().min(2).max(128) });
  try {
    const parsed = schema.parse(req.body);
    const me = await loadUserByUsername(parsed.username);
    if (!me) return res.status(404).json({ error: "User not found" });
    const challengeId = req.params.id;
    const challenge = await prisma.groupChallenge.findUnique({
      where: { id: challengeId },
      include: { participants: true }
    });
    if (!challenge) return res.status(404).json({ error: "Challenge not found" });
    if (new Date(challenge.endsAt) <= new Date()) {
      return res.status(409).json({ error: "Challenge already ended" });
    }

    const meParticipant = challenge.participants.find((p) => p.userId === me.id && !p.leftAt);
    if (!meParticipant) return res.status(403).json({ error: "Not an active participant" });
    if (!meParticipant.acceptedAt) {
      return res.status(409).json({ error: "Invite not accepted yet", code: "invite_pending" });
    }
    const activeAccepted = challenge.participants.filter((p) => p.acceptedAt && !p.leftAt);
    if (activeAccepted.length < 2) {
      return res.status(409).json({ error: "Challenge needs at least 2 players", code: "not_activated" });
    }

    const now = new Date();
    const dayKey = getDateKey(now);

    if (meParticipant.lastCompletionDayKey === dayKey) {
      return res.status(409).json({ error: "Already completed today" });
    }

    // ── Missed-day reset ────────────────────────────────────────────
    // Group progress rule: groupDaysCompleted ticks up ONLY when every
    // active+accepted participant completes on the same UTC day. If
    // ANY prior day between lastAwardedDayKey and today was missed, the
    // counter falls back to 0. We detect this by checking if the last
    // all-complete day is yesterday (= streak continues) or not
    // (= at least one day elapsed without a group completion).
    const prevDay = new Date(now);
    prevDay.setUTCDate(prevDay.getUTCDate() - 1);
    const prevDayKey = getDateKey(prevDay);
    let workingGroupDays = challenge.groupDaysCompleted || 0;
    if (
      workingGroupDays > 0
      && challenge.lastAwardedDayKey
      && challenge.lastAwardedDayKey !== dayKey
      && challenge.lastAwardedDayKey !== prevDayKey
    ) {
      workingGroupDays = 0;
    }

    // Per-completer streak update (still tracked for show/history but
    // rewards no longer hinge on it).
    const nextConsecutive = meParticipant.lastCompletionDayKey === prevDayKey
      ? meParticipant.consecutiveDays + 1
      : 1;

    // Would today hit the "everyone completed" threshold?
    const othersDoneToday = activeAccepted
      .filter((p) => p.userId !== me.id)
      .every((p) => p.lastCompletionDayKey === dayKey);
    const groupCompletedToday = othersDoneToday && challenge.lastAwardedDayKey !== dayKey;

    const nextGroupDays = groupCompletedToday ? workingGroupDays + 1 : workingGroupDays;
    const challengeFinished = groupCompletedToday
      && !challenge.completionAwarded
      && nextGroupDays >= (challenge.durationDays || 1);
    const finalXpPerUser = challengeFinished
      ? CHALLENGE_XP_PER_DAY * Math.max(1, Number(challenge.durationDays) || 1)
      : 0;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark this participant's completion (no per-user token).
      await tx.challengeParticipant.update({
        where: { id: meParticipant.id },
        data: {
          completions: { increment: 1 },
          consecutiveDays: nextConsecutive,
          lastCompletionDayKey: dayKey
        }
      });
      await tx.challengeLogEntry.create({
        data: { challengeId, userId: me.id, type: "completed" }
      });

      // 2. If this completion closed the group-day, mint tokens for
      //    every active participant and tick the group counter.
      let groupDayAwardedUsernames = [];
      if (groupCompletedToday) {
        for (const p of activeAccepted) {
          await tx.challengeParticipant.update({
            where: { id: p.id },
            data: { tokensEarned: { increment: 1 } }
          });
          await tx.user.update({
            where: { id: p.userId },
            data: { tokens: { increment: 1 } }
          });
          groupDayAwardedUsernames.push(p.userId);
        }
        await tx.groupChallenge.update({
          where: { id: challengeId },
          data: {
            lastAwardedDayKey: dayKey,
            groupDaysCompleted: nextGroupDays
          }
        });
        await tx.challengeLogEntry.create({
          data: { challengeId, userId: me.id, type: "group_day_complete" }
        });
      } else if (workingGroupDays !== (challenge.groupDaysCompleted || 0)) {
        // Reset was triggered but no award this tick — persist the reset.
        await tx.groupChallenge.update({
          where: { id: challengeId },
          data: { groupDaysCompleted: workingGroupDays }
        });
      }

      // 3. Final payout when the challenge reaches its duration.
      if (challengeFinished) {
        for (const p of activeAccepted) {
          const fresh = await tx.user.findUnique({
            where: { id: p.userId },
            select: { xp: true, xpNext: true, level: true }
          });
          if (!fresh) continue;
          let xp = fresh.xp + finalXpPerUser;
          let level = fresh.level;
          let xpNext = fresh.xpNext;
          while (xp >= xpNext) {
            xp -= xpNext;
            level += 1;
            xpNext = Math.floor(xpNext * 1.1);
          }
          await tx.user.update({
            where: { id: p.userId },
            data: { xp, level, xpNext }
          });
        }
        await tx.groupChallenge.update({
          where: { id: challengeId },
          data: { completionAwarded: true }
        });
        await tx.challengeLogEntry.create({
          data: { challengeId, userId: me.id, type: "challenge_complete" }
        });
      }

      return { groupDayAwardedUsernames };
    });

    // Re-evaluate achievements for all active participants when the
    // challenge just finished (unlocks `champion` for qualifying durations).
    if (challengeFinished) {
      for (const p of activeAccepted) {
        trackAchievements(p.userId);
      }
    } else {
      trackAchievements(me.id);
    }

    res.json({
      ok: true,
      groupDayComplete: groupCompletedToday,
      tokensAwarded: groupCompletedToday ? 1 : 0,
      groupDaysCompleted: nextGroupDays,
      totalDays: challenge.durationDays,
      challengeFinished,
      finalXpPerUser,
      participantsRewarded: groupCompletedToday ? result.groupDayAwardedUsernames.length : 0
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

// GET /api/challenges/:id — full detail (participants, logs, progress)
app.get("/api/challenges/:id", async (req, res) => {
  try {
    const challenge = await prisma.groupChallenge.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { username: true, displayName: true, photoUrl: true } },
        participants: {
          include: {
            user: { select: { username: true, displayName: true, photoUrl: true, level: true } }
          }
        },
        logs: {
          orderBy: { createdAt: "desc" },
          take: 100,
          include: {
            user: { select: { username: true, displayName: true, photoUrl: true } }
          }
        }
      }
    });
    if (!challenge) return res.status(404).json({ error: "Challenge not found" });
    const acceptedCount = (challenge.participants || []).filter((p) => p.acceptedAt && !p.leftAt).length;
    res.json({
      challenge: { ...challenge, isActivated: acceptedCount >= 2, acceptedCount },
      serverNowMs: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch challenge", detail: error.message });
  }
});

// GET /api/challenges/user/:username — active + recently-ended challenges for this user
app.get("/api/challenges/user/:username", async (req, res) => {
  try {
    const me = await loadUserByUsername(req.params.username);
    if (!me) return res.status(404).json({ error: "User not found" });
    const rows = await prisma.challengeParticipant.findMany({
      where: { userId: me.id, leftAt: null },
      include: {
        challenge: {
          include: {
            creator: { select: { username: true, displayName: true } },
            participants: {
              include: {
                user: { select: { username: true, displayName: true, photoUrl: true } }
              }
            }
          }
        }
      },
      orderBy: { joinedAt: "desc" }
    });
    const challenges = rows
      .map((p) => {
        const acceptedCount = (p.challenge.participants || []).filter((pp) => pp.acceptedAt && !pp.leftAt).length;
        return {
          ...p.challenge,
          myCompletions: p.completions,
          myConsecutiveDays: p.consecutiveDays,
          myTokensEarned: p.tokensEarned,
          myLastCompletionDayKey: p.lastCompletionDayKey,
          myAcceptedAt: p.acceptedAt,
          isActivated: acceptedCount >= 2,
          acceptedCount
        };
      })
      .filter((c) => new Date(c.endsAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // show ended-within-week too
    const createdToday = await challengesCreatedTodayCount(me.id);
    res.json({
      challenges,
      createdToday,
      dailyCreateLimit: MAX_CHALLENGES_CREATED_PER_DAY,
      activeChallengeLimit: MAX_ACTIVE_CHALLENGES_PER_USER,
      serverNowMs: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to list challenges", detail: error.message });
  }
});
