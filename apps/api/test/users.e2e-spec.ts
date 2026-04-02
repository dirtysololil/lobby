import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { userNotificationSettingsResponseSchema } from '@lobby/shared';
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

const onePixelPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9W7fxl8AAAAASUVORK5CYII=';

describe('UsersController (e2e)', () => {
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

  it('uploads avatar and updates notification defaults', async () => {
    const user = await createTestUser(prisma, {
      username: 'avataruser',
      email: 'avataruser@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Avatar User',
    });

    const cookies = await loginAs(app, user.username, 'VeryStrongPass123');

    await request(httpServer)
      .post('/v1/users/me/avatar')
      .set('Cookie', cookies)
      .attach('file', Buffer.from(onePixelPngBase64, 'base64'), {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(201);

    const storedProfile = await prisma.profile.findUniqueOrThrow({
      where: {
        userId: user.id,
      },
      select: {
        avatarFileKey: true,
        avatarMimeType: true,
        avatarWidth: true,
        avatarHeight: true,
      },
    });

    expect(storedProfile.avatarFileKey).toBeTruthy();
    expect(storedProfile.avatarMimeType).toBe('image/png');
    expect(storedProfile.avatarWidth).toBe(1);
    expect(storedProfile.avatarHeight).toBe(1);

    await request(httpServer)
      .patch('/v1/users/me/notification-settings')
      .set('Cookie', cookies)
      .send({
        dmNotificationDefault: 'MUTED',
        hubNotificationDefault: 'ALL',
        lobbyNotificationDefault: 'OFF',
      })
      .expect(200);

    const response = await request(httpServer)
      .get('/v1/users/me/notification-settings')
      .set('Cookie', cookies)
      .expect(200);

    expect(
      userNotificationSettingsResponseSchema.parse(response.body).settings
        .defaults.dmNotificationDefault,
    ).toBe('MUTED');
  });
});
