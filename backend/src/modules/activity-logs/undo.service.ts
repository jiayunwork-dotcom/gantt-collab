import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import {
  ActivityLog,
  ActionType,
  TargetType,
} from '../../entities/activity-log.entity';
import { Task } from '../../entities/task.entity';
import { Dependency } from '../../entities/dependency.entity';
import { Collaborator, CollaboratorRole } from '../../entities/collaborator.entity';
import { ActivityLogsService, CreateLogDto } from './activity-logs.service';
import { TasksService } from '../tasks/tasks.service';
import { DependenciesService } from '../tasks/dependencies.service';
import { ProjectsService } from '../projects/projects.service';

export const UNDO_WINDOW_MS = 10 * 60 * 1000;

export class UndoError extends Error {
  constructor(
    public code: 'TIMEOUT' | 'NOT_OWNER' | 'MODIFIED' | 'CONFLICT' | 'NOT_FOUND' | 'NOT_SUPPORTED',
    message: string,
    public conflictFields?: string[],
  ) {
    super(message);
  }
}

@Injectable()
export class UndoService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly logsRepository: Repository<ActivityLog>,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(Dependency)
    private readonly dependenciesRepository: Repository<Dependency>,
    @InjectRepository(Collaborator)
    private readonly collaboratorsRepository: Repository<Collaborator>,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => ActivityLogsService))
    private readonly activityLogsService: ActivityLogsService,
    @Inject(forwardRef(() => TasksService))
    private readonly tasksService: TasksService,
    @Inject(forwardRef(() => DependenciesService))
    private readonly dependenciesService: DependenciesService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: ProjectsService,
  ) {}

  async undoLog(projectId: string, logId: string, userId: string, force: boolean = false): Promise<void> {
    const log = await this.logsRepository.findOne({
      where: { id: logId, projectId },
    });
    if (!log) {
      throw new UndoError('NOT_FOUND', '日志不存在');
    }

    this.validateBasicConditions(log, userId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const reverseAction = await this.executeUndo(log, queryRunner, force);
      await this.writeReverseLog(log, userId, reverseAction);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    try {
      await this.tasksService.computeCriticalPath(projectId);
    } catch {
    }
  }

  private validateBasicConditions(log: ActivityLog, userId: string): void {
    if (log.isUndo) {
      throw new UndoError('NOT_SUPPORTED', '该操作本身就是撤销操作，无法再次撤销');
    }

    const age = Date.now() - new Date(log.createdAt).getTime();
    if (age > UNDO_WINDOW_MS) {
      throw new UndoError('TIMEOUT', '操作已超过10分钟，无法撤销');
    }

    if (log.userId !== userId) {
      throw new UndoError('NOT_OWNER', '只能撤销自己的操作');
    }
  }

  private async executeUndo(
    log: ActivityLog,
    queryRunner: QueryRunner,
    force: boolean,
  ): Promise<{ actionType: ActionType; targetType: TargetType; targetId: string; changes: Record<string, any> }> {
    switch (log.actionType) {
      case ActionType.TASK_CREATE:
        return this.undoTaskCreate(log, queryRunner);
      case ActionType.TASK_DELETE:
        return this.undoTaskDelete(log, queryRunner);
      case ActionType.TASK_UPDATE:
        return this.undoTaskUpdate(log, queryRunner, force);
      case ActionType.TASK_MOVE:
        return this.undoTaskMove(log, queryRunner, force);
      case ActionType.DEPENDENCY_CREATE:
        return this.undoDependencyCreate(log, queryRunner);
      case ActionType.DEPENDENCY_DELETE:
        return this.undoDependencyDelete(log, queryRunner);
      case ActionType.COLLABORATOR_ADD:
        return this.undoCollaboratorAdd(log, queryRunner);
      case ActionType.COLLABORATOR_REMOVE:
        return this.undoCollaboratorRemove(log, queryRunner);
      case ActionType.COLLABORATOR_ROLE_CHANGE:
        return this.undoCollaboratorRoleChange(log, queryRunner, force);
      default:
        throw new UndoError('NOT_SUPPORTED', '该操作类型暂不支持撤销');
    }
  }

  private async undoTaskCreate(
    log: ActivityLog,
    queryRunner: QueryRunner,
  ): Promise<{ actionType: ActionType; targetType: TargetType; targetId: string; changes: Record<string, any> }> {
    const taskId = log.targetId;
    const task = await queryRunner.manager.findOne(Task, { where: { id: taskId, projectId: log.projectId } });

    if (!task) {
      throw new UndoError('MODIFIED', '该任务已被删除，无法撤销');
    }

    const laterLogs = await this.logsRepository
      .createQueryBuilder('l')
      .where('l.projectId = :projectId', { projectId: log.projectId })
      .andWhere('l.targetType = :targetType', { targetType: TargetType.TASK })
      .andWhere('l.targetId = :targetId', { targetId: taskId })
      .andWhere('l.createdAt > :createdAt', { createdAt: log.createdAt })
      .andWhere('l.actionType != :undoType', { undoType: ActionType.TASK_DELETE })
      .getCount();

    if (laterLogs > 0) {
      throw new UndoError('MODIFIED', '该任务创建后已被其他操作修改，无法撤销');
    }

    const reverseChanges: Record<string, any> = {};
    const keys = Object.keys(log.changes || {});
    for (const k of keys) {
      const c = (log.changes as any)[k];
      reverseChanges[k] = { old: c?.new, new: undefined };
    }

    const childIds = await this.collectChildIdsWithRunner(log.projectId, taskId, queryRunner);
    const allIds = [taskId, ...childIds];

    await queryRunner.manager
      .createQueryBuilder()
      .delete()
      .from(Dependency)
      .where('projectId = :projectId', { projectId: log.projectId })
      .andWhere('(sourceTaskId IN (:...ids) OR targetTaskId IN (:...ids))', { ids: allIds })
      .execute();

    await queryRunner.manager
      .createQueryBuilder()
      .delete()
      .from(Task)
      .where('projectId = :projectId', { projectId: log.projectId })
      .andWhere('id IN (:...ids)', { ids: allIds })
      .execute();

    return {
      actionType: ActionType.TASK_DELETE,
      targetType: TargetType.TASK,
      targetId: taskId,
      changes: reverseChanges,
    };
  }

  private async collectChildIdsWithRunner(
    projectId: string,
    parentId: string,
    queryRunner: QueryRunner,
  ): Promise<string[]> {
    const result: string[] = [];
    const children = await queryRunner.manager.find(Task, {
      where: { projectId, parentId },
      select: ['id'],
    });
    for (const child of children) {
      result.push(child.id);
      result.push(...(await this.collectChildIdsWithRunner(projectId, child.id, queryRunner)));
    }
    return result;
  }

  private async undoTaskDelete(
    log: ActivityLog,
    queryRunner: QueryRunner,
  ): Promise<{ actionType: ActionType; targetType: TargetType; targetId: string; changes: Record<string, any> }> {
    const changes = log.changes || {};
    const taskId = changes.id?.old || log.targetId;

    if (!taskId) {
      throw new UndoError('MODIFIED', '日志缺少任务快照，无法撤销');
    }

    const existing = await queryRunner.manager.findOne(Task, { where: { id: taskId } });
    if (existing) {
      throw new UndoError('MODIFIED', '该ID已存在其他任务，无法撤销删除');
    }

    const taskData: Partial<Task> = {
      id: taskId,
      projectId: log.projectId,
    };

    const fieldMap: Record<string, keyof Task> = {
      name: 'name',
      startDate: 'startDate',
      endDate: 'endDate',
      parentId: 'parentId',
      progress: 'progress',
      priority: 'priority',
      isMilestone: 'isMilestone',
    };

    for (const [k, entityKey] of Object.entries(fieldMap)) {
      if (changes[k]?.old !== undefined) {
        (taskData as any)[entityKey] = changes[k].old;
      }
    }

    if (!taskData.name) taskData.name = '恢复的任务';
    if (!taskData.startDate) taskData.startDate = new Date().toISOString().slice(0, 10);
    if (!taskData.endDate) taskData.endDate = new Date().toISOString().slice(0, 10);
    if (taskData.progress === undefined) taskData.progress = 0;
    if (!taskData.priority) taskData.priority = 'medium' as any;
    if (taskData.isMilestone === undefined) taskData.isMilestone = false;
    if (taskData.dailyHours === undefined) taskData.dailyHours = 8;

    const start = new Date(taskData.startDate as string);
    const end = new Date(taskData.endDate as string);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    taskData.duration = taskData.isMilestone ? 0 : Math.max(0, diffDays);

    const maxSortOrder = await queryRunner.manager
      .createQueryBuilder(Task, 't')
      .select('COALESCE(MAX(t.sortOrder), -1)', 'max')
      .where('t.projectId = :projectId', { projectId: log.projectId })
      .andWhere(taskData.parentId ? 't.parentId = :parentId' : 't.parentId IS NULL', {
        parentId: taskData.parentId,
      })
      .getRawOne();
    taskData.sortOrder = (maxSortOrder?.max ?? -1) + 1;

    const newTask = queryRunner.manager.create(Task, taskData);
    await queryRunner.manager.save(newTask);

    const reverseChanges: Record<string, any> = {};
    const keys = Object.keys(changes);
    for (const k of keys) {
      const c = (changes as any)[k];
      reverseChanges[k] = { old: undefined, new: c?.old };
    }

    return {
      actionType: ActionType.TASK_CREATE,
      targetType: TargetType.TASK,
      targetId: taskId,
      changes: reverseChanges,
    };
  }

  private async undoTaskUpdate(
    log: ActivityLog,
    queryRunner: QueryRunner,
    force: boolean,
  ): Promise<{ actionType: ActionType; targetType: TargetType; targetId: string; changes: Record<string, any> }> {
    const taskId = log.targetId;
    const task = await queryRunner.manager.findOne(Task, { where: { id: taskId, projectId: log.projectId } });

    if (!task) {
      throw new UndoError('MODIFIED', '该任务已被删除，无法撤销修改');
    }

    const logChanges = log.changes || {};
    const changedFields = Object.keys(logChanges).filter((k) => k !== 'id');

    const laterLogs = await this.logsRepository
      .createQueryBuilder('l')
      .where('l.projectId = :projectId', { projectId: log.projectId })
      .andWhere('l.targetType = :targetType', { targetType: TargetType.TASK })
      .andWhere('l.targetId = :targetId', { targetId: taskId })
      .andWhere('l.createdAt > :createdAt', { createdAt: log.createdAt })
      .andWhere('l.actionType IN (:...types)', {
        types: [ActionType.TASK_UPDATE, ActionType.TASK_MOVE],
      })
      .getMany();

    const modifiedAfter: string[] = [];
    for (const l of laterLogs) {
      const lChanges = l.changes || {};
      for (const f of Object.keys(lChanges)) {
        if (changedFields.includes(f) && !modifiedAfter.includes(f)) {
          modifiedAfter.push(f);
        }
      }
    }

    const conflictFields: string[] = [];
    for (const f of changedFields) {
      const logNew = logChanges[f]?.new;
      const current = (task as any)[f];
      const logNewStr = JSON.stringify(logNew);
      const currentStr = JSON.stringify(current);
      if (logNewStr !== currentStr) {
        conflictFields.push(f);
      }
    }

    if (conflictFields.length > 0 && !force) {
      throw new UndoError(
        'CONFLICT',
        `以下字段在该操作后被修改: ${conflictFields.join(', ')}`,
        conflictFields,
      );
    }

    const fieldsToRevert = force ? changedFields : changedFields.filter((f) => !conflictFields.includes(f));

    if (fieldsToRevert.length === 0) {
      throw new UndoError('CONFLICT', '没有可回滚的字段', conflictFields);
    }

    const reverseChanges: Record<string, any> = {};
    const updateData: Partial<Task> = {};

    for (const f of fieldsToRevert) {
      const oldVal = logChanges[f]?.old;
      const currentVal = (task as any)[f];
      reverseChanges[f] = { old: currentVal, new: oldVal };
      (updateData as any)[f] = oldVal;
    }

    if (updateData.startDate || updateData.endDate || updateData.isMilestone !== undefined) {
      const start = new Date((updateData.startDate as string) ?? task.startDate);
      const end = new Date((updateData.endDate as string) ?? task.endDate);
      const isMilestone = (updateData.isMilestone as boolean) ?? task.isMilestone;
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      updateData.duration = isMilestone ? 0 : Math.max(0, diffDays);
    }

    await queryRunner.manager.update(Task, taskId, updateData);

    return {
      actionType: ActionType.TASK_UPDATE,
      targetType: TargetType.TASK,
      targetId: taskId,
      changes: reverseChanges,
    };
  }

  private async undoTaskMove(
    log: ActivityLog,
    queryRunner: QueryRunner,
    force: boolean,
  ): Promise<{ actionType: ActionType; targetType: TargetType; targetId: string; changes: Record<string, any> }> {
    const taskId = log.targetId;
    const task = await queryRunner.manager.findOne(Task, { where: { id: taskId, projectId: log.projectId } });

    if (!task) {
      throw new UndoError('MODIFIED', '该任务已被删除，无法撤销移动');
    }

    const logChanges = log.changes || {};
    const logNewParent = logChanges.parentId?.new;
    const currentParent = task.parentId;
    const logNewParentStr = JSON.stringify(logNewParent);
    const currentParentStr = JSON.stringify(currentParent);

    if (logNewParentStr !== currentParentStr) {
      if (!force) {
        throw new UndoError(
          'CONFLICT',
          '任务的父级在该操作后被再次修改',
          ['parentId'],
        );
      }
    }

    const oldParentId = logChanges.parentId?.old ?? null;

    if (oldParentId) {
      const newParent = await queryRunner.manager.findOne(Task, {
        where: { id: oldParentId, projectId: log.projectId },
      });
      if (!newParent) {
        throw new UndoError('MODIFIED', '原父任务已不存在，无法撤销移动');
      }
      if (task.startDate < newParent.startDate || task.endDate > newParent.endDate) {
        if (!force) {
          throw new UndoError(
            'CONFLICT',
            '撤销移动后任务日期将超出父任务范围，请确认是否强制回滚',
            ['parentId'],
          );
        }
      }
    }

    const descendants = await this.collectChildIdsWithRunner(log.projectId, taskId, queryRunner);
    if (descendants.includes(oldParentId)) {
      throw new UndoError('MODIFIED', '撤销移动将导致循环嵌套，无法执行');
    }

    const oldSiblings = await queryRunner.manager.find(Task, {
      where: { projectId: log.projectId, parentId: task.parentId ?? (null as any) },
      order: { sortOrder: 'ASC' },
    });
    let order = 0;
    for (const sib of oldSiblings) {
      if (sib.id !== taskId) {
        sib.sortOrder = order++;
      }
    }
    await queryRunner.manager.save(oldSiblings);

    const newSiblings = await queryRunner.manager.find(Task, {
      where: { projectId: log.projectId, parentId: oldParentId ?? (null as any) },
      order: { sortOrder: 'ASC' },
    });
    task.parentId = oldParentId ?? null;
    task.sortOrder = newSiblings.length;
    newSiblings.push(task);

    await queryRunner.manager.save([...newSiblings]);

    return {
      actionType: ActionType.TASK_MOVE,
      targetType: TargetType.TASK,
      targetId: taskId,
      changes: {
        parentId: { old: currentParent, new: oldParentId ?? null },
      },
    };
  }

  private async undoDependencyCreate(
    log: ActivityLog,
    queryRunner: QueryRunner,
  ): Promise<{ actionType: ActionType; targetType: TargetType; targetId: string; changes: Record<string, any> }> {
    const depId = log.targetId;
    const dep = await queryRunner.manager.findOne(Dependency, {
      where: { id: depId, projectId: log.projectId },
    });

    if (!dep) {
      throw new UndoError('MODIFIED', '该依赖已被删除，无法撤销');
    }

    const changes = log.changes || {};
    const logSource = changes.sourceTaskId?.new;
    const logTarget = changes.targetTaskId?.new;

    if (
      JSON.stringify(logSource) !== JSON.stringify(dep.sourceTaskId) ||
      JSON.stringify(logTarget) !== JSON.stringify(dep.targetTaskId)
    ) {
      throw new UndoError('MODIFIED', '该依赖已被修改，无法撤销创建');
    }

    const reverseChanges: Record<string, any> = {};
    const keys = ['id', 'sourceTaskId', 'targetTaskId', 'type', 'lag'];
    for (const k of keys) {
      if (changes[k]) {
        reverseChanges[k] = { old: changes[k].new, new: undefined };
      }
    }

    await queryRunner.manager.remove(dep);

    return {
      actionType: ActionType.DEPENDENCY_DELETE,
      targetType: TargetType.DEPENDENCY,
      targetId: depId,
      changes: reverseChanges,
    };
  }

  private async undoDependencyDelete(
    log: ActivityLog,
    queryRunner: QueryRunner,
  ): Promise<{ actionType: ActionType; targetType: TargetType; targetId: string; changes: Record<string, any> }> {
    const changes = log.changes || {};
    const sourceTaskId = changes.sourceTaskId?.old;
    const targetTaskId = changes.targetTaskId?.old;
    const type = changes.type?.old;
    const lag = changes.lag?.old ?? 0;

    if (!sourceTaskId || !targetTaskId) {
      throw new UndoError('MODIFIED', '日志缺少依赖信息，无法撤销删除');
    }

    const existing = await queryRunner.manager.findOne(Dependency, {
      where: {
        projectId: log.projectId,
        sourceTaskId,
        targetTaskId,
      },
    });
    if (existing) {
      throw new UndoError('MODIFIED', '相同的依赖关系已存在，无法撤销删除');
    }

    const sourceTask = await queryRunner.manager.findOne(Task, {
      where: { id: sourceTaskId, projectId: log.projectId },
    });
    const targetTask = await queryRunner.manager.findOne(Task, {
      where: { id: targetTaskId, projectId: log.projectId },
    });
    if (!sourceTask || !targetTask) {
      throw new UndoError('MODIFIED', '关联的任务已不存在，无法撤销删除依赖');
    }

    const newDep = queryRunner.manager.create(Dependency, {
      projectId: log.projectId,
      sourceTaskId,
      targetTaskId,
      type: type ?? 'FS',
      lag,
    });
    const saved = await queryRunner.manager.save(newDep);

    const reverseChanges: Record<string, any> = {};
    const keys = ['sourceTaskId', 'targetTaskId', 'type', 'lag'];
    for (const k of keys) {
      if (changes[k]) {
        reverseChanges[k] = { old: undefined, new: changes[k].old };
      }
    }
    reverseChanges.id = { old: undefined, new: saved.id };

    return {
      actionType: ActionType.DEPENDENCY_CREATE,
      targetType: TargetType.DEPENDENCY,
      targetId: saved.id,
      changes: reverseChanges,
    };
  }

  private async undoCollaboratorAdd(
    log: ActivityLog,
    queryRunner: QueryRunner,
  ): Promise<{ actionType: ActionType; targetType: TargetType; targetId: string; changes: Record<string, any> }> {
    const collabId = log.targetId;
    const collab = await queryRunner.manager.findOne(Collaborator, {
      where: { id: collabId, projectId: log.projectId },
    });

    if (!collab) {
      throw new UndoError('MODIFIED', '该协作者已被移除，无法撤销');
    }

    if (collab.role === CollaboratorRole.OWNER) {
      throw new UndoError('NOT_SUPPORTED', '不能撤销添加项目所有者');
    }

    const changes = log.changes || {};
    const reverseChanges: Record<string, any> = {};
    const keys = ['id', 'userId', 'role'];
    for (const k of keys) {
      if (changes[k]) {
        reverseChanges[k] = { old: changes[k].new, new: undefined };
      }
    }

    await queryRunner.manager.remove(collab);

    return {
      actionType: ActionType.COLLABORATOR_REMOVE,
      targetType: TargetType.COLLABORATOR,
      targetId: collabId,
      changes: reverseChanges,
    };
  }

  private async undoCollaboratorRemove(
    log: ActivityLog,
    queryRunner: QueryRunner,
  ): Promise<{ actionType: ActionType; targetType: TargetType; targetId: string; changes: Record<string, any> }> {
    const changes = log.changes || {};
    const userId = changes.userId?.old;
    const role = changes.role?.old;

    if (!userId) {
      throw new UndoError('MODIFIED', '日志缺少用户信息，无法撤销移除');
    }

    const existing = await queryRunner.manager.findOne(Collaborator, {
      where: { projectId: log.projectId, userId },
    });
    if (existing) {
      throw new UndoError('MODIFIED', '该用户已重新加入项目，无法撤销移除');
    }

    const newCollab = queryRunner.manager.create(Collaborator, {
      projectId: log.projectId,
      userId,
      role: role ?? CollaboratorRole.VIEWER,
    });
    const saved = await queryRunner.manager.save(newCollab);

    const reverseChanges: Record<string, any> = {
      id: { old: undefined, new: saved.id },
      userId: { old: undefined, new: userId },
      role: { old: undefined, new: role ?? CollaboratorRole.VIEWER },
    };

    return {
      actionType: ActionType.COLLABORATOR_ADD,
      targetType: TargetType.COLLABORATOR,
      targetId: saved.id,
      changes: reverseChanges,
    };
  }

  private async undoCollaboratorRoleChange(
    log: ActivityLog,
    queryRunner: QueryRunner,
    force: boolean,
  ): Promise<{ actionType: ActionType; targetType: TargetType; targetId: string; changes: Record<string, any> }> {
    const collabId = log.targetId;
    const collab = await queryRunner.manager.findOne(Collaborator, {
      where: { id: collabId, projectId: log.projectId },
    });

    if (!collab) {
      throw new UndoError('MODIFIED', '该协作者已被移除，无法撤销角色变更');
    }

    const changes = log.changes || {};
    const logNewRole = changes.role?.new;
    const currentRole = collab.role;

    if (logNewRole !== currentRole && !force) {
      throw new UndoError(
        'CONFLICT',
        '该协作者的角色在变更后再次被修改，请确认是否强制回滚',
        ['role'],
      );
    }

    if (collab.role === CollaboratorRole.OWNER) {
      throw new UndoError('NOT_SUPPORTED', '所有者角色不能修改');
    }

    const oldRole = changes.role?.old;
    if (oldRole === CollaboratorRole.OWNER) {
      throw new UndoError('NOT_SUPPORTED', '不能将角色回滚为所有者');
    }

    const reverseChanges: Record<string, any> = {
      role: { old: currentRole, new: oldRole ?? CollaboratorRole.VIEWER },
      userId: { old: collab.userId, new: collab.userId },
    };

    collab.role = oldRole ?? CollaboratorRole.VIEWER;
    await queryRunner.manager.save(collab);

    return {
      actionType: ActionType.COLLABORATOR_ROLE_CHANGE,
      targetType: TargetType.COLLABORATOR,
      targetId: collabId,
      changes: reverseChanges,
    };
  }

  private async writeReverseLog(
    originalLog: ActivityLog,
    userId: string,
    reverse: {
      actionType: ActionType;
      targetType: TargetType;
      targetId: string;
      changes: Record<string, any>;
    },
  ): Promise<void> {
    const markedChanges: Record<string, any> = {};
    for (const [k, v] of Object.entries(reverse.changes)) {
      markedChanges[k] = { ...(v as any), isUndo: true };
    }

    const createDto: CreateLogDto = {
      projectId: originalLog.projectId,
      userId,
      actionType: reverse.actionType,
      targetType: reverse.targetType,
      targetId: reverse.targetId,
      changes: markedChanges,
      isUndo: true,
      undoOfId: originalLog.id,
    };

    await this.activityLogsService.create(createDto);
  }
}
