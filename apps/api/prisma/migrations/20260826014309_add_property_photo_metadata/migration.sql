/*
  Warnings:

  - Added the required column `mimeType` to the `PropertyPhoto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originalName` to the `PropertyPhoto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sizeBytes` to the `PropertyPhoto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PropertyPhoto" ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "originalName" TEXT NOT NULL,
ADD COLUMN     "sizeBytes" INTEGER NOT NULL;
