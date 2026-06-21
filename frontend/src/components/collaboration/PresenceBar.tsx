'use client';

import React from 'react';
import { OnlineUser } from '@/lib/types';

interface PresenceBarProps {
  onlineUsers: OnlineUser[];
  tasks?: { id: string; name: string }[];
}

export const PresenceBar: React.FC<PresenceBarProps> = ({ onlineUsers, tasks = [] }) => {
  const taskMap = new Map(tasks.map((t) => [t.id, t.name]));

  const getInitials = (name: string) => {
    return name
      .split(/\s+/)
      .map((s) => s.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (onlineUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-2">
        {onlineUsers.map((user, idx) => {
          const editingTaskName = user.editingTaskId
            ? taskMap.get(user.editingTaskId)
            : undefined;

          return (
            <div
              key={user.socketId || user.userId + idx}
              className="relative group"
              style={{ zIndex: onlineUsers.length - idx }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ring-2 ring-white"
                style={{ backgroundColor: user.cursorColor || '#6B7280' }}
              >
                {getInitials(user.name)}
              </div>

              <div className="absolute bottom-full right-0 mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pointer-events-none">
                <div className="bg-gray-900 text-white text-xs rounded-md px-3 py-2 shadow-lg whitespace-nowrap">
                  <div className="font-medium">{user.name}</div>
                  {editingTaskName && (
                    <div className="text-gray-300 mt-0.5 flex items-center gap-1">
                      <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                      正在编辑: {editingTaskName}
                    </div>
                  )}
                </div>
                <div className="absolute top-full right-3 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          );
        })}
      </div>

      {onlineUsers.length > 0 && (
        <span className="text-xs text-gray-500 ml-2">
          {onlineUsers.length} 人在线
        </span>
      )}
    </div>
  );
};

export default PresenceBar;
