-- Quest timer sessions + partial completion tracking.
-- See server/src/index.js timer endpoints for the lifecycle:
-- start → pause/resume* → stop. On stop the server computes elapsedMs,
-- percent vs time_estimate_min, and creates a QuestCompletion with the
-- scaled XP award when percent >= 50.

ALTER TABLE "QuestCompletion"
  ADD COLUMN IF NOT EXISTS "completionPercent" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS "elapsedMs" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "QuestTimerSession" (
  "id"            TEXT PRIMARY KEY,
  "userId"        TEXT NOT NULL,
  "questId"       INTEGER NOT NULL,
  "dayKey"        TEXT NOT NULL,
  "startedAt"     TIMESTAMP(3) NOT NULL,
  "totalPausedMs" INTEGER NOT NULL DEFAULT 0,
  "pausedAt"      TIMESTAMP(3),
  "stoppedAt"     TIMESTAMP(3),
  "status"        TEXT NOT NULL DEFAULT 'running',
  "elapsedMs"     INTEGER,
  "percent"       INTEGER,
  "xpAwarded"     INTEGER,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuestTimerSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "QuestTimerSession_userId_questId_dayKey_idx"
  ON "QuestTimerSession"("userId", "questId", "dayKey");
CREATE INDEX IF NOT EXISTS "QuestTimerSession_userId_status_idx"
  ON "QuestTimerSession"("userId", "status");
