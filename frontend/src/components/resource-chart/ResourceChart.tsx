'use client';

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  eachDayOfInterval,
  eachWeekOfInterval,
  format,
  isWeekend,
  startOfWeek,
  endOfWeek,
  addDays,
  isWithinInterval,
} from 'date-fns';
import { ResourceWorkload } from '@/lib/types';

type ViewMode = 'day' | 'week';

interface ResourceChartProps {
  workload: ResourceWorkload[];
  viewStart: Date;
  viewEnd: Date;
}

interface HoveredBar {
  resourceId: string;
  label: string;
  x: number;
  y: number;
}

interface WeekBucket {
  weekStart: Date;
  weekEnd: Date;
  label: string;
}

export const ResourceChart: React.FC<ResourceChartProps> = ({
  workload,
  viewStart,
  viewEnd,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [hoveredBar, setHoveredBar] = useState<HoveredBar | null>(null);

  const days = useMemo(() => {
    return eachDayOfInterval({ start: viewStart, end: viewEnd });
  }, [viewStart, viewEnd]);

  const weeks = useMemo(() => {
    const weekStarts = eachWeekOfInterval(
      { start: viewStart, end: viewEnd },
      { weekStartsOn: 1 }
    );
    return weekStarts.map((ws) => {
      const we = endOfWeek(ws, { weekStartsOn: 1 });
      return {
        weekStart: ws,
        weekEnd: we,
        label: `${format(ws, 'MM/dd')}-${format(we, 'MM/dd')}`,
      };
    });
  }, [viewStart, viewEnd]);

  const dayWidth = 48;
  const weekWidth = 120;
  const resourceRowHeight = 64;
  const resourceLabelWidth = 180;
  const chartHeight = workload.length * resourceRowHeight;
  const headerHeight = 56;
  const colWidth = viewMode === 'day' ? dayWidth : weekWidth;
  const colCount = viewMode === 'day' ? days.length : weeks.length;
  const totalWidth = resourceLabelWidth + colCount * colWidth;
  const maxBarHeight = 40;

  const getBarHeight = (hours: number, capacity: number) => {
    const ratio = Math.min(hours / capacity, 2);
    return Math.max(ratio * maxBarHeight, hours > 0 ? 4 : 0);
  };

  const handleMouseEnter = (
    e: React.MouseEvent,
    resourceId: string,
    label: string
  ) => {
    setHoveredBar({
      resourceId,
      label,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleMouseLeave = () => {
    setHoveredBar(null);
  };

  const getWorkloadData = (rw: ResourceWorkload, dateStr: string) => {
    return rw.workloads.find((w) => w.date === dateStr);
  };

  const getWeekHours = (rw: ResourceWorkload, week: WeekBucket) => {
    let totalHours = 0;
    let workDays = 0;
    const current = new Date(week.weekStart);
    while (current <= week.weekEnd) {
      if (!isWeekend(current)) {
        workDays++;
      }
      const dateStr = format(current, 'yyyy-MM-dd');
      const wlData = getWorkloadData(rw, dateStr);
      totalHours += wlData?.hours || 0;
      current.setDate(current.getDate() + 1);
    }
    return { totalHours, workDays };
  };

  const hoveredData = hoveredBar
    ? (() => {
        const rw = workload.find((w) => w.resourceId === hoveredBar.resourceId);
        if (!rw) return null;

        if (viewMode === 'day') {
          const data = getWorkloadData(rw, hoveredBar.label);
          return { rw, hours: data?.hours || 0, isOverloaded: data?.isOverloaded || (data?.hours || 0) > rw.dailyCapacity, capacity: rw.dailyCapacity, capacityLabel: `${rw.dailyCapacity}h/天` };
        } else {
          const week = weeks.find((w) => w.label === hoveredBar.label);
          if (!week) return null;
          const { totalHours, workDays } = getWeekHours(rw, week);
          const weeklyCapacity = rw.dailyCapacity * 5;
          const isOverloaded = totalHours > weeklyCapacity;
          return { rw, hours: totalHours, isOverloaded, capacity: weeklyCapacity, capacityLabel: `${rw.dailyCapacity}h/天 × 5 = ${weeklyCapacity}h/周` };
        }
      })()
    : null;

  const renderDayView = () => (
    <>
      <div
        className="sticky top-0 bg-white border-b border-gray-200 z-10"
        style={{ height: headerHeight }}
      >
        <div className="flex h-full">
          <div
            className="flex items-center px-3 text-xs font-medium text-gray-500 border-r border-gray-200 bg-gray-50 shrink-0"
            style={{ width: resourceLabelWidth }}
          >
            资源
          </div>
          <div className="flex flex-1">
            {days.map((day, idx) => {
              const weekend = isWeekend(day);
              return (
                <div
                  key={idx}
                  className={clsx(
                    'flex flex-col items-center justify-center border-r border-gray-200 text-xs',
                    weekend && 'bg-gray-50'
                  )}
                  style={{ width: dayWidth }}
                >
                  <span className="text-gray-400 text-[10px]">
                    {format(day, 'MM')}月
                  </span>
                  <span
                    className={clsx(
                      'font-medium',
                      weekend ? 'text-red-400' : 'text-gray-600'
                    )}
                  >
                    {format(day, 'dd')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {workload.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-sm">暂无资源数据</p>
        </div>
      ) : (
        <div style={{ height: chartHeight }}>
          {workload.map((rw) => (
            <div
              key={rw.resourceId}
              className="flex border-b border-gray-100"
              style={{ height: resourceRowHeight }}
            >
              <div
                className="flex flex-col justify-center px-3 border-r border-gray-200 bg-gray-50 shrink-0"
                style={{ width: resourceLabelWidth }}
              >
                <span className="text-sm font-medium text-gray-700 truncate">
                  {rw.name}
                </span>
                <span className="text-xs text-gray-400">
                  {rw.role} · {rw.dailyCapacity}h/天
                </span>
              </div>
              <div className="flex flex-1 relative">
                {days.map((day, idx) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const wlData = getWorkloadData(rw, dateStr);
                  const hours = wlData?.hours || 0;
                  const isOverloaded = wlData?.isOverloaded || hours > rw.dailyCapacity;
                  const barHeight = getBarHeight(hours, rw.dailyCapacity);
                  const weekend = isWeekend(day);

                  return (
                    <div
                      key={idx}
                      className={clsx(
                        'flex items-end justify-center border-r border-gray-100 relative',
                        weekend && 'bg-gray-50/50'
                      )}
                      style={{ width: dayWidth }}
                      onMouseEnter={(e) => handleMouseEnter(e, rw.resourceId, dateStr)}
                      onMouseLeave={handleMouseLeave}
                    >
                      {hours > 0 && (
                        <div
                          className={clsx(
                            'w-6 rounded-t-sm transition-all',
                            isOverloaded ? 'bg-red-500' : 'bg-blue-500'
                          )}
                          style={{ height: barHeight }}
                        />
                      )}
                    </div>
                  );
                })}

                <div
                  className="absolute left-0 right-0 border-t border-dashed border-red-200 pointer-events-none"
                  style={{
                    bottom:
                      resourceRowHeight -
                      12 -
                      getBarHeight(rw.dailyCapacity, rw.dailyCapacity),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const renderWeekView = () => {
    const weeklyCapacityForLabel = (dc: number) => dc * 5;

    return (
      <>
        <div
          className="sticky top-0 bg-white border-b border-gray-200 z-10"
          style={{ height: headerHeight }}
        >
          <div className="flex h-full">
            <div
              className="flex items-center px-3 text-xs font-medium text-gray-500 border-r border-gray-200 bg-gray-50 shrink-0"
              style={{ width: resourceLabelWidth }}
            >
              资源
            </div>
            <div className="flex flex-1">
              {weeks.map((week, idx) => (
                <div
                  key={idx}
                  className="flex flex-col items-center justify-center border-r border-gray-200 text-xs"
                  style={{ width: weekWidth }}
                >
                  <span className="text-gray-400 text-[10px]">
                    {format(week.weekStart, 'MM')}月
                  </span>
                  <span className="font-medium text-gray-600">
                    {format(week.weekStart, 'dd')}-{format(week.weekEnd, 'dd')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {workload.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-sm">暂无资源数据</p>
          </div>
        ) : (
          <div style={{ height: chartHeight }}>
            {workload.map((rw) => {
              const weeklyCapacity = weeklyCapacityForLabel(rw.dailyCapacity);
              return (
                <div
                  key={rw.resourceId}
                  className="flex border-b border-gray-100"
                  style={{ height: resourceRowHeight }}
                >
                  <div
                    className="flex flex-col justify-center px-3 border-r border-gray-200 bg-gray-50 shrink-0"
                    style={{ width: resourceLabelWidth }}
                  >
                    <span className="text-sm font-medium text-gray-700 truncate">
                      {rw.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {rw.role} · {rw.dailyCapacity}h/天 · {weeklyCapacity}h/周
                    </span>
                  </div>
                  <div className="flex flex-1 relative">
                    {weeks.map((week, idx) => {
                      const { totalHours } = getWeekHours(rw, week);
                      const isOverloaded = totalHours > weeklyCapacity;
                      const barHeight = getBarHeight(totalHours, weeklyCapacity);

                      return (
                        <div
                          key={idx}
                          className="flex items-end justify-center border-r border-gray-100 relative"
                          style={{ width: weekWidth }}
                          onMouseEnter={(e) => handleMouseEnter(e, rw.resourceId, week.label)}
                          onMouseLeave={handleMouseLeave}
                        >
                          {totalHours > 0 && (
                            <div
                              className={clsx(
                                'w-10 rounded-t-sm transition-all',
                                isOverloaded ? 'bg-red-500' : 'bg-blue-500'
                              )}
                              style={{ height: barHeight }}
                            />
                          )}
                        </div>
                      );
                    })}

                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-red-200 pointer-events-none"
                      style={{
                        bottom:
                          resourceRowHeight -
                          12 -
                          getBarHeight(weeklyCapacity, weeklyCapacity),
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 flex-1">资源负载图</h3>
        <div className="flex items-center gap-3 mr-4">
          <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('day')}
              className={clsx(
                'px-3 py-1 text-xs font-medium transition-colors',
                viewMode === 'day'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              按天
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={clsx(
                'px-3 py-1 text-xs font-medium transition-colors border-l border-gray-300',
                viewMode === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              按周
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-sm" />
            <span>正常负载</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-sm" />
            <span>超载</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div style={{ width: totalWidth, minWidth: '100%' }}>
          {viewMode === 'day' ? renderDayView() : renderWeekView()}
        </div>
      </div>

      {hoveredData && hoveredBar && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900 text-white text-xs rounded-md px-3 py-2 shadow-lg"
          style={{
            left: hoveredBar.x + 12,
            top: hoveredBar.y + 12,
          }}
        >
          <div className="font-medium">{hoveredData.rw.name}</div>
          <div className="text-gray-300 mt-0.5">{hoveredBar.label}</div>
          <div
            className={clsx(
              'mt-1 font-medium',
              hoveredData.isOverloaded ? 'text-red-400' : 'text-blue-300'
            )}
          >
            {hoveredData.hours}h / {hoveredData.capacity}h
            {hoveredData.isOverloaded && ' (超载)'}
          </div>
          <div className="text-gray-400 mt-0.5 text-[10px]">
            容量标准：{hoveredData.capacityLabel}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceChart;
