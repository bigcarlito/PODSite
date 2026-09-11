-- AlterTable
ALTER TABLE "MockupScene" ADD COLUMN     "baseImages" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "designArea" JSONB;
