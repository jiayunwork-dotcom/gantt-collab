'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { Project, Collaborator, CollaboratorRole, User } from '@/lib/types';

interface PermissionsPanelProps {
  project: Project;
  collaborators: Collaborator[];
  currentUserId?: string;
  onUpdateRole: (collaboratorId: string, role: CollaboratorRole) => void;
  onRemove: (collaboratorId: string) => void;
  onInvite: (email: string, role: CollaboratorRole, expiresInDays: number) => void;
}

const roleLabels: Record<CollaboratorRole, string> = {
  owner: '所有者',
  editor: '编辑者',
  viewer: '查看者',
};

const roleColors: Record<CollaboratorRole, string> = {
  owner: 'bg-purple-100 text-purple-700',
  editor: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-600',
};

export const PermissionsPanel: React.FC<PermissionsPanelProps> = ({
  project,
  collaborators,
  currentUserId,
  onUpdateRole,
  onRemove,
  onInvite,
}) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CollaboratorRole>(CollaboratorRole.editor);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(/\s+/)
      .map((s) => s.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleGenerateLink = () => {
    if (!inviteEmail.trim()) return;
    onInvite(inviteEmail.trim(), inviteRole, expiresInDays);
    const fakeToken = Math.random().toString(36).substring(2, 15);
    setGeneratedLink(
      `${window.location.origin}/invite/${fakeToken}?project=${project.id}`
    );
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Failed to copy');
    }
  };

  const sortedCollaborators = [...collaborators].sort((a, b) => {
    const roleOrder = { owner: 0, editor: 1, viewer: 2 };
    return roleOrder[a.role] - roleOrder[b.role];
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-base font-semibold text-gray-800">协作者与权限</h3>
        <p className="text-xs text-gray-500 mt-1">
          管理项目 {project.name} 的协作者访问权限
        </p>
      </div>

      <div className="p-5">
        <div className="mb-6 pb-6 border-b border-gray-100">
          <h4 className="text-sm font-medium text-gray-700 mb-3">邀请协作者</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">邮箱地址</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="输入协作者邮箱..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">角色</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as CollaboratorRole)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                >
                  <option value={CollaboratorRole.editor}>编辑者</option>
                  <option value={CollaboratorRole.viewer}>查看者</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">有效期</label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                >
                  <option value={1}>1 天</option>
                  <option value={7}>7 天</option>
                  <option value={30}>30 天</option>
                  <option value={0}>永不过期</option>
                </select>
              </div>
            </div>

            {!generatedLink ? (
              <button
                onClick={handleGenerateLink}
                disabled={!inviteEmail.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                生成邀请链接
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={generatedLink}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-600"
                />
                <button
                  onClick={handleCopyLink}
                  className={clsx(
                    'px-4 py-2 text-sm rounded-md flex items-center gap-1 transition-colors',
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      已复制
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      复制
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setGeneratedLink(null);
                    setInviteEmail('');
                  }}
                  className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-md"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            协作者 ({sortedCollaborators.length})
          </h4>
          <div className="space-y-2">
            {sortedCollaborators.map((collab) => {
              const user = collab.user as User | undefined;
              const isCurrentUser = currentUserId && collab.userId === currentUserId;
              const isOwner = collab.role === CollaboratorRole.owner;

              return (
                <div
                  key={collab.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group"
                >
                  <div
                    className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-medium shrink-0"
                  >
                    {user ? getInitials(user.name) : '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 flex items-center gap-2">
                      {user?.name || collab.userId}
                      {isCurrentUser && (
                        <span className="text-xs text-blue-600">(你)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {user?.email || ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={collab.role}
                      onChange={(e) =>
                        onUpdateRole(collab.id, e.target.value as CollaboratorRole)
                      }
                      disabled={isOwner || isCurrentUser}
                      className={clsx(
                        'px-2 py-1 text-xs rounded font-medium focus:outline-none',
                        roleColors[collab.role],
                        (isOwner || isCurrentUser) && 'opacity-70 cursor-not-allowed'
                      )}
                    >
                      {Object.values(CollaboratorRole).map((role) => (
                        <option
                          key={role}
                          value={role}
                          className="bg-white text-gray-800"
                        >
                          {roleLabels[role]}
                        </option>
                      ))}
                    </select>

                    {!isOwner && !isCurrentUser && (
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `确定移除 ${user?.name || '该协作者'} 从项目?`
                            )
                          ) {
                            onRemove(collab.id);
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="移除"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {sortedCollaborators.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-400">
                暂无协作者
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionsPanel;
