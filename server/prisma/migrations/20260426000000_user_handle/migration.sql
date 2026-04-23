-- Public @handle, separate from the Firebase-UID "username" primary key.
-- Nullable so existing rows don't need a value at migration time; the
-- server lazily generates one for pre-feature users on their next
-- /game-state fetch.
ALTER TABLE "User" ADD COLUMN "handle" TEXT;
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");
