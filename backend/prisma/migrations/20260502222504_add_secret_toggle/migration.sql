-- AlterTable
ALTER TABLE "Secret" ADD COLUMN     "useUserSecret" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "encryptedValue" DROP NOT NULL;
