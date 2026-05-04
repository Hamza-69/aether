-- CreateTable
CREATE TABLE "UserSecret" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "encryptedValue" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UserSecret_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSecret_userId_name_key" ON "UserSecret"("userId", "name");

-- AddForeignKey
ALTER TABLE "UserSecret" ADD CONSTRAINT "UserSecret_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
