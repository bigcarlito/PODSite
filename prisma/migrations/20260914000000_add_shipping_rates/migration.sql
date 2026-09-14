-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ShippingRate" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "baseCents" INTEGER NOT NULL,
    "additionalItemCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShippingRate_storeId_productType_key" ON "ShippingRate"("storeId", "productType");

-- AddForeignKey
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
