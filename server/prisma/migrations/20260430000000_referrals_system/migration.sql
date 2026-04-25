-- Referral system: codes a user creates, and redemptions of those codes.
-- A user owns 0..3 ReferralCode rows (limit enforced in app code).
-- A user is the referee of at most one Referral row (DB-enforced via
-- the unique on refereeUserId).

CREATE TABLE "ReferralCode" (
    "id"          TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "code"        TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");
CREATE INDEX "ReferralCode_ownerUserId_idx" ON "ReferralCode"("ownerUserId");

ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Referral" (
    "id"                 TEXT NOT NULL,
    "codeId"             TEXT NOT NULL,
    "refereeUserId"      TEXT NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refereeLeveledUpAt" TIMESTAMP(3),
    "referrerClaimedAt"  TIMESTAMP(3),
    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Referral_refereeUserId_key" ON "Referral"("refereeUserId");
CREATE INDEX "Referral_codeId_idx" ON "Referral"("codeId");

ALTER TABLE "Referral" ADD CONSTRAINT "Referral_codeId_fkey"
    FOREIGN KEY ("codeId") REFERENCES "ReferralCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Referral" ADD CONSTRAINT "Referral_refereeUserId_fkey"
    FOREIGN KEY ("refereeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
