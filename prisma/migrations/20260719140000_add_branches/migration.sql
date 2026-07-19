-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Main',
    "parentBranchId" TEXT,
    "forkFromMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "activeBranchId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "branchId" TEXT;

-- Backfill: create a Main branch per conversation and attach existing messages
INSERT INTO "Branch" ("id", "conversationId", "name", "parentBranchId", "forkFromMessageId", "createdAt", "updatedAt")
SELECT
  'br_main_' || c."id",
  c."id",
  'Main',
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Conversation" c
WHERE NOT EXISTS (
  SELECT 1 FROM "Branch" b WHERE b."conversationId" = c."id"
);

UPDATE "Conversation" c
SET "activeBranchId" = 'br_main_' || c."id"
WHERE "activeBranchId" IS NULL;

UPDATE "Message" m
SET "branchId" = 'br_main_' || m."conversationId"
WHERE "branchId" IS NULL;

-- Make branchId required now that backfill is done
ALTER TABLE "Message" ALTER COLUMN "branchId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Branch_conversationId_createdAt_idx" ON "Branch"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_branchId_createdAt_idx" ON "Message"("branchId", "createdAt");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_parentBranchId_fkey" FOREIGN KEY ("parentBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
