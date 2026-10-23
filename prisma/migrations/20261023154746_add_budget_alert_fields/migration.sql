-- AlterTable
ALTER TABLE "budgets" ADD COLUMN     "alertedLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "alertedPeriod" TEXT;
