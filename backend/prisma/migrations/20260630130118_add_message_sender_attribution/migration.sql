-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "sentByUserId" UUID;

-- CreateIndex
CREATE INDEX "messages_sentByUserId_idx" ON "messages"("sentByUserId");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
