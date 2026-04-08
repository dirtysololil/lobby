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

  it('creates a pending Tenor embed without delaying text message delivery', async () => {
    const alpha = await createTestUser(prisma, {
      username: 'tenoralpha',
      email: 'tenoralpha@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Tenor Alpha',
    });
    const beta = await createTestUser(prisma, {
      username: 'tenorbeta',
      email: 'tenorbeta@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Tenor Beta',
    });
    const alphaCookies = await loginAs(
      app,
      alpha.username,
      'VeryStrongPass123',
    );
    const openResponse = await request(httpServer)
      .post('/v1/direct-messages/open')
      .set('Cookie', alphaCookies)
      .send({ username: beta.username })
      .expect(201);
    const conversation = directConversationSummaryResponseSchema.parse(
      openResponse.body,
    ).conversation;
    const messageResponse = await request(httpServer)
      .post(`/v1/direct-messages/${conversation.id}/messages`)
      .set('Cookie', alphaCookies)
      .send({
        content:
          'https://tenor.com/view/cat-kitten-pet-gif-15031226867688336559',
      })
      .expect(201);
    const message = directMessageResponseSchema.parse(messageResponse.body).message;

    expect(message.type).toBe('TEXT');
    expect(message.linkEmbed?.status).toBe('PENDING');
    expect(message.linkEmbed?.provider).toBe('TENOR');

    const storedEmbed = await prisma.directMessageLinkEmbed.findUnique({
      where: {
        messageId: message.id,
      },
      select: {
        status: true,
        sourceUrl: true,
      },
    });

    expect(storedEmbed?.status).toBe('PENDING');
    expect(storedEmbed?.sourceUrl).toContain('tenor.com/view/');
  });

  it('sends a sticker as a direct message and tracks recent usage', async () => {
    const alpha = await createTestUser(prisma, {
      username: 'stickeralpha',
      email: 'stickeralpha@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Sticker Alpha',
    });
    const beta = await createTestUser(prisma, {
      username: 'stickerbeta',
      email: 'stickerbeta@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Sticker Beta',
    });

    const pack = await prisma.stickerPack.create({
      data: {
        ownerId: alpha.id,
        title: 'Личные',
        sortOrder: 0,
      },
    });
    const sticker = await prisma.sticker.create({
      data: {
        packId: pack.id,
        title: 'Пинг',
        fileKey: 'stickers/test/ping.webp',
        originalName: 'ping.webp',
        mimeType: 'image/webp',
        fileSize: 1024,
        width: 256,
        height: 256,
        sortOrder: 0,
      },
    });

    const alphaCookies = await loginAs(
      app,
      alpha.username,
      'VeryStrongPass123',
    );

    const openResponse = await request(httpServer)
      .post('/v1/direct-messages/open')
      .set('Cookie', alphaCookies)
      .send({ username: beta.username })
      .expect(201);

    const conversation = directConversationSummaryResponseSchema.parse(
      openResponse.body,
    ).conversation;

    const messageResponse = await request(httpServer)
      .post(`/v1/direct-messages/${conversation.id}/messages`)
      .set('Cookie', alphaCookies)
      .send({ type: 'STICKER', stickerId: sticker.id })
      .expect(201);

    const message = directMessageResponseSchema.parse(messageResponse.body).message;

    expect(message.type).toBe('STICKER');
    expect(message.content).toBeNull();
    expect(message.sticker?.id).toBe(sticker.id);

    const recent = await prisma.stickerRecent.findUnique({
      where: {
        userId_stickerId: {
          userId: alpha.id,
          stickerId: sticker.id,
        },
      },
    });

    expect(recent?.usageCount).toBe(1);
  });

  it('renders a sticker message from snapshot even when the sticker relation is missing', async () => {
    const alpha = await createTestUser(prisma, {
      username: 'snapshotalpha',
      email: 'snapshotalpha@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Snapshot Alpha',
    });
    const beta = await createTestUser(prisma, {
      username: 'snapshotbeta',
      email: 'snapshotbeta@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Snapshot Beta',
    });

    const pack = await prisma.stickerPack.create({
      data: {
        ownerId: alpha.id,
        title: 'Snapshot Pack',
        slug: 'snapshot-pack',
        sortOrder: 0,
        isActive: true,
        publishedAt: new Date(),
      },
    });
    const sticker = await prisma.sticker.create({
      data: {
        packId: pack.id,
        title: 'Snapshot Sticker',
        type: 'STATIC',
        fileKey: 'stickers/test/snapshot.webp',
        originalName: 'snapshot.webp',
        mimeType: 'image/webp',
        fileSize: 1024,
        width: 224,
        height: 224,
        sortOrder: 0,
        isActive: true,
        publishedAt: new Date(),
      },
    });

    const alphaCookies = await loginAs(
      app,
      alpha.username,
      'VeryStrongPass123',
    );
    const openResponse = await request(httpServer)
      .post('/v1/direct-messages/open')
      .set('Cookie', alphaCookies)
      .send({ username: beta.username })
      .expect(201);
    const conversation = directConversationSummaryResponseSchema.parse(
      openResponse.body,
    ).conversation;
    const messageResponse = await request(httpServer)
      .post(`/v1/direct-messages/${conversation.id}/messages`)
      .set('Cookie', alphaCookies)
      .send({ type: 'STICKER', stickerId: sticker.id })
      .expect(201);
    const message = directMessageResponseSchema.parse(messageResponse.body).message;

    await prisma.directMessage.update({
      where: {
        id: message.id,
      },
      data: {
        stickerId: null,
      },
    });

    const detailResponse = await request(httpServer)
      .get(`/v1/direct-messages/${conversation.id}`)
      .set('Cookie', alphaCookies)
      .expect(200);
    const detail = directConversationDetailSchema.parse(detailResponse.body);
    const snapshotMessage = detail.conversation.messages.at(-1);

    expect(snapshotMessage?.sticker?.id).toBe(sticker.id);
    expect(snapshotMessage?.sticker?.title).toBe('Snapshot Sticker');
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
