/*
  Warnings:

  - You are about to drop the column `codeTarId` on the `Fragment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Fragment" DROP COLUMN "codeTarId",
ADD COLUMN     "backendTarKey" TEXT,
ADD COLUMN     "frontendTarKey" TEXT;
