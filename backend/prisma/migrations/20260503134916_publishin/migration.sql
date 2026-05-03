-- CreateTable
CREATE TABLE "PublishedProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "screenshotUrl" TEXT,
    "content" TEXT NOT NULL,
    "frontendTarKey" TEXT,
    "backendTarKey" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "PublishedProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublishedProject_projectId_key" ON "PublishedProject"("projectId");

-- AddForeignKey
ALTER TABLE "PublishedProject" ADD CONSTRAINT "PublishedProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
