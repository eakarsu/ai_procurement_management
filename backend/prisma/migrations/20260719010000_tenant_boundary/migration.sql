CREATE TABLE "tenants" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "users" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "vendors" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "bids" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "tenantId" TEXT;

INSERT INTO "tenants" ("id", "name") SELECT 'tenant_' || "id", COALESCE(NULLIF("organization", ''), 'Imported organization') FROM "users";
UPDATE "users" SET "tenantId" = 'tenant_' || "id";
UPDATE "vendors" v SET "tenantId" = u."tenantId" FROM "users" u WHERE u."id" = v."createdById";
UPDATE "bids" b SET "tenantId" = v."tenantId" FROM "vendors" v WHERE v."id" = b."vendorId";
UPDATE "audit_logs" a SET "tenantId" = u."tenantId" FROM "users" u WHERE u."id" = a."userId";
INSERT INTO "tenants" ("id", "name") SELECT 'tenant_orphan', 'Imported orphan records'
WHERE EXISTS (SELECT 1 FROM "vendors" WHERE "tenantId" IS NULL UNION ALL SELECT 1 FROM "bids" WHERE "tenantId" IS NULL UNION ALL SELECT 1 FROM "audit_logs" WHERE "tenantId" IS NULL);
UPDATE "vendors" SET "tenantId" = 'tenant_orphan' WHERE "tenantId" IS NULL;
UPDATE "bids" SET "tenantId" = 'tenant_orphan' WHERE "tenantId" IS NULL;
UPDATE "audit_logs" SET "tenantId" = 'tenant_orphan' WHERE "tenantId" IS NULL;

ALTER TABLE "users" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "vendors" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "bids" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "audit_logs" ALTER COLUMN "tenantId" SET NOT NULL;
DROP INDEX IF EXISTS "vendors_registrationNumber_key";
CREATE UNIQUE INDEX "users_id_tenantId_key" ON "users"("id", "tenantId");
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");
CREATE UNIQUE INDEX "vendors_id_tenantId_key" ON "vendors"("id", "tenantId");
CREATE UNIQUE INDEX "vendors_tenantId_registrationNumber_key" ON "vendors"("tenantId", "registrationNumber");
CREATE INDEX "vendors_tenantId_createdAt_idx" ON "vendors"("tenantId", "createdAt");
CREATE UNIQUE INDEX "bids_id_tenantId_key" ON "bids"("id", "tenantId");
CREATE INDEX "bids_tenantId_submittedAt_idx" ON "bids"("tenantId", "submittedAt");
CREATE INDEX "audit_logs_tenantId_timestamp_idx" ON "audit_logs"("tenantId", "timestamp");

ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "vendors" DROP CONSTRAINT IF EXISTS "vendors_createdById_fkey";
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_createdById_tenantId_fkey" FOREIGN KEY ("createdById", "tenantId") REFERENCES "users"("id", "tenantId") ON DELETE RESTRICT;
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "bids" DROP CONSTRAINT IF EXISTS "bids_vendorId_fkey";
ALTER TABLE "bids" ADD CONSTRAINT "bids_vendorId_tenantId_fkey" FOREIGN KEY ("vendorId", "tenantId") REFERENCES "vendors"("id", "tenantId") ON DELETE RESTRICT;
ALTER TABLE "bids" ADD CONSTRAINT "bids_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_userId_fkey";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_tenantId_fkey" FOREIGN KEY ("userId", "tenantId") REFERENCES "users"("id", "tenantId") ON DELETE RESTRICT;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT;
