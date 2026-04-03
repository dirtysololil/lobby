import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
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

  @Post('login')
  public async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const requestMetadata = getRequestMetadata(request);
    const result = await this.authService.login(body, requestMetadata);

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
      throw new UnauthorizedException('Authentication required');
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
