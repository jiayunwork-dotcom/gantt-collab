'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import clsx from 'clsx';
import {
  Task,
  Dependency,
  ZoomLevel,
  TaskLock,
  OnlineUser,
  Baseline,
  getColumnWidth,
  getTaskRowY,
  addDays,
  daysBetween,
  dateToX,
  xToDate,
} from './utils';
import Timeline from './Timeline';
import TaskBar from './TaskBar';
import DependencyLines from './DependencyLines';

interface GanttChartProps {
  tasks: Task[];
  dependencies: Dependency[];
  zoomLevel: ZoomLevel;
  taskLocks: TaskLock[];
  onlineUsers: OnlineUser[];
  activeBaseline?: Baseline | null;
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
  onTaskSelect?: (taskId: string | null) => void;
  onDependencyCreate?: (sourceId: string, targetId: string) => void;
  selectedTaskId?: string | null;
}

const ROW_HEIGHT = 48;
const TASK_LIST_WIDTH = 280;
const PADDING_DAYS = 7;

export const GanttChart: React.FC<GanttChartProps> = ({
  tasks,
  dependencies,
  zoomLevel,
  taskLocks,
  onlineUsers,
  activeBaseline,
  onTaskUpdate,
  onTaskSelect,
  onDependencyCreate,
  selectedTaskId,
}) => {
  const columnWidth = getColumnWidth(zoomLevel);

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const rightHeaderRef = useRef<HTMLDivElement>(null);

  const [dragState, setDragState] = useState<{
    taskId: string;
    action: 'move' | 'resize-start' | 'resize-end';
    startX: number;
    originalStart: Date;
    originalEnd: Date;
  } | null>(null);

  const { viewStart, viewEnd } = useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date();
      return {
        viewStart: addDays(today, -PADDING_DAYS),
        viewEnd: addDays(today, PADDING_DAYS * 2),
      };
    }

    let minDate = tasks[0].startDate;
    let maxDate = tasks[0].endDate;

    tasks.forEach((t) => {
      if (t.startDate < minDate) minDate = t.startDate;
      if (t.endDate > maxDate) maxDate = t.endDate;
    });

    return {
      viewStart: addDays(minDate, -PADDING_DAYS),
      viewEnd: addDays(maxDate, PADDING_DAYS),
    };
  }, [tasks]);

  const totalDays = daysBetween(viewStart, viewEnd) + 1;
  const totalWidth = useMemo(() => {
    switch (zoomLevel) {
      case 'day':
        return totalDays * columnWidth;
      case 'week':
        return Math.ceil(totalDays / 7) * columnWidth;
      case 'month':
        return Math.ceil(totalDays / 30) * columnWidth;
      case 'quarter':
        return Math.ceil(totalDays / 90) * columnWidth;
    }
  }, [totalDays, columnWidth, zoomLevel]);

  const handleSyncScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target === rightPanelRef.current) {
      if (leftPanelRef.current) {
        leftPanelRef.current.scrollTop = target.scrollTop;
      }
      if (rightHeaderRef.current) {
        rightHeaderRef.current.scrollLeft = target.scrollLeft;
      }
    } else if (target === leftPanelRef.current) {
      if (rightPanelRef.current) {
        rightPanelRef.current.scrollTop = target.scrollTop;
      }
    }
  }, []);

  const handleTaskMouseDown = useCallback(
    (
      task: Task,
      e: React.MouseEvent,
      action: 'move' | 'resize-start' | 'resize-end'
    ) => {
      const lock = taskLocks.find((l) => l.taskId === task.id);
      if (lock) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      setDragState({
        taskId: task.id,
        action,
        startX: e.clientX,
        originalStart: new Date(task.startDate),
        originalEnd: new Date(task.endDate),
      });
    },
    [taskLocks]
  );

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState) return;

      const task = tasks.find((t) => t.id === dragState.taskId);
      if (!task) return;

      const dx = e.clientX - dragState.startX;
      let daysDelta: number;

      switch (zoomLevel) {
        case 'day':
          daysDelta = Math.round(dx / columnWidth);
          break;
        case 'week':
          daysDelta = Math.round((dx / columnWidth) * 7);
          break;
        case 'month':
          daysDelta = Math.round((dx / columnWidth) * 30);
          break;
        case 'quarter':
          daysDelta = Math.round((dx / columnWidth) * 90);
          break;
      }

      if (daysDelta === 0) return;

      let newStart = new Date(dragState.originalStart);
      let newEnd = new Date(dragState.originalEnd);

      if (dragState.action === 'move') {
        newStart = addDays(dragState.originalStart, daysDelta);
        newEnd = addDays(dragState.originalEnd, daysDelta);
      } else if (dragState.action === 'resize-start') {
        newStart = addDays(dragState.originalStart, daysDelta);
        if (newStart >= newEnd) {
          newStart = addDays(newEnd, -1);
        }
      } else if (dragState.action === 'resize-end') {
        newEnd = addDays(dragState.originalEnd, daysDelta);
        if (newEnd <= newStart) {
          newEnd = addDays(newStart, 1);
        }
      }

      const newDuration = daysBetween(newStart, newEnd) + 1;

      onTaskUpdate?.(task.id, {
        startDate: newStart,
        endDate: newEnd,
        duration: newDuration,
      });
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, tasks, zoomLevel, columnWidth, onTaskUpdate]);

  const renderGridBackground = () => {
    const rows = [];
    const cols = [];

    for (let i = 0; i < tasks.length; i++) {
      rows.push(
        <div
          key={`row-${i}`}
          className={clsx(
            'absolute left-0 right-0 border-b border-gray-100',
            i % 2 === 1 && 'bg-gray-50'
          )}
          style={{
            top: getTaskRowY(i, ROW_HEIGHT),
            height: ROW_HEIGHT,
          }}
        />
      );
    }

    let colCount: number;
    switch (zoomLevel) {
      case 'day':
        colCount = totalDays;
        break;
      case 'week':
        colCount = Math.ceil(totalDays / 7);
        break;
      case 'month':
        colCount = Math.ceil(totalDays / 30);
        break;
      case 'quarter':
        colCount = Math.ceil(totalDays / 90);
        break;
    }

    for (let i = 0; i < colCount; i++) {
      cols.push(
        <div
          key={`col-${i}`}
          className="absolute top-0 bottom-0 border-r border-gray-100"
          style={{
            left: i * columnWidth,
            width: columnWidth,
          }}
        />
      );
    }

    return (
      <>
        {rows}
        {cols}
      </>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="flex border-b border-gray-200 bg-gray-50">
        <div
          className="flex-shrink-0 border-r border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 flex items-center"
          style={{ width: TASK_LIST_WIDTH, height: 48 }}
        >
          任务名称
        </div>
        <div
          ref={rightHeaderRef}
          className="flex-1 overflow-x-auto"
          style={{ height: 48 }}
        >
          <Timeline
            zoomLevel={zoomLevel}
            viewStart={viewStart}
            viewEnd={viewEnd}
            columnWidth={columnWidth}
            onZoomChange={() => {}}
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          ref={leftPanelRef}
          className="flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-white"
          style={{ width: TASK_LIST_WIDTH }}
          onScroll={handleSyncScroll}
        >
          <div style={{ height: tasks.length * ROW_HEIGHT }}>
            {tasks.map((task, index) => {
              const lock = taskLocks.find((l) => l.taskId === task.id);
              const isSelected = selectedTaskId === task.id;
              return (
                <div
                  key={task.id}
                  className={clsx(
                    'flex items-center px-3 cursor-pointer border-b border-gray-100 transition-colors',
                    isSelected && 'bg-blue-50',
                    !isSelected && index % 2 === 1 && 'bg-gray-50/50',
                    'hover:bg-blue-50/50'
                  )}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => onTaskSelect?.(task.id)}
                >
                  {task.isMilestone && (
                    <div
                      className="w-3 h-3 rotate-45 mr-2 flex-shrink-0"
                      style={{
                        backgroundColor:
                          task.priority === 'critical'
                            ? '#EF4444'
                            : task.priority === 'urgent'
                            ? '#DC2626'
                            : task.priority === 'high'
                            ? '#F59E0B'
                            : task.priority === 'medium'
                            ? '#3B82F6'
                            : '#6B7280',
                      }}
                    />
                  )}
                  <span
                    className={clsx(
                      'text-sm truncate flex-1',
                      task.isCritical ? 'text-red-600 font-medium' : 'text-gray-800'
                    )}
                  >
                    {task.name}
                  </span>
                  {lock && (
                    <div
                      className="ml-2 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: lock.color }}
                      title={`${lock.userName} 正在编辑`}
                    >
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div
          ref={rightPanelRef}
          className="flex-1 overflow-auto relative"
          onScroll={handleSyncScroll}
        >
          <div
            className="relative"
            style={{
              width: totalWidth,
              height: tasks.length * ROW_HEIGHT,
            }}
          >
            {renderGridBackground()}

            <DependencyLines
              tasks={tasks}
              dependencies={dependencies}
              columnWidth={columnWidth}
              viewStart={viewStart}
              zoomLevel={zoomLevel}
              rowHeight={ROW_HEIGHT}
            />

            {tasks.map((task, index) => {
              const lock = taskLocks.find((l) => l.taskId === task.id);
              const lockUser = lock
                ? { name: lock.userName, color: lock.color }
                : null;
              const baselineTask = activeBaseline?.tasks[task.id];

              return (
                <TaskBar
                  key={task.id}
                  task={task}
                  rowTop={getTaskRowY(index, ROW_HEIGHT)}
                  columnWidth={columnWidth}
                  viewStart={viewStart}
                  zoomLevel={zoomLevel}
                  isLocked={!!lock}
                  lockUser={lockUser}
                  isSelected={selectedTaskId === task.id}
                  isCritical={task.isCritical}
                  onMouseDown={(e, action) => handleTaskMouseDown(task, e, action)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTaskSelect?.(task.id);
                  }}
                  baselineTask={baselineTask}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GanttChart;
