-- DropForeignKey
ALTER TABLE "uploads" DROP CONSTRAINT "uploads_uploadedById_fkey";

-- AlterTable
ALTER TABLE "uploads" ALTER COLUMN "uploadedById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
