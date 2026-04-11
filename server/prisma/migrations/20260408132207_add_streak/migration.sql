-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL DEFAULT '',
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "xpNext" INTEGER NOT NULL DEFAULT 100,
    "strPoints" INTEGER NOT NULL DEFAULT 0,
    "intPoints" INTEGER NOT NULL DEFAULT 0,
    "staPoints" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastDailyResetAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "displayName", "id", "intPoints", "lastDailyResetAt", "level", "photoUrl", "staPoints", "strPoints", "updatedAt", "username", "xp", "xpNext") SELECT "createdAt", "displayName", "id", "intPoints", "lastDailyResetAt", "level", "photoUrl", "staPoints", "strPoints", "updatedAt", "username", "xp", "xpNext" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
