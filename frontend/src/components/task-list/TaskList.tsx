'use client';

import React, { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import clsx from 'clsx';
import { Task, Resource, OnlineUser, TaskLock } from '@/lib/types';
import TaskItem from './TaskItem';
import TaskEditModal from './TaskEditModal';
import { Dependency, DependencyType } from '@/lib/types';

interface TaskListProps {
  tasks: Task[];
  resources: Resource[];
  onlineUsers: OnlineUser[];
  taskLocks: Record<string, TaskLock>;
  expandedParents: Set<string>;
  selectedTaskId: string | null;
  onToggleExpand: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, changes: Partial<Task>) => void;
  onReorder: (taskId: string, newParentId: string | null, newIndex: number) => void;
  onCreateTask: (parentId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onResourceConflict: (taskId: string) => void;
}

interface TaskWithChildren extends Task {
  children?: TaskWithChildren[];
}

interface FlattenedTask {
  task: Task;
  level: number;
  parentId: string | null;
}

function flattenTasks(
  tasks: TaskWithChildren[],
  expanded: Set<string>,
  level = 0,
  parentId: string | null = null
): FlattenedTask[] {
  const result: FlattenedTask[] = [];
  const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const task of sorted) {
    result.push({ task, level, parentId });
    if (task.children && task.children.length > 0 && expanded.has(task.id)) {
      result.push(...flattenTasks(task.children, expanded, level + 1, task.id));
    }
  }
  return result;
}

function buildTaskTree(tasks: Task[]): TaskWithChildren[] {
  const taskMap = new Map<string, TaskWithChildren>();
  const roots: TaskWithChildren[] = [];

  for (const task of tasks) {
    taskMap.set(task.id, { ...task, children: [] });
  }

  for (const task of tasks) {
    const t = taskMap.get(task.id)!;
    if (task.parentId && taskMap.has(task.parentId)) {
      const parent = taskMap.get(task.parentId)!;
      parent.children = parent.children || [];
      parent.children.push(t);
    } else {
      roots.push(t);
    }
  }

  return roots;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  resources,
  onlineUsers,
  taskLocks,
  expandedParents,
  selectedTaskId,
  onToggleExpand,
  onSelectTask,
  onUpdateTask,
  onReorder,
  onCreateTask,
  onDeleteTask,
  onResourceConflict,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [dependencies] = useState<Dependency[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const taskTree = useMemo(() => buildTaskTree(tasks), [tasks]);
  const flattened = useMemo(
    () => flattenTasks(taskTree, expandedParents),
    [taskTree, expandedParents]
  );

  const taskMap = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tasks]);

  const flattenedIds = useMemo(() => flattened.map((f) => f.task.id), [flattened]);

  const hasChildren = (taskId: string) => {
    return tasks.some((t) => t.parentId === taskId);
  };

  const checkResourceConflict = (task: Task): boolean => {
    if (!task.assigneeId) return false;
    const sameResourceTasks = tasks.filter(
      (t) => t.assigneeId === task.assigneeId && t.id !== task.id
    );
    for (const other of sameResourceTasks) {
      const overlap =
        task.startDate <= other.endDate && task.endDate >= other.startDate;
      if (overlap) return true;
    }
    return false;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const oldIndex = flattenedIds.indexOf(activeId);
    const newIndex = flattenedIds.indexOf(overId);

    if (oldIndex === -1 || newIndex === -1) return;

    const activeFlattened = flattened.find((f) => f.task.id === activeId);
    const overFlattened = flattened.find((f) => f.task.id === overId);

    if (!activeFlattened || !overFlattened) return;

    let newParentId: string | null = overFlattened.parentId;
    let targetIndex: number;

    const siblings = flattened.filter((f) => f.parentId === newParentId);
    const overSiblingIndex = siblings.findIndex((f) => f.task.id === overId);
    const activeSiblingIndex = siblings.findIndex((f) => f.task.id === activeId);

    if (activeSiblingIndex !== -1) {
      targetIndex =
        overSiblingIndex > activeSiblingIndex ? overSiblingIndex : overSiblingIndex;
    } else {
      targetIndex = overSiblingIndex;
    }

    onReorder(activeId, newParentId, targetIndex);
  };

  const activeTask = activeId ? taskMap.get(activeId) : null;
  const editingTask = editingTaskId ? taskMap.get(editingTaskId) : null;

  const handleAddDependency = (dep: Omit<Dependency, 'id' | 'projectId'>) => {
    console.log('Add dependency:', dep);
  };

  const handleRemoveDependency = (dependencyId: string) => {
    console.log('Remove dependency:', dependencyId);
  };

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 flex-1">任务列表</h3>
        <button
          onClick={() => onCreateTask('')}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建任务
        </button>
      </div>

      <div className="flex items-center text-xs font-medium text-gray-500 bg-gray-100 border-b border-gray-200">
        <div className="py-2 px-2 shrink-0" style={{ width: 280 }}>
          名称
        </div>
        <div className="py-2 px-2 shrink-0" style={{ width: 140 }}>
          负责人
        </div>
        <div className="py-2 px-2 shrink-0" style={{ width: 130 }}>
          开始日期
        </div>
        <div className="py-2 px-2 shrink-0" style={{ width: 130 }}>
          结束日期
        </div>
        <div className="py-2 px-2 shrink-0" style={{ width: 150 }}>
          进度
        </div>
        <div className="py-2 px-2 shrink-0" style={{ width: 100 }}>
          优先级
        </div>
        <div className="py-2 px-2 shrink-0" style={{ width: 160 }}>
          标签
        </div>
        <div className="py-2 px-2 shrink-0" style={{ width: 120 }}>
          操作
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {flattened.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">暂无任务，点击上方按钮新建</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={flattenedIds}
              strategy={verticalListSortingStrategy}
            >
              {flattened.map(({ task, level }) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  level={level}
                  resources={resources}
                  onlineUsers={onlineUsers}
                  taskLocks={taskLocks}
                  isExpanded={expandedParents.has(task.id)}
                  isSelected={selectedTaskId === task.id}
                  hasChildren={hasChildren(task.id)}
                  hasResourceConflict={checkResourceConflict(task)}
                  onToggleExpand={onToggleExpand}
                  onSelectTask={onSelectTask}
                  onUpdateTask={onUpdateTask}
                  onCreateTask={onCreateTask}
                  onDeleteTask={onDeleteTask}
                  onResourceConflict={onResourceConflict}
                  onStartEdit={() => setEditingTaskId(task.id)}
                />
              ))}
            </SortableContext>

            <DragOverlay>
              {activeTask && (
                <div className="bg-white border border-blue-400 rounded-md shadow-lg px-4 py-2 opacity-90">
                  <span className="text-sm text-gray-800">{activeTask.name}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          resources={resources}
          allTasks={tasks}
          dependencies={dependencies}
          onClose={() => setEditingTaskId(null)}
          onUpdate={onUpdateTask}
          onAddDependency={handleAddDependency}
          onRemoveDependency={handleRemoveDependency}
        />
      )}
    </div>
  );
};

export default TaskList;
