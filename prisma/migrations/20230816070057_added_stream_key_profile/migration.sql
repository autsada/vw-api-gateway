-- CreateEnum
CREATE TYPE "StreamType" AS ENUM ('onDemand', 'Live');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "rtmpStreamKey" TEXT,
ADD COLUMN     "srtStreamId" TEXT,
ADD COLUMN     "webRTCUrl" TEXT;

-- AlterTable
ALTER TABLE "Publish" ADD COLUMN     "streamType" "StreamType" NOT NULL DEFAULT 'onDemand';
