import { type INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PresenceStatus, PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';

export function ensureTestEnv() {
  process.env.APP_NAME ??= 'Lobby';
  process.env.NODE_ENV ??= 'test';
  process.env.WEB_PUBLIC_URL ??= 'http://localhost:3000';
  process.env.API_PUBLIC_URL ??= 'http://localhost:3001';
  process.env.MEDIA_PUBLIC_URL ??= 'wss://media.localhost';
  process.env.REALTIME_PUBLIC_URL ??= 'http://localhost:3001';
  process.env.REALTIME_PATH ??= '/socket.io';
  process.env.WEB_PORT ??= '3000';
  process.env.API_PORT ??= '3001';
  process.env.DATABASE_URL ??=
    'postgresql://postgres:postgres@127.0.0.1:5432/lobby_test';
  process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
  process.env.BULLMQ_PREFIX ??= 'lobby-test';
  process.env.SESSION_SECRET ??= 'test_session_secret_with_enough_length';
  process.env.SESSION_COOKIE_NAME ??= 'lobby_session';
  process.env.SESSION_TTL_DAYS ??= '30';
  process.env.ARGON2_MEMORY_COST ??= '65536';
  process.env.ARGON2_TIME_COST ??= '3';
  process.env.ARGON2_PARALLELISM ??= '1';
  process.env.LIVEKIT_URL ??= 'wss://media.localhost';
  process.env.LIVEKIT_API_KEY ??= 'test';
  process.env.LIVEKIT_API_SECRET ??= 'test';
  process.env.LIVEKIT_TOKEN_TTL_MINUTES ??= '120';
  process.env.CALL_RING_TIMEOUT_SECONDS ??= '45';
  process.env.UPLOAD_DRIVER ??= 'local';
  process.env.UPLOAD_LOCAL_ROOT ??= '/tmp/lobby-storage';
  process.env.MAX_AVATAR_MB ??= '10';
  process.env.MAX_AVATAR_DIMENSION ??= '1024';
  process.env.MAX_AVATAR_FRAMES ??= '180';
  process.env.MAX_AVATAR_ANIMATION_MS ??= '10000';
  process.env.MAX_FILE_MB ??= '50';
  process.env.REALTIME_CORS_ORIGIN ??= 'http://localhost:3000';
}

export async function createTestUser(
  prisma: PrismaClient,
  input: {
    username: string;
    email: string;
    password: string;
    displayName: string;
    role?: UserRole;
  },
) {
  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
    memoryCost: Number(process.env.ARGON2_MEMORY_COST),
    timeCost: Number(process.env.ARGON2_TIME_COST),
    parallelism: Number(process.env.ARGON2_PARALLELISM),
  });

  return prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      passwordHash,
      role: input.role ?? UserRole.MEMBER,
      profile: {
        create: {
          displayName: input.displayName,
          presence: PresenceStatus.OFFLINE,
        },
      },
    },
    select: {
      id: true,
      username: true,
      email: true,
    },
  });
}

export async function loginAs(
  app: INestApplication,
  login: string,
  password: string,
) {
  const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  const response = await request(httpServer)
    .post('/v1/auth/login')
    .send({
      login,
      password,
    })
    .expect(201);

  const sessionCookiesHeader = response.headers['set-cookie'];

  return Array.isArray(sessionCookiesHeader)
    ? sessionCookiesHeader
    : sessionCookiesHeader
      ? [sessionCookiesHeader]
      : [];
}

export async function resetDatabase(prisma: PrismaClient) {
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.callParticipant.deleteMany();
  await prisma.callSession.deleteMany();
  await prisma.platformBlock.deleteMany();
  await prisma.forumTopicTag.deleteMany();
  await prisma.forumReply.deleteMany();
  await prisma.forumTopic.deleteMany();
  await prisma.forumTag.deleteMany();
  await prisma.lobbyNotificationOverride.deleteMany();
  await prisma.lobbyAccess.deleteMany();
  await prisma.lobby.deleteMany();
  await prisma.hubMute.deleteMany();
  await prisma.hubBan.deleteMany();
  await prisma.hubInvite.deleteMany();
  await prisma.hubMember.deleteMany();
  await prisma.hub.deleteMany();
  await prisma.directConversationParticipant.deleteMany();
  await prisma.directMessage.deleteMany();
  await prisma.directConversation.deleteMany();
  await prisma.block.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.user.deleteMany();
  await prisma.inviteKey.deleteMany();
}
