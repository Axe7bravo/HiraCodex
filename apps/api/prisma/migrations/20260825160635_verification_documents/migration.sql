-- CreateTable
CREATE TABLE "VerificationDocument" (
    "id" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationDocument_verificationId_createdAt_idx" ON "VerificationDocument"("verificationId", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationDocument_objectKey_idx" ON "VerificationDocument"("objectKey");

-- AddForeignKey
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "Verification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve every legacy document reference. File metadata was not stored by the
-- previous schema, so those columns intentionally remain null for migrated rows.
INSERT INTO "VerificationDocument" ("id", "verificationId", "objectKey", "createdAt")
SELECT 'legacy_' || "id", "id", "documentKey", "createdAt"
FROM "Verification";

-- AlterTable
ALTER TABLE "Verification" DROP COLUMN "documentKey";
