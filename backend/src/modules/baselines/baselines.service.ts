import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Baseline } from '../../entities/baseline.entity';
import { Task } from '../../entities/task.entity';
import { Dependency } from '../../entities/dependency.entity';
import { Project } from '../../entities/project.entity';
import { ActionType, TargetType } from '../../entities/activity-log.entity';
import { CreateBaselineDto } from './dto/create-baseline.dto';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

interface BaselineSnapshot {
  tasks: Task[];
  dependencies: Dependency[];
}

@Injectable()
export class BaselinesService {
  constructor(
    @InjectRepository(Baseline)
    private baselinesRepository: Repository<Baseline>,
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    @InjectRepository(Dependency)
    private dependenciesRepository: Repository<Dependency>,
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async create(
    projectId: string,
    userId: string,
    createBaselineDto: CreateBaselineDto,
  ): Promise<Baseline> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const tasks = await this.tasksRepository.find({
      where: { projectId },
    });
    const dependencies = await this.dependenciesRepository.find({
      where: { projectId },
    });

    const snapshot: BaselineSnapshot = {
      tasks,
      dependencies,
    };

    const existingBaselines = await this.baselinesRepository.find({
      where: { projectId },
      order: { version: 'DESC' },
    });

    const nextVersion = existingBaselines.length > 0 ? existingBaselines[0].version + 1 : 1;

    const baseline = this.baselinesRepository.create({
      projectId,
      name: createBaselineDto.name,
      version: nextVersion,
      snapshot,
    });

    const saved = await this.baselinesRepository.save(baseline);

    if (existingBaselines.length >= 5) {
      const oldest = existingBaselines[existingBaselines.length - 1];
      await this.baselinesRepository.remove(oldest);
    }

    await this.activityLogsService.create({
      projectId,
      userId,
      actionType: ActionType.BASELINE_CREATE,
      targetType: TargetType.BASELINE,
      targetId: saved.id,
      changes: {
        id: { old: undefined, new: saved.id },
        name: { old: undefined, new: saved.name },
        version: { old: undefined, new: saved.version },
        taskCount: { old: undefined, new: tasks.length },
        dependencyCount: { old: undefined, new: dependencies.length },
      },
    });

    return saved;
  }

  async findAll(projectId: string): Promise<Baseline[]> {
    return this.baselinesRepository.find({
      where: { projectId },
      order: { version: 'DESC' },
      select: ['id', 'projectId', 'name', 'version', 'createdAt'],
    });
  }

  async findOne(projectId: string, baselineId: string): Promise<Baseline> {
    const baseline = await this.baselinesRepository.findOne({
      where: { id: baselineId, projectId },
    });
    if (!baseline) {
      throw new NotFoundException('Baseline not found');
    }
    return baseline;
  }

  async remove(projectId: string, baselineId: string, userId: string): Promise<void> {
    const baseline = await this.findOne(projectId, baselineId);
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.ownerId !== userId) {
      throw new ForbiddenException('Only project owner can delete baselines');
    }

    const snapshot: Record<string, any> = {};
    const keys = ['id', 'name', 'version'];
    for (const k of keys) {
      snapshot[k] = { old: (baseline as any)[k], new: undefined };
    }
    await this.baselinesRepository.remove(baseline);

    await this.activityLogsService.create({
      projectId,
      userId,
      actionType: ActionType.BASELINE_DELETE,
      targetType: TargetType.BASELINE,
      targetId: baselineId,
      changes: snapshot,
    });
  }
}
