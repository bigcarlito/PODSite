-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "productType" TEXT;

-- CreateTable
CREATE TABLE "MockupScene" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockupScene_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MockupScene_storeId_productType_key" ON "MockupScene"("storeId", "productType");

-- AddForeignKey
ALTER TABLE "MockupScene" ADD CONSTRAINT "MockupScene_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
