-- CreateEnum
CREATE TYPE "RuleSource" AS ENUM ('USER', 'AI');

-- CreateTable
CREATE TABLE "merchant_rules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" "RuleSource" NOT NULL DEFAULT 'USER',
    "hits" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "merchant_rules_userId_idx" ON "merchant_rules"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_rules_userId_key_key" ON "merchant_rules"("userId", "key");

-- AddForeignKey
ALTER TABLE "merchant_rules" ADD CONSTRAINT "merchant_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
