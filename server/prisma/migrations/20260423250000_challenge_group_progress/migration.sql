-- Group-level challenge progress. `groupDaysCompleted` counts days where
-- EVERY active+accepted participant logged their completion; if a day
-- goes by without that, the next completion resets it to 0. When the
-- counter reaches durationDays the final-XP payout fires once and
-- `completionAwarded` flips to true so it can't double-pay.
ALTER TABLE "GroupChallenge"
  ADD COLUMN IF NOT EXISTS "groupDaysCompleted" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "completionAwarded" BOOLEAN NOT NULL DEFAULT false;
