import { io, Socket } from 'socket.io-client';
import type { Task, Dependency, OnlineUser, TaskLock, ActivityLog } from './types';

export const createSocket = (projectId: string, token: string): Socket => {
  return io(process.env.NEXT_PUBLIC_API_URL || '', {
    path: '/socket.io',
    auth: { token },
    query: { projectId },
    transports: ['websocket'],
  });
};

export const projectSocketEvents = {
  CONNECTED: 'connected',
  PRESENCE_LIST: 'presence:list',
  USER_JOIN: 'user:join',
  USER_LEAVE: 'user:leave',
  CURSOR_UPDATE: 'cursor:update',
  TASK_LOCK: 'task:lock',
  TASK_UNLOCK: 'task:unlock',
  OP: 'op',
  CONFLICT: 'conflict',
  PROJECT_JOIN: 'project:join',
  TASK_UPDATE: 'task:update',
  TASK_CREATE: 'task:create',
  TASK_DELETE: 'task:delete',
  TASK_REORDER: 'task:reorder',
  DEPENDENCY_CREATE: 'dependency:create',
  DEPENDENCY_DELETE: 'dependency:delete',
  CONFLICT_NOTIFY: 'conflict:notify',
  ACTIVITY_NEW: 'activity:new',
};

export interface OpMessage {
  op: string;
  payload: any;
  userId: string;
  excludeSocketId?: string;
  ts: number;
}

export interface SocketHandlers {
  onConnected?: (data: { userId: string; role: string; projectId: string }) => void;
  onPresenceList?: (users: OnlineUser[]) => void;
  onUserJoin?: (user: OnlineUser) => void;
  onUserLeave?: (data: { userId: string; socketId: string }) => void;
  onCursorUpdate?: (data: OnlineUser & { taskId?: string; x?: number; y?: number }) => void;
  onTaskLock?: (lock: TaskLock) => void;
  onTaskUnlock?: (data: { taskId: string; userId: string }) => void;
  onOp?: (msg: OpMessage) => void;
  onConflict?: (data: { taskId: string; overriddenBy: string; overriddenByName: string; ts: number }) => void;
  onActivityNew?: (log: ActivityLog) => void;
}

export const setupSocketListeners = (socket: Socket, handlers: SocketHandlers): (() => void) => {
  const events: Array<[string, (...args: any[]) => void]> = [];

  if (handlers.onConnected) {
    const h = handlers.onConnected;
    socket.on(projectSocketEvents.CONNECTED, h);
    events.push([projectSocketEvents.CONNECTED, h]);
  }
  if (handlers.onPresenceList) {
    const h = handlers.onPresenceList;
    socket.on(projectSocketEvents.PRESENCE_LIST, h);
    events.push([projectSocketEvents.PRESENCE_LIST, h]);
  }
  if (handlers.onUserJoin) {
    const h = handlers.onUserJoin;
    socket.on(projectSocketEvents.USER_JOIN, h);
    events.push([projectSocketEvents.USER_JOIN, h]);
  }
  if (handlers.onUserLeave) {
    const h = handlers.onUserLeave;
    socket.on(projectSocketEvents.USER_LEAVE, h);
    events.push([projectSocketEvents.USER_LEAVE, h]);
  }
  if (handlers.onCursorUpdate) {
    const h = handlers.onCursorUpdate;
    socket.on(projectSocketEvents.CURSOR_UPDATE, h);
    events.push([projectSocketEvents.CURSOR_UPDATE, h]);
  }
  if (handlers.onTaskLock) {
    const h = handlers.onTaskLock;
    socket.on(projectSocketEvents.TASK_LOCK, h);
    events.push([projectSocketEvents.TASK_LOCK, h]);
  }
  if (handlers.onTaskUnlock) {
    const h = handlers.onTaskUnlock;
    socket.on(projectSocketEvents.TASK_UNLOCK, h);
    events.push([projectSocketEvents.TASK_UNLOCK, h]);
  }
  if (handlers.onOp) {
    const h = handlers.onOp;
    socket.on(projectSocketEvents.OP, h);
    events.push([projectSocketEvents.OP, h]);
  }
  if (handlers.onConflict) {
    const h = handlers.onConflict;
    socket.on(projectSocketEvents.CONFLICT, h);
    events.push([projectSocketEvents.CONFLICT, h]);
  }
  if (handlers.onActivityNew) {
    const h = handlers.onActivityNew;
    socket.on(projectSocketEvents.ACTIVITY_NEW, h);
    events.push([projectSocketEvents.ACTIVITY_NEW, h]);
  }

  return () => {
    for (const [event, handler] of events) {
      socket.off(event, handler);
    }
  };
};

export const socketEmit = {
  joinProject: (socket: Socket, projectId: string) =>
    socket.emit(projectSocketEvents.PROJECT_JOIN, { projectId }),
  updateCursor: (socket: Socket, data: { taskId?: string; x?: number; y?: number }) =>
    socket.emit(projectSocketEvents.CURSOR_UPDATE, data),
  lockTask: (socket: Socket, taskId: string) =>
    socket.emit(projectSocketEvents.TASK_LOCK, { taskId }),
  unlockTask: (socket: Socket, taskId: string) =>
    socket.emit(projectSocketEvents.TASK_UNLOCK, { taskId }),
  updateTask: (socket: Socket, taskId: string, changes: Record<string, any>) =>
    socket.emit(projectSocketEvents.TASK_UPDATE, { taskId, changes }),
  createTask: (socket: Socket, data: any) =>
    socket.emit(projectSocketEvents.TASK_CREATE, data),
  deleteTask: (socket: Socket, taskId: string) =>
    socket.emit(projectSocketEvents.TASK_DELETE, { taskId }),
  reorderTask: (socket: Socket, data: any) =>
    socket.emit(projectSocketEvents.TASK_REORDER, data),
  createDependency: (socket: Socket, data: any) =>
    socket.emit(projectSocketEvents.DEPENDENCY_CREATE, data),
  deleteDependency: (socket: Socket, dependencyId: string) =>
    socket.emit(projectSocketEvents.DEPENDENCY_DELETE, { dependencyId }),
  notifyConflict: (socket: Socket, data: { taskId: string; overriddenBy: string; overriddenByName: string }) =>
    socket.emit(projectSocketEvents.CONFLICT_NOTIFY, data),
};
