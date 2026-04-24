-- Track users who finished the animated onboarding tour so we can stop
-- auto-launching it at login and award the +1 level bonus exactly once.
ALTER TABLE "User" ADD COLUMN "onboardingTourCompletedAt" TIMESTAMP(3);
