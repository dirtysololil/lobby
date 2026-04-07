import {
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  authSessionResponseSchema,
  loginSchema,
  logoutResponseSchema,
  registerSchema,
  type LoginInput,
  type PublicUser,
  type RegisterInput,
} from '@lobby/shared';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAuth } from '../../common/decorators/require-auth.decorator';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { getRequestMetadata } from '../../common/utils/request-metadata.util';
import { EnvService } from '../env/env.service';
import { clearSessionCookie, setSessionCookie } from './auth-cookie.util';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  public constructor(
    private readonly authService: AuthService,
    private readonly envService: EnvService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  public async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const requestMetadata = getRequestMetadata(request);
    const result = await this.authService.register(body, requestMetadata);

    setSessionCookie(
      response,
      this.envService.getValues(),
      result.session.rawToken,
      result.session.expiresAt,
    );

    return authSessionResponseSchema.parse({
      user: result.user,
    });
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  public async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const requestMetadata = getRequestMetadata(request);
    console.info(
      `[auth/login] controller:start login=${body.login} ip=${requestMetadata.ipAddress ?? 'unknown'}`,
    );

    try {
      const result = await this.authService.login(body, requestMetadata);

      console.info(
        `[auth/login] controller:session_cookie:start userId=${result.user.id}`,
      );
      setSessionCookie(
        response,
        this.envService.getValues(),
        result.session.rawToken,
        result.session.expiresAt,
      );

      console.info(
        `[auth/login] success userId=${result.user.id} ip=${requestMetadata.ipAddress ?? 'unknown'}`,
      );

      return authSessionResponseSchema.parse({
        user: result.user,
      });
    } catch (error) {
      if (error instanceof HttpException) {
        console.warn(
          `[auth/login] controller:fail login=${body.login} status=${error.getStatus()}`,
        );
      } else {
        console.error(
          `[auth/login] controller:unexpected login=${body.login}`,
          error,
        );
      }

      throw error;
    }
  }

  @RequireAuth()
  @Get('me')
  public getSession(@CurrentUser() user: PublicUser) {
    return authSessionResponseSchema.parse({
      user,
    });
  }

  @RequireAuth()
  @Post('logout')
  public async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const currentUser = request.currentUser;
    const authSession = request.authSession;

    if (!currentUser || !authSession) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Требуется авторизация.',
      });
    }

    await this.authService.logout(
      currentUser.id,
      authSession.rawToken,
      getRequestMetadata(request),
    );
    clearSessionCookie(response, this.envService.getValues());

    return logoutResponseSchema.parse({
      ok: true,
    });
  }
}
