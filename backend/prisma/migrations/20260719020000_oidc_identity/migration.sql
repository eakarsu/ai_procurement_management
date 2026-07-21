ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "oidcSubject" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_oidcSubject_key" ON "users"("oidcSubject");
