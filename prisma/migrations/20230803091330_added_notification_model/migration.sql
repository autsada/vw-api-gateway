-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('FOLLOW', 'LIKE', 'TIP', 'NEW_RELEASE', 'OTHER');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "NotificationType" NOT NULL,
    "profileId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "content" VARCHAR(2000) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
