// Achievements: 10 unlockable milestones per user. Each code is idempotent —
// evaluateAchievements() reads the current user state plus any gated
// queries (only run for still-locked codes) and upserts any new unlocks.
// Callers fire-and-forget: .catch(() => {}) — a failure must never break
// the action that triggered it.

export const ACHIEVEMENT_CODES = [
  "week_warrior",
  "month_monk",
  "hundred_club",
  "first_handshake",
  "champion",
  "mentor",
  "first_coin",
  "high_roller",
  "polyglot",
  "phoenix",
  // Knowledge Quiz pass — granted exclusively by /api/quiz/scholar/claim
  // when the user scores 10/10 for the first time. evaluateAchievements
  // does not infer it from user state (no field to derive it from), so
  // it lives in this list purely for ordering / rendering.
  "scholar"
];

const HIGH_ROLLER_THRESHOLD = 200;
const CHAMPION_MIN_DURATION_DAYS = 7;
const MENTOR_INVITE_COUNT = 3;

export async function evaluateAchievements(prisma, userId) {
  if (!prisma || !userId) return [];

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      streak: true,
      maxStreak: true,
      tokensSpentTotal: true,
      cityResetsPaid: true,
      preferredLanguage: true
    }
  });
  if (!user) return [];

  const existing = await prisma.userAchievement.findMany({
    where: { userId },
    select: { code: true }
  });
  const already = new Set(existing.map((row) => row.code));
  const toUnlock = [];
  const peakStreak = Math.max(user.streak || 0, user.maxStreak || 0);

  if (!already.has("week_warrior") && peakStreak >= 7) toUnlock.push("week_warrior");
  if (!already.has("month_monk") && peakStreak >= 30) toUnlock.push("month_monk");
  if (!already.has("hundred_club") && peakStreak >= 100) toUnlock.push("hundred_club");
  if (!already.has("first_coin") && (user.tokensSpentTotal || 0) >= 1) toUnlock.push("first_coin");
  if (!already.has("high_roller") && (user.tokensSpentTotal || 0) >= HIGH_ROLLER_THRESHOLD) toUnlock.push("high_roller");
  if (!already.has("phoenix") && (user.cityResetsPaid || 0) >= 1) toUnlock.push("phoenix");
  if (!already.has("polyglot") && String(user.preferredLanguage || "").length > 0) toUnlock.push("polyglot");

  if (!already.has("first_handshake")) {
    const joined = await prisma.challengeParticipant.count({
      where: { userId, acceptedAt: { not: null } }
    });
    if (joined >= 1) toUnlock.push("first_handshake");
  }

  if (!already.has("champion")) {
    const wonCount = await prisma.challengeParticipant.count({
      where: {
        userId,
        acceptedAt: { not: null },
        leftAt: null,
        challenge: {
          completionAwarded: true,
          durationDays: { gte: CHAMPION_MIN_DURATION_DAYS }
        }
      }
    });
    if (wonCount >= 1) toUnlock.push("champion");
  }

  if (!already.has("mentor")) {
    // Count invited friends who completed at least one quest.
    const accepted = await prisma.invite.findMany({
      where: { inviterId: userId, status: "ACCEPTED", invitedUserId: { not: null } },
      select: { invitedUserId: true }
    });
    if (accepted.length >= MENTOR_INVITE_COUNT) {
      const invitedIds = accepted.map((r) => r.invitedUserId);
      const active = await prisma.questCompletion.groupBy({
        by: ["userId"],
        where: { userId: { in: invitedIds } },
        _count: { userId: true }
      });
      const activeInvitedCount = active.length;
      if (activeInvitedCount >= MENTOR_INVITE_COUNT) toUnlock.push("mentor");
    }
  }

  if (toUnlock.length === 0) return [];

  const now = new Date();
  await prisma.userAchievement.createMany({
    data: toUnlock.map((code) => ({ userId, code, unlockedAt: now })),
    skipDuplicates: true
  });

  return toUnlock;
}

export async function fetchUserAchievements(prisma, userId) {
  const rows = await prisma.userAchievement.findMany({
    where: { userId },
    select: { code: true, unlockedAt: true }
  });
  const unlockedMap = new Map(rows.map((r) => [r.code, r.unlockedAt]));
  return ACHIEVEMENT_CODES.map((code) => ({
    code,
    unlocked: unlockedMap.has(code),
    unlockedAt: unlockedMap.get(code) || null
  }));
}

