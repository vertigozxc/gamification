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

    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin) || isAllowedLanOrigin(origin)) {
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
        updatedAt: user.updatedAt,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load users", detail: error.message });
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
    const [, , updatedUser] = await prisma.$transaction([
      prisma.questCompletion.deleteMany({ where: { userId: user.id } }),
      prisma.dailyScore.deleteMany({ where: { userId: user.id } }),
      prisma.user.update({
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
          lastDailyRerollAt: null,
          extraRerollsToday: 0,
          lastDailyResetAt: now
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
    const [, , , , , , updatedUser] = await prisma.$transaction([
      prisma.questCompletion.deleteMany({ where: { userId: user.id } }),
      prisma.dailyScore.deleteMany({ where: { userId: user.id } }),
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
          theme: "adventure",
          lastStreakIncreaseAt: null,
          streakFreezeExpiresAt: null,
          lastFreeTaskRerollAt: null,
          lastDailyRerollAt: null,
          extraRerollsToday: 0,
          lastDailyResetAt: now
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
app.post("/api/events/ingest", async (req, res) => {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const body = req.body || {};
  const key = String(body.userId || ip);

  if (!allowEventIngest(key)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const ua = String(req.headers["user-agent"] || "");
  const events = Array.isArray(body.events) ? body.events : [body];

  await Promise.all(events.slice(0, 50).map((evt) =>
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

  res.json({ ok: true, count: events.length });
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
  return [...new Set(String(rawValue)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0 && (validQuestIds.has(item) || customAllow.has(item))))].slice(0, getPreferredQuestCount());
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

function buildCustomQuestEntry(customQuest) {
  return {
    id: toCustomVirtualId(customQuest.id),
    title: customQuest.title,
    desc: customQuest.description || "",
    xp: 30,
    baseXp: 30,
    stat: customQuest.stat || "sta",
    category: "CUSTOM",
    effortScore: 3,
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
  const preferredQuestIds = parsePreferredQuestIds(user.preferredQuestIds, customIds).slice(0, getPreferredQuestCount());
  return {
    preferredQuestIds,
    needsOnboarding: preferredQuestIds.length < getPreferredQuestCount()
  };
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

function composeDailyQuests(user, completedQuestIds = [], date = new Date(), excludeCategories = [], language = "en", customQuests = []) {
  const customById = new Map(customQuests.map((cq) => [toCustomVirtualId(cq.id), cq]));
  const allPreferredIds = parsePreferredQuestIds(user.preferredQuestIds, [...customById.keys()]);
  const regularPinnedIds = allPreferredIds.filter((id) => !isCustomQuestVirtualId(id));
  const customPinnedIds = allPreferredIds.filter(isCustomQuestVirtualId);

  let baseQuests = getDailyQuests({
    date,
    username: user.username,
    resetSeed: user.lastDailyResetAt?.getTime?.() ?? 0,
    pinnedQuestIds: regularPinnedIds,
    excludeCategories,
    streak: user.streak || 0,
    language
  });

  // `baseQuests` is composed using only regular pinned ids. Keep the random-slot
  // count anchored to those regular slots so custom pinned habits do not reduce
  // daily random quest count.
  const expectedRandomCount = Math.max(
    0,
    Math.min(getRandomQuestCount(), baseQuests.length - regularPinnedIds.length)
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

  const useSavedRandomQuests = isValidRandomQuestSet(savedRandomQuests, expectedRandomCount);
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
  const { updateTierState = false, precomputedProgress = null } = options;
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

// ── Custom habit CRUD ──
const customQuestSchema = z.object({
  username: z.string().min(2).max(64),
  title: z.string().trim().min(1).max(CUSTOM_QUEST_TITLE_MAX),
  description: z.string().trim().max(CUSTOM_QUEST_DESC_MAX).optional().default(""),
  stat: z.enum(["str", "int", "sta"]).optional().default("sta")
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
        stat: parsed.stat
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
      stat: z.enum(["str", "int", "sta"]).optional()
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
    if (parsed.stat !== undefined) data.stat = parsed.stat;

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
  const { preferredQuestIds, needsOnboarding } = onboardingStatus(user, customQuests);
  const precomputedProgress = buildTodayProgressSnapshot(user, completionIds, customQuests, now);
  const [pinnedQuestProgress21d, { productivity }] = await Promise.all([
    getPinnedQuestProgress21d(user, preferredQuestIds, now),
    updateAndReadProductivity(user, now, {
      updateTierState: false,
      precomputedProgress
    })
  ]);

  res.json({
    user,
    dateKey,
    completedQuestIds: completionIds,
    streak: user.streak,
    hasRerolledToday: hasUsedDailyRerollToday(user, now),
    extraRerollsToday: Number(user.extraRerollsToday || 0),
    quests: composeDailyQuests(user, completionIds, now, [], language, customQuests),
    streakFreezeActive,
    preferredQuestIds,
    pinnedQuestProgress21d,
    needsOnboarding,
    allQuests: needsOnboarding ? getQuestPool({ language }) : [],
    customQuests: customQuests.map(buildCustomQuestEntry),
    productivity,
    ...buildServerTimeMeta(now)
  });
});

app.post("/api/onboarding/complete", async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(64),
    displayName: z.string().min(1).max(64),
    // See /api/profiles/upsert for rationale on the 150 KB cap.
    photoUrl: z.string().max(150_000).optional(),
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

    const customQuests = await fetchUserCustomQuests(user.id);
    const customVirtualIds = new Set(customQuests.map((cq) => toCustomVirtualId(cq.id)));

    const existingPreferred = parsePreferredQuestIds(user.preferredQuestIds, [...customVirtualIds]);
    if (existingPreferred.length >= getPreferredQuestCount()) {
      return res.status(409).json({ error: "Preferred quests are already locked" });
    }

    const uniquePreferredQuestIds = [...new Set(parsed.preferredQuestIds)].slice(0, getPreferredQuestCount());
    if (uniquePreferredQuestIds.length !== getPreferredQuestCount()) {
      return res.status(400).json({ error: `Pick exactly ${getPreferredQuestCount()} unique preferred quests` });
    }

    const allQuestIds = new Set(getQuestPool().map((quest) => quest.id));
    const invalidQuestId = uniquePreferredQuestIds.find((id) => !allQuestIds.has(id) && !customVirtualIds.has(id));
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
      hasRerolledToday: hasUsedDailyRerollToday(updatedUser, now),
      extraRerollsToday: Number(updatedUser.extraRerollsToday || 0),
      quests: composeDailyQuests(updatedUser, completions.map((item) => item.questId), now, [], language, customQuests),
      streakFreezeActive,
      preferredQuestIds: uniquePreferredQuestIds,
      pinnedQuestProgress21d,
      needsOnboarding: false,
      customQuests: customQuests.map(buildCustomQuestEntry),
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
    const customQuests = await fetchUserCustomQuests(user.id);
    const availableQuests = composeDailyQuests(user, todayCompletions.map((item) => item.questId), new Date(), [], language, customQuests);
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

    const customIds = customQuests.map((cq) => toCustomVirtualId(cq.id));
    const pinnedQuestIds = parsePreferredQuestIds(user.preferredQuestIds, customIds);
    const isHabit = pinnedQuestIds.includes(quest.id) || isCustomQuestVirtualId(quest.id);
    const questForXp = isHabit ? { ...quest, xp: 30 } : quest;
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
    let habitMilestoneReached = false;
    let habitMilestoneTokens = 0;

    if (pinnedQuestIds.includes(quest.id)) {
      const nextPinnedQuestStreak = await getQuestConsecutiveDaysForUser(user.id, quest.id);
      if (previousPinnedQuestStreak < 21 && nextPinnedQuestStreak >= 21) {
        habitMilestoneReached = true;
        habitMilestoneTokens = 10;
      }
    }
    
    const newStreak = calculateStreak(todayCompletionsCount, user.streak);
    const streakIncreased = newStreak > user.streak;
    const now = new Date();
    const todayKey = getDateKey(now);
    const lastIncreaseKey = user.lastStreakIncreaseAt ? getDateKey(user.lastStreakIncreaseAt) : null;
    const canIncreaseStreakToday = lastIncreaseKey !== todayKey;

    // Atomic XP read+compute+write: lock the user row so concurrent completions
    // (e.g. mobile + web simultaneously) cannot both read the same stale XP and
    // overwrite each other, causing lost XP.
    const baseTokenIncrement = milestoneReward.bonusTokens + (habitMilestoneReached ? habitMilestoneTokens : 0);
    const { updatedUser, xpState, xpStateWithMilestone } = await prisma.$transaction(async (tx) => {
      // Acquire an exclusive row lock so any concurrent transaction for the same
      // user blocks here until this one commits.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
      const freshUser = await tx.user.findUnique({ where: { id: user.id } });
      const freshXpState = xpAfterQuest(freshUser, questForXp, freshUser.streak || 0);
      const freshXpStateWithMilestone = applyBonusXpProgress(freshXpState, milestoneReward.bonusXp);

      let freshTokenIncrement = baseTokenIncrement;
      if (freshXpStateWithMilestone.level > freshUser.level) {
        for (let lvl = freshUser.level + 1; lvl <= freshXpStateWithMilestone.level; lvl++) {
          freshTokenIncrement += lvl >= 10 ? 2 : 1;
        }
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
      }

      const updated = await tx.user.update({ where: { id: user.id }, data: txUpdateData });
      return { updatedUser: updated, xpState: freshXpState, xpStateWithMilestone: freshXpStateWithMilestone };
    });

    const productivityState = await updateAndReadProductivity(updatedUser, now, { updateTierState: true });
    const finalUser = productivityState.user;

    const responsePayload = {
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
    };

    console.error(`[Quest Complete Response] totalAwardedXp: ${responsePayload.totalAwardedXp}, awardedXp: ${responsePayload.awardedXp}, user.xp: ${finalUser.xp}, user.level: ${finalUser.level}`);

    res.json(responsePayload);
  } catch (error) {
    console.error(`[Quest Complete Error] ${error?.message || error}`, error);
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

const CITY_SPIN_REWARDS = [
  { id: 1,  type: "xp",    amount: 10,  weight: 25 },
  { id: 2,  type: "token", amount: 1,   weight: 25 },
  { id: 3,  type: "token", amount: 3,   weight: 15 },
  { id: 4,  type: "xp",    amount: 20,  weight: 15 },
  { id: 5,  type: "xp",    amount: 50,  weight: 5  },
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
    const user = await prisma.user.findUnique({ where: { username }, select: { lastCitySpinDayKey: true } });
    if (!user) return res.status(404).json({ error: "User not found" });
    const todayKey = getDateKey(new Date());
    const alreadySpun = user.lastCitySpinDayKey === todayKey;
    return res.json({ alreadySpun, nextSpinAt: nextMidnightUTC().toISOString() });
  } catch (error) {
    res.status(400).json({ error: "Invalid request", detail: error.message });
  }
});

app.post("/api/city/spin", async (req, res) => {
  const schema = z.object({ username: z.string().min(2).max(64) });
  try {
    const { username } = schema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username: slugifyUsername(username) } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const now = new Date();
    const todayKey = getDateKey(now);
    const nextSpinAt = nextMidnightUTC(now).toISOString();
    if (isAlreadySpunToday(user, todayKey)) {
      return res.json({ ok: false, alreadySpun: true, nextSpinAt });
    }

    const reward = pickCitySpinReward();
    const claimToken = createSpinClaimToken({
      userId: user.id,
      username: user.username,
      reward,
      dayKey: todayKey,
      expiresAtMs: Date.parse(nextSpinAt)
    });

    return res.json({
      ok: true,
      pending: true,
      reward: { id: reward.id, type: reward.type, amount: reward.amount },
      claimToken,
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

    const payload = verifySpinClaimToken(claimToken);
    if (!payload) {
      return res.status(400).json({ error: "Invalid or expired claim token" });
    }

    const now = new Date();
    const todayKey = getDateKey(now);
    const nextSpinAt = nextMidnightUTC(now).toISOString();
    if (isAlreadySpunToday(user, todayKey)) {
      return res.json({ ok: false, alreadySpun: true, nextSpinAt });
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
      excludeCategories: z.array(z.string()).optional(),
      targetQuestId: z.number().int().optional().nullable(),
      keepQuestIds: z.array(z.number().int()).optional()
    });
    const parsed = schema.parse(req.body);
    pushTiming("parse", tParse);

    const tUserLoad = Date.now();
    const username = slugifyUsername(parsed.username);
    const user = await prisma.user.findUnique({ where: { username } });
    pushTiming("db_user", tUserLoad);

    if (!user) {
      timingParts.push(`total;dur=${Math.max(0, Date.now() - requestStartedAt)}`);
      res.setHeader("Server-Timing", timingParts.join(", "));
      res.setHeader("Timing-Allow-Origin", "*");
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();
    const today = getDateKey(now);
    const streakDecayData = {};
    let todayRows = [];

    if (!parsed.isReroll) {
      // On the first reset of a new UTC day, streak rules should be evaluated
      // against the previous day completions (the day that just ended).
      const lastDailyResetKey = user.lastDailyResetAt ? getDateKey(new Date(user.lastDailyResetAt)) : null;
      const isFirstResetForUtcDay = lastDailyResetKey !== today;
      const streakEvaluationDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      if (isFirstResetForUtcDay) {
        streakEvaluationDate.setUTCDate(streakEvaluationDate.getUTCDate() - 1);
      }
      const streakEvaluationDayKey = getDateKey(streakEvaluationDate);

      const tDecayRows = Date.now();
      const decayRows = await prisma.questCompletion.findMany({
        where: { userId: user.id, dayKey: streakEvaluationDayKey },
        select: { id: true, questId: true }
      });
      pushTiming("db_decay_rows", tDecayRows);

      const freezeActive = user.streakFreezeExpiresAt
        ? getDateKey(new Date(user.streakFreezeExpiresAt)) >= streakEvaluationDayKey
        : false;
      if (decayRows.length < 3 && !freezeActive && user.streak > 0) {
        streakDecayData.streak = 0;
      }

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

    if (parsed.isReroll && parsed.targetQuestId && Array.isArray(parsed.keepQuestIds)) {
      const { preferredQuestIds: pinned } = onboardingStatus(user, userCustomQuests);
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

    const tUserUpdate = Date.now();
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastDailyResetAt: now,
        lastStreakIncreaseAt: parsed.isReroll ? user.lastStreakIncreaseAt : null,
        randomQuestIds: newRandomQuestIds, // Always replace or clear it!
        ...rerollStateData,
        ...streakDecayData
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
      updateAndReadProductivity(updatedUser, now, { updateTierState: true }),
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
      ...buildServerTimeMeta(now)
    });
  } catch (error) {
    timingParts.push(`total;dur=${Math.max(0, Date.now() - requestStartedAt)}`);
    res.setHeader("Server-Timing", timingParts.join(", "));
    res.setHeader("Timing-Allow-Origin", "*");
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
    const now = new Date();
    const today = getDateKey(now);
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    // One guarded write prevents multi-tap races from charging repeatedly.
    const guardedUpdate = await prisma.user.updateMany({
      where: {
        id: user.id,
        tokens: { gte: 3 },
        OR: [
          { streakFreezeExpiresAt: null },
          { streakFreezeExpiresAt: { lt: todayStart } }
        ]
      },
      data: { tokens: { decrement: 3 }, streakFreezeExpiresAt: tomorrow }
    });

    if (guardedUpdate.count === 0) {
      const latestUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!latestUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const alreadyFrozen = latestUser.streakFreezeExpiresAt
        ? getDateKey(new Date(latestUser.streakFreezeExpiresAt)) >= today
        : false;

      if (alreadyFrozen) {
        return res.status(400).json({ error: "Streak is already frozen for today" });
      }
      if (latestUser.tokens < 3) {
        return res.status(400).json({ error: "Not enough tokens" });
      }

      return res.status(409).json({ error: "Freeze purchase conflicted, please retry" });
    }

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    res.json({
      ok: true,
      tokens: updatedUser?.tokens ?? Math.max(0, user.tokens - 3),
      streakFreezeActive: true,
      streakFreezeExpiresAt: tomorrow.toISOString()
    });
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

    const preferredList = parsePreferredQuestIds(user.preferredQuestIds, (await fetchUserCustomQuests(user.id)).map((cq) => toCustomVirtualId(cq.id)));
    if (preferredList.length === 0) {
      return res.status(400).json({ error: "No pinned quests to reroll" });
    }

    const now = new Date();
    const isFreeAvailable = !user.lastFreeTaskRerollAt || (now.getTime() - new Date(user.lastFreeTaskRerollAt).getTime() >= FREE_PINNED_REROLL_INTERVAL_MS);
    const shouldUseTokens = parsed.useTokens || !isFreeAvailable;

    if (shouldUseTokens && user.tokens < 7) {
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
    const isFreeAvailable = !user.lastFreeTaskRerollAt || (now.getTime() - new Date(user.lastFreeTaskRerollAt).getTime() >= FREE_PINNED_REROLL_INTERVAL_MS);
    // If free reroll is available, always use it regardless of client flag.
    const shouldUseTokens = !isFreeAvailable;

    if (shouldUseTokens && user.tokens < 7) {
      return res.status(400).json({ error: "Not enough tokens" });
    }

    const uniquePreferredQuestIds = [...new Set(parsed.preferredQuestIds)];
    if (uniquePreferredQuestIds.length !== parsed.preferredQuestIds.length) {
      return res.status(400).json({ error: "Preferred quests must be different" });
    }

    const customQuests = await fetchUserCustomQuests(user.id);
    const customVirtualIds = new Set(customQuests.map((cq) => toCustomVirtualId(cq.id)));
    const allQuestIds = new Set(getQuestPool().map((quest) => quest.id));
    const invalidQuestId = uniquePreferredQuestIds.find((id) => !allQuestIds.has(id) && !customVirtualIds.has(id));
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

    const customQuests = await fetchUserCustomQuests(user.id);
    const customVirtualIds = customQuests.map((cq) => toCustomVirtualId(cq.id));

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
        lastDailyRerollAt: null,
        extraRerollsToday: 0,
        lastDailyResetAt: now
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

if (isMainModule) {
  const bootstrap = async () => {
    await ensureLeaderboardTestUsers();
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
  const userId = req.params.userId;
  if (!userId || typeof userId !== "string" || userId.length > 128) {
    return res.status(400).json({ error: "Invalid userId" });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    await prisma.$transaction([
      prisma.questCompletion.deleteMany({ where: { userId: user.id } }),
      prisma.dailyScore.deleteMany({ where: { userId: user.id } }),
      prisma.customQuest.deleteMany({ where: { userId: user.id } }),
      prisma.questFeedback.deleteMany({ where: { userId: user.id } }),
      prisma.friendship.deleteMany({ where: { OR: [{ userAId: user.id }, { userBId: user.id }] } }),
      prisma.invite.deleteMany({ where: { OR: [{ inviterId: user.id }, { invitedUserId: user.id }] } }),
      prisma.event.deleteMany({ where: { userId: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete profile", detail: error.message });
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
