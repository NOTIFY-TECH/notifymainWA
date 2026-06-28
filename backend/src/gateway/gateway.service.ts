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

  // ── Reaction event ────────────────────────────────────────────────────────
  // Emitted when a reaction is added or removed on a message.
  // payload.reactions is the full updated reactions map for that message:
  // { [emoji]: senderJid[] }  — frontend replaces the message's reactions
  // in cache rather than trying to diff individual emoji changes.

  emitMessageReaction(
    tenantId: string,
    payload: {
      messageId: string;
      conversationId: string;
      reactions: Record<string, string[]>;
    },
  ) {
    if (!this.server) return;
    this.server.to(`tenant:${tenantId}`).emit('message:reaction', payload);
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

  // ── Decrypt-failure event ─────────────────────────────────────────────────
  // Emitted when the engine receives a message it cannot decrypt (Baileys
  // messageStubType === 2 / CIPHERTEXT). The content is unrecoverable — this
  // event is visibility-only so the frontend can show a placeholder bubble
  // ("Message could not be decrypted") instead of a blank gap in the thread.
  // payload.conversationId may be null if no matching conversation exists yet.

  emitMessageDecryptFailed(
    tenantId: string,
    payload: {
      sessionId: string;
      fromNumber: string;
      conversationId: string | null;
      timestamp: number;
    },
  ) {
    if (!this.server) return;
    this.server
      .to(`tenant:${tenantId}`)
      .emit('message:decrypt_failed', payload);
  }
}
