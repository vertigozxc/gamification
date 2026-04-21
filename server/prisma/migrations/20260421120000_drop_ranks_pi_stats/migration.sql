-- Drop deprecated tier/rank, productivity index, and character-stat columns.
-- Ranks (IRON/BRONZE/... tiers), the Productivity Index and the str/int/sta
-- attribute system were removed from the app; this migration cleans up the
-- schema so nothing in the code references them anymore.

ALTER TABLE "User"
  DROP COLUMN IF EXISTS "strPoints",
  DROP COLUMN IF EXISTS "intPoints",
  DROP COLUMN IF EXISTS "staPoints",
  DROP COLUMN IF EXISTS "currentPI",
  DROP COLUMN IF EXISTS "currentTier",
  DROP COLUMN IF EXISTS "weeksInCurrentTier",
  DROP COLUMN IF EXISTS "rankLevel",
  DROP COLUMN IF EXISTS "lastTierWeekKey";

ALTER TABLE "CustomQuest"
  DROP COLUMN IF EXISTS "stat";

ALTER TABLE "DailyScore"
  DROP COLUMN IF EXISTS "baseTasksCompleted",
  DROP COLUMN IF EXISTS "score";
