import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import {
  forumTopicDetailSchema,
  forumTopicResponseSchema,
  hubShellResponseSchema,
  hubSummarySchema,
  lobbyResponseSchema,
  viewerHubInvitesResponseSchema,
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

describe('Hubs and Forum (e2e)', () => {
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

  it('creates a hub and a lobby', async () => {
    await createTestUser(prisma, {
      username: 'hub_owner',
      email: 'hub_owner@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Hub Owner',
    });

    const ownerCookies = await loginAs(app, 'hub_owner', 'VeryStrongPass123');

    const hubResponse = await request(httpServer)
      .post('/v1/hubs')
      .set('Cookie', ownerCookies)
      .send({
        name: 'Product Hub',
        slug: 'product-hub',
        description: 'Hub for product work',
        isPrivate: true,
      })
      .expect(201);

    const hub = hubSummarySchema.parse(hubResponse.body);

    const lobbyResponse = await request(httpServer)
      .post(`/v1/hubs/${hub.id}/lobbies`)
      .set('Cookie', ownerCookies)
      .send({
        name: 'announcements',
        description: 'Main text lobby',
        type: 'TEXT',
        isPrivate: false,
        allowedUsernames: [],
      })
      .expect(201);

    expect(lobbyResponseSchema.parse(lobbyResponse.body).lobby.name).toBe(
      'announcements',
    );
  });

  it('rejects lobby creation for a member without elevated permissions', async () => {
    await createTestUser(prisma, {
      username: 'owner_user',
      email: 'owner_user@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Owner User',
    });
    await createTestUser(prisma, {
      username: 'member_user',
      email: 'member_user@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Member User',
    });

    const ownerCookies = await loginAs(app, 'owner_user', 'VeryStrongPass123');
    const memberCookies = await loginAs(
      app,
      'member_user',
      'VeryStrongPass123',
    );

    const hubResponse = await request(httpServer)
      .post('/v1/hubs')
      .set('Cookie', ownerCookies)
      .send({
        name: 'Ops Hub',
        slug: 'ops-hub',
        description: null,
        isPrivate: false,
      })
      .expect(201);

    const hub = hubSummarySchema.parse(hubResponse.body);

    await request(httpServer)
      .post(`/v1/hubs/${hub.id}/invites`)
      .set('Cookie', ownerCookies)
      .send({
        username: 'member_user',
        expiresAt: null,
      })
      .expect(201);

    const invitesResponse = await request(httpServer)
      .get('/v1/hubs/invites/me')
      .set('Cookie', memberCookies)
      .expect(200);

    const inviteId = viewerHubInvitesResponseSchema.parse(invitesResponse.body)
      .items[0]?.id as string;

    await request(httpServer)
      .post(`/v1/hubs/invites/${inviteId}/accept`)
      .set('Cookie', memberCookies)
      .expect(201);

    await request(httpServer)
      .post(`/v1/hubs/${hub.id}/lobbies`)
      .set('Cookie', memberCookies)
      .send({
        name: 'member-lobby',
        description: null,
        type: 'TEXT',
        isPrivate: false,
        allowedUsernames: [],
      })
      .expect(403);
  });

  it('creates forum topics and locks or archives them with moderator permissions', async () => {
    await createTestUser(prisma, {
      username: 'forum_owner',
      email: 'forum_owner@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Forum Owner',
    });
    await createTestUser(prisma, {
      username: 'forum_member',
      email: 'forum_member@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Forum Member',
    });

    const ownerCookies = await loginAs(app, 'forum_owner', 'VeryStrongPass123');
    const memberCookies = await loginAs(
      app,
      'forum_member',
      'VeryStrongPass123',
    );

    const hubResponse = await request(httpServer)
      .post('/v1/hubs')
      .set('Cookie', ownerCookies)
      .send({
        name: 'Forum Hub',
        slug: 'forum-hub',
        description: 'Forum testing',
        isPrivate: false,
      })
      .expect(201);

    const hub = hubSummarySchema.parse(hubResponse.body);

    const forumLobbyResponse = await request(httpServer)
      .post(`/v1/hubs/${hub.id}/lobbies`)
      .set('Cookie', ownerCookies)
      .send({
        name: 'ideas',
        description: 'Forum ideas',
        type: 'FORUM',
        isPrivate: false,
        allowedUsernames: [],
      })
      .expect(201);

    const forumLobby = lobbyResponseSchema.parse(forumLobbyResponse.body).lobby;

    await request(httpServer)
      .post(`/v1/hubs/${hub.id}/invites`)
      .set('Cookie', ownerCookies)
      .send({
        username: 'forum_member',
        expiresAt: null,
      })
      .expect(201);

    const invitesResponse = await request(httpServer)
      .get('/v1/hubs/invites/me')
      .set('Cookie', memberCookies)
      .expect(200);

    const inviteId = viewerHubInvitesResponseSchema.parse(invitesResponse.body)
      .items[0]?.id as string;

    await request(httpServer)
      .post(`/v1/hubs/invites/${inviteId}/accept`)
      .set('Cookie', memberCookies)
      .expect(201);

    const topicResponse = await request(httpServer)
      .post(`/v1/forum/hubs/${hub.id}/lobbies/${forumLobby.id}/topics`)
      .set('Cookie', memberCookies)
      .send({
        title: 'Topic Alpha',
        content: 'Initial forum topic',
        tags: ['alpha', 'beta'],
      })
      .expect(201);

    const topic = forumTopicResponseSchema.parse(topicResponse.body).topic;

    await request(httpServer)
      .patch(
        `/v1/forum/hubs/${hub.id}/lobbies/${forumLobby.id}/topics/${topic.id}/state`,
      )
      .set('Cookie', memberCookies)
      .send({
        locked: true,
      })
      .expect(403);

    await request(httpServer)
      .patch(`/v1/hubs/${hub.id}/members/role`)
      .set('Cookie', ownerCookies)
      .send({
        username: 'forum_member',
        role: 'MODERATOR',
      })
      .expect(200);

    await request(httpServer)
      .patch(
        `/v1/forum/hubs/${hub.id}/lobbies/${forumLobby.id}/topics/${topic.id}/state`,
      )
      .set('Cookie', memberCookies)
      .send({
        locked: true,
        archived: true,
      })
      .expect(200);

    const topicDetailResponse = await request(httpServer)
      .get(
        `/v1/forum/hubs/${hub.id}/lobbies/${forumLobby.id}/topics/${topic.id}`,
      )
      .set('Cookie', memberCookies)
      .expect(200);

    const topicDetail = forumTopicDetailSchema.parse(topicDetailResponse.body);
    expect(topicDetail.topic.locked).toBe(true);
    expect(topicDetail.topic.archived).toBe(true);
  });

  it('allows forum topic creation only inside accessible hub lobbies', async () => {
    await createTestUser(prisma, {
      username: 'private_owner',
      email: 'private_owner@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Private Owner',
    });
    await createTestUser(prisma, {
      username: 'outside_user',
      email: 'outside_user@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Outside User',
    });

    const ownerCookies = await loginAs(
      app,
      'private_owner',
      'VeryStrongPass123',
    );
    const outsideCookies = await loginAs(
      app,
      'outside_user',
      'VeryStrongPass123',
    );

    const hubResponse = await request(httpServer)
      .post('/v1/hubs')
      .set('Cookie', ownerCookies)
      .send({
        name: 'Private Product Hub',
        slug: 'private-product-hub',
        description: null,
        isPrivate: true,
      })
      .expect(201);

    const hub = hubSummarySchema.parse(hubResponse.body);

    const forumLobbyResponse = await request(httpServer)
      .post(`/v1/hubs/${hub.id}/lobbies`)
      .set('Cookie', ownerCookies)
      .send({
        name: 'private-forum',
        description: null,
        type: 'FORUM',
        isPrivate: true,
        allowedUsernames: [],
      })
      .expect(201);

    const forumLobby = lobbyResponseSchema.parse(forumLobbyResponse.body).lobby;

    await request(httpServer)
      .get(`/v1/hubs/${hub.id}`)
      .set('Cookie', outsideCookies)
      .expect(403);

    await request(httpServer)
      .post(`/v1/forum/hubs/${hub.id}/lobbies/${forumLobby.id}/topics`)
      .set('Cookie', outsideCookies)
      .send({
        title: 'Forbidden Topic',
        content: 'Should not work',
        tags: [],
      })
      .expect(403);

    const ownerHubShellResponse = await request(httpServer)
      .get(`/v1/hubs/${hub.id}`)
      .set('Cookie', ownerCookies)
      .expect(200);

    expect(
      hubShellResponseSchema.parse(ownerHubShellResponse.body).hub.isPrivate,
    ).toBe(true);
  });
});
