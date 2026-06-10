import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Injectable, Logger } from '@nestjs/common';
import { GatewayService } from './gateway.service';

@Injectable()
@WebSocketGateway({ cors: { origin: '*' } })
export class AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AppGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly gatewayService: GatewayService,
  ) {}

  afterInit(server: Server) {
    this.gatewayService.setServer(server);
    this.logger.log('WebSocket Gateway initialised');
  }

  handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} rejected — no token`);
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify(token);
      const tenantId: string = payload.tenantId;

      if (!tenantId) {
        this.logger.warn(`Client ${client.id} rejected — no tenantId in token`);
        client.disconnect(true);
        return;
      }

      // Attach tenant context to socket for later use
      (client as any).tenantId = tenantId;
      (client as any).userId = payload.userId;

      // Join tenant-scoped room
      client.join(`tenant:${tenantId}`);
      this.logger.log(
        `Client ${client.id} connected — joined tenant:${tenantId}`,
      );
    } catch (err) {
      this.logger.warn(`Client ${client.id} rejected — invalid token`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const tenantId = (client as any).tenantId;
    this.logger.log(
      `Client ${client.id} disconnected${tenantId ? ` (tenant:${tenantId})` : ''}`,
    );
  }
}
