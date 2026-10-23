-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "transferGroupId" TEXT;

-- CreateIndex
CREATE INDEX "transactions_transferGroupId_idx" ON "transactions"("transferGroupId");
