-- User-editable city display name, shown in the City tab header.
-- Empty string means "use the translated default (Embervale / Эмбервейл)".
ALTER TABLE "User" ADD COLUMN "cityName" TEXT NOT NULL DEFAULT '';
