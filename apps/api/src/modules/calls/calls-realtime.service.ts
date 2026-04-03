import { Injectable } from '@nestjs/common';
import type { CallSignal, DmSignal } from '@lobby/shared';
import type { Server } from 'socket.io';

const CALL_SIGNAL_EVENT = 'calls.signal';
const DM_SIGNAL_EVENT = 'dm.signal';

@Injectable()
export class CallsRealtimeService {
  private server: Server | null = null;

  public attachServer(server: Server): void {
    this.server = server;
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
