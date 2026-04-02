import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  subscribeDmCallsSchema,
  subscribeLobbyCallsSchema,
  type PublicUser,
  type SubscribeDmCallsInput,
  type SubscribeLobbyCallsInput,
} from '@lobby/shared';
import { parse as parseCookieHeader } from 'cookie';
import type { Server, Socket } from 'socket.io';
import { SessionService } from '../auth/session.service';
import { CallsRealtimeService } from './calls-realtime.service';
import { CallsService } from './calls.service';

@WebSocketGateway({
  cors: {
    origin:
      process.env.REALTIME_CORS_ORIGIN ??
      process.env.WEB_PUBLIC_URL ??
      'http://localhost:3000',
    credentials: true,
  },
  path: process.env.REALTIME_PATH ?? '/socket.io',
})
export class CallsGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  public constructor(
    private readonly sessionService: SessionService,
    private readonly callsService: CallsService,
    private readonly realtimeService: CallsRealtimeService,
  ) {}

  public afterInit(server: Server): void {
    this.realtimeService.attachServer(server);
  }

  public async handleConnection(client: Socket): Promise<void> {
    const rawCookieHeader = client.handshake.headers.cookie;

    if (!rawCookieHeader) {
      client.disconnect();
      return;
    }

    const cookies = parseCookieHeader(rawCookieHeader);
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'lobby_session';
    const rawToken = cookies[cookieName];

    if (!rawToken) {
      client.disconnect();
      return;
    }

    const resolvedSession = await this.sessionService.resolveSession(rawToken);

    if (!resolvedSession) {
      client.disconnect();
      return;
    }

    (client.data as { currentUser?: PublicUser }).currentUser =
      resolvedSession.user;
    await client.join(
      this.realtimeService.getUserRoom(resolvedSession.user.id),
    );
  }

  @SubscribeMessage('calls.subscribe_dm')
  public async subscribeDm(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SubscribeDmCallsInput,
  ) {
    const parsed = subscribeDmCallsSchema.parse(body);
    const currentUser = (client.data as { currentUser?: PublicUser })
      .currentUser;

    if (!currentUser) {
      client.disconnect();
      return;
    }

    await this.callsService.assertDmConversationAccess(
      currentUser.id,
      parsed.conversationId,
    );
    await client.join(this.realtimeService.getDmRoom(parsed.conversationId));

    return { ok: true };
  }

  @SubscribeMessage('calls.subscribe_lobby')
  public async subscribeLobby(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SubscribeLobbyCallsInput,
  ) {
    const parsed = subscribeLobbyCallsSchema.parse(body);
    const currentUser = (client.data as { currentUser?: PublicUser })
      .currentUser;

    if (!currentUser) {
      client.disconnect();
      return;
    }

    await this.callsService.assertLobbyCallAccess(
      currentUser.id,
      parsed.hubId,
      parsed.lobbyId,
    );
    await client.join(this.realtimeService.getLobbyRoom(parsed.lobbyId));

    return { ok: true };
  }
}
