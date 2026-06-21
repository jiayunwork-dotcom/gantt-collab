'use client';

import React from 'react';
import clsx from 'clsx';
import {
  Task,
  BaselineTask,
  ZoomLevel,
  dateToX,
  getColumnWidth,
  Priority,
} from './utils';

const priorityColors: Record<Priority, string> = {
  critical: '#EF4444',
  urgent: '#DC2626',
  high: '#F59E0B',
  medium: '#3B82F6',
  low: '#6B7280',
};

interface TaskBarProps {
  task: Task;
  rowTop: number;
  columnWidth: number;
  viewStart: Date;
  zoomLevel: ZoomLevel;
  isLocked: boolean;
  lockUser?: { name: string; color: string } | null;
  isSelected: boolean;
  isCritical: boolean;
  hasDragConflict?: boolean;
  onMouseDown: (e: React.MouseEvent, action: 'move' | 'resize-start' | 'resize-end') => void;
  onClick: (e: React.MouseEvent) => void;
  baselineTask?: BaselineTask;
}

export const TaskBar: React.FC<TaskBarProps> = ({
  task,
  rowTop,
  columnWidth,
  viewStart,
  zoomLevel,
  isLocked,
  lockUser,
  isSelected,
  isCritical,
  hasDragConflict,
  onMouseDown,
  onClick,
  baselineTask,
}) => {
  const effectiveColWidth = columnWidth || getColumnWidth(zoomLevel);
  const left = dateToX(task.startDate, viewStart, effectiveColWidth, zoomLevel);
  const right = dateToX(task.endDate, viewStart, effectiveColWidth, zoomLevel);
  const width = Math.max(right - left, effectiveColWidth * 0.5);
  const barHeight = 28;
  const top = rowTop + (48 - barHeight) / 2;

  const renderBaseline = () => {
    if (!baselineTask) return null;
    const bLeft = dateToX(baselineTask.startDate, viewStart, effectiveColWidth, zoomLevel);
    const bRight = dateToX(baselineTask.endDate, viewStart, effectiveColWidth, zoomLevel);
    const bWidth = Math.max(bRight - bLeft, effectiveColWidth * 0.5);

    return (
      <div
        className="absolute rounded border-2 border-dashed border-gray-400 bg-gray-200 opacity-60 pointer-events-none"
        style={{
          left: bLeft,
          top: top + 2,
          width: bWidth,
          height: barHeight - 4,
        }}
      />
    );
  };

  const renderFloat = () => {
    if (isCritical || task.float <= 0) return null;
    const floatWidth = task.float * effectiveColWidth;
    return (
      <div
        className="absolute rounded bg-yellow-200 opacity-50 pointer-events-none"
        style={{
          left: left + width,
          top: top + 8,
          width: Math.max(floatWidth, 4),
          height: barHeight - 16,
        }}
      />
    );
  };

  if (task.isMilestone) {
    const size = 20;
    const mTop = rowTop + (48 - size) / 2;
    const color = priorityColors[task.priority];

    return (
      <>
        {renderBaseline()}
        <div
          className={clsx(
            'absolute cursor-pointer transition-transform hover:scale-110',
            isSelected && 'z-20'
          )}
          style={{
            left: left - size / 2,
            top: mTop,
            width: size,
            height: size,
          }}
          onMouseDown={(e) => onMouseDown(e, 'move')}
          onClick={onClick}
        >
          <svg width={size} height={size} viewBox="0 0 20 20">
            <polygon
              points="10,0 20,10 10,20 0,10"
              fill={color}
              stroke={isSelected ? '#1E40AF' : isLocked ? (lockUser?.color || '#EF4444') : '#1F2937'}
              strokeWidth={isSelected ? 3 : 2}
            />
          </svg>
          {isLocked && lockUser && (
            <div
              className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs px-1.5 py-0.5 rounded text-white whitespace-nowrap"
              style={{ backgroundColor: lockUser.color }}
            >
              {lockUser.name}
            </div>
          )}
        </div>
      </>
    );
  }

  const baseBgColor = priorityColors[task.priority];
  const bgColor = isCritical ? '#EF4444' : baseBgColor;

  return (
    <>
      {renderBaseline()}
      {renderFloat()}
      <div
        className={clsx(
          'absolute rounded-md shadow-sm cursor-move group transition-all',
          isSelected && 'ring-2 ring-blue-600 ring-offset-1 z-20',
          isLocked && 'ring-2 z-10',
          hasDragConflict && 'ring-2 ring-red-600 z-20 animate-pulse'
        )}
        style={{
          left,
          top,
          width,
          height: barHeight,
          backgroundColor: bgColor,
          border: hasDragConflict
            ? '2px solid #DC2626'
            : isCritical
            ? '2px solid #B91C1C'
            : '1px solid rgba(0,0,0,0.15)',
          // @ts-ignore
          '--tw-ring-color': isLocked ? (lockUser?.color || '#EF4444') : undefined,
        } as React.CSSProperties}
        onMouseDown={(e) => onMouseDown(e, 'move')}
        onClick={onClick}
      >
        <div
          className="absolute left-0 top-0 h-full bg-black bg-opacity-25 rounded-l-md transition-all"
          style={{ width: `${Math.min(task.progress, 100)}%` }}
        />

        <div className="relative z-10 h-full flex items-center px-2 text-xs text-white font-medium overflow-hidden whitespace-nowrap">
          {width > 80 && <span className="truncate">{task.name}</span>}
        </div>

        {!isLocked && (
          <>
            <div
              className="absolute left-0 top-0 w-2 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-black hover:bg-opacity-20 rounded-l-md z-20"
              onMouseDown={(e) => {
                e.stopPropagation();
                onMouseDown(e, 'resize-start');
              }}
            />
            <div
              className="absolute right-0 top-0 w-2 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-black hover:bg-opacity-20 rounded-r-md z-20"
              onMouseDown={(e) => {
                e.stopPropagation();
                onMouseDown(e, 'resize-end');
              }}
            />
          </>
        )}

        {isLocked && lockUser && (
          <div
            className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs px-1.5 py-0.5 rounded text-white whitespace-nowrap z-30"
            style={{ backgroundColor: lockUser.color }}
          >
            {lockUser.name}
          </div>
        )}
      </div>
    </>
  );
};

export default TaskBar;
