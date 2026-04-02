import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import {
  authSessionResponseSchema,
  inviteCreateResponseSchema,
  inviteListResponseSchema,
  inviteResponseSchema,
} from '@lobby/shared';
import { Test } from '@nestjs/testing';
import { PrismaClient, PresenceStatus, UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

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
process.env.MAX_FILE_MB ??= '50';
process.env.REALTIME_CORS_ORIGIN ??= 'http://localhost:3000';

describe('InvitesController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    const testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = testingModule.createNestApplication();
    app.setGlobalPrefix('v1');
    app.use(cookieParser());
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
  });

  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.session.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.inviteKey.deleteMany();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('allows owner to create, list and revoke invites', async () => {
    const password = 'VeryStrongPass123';
    const passwordHash = await argon2.hash(password);
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    await prisma.user.create({
      data: {
        email: 'owner@test.local',
        username: 'owner_test',
        passwordHash,
        role: UserRole.OWNER,
        profile: {
          create: {
            displayName: 'Owner Test',
            presence: PresenceStatus.OFFLINE,
          },
        },
      },
    });

    const loginResponse = await request(httpServer)
      .post('/v1/auth/login')
      .send({
        login: 'owner_test',
        password,
      })
      .expect(201);
    const loginPayload = authSessionResponseSchema.parse(loginResponse.body);
    const sessionCookiesHeader = loginResponse.headers['set-cookie'];
    const sessionCookies = Array.isArray(sessionCookiesHeader)
      ? sessionCookiesHeader
      : sessionCookiesHeader
        ? [sessionCookiesHeader]
        : [];

    expect(loginPayload.user.role).toBe('OWNER');

    const createResponse = await request(httpServer)
      .post('/v1/invites')
      .set('Cookie', sessionCookies)
      .send({
        label: 'Owner invite',
        role: 'MEMBER',
        maxUses: 3,
      })
      .expect(201);
    const createPayload = inviteCreateResponseSchema.parse(createResponse.body);

    expect(createPayload.rawCode.startsWith('LBY-')).toBe(true);

    const listResponse = await request(httpServer)
      .get('/v1/invites')
      .set('Cookie', sessionCookies)
      .expect(200);
    const listPayload = inviteListResponseSchema.parse(listResponse.body);

    expect(
      listPayload.items.some((item) => item.id === createPayload.invite.id),
    ).toBe(true);

    const revokeResponse = await request(httpServer)
      .post(`/v1/invites/${createPayload.invite.id}/revoke`)
      .set('Cookie', sessionCookies)
      .expect(201);
    const revokePayload = inviteResponseSchema.parse(revokeResponse.body);

    expect(revokePayload.invite.revokedAt).not.toBeNull();
  });
});
