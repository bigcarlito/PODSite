-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "designId" TEXT;

-- CreateTable
CREATE TABLE "Design" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "aspects" JSONB NOT NULL,
    "aspectsVersion" INTEGER NOT NULL DEFAULT 1,
    "prompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'openrouter',
    "model" TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash-image',
    "seed" INTEGER,
    "params" JSONB NOT NULL DEFAULT '{}',
    "previewImageUrl" TEXT,
    "masterImageUrl" TEXT,
    "masterWidthPx" INTEGER,
    "masterHeightPx" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Design_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Design_storeId_slug_key" ON "Design"("storeId", "slug");

-- CreateIndex
CREATE INDEX "Design_storeId_status_idx" ON "Design"("storeId", "status");

-- AddForeignKey
ALTER TABLE "Design" ADD CONSTRAINT "Design_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE SET NULL ON UPDATE CASCADE;
