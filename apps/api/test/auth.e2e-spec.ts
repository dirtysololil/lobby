import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { authSessionResponseSchema } from '@lobby/shared';
import { Test } from '@nestjs/testing';
import { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import {
  generateAccessKey,
  hashOpaqueToken,
} from '../src/modules/invites/invite-key.util';

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

describe('AuthController (e2e)', () => {
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
    await prisma.user.deleteMany();
    await prisma.inviteKey.deleteMany();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('registers only with a valid access key and returns the session user', async () => {
    const rawAccessKey = generateAccessKey();
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    await prisma.inviteKey.create({
      data: {
        codeHash: hashOpaqueToken(
          rawAccessKey,
          process.env.SESSION_SECRET!,
          'invite',
        ),
        role: UserRole.MEMBER,
        maxUses: 1,
      },
    });

    const registerResponse = await request(httpServer)
      .post('/v1/auth/register')
      .send({
        username: 'owner_test',
        email: 'owner@test.local',
        displayName: 'Owner Test',
        password: 'VeryStrongPass123',
        accessKey: rawAccessKey,
      })
      .expect(201);

    const sessionCookiesHeader = registerResponse.headers['set-cookie'];
    const sessionCookies = Array.isArray(sessionCookiesHeader)
      ? sessionCookiesHeader
      : sessionCookiesHeader
        ? [sessionCookiesHeader]
        : [];
    const registerPayload = authSessionResponseSchema.parse(
      registerResponse.body,
    );

    expect(sessionCookies).toBeDefined();
    expect(registerPayload.user.username).toBe('owner_test');
    expect(registerPayload.user.profile.displayName).toBe('Owner Test');

    const meResponse = await request(httpServer)
      .get('/v1/auth/me')
      .set('Cookie', sessionCookies)
      .expect(200);
    const mePayload = authSessionResponseSchema.parse(meResponse.body);

    expect(mePayload.user.email).toBe('owner@test.local');
    expect(mePayload.user.profile.presence).toBe('ONLINE');
  });
});
