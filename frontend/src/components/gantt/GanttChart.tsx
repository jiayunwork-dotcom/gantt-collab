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

interface DependencyConflict {
  taskId: string;
  message: string;
}

function checkDependencyConflicts(
  taskId: string,
  newStart: Date,
  newEnd: Date,
  tasks: Task[],
  dependencies: Dependency[]
): DependencyConflict[] {
  const conflicts: DependencyConflict[] = [];
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  const preds = dependencies.filter((d) => d.targetId === taskId);
  for (const dep of preds) {
    const pred = taskMap.get(dep.sourceId);
    if (!pred) continue;
    const lagDays = dep.lag || 0;

    switch (dep.type) {
      case 'FS': {
        const constraint = addDays(pred.endDate, lagDays);
        if (newStart < constraint) {
          const predName = pred.name;
          conflicts.push({
            taskId: dep.sourceId,
            message: `前置任务「${predName}」未完成(FS约束)：需在 ${pred.endDate.toLocaleDateString()} 之后开始`,
          });
        }
        break;
      }
      case 'FF': {
        const constraint = addDays(pred.endDate, lagDays);
        if (newEnd < constraint) {
          const predName = pred.name;
          conflicts.push({
            taskId: dep.sourceId,
            message: `前置任务「${predName}」未完成(FF约束)：需在 ${pred.endDate.toLocaleDateString()} 之后结束`,
          });
        }
        break;
      }
      case 'SS': {
        const constraint = addDays(pred.startDate, lagDays);
        if (newStart < constraint) {
          const predName = pred.name;
          conflicts.push({
            taskId: dep.sourceId,
            message: `前置任务「${predName}」未开始(SS约束)：需在 ${pred.startDate.toLocaleDateString()} 之后开始`,
          });
        }
        break;
      }
      case 'SF': {
        const constraint = addDays(pred.startDate, lagDays);
        if (newEnd < constraint) {
          const predName = pred.name;
          conflicts.push({
            taskId: dep.sourceId,
            message: `前置任务「${predName}」未开始(SF约束)：需在 ${pred.startDate.toLocaleDateString()} 之后结束`,
          });
        }
        break;
      }
    }
  }

  const succs = dependencies.filter((d) => d.sourceId === taskId);
  for (const dep of succs) {
    const succ = taskMap.get(dep.targetId);
    if (!succ) continue;
    const lagDays = dep.lag || 0;

    switch (dep.type) {
      case 'FS': {
        const earliestSuccStart = addDays(newEnd, lagDays);
        if (succ.startDate < earliestSuccStart) {
          const succName = succ.name;
          conflicts.push({
            taskId: dep.targetId,
            message: `后继任务「${succName}」将违反FS约束：其开始日期 ${succ.startDate.toLocaleDateString()} 早于新结束日期`,
          });
        }
        break;
      }
      case 'FF': {
        const earliestSuccFinish = addDays(newEnd, lagDays);
        if (succ.endDate < earliestSuccFinish) {
          const succName = succ.name;
          conflicts.push({
            taskId: dep.targetId,
            message: `后继任务「${succName}」将违反FF约束：其结束日期 ${succ.endDate.toLocaleDateString()} 早于新结束日期`,
          });
        }
        break;
      }
      case 'SS': {
        const earliestSuccStart = addDays(newStart, lagDays);
        if (succ.startDate < earliestSuccStart) {
          const succName = succ.name;
          conflicts.push({
            taskId: dep.targetId,
            message: `后继任务「${succName}」将违反SS约束：其开始日期 ${succ.startDate.toLocaleDateString()} 早于新开始日期`,
          });
        }
        break;
      }
      case 'SF': {
        const earliestSuccFinish = addDays(newStart, lagDays);
        if (succ.endDate < earliestSuccFinish) {
          const succName = succ.name;
          conflicts.push({
            taskId: dep.targetId,
            message: `后继任务「${succName}」将违反SF约束：其结束日期 ${succ.endDate.toLocaleDateString()} 早于新开始日期`,
          });
        }
        break;
      }
    }
  }

  return conflicts;
}

interface DragConflictInfo {
  taskId: string;
  conflicts: DependencyConflict[];
  mouseX: number;
  mouseY: number;
}

interface ConfirmDialogData {
  taskId: string;
  conflicts: DependencyConflict[];
  pendingStart: Date;
  pendingEnd: Date;
  pendingDuration: number;
  originalStart: Date;
  originalEnd: Date;
}

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

  const [dragConflict, setDragConflict] = useState<DragConflictInfo | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogData | null>(null);

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

      if (daysDelta === 0) {
        setDragConflict(null);
        return;
      }

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

      const conflicts = checkDependencyConflicts(
        dragState.taskId,
        newStart,
        newEnd,
        tasks,
        dependencies
      );

      if (conflicts.length > 0) {
        setDragConflict({
          taskId: dragState.taskId,
          conflicts,
          mouseX: e.clientX,
          mouseY: e.clientY,
        });
      } else {
        setDragConflict(null);
      }

      onTaskUpdate?.(task.id, {
        startDate: newStart,
        endDate: newEnd,
        duration: newDuration,
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (dragState && dragConflict) {
        const task = tasks.find((t) => t.id === dragState.taskId);
        if (task) {
          setConfirmDialog({
            taskId: dragState.taskId,
            conflicts: dragConflict.conflicts,
            pendingStart: task.startDate,
            pendingEnd: task.endDate,
            pendingDuration: task.duration,
            originalStart: dragState.originalStart,
            originalEnd: dragState.originalEnd,
          });
        }
        setDragState(null);
        setDragConflict(null);
        return;
      }
      setDragState(null);
      setDragConflict(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, dragConflict, tasks, dependencies, zoomLevel, columnWidth, onTaskUpdate]);

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
                  hasDragConflict={dragConflict?.taskId === task.id}
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

      {dragConflict && (
        <div
          className="fixed z-[9999] pointer-events-none bg-red-900 text-white text-xs rounded-md px-3 py-2 shadow-lg max-w-xs"
          style={{
            left: dragConflict.mouseX + 16,
            top: dragConflict.mouseY + 16,
          }}
        >
          <div className="font-semibold text-red-200 mb-1">⚠ 依赖冲突</div>
          {dragConflict.conflicts.map((c, i) => (
            <div key={i} className="text-red-100 leading-relaxed">
              {c.message}
            </div>
          ))}
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">依赖冲突</h3>
                  <p className="text-sm text-gray-500">移动后违反以下依赖约束</p>
                </div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 space-y-1.5 max-h-40 overflow-y-auto">
                {confirmDialog.conflicts.map((c, i) => (
                  <div key={i} className="text-sm text-red-700 leading-relaxed">
                    • {c.message}
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600 mb-5">
                强制移动将允许日期重叠但不改变依赖关系，取消将还原到拖拽前的位置。
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    onTaskUpdate?.(confirmDialog.taskId, {
                      startDate: confirmDialog.pendingStart,
                      endDate: confirmDialog.pendingEnd,
                      duration: confirmDialog.pendingDuration,
                    });
                    setConfirmDialog(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
                >
                  强制移动
                </button>
                <button
                  onClick={() => {
                    onTaskUpdate?.(confirmDialog.taskId, {
                      startDate: confirmDialog.originalStart,
                      endDate: confirmDialog.originalEnd,
                      duration: daysBetween(confirmDialog.originalStart, confirmDialog.originalEnd) + 1,
                    });
                    setConfirmDialog(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GanttChart;
