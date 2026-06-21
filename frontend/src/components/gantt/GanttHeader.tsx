'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { OnlineUser, Baseline, ZoomLevel } from './utils';

interface GanttHeaderProps {
  projectName?: string;
  onlineUsers?: OnlineUser[];
  zoomLevel?: ZoomLevel;
  onZoomChange?: (zoom: ZoomLevel) => void;
  baselines?: Baseline[];
  activeBaseline?: string | null;
  onBaselineChange?: (baselineId: string | null) => void;
  onImport?: () => void;
  onExport?: () => void;
  onResourceManage?: () => void;
  onPermissionManage?: () => void;
}

const zoomOptions: { level: ZoomLevel; label: string }[] = [
  { level: 'day', label: '日' },
  { level: 'week', label: '周' },
  { level: 'month', label: '月' },
  { level: 'quarter', label: '季' },
];

export const GanttHeader: React.FC<GanttHeaderProps> = ({
  projectName = '项目甘特图',
  onlineUsers = [],
  zoomLevel = 'week',
  onZoomChange,
  baselines = [],
  activeBaseline,
  onBaselineChange,
  onImport,
  onExport,
  onResourceManage,
  onPermissionManage,
}) => {
  const [baselineOpen, setBaselineOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-gray-900">{projectName}</h1>

        <div className="flex -space-x-2">
          {onlineUsers.slice(0, 5).map((user) => (
            <div
              key={user.id}
              className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-white"
              style={{ backgroundColor: user.color }}
              title={user.name}
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
          ))}
          {onlineUsers.length > 5 && (
            <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-700">
              +{onlineUsers.length - 5}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {onZoomChange && (
          <div className="flex bg-gray-100 rounded-md p-0.5">
            {zoomOptions.map((opt) => (
              <button
                key={opt.level}
                onClick={() => onZoomChange(opt.level)}
                className={clsx(
                  'px-3 py-1 text-sm rounded transition-colors',
                  zoomLevel === opt.level
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {baselines.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setBaselineOpen(!baselineOpen)}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              基线
              {activeBaseline && (
                <span className="ml-1 text-blue-600 font-medium">
                  ({baselines.find((b) => b.id === activeBaseline)?.name})
                </span>
              )}
            </button>

            {baselineOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                <button
                  onClick={() => {
                    onBaselineChange?.(null);
                    setBaselineOpen(false);
                  }}
                  className={clsx(
                    'w-full text-left px-3 py-2 text-sm hover:bg-gray-50',
                    !activeBaseline && 'text-blue-600 bg-blue-50'
                  )}
                >
                  无基线
                </button>
                {baselines.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      onBaselineChange?.(b.id);
                      setBaselineOpen(false);
                    }}
                    className={clsx(
                      'w-full text-left px-3 py-2 text-sm hover:bg-gray-50',
                      activeBaseline === b.id && 'text-blue-600 bg-blue-50'
                    )}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {onImport && (
          <button
            onClick={onImport}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            导入
          </button>
        )}

        {onExport && (
          <button
            onClick={onExport}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            导出
          </button>
        )}

        {onResourceManage && (
          <button
            onClick={onResourceManage}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            资源
          </button>
        )}

        {onPermissionManage && (
          <button
            onClick={onPermissionManage}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded-md text-white flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            权限
          </button>
        )}
      </div>
    </header>
  );
};

export default GanttHeader;
