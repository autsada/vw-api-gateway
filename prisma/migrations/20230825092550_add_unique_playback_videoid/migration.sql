/*
  Warnings:

  - A unique constraint covering the columns `[videoId]` on the table `Playback` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Playback_videoId_key" ON "Playback"("videoId");
