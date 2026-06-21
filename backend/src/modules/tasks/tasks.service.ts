import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../../entities/task.entity';
import { Dependency, DependencyType } from '../../entities/dependency.entity';
import { Project } from '../../entities/project.entity';
import { Collaborator, CollaboratorRole } from '../../entities/collaborator.entity';
import { ActionType, TargetType } from '../../entities/activity-log.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    @InjectRepository(Dependency)
    private dependenciesRepository: Repository<Dependency>,
    @InjectRepository(Project)
    private projectsRepository: Repository<Project>,
    @InjectRepository(Collaborator)
    private collaboratorsRepository: Repository<Collaborator>,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async checkPermission(projectId: string, userId: string): Promise<void> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.ownerId === userId) {
      return;
    }
    const collaborator = await this.collaboratorsRepository.findOne({
      where: { projectId, userId },
    });
    if (
      !collaborator ||
      (collaborator.role !== CollaboratorRole.OWNER &&
        collaborator.role !== CollaboratorRole.EDITOR)
    ) {
      throw new ForbiddenException('You do not have permission to edit this project');
    }
  }

  private calculateDuration(startDate: string, endDate: string, isMilestone: boolean): number {
    if (isMilestone) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(0, diffDays);
  }

  async create(projectId: string, dto: CreateTaskDto, userId?: string): Promise<Task> {
    if (dto.isMilestone && dto.startDate !== dto.endDate) {
      throw new BadRequestException('Milestone startDate must equal endDate');
    }

    if (dto.parentId) {
      const parent = await this.tasksRepository.findOne({
        where: { id: dto.parentId, projectId },
      });
      if (!parent) {
        throw new NotFoundException('Parent task not found');
      }
      if (dto.startDate < parent.startDate || dto.endDate > parent.endDate) {
        throw new BadRequestException(
          'Child task dates must be within parent task date range',
        );
      }
    }

    const maxSortOrder = await this.tasksRepository
      .createQueryBuilder('t')
      .select('COALESCE(MAX(t.sortOrder), -1)', 'max')
      .where('t.projectId = :projectId', { projectId })
      .andWhere(dto.parentId ? 't.parentId = :parentId' : 't.parentId IS NULL', {
        parentId: dto.parentId,
      })
      .getRawOne();

    const duration = this.calculateDuration(dto.startDate, dto.endDate, !!dto.isMilestone);

    const task = this.tasksRepository.create({
      projectId,
      name: dto.name,
      description: dto.description,
      startDate: dto.startDate,
      endDate: dto.endDate,
      progress: dto.progress ?? 0,
      priority: dto.priority,
      tags: dto.tags ?? [],
      assigneeId: dto.assigneeId,
      parentId: dto.parentId,
      isMilestone: dto.isMilestone ?? false,
      dailyHours: dto.dailyHours ?? 8,
      sortOrder: (maxSortOrder?.max ?? -1) + 1,
      duration,
    });

    const saved = await this.tasksRepository.save(task);
    await this.computeCriticalPath(projectId);
    const result = await this.tasksRepository.findOne({ where: { id: saved.id } });

    if (userId && result) {
      const snapshot: Record<string, any> = {};
      for (const k of Object.keys(dto) as Array<keyof typeof dto>) {
        if (dto[k] !== undefined) {
          snapshot[k] = { old: undefined, new: (dto as any)[k] };
        }
      }
      snapshot.id = { old: undefined, new: result.id };
      await this.activityLogsService.create({
        projectId,
        userId,
        actionType: ActionType.TASK_CREATE,
        targetType: TargetType.TASK,
        targetId: result.id,
        changes: snapshot,
      });
    }

    return result;
  }

  async findAll(projectId: string): Promise<{ tasks: Task[]; dependencies: Dependency[] }> {
    const [tasks, dependencies] = await Promise.all([
      this.tasksRepository.find({
        where: { projectId },
        order: { sortOrder: 'ASC' },
      }),
      this.dependenciesRepository.find({ where: { projectId } }),
    ]);
    await this.computeCriticalPath(projectId);
    const updatedTasks = await this.tasksRepository.find({
      where: { projectId },
      order: { sortOrder: 'ASC' },
    });
    return { tasks: updatedTasks, dependencies };
  }

  async findOne(projectId: string, taskId: string): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId, projectId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async update(projectId: string, taskId: string, dto: UpdateTaskDto, userId?: string): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId, projectId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const startDate = dto.startDate ?? task.startDate;
    const endDate = dto.endDate ?? task.endDate;
    const isMilestone = dto.isMilestone ?? task.isMilestone;
    const parentId = dto.parentId ?? task.parentId;

    if (isMilestone && startDate !== endDate) {
      throw new BadRequestException('Milestone startDate must equal endDate');
    }

    if (parentId && parentId !== task.parentId) {
      const parent = await this.tasksRepository.findOne({
        where: { id: parentId, projectId },
      });
      if (!parent) {
        throw new NotFoundException('Parent task not found');
      }
      if (startDate < parent.startDate || endDate > parent.endDate) {
        throw new BadRequestException(
          'Child task dates must be within parent task date range',
        );
      }
    }

    const duration = this.calculateDuration(startDate, endDate, isMilestone);

    const changes: Record<string, { old: any; new: any }> = {};
    const before: any = { ...task };

    await this.tasksRepository.update(taskId, {
      ...dto,
      duration,
    });

    await this.computeCriticalPath(projectId);
    const result = await this.tasksRepository.findOne({ where: { id: taskId } });

    if (userId && result) {
      const trackFields = [
        'name', 'description', 'startDate', 'endDate', 'progress', 'priority',
        'tags', 'assigneeId', 'parentId', 'isMilestone', 'dailyHours',
      ];
      for (const f of trackFields) {
        const oldVal = before[f];
        const newVal = (result as any)[f];
        const oldStr = JSON.stringify(oldVal);
        const newStr = JSON.stringify(newVal);
        if (oldStr !== newStr) {
          changes[f] = { old: oldVal, new: newVal };
        }
      }
      if (Object.keys(changes).length > 0) {
        await this.activityLogsService.create({
          projectId,
          userId,
          actionType: ActionType.TASK_UPDATE,
          targetType: TargetType.TASK,
          targetId: taskId,
          changes,
        });
      }
    }

    return result;
  }

  async remove(projectId: string, taskId: string, userId?: string): Promise<void> {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId, projectId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const snapshot: Record<string, any> = {};
    if (userId) {
      const keys = ['id', 'name', 'startDate', 'endDate', 'parentId', 'progress', 'priority', 'isMilestone'];
      for (const k of keys) {
        snapshot[k] = { old: (task as any)[k], new: undefined };
      }
    }

    const childTaskIds = await this.collectChildTaskIds(projectId, taskId);
    const allIds = [taskId, ...childTaskIds];

    await this.dependenciesRepository
      .createQueryBuilder()
      .delete()
      .where('projectId = :projectId', { projectId })
      .andWhere('(sourceTaskId IN (:...ids) OR targetTaskId IN (:...ids))', { ids: allIds })
      .execute();

    await this.tasksRepository
      .createQueryBuilder()
      .delete()
      .where('projectId = :projectId', { projectId })
      .andWhere('id IN (:...ids)', { ids: allIds })
      .execute();

    await this.computeCriticalPath(projectId);

    if (userId) {
      await this.activityLogsService.create({
        projectId,
        userId,
        actionType: ActionType.TASK_DELETE,
        targetType: TargetType.TASK,
        targetId: taskId,
        changes: snapshot,
      });
    }
  }

  private async collectChildTaskIds(projectId: string, parentId: string): Promise<string[]> {
    const result: string[] = [];
    const children = await this.tasksRepository.find({
      where: { projectId, parentId },
      select: ['id'],
    });
    for (const child of children) {
      result.push(child.id);
      result.push(...(await this.collectChildTaskIds(projectId, child.id)));
    }
    return result;
  }

  async reorder(
    projectId: string,
    taskId: string,
    newSortOrder: number,
    parentId?: string,
  ): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId, projectId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const targetParentId = parentId ?? task.parentId;
    const siblings = await this.tasksRepository.find({
      where: { projectId, parentId: targetParentId ?? (null as any) },
      order: { sortOrder: 'ASC' },
    });

    const currentIndex = siblings.findIndex((t) => t.id === taskId);
    if (currentIndex >= 0) {
      siblings.splice(currentIndex, 1);
    }

    const insertIndex = Math.min(Math.max(newSortOrder, 0), siblings.length);
    siblings.splice(insertIndex, 0, task);

    for (let i = 0; i < siblings.length; i++) {
      if (siblings[i].id === taskId) {
        siblings[i].sortOrder = i;
        siblings[i].parentId = targetParentId ?? null;
      } else if (siblings[i].sortOrder !== i) {
        siblings[i].sortOrder = i;
      }
    }

    await this.tasksRepository.save(siblings);
    await this.computeCriticalPath(projectId);
    return this.tasksRepository.findOne({ where: { id: taskId } });
  }

  async move(projectId: string, taskId: string, newParentId: string, userId?: string): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId, projectId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const newParent = await this.tasksRepository.findOne({
      where: { id: newParentId, projectId },
    });
    if (!newParent) {
      throw new NotFoundException('New parent task not found');
    }

    if (task.startDate < newParent.startDate || task.endDate > newParent.endDate) {
      throw new BadRequestException(
        'Task dates must be within new parent task date range',
      );
    }

    const descendants = await this.collectChildTaskIds(projectId, taskId);
    if (descendants.includes(newParentId)) {
      throw new BadRequestException('Cannot move a task into its own descendant');
    }

    const oldParentId = task.parentId;

    const oldSiblings = await this.tasksRepository.find({
      where: { projectId, parentId: task.parentId ?? (null as any) },
      order: { sortOrder: 'ASC' },
    });
    let order = 0;
    for (const sib of oldSiblings) {
      if (sib.id !== taskId) {
        sib.sortOrder = order++;
      }
    }
    await this.tasksRepository.save(oldSiblings);

    const newSiblings = await this.tasksRepository.find({
      where: { projectId, parentId: newParentId ?? (null as any) },
      order: { sortOrder: 'ASC' },
    });
    task.parentId = newParentId;
    task.sortOrder = newSiblings.length;
    newSiblings.push(task);

    await this.tasksRepository.save([...newSiblings]);
    await this.computeCriticalPath(projectId);
    const result = await this.tasksRepository.findOne({ where: { id: taskId } });

    if (userId && result) {
      await this.activityLogsService.create({
        projectId,
        userId,
        actionType: ActionType.TASK_MOVE,
        targetType: TargetType.TASK,
        targetId: taskId,
        changes: {
          parentId: { old: oldParentId, new: newParentId },
        },
      });
    }

    return result;
  }

  async computeCriticalPath(projectId: string): Promise<void> {
    const tasks = await this.tasksRepository.find({ where: { projectId } });
    const dependencies = await this.dependenciesRepository.find({ where: { projectId } });

    if (tasks.length === 0) return;

    const taskMap = new Map<string, Task>();
    for (const t of tasks) {
      t.earlyStart = 0;
      t.earlyFinish = t.duration ?? 0;
      t.lateStart = Infinity;
      t.lateFinish = Infinity;
      t.totalFloat = 0;
      taskMap.set(t.id, t);
    }

    const predecessors = new Map<string, Dependency[]>();
    const successors = new Map<string, Dependency[]>();
    for (const t of tasks) {
      predecessors.set(t.id, []);
      successors.set(t.id, []);
    }
    for (const d of dependencies) {
      predecessors.get(d.targetTaskId)?.push(d);
      successors.get(d.sourceTaskId)?.push(d);
    }

    const visited = new Set<string>();
    const topoOrder: string[] = [];

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);
      for (const dep of predecessors.get(taskId) ?? []) {
        visit(dep.sourceTaskId);
      }
      topoOrder.push(taskId);
    };

    for (const t of tasks) {
      visit(t.id);
    }

    for (const taskId of topoOrder) {
      const task = taskMap.get(taskId);
      if (!task) continue;

      const preds = predecessors.get(taskId) ?? [];
      let maxES = 0;

      for (const dep of preds) {
        const source = taskMap.get(dep.sourceTaskId);
        if (!source) continue;

        const lag = dep.lag ?? 0;
        let candidateES: number;

        switch (dep.type) {
          case DependencyType.FS:
            candidateES = (source.earlyFinish ?? 0) + lag;
            break;
          case DependencyType.SS:
            candidateES = (source.earlyStart ?? 0) + lag;
            break;
          case DependencyType.FF:
            candidateES = (source.earlyFinish ?? 0) + lag - (task.duration ?? 0);
            break;
          case DependencyType.SF:
            candidateES = (source.earlyStart ?? 0) + lag - (task.duration ?? 0);
            break;
          default:
            candidateES = (source.earlyFinish ?? 0) + lag;
        }

        if (candidateES > maxES) {
          maxES = candidateES;
        }
      }

      task.earlyStart = maxES;
      task.earlyFinish = maxES + (task.duration ?? 0);
    }

    const reverseTopo = [...topoOrder].reverse();
    let projectDuration = 0;
    for (const taskId of topoOrder) {
      const t = taskMap.get(taskId);
      if (t && (t.earlyFinish ?? 0) > projectDuration) {
        projectDuration = t.earlyFinish ?? 0;
      }
    }

    for (const taskId of reverseTopo) {
      const task = taskMap.get(taskId);
      if (!task) continue;

      const succs = successors.get(taskId) ?? [];
      let minLF = projectDuration;

      if (succs.length === 0) {
        task.lateFinish = projectDuration;
      } else {
        for (const dep of succs) {
          const target = taskMap.get(dep.targetTaskId);
          if (!target) continue;

          const lag = dep.lag ?? 0;
          let candidateLF: number;

          switch (dep.type) {
            case DependencyType.FS:
              candidateLF = (target.lateStart ?? 0) - lag;
              break;
            case DependencyType.SS:
              candidateLF = (target.lateStart ?? 0) - lag + (task.duration ?? 0);
              break;
            case DependencyType.FF:
              candidateLF = (target.lateFinish ?? 0) - lag;
              break;
            case DependencyType.SF:
              candidateLF = (target.lateFinish ?? 0) - lag + (task.duration ?? 0);
              break;
            default:
              candidateLF = (target.lateStart ?? 0) - lag;
          }

          if (candidateLF < minLF) {
            minLF = candidateLF;
          }
        }

        task.lateFinish = minLF;
      }

      task.lateStart = (task.lateFinish ?? 0) - (task.duration ?? 0);
      task.totalFloat = (task.lateStart ?? 0) - (task.earlyStart ?? 0);
    }

    await this.tasksRepository.save(tasks);
  }
}
