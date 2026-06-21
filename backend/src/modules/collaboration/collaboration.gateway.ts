import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ForbiddenException } from '@nestjs/common';
import { CollaborationService, OnlineUser } from './collaboration.service';

interface ClientData {
  projectId: string;
  userId: string;
  socketId: string;
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  path: '/socket.io',
})
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private clients = new Map<string, ClientData>();
  private projectSubscriptions = new Map<string, () => void>();

  constructor(private readonly collabService: CollaborationService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');
      const projectId = client.handshake.query?.projectId as string;

      if (!token || !projectId) {
        client.disconnect(true);
        return;
      }

      const user = await this.collabService.getUserFromToken(token);
      if (!user) {
        client.disconnect(true);
        return;
      }

      const role = await this.collabService.checkProjectAccess(projectId, user.id);
      if (!role) {
        client.disconnect(true);
        return;
      }

      this.clients.set(client.id, { projectId, userId: user.id, socketId: client.id });
      await this.collabService.addOnlineUser(projectId, user, client.id);
      this.ensureProjectSubscription(projectId);
      const onlineUsers = await this.collabService.getOnlineUsers(projectId);
      client.emit('presence:list', onlineUsers);
      client.emit('connected', { userId: user.id, role, projectId });
    } catch (err) {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const data = this.clients.get(client.id);
    if (data) {
      await this.collabService.removeOnlineUser(data.projectId, client.id);
      this.clients.delete(client.id);
    }
  }

  private ensureProjectSubscription(projectId: string) {
    if (this.projectSubscriptions.has(projectId)) return;
    const unsubscribe = this.collabService.subscribe(projectId, (event, data) => {
      if (event === 'op' && data.excludeSocketId) {
        this.server.to(projectId).except(data.excludeSocketId).emit(event, data);
      } else {
        this.server.to(projectId).emit(event, data);
      }
    });
    this.projectSubscriptions.set(projectId, unsubscribe);
  }

  @SubscribeMessage('project:join')
  async handleProjectJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    client.join(data.projectId);
    return { success: true };
  }

  @SubscribeMessage('cursor:update')
  async handleCursorUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId?: string; x?: number; y?: number },
  ) {
    const info = this.clients.get(client.id);
    if (!info) return;
    await this.collabService.updateCursor(info.projectId, client.id, data);
  }

  @SubscribeMessage('task:lock')
  async handleTaskLock(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string },
  ) {
    const info = this.clients.get(client.id);
    if (!info) return { success: false };
    const user = await this.collabService.getUserFromToken(
      client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', ''),
    );
    if (!user) return { success: false };
    const result = await this.collabService.acquireTaskLock(
      info.projectId,
      data.taskId,
      user,
      client.id,
    );
    return result;
  }

  @SubscribeMessage('task:unlock')
  async handleTaskUnlock(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string },
  ) {
    const info = this.clients.get(client.id);
    if (!info) return;
    await this.collabService.releaseTaskLock(info.projectId, data.taskId, client.id);
  }

  @SubscribeMessage('task:update')
  async handleTaskUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string; changes: Record<string, any> },
  ) {
    const info = this.clients.get(client.id);
    if (!info) return;
    await this.collabService.broadcastOp(
      info.projectId,
      'task:update',
      data,
      info.userId,
      client.id,
    );
  }

  @SubscribeMessage('task:create')
  async handleTaskCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const info = this.clients.get(client.id);
    if (!info) return;
    await this.collabService.broadcastOp(
      info.projectId,
      'task:create',
      data,
      info.userId,
      client.id,
    );
  }

  @SubscribeMessage('task:delete')
  async handleTaskDelete(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string },
  ) {
    const info = this.clients.get(client.id);
    if (!info) return;
    await this.collabService.broadcastOp(
      info.projectId,
      'task:delete',
      data,
      info.userId,
      client.id,
    );
  }

  @SubscribeMessage('task:reorder')
  async handleTaskReorder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const info = this.clients.get(client.id);
    if (!info) return;
    await this.collabService.broadcastOp(
      info.projectId,
      'task:reorder',
      data,
      info.userId,
      client.id,
    );
  }

  @SubscribeMessage('dependency:create')
  async handleDependencyCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const info = this.clients.get(client.id);
    if (!info) return;
    await this.collabService.broadcastOp(
      info.projectId,
      'dependency:create',
      data,
      info.userId,
      client.id,
    );
  }

  @SubscribeMessage('dependency:delete')
  async handleDependencyDelete(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { dependencyId: string },
  ) {
    const info = this.clients.get(client.id);
    if (!info) return;
    await this.collabService.broadcastOp(
      info.projectId,
      'dependency:delete',
      data,
      info.userId,
      client.id,
    );
  }

  @SubscribeMessage('conflict:notify')
  async handleConflictNotify(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string; overriddenBy: string; overriddenByName: string },
  ) {
    const info = this.clients.get(client.id);
    if (!info) return;
    await this.collabService.broadcastConflict(
      info.projectId,
      data.taskId,
      data.overriddenBy,
      data.overriddenByName,
    );
  }
}
