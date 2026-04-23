-- Rolling-window cooldown for counter-mechanic quests.
-- Users can tick up to 3 times per 15-minute window. windowStartAt marks
-- the start of the current window; windowTicks is the count within it.
-- Cooldown fires only when windowTicks >= 3 and the window is still open.
ALTER TABLE "QuestCounter"
  ADD COLUMN IF NOT EXISTS "windowStartAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "windowTicks" INTEGER NOT NULL DEFAULT 0;
