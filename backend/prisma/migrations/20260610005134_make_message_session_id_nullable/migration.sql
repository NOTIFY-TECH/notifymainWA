-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_sessionId_fkey";

-- AlterTable
ALTER TABLE "conversations" ALTER COLUMN "sessionId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
