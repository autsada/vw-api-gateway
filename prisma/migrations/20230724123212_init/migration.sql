-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('TRADITIONAL', 'WALLET');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('Music', 'Movies', 'Entertainment', 'Sports', 'Food', 'Travel', 'Gaming', 'News', 'Animals', 'Education', 'Science', 'Technology', 'Programming', 'AI', 'Blockchain', 'LifeStyle', 'Vehicles', 'Children', 'Women', 'Men', 'Other');

-- CreateEnum
CREATE TYPE "PublishType" AS ENUM ('Video', 'Ads', 'Blog', 'Podcast', 'Short');

-- CreateEnum
CREATE TYPE "ThumbnailType" AS ENUM ('generated', 'custom');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('draft', 'private', 'public');

-- CreateEnum
CREATE TYPE "CommentType" AS ENUM ('PUBLISH', 'COMMENT');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('adult', 'violent', 'harass', 'hateful', 'harmful', 'abuse', 'terrorism', 'spam', 'mislead');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "owner" TEXT NOT NULL,
    "authUid" TEXT,
    "type" "AccountType" NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "tokenId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "owner" TEXT NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "displayName" VARCHAR(64) NOT NULL,
    "image" TEXT,
    "imageRef" TEXT,
    "bannerImage" TEXT,
    "bannerImageRef" TEXT,
    "defaultColor" TEXT,
    "accountId" TEXT NOT NULL,
    "watchPreferences" "Category"[] DEFAULT ARRAY[]::"Category"[],
    "readPreferences" "Category"[] DEFAULT ARRAY[]::"Category"[],

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerId","followingId")
);

-- CreateTable
CREATE TABLE "Playback" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "videoId" TEXT NOT NULL,
    "thumbnail" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "hls" TEXT NOT NULL,
    "dash" TEXT NOT NULL,
    "publishId" TEXT NOT NULL,

    CONSTRAINT "Playback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blog" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "content" JSONB NOT NULL,
    "htmlContent" TEXT,
    "readingTime" TEXT,
    "excerpt" TEXT,
    "publishId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Publish" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "creatorId" TEXT NOT NULL,
    "contentURI" TEXT,
    "contentRef" TEXT,
    "filename" TEXT,
    "thumbnail" TEXT,
    "thumbnailRef" TEXT,
    "thumbnailType" "ThumbnailType" NOT NULL DEFAULT 'generated',
    "title" VARCHAR(128),
    "description" VARCHAR(5000),
    "views" INTEGER NOT NULL DEFAULT 0,
    "primaryCategory" "Category",
    "secondaryCategory" "Category",
    "publishType" "PublishType",
    "visibility" "Visibility" NOT NULL DEFAULT 'draft',
    "tags" TEXT,
    "uploadError" BOOLEAN NOT NULL DEFAULT false,
    "transcodeError" BOOLEAN NOT NULL DEFAULT false,
    "uploading" BOOLEAN NOT NULL DEFAULT false,
    "deleting" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Publish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Like" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileId" TEXT NOT NULL,
    "publishId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "DisLike" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileId" TEXT NOT NULL,
    "publishId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Tip" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "senderId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "publishId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "fee" TEXT NOT NULL,

    CONSTRAINT "Tip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "creatorId" TEXT NOT NULL,
    "publishId" TEXT NOT NULL,
    "commentId" TEXT,
    "content" VARCHAR(10000),
    "contentBlog" JSONB,
    "htmlContentBlog" TEXT,
    "commentType" "CommentType" NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentLike" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CommentDisLike" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "WatchLater" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileId" TEXT NOT NULL,
    "publishId" TEXT NOT NULL,

    CONSTRAINT "WatchLater_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Playlist" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000),
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaylistItem" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "publishId" TEXT NOT NULL,

    CONSTRAINT "PlaylistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DontRecommend" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "DontRecommend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedById" TEXT NOT NULL,
    "publishId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileId" TEXT NOT NULL,
    "publishId" TEXT NOT NULL,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_owner_key" ON "Account"("owner");

-- CreateIndex
CREATE UNIQUE INDEX "Account_authUid_key" ON "Account"("authUid");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_tokenId_key" ON "Profile"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_name_key" ON "Profile"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_displayName_key" ON "Profile"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "Playback_publishId_key" ON "Playback"("publishId");

-- CreateIndex
CREATE UNIQUE INDEX "Blog_publishId_key" ON "Blog"("publishId");

-- CreateIndex
CREATE UNIQUE INDEX "Like_profileId_publishId_key" ON "Like"("profileId", "publishId");

-- CreateIndex
CREATE UNIQUE INDEX "DisLike_publishId_profileId_key" ON "DisLike"("publishId", "profileId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentLike_commentId_profileId_key" ON "CommentLike"("commentId", "profileId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentDisLike_commentId_profileId_key" ON "CommentDisLike"("commentId", "profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Playlist_name_ownerId_key" ON "Playlist"("name", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistItem_playlistId_publishId_key" ON "PlaylistItem"("playlistId", "publishId");

-- CreateIndex
CREATE UNIQUE INDEX "DontRecommend_requestorId_targetId_key" ON "DontRecommend"("requestorId", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_submittedById_publishId_reason_key" ON "Report"("submittedById", "publishId", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_profileId_publishId_key" ON "Bookmark"("profileId", "publishId");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Playback" ADD CONSTRAINT "Playback_publishId_fkey" FOREIGN KEY ("publishId") REFERENCES "Publish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blog" ADD CONSTRAINT "Blog_publishId_fkey" FOREIGN KEY ("publishId") REFERENCES "Publish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publish" ADD CONSTRAINT "Publish_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_publishId_fkey" FOREIGN KEY ("publishId") REFERENCES "Publish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisLike" ADD CONSTRAINT "DisLike_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisLike" ADD CONSTRAINT "DisLike_publishId_fkey" FOREIGN KEY ("publishId") REFERENCES "Publish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_publishId_fkey" FOREIGN KEY ("publishId") REFERENCES "Publish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_publishId_fkey" FOREIGN KEY ("publishId") REFERENCES "Publish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentDisLike" ADD CONSTRAINT "CommentDisLike_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentDisLike" ADD CONSTRAINT "CommentDisLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchLater" ADD CONSTRAINT "WatchLater_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchLater" ADD CONSTRAINT "WatchLater_publishId_fkey" FOREIGN KEY ("publishId") REFERENCES "Publish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Playlist" ADD CONSTRAINT "Playlist_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_publishId_fkey" FOREIGN KEY ("publishId") REFERENCES "Publish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DontRecommend" ADD CONSTRAINT "DontRecommend_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_publishId_fkey" FOREIGN KEY ("publishId") REFERENCES "Publish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_publishId_fkey" FOREIGN KEY ("publishId") REFERENCES "Publish"("id") ON DELETE CASCADE ON UPDATE CASCADE;
