import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
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
import { loadWorkspaceEnv } from '@lobby/config';
import { parse as parseCookieHeader } from 'cookie';
import type { Server, Socket } from 'socket.io';
import { SessionService } from '../auth/session.service';
import { CallsRealtimeService } from './calls-realtime.service';
import { CallsService } from './calls.service';

loadWorkspaceEnv();

type EngineTransport = {
  name: string;
};

type EngineConnectionError = Error & {
  code?: number | string;
  context?: unknown;
  req?: {
    headers?: Record<string, unknown>;
    method?: string;
    url?: string;
  };
  transport?: string;
};

function pickHandshakeHeaders(
  headers: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!headers) {
    return {};
  }

  const interestingHeaderKeys = [
    'origin',
    'host',
    'connection',
    'upgrade',
    'x-forwarded-for',
    'x-forwarded-proto',
    'x-forwarded-host',
    'sec-websocket-version',
    'sec-websocket-extensions',
    'sec-websocket-protocol',
    'user-agent',
  ];

  return interestingHeaderKeys.reduce<Record<string, unknown>>((result, key) => {
    if (headers[key] !== undefined) {
      result[key] = headers[key];
    }

    return result;
  }, {});
}

function getTransportName(client: Socket): string {
  return client.conn.transport.name;
}

@WebSocketGateway({
  cors: {
    origin: process.env.REALTIME_CORS_ORIGIN ?? process.env.WEB_PUBLIC_URL,
    credentials: true,
  },
  path: process.env.REALTIME_PATH,
})
export class CallsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  public constructor(
    private readonly sessionService: SessionService,
    private readonly callsService: CallsService,
    private readonly realtimeService: CallsRealtimeService,
  ) {}

  public afterInit(server: Server): void {
    this.realtimeService.attachServer(server);

    console.info('[realtime/server] gateway init', {
      path: server.path(),
      corsOrigin: process.env.REALTIME_CORS_ORIGIN ?? process.env.WEB_PUBLIC_URL,
    });

    server.engine.on('connection_error', (error: EngineConnectionError) => {
      console.error('[realtime/server] engine connection_error', {
        code: error.code,
        message: error.message,
        transport: error.transport,
        context: error.context,
        request: {
          method: error.req?.method,
          url: error.req?.url,
          headers: pickHandshakeHeaders(error.req?.headers),
        },
      });
    });
  }

  public async handleConnection(client: Socket): Promise<void> {
    client.conn.on('upgrade', (transport: EngineTransport) => {
      console.info('[realtime/server] transport upgrade', {
        socketId: client.id,
        transport: transport.name,
        userId: (client.data as { currentUser?: PublicUser }).currentUser?.id,
      });
    });
    client.on('disconnect', (reason: string, details: unknown) => {
      console.warn('[realtime/server] disconnect', {
        socketId: client.id,
        reason,
        details,
        transport: getTransportName(client),
        userId: (client.data as { currentUser?: PublicUser }).currentUser?.id,
      });
    });

    console.info('[realtime/server] connection opened', {
      socketId: client.id,
      initialTransport: getTransportName(client),
      path: client.handshake.url,
      headers: pickHandshakeHeaders(
        client.handshake.headers as Record<string, unknown> | undefined,
      ),
    });

    const rawCookieHeader = client.handshake.headers.cookie;

    if (!rawCookieHeader) {
      console.warn('[realtime/server] rejecting socket: missing cookie', {
        socketId: client.id,
        transport: getTransportName(client),
        headers: pickHandshakeHeaders(
          client.handshake.headers as Record<string, unknown> | undefined,
        ),
      });
      client.disconnect(true);
      return;
    }

    const cookies = parseCookieHeader(rawCookieHeader);
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'lobby_session';
    const rawToken = cookies[cookieName];

    if (!rawToken) {
      console.warn('[realtime/server] rejecting socket: missing session cookie', {
        socketId: client.id,
        cookieName,
        transport: getTransportName(client),
      });
      client.disconnect(true);
      return;
    }

    const resolvedSession = await this.sessionService.resolveSession(rawToken);

    if (!resolvedSession) {
      console.warn('[realtime/server] rejecting socket: invalid session', {
        socketId: client.id,
        cookieName,
        transport: getTransportName(client),
      });
      client.disconnect(true);
      return;
    }

    (client.data as { currentUser?: PublicUser }).currentUser =
      resolvedSession.user;
    console.info('[realtime/server] socket authenticated', {
      socketId: client.id,
      userId: resolvedSession.user.id,
      transport: getTransportName(client),
    });
    await client.join(
      this.realtimeService.getUserRoom(resolvedSession.user.id),
    );
  }

  public handleDisconnect(client: Socket): void {
    console.info('[realtime/server] handleDisconnect', {
      socketId: client.id,
      transport: getTransportName(client),
      userId: (client.data as { currentUser?: PublicUser }).currentUser?.id,
    });
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
