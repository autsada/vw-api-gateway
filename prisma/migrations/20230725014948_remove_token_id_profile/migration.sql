/*
  Warnings:

  - You are about to drop the column `tokenId` on the `Profile` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Profile_tokenId_key";

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "tokenId";
