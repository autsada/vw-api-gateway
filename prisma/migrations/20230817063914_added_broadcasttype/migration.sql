-- CreateEnum
CREATE TYPE "BroadcastType" AS ENUM ('software', 'webcam');

-- AlterTable
ALTER TABLE "Publish" ADD COLUMN     "broadcastType" "BroadcastType";
