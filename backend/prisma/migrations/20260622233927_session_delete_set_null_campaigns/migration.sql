-- DropForeignKey
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_sessionId_fkey";

-- AlterTable
ALTER TABLE "campaigns" ALTER COLUMN "sessionId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
