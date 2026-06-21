'use client';

import React from 'react';

export interface CursorData {
  userId: string;
  name: string;
  cursorColor: string;
  socketId?: string;
  taskId?: string;
  x?: number;
  y?: number;
}

interface LiveCursorsProps {
  cursors: CursorData[];
}

export const LiveCursors: React.FC<LiveCursorsProps> = ({ cursors }) => {
  const visibleCursors = cursors.filter(
    (c) => typeof c.x === 'number' && typeof c.y === 'number'
  );

  if (visibleCursors.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {visibleCursors.map((cursor) => (
        <div
          key={cursor.socketId || cursor.userId}
          className="absolute"
          style={{
            left: cursor.x,
            top: cursor.y,
            transform: 'translate(-1px, -1px)',
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            style={{
              color: cursor.cursorColor,
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
            }}
          >
            <path
              d="M5.5 3.5L18 13L12.5 13.5L10 18.5L5.5 3.5Z"
              fill="currentColor"
              stroke="white"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>

          <div
            className="absolute left-5 top-4 px-2 py-1 rounded-md text-white text-xs font-medium whitespace-nowrap shadow-lg"
            style={{ backgroundColor: cursor.cursorColor }}
          >
            {cursor.name}
          </div>
        </div>
      ))}
    </div>
  );
};

export default LiveCursors;
