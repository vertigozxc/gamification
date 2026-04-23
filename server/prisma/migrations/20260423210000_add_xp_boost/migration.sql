-- Add XP boost shop item expiry
ALTER TABLE "User" ADD COLUMN "xpBoostExpiresAt" TIMESTAMP(3);
