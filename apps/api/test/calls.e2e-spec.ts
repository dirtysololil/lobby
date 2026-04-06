import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import {
  callResponseSchema,
  callStateResponseSchema,
  callTokenResponseSchema,
  directConversationSummaryResponseSchema,
} from '@lobby/shared';
import { Test } from '@nestjs/testing';
import {
  CallMode,
  CallParticipantState,
  CallScope,
  CallStatus,
  HubMemberRole,
  LobbyType,
  PrismaClient,
} from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { CallsService } from '../src/modules/calls/calls.service';
import { QueueService } from '../src/modules/queue/queue.service';
import {
  createTestUser,
  ensureTestEnv,
  loginAs,
  resetDatabase,
} from './test-helpers';

ensureTestEnv();

describe('CallsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let callsService: CallsService;
  let queueService: QueueService;
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
    callsService = app.get(CallsService);
    queueService = app.get(QueueService);
    httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('creates, accepts and ends a DM call with LiveKit token issuance', async () => {
    const alice = await createTestUser(prisma, {
      username: 'hotel',
      email: 'hotel@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Hotel',
    });
    const bob = await createTestUser(prisma, {
      username: 'india',
      email: 'india@test.local',
      password: 'VeryStrongPass123',
      displayName: 'India',
    });

    const aliceCookies = await loginAs(
      app,
      alice.username,
      'VeryStrongPass123',
    );
    const bobCookies = await loginAs(app, bob.username, 'VeryStrongPass123');

    const openResponse = await request(httpServer)
      .post('/v1/direct-messages/open')
      .set('Cookie', aliceCookies)
      .send({ username: bob.username })
      .expect(201);

    const conversation = directConversationSummaryResponseSchema.parse(
      openResponse.body,
    ).conversation;

    const startResponse = await request(httpServer)
      .post(`/v1/calls/dm/${conversation.id}/start`)
      .set('Cookie', aliceCookies)
      .send({ mode: 'VIDEO' })
      .expect(201);

    const startedCall = callResponseSchema.parse(startResponse.body).call;
    expect(startedCall.status).toBe('RINGING');

    const acceptResponse = await request(httpServer)
      .post(`/v1/calls/${startedCall.id}/accept`)
      .set('Cookie', bobCookies)
      .expect(201);

    const acceptedCall = callResponseSchema.parse(acceptResponse.body).call;
    expect(acceptedCall.status).toBe('ACCEPTED');

    const tokenResponse = await request(httpServer)
      .post(`/v1/calls/${startedCall.id}/token`)
      .set('Cookie', bobCookies)
      .expect(201);

    const tokenPayload = callTokenResponseSchema.parse(tokenResponse.body);
    expect(tokenPayload.connection.callId).toBe(startedCall.id);
    expect(tokenPayload.connection.url).toBe(process.env.LIVEKIT_URL);
    expect(tokenPayload.connection.canPublishMedia).toBe(true);

    const endResponse = await request(httpServer)
      .post(`/v1/calls/${startedCall.id}/end`)
      .set('Cookie', aliceCookies)
      .expect(201);

    expect(callResponseSchema.parse(endResponse.body).call.status).toBe(
      'ENDED',
    );
  });

  it('marks unanswered DM call as missed by timeout handler', async () => {
    const alpha = await createTestUser(prisma, {
      username: 'juliet',
      email: 'juliet@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Juliet',
    });
    const beta = await createTestUser(prisma, {
      username: 'kilo',
      email: 'kilo@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Kilo',
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

    const startResponse = await request(httpServer)
      .post(`/v1/calls/dm/${conversation.id}/start`)
      .set('Cookie', alphaCookies)
      .send({ mode: 'AUDIO' })
      .expect(201);

    const startedCall = callResponseSchema.parse(startResponse.body).call;

    await callsService.expireRingingCall(startedCall.id);

    const stateResponse = await request(httpServer)
      .get(`/v1/calls/dm/${conversation.id}`)
      .set('Cookie', alphaCookies)
      .expect(200);

    const state = callStateResponseSchema.parse(stateResponse.body);
    expect(state.activeCall).toBeNull();
    expect(state.history[0]?.status).toBe('MISSED');
  });

  it('still returns a DM call when timeout scheduling fails once', async () => {
    const alice = await createTestUser(prisma, {
      username: 'november',
      email: 'november@test.local',
      password: 'VeryStrongPass123',
      displayName: 'November',
    });
    const bob = await createTestUser(prisma, {
      username: 'oscar',
      email: 'oscar@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Oscar',
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
    const scheduleSpy = jest
      .spyOn(queueService, 'scheduleCallTimeout')
      .mockRejectedValueOnce(new Error('queue unavailable'));

    try {
      const startResponse = await request(httpServer)
        .post(`/v1/calls/dm/${conversation.id}/start`)
        .set('Cookie', aliceCookies)
        .send({ mode: 'AUDIO' })
        .expect(201);

      const startedCall = callResponseSchema.parse(startResponse.body).call;
      expect(startedCall.status).toBe('RINGING');

      const stateResponse = await request(httpServer)
        .get(`/v1/calls/dm/${conversation.id}`)
        .set('Cookie', aliceCookies)
        .expect(200);

      const state = callStateResponseSchema.parse(stateResponse.body);
      expect(state.activeCall?.id).toBe(startedCall.id);
    } finally {
      scheduleSpy.mockRestore();
    }
  });

  it('expires stale ringing DM calls while loading conversation call state', async () => {
    const alpha = await createTestUser(prisma, {
      username: 'papa',
      email: 'papa@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Papa',
    });
    const beta = await createTestUser(prisma, {
      username: 'quebec',
      email: 'quebec@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Quebec',
    });
    const alphaCookies = await loginAs(
      app,
      alpha.username,
      'VeryStrongPass123',
    );
    const staleCreatedAt = new Date(
      Date.now() - (Number(process.env.CALL_RING_TIMEOUT_SECONDS) + 10) * 1_000,
    );

    const openResponse = await request(httpServer)
      .post('/v1/direct-messages/open')
      .set('Cookie', alphaCookies)
      .send({ username: beta.username })
      .expect(201);

    const conversation = directConversationSummaryResponseSchema.parse(
      openResponse.body,
    ).conversation;

    const staleCall = await prisma.callSession.create({
      data: {
        scope: CallScope.DM,
        mode: CallMode.AUDIO,
        status: CallStatus.RINGING,
        dmConversationId: conversation.id,
        livekitRoomName: `lobby_dm_stale_${Date.now()}`,
        initiatedByUserId: alpha.id,
        createdAt: staleCreatedAt,
        updatedAt: staleCreatedAt,
        participants: {
          create: [
            {
              userId: alpha.id,
              state: CallParticipantState.JOINED,
              respondedAt: staleCreatedAt,
              joinedAt: staleCreatedAt,
              invitedAt: staleCreatedAt,
              createdAt: staleCreatedAt,
              updatedAt: staleCreatedAt,
            },
            {
              userId: beta.id,
              state: CallParticipantState.INVITED,
              invitedAt: staleCreatedAt,
              createdAt: staleCreatedAt,
              updatedAt: staleCreatedAt,
            },
          ],
        },
      },
      select: {
        id: true,
      },
    });

    const stateResponse = await request(httpServer)
      .get(`/v1/calls/dm/${conversation.id}`)
      .set('Cookie', alphaCookies)
      .expect(200);

    const state = callStateResponseSchema.parse(stateResponse.body);
    expect(state.activeCall).toBeNull();
    expect(state.history[0]?.id).toBe(staleCall.id);
    expect(state.history[0]?.status).toBe('MISSED');
  });

  it('issues listen-only token for muted user in voice lobby group call', async () => {
    const owner = await createTestUser(prisma, {
      username: 'lima',
      email: 'lima@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Lima',
    });
    const mutedMember = await createTestUser(prisma, {
      username: 'mike',
      email: 'mike@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Mike',
    });

    const hub = await prisma.hub.create({
      data: {
        name: 'Calls Hub',
        slug: 'calls-hub',
        isPrivate: true,
        createdByUserId: owner.id,
        members: {
          create: [
            {
              userId: owner.id,
              role: HubMemberRole.OWNER,
            },
            {
              userId: mutedMember.id,
              role: HubMemberRole.MEMBER,
            },
          ],
        },
        lobbies: {
          create: {
            name: 'Voice Dock',
            type: LobbyType.VOICE,
            createdByUserId: owner.id,
          },
        },
      },
      include: {
        lobbies: true,
      },
    });
    const voiceLobby = hub.lobbies[0];

    if (!voiceLobby) {
      throw new Error('Voice lobby was not created');
    }

    await prisma.hubMute.create({
      data: {
        hubId: hub.id,
        userId: mutedMember.id,
        mutedByUserId: owner.id,
      },
    });

    const ownerCookies = await loginAs(
      app,
      owner.username,
      'VeryStrongPass123',
    );
    const memberCookies = await loginAs(
      app,
      mutedMember.username,
      'VeryStrongPass123',
    );

    const startResponse = await request(httpServer)
      .post(`/v1/calls/hubs/${hub.id}/lobbies/${voiceLobby.id}/start`)
      .set('Cookie', ownerCookies)
      .expect(201);

    const activeCall = callResponseSchema.parse(startResponse.body).call;

    const tokenResponse = await request(httpServer)
      .post(`/v1/calls/${activeCall.id}/token`)
      .set('Cookie', memberCookies)
      .expect(201);

    const tokenPayload = callTokenResponseSchema.parse(tokenResponse.body);
    expect(tokenPayload.connection.canPublishMedia).toBe(false);
  });
});
