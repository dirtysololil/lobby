-- CreateEnum
CREATE TYPE "AvatarPreset" AS ENUM (
  'NONE',
  'GOLD_GLOW',
  'NEON_BLUE',
  'PREMIUM_PURPLE',
  'ANIMATED_RING'
);

-- AlterTable
ALTER TABLE "Profile"
ADD COLUMN "avatarAnimationDurationMs" INTEGER,
ADD COLUMN "avatarFrameCount" INTEGER,
ADD COLUMN "avatarHeight" INTEGER,
ADD COLUMN "avatarIsAnimated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "avatarPreset" "AvatarPreset" NOT NULL DEFAULT 'NONE',
ADD COLUMN "avatarWidth" INTEGER,
ADD COLUMN "dmNotificationDefault" "DmNotificationSetting" NOT NULL DEFAULT 'ALL',
ADD COLUMN "hubNotificationDefault" "DmNotificationSetting" NOT NULL DEFAULT 'ALL',
ADD COLUMN "lobbyNotificationDefault" "DmNotificationSetting" NOT NULL DEFAULT 'ALL';

-- AlterTable
ALTER TABLE "HubMember"
ADD COLUMN "notificationSetting" "DmNotificationSetting" NOT NULL DEFAULT 'ALL';

-- CreateTable
CREATE TABLE "LobbyNotificationOverride" (
  "id" TEXT NOT NULL,
  "lobbyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "notificationSetting" "DmNotificationSetting" NOT NULL DEFAULT 'ALL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LobbyNotificationOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformBlock" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "blockedByUserId" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LobbyNotificationOverride_lobbyId_userId_key"
ON "LobbyNotificationOverride"("lobbyId", "userId");

-- CreateIndex
CREATE INDEX "LobbyNotificationOverride_userId_idx"
ON "LobbyNotificationOverride"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformBlock_userId_key" ON "PlatformBlock"("userId");

-- CreateIndex
CREATE INDEX "PlatformBlock_blockedByUserId_createdAt_idx"
ON "PlatformBlock"("blockedByUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "LobbyNotificationOverride"
ADD CONSTRAINT "LobbyNotificationOverride_lobbyId_fkey"
FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyNotificationOverride"
ADD CONSTRAINT "LobbyNotificationOverride_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformBlock"
ADD CONSTRAINT "PlatformBlock_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformBlock"
ADD CONSTRAINT "PlatformBlock_blockedByUserId_fkey"
FOREIGN KEY ("blockedByUserId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
