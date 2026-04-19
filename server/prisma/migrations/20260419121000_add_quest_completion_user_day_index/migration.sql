-- Accelerate daily quest completion reads used by /api/game-state and productivity calculations.
CREATE INDEX IF NOT EXISTS "QuestCompletion_userId_dayKey_idx"
ON "QuestCompletion"("userId", "dayKey");
