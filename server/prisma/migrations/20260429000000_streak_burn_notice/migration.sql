-- Track when a streak burned out so the client can show a one-time
-- "your streak has ended" dialog on the next dashboard load. Both
-- columns are cleared together when the user dismisses the notice via
-- POST /api/streak/dismiss-burn-notice.
ALTER TABLE "User" ADD COLUMN "streakBurnedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "streakBurnedFromValue" INTEGER NOT NULL DEFAULT 0;

-- Independent ledger for "we already evaluated streak decay for this UTC
-- day". Previously the bookkeeping rode on `lastDailyResetAt`, which is
-- also the rotation idempotency flag — any reroll or admin action that
-- bumped that field silently swallowed the decay check for the day.
-- With its own column the decay step is unaffected by rotation and
-- admin endpoints, and runs at most once per UTC day per user.
ALTER TABLE "User" ADD COLUMN "lastStreakDecayCheckAt" TIMESTAMP(3);

-- One-shot backfill: existing users may have streak > maxStreak because
-- maxStreak wasn't always written by every code path that set streak in
-- the past. Make the field correct for every account before the column
-- is read by /api/users/search, achievements, etc.
UPDATE "User" SET "maxStreak" = "streak" WHERE "streak" > "maxStreak";
