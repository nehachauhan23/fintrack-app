/*
  Warnings:

  - Added the required column `userId` to the `goal_contributions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "goal_contributions" ADD COLUMN     "note" TEXT,
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "goal_contributions_userId_idx" ON "goal_contributions"("userId");
