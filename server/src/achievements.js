// Achievements: 10 unlockable milestones per user. Each code is idempotent —
// evaluateAchievements() reads the current user state plus any gated
// queries (only run for still-locked codes) and upserts any new unlocks.
// Callers fire-and-forget: .catch(() => {}) — a failure must never break
// the action that triggered it.

export const ACHIEVEMENT_CODES = [
  "week_warrior",
  "month_monk",
  "hundred_club",
  "lvl_10",
  "lvl_30",
  "lvl_100",
  "first_handshake",
  "champion",
  "mentor",
  "first_coin",
  "high_roller",
  "polyglot",
  "phoenix",
  // Knowledge Quiz pass — `userAchievement{code:"scholar"}` is created
  // by /api/quiz/scholar/claim when the user scores 10/10. The token
  // reward fires through the unified /api/achievements/claim flow,
  // not at quiz time. evaluateAchievements does not infer it from
  // user state, so it sits here purely for ordering / rendering.
  "scholar",
  // Referral system: unlocked when a user who redeemed someone's
  // referral code reaches level 5. evaluateAchievements() handles the
  // gating and also stamps Referral.refereeLeveledUpAt at the same
  // moment so the referrer's "Claim 50" button lights up in sync.
  "referral_ally",
  // Referrer-side milestone: 3+ referees (across any of my up-to-3
  // codes) who reached level 5. Stacks on top of the per-referee 50
  // tokens — this is the trophy for actually building a small crew.
  "referral_recruiter"
];

// Token rewards per achievement, claimed via POST /api/achievements/claim.
// Scaled by difficulty: trivial (1 click) → 2, easy (a week's effort,
// quiz pass, or one-shot purchase milestone) → 6–20, medium (month /
// serious play / social leverage) → 20–30, hard (long-haul) → 60–100,
// and legendary (lvl_100) → 200. Total bank: 530.
export const ACHIEVEMENT_REWARDS = {
  polyglot: 2,
  first_coin: 2,
  first_handshake: 6,
  week_warrior: 10,
  scholar: 10,
  phoenix: 10,
  lvl_10: 20,
  champion: 20,
  mentor: 30,
  month_monk: 30,
  high_roller: 30,
  lvl_30: 60,
  hundred_club: 100,
  lvl_100: 200,
  // Referral payout — matches the 50 the referrer gets per referee
  // (claimed in the My Referrals section, separate flow).
  referral_ally: 50,
  // Three-referees-at-level-5 milestone. Mid-tier reward — the
  // referrer already collected 3×50 = 150 tokens through the
  // per-row claims in My Referrals; this is the bonus trophy.
  referral_recruiter: 30
};

const HIGH_ROLLER_THRESHOLD = 200;
const CHAMPION_MIN_DURATION_DAYS = 7;
const MENTOR_INVITE_COUNT = 3;

export async function evaluateAchievements(prisma, userId) {
  if (!prisma || !userId) return [];

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      level: true,
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
  const lvl = Number(user.level) || 0;

  if (!already.has("week_warrior") && peakStreak >= 7) toUnlock.push("week_warrior");
  if (!already.has("month_monk") && peakStreak >= 30) toUnlock.push("month_monk");
  if (!already.has("hundred_club") && peakStreak >= 100) toUnlock.push("hundred_club");
  if (!already.has("lvl_10") && lvl >= 10) toUnlock.push("lvl_10");
  if (!already.has("lvl_30") && lvl >= 30) toUnlock.push("lvl_30");
  if (!already.has("lvl_100") && lvl >= 100) toUnlock.push("lvl_100");
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

  // Referral system milestone. If this user redeemed someone's referral
  // code AND has reached level 5+, both sides become eligible for their
  // 50-token reward. The referee gets it via the standard achievement
  // claim flow ("referral_ally"); the referrer claims per-row in the
  // My Referrals section (referrerClaimedAt). Stamp refereeLeveledUpAt
  // so the referrer's "Claim 50" button can light up immediately.
  if (lvl >= 5) {
    const myReferral = await prisma.referral.findUnique({
      where: { refereeUserId: userId },
      select: {
        id: true,
        refereeLeveledUpAt: true,
        code: { select: { ownerUserId: true } }
      }
    });
    if (myReferral) {
      const justCrossed = !myReferral.refereeLeveledUpAt;
      if (justCrossed) {
        await prisma.referral.update({
          where: { id: myReferral.id },
          data: { refereeLeveledUpAt: new Date() }
        });
      }
      if (!already.has("referral_ally")) {
        toUnlock.push("referral_ally");
      }
      // Cascade: when *this* user just hit level 5 by entering
      // someone's code, the *referrer* may now have enough
      // qualifying referees to unlock "referral_recruiter".
      // Re-evaluate on the referrer's side. Fire-and-forget so a
      // failure here can never break the referee's evaluation.
      // Recursion-safe: this branch only enters when justCrossed
      // OR when the achievement was missing — re-running for the
      // referrer doesn't loop back into the referee's row.
      if (justCrossed && myReferral.code?.ownerUserId && myReferral.code.ownerUserId !== userId) {
        evaluateAchievements(prisma, myReferral.code.ownerUserId).catch(() => {});
      }
    }
  }

  // Recruiter milestone: count my referees (across ANY of my codes)
  // who have reached level 5. We rely on refereeLeveledUpAt being
  // stamped by the block above, so this only fires once a referee
  // genuinely crosses the threshold (not just on signup).
  if (!already.has("referral_recruiter")) {
    const reachedFive = await prisma.referral.count({
      where: {
        code: { ownerUserId: userId },
        refereeLeveledUpAt: { not: null }
      }
    });
    if (reachedFive >= 3) toUnlock.push("referral_recruiter");
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
    select: { code: true, unlockedAt: true, claimedAt: true }
  });
  const rowMap = new Map(rows.map((r) => [r.code, r]));
  return ACHIEVEMENT_CODES.map((code) => {
    const r = rowMap.get(code);
    return {
      code,
      unlocked: !!r,
      unlockedAt: r?.unlockedAt || null,
      claimedAt: r?.claimedAt || null,
      tokensReward: ACHIEVEMENT_REWARDS[code] || 0
    };
  });
}

