-- Backfill "maxStreak" for legacy accounts that never had it bumped
-- (their current streak is greater than the stored max — impossible in
-- new data but present in rows that predate the tracking logic).
UPDATE "User"
  SET "maxStreak" = GREATEST(COALESCE("maxStreak", 0), COALESCE("streak", 0))
  WHERE "streak" > COALESCE("maxStreak", 0);

-- Vacation mode was retired. Active vacation windows are cleared so the
-- streak-decay logic (which no longer checks vacation at all) can't
-- regress a user into a surprise-burn state the next time the logic
-- runs. Charges users received on vacation claim remain in the pool.
UPDATE "User"
  SET "vacationStartedAt" = NULL,
      "vacationEndsAt" = NULL
  WHERE "vacationEndsAt" IS NOT NULL OR "vacationStartedAt" IS NOT NULL;
