-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinnedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "conversations_tenantId_isPinned_pinnedAt_idx" ON "conversations"("tenantId", "isPinned", "pinnedAt");
