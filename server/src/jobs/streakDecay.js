// Render Cron entrypoint — runs at 00:05 UTC every day. Goes through
// every user with streak > 0 and applies the same burn-rule as the
// client-driven /api/reset-daily path, so streaks decay correctly even
// for users who never opened the app on the day that just ended.
//
// Independence from /api/reset-daily — important contract:
//   - We DO NOT update lastDailyResetAt here. That field belongs to
//     the daily-quest rotation flow, not to streak bookkeeping.
//   - We DO write streakBurnedAt + streakBurnedFromValue when a streak
//     burns, so the next dashboard load surfaces the one-time dialog.
//   - We DO consume streakFreezeCharges and extend streakFreezeExpiresAt
//     on auto-consume — same rules as the endpoint.
//
// Idempotency: it is safe to run this twice on the same UTC day. After
// the first run, affected users already have `streak = 0` (so
// `streakWouldBurn = previousStreak > 0` is false on the second pass)
// or have already consumed the charge (and the freeze now covers the
// evaluation day).

import { prisma } from "../db.js";
import {
  evaluateStreakDecay,
  previousUtcDayKey,
  streakDecayAlreadyDoneForUtcDay
} from "../streakDecay.js";

async function recordStreakEvent(partial) {
  try {
    await prisma.event.create({
      data: {
        type: partial.type,
        level: "info",
        userId: partial.userId,
        username: partial.username,
        message: partial.message,
        meta: JSON.stringify(partial.meta || {})
      }
    });
  } catch (err) {
    console.error(`[streak-decay-cron] event insert failed: ${err?.message || err}`);
  }
}

async function processOneUser(user, now, evaluationDayKey) {
  // Endpoint may have already evaluated decay for this UTC day if the
  // user opened the app between midnight and 00:05. Skip silently.
  if (streakDecayAlreadyDoneForUtcDay(user, now)) {
    return "already_done";
  }
  const completions = await prisma.questCompletion.count({
    where: { userId: user.id, dayKey: evaluationDayKey }
  });
  const result = evaluateStreakDecay({
    user,
    now,
    evaluationDayKey,
    decayCompletionsCount: completions
  });

  await prisma.user.update({
    where: { id: user.id },
    data: result.streakDecayData
  });

  if (result.kind === "no_change" || result.kind === "freeze_active") {
    return result.kind;
  }

  if (result.kind === "burned") {
    await recordStreakEvent({
      type: "streak_burned",
      userId: user.id,
      username: user.username,
      message: `streak burned out (was ${result.previousStreak})`,
      meta: {
        evaluationDayKey,
        previousStreak: result.previousStreak,
        completions,
        source: "cron"
      }
    });
  } else if (result.kind === "freeze_consumed") {
    await recordStreakEvent({
      type: "streak_freeze_auto_consumed",
      userId: user.id,
      username: user.username,
      message: `freeze charge auto-consumed (streak ${result.previousStreak} preserved)`,
      meta: {
        evaluationDayKey,
        previousStreak: result.previousStreak,
        completions,
        freezeExpiresAt: result.freezeExpiresAt?.toISOString(),
        source: "cron"
      }
    });
  }

  return result.kind;
}

async function run() {
  const now = new Date();
  const evaluationDayKey = previousUtcDayKey(now);
  console.log(`[streak-decay-cron] start dayKey=${evaluationDayKey} now=${now.toISOString()}`);

  const candidates = await prisma.user.findMany({
    where: { streak: { gt: 0 } },
    select: {
      id: true,
      username: true,
      streak: true,
      streakFreezeCharges: true,
      streakFreezeExpiresAt: true,
      lastStreakDecayCheckAt: true
    }
  });

  const tally = { total: candidates.length, burned: 0, freeze_consumed: 0, freeze_active: 0, no_change: 0, already_done: 0, errored: 0 };

  for (const user of candidates) {
    try {
      const kind = await processOneUser(user, now, evaluationDayKey);
      tally[kind] = (tally[kind] || 0) + 1;
    } catch (err) {
      tally.errored += 1;
      console.error(`[streak-decay-cron] user ${user.username} failed: ${err?.message || err}`);
    }
  }

  console.log(`[streak-decay-cron] done ${JSON.stringify(tally)}`);
}

run()
  .then(() => prisma.$disconnect().then(() => process.exit(0)))
  .catch((err) => {
    console.error(`[streak-decay-cron] fatal: ${err?.message || err}`);
    prisma.$disconnect().finally(() => process.exit(1));
  });
