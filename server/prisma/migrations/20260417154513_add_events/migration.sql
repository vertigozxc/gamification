-- CreateTable
CREATE TABLE "DailyScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "xpToday" INTEGER NOT NULL DEFAULT 0,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "baseTasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "score" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "questionType" TEXT NOT NULL DEFAULT 'How useful was this task?',
    "rating" INTEGER NOT NULL DEFAULT 0,
    "textNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "userId" TEXT NOT NULL DEFAULT '',
    "username" TEXT NOT NULL DEFAULT '',
    "platform" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "stack" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "meta" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL DEFAULT '',
    "preferredQuestIds" TEXT NOT NULL DEFAULT '',
    "randomQuestIds" TEXT NOT NULL DEFAULT '',
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "xpNext" INTEGER NOT NULL DEFAULT 250,
    "strPoints" INTEGER NOT NULL DEFAULT 0,
    "intPoints" INTEGER NOT NULL DEFAULT 0,
    "staPoints" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "currentPI" REAL,
    "currentTier" TEXT NOT NULL DEFAULT 'IRON',
    "weeksInCurrentTier" INTEGER NOT NULL DEFAULT 0,
    "rankLevel" INTEGER NOT NULL DEFAULT 1,
    "theme" TEXT NOT NULL DEFAULT 'adventure',
    "lastTierWeekKey" TEXT NOT NULL DEFAULT '',
    "lastStreakIncreaseAt" DATETIME,
    "streakFreezeExpiresAt" DATETIME,
    "lastFreeTaskRerollAt" DATETIME,
    "lastDailyRerollAt" DATETIME,
    "extraRerollsToday" INTEGER NOT NULL DEFAULT 0,
    "lastDailyResetAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "displayName", "id", "intPoints", "lastDailyResetAt", "lastStreakIncreaseAt", "level", "photoUrl", "preferredQuestIds", "staPoints", "strPoints", "streak", "streakFreezeExpiresAt", "tokens", "updatedAt", "username", "xp", "xpNext") SELECT "createdAt", "displayName", "id", "intPoints", "lastDailyResetAt", "lastStreakIncreaseAt", "level", "photoUrl", "preferredQuestIds", "staPoints", "strPoints", "streak", "streakFreezeExpiresAt", "tokens", "updatedAt", "username", "xp", "xpNext" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DailyScore_userId_dayKey_idx" ON "DailyScore"("userId", "dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "DailyScore_userId_dayKey_key" ON "DailyScore"("userId", "dayKey");

-- CreateIndex
CREATE INDEX "QuestFeedback_userId_questId_idx" ON "QuestFeedback"("userId", "questId");

-- CreateIndex
CREATE INDEX "Event_createdAt_idx" ON "Event"("createdAt");

-- CreateIndex
CREATE INDEX "Event_type_idx" ON "Event"("type");

-- CreateIndex
CREATE INDEX "Event_level_idx" ON "Event"("level");

-- CreateIndex
CREATE INDEX "Event_userId_idx" ON "Event"("userId");
