-- Custom habits can opt into a timer. When needsTimer=true, the user's
-- custom habit behaves like any other timed quest: Start / Pause / Stop
-- with the same percent → XP tiers. XP payout is derived server-side
-- from timeEstimateMin (≤39 min → 30 XP, 40-49 → 40 XP, 50+ → 50 XP);
-- the field here is purely the user-chosen session length.

ALTER TABLE "CustomQuest"
  ADD COLUMN IF NOT EXISTS "needsTimer" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "timeEstimateMin" INTEGER NOT NULL DEFAULT 0;
