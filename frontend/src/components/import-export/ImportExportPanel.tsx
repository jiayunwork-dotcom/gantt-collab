'use client';

import React, { useState, useRef } from 'react';
import clsx from 'clsx';
import { Task, Resource } from '@/lib/types';

interface ImportExportPanelProps {
  tasks: Task[];
  resources: Resource[];
  onImportTasks?: (tasks: Partial<Task>[]) => void;
  onImportResources?: (resources: Partial<Resource>[]) => void;
}

interface ColumnMapping {
  [fileColumn: string]: string | null;
}

const TASK_FIELDS = [
  { key: 'name', label: '名称', required: true },
  { key: 'startDate', label: '开始日期', required: true },
  { key: 'endDate', label: '结束日期', required: true },
  { key: 'progress', label: '进度', required: false },
  { key: 'priority', label: '优先级', required: false },
  { key: 'assigneeId', label: '负责人', required: false },
  { key: 'tags', label: '标签', required: false },
  { key: 'description', label: '描述', required: false },
  { key: 'parentId', label: '父任务ID', required: false },
  { key: 'isMilestone', label: '里程碑', required: false },
  { key: 'dailyHours', label: '每日工时', required: false },
];

export const ImportExportPanel: React.FC<ImportExportPanelProps> = ({
  tasks,
  resources,
  onImportTasks,
  onImportResources,
}) => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<'csv' | 'json'>('csv');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportCSV = () => {
    if (tasks.length === 0) {
      alert('没有可导出的任务数据');
      return;
    }

    const headers = [
      'ID',
      '名称',
      '描述',
      '父任务ID',
      '开始日期',
      '结束日期',
      '进度',
      '优先级',
      '负责人ID',
      '标签',
      '里程碑',
      '每日工时',
      '排序',
    ];

    const rows = tasks.map((t) => [
      t.id,
      t.name,
      t.description || '',
      t.parentId || '',
      t.startDate,
      t.endDate,
      t.progress,
      t.priority,
      t.assigneeId || '',
      (t.tags || []).join(';'),
      t.isMilestone ? '是' : '否',
      t.dailyHours,
      t.sortOrder,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell ?? '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      )
      .join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      tasks,
      resources,
    };

    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gantt_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = (type: 'csv' | 'json') => {
    setImportType(type);
    setPreviewData([]);
    setHeaders([]);
    setColumnMapping({});
    setFileName('');
    setShowImportModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    if (importType === 'csv') {
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
        if (lines.length === 0) return;

        const parsedHeaders = parseCSVLine(lines[0]);
        const data = lines.slice(1, 11).map((line) => {
          const values = parseCSVLine(line);
          const row: Record<string, any> = {};
          parsedHeaders.forEach((h, i) => {
            row[h] = values[i] ?? '';
          });
          return row;
        });

        setHeaders(parsedHeaders);
        setPreviewData(data);

        const autoMapping: ColumnMapping = {};
        parsedHeaders.forEach((h) => {
          const matched = TASK_FIELDS.find(
            (f) =>
              f.label === h ||
              f.key.toLowerCase() === h.toLowerCase() ||
              f.key === h
          );
          autoMapping[h] = matched ? matched.key : null;
        });
        setColumnMapping(autoMapping);
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.onload = (event) => {
        try {
          const content = JSON.parse(event.target?.result as string);
          const tasksToPreview = content.tasks || content || [];
          setPreviewData(tasksToPreview.slice(0, 10));
          if (tasksToPreview.length > 0) {
            setHeaders(Object.keys(tasksToPreview[0]));
            const autoMapping: ColumnMapping = {};
            Object.keys(tasksToPreview[0]).forEach((h) => {
              const matched = TASK_FIELDS.find(
                (f) => f.key.toLowerCase() === h.toLowerCase() || f.key === h
              );
              autoMapping[h] = matched ? matched.key : null;
            });
            setColumnMapping(autoMapping);
          }
        } catch {
          alert('JSON 文件解析失败');
        }
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const handleMappingChange = (fileColumn: string, targetField: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [fileColumn]: targetField === '' ? null : targetField,
    }));
  };

  const handleConfirmImport = () => {
    if (!onImportTasks) return;

    const requiredFields = TASK_FIELDS.filter((f) => f.required);
    const missingRequired = requiredFields.filter(
      (f) => !Object.values(columnMapping).includes(f.key)
    );

    if (missingRequired.length > 0) {
      alert(
        `请映射以下必填字段: ${missingRequired.map((f) => f.label).join(', ')}`
      );
      return;
    }

    const importedTasks: Partial<Task>[] = previewData.map((row) => {
      const task: Partial<Task> = {};
      Object.entries(columnMapping).forEach(([fileCol, targetField]) => {
        if (targetField && row[fileCol] !== undefined) {
          let value: any = row[fileCol];
          if (targetField === 'progress' || targetField === 'dailyHours') {
            value = Number(value) || 0;
          }
          if (targetField === 'isMilestone') {
            value = value === '是' || value === true || value === 'true';
          }
          if (targetField === 'tags') {
            value = String(value)
              .split(/[,;]/)
              .map((s) => s.trim())
              .filter(Boolean);
          }
          (task as any)[targetField] = value;
        }
      });
      return task;
    });

    onImportTasks(importedTasks);
    setShowImportModal(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">数据导入 / 导出</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            导出 CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            导出 JSON
          </button>
          <button
            onClick={() => handleImportClick('csv')}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            导入 CSV
          </button>
          <button
            onClick={() => handleImportClick('json')}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            导入 JSON
          </button>
        </div>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-800">
                导入 {importType.toUpperCase()} 文件
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择文件
                </label>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={importType === 'csv' ? '.csv' : '.json'}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
                  >
                    选择文件
                  </button>
                  {fileName && (
                    <span className="text-sm text-gray-600">{fileName}</span>
                  )}
                </div>
              </div>

              {headers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    列映射配置
                  </label>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-2 bg-gray-50 border-b border-gray-200">
                      <div className="px-3 py-2 text-xs font-medium text-gray-600 border-r border-gray-200">
                        文件列名
                      </div>
                      <div className="px-3 py-2 text-xs font-medium text-gray-600">
                        目标字段
                      </div>
                    </div>
                    {headers.map((h) => (
                      <div
                        key={h}
                        className="grid grid-cols-2 border-b border-gray-100 last:border-0"
                      >
                        <div className="px-3 py-2 text-sm text-gray-700 border-r border-gray-200 flex items-center gap-2">
                          {h}
                          {TASK_FIELDS.some(
                            (f) =>
                              f.required &&
                              Object.values(columnMapping).includes(f.key) === false
                          ) &&
                            TASK_FIELDS.find(
                              (f) =>
                                f.required &&
                                (f.label === h ||
                                  f.key.toLowerCase() === h.toLowerCase())
                            ) && (
                              <span className="text-red-500 text-xs">*必填</span>
                            )}
                        </div>
                        <div className="px-2 py-1">
                          <select
                            value={columnMapping[h] || ''}
                            onChange={(e) => handleMappingChange(h, e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                          >
                            <option value="">-- 不导入 --</option>
                            {TASK_FIELDS.map((f) => (
                              <option key={f.key} value={f.key}>
                                {f.label}
                                {f.required ? ' *' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {previewData.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    数据预览 (前 {previewData.length} 行)
                  </label>
                  <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {headers.map((h, i) => (
                            <th
                              key={i}
                              className="px-3 py-2 text-left text-gray-600 font-medium border-r border-gray-200 last:border-0 whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, ri) => (
                          <tr key={ri} className="border-t border-gray-100">
                            {headers.map((h, ci) => (
                              <td
                                key={ci}
                                className="px-3 py-1.5 text-gray-700 border-r border-gray-100 last:border-0 truncate max-w-[150px]"
                                title={String(row[h] ?? '')}
                              >
                                {String(row[h] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={previewData.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImportExportPanel;
