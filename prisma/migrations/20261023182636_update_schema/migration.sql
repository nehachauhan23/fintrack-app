/*
  Warnings:

  - You are about to drop the column `lastAlertSent` on the `budgets` table. All the data in the column will be lost.
  - You are about to drop the column `kind` on the `goal_contributions` table. All the data in the column will be lost.
  - The `archivedAt` column on the `goals` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `isRecurring` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `lastProcessed` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `nextRecurringDate` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `receiptUrl` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `recurringInterval` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,importHash]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "InsightKind" AS ENUM ('MONTHLY_SUMMARY', 'BUDGET_SUGGESTIONS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionSource" ADD VALUE 'RECEIPT_SCAN';
ALTER TYPE "TransactionSource" ADD VALUE 'AI_ENTRY';
ALTER TYPE "TransactionSource" ADD VALUE 'CSV_IMPORT';

-- DropIndex
DROP INDEX "budgets_userId_idx";

-- DropIndex
DROP INDEX "goal_contributions_goalId_date_idx";

-- DropIndex
DROP INDEX "goal_contributions_userId_idx";

-- DropIndex
DROP INDEX "merchant_rules_userId_idx";

-- DropIndex
DROP INDEX "recurring_rules_accountId_idx";

-- DropIndex
DROP INDEX "transactions_accountId_idx";

-- DropIndex
DROP INDEX "transactions_recurringRuleId_idx";

-- DropIndex
DROP INDEX "transactions_userId_date_idx";

-- DropIndex
DROP INDEX "transactions_userId_idx";

-- AlterTable
ALTER TABLE "accounts" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "openingBalance" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "budgets" DROP COLUMN "lastAlertSent",
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "category" SET DEFAULT 'all';

-- AlterTable
ALTER TABLE "goal_contributions" DROP COLUMN "kind",
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "goals" ALTER COLUMN "targetAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "savedAmount" SET DATA TYPE DECIMAL(14,2),
DROP COLUMN "archivedAt",
ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "recurring_rules" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "isRecurring",
DROP COLUMN "lastProcessed",
DROP COLUMN "nextRecurringDate",
DROP COLUMN "receiptUrl",
DROP COLUMN "recurringInterval",
DROP COLUMN "status",
ADD COLUMN     "importHash" TEXT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "users" DROP COLUMN "imageUrl",
ADD COLUMN     "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailAlerts" BOOLEAN NOT NULL DEFAULT true;

-- DropEnum
DROP TYPE "TransactionStatus";

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ip" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "day" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_insights" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "InsightKind" NOT NULL,
    "periodKey" TEXT NOT NULL,
    "dataHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "ip" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "ai_usage_day_idx" ON "ai_usage"("day");

-- CreateIndex
CREATE INDEX "ai_usage_userId_day_idx" ON "ai_usage"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "ai_insights_userId_kind_periodKey_key" ON "ai_insights"("userId", "kind", "periodKey");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "goal_contributions_goalId_idx" ON "goal_contributions"("goalId");

-- CreateIndex
CREATE INDEX "transactions_userId_date_idx" ON "transactions"("userId", "date" DESC);

-- CreateIndex
CREATE INDEX "transactions_accountId_date_idx" ON "transactions"("accountId", "date");

-- CreateIndex
CREATE INDEX "transactions_userId_category_date_idx" ON "transactions"("userId", "category", "date");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_userId_importHash_key" ON "transactions"("userId", "importHash");

-- AddForeignKey
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
