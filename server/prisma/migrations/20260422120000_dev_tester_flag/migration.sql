-- Per-user "dev tester" flag. When true, the user sees the DEV
-- floating panel on the dashboard (+1 LVL / +S / +5 🪙 / RESET
-- buttons) and is allowed to call the UID-gated /api/dev/* grant
-- endpoints. Defaults to false — admins flip it via the /admin UI.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isDevTester" BOOLEAN NOT NULL DEFAULT false;
