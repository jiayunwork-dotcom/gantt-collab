'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, TaskPriority, Resource, TaskLock, OnlineUser } from '@/lib/types';

interface TaskItemProps {
  task: Task;
  level: number;
  resources: Resource[];
  onlineUsers: OnlineUser[];
  taskLocks: Record<string, TaskLock>;
  isExpanded: boolean;
  isSelected: boolean;
  hasChildren: boolean;
  hasResourceConflict: boolean;
  onToggleExpand: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, changes: Partial<Task>) => void;
  onCreateTask: (parentId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onResourceConflict: (taskId: string) => void;
  onStartEdit: () => void;
}

const priorityColors: Record<TaskPriority, string> = {
  urgent: 'bg-urgent text-white',
  high: 'bg-high text-white',
  medium: 'bg-medium text-white',
  low: 'bg-low text-white',
};

const priorityLabels: Record<TaskPriority, string> = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  level,
  resources,
  onlineUsers,
  taskLocks,
  isExpanded,
  isSelected,
  hasChildren,
  hasResourceConflict,
  onToggleExpand,
  onSelectTask,
  onUpdateTask,
  onCreateTask,
  onDeleteTask,
  onResourceConflict,
  onStartEdit,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(task.name);
  const [showMenu, setShowMenu] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const lock = taskLocks[task.id];
  const isLocked = !!lock;

  const handleNameBlur = () => {
    if (nameValue.trim() && nameValue !== task.name) {
      onUpdateTask(task.id, { name: nameValue.trim() });
    } else {
      setNameValue(task.name);
    }
    setEditingName(false);
  };

  const handleProgressChange = (value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    onUpdateTask(task.id, { progress: clamped });
  };

  const handlePriorityChange = (priority: TaskPriority) => {
    onUpdateTask(task.id, { priority });
  };

  const handleAssigneeChange = (assigneeId: string | undefined) => {
    onUpdateTask(task.id, { assigneeId: assigneeId || undefined });
  };

  const handleStartDateChange = (date: string) => {
    onUpdateTask(task.id, { startDate: date });
  };

  const handleEndDateChange = (date: string) => {
    onUpdateTask(task.id, { endDate: date });
  };

  const assignee = resources.find((r) => r.id === task.assigneeId);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'group flex items-center border-b border-gray-200 hover:bg-gray-50 transition-colors',
        isSelected && 'bg-blue-50',
        isLocked && 'bg-yellow-50',
        isDragging && 'opacity-50'
      )}
      onClick={() => onSelectTask(task.id)}
    >
      <div
        className="flex items-center py-2 px-2 shrink-0"
        style={{ width: 280, paddingLeft: level * 20 + 8 }}
      >
        <button
          className={clsx(
            'w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-700 mr-1 shrink-0',
            !hasChildren && 'invisible'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(task.id);
          }}
        >
          <svg
            className={clsx('w-4 h-4 transition-transform', isExpanded && 'rotate-90')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mr-2 shrink-0">
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
          </svg>
        </div>

        {task.isMilestone ? (
          <div className="w-4 h-4 mr-2 shrink-0 rotate-45 bg-yellow-500" />
        ) : (
          <div className="w-4 h-4 mr-2 shrink-0 rounded-sm bg-gray-300" />
        )}

        {editingName ? (
          <input
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameBlur();
              if (e.key === 'Escape') {
                setNameValue(task.name);
                setEditingName(false);
              }
            }}
            className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 text-sm truncate cursor-text"
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (!isLocked) setEditingName(true);
            }}
          >
            {task.name}
          </span>
        )}

        {hasResourceConflict && (
          <button
            className="ml-2 shrink-0 text-red-500 font-bold hover:text-red-700"
            title="资源冲突"
            onClick={(e) => {
              e.stopPropagation();
              onResourceConflict(task.id);
            }}
          >
            !
          </button>
        )}
      </div>

      <div className="flex items-center py-2 px-2 shrink-0" style={{ width: 140 }}>
        <select
          value={task.assigneeId || ''}
          onChange={(e) => handleAssigneeChange(e.target.value || undefined)}
          onClick={(e) => e.stopPropagation()}
          disabled={isLocked}
          className="w-full px-2 py-1 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-100"
        >
          <option value="">未分配</option>
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center py-2 px-2 shrink-0" style={{ width: 130 }}>
        <input
          type="date"
          value={task.startDate}
          onChange={(e) => handleStartDateChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          disabled={isLocked}
          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-100"
        />
      </div>

      <div className="flex items-center py-2 px-2 shrink-0" style={{ width: 130 }}>
        <input
          type="date"
          value={task.endDate}
          onChange={(e) => handleEndDateChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          disabled={isLocked}
          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-100"
        />
      </div>

      <div className="flex items-center py-2 px-2 shrink-0 gap-2" style={{ width: 150 }}>
        <input
          type="range"
          min={0}
          max={100}
          value={task.progress}
          onChange={(e) => handleProgressChange(Number(e.target.value))}
          onClick={(e) => e.stopPropagation()}
          disabled={isLocked}
          className="flex-1 h-2 accent-blue-600"
        />
        <input
          type="number"
          min={0}
          max={100}
          value={task.progress}
          onChange={(e) => handleProgressChange(Number(e.target.value))}
          onClick={(e) => e.stopPropagation()}
          disabled={isLocked}
          className="w-12 px-1 py-0.5 text-xs text-right border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-100"
        />
        <span className="text-xs text-gray-500">%</span>
      </div>

      <div className="flex items-center py-2 px-2 shrink-0" style={{ width: 100 }}>
        <select
          value={task.priority}
          onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
          onClick={(e) => e.stopPropagation()}
          disabled={isLocked}
          className={clsx(
            'px-2 py-1 text-xs rounded font-medium focus:outline-none',
            priorityColors[task.priority],
            isLocked && 'opacity-60'
          )}
        >
          {Object.values(TaskPriority).map((p) => (
            <option key={p} value={p} className="bg-white text-gray-800">
              {priorityLabels[p]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center py-2 px-2 gap-1 shrink-0" style={{ width: 160 }}>
        {task.tags.slice(0, 3).map((tag, idx) => (
          <span
            key={idx}
            className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
          >
            {tag}
          </span>
        ))}
        {task.tags.length > 3 && (
          <span className="text-xs text-gray-500">+{task.tags.length - 3}</span>
        )}
      </div>

      <div className="flex items-center py-2 px-2 shrink-0 relative" style={{ width: 120 }}>
        {isLocked && (
          <span className="text-xs text-yellow-700 mr-2" title={`正在被 ${lock.userName} 编辑`}>
            🔒 {lock.userName}
          </span>
        )}

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            disabled={isLocked}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onStartEdit();
                  }}
                  className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100"
                >
                  编辑
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onCreateTask(task.id);
                  }}
                  className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100"
                >
                  添加子任务
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    if (confirm(`确定删除任务 "${task.name}"?`)) {
                      onDeleteTask(task.id);
                    }
                  }}
                  className="w-full px-3 py-1.5 text-sm text-left text-red-600 hover:bg-red-50"
                >
                  删除
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskItem;
