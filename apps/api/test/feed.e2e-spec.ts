import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import {
  feedPostListResponseSchema,
  feedPostResponseSchema,
} from '@lobby/shared';
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

describe('Feed (e2e)', () => {
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

  it('creates and lists home feed posts', async () => {
    await createTestUser(prisma, {
      username: 'feed_author',
      email: 'feed_author@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Feed Author',
    });

    const authorCookies = await loginAs(
      app,
      'feed_author',
      'VeryStrongPass123',
    );

    const createResponse = await request(httpServer)
      .post('/v1/feed')
      .set('Cookie', authorCookies)
      .send({
        kind: 'VIDEO',
        title: 'Релизный ролик',
        body: 'Короткое видео для домашней ленты.',
        mediaUrl: 'https://example.com/video.mp4',
      })
      .expect(201);

    const createdPost = feedPostResponseSchema.parse(createResponse.body).post;
    expect(createdPost.kind).toBe('VIDEO');
    expect(createdPost.author.username).toBe('feed_author');

    const listResponse = await request(httpServer)
      .get('/v1/feed')
      .set('Cookie', authorCookies)
      .expect(200);

    const items = feedPostListResponseSchema.parse(listResponse.body).items;
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe(createdPost.id);
  });
});
