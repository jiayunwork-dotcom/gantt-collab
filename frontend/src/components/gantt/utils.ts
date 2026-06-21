import {
  differenceInDays,
  addDays as dfnsAddDays,
  format,
  startOfDay,
} from 'date-fns';

export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter';

export type Priority = 'critical' | 'urgent' | 'high' | 'medium' | 'low';

export type DependencyType = 'FS' | 'FF' | 'SS' | 'SF';

export interface Task {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  duration: number;
  progress: number;
  priority: Priority;
  isMilestone: boolean;
  isCritical: boolean;
  float: number;
  assignee?: string;
  parentId?: string | null;
  children?: Task[];
}

export interface BaselineTask {
  startDate: Date;
  endDate: Date;
  duration: number;
}

export interface Dependency {
  id: string;
  sourceId: string;
  targetId: string;
  type: DependencyType;
  lag: number;
}

export interface TaskLock {
  taskId: string;
  userId: string;
  userName: string;
  color: string;
}

export interface OnlineUser {
  id: string;
  name: string;
  color: string;
  avatar?: string;
}

export interface Baseline {
  id: string;
  name: string;
  tasks: Record<string, BaselineTask>;
}

export const getColumnWidth = (zoomLevel: ZoomLevel): number => {
  switch (zoomLevel) {
    case 'day':
      return 30;
    case 'week':
      return 40;
    case 'month':
      return 60;
    case 'quarter':
      return 100;
  }
};

export const daysBetween = (a: Date, b: Date): number => {
  return differenceInDays(startOfDay(b), startOfDay(a));
};

export const addDays = (date: Date, n: number): Date => {
  return dfnsAddDays(date, n);
};

export const getTaskRowY = (taskIndex: number, rowHeight: number = 48): number => {
  return taskIndex * rowHeight;
};

export const dateToX = (
  date: Date,
  viewStart: Date,
  columnWidth: number,
  zoomLevel: ZoomLevel
): number => {
  const days = daysBetween(viewStart, date);
  switch (zoomLevel) {
    case 'day':
      return days * columnWidth;
    case 'week':
      return (days / 7) * columnWidth;
    case 'month':
      return (days / 30) * columnWidth;
    case 'quarter':
      return (days / 90) * columnWidth;
  }
};

export const xToDate = (
  x: number,
  viewStart: Date,
  columnWidth: number,
  zoomLevel: ZoomLevel
): Date => {
  let days: number;
  switch (zoomLevel) {
    case 'day':
      days = x / columnWidth;
      break;
    case 'week':
      days = (x / columnWidth) * 7;
      break;
    case 'month':
      days = (x / columnWidth) * 30;
      break;
    case 'quarter':
      days = (x / columnWidth) * 90;
      break;
  }
  return addDays(viewStart, Math.round(days));
};

export const formatDate = (date: Date, zoomLevel: ZoomLevel): string => {
  switch (zoomLevel) {
    case 'day':
      return format(date, 'd');
    case 'week':
      return format(date, 'MM/dd');
    case 'month':
      return format(date, 'MMM yyyy');
    case 'quarter': {
      const q = Math.floor(date.getMonth() / 3) + 1;
      return `Q${q} ${date.getFullYear()}`;
    }
  }
};

export const formatTopHeader = (date: Date, zoomLevel: ZoomLevel): string => {
  switch (zoomLevel) {
    case 'day':
    case 'week':
      return format(date, 'MMM yyyy');
    case 'month':
      return format(date, 'yyyy');
    case 'quarter':
      return format(date, 'yyyy');
  }
};
