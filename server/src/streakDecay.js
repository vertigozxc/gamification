import { getDateKey } from "./utils.js";

// Minimum number of QuestCompletion rows required on the evaluation day
// to keep the streak alive. Habits + custom quests + regular quests all
// land in `questCompletion` so they count; group challenges live in a
// separate table and intentionally do NOT.
export const STREAK_MIN_COMPLETIONS_PER_DAY = 3;

// UTC day key for the day before `now` (00:00 UTC of yesterday).
export function previousUtcDayKey(now) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - 1);
  return getDateKey(d);
}

// True iff the decay step has already been evaluated for the UTC day
// containing `now`. Callers use this to skip a redundant findMany +
// evaluate when the same user pings /api/reset-daily multiple times in
// the same day (which is normal — every app-mount fires it).
export function streakDecayAlreadyDoneForUtcDay(user, now) {
  if (!user?.lastStreakDecayCheckAt) return false;
  return getDateKey(new Date(user.lastStreakDecayCheckAt)) === getDateKey(now);
}

// Pure decision function: given a user snapshot and the completion count
// for the evaluation day, returns the prisma update payload plus a `kind`
// describing the outcome. No I/O — the caller is responsible for the
// findMany() that produces `decayCompletionsCount` and for the
// `prisma.user.update` that applies `streakDecayData`.
//
// `streakDecayData` always carries `lastStreakDecayCheckAt: now` so the
// caller marks the day done atomically with whatever streak change (if
// any) was applied. That way reroll / admin actions cannot retroactively
// "swallow" the decay step the way they used to when the bookkeeping
// rode on `lastDailyResetAt`.
//
// kind:
//   "no_change"        — streak is safe (>=3 completions, or already 0)
//   "freeze_active"    — would burn but `streakFreezeExpiresAt` covers the day
//   "freeze_consumed"  — would burn, no active freeze, but a charge auto-consumed
//   "burned"           — streak reset to 0; burn-notice fields are populated
export function evaluateStreakDecay({ user, now, evaluationDayKey, decayCompletionsCount }) {
  const previousStreak = Number(user.streak) || 0;
  const completions = Number(decayCompletionsCount) || 0;
  const charges = Number(user.streakFreezeCharges) || 0;
  const freezeActive = user.streakFreezeExpiresAt
    ? getDateKey(new Date(user.streakFreezeExpiresAt)) >= evaluationDayKey
    : false;
  const streakWouldBurn = completions < STREAK_MIN_COMPLETIONS_PER_DAY && previousStreak > 0;
  const baseLedger = { lastStreakDecayCheckAt: now };

  if (!streakWouldBurn) {
    return { streakDecayData: { ...baseLedger }, kind: "no_change", previousStreak, evaluationDayKey };
  }
  if (freezeActive) {
    return { streakDecayData: { ...baseLedger }, kind: "freeze_active", previousStreak, evaluationDayKey };
  }
  if (charges > 0) {
    const nextExpiry = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return {
      streakDecayData: {
        ...baseLedger,
        streakFreezeCharges: { decrement: 1 },
        streakFreezeExpiresAt: nextExpiry
      },
      kind: "freeze_consumed",
      previousStreak,
      evaluationDayKey,
      freezeExpiresAt: nextExpiry
    };
  }
  return {
    streakDecayData: {
      ...baseLedger,
      streak: 0,
      streakBurnedAt: now,
      streakBurnedFromValue: previousStreak
    },
    kind: "burned",
    previousStreak,
    evaluationDayKey
  };
}
