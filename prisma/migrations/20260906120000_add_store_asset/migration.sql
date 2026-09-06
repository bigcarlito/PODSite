-- CreateTable
CREATE TABLE "StoreAsset" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreAsset_storeId_kind_idx" ON "StoreAsset"("storeId", "kind");

-- AddForeignKey
ALTER TABLE "StoreAsset" ADD CONSTRAINT "StoreAsset_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
