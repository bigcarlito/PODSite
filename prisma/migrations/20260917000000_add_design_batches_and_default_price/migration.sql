-- AlterTable
ALTER TABLE "Design" ADD COLUMN     "batchLabel" TEXT;

-- AlterTable
ALTER TABLE "MockupScene" ADD COLUMN     "defaultPriceCents" INTEGER,
ADD COLUMN     "defaultCurrency" TEXT NOT NULL DEFAULT 'USD';

-- CreateIndex
CREATE INDEX "Design_storeId_batchLabel_idx" ON "Design"("storeId", "batchLabel");
