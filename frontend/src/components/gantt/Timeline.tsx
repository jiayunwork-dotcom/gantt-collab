'use client';

import React, { useMemo } from 'react';
import {
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  eachQuarterOfInterval,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameQuarter,
  isSameYear,
} from 'date-fns';
import {
  ZoomLevel,
  getColumnWidth,
  formatDate,
  formatTopHeader,
  daysBetween,
} from './utils';
import clsx from 'clsx';

interface TimelineProps {
  zoomLevel: ZoomLevel;
  viewStart: Date;
  viewEnd: Date;
  columnWidth: number;
  onZoomChange: (zoom: ZoomLevel) => void;
}

const zoomOptions: { level: ZoomLevel; label: string }[] = [
  { level: 'day', label: '日' },
  { level: 'week', label: '周' },
  { level: 'month', label: '月' },
  { level: 'quarter', label: '季' },
];

export const Timeline: React.FC<TimelineProps> = ({
  zoomLevel,
  viewStart,
  viewEnd,
  onZoomChange,
}) => {
  const columnWidth = getColumnWidth(zoomLevel);

  const { bottomColumns, topGroups } = useMemo(() => {
    let bottomCols: Date[] = [];
    switch (zoomLevel) {
      case 'day':
        bottomCols = eachDayOfInterval({ start: viewStart, end: viewEnd });
        break;
      case 'week':
        bottomCols = eachWeekOfInterval(
          { start: viewStart, end: viewEnd },
          { weekStartsOn: 1 }
        );
        break;
      case 'month':
        bottomCols = eachMonthOfInterval({ start: viewStart, end: viewEnd });
        break;
      case 'quarter':
        bottomCols = eachQuarterOfInterval({ start: viewStart, end: viewEnd });
        break;
    }

    const groups: { date: Date; span: number }[] = [];
    let currentGroup: { date: Date; count: number } | null = null;

    bottomCols.forEach((col) => {
      let groupDate: Date;
      let sameGroup: (a: Date, b: Date) => boolean;

      if (zoomLevel === 'day' || zoomLevel === 'week') {
        groupDate = startOfMonth(col);
        sameGroup = isSameMonth;
      } else {
        groupDate = startOfQuarter(col);
        sameGroup = isSameQuarter;
      }

      if (!currentGroup || !sameGroup(currentGroup.date, col)) {
        if (currentGroup) {
          groups.push({ date: currentGroup.date, span: currentGroup.count });
        }
        currentGroup = { date: groupDate, count: 1 };
      } else {
        currentGroup.count++;
      }
    });

    if (currentGroup) {
      groups.push({ date: currentGroup.date, span: currentGroup.count });
    }

    return { bottomColumns: bottomCols, topGroups: groups };
  }, [zoomLevel, viewStart, viewEnd]);

  const totalWidth = bottomColumns.length * columnWidth;

  return (
    <div className="border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <div className="flex gap-1">
          {zoomOptions.map((opt) => (
            <button
              key={opt.level}
              onClick={() => onZoomChange(opt.level)}
              className={clsx(
                'px-3 py-1 text-sm rounded-md transition-colors',
                zoomLevel === opt.level
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative overflow-hidden" style={{ height: 64 }}>
        <div style={{ width: totalWidth }}>
          <div
            className="flex border-b border-gray-200"
            style={{ height: 32 }}
          >
            {topGroups.map((group, idx) => {
              const isYearBoundary =
                idx === 0 ||
                !isSameYear(topGroups[idx - 1].date, group.date);
              return (
                <div
                  key={`top-${idx}`}
                  className={clsx(
                    'flex items-center px-2 text-xs font-semibold text-gray-600 border-r border-gray-200 h-full',
                    isYearBoundary && 'bg-gray-100'
                  )}
                  style={{ width: group.span * columnWidth }}
                >
                  {formatTopHeader(group.date, zoomLevel)}
                </div>
              );
            })}
          </div>

          <div className="flex" style={{ height: 32 }}>
            {bottomColumns.map((col, idx) => {
              const isWeekend =
                zoomLevel === 'day' && (col.getDay() === 0 || col.getDay() === 6);
              return (
                <div
                  key={`bot-${idx}`}
                  className={clsx(
                    'flex items-center justify-center text-xs text-gray-500 border-r border-gray-200 h-full',
                    isWeekend && 'bg-gray-100'
                  )}
                  style={{ width: columnWidth }}
                >
                  {formatDate(col, zoomLevel)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
