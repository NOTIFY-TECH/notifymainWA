/*
  Warnings:

  - You are about to drop the `engine_instances` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_engineInstanceId_fkey";

-- DropIndex
DROP INDEX "sessions_engineInstanceId_idx";

-- DropTable
DROP TABLE "engine_instances";
