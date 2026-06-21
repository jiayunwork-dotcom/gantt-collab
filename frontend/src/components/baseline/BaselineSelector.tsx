'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { Baseline } from '@/lib/types';

interface BaselineSelectorProps {
  baselines: Baseline[];
  activeBaselineId: string | null;
  onChange: (baselineId: string | null) => void;
  onCreate: (name: string) => void;
  onDelete: (baselineId: string) => void;
}

const MAX_BASELINES = 5;

export const BaselineSelector: React.FC<BaselineSelectorProps> = ({
  baselines,
  activeBaselineId,
  onChange,
  onCreate,
  onDelete,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBaselineName, setNewBaselineName] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const sortedBaselines = [...baselines].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const activeBaseline = baselines.find((b) => b.id === activeBaselineId);
  const isMaxReached = baselines.length >= MAX_BASELINES;

  const handleCreate = () => {
    const name = newBaselineName.trim();
    if (name) {
      onCreate(name);
      setNewBaselineName('');
      setShowCreateModal(false);
    }
  };

  return (
    <>
      <div className="relative inline-block">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50"
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <span className="text-gray-700">
            {activeBaseline ? activeBaseline.name : '基线'}
          </span>
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDropdown && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">基线版本</span>
                  <span className="text-xs text-gray-400">
                    {baselines.length}/{MAX_BASELINES}
                  </span>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto">
                <button
                  onClick={() => {
                    onChange(null);
                    setShowDropdown(false);
                  }}
                  className={clsx(
                    'w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between',
                    !activeBaselineId && 'bg-blue-50 text-blue-700'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    当前计划
                  </span>
                  {!activeBaselineId && (
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {sortedBaselines.map((baseline) => (
                  <div
                    key={baseline.id}
                    className={clsx(
                      'group px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between',
                      baseline.id === activeBaselineId && 'bg-blue-50'
                    )}
                  >
                    <button
                      onClick={() => {
                        onChange(baseline.id);
                        setShowDropdown(false);
                      }}
                      className="flex-1 text-left flex items-center gap-2"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      <div className="flex flex-col">
                        <span
                          className={clsx(
                            baseline.id === activeBaselineId
                              ? 'text-blue-700 font-medium'
                              : 'text-gray-700'
                          )}
                        >
                          {baseline.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {format(new Date(baseline.createdAt), 'yyyy-MM-dd HH:mm')}
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`确定删除基线 "${baseline.name}"?`)) {
                          onDelete(baseline.id);
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>

                    {baseline.id === activeBaselineId && (
                      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                ))}

                {sortedBaselines.length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-gray-400">
                    暂无基线版本
                  </div>
                )}
              </div>

              <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setShowCreateModal(true);
                  }}
                  disabled={isMaxReached}
                  className={clsx(
                    'w-full px-3 py-1.5 text-sm rounded-md flex items-center justify-center gap-2',
                    isMaxReached
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  )}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {isMaxReached ? `最多保留 ${MAX_BASELINES} 个版本` : '保存为基线'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-800">保存为基线</h3>
              {isMaxReached && (
                <p className="text-xs text-yellow-600 mt-1">
                  注意: 已达到 {MAX_BASELINES} 个版本上限, 将覆盖最早的版本
                </p>
              )}
            </div>

            <div className="p-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                基线名称
              </label>
              <input
                type="text"
                value={newBaselineName}
                onChange={(e) => setNewBaselineName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder={`v${baselines.length + 1} ${format(new Date(), 'yyyy-MM-dd')}`}
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>

            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewBaselineName('');
                }}
                className="px-4 py-1.5 bg-white text-gray-700 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!newBaselineName.trim()}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BaselineSelector;
