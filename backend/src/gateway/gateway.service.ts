import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class GatewayService {
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  emitMessageReceived(tenantId: string, payload: any) {
    if (!this.server) return;
    this.server.to(`tenant:${tenantId}`).emit('message:received', payload);
  }

  emitSessionStatus(
    tenantId: string,
    payload: { sessionId: string; status: string },
  ) {
    if (!this.server) return;
    this.server.to(`tenant:${tenantId}`).emit('session:status', payload);
  }
}
