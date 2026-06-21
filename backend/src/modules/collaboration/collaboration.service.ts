import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT, REDIS_PUBSUB } from '../redis/redis.module';
import { Project } from '../../entities/project.entity';
import { Collaborator, CollaboratorRole } from '../../entities/collaborator.entity';
import { User } from '../../entities/user.entity';

export const PRESENCE_PREFIX = 'gantt:presence:';
export const LOCK_PREFIX = 'gantt:lock:';
export const CHANNEL_PREFIX = 'gantt:channel:';

export interface OnlineUser {
  userId: string;
  name: string;
  cursorColor: string;
  socketId: string;
  editingTaskId?: string;
  joinedAt: number;
}

export interface TaskLock {
  taskId: string;
  userId: string;
  userName: string;
  lockedAt: number;
  socketId: string;
}

@Injectable()
export class CollaborationService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(REDIS_PUBSUB) private readonly redisPubSub: Redis,
    private readonly jwtService: JwtService,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Collaborator)
    private readonly collaboratorRepo: Repository<Collaborator>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getUserFromToken(token: string): Promise<User | null> {
    try {
      const payload = this.jwtService.verify(token);
      if (!payload?.sub) return null;
      return await this.userRepo.findOne({ where: { id: payload.sub } });
    } catch {
      return null;
    }
  }

  async checkProjectAccess(projectId: string, userId: string): Promise<CollaboratorRole | null> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) return null;
    if (project.ownerId === userId) return CollaboratorRole.OWNER;
    const collab = await this.collaboratorRepo.findOne({
      where: { projectId, userId },
    });
    return collab?.role || null;
  }

  async addOnlineUser(projectId: string, user: User, socketId: string): Promise<void> {
    const key = PRESENCE_PREFIX + projectId;
    const onlineUser: OnlineUser = {
      userId: user.id,
      name: user.name,
      cursorColor: user.cursorColor || this.getRandomColor(),
      socketId,
      joinedAt: Date.now(),
    };
    await this.redis.hset(key, socketId, JSON.stringify(onlineUser));
    await this.redis.expire(key, 3600);
    await this.publish(projectId, 'user:join', onlineUser);
  }

  async removeOnlineUser(projectId: string, socketId: string): Promise<void> {
    const key = PRESENCE_PREFIX + projectId;
    const raw = await this.redis.hget(key, socketId);
    if (raw) {
      const user: OnlineUser = JSON.parse(raw);
      await this.redis.hdel(key, socketId);
      if (user.editingTaskId) {
        await this.releaseTaskLock(projectId, user.editingTaskId, socketId);
      }
      await this.publish(projectId, 'user:leave', { userId: user.userId, socketId });
    }
  }

  async getOnlineUsers(projectId: string): Promise<OnlineUser[]> {
    const key = PRESENCE_PREFIX + projectId;
    const entries = await this.redis.hgetall(key);
    return Object.values(entries).map((v) => JSON.parse(v) as OnlineUser);
  }

  async updateCursor(projectId: string, socketId: string, data: { taskId?: string; x?: number; y?: number }): Promise<void> {
    const key = PRESENCE_PREFIX + projectId;
    const raw = await this.redis.hget(key, socketId);
    if (raw) {
      const user: OnlineUser = JSON.parse(raw);
      await this.publish(projectId, 'cursor:update', { ...user, ...data });
    }
  }

  async acquireTaskLock(
    projectId: string,
    taskId: string,
    user: User,
    socketId: string,
  ): Promise<{ success: boolean; lock?: TaskLock; conflict?: TaskLock }> {
    const key = LOCK_PREFIX + projectId + ':' + taskId;
    const existingRaw = await this.redis.get(key);
    if (existingRaw) {
      const existing: TaskLock = JSON.parse(existingRaw);
      if (existing.socketId !== socketId) {
        return { success: false, conflict: existing };
      }
    }
    const lock: TaskLock = {
      taskId,
      userId: user.id,
      userName: user.name,
      lockedAt: Date.now(),
      socketId,
    };
    await this.redis.set(key, JSON.stringify(lock), 'EX', 300);
    const presenceKey = PRESENCE_PREFIX + projectId;
    const raw = await this.redis.hget(presenceKey, socketId);
    if (raw) {
      const onlineUser: OnlineUser = JSON.parse(raw);
      onlineUser.editingTaskId = taskId;
      await this.redis.hset(presenceKey, socketId, JSON.stringify(onlineUser));
    }
    await this.publish(projectId, 'task:lock', lock);
    return { success: true, lock };
  }

  async releaseTaskLock(projectId: string, taskId: string, socketId: string): Promise<void> {
    const key = LOCK_PREFIX + projectId + ':' + taskId;
    const existingRaw = await this.redis.get(key);
    if (existingRaw) {
      const existing: TaskLock = JSON.parse(existingRaw);
      if (existing.socketId === socketId) {
        await this.redis.del(key);
        const presenceKey = PRESENCE_PREFIX + projectId;
        const raw = await this.redis.hget(presenceKey, socketId);
        if (raw) {
          const onlineUser: OnlineUser = JSON.parse(raw);
          onlineUser.editingTaskId = undefined;
          await this.redis.hset(presenceKey, socketId, JSON.stringify(onlineUser));
        }
        await this.publish(projectId, 'task:unlock', { taskId, userId: existing.userId });
      }
    }
  }

  async broadcastOp(
    projectId: string,
    op: string,
    payload: any,
    userId: string,
    excludeSocketId?: string,
  ): Promise<void> {
    await this.publish(projectId, 'op', { op, payload, userId, excludeSocketId, ts: Date.now() });
  }

  async broadcastConflict(projectId: string, taskId: string, overriddenBy: string, overriddenByName: string): Promise<void> {
    await this.publish(projectId, 'conflict', {
      taskId,
      overriddenBy,
      overriddenByName,
      ts: Date.now(),
    });
  }

  private async publish(projectId: string, event: string, data: any): Promise<void> {
    const channel = CHANNEL_PREFIX + projectId;
    await this.redisPubSub.publish(channel, JSON.stringify({ event, data }));
  }

  subscribe(projectId: string, callback: (event: string, data: any) => void): () => void {
    const channel = CHANNEL_PREFIX + projectId;
    const listener = (ch: string, message: string) => {
      if (ch === channel) {
        try {
          const { event, data } = JSON.parse(message);
          callback(event, data);
        } catch {}
      }
    };
    this.redisPubSub.subscribe(channel);
    this.redisPubSub.on('message', listener);
    return () => {
      this.redisPubSub.unsubscribe(channel);
      this.redisPubSub.off('message', listener);
    };
  }

  private getRandomColor(): string {
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
