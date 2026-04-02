-- CreateEnum
CREATE TYPE "CallScope" AS ENUM ('DM', 'HUB_LOBBY');

-- CreateEnum
CREATE TYPE "CallMode" AS ENUM ('AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ACCEPTED', 'DECLINED', 'ENDED', 'MISSED');

-- CreateEnum
CREATE TYPE "CallParticipantState" AS ENUM ('INVITED', 'ACCEPTED', 'JOINED', 'DECLINED', 'LEFT', 'MISSED');

-- CreateTable
CREATE TABLE "CallSession" (
  "id" TEXT NOT NULL,
  "scope" "CallScope" NOT NULL,
  "mode" "CallMode" NOT NULL,
  "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
  "dmConversationId" TEXT,
  "hubId" TEXT,
  "lobbyId" TEXT,
  "livekitRoomName" TEXT NOT NULL,
  "initiatedByUserId" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "endedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallParticipant" (
  "id" TEXT NOT NULL,
  "callSessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "state" "CallParticipantState" NOT NULL DEFAULT 'INVITED',
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "joinedAt" TIMESTAMP(3),
  "leftAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CallParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CallSession_livekitRoomName_key" ON "CallSession"("livekitRoomName");

-- CreateIndex
CREATE INDEX "CallSession_dmConversationId_createdAt_idx" ON "CallSession"("dmConversationId", "createdAt");

-- CreateIndex
CREATE INDEX "CallSession_lobbyId_createdAt_idx" ON "CallSession"("lobbyId", "createdAt");

-- CreateIndex
CREATE INDEX "CallSession_status_createdAt_idx" ON "CallSession"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CallParticipant_callSessionId_userId_key" ON "CallParticipant"("callSessionId", "userId");

-- CreateIndex
CREATE INDEX "CallParticipant_userId_state_idx" ON "CallParticipant"("userId", "state");

-- CreateIndex
CREATE INDEX "CallParticipant_callSessionId_state_idx" ON "CallParticipant"("callSessionId", "state");

-- AddForeignKey
ALTER TABLE "CallSession"
ADD CONSTRAINT "CallSession_dmConversationId_fkey"
FOREIGN KEY ("dmConversationId") REFERENCES "DirectConversation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession"
ADD CONSTRAINT "CallSession_hubId_fkey"
FOREIGN KEY ("hubId") REFERENCES "Hub"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession"
ADD CONSTRAINT "CallSession_lobbyId_fkey"
FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession"
ADD CONSTRAINT "CallSession_initiatedByUserId_fkey"
FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession"
ADD CONSTRAINT "CallSession_endedByUserId_fkey"
FOREIGN KEY ("endedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallParticipant"
ADD CONSTRAINT "CallParticipant_callSessionId_fkey"
FOREIGN KEY ("callSessionId") REFERENCES "CallSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallParticipant"
ADD CONSTRAINT "CallParticipant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
