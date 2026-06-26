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

  emitMessageOutgoingSynced(tenantId: string, payload: any) {
    if (!this.server) return;
    this.server
      .to(`tenant:${tenantId}`)
      .emit('message:outgoing_synced', payload);
  }

  emitSessionStatus(
    tenantId: string,
    payload: { sessionId: string; status: string },
  ) {
    if (!this.server) return;
    this.server.to(`tenant:${tenantId}`).emit('session:status', payload);
  }

  emitMessageAck(
    tenantId: string,
    payload: { messageId: string; externalId: string; status: string },
  ) {
    if (!this.server) return;
    this.server.to(`tenant:${tenantId}`).emit('message:ack', payload);
  }

  emitCampaignProgress(
    tenantId: string,
    payload: {
      campaignId: string;
      sentCount: number;
      deliveredCount: number;
      readCount: number;
      failedCount: number;
      totalContacts: number;
      status: string;
    },
  ) {
    if (!this.server) return;
    this.server.to(`tenant:${tenantId}`).emit('campaign:progress', payload);
  }

  // ── Chat sync lifecycle events ────────────────────────────────────────────
  // Emitted when a WhatsApp session connects and begins syncing the chat list
  // from the phone. The frontend uses these to show/hide a "Syncing…" banner
  // so users know their inbox is being populated and don't think it's broken.

  emitSessionSyncing(tenantId: string, payload: { sessionId: string }) {
    if (!this.server) return;
    this.server.to(`tenant:${tenantId}`).emit('session:syncing', payload);
  }

  emitSessionSyncComplete(
    tenantId: string,
    payload: { sessionId: string; conversationCount: number },
  ) {
    if (!this.server) return;
    this.server.to(`tenant:${tenantId}`).emit('session:sync_complete', payload);
  }
}
