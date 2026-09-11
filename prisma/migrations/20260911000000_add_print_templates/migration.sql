-- CreateTable
CREATE TABLE "PrintTemplate" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "provider" "FulfillmentProviderName" NOT NULL,
    "productType" TEXT NOT NULL,
    "widthPx" INTEGER NOT NULL,
    "heightPx" INTEGER NOT NULL,
    "minDpi" INTEGER NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'png',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrintTemplate_storeId_provider_productType_key" ON "PrintTemplate"("storeId", "provider", "productType");

-- AddForeignKey
ALTER TABLE "PrintTemplate" ADD CONSTRAINT "PrintTemplate_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
