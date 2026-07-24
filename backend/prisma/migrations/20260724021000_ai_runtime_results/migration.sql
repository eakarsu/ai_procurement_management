CREATE TABLE "ai_results" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "input" JSONB NOT NULL,
  "output" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_results_tenantId_createdAt_idx" ON "ai_results"("tenantId", "createdAt");
