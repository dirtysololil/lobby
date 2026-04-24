import { Injectable } from '@nestjs/common';
import type {
  CallSignal,
  DmSignal,
  DmTypingSignal,
  PresenceSnapshot,
  PresenceUpdate,
} from '@lobby/shared';
import type { Server, Socket } from 'socket.io';

const CALL_SIGNAL_EVENT = 'calls.signal';
const DM_SIGNAL_EVENT = 'dm.signal';
const DM_TYPING_EVENT = 'dm.typing';
const PRESENCE_SNAPSHOT_EVENT = 'presence.snapshot';
const PRESENCE_UPDATE_EVENT = 'presence.updated';

@Injectable()
export class CallsRealtimeService {
  private server: Server | null = null;
  private readonly socketUserIds = new Map<string, string>();
  private readonly activeSocketsByUserId = new Map<string, Set<string>>();

  public attachServer(server: Server): void {
    this.server = server;
  }

  public registerPresence(client: Socket, userId: string): void {
    const currentUserId = this.socketUserIds.get(client.id);

    if (currentUserId === userId) {
      this.emitPresenceSnapshot(client);
      return;
    }

    if (currentUserId) {
      this.unregisterPresence(client.id);
    }

    const sockets = this.activeSocketsByUserId.get(userId) ?? new Set<string>();
    const wasOffline = sockets.size === 0;

    sockets.add(client.id);
    this.activeSocketsByUserId.set(userId, sockets);
    this.socketUserIds.set(client.id, userId);

    this.emitPresenceSnapshot(client);

    if (wasOffline) {
      this.emitPresenceUpdate({ userId, isOnline: true });
    }
  }

  public unregisterPresence(socketId: string): void {
    const userId = this.socketUserIds.get(socketId);

    if (!userId) {
      return;
    }

    this.socketUserIds.delete(socketId);

    const sockets = this.activeSocketsByUserId.get(userId);

    if (!sockets) {
      return;
    }

    sockets.delete(socketId);

    if (sockets.size > 0) {
      return;
    }

    this.activeSocketsByUserId.delete(userId);
    this.emitPresenceUpdate({ userId, isOnline: false });
  }

  public emitPresenceSnapshot(client: Socket): void {
    const payload: PresenceSnapshot = {
      onlineUserIds: [...this.activeSocketsByUserId.keys()],
    };

    client.emit(PRESENCE_SNAPSHOT_EVENT, payload);
  }

  public emitPresenceUpdate(payload: PresenceUpdate): void {
    this.server?.emit(PRESENCE_UPDATE_EVENT, payload);
  }

  public emitToUsers(userIds: string[], payload: CallSignal): void {
    if (!this.server) {
      return;
    }

    for (const userId of [...new Set(userIds)]) {
      this.server.to(this.getUserRoom(userId)).emit(CALL_SIGNAL_EVENT, payload);
    }
  }

  public emitDmSignalToUser(userId: string, payload: DmSignal): void {
    this.server?.to(this.getUserRoom(userId)).emit(DM_SIGNAL_EVENT, payload);
  }

  public emitToDm(conversationId: string, payload: CallSignal): void {
    this.server
      ?.to(this.getDmRoom(conversationId))
      .emit(CALL_SIGNAL_EVENT, payload);
  }

  public emitTypingToDm(
    conversationId: string,
    socketId: string,
    payload: DmTypingSignal,
  ): void {
    this.server
      ?.to(this.getDmRoom(conversationId))
      .except(socketId)
      .emit(DM_TYPING_EVENT, payload);
  }

  public emitToLobby(lobbyId: string, payload: CallSignal): void {
    this.server
      ?.to(this.getLobbyRoom(lobbyId))
      .emit(CALL_SIGNAL_EVENT, payload);
  }

  public getUserRoom(userId: string): string {
    return `user:${userId}`;
  }

  public getDmRoom(conversationId: string): string {
    return `calls:dm:${conversationId}`;
  }

  public getLobbyRoom(lobbyId: string): string {
    return `calls:lobby:${lobbyId}`;
  }
}
