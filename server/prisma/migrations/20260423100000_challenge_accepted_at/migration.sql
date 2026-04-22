-- A challenge is only "activated" when there are at least 2 accepted
-- participants. An invitee stays at acceptedAt=null until they tap
-- Accept (which calls /api/challenges/:id/join). Until then the challenge
-- is visible to them but all action buttons are disabled.
--
-- Backfill: every currently active participant row is treated as already
-- accepted so existing challenges don't regress into a pending-invite
-- state on deploy.

ALTER TABLE "ChallengeParticipant"
  ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);

UPDATE "ChallengeParticipant"
  SET "acceptedAt" = "joinedAt"
  WHERE "acceptedAt" IS NULL;
