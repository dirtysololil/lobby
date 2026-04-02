import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import {
  directConversationSummaryResponseSchema,
  directMessageResponseSchema,
} from '@lobby/shared';
import { Test } from '@nestjs/testing';
import { DmRetentionMode, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { DirectMessagesService } from '../src/modules/direct-messages/direct-messages.service';
import {
  createTestUser,
  ensureTestEnv,
  loginAs,
  resetDatabase,
} from './test-helpers';

ensureTestEnv();

describe('DirectMessagesController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let directMessagesService: DirectMessagesService;
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
    directMessagesService = app.get(DirectMessagesService);
    httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('creates a direct conversation and sends a message', async () => {
    const alice = await createTestUser(prisma, {
      username: 'delta',
      email: 'delta@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Delta',
    });
    const bob = await createTestUser(prisma, {
      username: 'echo',
      email: 'echo@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Echo',
    });

    const aliceCookies = await loginAs(
      app,
      alice.username,
      'VeryStrongPass123',
    );

    const openResponse = await request(httpServer)
      .post('/v1/direct-messages/open')
      .set('Cookie', aliceCookies)
      .send({ username: bob.username })
      .expect(201);

    const conversation = directConversationSummaryResponseSchema.parse(
      openResponse.body,
    ).conversation;

    const messageResponse = await request(httpServer)
      .post(`/v1/direct-messages/${conversation.id}/messages`)
      .set('Cookie', aliceCookies)
      .send({ content: 'hello from delta' })
      .expect(201);

    expect(
      directMessageResponseSchema.parse(messageResponse.body).message.content,
    ).toBe('hello from delta');
  });

  it('cleans up expired messages by retention policy', async () => {
    const alpha = await createTestUser(prisma, {
      username: 'foxtrot',
      email: 'foxtrot@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Foxtrot',
    });
    const beta = await createTestUser(prisma, {
      username: 'golf',
      email: 'golf@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Golf',
    });

    const conversation = await prisma.directConversation.create({
      data: {
        pairKey: [alpha.id, beta.id].sort().join(':'),
        createdByUserId: alpha.id,
        retentionMode: DmRetentionMode.H24,
        retentionSeconds: 24 * 60 * 60,
        participants: {
          create: [{ userId: alpha.id }, { userId: beta.id }],
        },
      },
      select: {
        id: true,
      },
    });

    const expiredTimestamp = new Date(Date.now() - 48 * 60 * 60 * 1_000);

    const message = await prisma.directMessage.create({
      data: {
        conversationId: conversation.id,
        authorId: alpha.id,
        content: 'expired payload',
        createdAt: expiredTimestamp,
        updatedAt: expiredTimestamp,
      },
      select: {
        id: true,
      },
    });

    const cleanedCount = await directMessagesService.cleanupExpiredMessages(
      new Date(),
    );

    expect(cleanedCount).toBe(1);

    const storedMessage = await prisma.directMessage.findUniqueOrThrow({
      where: {
        id: message.id,
      },
      select: {
        content: true,
        deletedAt: true,
      },
    });

    expect(storedMessage.content).toBeNull();
    expect(storedMessage.deletedAt).not.toBeNull();
  });
});
