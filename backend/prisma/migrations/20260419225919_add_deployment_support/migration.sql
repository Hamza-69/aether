-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('IDLE', 'SCHEDULED', 'RUNNING');

-- DropIndex
DROP INDEX "Deployment_projectId_key";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "deploymentStartedAt" TIMESTAMPTZ(3),
ADD COLUMN     "deploymentStatus" "DeploymentStatus" NOT NULL DEFAULT 'IDLE';

-- CreateIndex
CREATE INDEX "Deployment_projectId_idx" ON "Deployment"("projectId");
