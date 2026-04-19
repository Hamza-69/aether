-- CreateEnum
CREATE TYPE "PreviewStatus" AS ENUM ('IDLE', 'SCHEDULED', 'RUNNING');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "previewStartedAt" TIMESTAMPTZ(3),
ADD COLUMN     "previewStatus" "PreviewStatus" NOT NULL DEFAULT 'IDLE',
ADD COLUMN     "previewUrl" TEXT;
