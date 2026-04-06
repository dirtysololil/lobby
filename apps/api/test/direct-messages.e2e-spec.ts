import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import {
  directConversationDetailSchema,
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

  it('exposes counterpart last seen separately from online status', async () => {
    const alice = await createTestUser(prisma, {
      username: 'harbor',
      email: 'harbor@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Harbor',
    });
    const bob = await createTestUser(prisma, {
      username: 'signal',
      email: 'signal@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Signal',
    });
    const bobLastSeenAt = new Date(Date.now() - 2 * 60 * 60 * 1_000);

    await prisma.session.create({
      data: {
        userId: bob.id,
        tokenHash: `test-session-${Date.now()}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
        lastActiveAt: bobLastSeenAt,
      },
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

    expect(conversation.counterpart.isOnline).toBe(false);
    expect(conversation.counterpart.lastSeenAt).toBe(
      bobLastSeenAt.toISOString(),
    );

    const detailResponse = await request(httpServer)
      .get(`/v1/direct-messages/${conversation.id}`)
      .set('Cookie', aliceCookies)
      .expect(200);

    const detail = directConversationDetailSchema.parse(detailResponse.body);
    const counterpart = detail.conversation.participants.find(
      (participant) => participant.user.id === bob.id,
    )?.user;

    expect(counterpart?.isOnline).toBe(false);
    expect(counterpart?.lastSeenAt).toBe(bobLastSeenAt.toISOString());
  });

  it('allows authors to delete old direct messages without a time window', async () => {
    const alpha = await createTestUser(prisma, {
      username: 'marble',
      email: 'marble@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Marble',
    });
    const beta = await createTestUser(prisma, {
      username: 'needle',
      email: 'needle@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Needle',
    });
    const oldTimestamp = new Date(Date.now() - 6 * 60 * 60 * 1_000);

    const conversation = await prisma.directConversation.create({
      data: {
        pairKey: [alpha.id, beta.id].sort().join(':'),
        createdByUserId: alpha.id,
        lastMessageAt: oldTimestamp,
        participants: {
          create: [{ userId: alpha.id }, { userId: beta.id }],
        },
        messages: {
          create: {
            authorId: alpha.id,
            content: 'legacy payload',
            createdAt: oldTimestamp,
            updatedAt: oldTimestamp,
          },
        },
      },
      select: {
        id: true,
        messages: {
          select: {
            id: true,
          },
        },
      },
    });
    const messageId = conversation.messages[0]?.id;

    expect(messageId).toBeDefined();

    const alphaCookies = await loginAs(
      app,
      alpha.username,
      'VeryStrongPass123',
    );

    const detailBeforeDeleteResponse = await request(httpServer)
      .get(`/v1/direct-messages/${conversation.id}`)
      .set('Cookie', alphaCookies)
      .expect(200);

    const detailBeforeDelete = directConversationDetailSchema.parse(
      detailBeforeDeleteResponse.body,
    );

    expect(detailBeforeDelete.conversation.messages).toHaveLength(1);
    expect(detailBeforeDelete.conversation.messages[0]?.canDelete).toBe(true);
    expect(detailBeforeDelete.conversation.messages[0]?.deleteExpiresAt).toBeNull();

    const deleteResponse = await request(httpServer)
      .delete(`/v1/direct-messages/${conversation.id}/messages/${messageId}`)
      .set('Cookie', alphaCookies)
      .expect(200);

    expect(directMessageResponseSchema.parse(deleteResponse.body).message.isDeleted).toBe(
      true,
    );

    const detailAfterDeleteResponse = await request(httpServer)
      .get(`/v1/direct-messages/${conversation.id}`)
      .set('Cookie', alphaCookies)
      .expect(200);

    const detailAfterDelete = directConversationDetailSchema.parse(
      detailAfterDeleteResponse.body,
    );

    expect(detailAfterDelete.conversation.messages).toHaveLength(0);

    const storedConversation = await prisma.directConversation.findUniqueOrThrow({
      where: {
        id: conversation.id,
      },
      select: {
        lastMessageAt: true,
      },
    });

    expect(storedConversation.lastMessageAt).toBeNull();
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
