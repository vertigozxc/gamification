-- Track users who chose "I'll do it later" during onboarding so we can
-- skip the required-habits gate without forcing them to pick habits.
ALTER TABLE "User" ADD COLUMN "onboardingSkippedAt" TIMESTAMP(3);
