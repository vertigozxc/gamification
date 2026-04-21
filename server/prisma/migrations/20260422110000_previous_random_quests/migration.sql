-- Store the user's previous set of random daily quests so the next
-- rotation (daily reset or reroll) can exclude those IDs and guarantee
-- no overlap with the previous day's/reroll's quests.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "previousRandomQuestIds" TEXT NOT NULL DEFAULT '';
