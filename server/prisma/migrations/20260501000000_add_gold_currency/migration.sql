-- Add Gold premium currency, roulette coupon consumable stack,
-- and a JSON list of owned cosmetic item ids on the User row.
--
-- Note: silver / silverSpentTotal are NOT renamed at the column
-- level — Prisma now exposes them as `silver` / `silverSpentTotal`
-- via @map, but the underlying columns stay `tokens` /
-- `tokensSpentTotal` to keep the migration zero-risk for prod data.
-- A future migration can do ALTER TABLE ... RENAME COLUMN if we want
-- the database to match the JS field names exactly.

ALTER TABLE "User" ADD COLUMN "gold" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "rouletteCoupons" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "ownedCosmetics" TEXT NOT NULL DEFAULT '[]';
