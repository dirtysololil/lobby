import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { friendshipsResponseSchema } from '@lobby/shared';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import {
  createTestUser,
  ensureTestEnv,
  loginAs,
  resetDatabase,
} from './test-helpers';

ensureTestEnv();

describe('RelationshipsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let httpServer: Parameters<typeof request>[0];

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
    httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('creates and accepts a friend request', async () => {
    await createTestUser(prisma, {
      username: 'alice',
      email: 'alice@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Alice',
    });
    await createTestUser(prisma, {
      username: 'bob',
      email: 'bob@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Bob',
    });

    const aliceCookies = await loginAs(app, 'alice', 'VeryStrongPass123');
    const bobCookies = await loginAs(app, 'bob', 'VeryStrongPass123');

    await request(httpServer)
      .post('/v1/relationships/friends/request')
      .set('Cookie', aliceCookies)
      .send({ username: 'bob' })
      .expect(201);

    const incomingList = await request(httpServer)
      .get('/v1/relationships/friends')
      .set('Cookie', bobCookies)
      .expect(200);

    expect(
      friendshipsResponseSchema.parse(incomingList.body).items[0]?.state,
    ).toBe('INCOMING_REQUEST');

    await request(httpServer)
      .post('/v1/relationships/friends/accept')
      .set('Cookie', bobCookies)
      .send({ username: 'alice' })
      .expect(201);

    const acceptedList = await request(httpServer)
      .get('/v1/relationships/friends')
      .set('Cookie', aliceCookies)
      .expect(200);

    expect(
      friendshipsResponseSchema.parse(acceptedList.body).items[0]?.state,
    ).toBe('ACCEPTED');
  });

  it('blocks direct interaction after a block is created', async () => {
    await createTestUser(prisma, {
      username: 'alpha',
      email: 'alpha@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Alpha',
    });
    await createTestUser(prisma, {
      username: 'bravo',
      email: 'bravo@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Bravo',
    });

    const alphaCookies = await loginAs(app, 'alpha', 'VeryStrongPass123');

    await request(httpServer)
      .post('/v1/relationships/blocks')
      .set('Cookie', alphaCookies)
      .send({ username: 'bravo' })
      .expect(201);

    await request(httpServer)
      .post('/v1/direct-messages/open')
      .set('Cookie', alphaCookies)
      .send({ username: 'bravo' })
      .expect(403);
  });
});
