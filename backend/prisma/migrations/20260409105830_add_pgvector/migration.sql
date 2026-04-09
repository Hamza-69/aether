-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "public"."ExpoDocs" (
    "id" TEXT NOT NULL,
    "content" TEXT,
    "embedding" vector(1536),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpoDocs_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "public"."NativeWindDocs" (
    "id" TEXT NOT NULL,
    "content" TEXT,
    "embedding" vector(1536),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NativeWindDocs_pkey" PRIMARY KEY ("id")
);