/*
  Warnings:

  - You are about to drop the column `previewUrl` on the `Project` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[fragmentId]` on the table `Message` will be added. If there are existing duplicate values, this will fail.
  - Made the column `userId` on table `Project` required. This step will fail if there are existing NULL values in that column.
  - Made the column `username` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "KeyStore" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "data" DROP NOT NULL,
ALTER COLUMN "password" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "previewUrl",
ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

-- CreateTable
CREATE TABLE "Preview" (
    "id" TEXT NOT NULL,
    "url" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "Preview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stream" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "apkId" TEXT,
    "deploymentId" TEXT,
    "previewId" TEXT,
    "keystoreId" TEXT,
    "messageId" TEXT,

    CONSTRAINT "Stream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamChunk" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "streamId" TEXT NOT NULL,

    CONSTRAINT "StreamChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Preview_projectId_idx" ON "Preview"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Stream_apkId_key" ON "Stream"("apkId");

-- CreateIndex
CREATE UNIQUE INDEX "Stream_deploymentId_key" ON "Stream"("deploymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Stream_previewId_key" ON "Stream"("previewId");

-- CreateIndex
CREATE UNIQUE INDEX "Stream_keystoreId_key" ON "Stream"("keystoreId");

-- CreateIndex
CREATE UNIQUE INDEX "Stream_messageId_key" ON "Stream"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_fragmentId_key" ON "Message"("fragmentId");

-- AddForeignKey
ALTER TABLE "Preview" ADD CONSTRAINT "Preview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_apkId_fkey" FOREIGN KEY ("apkId") REFERENCES "APK"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_previewId_fkey" FOREIGN KEY ("previewId") REFERENCES "Preview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_keystoreId_fkey" FOREIGN KEY ("keystoreId") REFERENCES "KeyStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamChunk" ADD CONSTRAINT "StreamChunk_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
