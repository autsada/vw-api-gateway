/*
  Warnings:

  - You are about to drop the column `liveInputUID` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `rtmpStreamKey` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `srtStreamId` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `webRTCUrl` on the `Profile` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LiveStatus" AS ENUM ('inprogress', 'ready');

-- AlterTable
ALTER TABLE "Playback" ADD COLUMN     "liveStatus" "LiveStatus";

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "liveInputUID",
DROP COLUMN "rtmpStreamKey",
DROP COLUMN "srtStreamId",
DROP COLUMN "webRTCUrl";

-- AlterTable
ALTER TABLE "Publish" ADD COLUMN     "liveInputUID" TEXT;
