import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { createObjectCsvStringifier } from 'csv-writer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { Task, TaskPriority } from '../../entities/task.entity';
import { Dependency } from '../../entities/dependency.entity';
import { Resource } from '../../entities/resource.entity';
import { Project } from '../../entities/project.entity';

export interface ColumnMapping {
  id?: string;
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  progress?: string;
  priority?: string;
  tags?: string;
  assigneeId?: string;
  parentId?: string;
  isMilestone?: string;
  dailyHours?: string;
}

export interface JsonExportData {
  projectInfo: {
    id: string;
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  tasks: Task[];
  dependencies: Dependency[];
  resources: Resource[];
  exportedAt: Date;
}

export interface ImportResult {
  tasksCreated: number;
  tasksUpdated: number;
  tasksSkipped: number;
  dependenciesCreated: number;
  resourcesCreated: number;
  resourcesUpdated: number;
}

const DEFAULT_COLUMN_MAPPING: ColumnMapping = {
  id: 'id',
  name: 'name',
  description: 'description',
  startDate: 'startDate',
  endDate: 'endDate',
  progress: 'progress',
  priority: 'priority',
  tags: 'tags',
  assigneeId: 'assigneeId',
  parentId: 'parentId',
  isMilestone: 'isMilestone',
  dailyHours: 'dailyHours',
};

const CSV_COLUMNS = [
  { id: 'id', title: 'id' },
  { id: 'name', title: 'name' },
  { id: 'description', title: 'description' },
  { id: 'startDate', title: 'startDate' },
  { id: 'endDate', title: 'endDate' },
  { id: 'progress', title: 'progress' },
  { id: 'priority', title: 'priority' },
  { id: 'tags', title: 'tags' },
  { id: 'assigneeId', title: 'assigneeId' },
  { id: 'parentId', title: 'parentId' },
  { id: 'isMilestone', title: 'isMilestone' },
  { id: 'dailyHours', title: 'dailyHours' },
];

@Injectable()
export class ImportExportService {
  constructor(
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    @InjectRepository(Dependency)
    private dependencyRepository: Repository<Dependency>,
    @InjectRepository(Resource)
    private resourceRepository: Repository<Resource>,
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
  ) {}

  async exportToCsv(projectId: string): Promise<string> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const tasks = await this.taskRepository.find({
      where: { projectId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    const csvStringifier = createObjectCsvStringifier({
      header: CSV_COLUMNS,
    });

    const records = tasks.map((task) => ({
      id: task.id,
      name: task.name,
      description: task.description || '',
      startDate: task.startDate,
      endDate: task.endDate,
      progress: task.progress,
      priority: task.priority,
      tags: (task.tags || []).join(','),
      assigneeId: task.assigneeId || '',
      parentId: task.parentId || '',
      isMilestone: task.isMilestone ? 'true' : 'false',
      dailyHours: task.dailyHours,
    }));

    const headerLine = csvStringifier.getHeaderString();
    const bodyLines = csvStringifier.stringifyRecords(records);
    const csvContent = headerLine + '\n' + bodyLines;

    const BOM = '\uFEFF';
    return BOM + csvContent;
  }

  async exportToJson(projectId: string): Promise<JsonExportData> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const [tasks, dependencies, resources] = await Promise.all([
      this.taskRepository.find({
        where: { projectId },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      }),
      this.dependencyRepository.find({ where: { projectId } }),
      this.resourceRepository.find({ where: { projectId } }),
    ]);

    return {
      projectInfo: {
        id: project.id,
        name: project.name,
        description: project.description || '',
        startDate: project.startDate || '',
        endDate: project.endDate || '',
        ownerId: project.ownerId,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      tasks,
      dependencies,
      resources,
      exportedAt: new Date(),
    };
  }

  async importFromCsv(
    projectId: string,
    fileContent: string,
    columnMapping?: ColumnMapping,
  ): Promise<ImportResult> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    let content = fileContent;
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    const mapping: ColumnMapping = { ...DEFAULT_COLUMN_MAPPING, ...(columnMapping || {}) };

    const rows = await this.parseCsv(content);

    const existingTasks = await this.taskRepository.find({ where: { projectId } });
    const existingTaskIds = new Set(existingTasks.map((t) => t.id));

    const result: ImportResult = {
      tasksCreated: 0,
      tasksUpdated: 0,
      tasksSkipped: 0,
      dependenciesCreated: 0,
      resourcesCreated: 0,
      resourcesUpdated: 0,
    };

    const tasksToUpsert: Task[] = [];
    const validIds = new Set<string>();

    for (const row of rows) {
      const taskData = this.mapRowToTask(row, mapping);

      if (!taskData.name) {
        result.tasksSkipped++;
        continue;
      }

      if (taskData.id && !this.isValidId(taskData.id)) {
        taskData.id = undefined;
      }

      if (taskData.parentId && !this.isValidId(taskData.parentId)) {
        taskData.parentId = undefined;
      }

      if (taskData.id && existingTaskIds.has(taskData.id)) {
        const existingTask = existingTasks.find((t) => t.id === taskData.id);
        if (existingTask) {
          Object.assign(existingTask, {
            name: taskData.name,
            description: taskData.description,
            startDate: taskData.startDate,
            endDate: taskData.endDate,
            progress: taskData.progress,
            priority: taskData.priority,
            tags: taskData.tags,
            assigneeId: taskData.assigneeId,
            parentId: taskData.parentId,
            isMilestone: taskData.isMilestone,
            dailyHours: taskData.dailyHours,
          });
          tasksToUpsert.push(existingTask);
          result.tasksUpdated++;
          validIds.add(taskData.id);
          continue;
        }
      }

      const newTask = this.taskRepository.create({
        ...taskData,
        projectId,
      });
      tasksToUpsert.push(newTask);
      result.tasksCreated++;
    }

    if (tasksToUpsert.length > 0) {
      const saved = await this.taskRepository.save(tasksToUpsert);
      saved.forEach((t) => validIds.add(t.id));
    }

    return result;
  }

  async importFromJson(projectId: string, jsonData: any): Promise<ImportResult> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const result: ImportResult = {
      tasksCreated: 0,
      tasksUpdated: 0,
      tasksSkipped: 0,
      dependenciesCreated: 0,
      resourcesCreated: 0,
      resourcesUpdated: 0,
    };

    const existingTasks = await this.taskRepository.find({ where: { projectId } });
    const existingTaskMap = new Map(existingTasks.map((t) => [t.id, t]));
    const idMapping = new Map<string, string>();

    if (jsonData.tasks && Array.isArray(jsonData.tasks)) {
      const tasksToUpsert: Task[] = [];

      for (const taskData of jsonData.tasks) {
        const originalId = taskData.id;

        if (!taskData.name) {
          result.tasksSkipped++;
          continue;
        }

        const sanitizedTaskData = this.sanitizeTaskData(taskData);

        if (originalId && existingTaskMap.has(originalId)) {
          const existingTask = existingTaskMap.get(originalId);
          Object.assign(existingTask, {
            ...sanitizedTaskData,
            projectId,
            id: originalId,
          });
          tasksToUpsert.push(existingTask);
          result.tasksUpdated++;
          idMapping.set(originalId, originalId);
        } else {
          const newTask = this.taskRepository.create({
            ...sanitizedTaskData,
            projectId,
            id: undefined,
          });
          tasksToUpsert.push(newTask);

          if (originalId) {
            idMapping.set(originalId, 'pending-' + tasksToUpsert.length);
          }
        }
      }

      if (tasksToUpsert.length > 0) {
        const savedTasks = await this.taskRepository.save(tasksToUpsert);
        let pendingIdx = 0;
        for (let i = 0; i < tasksToUpsert.length; i++) {
          const original = tasksToUpsert[i];
          const saved = savedTasks[i];
          if (!existingTaskMap.has(original.id || '')) {
            const pendingKey = 'pending-' + (pendingIdx + 1);
            for (const [key, value] of idMapping.entries()) {
              if (value === pendingKey) {
                idMapping.set(key, saved.id);
                break;
              }
            }
            pendingIdx++;
            result.tasksCreated++;
          }
        }

        for (const saved of savedTasks) {
          if (saved.parentId && idMapping.has(saved.parentId)) {
            saved.parentId = idMapping.get(saved.parentId);
          }
        }
        await this.taskRepository.save(savedTasks);
      }
    }

    if (jsonData.dependencies && Array.isArray(jsonData.dependencies)) {
      const depsToCreate: Dependency[] = [];
      const allTaskIds = (await this.taskRepository.find({ where: { projectId } })).map(
        (t) => t.id,
      );
      const allTaskIdSet = new Set(allTaskIds);

      for (const depData of jsonData.dependencies) {
        let sourceId = depData.sourceTaskId;
        let targetId = depData.targetTaskId;

        if (idMapping.has(sourceId)) {
          sourceId = idMapping.get(sourceId);
        }
        if (idMapping.has(targetId)) {
          targetId = idMapping.get(targetId);
        }

        if (!sourceId || !targetId) {
          continue;
        }
        if (!allTaskIdSet.has(sourceId) || !allTaskIdSet.has(targetId)) {
          continue;
        }
        if (sourceId === targetId) {
          continue;
        }

        depsToCreate.push(
          this.dependencyRepository.create({
            projectId,
            sourceTaskId: sourceId,
            targetTaskId: targetId,
            type: depData.type || 'FS',
            lag: depData.lag || 0,
          }),
        );
      }

      if (depsToCreate.length > 0) {
        await this.dependencyRepository.save(depsToCreate);
        result.dependenciesCreated = depsToCreate.length;
      }
    }

    if (jsonData.resources && Array.isArray(jsonData.resources)) {
      const existingResources = await this.resourceRepository.find({ where: { projectId } });
      const existingResourceMap = new Map(existingResources.map((r) => [r.id, r]));

      const resourcesToUpsert: Resource[] = [];

      for (const resourceData of jsonData.resources) {
        const sanitizedData = this.sanitizeResourceData(resourceData);

        if (!sanitizedData.name) {
          continue;
        }

        if (resourceData.id && existingResourceMap.has(resourceData.id)) {
          const existing = existingResourceMap.get(resourceData.id);
          Object.assign(existing, sanitizedData);
          resourcesToUpsert.push(existing);
          result.resourcesUpdated++;
        } else {
          resourcesToUpsert.push(
            this.resourceRepository.create({
              ...sanitizedData,
              projectId,
            }),
          );
          result.resourcesCreated++;
        }
      }

      if (resourcesToUpsert.length > 0) {
        await this.resourceRepository.save(resourcesToUpsert);
      }
    }

    return result;
  }

  private parseCsv(content: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = Readable.from(content);

      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (err) => reject(new BadRequestException('Failed to parse CSV: ' + err.message)));
    });
  }

  private mapRowToTask(row: any, mapping: ColumnMapping): Partial<Task> {
    const getValue = (field: keyof ColumnMapping) => {
      const colName = mapping[field];
      if (!colName) return undefined;
      return row[colName];
    };

    const parseBoolean = (val: any): boolean => {
      if (val === undefined || val === null || val === '') return false;
      const str = String(val).toLowerCase().trim();
      return str === 'true' || str === '1' || str === 'yes' || str === 'y';
    };

    const parseNumber = (val: any, def: number = 0): number => {
      const num = parseInt(val, 10);
      return isNaN(num) ? def : num;
    };

    const parsePriority = (val: any): TaskPriority => {
      if (!val) return TaskPriority.MEDIUM;
      const str = String(val).toLowerCase().trim();
      switch (str) {
        case 'urgent':
          return TaskPriority.URGENT;
        case 'high':
          return TaskPriority.HIGH;
        case 'low':
          return TaskPriority.LOW;
        default:
          return TaskPriority.MEDIUM;
      }
    };

    const parseTags = (val: any): string[] => {
      if (!val) return [];
      return String(val)
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    };

    const parseDate = (val: any): string => {
      if (!val) return '';
      const str = String(val).trim();
      if (!str) return '';
      const date = new Date(str);
      if (isNaN(date.getTime())) return str;
      return date.toISOString().split('T')[0];
    };

    return {
      id: getValue('id'),
      name: String(getValue('name') || '').trim(),
      description: String(getValue('description') || '').trim(),
      startDate: parseDate(getValue('startDate')),
      endDate: parseDate(getValue('endDate')),
      progress: Math.min(100, Math.max(0, parseNumber(getValue('progress'), 0))),
      priority: parsePriority(getValue('priority')),
      tags: parseTags(getValue('tags')),
      assigneeId: getValue('assigneeId') || undefined,
      parentId: getValue('parentId') || undefined,
      isMilestone: parseBoolean(getValue('isMilestone')),
      dailyHours: Math.max(0, parseNumber(getValue('dailyHours'), 8)),
    };
  }

  private sanitizeTaskData(data: any): Partial<Task> {
    return {
      name: String(data.name || '').trim(),
      description: String(data.description || '').trim(),
      startDate: data.startDate || '',
      endDate: data.endDate || '',
      progress: Math.min(100, Math.max(0, parseInt(data.progress, 10) || 0)),
      priority: this.parsePriorityEnum(data.priority),
      tags: Array.isArray(data.tags) ? data.tags.filter((t: string) => t) : [],
      assigneeId: data.assigneeId || undefined,
      parentId: data.parentId || undefined,
      isMilestone: Boolean(data.isMilestone),
      dailyHours: Math.max(0, parseInt(data.dailyHours, 10) || 8),
      sortOrder: parseInt(data.sortOrder, 10) || 0,
    };
  }

  private sanitizeResourceData(data: any): Partial<Resource> {
    return {
      name: String(data.name || '').trim(),
      role: data.role || undefined,
      dailyCapacity: Math.max(0, parseInt(data.dailyCapacity, 10) || 8),
      userId: data.userId || undefined,
    };
  }

  private parsePriorityEnum(val: any): TaskPriority {
    if (!val) return TaskPriority.MEDIUM;
    const values = Object.values(TaskPriority) as string[];
    if (values.includes(String(val))) {
      return val as TaskPriority;
    }
    return TaskPriority.MEDIUM;
  }

  private isValidId(id: string): boolean {
    if (!id) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }
}
