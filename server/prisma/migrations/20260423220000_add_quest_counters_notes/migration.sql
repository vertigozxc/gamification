-- Counter-mechanic quest tracking (e.g. hydration: glasses of water with a
-- 15-minute cooldown between ticks). Completion is finalized by the server
-- when count >= target via the existing awardQuestCompletion flow.
CREATE TABLE IF NOT EXISTS "QuestCounter" (
  "id"         TEXT PRIMARY KEY,
  "userId"     TEXT NOT NULL,
  "questId"    INTEGER NOT NULL,
  "dayKey"     TEXT NOT NULL,
  "count"      INTEGER NOT NULL DEFAULT 0,
  "target"     INTEGER NOT NULL,
  "lastTickAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuestCounter_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "QuestCounter_userId_questId_dayKey_key"
  ON "QuestCounter"("userId", "questId", "dayKey");
CREATE INDEX IF NOT EXISTS "QuestCounter_userId_dayKey_idx"
  ON "QuestCounter"("userId", "dayKey");

-- Note-mechanic quest submissions (takeaways, gratitude, English vocab
-- pairs). `kind` distinguishes note|words; `payload` holds a JSON string
-- (text for notes, [{word, translation}] for words).
CREATE TABLE IF NOT EXISTS "QuestNote" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "questId"   INTEGER NOT NULL,
  "dayKey"    TEXT NOT NULL,
  "kind"      TEXT NOT NULL DEFAULT 'note',
  "payload"   TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestNote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "QuestNote_userId_createdAt_idx"
  ON "QuestNote"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "QuestNote_userId_kind_idx"
  ON "QuestNote"("userId", "kind");
