export enum TaskPriority {
  urgent = 'urgent',
  high = 'high',
  medium = 'medium',
  low = 'low',
}

export enum DependencyType {
  FS = 'FS',
  FF = 'FF',
  SS = 'SS',
  SF = 'SF',
}

export enum CollaboratorRole {
  owner = 'owner',
  editor = 'editor',
  viewer = 'viewer',
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  cursorColor?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  parentId?: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  progress: number;
  priority: TaskPriority;
  tags: string[];
  assigneeId?: string;
  dailyHours: number;
  isMilestone: boolean;
  sortOrder: number;
  duration: number;
  earlyStart?: string;
  earlyFinish?: string;
  lateStart?: string;
  lateFinish?: string;
  totalFloat?: number;
}

export interface Dependency {
  id: string;
  projectId: string;
  sourceTaskId: string;
  targetTaskId: string;
  type: DependencyType;
  lag: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  startDate?: string;
  endDate?: string;
  collaborators?: Collaborator[];
}

export interface Collaborator {
  id: string;
  projectId: string;
  userId: string;
  role: CollaboratorRole;
  user?: User;
}

export interface Resource {
  id: string;
  projectId: string;
  name: string;
  role?: string;
  dailyCapacity: number;
  userId?: string;
}

export interface ResourceWorkload {
  resourceId: string;
  name: string;
  role: string;
  dailyCapacity: number;
  workloads: {
    date: string;
    hours: number;
    isOverloaded: boolean;
  }[];
}

export interface Baseline {
  id: string;
  projectId: string;
  name: string;
  version: number;
  snapshot: {
    tasks: Task[];
    dependencies: Dependency[];
  };
  createdAt: string;
}

export interface OnlineUser {
  userId: string;
  name: string;
  cursorColor: string;
  socketId: string;
  editingTaskId?: string;
}

export interface TaskLock {
  taskId: string;
  userId: string;
  userName: string;
  lockedAt: string;
  socketId: string;
}

export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter';

export enum ActionType {
  task_create = 'task_create',
  task_delete = 'task_delete',
  task_update = 'task_update',
  task_move = 'task_move',
  dependency_create = 'dependency_create',
  dependency_delete = 'dependency_delete',
  collaborator_add = 'collaborator_add',
  collaborator_remove = 'collaborator_remove',
  collaborator_role_change = 'collaborator_role_change',
  baseline_create = 'baseline_create',
  baseline_delete = 'baseline_delete',
}

export enum TargetType {
  task = 'task',
  dependency = 'dependency',
  collaborator = 'collaborator',
  baseline = 'baseline',
}

export interface ActivityLogUser {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  cursorColor?: string;
}

export interface ActivityLog {
  id: string;
  projectId: string;
  userId: string;
  user?: ActivityLogUser;
  actionType: ActionType;
  targetType: TargetType;
  targetId: string;
  changes: Record<string, { old: any; new: any }> | Record<string, any>;
  createdAt: string;
}

export interface PaginatedActivityLogs {
  items: ActivityLog[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
