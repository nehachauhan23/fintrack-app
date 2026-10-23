/*
  Warnings:

  - You are about to drop the column `aiCategorised` on the `transactions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "aiCategorised",
ADD COLUMN     "aiCategorized" BOOLEAN NOT NULL DEFAULT false;
