'use client';

import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { Task, TaskPriority, Resource, Dependency, DependencyType } from '@/lib/types';

interface TaskEditModalProps {
  task: Task;
  resources: Resource[];
  allTasks: Task[];
  dependencies: Dependency[];
  onClose: () => void;
  onUpdate: (taskId: string, changes: Partial<Task>) => void;
  onAddDependency: (dep: Omit<Dependency, 'id' | 'projectId'>) => void;
  onRemoveDependency: (dependencyId: string) => void;
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

const dependencyTypeLabels: Record<DependencyType, string> = {
  FS: '完成-开始(FS)',
  FF: '完成-完成(FF)',
  SS: '开始-开始(SS)',
  SF: '开始-完成(SF)',
};

export const TaskEditModal: React.FC<TaskEditModalProps> = ({
  task,
  resources,
  allTasks,
  dependencies,
  onClose,
  onUpdate,
  onAddDependency,
  onRemoveDependency,
}) => {
  const [formData, setFormData] = useState<Partial<Task>>({
    name: task.name,
    description: task.description,
    startDate: task.startDate,
    endDate: task.endDate,
    progress: task.progress,
    priority: task.priority,
    tags: [...task.tags],
    assigneeId: task.assigneeId,
    dailyHours: task.dailyHours,
    isMilestone: task.isMilestone,
  });
  const [newTag, setNewTag] = useState('');
  const [newDepTaskId, setNewDepTaskId] = useState('');
  const [newDepType, setNewDepType] = useState<DependencyType>(DependencyType.FS);
  const [newDepLag, setNewDepLag] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = () => {
    onUpdate(task.id, formData);
    onClose();
  };

  const handleAddTag = () => {
    const tag = newTag.trim();
    if (tag && !formData.tags?.includes(tag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...(prev.tags || []), tag],
      }));
    }
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags?.filter((t) => t !== tag) || [],
    }));
  };

  const handleAddDependency = () => {
    if (!newDepTaskId || newDepTaskId === task.id) return;
    onAddDependency({
      sourceTaskId: newDepTaskId,
      targetTaskId: task.id,
      type: newDepType,
      lag: newDepLag,
    });
    setNewDepTaskId('');
    setNewDepLag(0);
  };

  const taskDependencies = dependencies.filter(
    (d) => d.sourceTaskId === task.id || d.targetTaskId === task.id
  );

  const availableTasks = allTasks.filter((t) => t.id !== task.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">编辑任务</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">任务名称</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
              <input
                type="date"
                value={formData.startDate || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
              <input
                type="date"
                value={formData.endDate || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">进度 (%)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={formData.progress || 0}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, progress: Number(e.target.value) }))
                  }
                  className="flex-1 h-2 accent-blue-600"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.progress || 0}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, progress: Number(e.target.value) }))
                  }
                  className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-center"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">每日工时 (小时)</label>
              <input
                type="number"
                min={0}
                max={24}
                value={formData.dailyHours || 0}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, dailyHours: Number(e.target.value) }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">优先级</label>
              <div className="flex gap-2">
                {Object.values(TaskPriority).map((p) => (
                  <button
                    key={p}
                    onClick={() => setFormData((prev) => ({ ...prev, priority: p }))}
                    className={clsx(
                      'flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      formData.priority === p
                        ? priorityColors[p]
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {priorityLabels[p]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">负责人</label>
              <select
                value={formData.assigneeId || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    assigneeId: e.target.value || undefined,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
              >
                <option value="">未分配</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isMilestone || false}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, isMilestone: e.target.checked }))
                }
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
              />
              <span className="text-sm font-medium text-gray-700">里程碑任务</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">标签</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags?.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="输入标签后按回车添加"
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
              <button
                onClick={handleAddTag}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
              >
                添加
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">依赖关系</label>
            {taskDependencies.length > 0 && (
              <div className="space-y-1 mb-3">
                {taskDependencies.map((dep) => {
                  const isSource = dep.sourceTaskId === task.id;
                  const otherTask = allTasks.find(
                    (t) => t.id === (isSource ? dep.targetTaskId : dep.sourceTaskId)
                  );
                  return (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md text-sm"
                    >
                      <span className="text-gray-700">
                        {isSource ? `${task.name} → ` : ''}
                        {dependencyTypeLabels[dep.type]}
                        {!isSource ? ` → ${task.name}` : ''}
                        {otherTask && (
                          <span className="text-gray-500 ml-1">
                            ({isSource ? otherTask.name : otherTask.name})
                          </span>
                        )}
                        {dep.lag > 0 && <span className="text-gray-500 ml-1">(滞后 {dep.lag}天)</span>}
                      </span>
                      <button
                        onClick={() => onRemoveDependency(dep.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-[2fr,1fr,1fr,auto] gap-2">
              <select
                value={newDepTaskId}
                onChange={(e) => setNewDepTaskId(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option value="">选择前置任务...</option>
                {availableTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                value={newDepType}
                onChange={(e) => setNewDepType(e.target.value as DependencyType)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                {Object.values(DependencyType).map((t) => (
                  <option key={t} value={t}>
                    {dependencyTypeLabels[t]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                value={newDepLag}
                onChange={(e) => setNewDepLag(Number(e.target.value))}
                placeholder="滞后天数"
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
              <button
                onClick={handleAddDependency}
                disabled={!newDepTaskId}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                添加
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskEditModal;
