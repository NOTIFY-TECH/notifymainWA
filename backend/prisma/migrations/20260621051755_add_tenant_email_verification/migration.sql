/*
  Warnings:

  - A unique constraint covering the columns `[emailVerifyToken]` on the table `tenants` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "emailVerifyExpiresAt" TIMESTAMP(3),
ADD COLUMN     "emailVerifyToken" VARCHAR(255),
ADD COLUMN     "pendingEmail" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_emailVerifyToken_key" ON "tenants"("emailVerifyToken");

-- CreateIndex
CREATE INDEX "tenants_emailVerifyToken_idx" ON "tenants"("emailVerifyToken");
