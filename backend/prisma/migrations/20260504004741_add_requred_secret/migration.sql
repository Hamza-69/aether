-- CreateTable
CREATE TABLE "ProjectRequiredSecret" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ProjectRequiredSecret_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectRequiredSecret_projectId_idx" ON "ProjectRequiredSecret"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRequiredSecret_projectId_name_key" ON "ProjectRequiredSecret"("projectId", "name");

-- AddForeignKey
ALTER TABLE "ProjectRequiredSecret" ADD CONSTRAINT "ProjectRequiredSecret_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
