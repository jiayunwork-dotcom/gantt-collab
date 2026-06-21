'use client';

import React, { useMemo } from 'react';
import {
  Task,
  Dependency,
  DependencyType,
  ZoomLevel,
  dateToX,
  getColumnWidth,
  getTaskRowY,
} from './utils';

interface DependencyLinesProps {
  tasks: Task[];
  dependencies: Dependency[];
  columnWidth: number;
  viewStart: Date;
  zoomLevel: ZoomLevel;
  rowHeight: number;
}

const ARROW_MARKERS: Record<DependencyType, string> = {
  FS: 'arrow-fs',
  FF: 'arrow-ff',
  SS: 'arrow-ss',
  SF: 'arrow-sf',
};

const getTaskX = (
  task: Task,
  position: 'start' | 'end',
  viewStart: Date,
  colWidth: number,
  zoom: ZoomLevel
): number => {
  if (task.isMilestone) {
    return dateToX(task.startDate, viewStart, colWidth, zoom);
  }
  return position === 'start'
    ? dateToX(task.startDate, viewStart, colWidth, zoom)
    : dateToX(task.endDate, viewStart, colWidth, zoom);
};

const buildPath = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radius: number = 8
): string => {
  const sameRow = Math.abs(y1 - y2) < 1;
  if (sameRow) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  const midY = (y1 + y2) / 2;
  const dx = x2 - x1;
  const r = Math.min(Math.abs(radius), Math.abs(dx) / 2, Math.abs(y2 - y1) / 2);

  if (dx >= 0) {
    const bridgeX = Math.max(x1, x2 - r * 2);
    return `M ${x1} ${y1}
            L ${bridgeX} ${y1}
            Q ${bridgeX + r} ${y1} ${bridgeX + r} ${y1 + (y2 > y1 ? r : -r)}
            L ${bridgeX + r} ${y2 - (y2 > y1 ? r : -r)}
            Q ${bridgeX + r} ${y2} ${bridgeX + r * 2} ${y2}
            L ${x2} ${y2}`;
  } else {
    const bridgeX = Math.min(x1 + 20, x2 - 20);
    return `M ${x1} ${y1}
            L ${x1 + 20} ${y1}
            Q ${x1 + 20 + r} ${y1} ${x1 + 20 + r} ${y1 + (y2 > y1 ? r : -r)}
            L ${x1 + 20 + r} ${midY}
            L ${x2 - 20 - r} ${midY}
            Q ${x2 - 20 - r} ${y2} ${x2 - 20} ${y2}
            L ${x2} ${y2}`;
  }
};

export const DependencyLines: React.FC<DependencyLinesProps> = ({
  tasks,
  dependencies,
  columnWidth,
  viewStart,
  zoomLevel,
  rowHeight,
}) => {
  const effectiveColWidth = columnWidth || getColumnWidth(zoomLevel);

  const taskIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach((t, i) => map.set(t.id, i));
    return map;
  }, [tasks]);

  const lines = useMemo(() => {
    return dependencies
      .map((dep) => {
        const sourceIdx = taskIndexMap.get(dep.sourceId);
        const targetIdx = taskIndexMap.get(dep.targetId);
        if (sourceIdx === undefined || targetIdx === undefined) return null;

        const source = tasks[sourceIdx];
        const target = tasks[targetIdx];

        let sourcePoint: 'start' | 'end';
        let targetPoint: 'start' | 'end';

        switch (dep.type) {
          case 'FS':
            sourcePoint = 'end';
            targetPoint = 'start';
            break;
          case 'FF':
            sourcePoint = 'end';
            targetPoint = 'end';
            break;
          case 'SS':
            sourcePoint = 'start';
            targetPoint = 'start';
            break;
          case 'SF':
            sourcePoint = 'start';
            targetPoint = 'end';
            break;
        }

        const lagOffset = dep.lag * effectiveColWidth;

        let x1 = getTaskX(source, sourcePoint, viewStart, effectiveColWidth, zoomLevel);
        let x2 = getTaskX(target, targetPoint, viewStart, effectiveColWidth, zoomLevel) + lagOffset;

        const y1 = getTaskRowY(sourceIdx, rowHeight) + rowHeight / 2;
        const y2 = getTaskRowY(targetIdx, rowHeight) + rowHeight / 2;

        const path = buildPath(x1, y1, x2, y2);

        let strokeColor = '#6B7280';
        let strokeDasharray: string | undefined;

        if (dep.lag > 0) {
          strokeColor = '#3B82F6';
          strokeDasharray = '6 4';
        } else if (dep.lag < 0) {
          strokeColor = '#10B981';
          strokeDasharray = '6 4';
        }

        return {
          id: dep.id,
          path,
          strokeColor,
          strokeDasharray,
          markerEnd: `url(#${ARROW_MARKERS[dep.type]})`,
          lag: dep.lag,
          x2,
          y2,
        };
      })
      .filter(Boolean);
  }, [dependencies, tasks, taskIndexMap, effectiveColWidth, viewStart, zoomLevel, rowHeight]);

  const totalHeight = tasks.length * rowHeight + 100;
  const totalWidth = Math.max(
    ...lines.map((l) => (l ? l.x2 : 0)),
    2000
  ) + 100;

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none overflow-visible"
      style={{ width: totalWidth, height: totalHeight, zIndex: 5 }}
    >
      <defs>
        <marker
          id="arrow-fs"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#6B7280" />
        </marker>
        <marker
          id="arrow-ff"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <rect x="1" y="2" width="8" height="6" fill="#F59E0B" />
        </marker>
        <marker
          id="arrow-ss"
          viewBox="0 0 10 10"
          refX="2"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <circle cx="5" cy="5" r="3.5" fill="#8B5CF6" />
        </marker>
        <marker
          id="arrow-sf"
          viewBox="0 0 10 10"
          refX="2"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 10 0 L 0 5 L 10 10 z" fill="#EC4899" />
        </marker>
      </defs>

      {lines.map((line) =>
        line ? (
          <g key={line.id}>
            <path
              d={line.path}
              fill="none"
              stroke={line.strokeColor}
              strokeWidth={2}
              strokeDasharray={line.strokeDasharray}
              markerEnd={line.markerEnd}
            />
            {line.lag !== 0 && (
              <text
                x={line.x2 - 4}
                y={line.y2 - 8}
                fontSize="10"
                fill={line.strokeColor}
                textAnchor="end"
              >
                {line.lag > 0 ? `+${line.lag}d` : `${line.lag}d`}
              </text>
            )}
          </g>
        ) : null
      )}
    </svg>
  );
};

export default DependencyLines;
