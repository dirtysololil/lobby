import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, UserRole } from '@prisma/client';
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

describe('AdminController (e2e)', () => {
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

  it('blocks and unblocks a member account from admin panel', async () => {
    const admin = await createTestUser(prisma, {
      username: 'adminops',
      email: 'adminops@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Admin Ops',
      role: UserRole.ADMIN,
    });
    const member = await createTestUser(prisma, {
      username: 'targetuser',
      email: 'targetuser@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Target User',
    });

    const adminCookies = await loginAs(
      app,
      admin.username,
      'VeryStrongPass123',
    );
    const memberCookies = await loginAs(
      app,
      member.username,
      'VeryStrongPass123',
    );

    await request(httpServer)
      .post(`/v1/admin/users/${member.id}/block`)
      .set('Cookie', adminCookies)
      .send({ reason: 'moderation check' })
      .expect(201);

    await request(httpServer)
      .get('/v1/auth/me')
      .set('Cookie', memberCookies)
      .expect(401);

    await request(httpServer)
      .post(`/v1/auth/login`)
      .send({
        login: member.username,
        password: 'VeryStrongPass123',
      })
      .expect(403);

    await request(httpServer)
      .post(`/v1/admin/users/${member.id}/unblock`)
      .set('Cookie', adminCookies)
      .expect(201);

    await request(httpServer)
      .post('/v1/auth/login')
      .send({
        login: member.username,
        password: 'VeryStrongPass123',
      })
      .expect(201);
  });

  it('clears audit logs and keeps the clear action itself', async () => {
    const admin = await createTestUser(prisma, {
      username: 'auditboss',
      email: 'auditboss@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Audit Boss',
      role: UserRole.ADMIN,
    });

    const adminCookies = await loginAs(
      app,
      admin.username,
      'VeryStrongPass123',
    );

    await request(httpServer)
      .get('/v1/admin/audit')
      .set('Cookie', adminCookies)
      .expect(200);

    const beforeClearCount = await prisma.auditLog.count();
    expect(beforeClearCount).toBeGreaterThan(0);

    await request(httpServer)
      .post('/v1/admin/audit/clear')
      .set('Cookie', adminCookies)
      .expect(201);

    const remainingLogs = await prisma.auditLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        action: true,
        entityType: true,
      },
    });

    expect(remainingLogs).toHaveLength(1);
    expect(remainingLogs[0]).toEqual({
      action: 'admin.audit.clear',
      entityType: 'AuditLog',
    });
  });
});
