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

function createSilentWavBuffer(durationMs = 250) {
  const sampleRate = 8_000;
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.max(1, Math.floor((sampleRate * durationMs) / 1_000));
  const dataSize = frameCount * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

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

  it('uploads avatar, stores ringtone and updates notification defaults', async () => {
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
      .post('/v1/users/me/ringtone')
      .set('Cookie', cookies)
      .attach('file', createSilentWavBuffer(), {
        filename: 'soft-call.wav',
        contentType: 'audio/wav',
      })
      .expect(201);

    await request(httpServer)
      .patch('/v1/users/me/profile')
      .set('Cookie', cookies)
      .send({
        displayName: 'Avatar User',
        bio: 'Calls enabled',
        presence: 'ONLINE',
        avatarPreset: 'NONE',
        callRingtonePreset: 'PULSE',
      })
      .expect(200);

    const storedRingtoneProfile = await prisma.profile.findUniqueOrThrow({
      where: {
        userId: user.id,
      },
      select: {
        customRingtoneFileKey: true,
        customRingtoneMimeType: true,
        customRingtoneBytes: true,
        callRingtonePreset: true,
      },
    });

    expect(storedRingtoneProfile.customRingtoneFileKey).toBeTruthy();
    expect(storedRingtoneProfile.customRingtoneMimeType).toBe('audio/wav');
    expect(storedRingtoneProfile.customRingtoneBytes).toBeGreaterThan(44);
    expect(storedRingtoneProfile.callRingtonePreset).toBe('PULSE');

    await request(httpServer)
      .get('/v1/users/me/ringtone')
      .set('Cookie', cookies)
      .expect(200)
      .expect('Content-Type', /audio\/wav/);

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

    await request(httpServer)
      .delete('/v1/users/me/ringtone')
      .set('Cookie', cookies)
      .expect(200);

    const profileAfterDelete = await prisma.profile.findUniqueOrThrow({
      where: {
        userId: user.id,
      },
      select: {
        customRingtoneFileKey: true,
        callRingtonePreset: true,
      },
    });

    expect(profileAfterDelete.customRingtoneFileKey).toBeNull();
    expect(profileAfterDelete.callRingtonePreset).toBe('PULSE');
  });

  it('rejects unsupported ringtone formats', async () => {
    const user = await createTestUser(prisma, {
      username: 'ringtonebad',
      email: 'ringtonebad@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Bad Ringtone',
    });

    const cookies = await loginAs(app, user.username, 'VeryStrongPass123');

    const response = await request(httpServer)
      .post('/v1/users/me/ringtone')
      .set('Cookie', cookies)
      .attach('file', Buffer.from('plain text payload'), {
        filename: 'ringtone.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    expect(String(response.body?.error?.message ?? response.body?.message ?? '')).toContain(
      'Поддерживаются только MP3, WAV, OGG и M4A',
    );
  });

  it('rejects oversized ringtone files', async () => {
    const user = await createTestUser(prisma, {
      username: 'ringtonehuge',
      email: 'ringtonehuge@test.local',
      password: 'VeryStrongPass123',
      displayName: 'Huge Ringtone',
    });

    const cookies = await loginAs(app, user.username, 'VeryStrongPass123');
    const maxBytes = Number(process.env.MAX_RINGTONE_MB) * 1024 * 1024;
    const oversizedBuffer = Buffer.alloc(maxBytes + 1, 0);

    oversizedBuffer.write('RIFF', 0, 'ascii');
    oversizedBuffer.write('WAVE', 8, 'ascii');

    const response = await request(httpServer)
      .post('/v1/users/me/ringtone')
      .set('Cookie', cookies)
      .attach('file', oversizedBuffer, {
        filename: 'oversized.wav',
        contentType: 'audio/wav',
      })
      .expect(400);

    expect(String(response.body?.error?.message ?? response.body?.message ?? '')).toContain(
      'Максимальный размер',
    );
  });
});
