import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { AuthenticatedGuard } from '../../common/guards/authenticated.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SessionExpiryProcessor } from '../queue/session-expiry.processor';
import { InvitesModule } from '../invites/invites.module';

@Global()
@Module({
  imports: [InvitesModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    AuthenticatedGuard,
    RolesGuard,
    SessionExpiryProcessor,
  ],
  exports: [AuthService, SessionService, AuthenticatedGuard, RolesGuard],
})
export class AuthModule {}
