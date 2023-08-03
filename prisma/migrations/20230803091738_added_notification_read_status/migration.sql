-- CreateEnum
CREATE TYPE "ReadStatus" AS ENUM ('read', 'unread');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "status" "ReadStatus" NOT NULL DEFAULT 'unread';
