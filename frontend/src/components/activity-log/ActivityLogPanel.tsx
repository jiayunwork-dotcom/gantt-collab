'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ActivityLog, ActionType, ActivityLogUser } from '@/lib/types';
import { activityLogsApi, UndoErrorResponse } from '@/lib/api';

interface ActivityLogPanelProps {
  projectId: string;
  currentUserId: string | null;
  onLogReceived?: (log: ActivityLog) => void;
  externalLogs?: ActivityLog[];
  onDataChanged?: () => void;
}

const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  [ActionType.task_create]: '创建任务',
  [ActionType.task_delete]: '删除任务',
  [ActionType.task_update]: '修改任务',
  [ActionType.task_move]: '移动任务',
  [ActionType.dependency_create]: '添加依赖',
  [ActionType.dependency_delete]: '删除依赖',
  [ActionType.collaborator_add]: '添加协作者',
  [ActionType.collaborator_remove]: '移除协作者',
  [ActionType.collaborator_role_change]: '修改协作者角色',
  [ActionType.baseline_create]: '创建基线',
  [ActionType.baseline_delete]: '删除基线',
};

const FIELD_LABELS: Record<string, string> = {
  name: '名称',
  description: '描述',
  startDate: '开始日期',
  endDate: '结束日期',
  progress: '进度',
  priority: '优先级',
  tags: '标签',
  assigneeId: '负责人',
  parentId: '父任务',
  isMilestone: '里程碑',
  dailyHours: '每日工时',
  role: '角色',
  userName: '用户',
  userId: '用户ID',
  version: '版本',
  taskCount: '任务数',
  dependencyCount: '依赖数',
  sourceTaskId: '源任务',
  targetTaskId: '目标任务',
  type: '类型',
  lag: '延隔',
  id: 'ID',
};

const AVATAR_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16',
];

function getUserColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatRelativeTime(isoStr: string): string {
  const now = new Date();
  const date = new Date(isoStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const dateTime = date.getTime();

  const pad = (n: number) => n.toString().padStart(2, '0');
  const hhmm = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  if (dateTime >= todayStart) return `今天 ${hhmm}`;
  if (dateTime >= yesterdayStart) return `昨天 ${hhmm}`;
  if (diffDay < 7) return `${diffDay}天前`;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${hhmm}`;
}

function formatValue(val: any): string {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'boolean') return val ? '是' : '否';
  if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : '空';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function summarizeChanges(log: ActivityLog): { text: string; details: string[] } {
  const changes = log.changes || {};
  const keys = Object.keys(changes);
  const details: string[] = [];
  let text = '';

  switch (log.actionType) {
    case ActionType.task_create: {
      const name = changes.name?.new || '未命名任务';
      text = `创建了任务「${formatValue(name)}」`;
      break;
    }
    case ActionType.task_delete: {
      const name = changes.name?.old || '未知任务';
      text = `删除了任务「${formatValue(name)}」`;
      break;
    }
    case ActionType.task_update: {
      const fields = keys.filter((k) => k !== 'id');
      if (fields.length === 0) {
        text = '修改了任务';
      } else if (fields.length === 1) {
        const k = fields[0];
        const c = changes[k];
        text = `修改了任务的${FIELD_LABELS[k] || k}`;
        details.push(`${FIELD_LABELS[k] || k}: ${formatValue(c?.old)} → ${formatValue(c?.new)}`);
      } else {
        text = `修改了任务的${fields.length}个属性`;
        fields.slice(0, 3).forEach((k) => {
          const c = changes[k];
          details.push(`${FIELD_LABELS[k] || k}: ${formatValue(c?.old)} → ${formatValue(c?.new)}`);
        });
        if (fields.length > 3) details.push(`...等${fields.length}项`);
      }
      break;
    }
    case ActionType.task_move: {
      text = '移动了任务的父级';
      const c = changes.parentId;
      if (c) details.push(`父任务: ${formatValue(c.old)} → ${formatValue(c.new)}`);
      break;
    }
    case ActionType.dependency_create: {
      text = '添加了任务依赖';
      const src = changes.sourceTaskId?.new;
      const tgt = changes.targetTaskId?.new;
      if (src || tgt) details.push(`${formatValue(src)} → ${formatValue(tgt)}`);
      break;
    }
    case ActionType.dependency_delete: {
      text = '删除了任务依赖';
      const src = changes.sourceTaskId?.old;
      const tgt = changes.targetTaskId?.old;
      if (src || tgt) details.push(`${formatValue(src)} → ${formatValue(tgt)}`);
      break;
    }
    case ActionType.collaborator_add: {
      const name = changes.userName?.new || changes.userId?.new || '未知用户';
      const role = changes.role?.new;
      text = `添加了协作者「${formatValue(name)}」`;
      if (role) details.push(`角色: ${formatValue(role)}`);
      break;
    }
    case ActionType.collaborator_remove: {
      text = '移除了协作者';
      const uid = changes.userId?.old;
      if (uid) details.push(`用户ID: ${formatValue(uid)}`);
      break;
    }
    case ActionType.collaborator_role_change: {
      text = '修改了协作者角色';
      const c = changes.role;
      if (c) details.push(`角色: ${formatValue(c.old)} → ${formatValue(c.new)}`);
      break;
    }
    case ActionType.baseline_create: {
      const name = changes.name?.new || '未命名基线';
      text = `创建了基线「${formatValue(name)}」`;
      const v = changes.version?.new;
      const tc = changes.taskCount?.new;
      if (v !== undefined) details.push(`版本: v${formatValue(v)}`);
      if (tc !== undefined) details.push(`包含${formatValue(tc)}个任务`);
      break;
    }
    case ActionType.baseline_delete: {
      const name = changes.name?.old || '未知基线';
      text = `删除了基线「${formatValue(name)}」`;
      const v = changes.version?.old;
      if (v !== undefined) details.push(`版本: v${formatValue(v)}`);
      break;
    }
    default:
      text = ACTION_TYPE_LABELS[log.actionType] || '执行了操作';
  }

  return { text, details };
}

const UNDOABLE_ACTIONS: ActionType[] = [
  ActionType.task_create,
  ActionType.task_delete,
  ActionType.task_update,
  ActionType.task_move,
  ActionType.dependency_create,
  ActionType.dependency_delete,
  ActionType.collaborator_add,
  ActionType.collaborator_remove,
  ActionType.collaborator_role_change,
];

const UNDO_WINDOW_MS = 10 * 60 * 1000;

function canUndo(log: ActivityLog, currentUserId: string | null): boolean {
  if (!currentUserId) return false;
  if (log.userId !== currentUserId) return false;
  if (log.isUndo) return false;
  if (!UNDOABLE_ACTIONS.includes(log.actionType)) return false;
  const age = Date.now() - new Date(log.createdAt).getTime();
  return age < UNDO_WINDOW_MS;
}

const ITEM_HEIGHT = 76;
const BUFFER_ITEMS = 5;

interface ItemWithHighlight extends ActivityLog {
  _highlighted?: boolean;
  _highlightTime?: number;
  _undoDone?: boolean;
}

interface UndoDialogState {
  open: boolean;
  log?: ActivityLog;
  conflict?: UndoErrorResponse;
  loading: boolean;
}

interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error';
}

export default function ActivityLogPanel({
  projectId,
  currentUserId,
  externalLogs = [],
  onDataChanged,
}: ActivityLogPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<ActionType | 'all'>('all');
  const [logs, setLogs] = useState<ItemWithHighlight[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [, setTick] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerHeight = 600;

  const [undoDialog, setUndoDialog] = useState<UndoDialogState>({
    open: false,
    loading: false,
  });

  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: '',
    type: 'success',
  });

  const [undoingIds, setUndoingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30 * 1000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 2500);
  };

  const effectiveLogs = useMemo(() => {
    const combined = [...externalLogs, ...logs];
    const seen = new Set<string>();
    const unique: ItemWithHighlight[] = [];
    for (const l of combined) {
      if (!seen.has(l.id)) {
        seen.add(l.id);
        unique.push(l as ItemWithHighlight);
      }
    }
    unique.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const filtered =
      selectedFilter === 'all' ? unique : unique.filter((l) => l.actionType === selectedFilter);
    return filtered;
  }, [logs, externalLogs, selectedFilter]);

  const loadPage = useCallback(
    async (p: number, replace: boolean = false) => {
      if (loading) return;
      setLoading(true);
      try {
        const result = await activityLogsApi.list(
          projectId,
          p,
          20,
          selectedFilter === 'all' ? undefined : selectedFilter,
        );
        if (replace) {
          setLogs(result.items as ItemWithHighlight[]);
          setPage(p);
        } else {
          setLogs((prev) => {
            const seen = new Set(prev.map((l) => l.id));
            const extra = (result.items as ItemWithHighlight[]).filter((l) => !seen.has(l.id));
            return [...prev, ...extra];
          });
          setPage(p);
        }
        setHasMore(result.hasMore);
      } catch {
      } finally {
        setLoading(false);
      }
    },
    [projectId, selectedFilter, loading],
  );

  useEffect(() => {
    setLogs([]);
    setPage(1);
    setHasMore(true);
    loadPage(1, true);
  }, [projectId, selectedFilter, loadPage]);

  useEffect(() => {
    if (!externalLogs || externalLogs.length === 0) return;
    const now = Date.now();
    setLogs((prev) => {
      const seen = new Set(prev.map((l) => l.id));
      const newItems: ItemWithHighlight[] = [];
      for (const l of externalLogs) {
        if (!seen.has(l.id)) {
          newItems.push({ ...l, _highlighted: true, _highlightTime: now });
        }
      }
      if (newItems.length === 0) return prev;
      return [...newItems, ...prev];
    });
  }, [externalLogs]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || loading || !hasMore) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 100;
    if (nearBottom) {
      loadPage(page + 1);
    }
  };

  const visibleStart = scrollRef.current
    ? Math.max(0, Math.floor(scrollRef.current.scrollTop / ITEM_HEIGHT) - BUFFER_ITEMS)
    : 0;
  const visibleCount = Math.ceil(containerHeight / ITEM_HEIGHT) + BUFFER_ITEMS * 2;
  const visibleEnd = Math.min(effectiveLogs.length, visibleStart + visibleCount);

  const getUserInfo = (log: ItemWithHighlight): { name: string; color: string } => {
    const user = log.user as ActivityLogUser | undefined;
    const name = user?.name || '未知用户';
    const color = user?.cursorColor || getUserColor(name);
    return { name, color };
  };

  const handleUndoClick = (log: ActivityLog) => {
    setUndoDialog({
      open: true,
      log,
      loading: false,
    });
  };

  const closeUndoDialog = () => {
    if (!undoDialog.loading) {
      setUndoDialog({ open: false, loading: false });
    }
  };

  const executeUndo = async (force: boolean = false) => {
    if (!undoDialog.log) return;
    const logId = undoDialog.log.id;

    setUndoDialog((d) => ({ ...d, loading: true }));
    setUndoingIds((prev) => new Set(prev).add(logId));

    try {
      await activityLogsApi.undo(projectId, logId, force);
      setUndoDialog({ open: false, loading: false });
      setUndoingIds((prev) => {
        const next = new Set(prev);
        next.delete(logId);
        return next;
      });
      setLogs((prev) =>
        prev.map((l) => (l.id === logId ? { ...l, _undoDone: true } : l)),
      );
      showToast('已撤销', 'success');
      if (onDataChanged) {
        setTimeout(() => onDataChanged(), 100);
      }
    } catch (err: any) {
      const resp = err?.response?.data as UndoErrorResponse | undefined;
      if (resp && resp.code === 'CONFLICT') {
        setUndoDialog((d) => ({
          ...d,
          loading: false,
          conflict: resp,
        }));
      } else {
        setUndoDialog({ open: false, loading: false });
        setUndoingIds((prev) => {
          const next = new Set(prev);
          next.delete(logId);
          return next;
        });
        const msg = resp?.message || '撤销失败，请稍后重试';
        showToast(msg, 'error');
      }
    }
  };

  if (collapsed) {
    return (
      <div
        className="fixed top-0 right-0 h-full z-40 flex items-start"
        style={{ paddingTop: 80 }}
      >
        <button
          onClick={() => setCollapsed(false)}
          className="w-10 h-10 bg-white border border-r-0 border-gray-200 rounded-l-lg shadow-md flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
          title="打开活动日志"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 8v4l3 3"></path>
            <circle cx="12" cy="12" r="10"></circle>
          </svg>
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed top-0 right-0 h-full z-40 bg-white border-l border-gray-200 shadow-lg flex flex-col"
        style={{ width: 320 }}
      >
        {toast.show && (
          <div
            className={`absolute top-2 left-2 right-2 px-3 py-2 rounded-md shadow-md text-xs font-medium z-50 transition-all ${
              toast.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {toast.message}
          </div>
        )}

        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">活动日志</h3>
          <button
            onClick={() => setCollapsed(true)}
            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
            title="收起"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>

        <div className="px-3 py-2 border-b border-gray-100 bg-white">
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value as ActionType | 'all')}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">全部操作</option>
            {(Object.keys(ACTION_TYPE_LABELS) as ActionType[]).map((k) => (
              <option key={k} value={k}>
                {ACTION_TYPE_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
          style={{ height: containerHeight }}
        >
          {effectiveLogs.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs px-4 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 mb-2 opacity-50"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 8v4l3 3"></path>
                <circle cx="12" cy="12" r="10"></circle>
              </svg>
              暂无操作记录
            </div>
          ) : (
            <div style={{ height: effectiveLogs.length * ITEM_HEIGHT, position: 'relative' }}>
              {effectiveLogs.slice(visibleStart, visibleEnd).map((log, i) => {
                const index = visibleStart + i;
                const { name, color } = getUserInfo(log);
                const initial = name.charAt(0).toUpperCase();
                const { text, details } = summarizeChanges(log);
                const isSelf = currentUserId && log.userId === currentUserId;
                const isHighlighted = log._highlighted && log._highlightTime && Date.now() - log._highlightTime < 3000;
                const isUndoable = !log._undoDone && canUndo(log, currentUserId);
                const isThisUndoing = undoingIds.has(log.id);
                const hasUndoBadge = log.isUndo;

                return (
                  <div
                    key={log.id}
                    className={`absolute left-0 right-0 px-3 py-2 border-b border-gray-50 transition-colors ${
                      isHighlighted ? 'bg-yellow-50' : ''
                    } ${log._undoDone ? 'bg-gray-50 opacity-70' : ''}`}
                    style={{ top: index * ITEM_HEIGHT, height: ITEM_HEIGHT }}
                  >
                    <div className="flex gap-2 h-full">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                        style={{ backgroundColor: color, minWidth: 28 }}
                      >
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-center gap-1 text-xs flex-wrap">
                          <span className={`font-medium truncate ${isSelf ? 'text-blue-600' : 'text-gray-800'}`}>
                            {name}
                            {isSelf && <span className="ml-1 text-blue-500">(我)</span>}
                          </span>
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] text-gray-500 bg-gray-100 shrink-0"
                          >
                            {ACTION_TYPE_LABELS[log.actionType]}
                          </span>
                          {hasUndoBadge && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] text-purple-600 bg-purple-50 border border-purple-100 shrink-0"
                            >
                              已撤销
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-700 mt-0.5 leading-tight line-clamp-2">
                          {text}
                        </div>
                        <div className="flex items-end justify-between flex-1 min-h-0">
                          <div className="flex-1 min-w-0">
                            {details.length > 0 && (
                              <div className="mt-0.5 text-[11px] text-gray-500 space-y-0.5">
                                {details.slice(0, 1).map((d, di) => (
                                  <div key={di} className="truncate">
                                    {d}
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {formatRelativeTime(log.createdAt)}
                            </div>
                          </div>
                          {isUndoable && (
                            <div className="ml-2 shrink-0 pb-0.5">
                              <button
                                onClick={() => handleUndoClick(log)}
                                disabled={isThisUndoing}
                                className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                                  isThisUndoing
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'text-gray-400 hover:text-orange-600 hover:bg-orange-50'
                                }`}
                                title={isThisUndoing ? '撤销中...' : '撤销此操作'}
                              >
                                {isThisUndoing ? (
                                  <svg
                                    className="h-3.5 w-3.5 animate-spin"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                    ></circle>
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                  </svg>
                                ) : (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3.5 w-3.5"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M3 7v6h6"></path>
                                    <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6.7 3L3 13"></path>
                                  </svg>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {loading && (
            <div className="py-3 text-center text-xs text-gray-400">加载中...</div>
          )}

          {!hasMore && effectiveLogs.length > 0 && (
            <div className="py-3 text-center text-xs text-gray-400">— 没有更多了 —</div>
          )}
        </div>
      </div>

      {undoDialog.open && undoDialog.log && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-xl w-80 max-w-[90vw] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">
                {undoDialog.conflict ? '存在冲突' : '确认撤销'}
              </h3>
            </div>
            <div className="px-4 py-3">
              {undoDialog.conflict ? (
                <div className="space-y-2">
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2.5">
                    <div className="font-medium mb-1">⚠️ 检测到冲突</div>
                    <div>{undoDialog.conflict.message}</div>
                    {undoDialog.conflict.conflictFields && undoDialog.conflict.conflictFields.length > 0 && (
                      <div className="mt-1.5 text-amber-600">
                        冲突字段：{undoDialog.conflict.conflictFields.map((f) => FIELD_LABELS[f] || f).join('、')}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    强制回滚将覆盖后续修改，是否继续？
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-gray-600 bg-gray-50 rounded p-2.5 border border-gray-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="px-1.5 py-0.5 rounded text-[10px] text-gray-600 bg-gray-200">
                        {ACTION_TYPE_LABELS[undoDialog.log.actionType]}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {formatRelativeTime(undoDialog.log.createdAt)}
                      </span>
                    </div>
                    <div className="text-gray-700 leading-snug">
                      {summarizeChanges(undoDialog.log).text}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    确定要撤销此操作吗？撤销后将恢复到操作前的状态。
                  </div>
                </div>
              )}
            </div>
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
              {undoDialog.conflict ? (
                <>
                  <button
                    onClick={closeUndoDialog}
                    disabled={undoDialog.loading}
                    className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => executeUndo(true)}
                    disabled={undoDialog.loading}
                    className="px-3 py-1.5 text-xs rounded bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {undoDialog.loading ? (
                      <>
                        <svg
                          className="h-3 w-3 animate-spin"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        处理中
                      </>
                    ) : (
                      '强制回滚'
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={closeUndoDialog}
                    disabled={undoDialog.loading}
                    className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => executeUndo(false)}
                    disabled={undoDialog.loading}
                    className="px-3 py-1.5 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {undoDialog.loading ? (
                      <>
                        <svg
                          className="h-3 w-3 animate-spin"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        处理中
                      </>
                    ) : (
                      '确认撤销'
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
