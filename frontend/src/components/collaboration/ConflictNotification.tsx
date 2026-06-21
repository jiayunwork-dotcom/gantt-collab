'use client';

import React, { useEffect, useState } from 'react';

export interface ConflictItem {
  id: string;
  taskId: string;
  taskName?: string;
  overriddenBy: string;
  overriddenByName: string;
  ts: number;
}

interface ConflictNotificationProps {
  conflicts: ConflictItem[];
  onDismiss: (id: string) => void;
}

export const ConflictNotification: React.FC<ConflictNotificationProps> = ({
  conflicts,
  onDismiss,
}) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {conflicts.map((conflict) => (
        <ConflictToast
          key={conflict.id}
          conflict={conflict}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};

interface ConflictToastProps {
  conflict: ConflictItem;
  onDismiss: (id: string) => void;
}

const ConflictToast: React.FC<ConflictToastProps> = ({ conflict, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 10);
    const dismissTimer = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => onDismiss(conflict.id), 300);
    }, 3000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
    };
  }, [conflict.id, onDismiss]);

  const handleClose = () => {
    setLeaving(true);
    setTimeout(() => onDismiss(conflict.id), 300);
  };

  return (
    <div
      className={`
        pointer-events-auto bg-white border border-yellow-300 rounded-lg shadow-lg
        min-w-[300px] max-w-sm overflow-hidden
        transform transition-all duration-300 ease-out
        ${visible && !leaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div className="flex items-start gap-3 p-4 bg-yellow-50">
        <div className="shrink-0 w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800">
            您的修改已被{' '}
            <span className="text-yellow-700 font-semibold">
              {conflict.overriddenByName}
            </span>{' '}
            覆盖
          </div>
          {conflict.taskName && (
            <div className="text-xs text-gray-500 mt-1">
              任务: {conflict.taskName}
            </div>
          )}
        </div>

        <button
          onClick={handleClose}
          className="shrink-0 p-1 text-gray-400 hover:text-gray-600 hover:bg-yellow-100 rounded"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="h-1 bg-yellow-200">
        <div
          className="h-full bg-yellow-500 transition-all"
          style={{
            animation: 'conflict-progress 3s linear forwards',
          }}
        />
      </div>

      <style jsx>{`
        @keyframes conflict-progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
};

export default ConflictNotification;
