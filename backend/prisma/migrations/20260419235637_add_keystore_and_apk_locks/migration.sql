/*
  Warnings:

  - Changed the type of `password` on the `KeyStore` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "KeyStoreStatus" AS ENUM ('IDLE', 'SCHEDULED', 'RUNNING');

-- CreateEnum
CREATE TYPE "ApkStatus" AS ENUM ('IDLE', 'SCHEDULED', 'RUNNING');

-- AlterTable
ALTER TABLE "KeyStore" DROP COLUMN "password",
ADD COLUMN     "password" BYTEA NOT NULL;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "apkStartedAt" TIMESTAMPTZ(3),
ADD COLUMN     "apkStatus" "ApkStatus" NOT NULL DEFAULT 'IDLE',
ADD COLUMN     "keyStoreStartedAt" TIMESTAMPTZ(3),
ADD COLUMN     "keyStoreStatus" "KeyStoreStatus" NOT NULL DEFAULT 'IDLE';
