import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { SessionService } from '../../modules/auth/session.service';
import { EnvService } from '../../modules/env/env.service';

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  public constructor(
    private readonly sessionService: SessionService,
    private readonly envService: EnvService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookieName = this.envService.getValues().SESSION_COOKIE_NAME;
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const rawToken = cookies?.[cookieName];

    if (typeof rawToken !== 'string' || rawToken.length === 0) {
      throw new UnauthorizedException('Authentication required');
    }

    const resolvedSession = await this.sessionService.resolveSession(rawToken);

    if (!resolvedSession) {
      throw new UnauthorizedException('Session is invalid or expired');
    }

    request.authSession = {
      sessionId: resolvedSession.sessionId,
      userId: resolvedSession.user.id,
      rawToken,
    };
    request.currentUser = resolvedSession.user;

    return true;
  }
}
