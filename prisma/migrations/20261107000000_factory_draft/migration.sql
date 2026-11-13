ALTER TABLE "Product" ADD COLUMN "factoryDraft" JSONB, ADD COLUMN "factorySourceKey" TEXT;
CREATE UNIQUE INDEX "Product_storeId_factorySourceKey_key" ON "Product"("storeId", "factorySourceKey");
