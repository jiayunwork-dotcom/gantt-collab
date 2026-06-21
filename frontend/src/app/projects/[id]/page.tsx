'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Socket } from 'socket.io-client';
import {
  tasksApi,
  dependenciesApi,
  resourcesApi,
  baselinesApi,
  projectsApi,
} from '@/lib/api';
import { createSocket, setupSocketListeners, socketEmit, OpMessage } from '@/lib/socket';
import type {
  Task as ApiTask,
  Dependency as ApiDependency,
  Resource,
  ResourceWorkload,
  Baseline as ApiBaseline,
  Project,
  OnlineUser as ApiOnlineUser,
  TaskLock as ApiTaskLock,
  ZoomLevel,
  Collaborator,
  CollaboratorRole,
  TaskPriority,
  DependencyType,
} from '@/lib/types';

import GanttChart from '@/components/gantt/GanttChart';
import GanttHeader from '@/components/gantt/GanttHeader';
import {
  Task as GanttTask,
  Dependency as GanttDependency,
  OnlineUser as GanttOnlineUser,
  TaskLock as GanttTaskLock,
  Baseline as GanttBaseline,
} from '@/components/gantt/utils';

import TaskList from '@/components/task-list/TaskList';
import TaskEditModal from '@/components/task-list/TaskEditModal';
import ResourceChart from '@/components/resource-chart/ResourceChart';
import ConflictNotification, { ConflictItem } from '@/components/collaboration/ConflictNotification';

function toGanttTask(t: ApiTask): GanttTask {
  return {
    id: t.id,
    name: t.name,
    startDate: new Date(t.startDate),
    endDate: new Date(t.endDate),
    duration: t.duration ?? 0,
    progress: t.progress,
    priority: (t.priority as any) ?? 'medium',
    isMilestone: t.isMilestone,
    isCritical: (t.totalFloat ?? 0) <= 0,
    float: t.totalFloat ?? 0,
    assignee: t.assigneeId,
    parentId: t.parentId ?? null,
  };
}

function toGanttDependency(d: ApiDependency): GanttDependency {
  return {
    id: d.id,
    sourceId: d.sourceTaskId,
    targetId: d.targetTaskId,
    type: d.type,
    lag: d.lag,
  };
}

function toGanttOnlineUser(u: ApiOnlineUser): GanttOnlineUser {
  return {
    id: u.userId,
    name: u.name,
    color: u.cursorColor || '#3B82F6',
  };
}

function toGanttTaskLocks(locks: Record<string, ApiTaskLock>): GanttTaskLock[] {
  return Object.values(locks).map((l) => ({
    taskId: l.taskId,
    userId: l.userId,
    userName: l.userName,
    color: '#EF4444',
  }));
}

function toGanttBaseline(b: ApiBaseline): GanttBaseline | null {
  try {
    const tasks: Record<string, { startDate: Date; endDate: Date; duration: number }> = {};
    const snapTasks = b.snapshot?.tasks || [];
    snapTasks.forEach((t: any) => {
      tasks[t.id] = {
        startDate: new Date(t.startDate),
        endDate: new Date(t.endDate),
        duration: t.duration ?? 0,
      };
    });
    return { id: b.id, name: b.name, tasks };
  } catch {
    return null;
  }
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [dependencies, setDependencies] = useState<ApiDependency[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [workload, setWorkload] = useState<ResourceWorkload[]>([]);
  const [baselines, setBaselines] = useState<ApiBaseline[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<ApiOnlineUser[]>([]);
  const [taskLocks, setTaskLocks] = useState<Record<string, ApiTaskLock>>({});
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('week');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<ApiTask | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [activeBaselineId, setActiveBaselineId] = useState<string | null>(null);
  const [showResources, setShowResources] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteRole, setInviteRole] = useState<CollaboratorRole>('editor');
  const [inviteExpires, setInviteExpires] = useState(7);
  const [generatedInvite, setGeneratedInvite] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      router.push('/login');
      return;
    }

    const loadData = async () => {
      try {
        const [p, t, d, r, w, b, c] = await Promise.all([
          projectsApi.get(projectId),
          tasksApi.list(projectId),
          dependenciesApi.list(projectId),
          resourcesApi.list(projectId),
          resourcesApi.workload(projectId),
          baselinesApi.list(projectId),
          projectsApi.listCollaborators(projectId),
        ]);
        setProject(p);
        setTasks(t);
        setDependencies(d);
        setResources(r);
        setWorkload(w);
        setBaselines(b);
        setCollaborators(c);

        const pids = new Set<string>();
        t.forEach((task) => {
          if (task.parentId) pids.add(task.parentId);
        });
        setExpandedParents(pids);
      } catch (err: any) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();

    try {
      const socket = createSocket(projectId, token);
      socketRef.current = socket;

      const cleanup = setupSocketListeners(socket, {
        onConnected: (data) => {
          setCurrentUserId(data.userId);
          socketEmit.joinProject(socket, projectId);
        },
        onPresenceList: (users) => setOnlineUsers(users),
        onUserJoin: (user) => {
          setOnlineUsers((prev) => {
            const filtered = prev.filter((u) => u.socketId !== user.socketId);
            return [...filtered, user];
          });
        },
        onUserLeave: ({ socketId }) => {
          setOnlineUsers((prev) => prev.filter((u) => u.socketId !== socketId));
          setTaskLocks((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((k) => {
              if (next[k].socketId === socketId) delete next[k];
            });
            return next;
          });
        },
        onTaskLock: (lock) => {
          setTaskLocks((prev) => ({ ...prev, [lock.taskId]: lock }));
        },
        onTaskUnlock: ({ taskId }) => {
          setTaskLocks((prev) => {
            const next = { ...prev };
            delete next[taskId];
            return next;
          });
        },
        onOp: (msg: OpMessage) => handleRemoteOp(msg),
        onConflict: ({ taskId, overriddenByName, overriddenBy }) => {
          const task = tasks.find((t) => t.id === taskId);
          const id = Math.random().toString(36).slice(2);
          setConflicts((prev) => [
            ...prev,
            { id, taskId, taskName: task?.name, overriddenBy, overriddenByName, ts: Date.now() },
          ]);
        },
      });

      return () => {
        cleanup();
        socket.disconnect();
      };
    } catch {}
  }, [projectId, router]);

  const handleRemoteOp = (msg: OpMessage) => {
    const { op, payload } = msg;
    switch (op) {
      case 'task:update':
        setTasks((prev) =>
          prev.map((t) => (t.id === payload.taskId ? { ...t, ...payload.changes } : t))
        );
        break;
      case 'task:create':
        setTasks((prev) => [...prev, payload]);
        break;
      case 'task:delete':
        setTasks((prev) => prev.filter((t) => t.id !== payload.taskId));
        setDependencies((prev) =>
          prev.filter((d) => d.sourceTaskId !== payload.taskId && d.targetTaskId !== payload.taskId)
        );
        break;
      case 'dependency:create':
        setDependencies((prev) => [...prev, payload]);
        break;
      case 'dependency:delete':
        setDependencies((prev) => prev.filter((d) => d.id !== payload.dependencyId));
        break;
    }
  };

  const refreshWorkload = () => {
    resourcesApi.workload(projectId).then(setWorkload).catch(() => {});
  };

  const handleTaskUpdate = async (taskId: string, changes: Partial<ApiTask>) => {
    try {
      const updated = await tasksApi.update(projectId, taskId, changes);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      if (socketRef.current) {
        socketEmit.updateTask(socketRef.current, taskId, changes);
      }
      refreshWorkload();
    } catch {}
  };

  const handleTaskCreate = async (parentId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const created = await tasksApi.create(projectId, {
        name: '新任务',
        startDate: today,
        endDate: today,
        parentId: parentId || undefined,
        priority: 'medium' as TaskPriority,
        progress: 0,
      });
      setTasks((prev) => [...prev, created]);
      if (socketRef.current) {
        socketEmit.createTask(socketRef.current, created);
      }
      refreshWorkload();
    } catch {}
  };

  const handleTaskDelete = async (taskId: string) => {
    try {
      await tasksApi.remove(projectId, taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setDependencies((prev) =>
        prev.filter((d) => d.sourceTaskId !== taskId && d.targetTaskId !== taskId)
      );
      if (socketRef.current) {
        socketEmit.deleteTask(socketRef.current, taskId);
      }
      refreshWorkload();
      if (selectedTaskId === taskId) setSelectedTaskId(null);
    } catch {}
  };

  const handleDependencyCreate = async (sourceId: string, targetId: string) => {
    try {
      const created = await dependenciesApi.create(projectId, {
        sourceTaskId: sourceId,
        targetTaskId: targetId,
        type: 'FS' as DependencyType,
        lag: 0,
      });
      setDependencies((prev) => [...prev, created]);
      if (socketRef.current) {
        socketEmit.createDependency(socketRef.current, created);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || '创建依赖失败');
    }
  };

  const handleDependencyDelete = async (dependencyId: string) => {
    try {
      await dependenciesApi.remove(projectId, dependencyId);
      setDependencies((prev) => prev.filter((d) => d.id !== dependencyId));
      if (socketRef.current) {
        socketEmit.deleteDependency(socketRef.current, dependencyId);
      }
    } catch {}
  };

  const handleToggleExpand = (taskId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleGanttTaskUpdate = (taskId: string, updates: Partial<GanttTask>) => {
    const apiChanges: Partial<ApiTask> = {};
    if (updates.startDate instanceof Date) apiChanges.startDate = updates.startDate.toISOString().slice(0, 10);
    if (updates.endDate instanceof Date) apiChanges.endDate = updates.endDate.toISOString().slice(0, 10);
    if (updates.progress !== undefined) apiChanges.progress = updates.progress;
    if (Object.keys(apiChanges).length > 0) {
      handleTaskUpdate(taskId, apiChanges);
    }
  };

  const handleSaveBaseline = async () => {
    const name = prompt('基线名称:', `基线 ${baselines.length + 1}`);
    if (!name) return;
    try {
      await baselinesApi.create(projectId, { name });
      const list = await baselinesApi.list(projectId);
      setBaselines(list);
    } catch (err: any) {
      alert(err.response?.data?.message || '保存失败');
    }
  };

  const handleGenerateInvite = async () => {
    try {
      const result = await projectsApi.createInvitation(projectId, {
        role: inviteRole,
        expiresInDays: inviteExpires,
      });
      setGeneratedInvite(`${window.location.origin}/invite/${result.token}`);
    } catch (err: any) {
      alert(err.response?.data?.message || '生成失败');
    }
  };

  const computeViewRange = (): { viewStart: Date; viewEnd: Date } => {
    if (tasks.length === 0) {
      const today = new Date();
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      const end = new Date(today);
      end.setDate(end.getDate() + 30);
      return { viewStart: start, viewEnd: end };
    }
    const dates = tasks.flatMap((t) => [new Date(t.startDate), new Date(t.endDate)]);
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    min.setDate(min.getDate() - 7);
    max.setDate(max.getDate() + 7);
    return { viewStart: min, viewEnd: max };
  };

  const dismissConflict = (id: string) => {
    setConflicts((prev) => prev.filter((c) => c.id !== id));
  };

  if (loading || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  const ganttTasks = tasks.map(toGanttTask);
  const ganttDeps = dependencies.map(toGanttDependency);
  const ganttOnline = onlineUsers.map(toGanttOnlineUser);
  const ganttLocks = toGanttTaskLocks(taskLocks);
  const activeBaseline = activeBaselineId
    ? toGanttBaseline(baselines.find((b) => b.id === activeBaselineId)!)
    : null;
  const { viewStart, viewEnd } = computeViewRange();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <GanttHeader
        projectName={project.name}
        onlineUsers={ganttOnline}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        baselines={baselines.map((b) => ({
          id: b.id,
          name: b.name,
          tasks: {},
        }))}
        activeBaseline={activeBaselineId}
        onBaselineChange={setActiveBaselineId}
        onImport={() => setShowImportExport(true)}
        onExport={() => setShowImportExport(true)}
        onResourceManage={() => setShowResources(true)}
        onPermissionManage={() => setShowPermissions(true)}
      />

      <div className="p-3 border-b border-gray-200 bg-white flex gap-2 items-center">
        <button
          onClick={handleSaveBaseline}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
        >
          + 保存基线
        </button>
        <button
          onClick={() => handleTaskCreate('')}
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded text-white"
        >
          + 新建任务
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <GanttChart
          tasks={ganttTasks}
          dependencies={ganttDeps}
          zoomLevel={zoomLevel}
          taskLocks={ganttLocks}
          onlineUsers={ganttOnline}
          activeBaseline={activeBaseline}
          onTaskUpdate={handleGanttTaskUpdate}
          onTaskSelect={(id) => {
            setSelectedTaskId(id);
            if (id && socketRef.current) {
              socketEmit.lockTask(socketRef.current, id);
            }
          }}
          onDependencyCreate={handleDependencyCreate}
          selectedTaskId={selectedTaskId}
        />
      </div>

      <div className="border-t border-gray-200 bg-white" style={{ maxHeight: 300, overflow: 'auto' }}>
        <TaskList
          tasks={tasks}
          resources={resources}
          onlineUsers={onlineUsers}
          taskLocks={taskLocks}
          expandedParents={expandedParents}
          selectedTaskId={selectedTaskId}
          onToggleExpand={handleToggleExpand}
          onSelectTask={(id) => {
            setSelectedTaskId(id);
            setEditingTask(tasks.find((t) => t.id === id) || null);
          }}
          onUpdateTask={handleTaskUpdate}
          onReorder={() => {}}
          onCreateTask={handleTaskCreate}
          onDeleteTask={handleTaskDelete}
          onResourceConflict={() => {}}
        />
      </div>

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          resources={resources}
          allTasks={tasks}
          dependencies={dependencies}
          onClose={() => setEditingTask(null)}
          onUpdate={(id, changes) => handleTaskUpdate(id, changes)}
          onAddDependency={(dep) =>
            handleDependencyCreate(dep.sourceTaskId, dep.targetTaskId)
          }
          onRemoveDependency={handleDependencyDelete}
        />
      )}

      {showResources && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">资源负载图</h3>
              <button onClick={() => setShowResources(false)} className="text-gray-500 hover:text-gray-700">
                关闭
              </button>
            </div>
            <div className="p-4">
              <ResourceChart workload={workload} viewStart={viewStart} viewEnd={viewEnd} />
            </div>
          </div>
        </div>
      )}

      {showPermissions && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">权限与邀请</h3>
              <button onClick={() => setShowPermissions(false)} className="text-gray-500 hover:text-gray-700">
                关闭
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">生成邀请链接</h4>
                <div className="flex gap-2 items-center flex-wrap">
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as CollaboratorRole)}
                    className="px-3 py-2 border border-gray-300 rounded text-sm"
                  >
                    <option value="editor">编辑者</option>
                    <option value="viewer">查看者</option>
                  </select>
                  <select
                    value={inviteExpires}
                    onChange={(e) => setInviteExpires(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded text-sm"
                  >
                    <option value={1}>1天</option>
                    <option value={7}>7天</option>
                    <option value={30}>30天</option>
                  </select>
                  <button
                    onClick={handleGenerateInvite}
                    className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    生成链接
                  </button>
                </div>
                {generatedInvite && (
                  <div className="mt-2 flex gap-2">
                    <input
                      readOnly
                      value={generatedInvite}
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-xs"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedInvite);
                        alert('已复制');
                      }}
                      className="px-3 py-2 bg-gray-100 rounded text-sm"
                    >
                      复制
                    </button>
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">协作者 ({collaborators.length})</h4>
                <div className="space-y-2">
                  {collaborators.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                        {((c.user as any)?.name || '?').charAt(0)}
                      </div>
                      <div className="flex-1 text-sm">
                        <div className="font-medium">{(c.user as any)?.name || c.userId}</div>
                      </div>
                      <select
                        value={c.role}
                        disabled={c.role === 'owner' || c.userId === currentUserId}
                        onChange={async (e) => {
                          try {
                            await projectsApi.updateCollaborator(projectId, c.id, e.target.value as CollaboratorRole);
                            const list = await projectsApi.listCollaborators(projectId);
                            setCollaborators(list);
                          } catch {}
                        }}
                        className="px-2 py-1 border border-gray-200 rounded text-xs"
                      >
                        <option value="owner">所有者</option>
                        <option value="editor">编辑者</option>
                        <option value="viewer">查看者</option>
                      </select>
                      {c.role !== 'owner' && c.userId !== currentUserId && (
                        <button
                          onClick={async () => {
                            if (!confirm('移除该协作者?')) return;
                            try {
                              await projectsApi.removeCollaborator(projectId, c.id);
                              const list = await projectsApi.listCollaborators(projectId);
                              setCollaborators(list);
                            } catch {}
                          }}
                          className="px-2 py-1 text-red-600 text-xs hover:bg-red-50 rounded"
                        >
                          移除
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImportExport && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">导入 / 导出</h3>
              <button onClick={() => setShowImportExport(false)} className="text-gray-500 hover:text-gray-700">
                关闭
              </button>
            </div>
            <div className="p-4 space-y-2">
              <button
                onClick={async () => {
                  try {
                    const blob = await import('@/lib/api').then((m) => m.importExportApi.exportCsv(projectId));
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `tasks_${Date.now()}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    alert('导出失败');
                  }
                }}
                className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm text-left"
              >
                导出 CSV
              </button>
              <button
                onClick={async () => {
                  try {
                    const data = await import('@/lib/api').then((m) => m.importExportApi.exportJson(projectId));
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `gantt_${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    alert('导出失败');
                  }
                }}
                className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm text-left"
              >
                导出 JSON
              </button>
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500 mb-2">导入功能请使用后端 API 或在后端处理</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConflictNotification conflicts={conflicts} onDismiss={dismissConflict} />
    </div>
  );
}
