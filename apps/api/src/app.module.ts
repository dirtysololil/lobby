import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { DirectMessagesModule } from './modules/direct-messages/direct-messages.module';
import { EnvModule } from './modules/env/env.module';
import { ForumModule } from './modules/forum/forum.module';
import { HealthModule } from './modules/health/health.module';
import { HubsModule } from './modules/hubs/hubs.module';
import { InvitesModule } from './modules/invites/invites.module';
import { CallsModule } from './modules/calls/calls.module';
import { QueueModule } from './modules/queue/queue.module';
import { RelationshipsModule } from './modules/relationships/relationships.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 60,
      },
    ]),
    EnvModule,
    DatabaseModule,
    QueueModule,
    AuditModule,
    UsersModule,
    InvitesModule,
    HubsModule,
    ForumModule,
    RelationshipsModule,
    AuthModule,
    DirectMessagesModule,
    CallsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
