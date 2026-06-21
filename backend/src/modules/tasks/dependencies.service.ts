import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dependency } from '../../entities/dependency.entity';
import { Task } from '../../entities/task.entity';
import { CreateDependencyDto } from './dto/create-dependency.dto';
import { TasksService } from './tasks.service';

@Injectable()
export class DependenciesService {
  constructor(
    @InjectRepository(Dependency)
    private dependenciesRepository: Repository<Dependency>,
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    private tasksService: TasksService,
  ) {}

  async create(projectId: string, dto: CreateDependencyDto): Promise<Dependency> {
    if (dto.sourceTaskId === dto.targetTaskId) {
      throw new BadRequestException('Source and target task cannot be the same');
    }

    const [sourceTask, targetTask] = await Promise.all([
      this.tasksRepository.findOne({ where: { id: dto.sourceTaskId, projectId } }),
      this.tasksRepository.findOne({ where: { id: dto.targetTaskId, projectId } }),
    ]);

    if (!sourceTask) {
      throw new NotFoundException('Source task not found');
    }
    if (!targetTask) {
      throw new NotFoundException('Target task not found');
    }

    const existing = await this.dependenciesRepository.findOne({
      where: {
        projectId,
        sourceTaskId: dto.sourceTaskId,
        targetTaskId: dto.targetTaskId,
      },
    });
    if (existing) {
      throw new BadRequestException('Dependency already exists');
    }

    if (await this.detectCycle(projectId, dto.sourceTaskId, dto.targetTaskId)) {
      throw new BadRequestException('Creating this dependency would cause a cycle');
    }

    const dependency = this.dependenciesRepository.create({
      projectId,
      sourceTaskId: dto.sourceTaskId,
      targetTaskId: dto.targetTaskId,
      type: dto.type,
      lag: dto.lag ?? 0,
    });

    const saved = await this.dependenciesRepository.save(dependency);
    await this.tasksService.computeCriticalPath(projectId);
    return saved;
  }

  async findAll(projectId: string): Promise<Dependency[]> {
    return this.dependenciesRepository.find({ where: { projectId } });
  }

  async remove(projectId: string, dependencyId: string): Promise<void> {
    const dependency = await this.dependenciesRepository.findOne({
      where: { id: dependencyId, projectId },
    });
    if (!dependency) {
      throw new NotFoundException('Dependency not found');
    }

    await this.dependenciesRepository.remove(dependency);
    await this.tasksService.computeCriticalPath(projectId);
  }

  async detectCycle(
    projectId: string,
    sourceId: string,
    targetId: string,
  ): Promise<boolean> {
    const dependencies = await this.dependenciesRepository.find({ where: { projectId } });

    const adjacency = new Map<string, string[]>();
    const allTaskIds = new Set<string>();

    for (const d of dependencies) {
      allTaskIds.add(d.sourceTaskId);
      allTaskIds.add(d.targetTaskId);
      if (!adjacency.has(d.sourceTaskId)) {
        adjacency.set(d.sourceTaskId, []);
      }
      adjacency.get(d.sourceTaskId)!.push(d.targetTaskId);
    }

    allTaskIds.add(sourceId);
    allTaskIds.add(targetId);
    if (!adjacency.has(sourceId)) {
      adjacency.set(sourceId, []);
    }
    adjacency.get(sourceId)!.push(targetId);

    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<string, number>();

    for (const taskId of allTaskIds) {
      color.set(taskId, WHITE);
    }

    const hasCycleDFS = (node: string): boolean => {
      color.set(node, GRAY);

      const neighbors = adjacency.get(node) ?? [];
      for (const neighbor of neighbors) {
        const neighborColor = color.get(neighbor);
        if (neighborColor === GRAY) {
          return true;
        }
        if (neighborColor === WHITE && hasCycleDFS(neighbor)) {
          return true;
        }
      }

      color.set(node, BLACK);
      return false;
    };

    for (const taskId of allTaskIds) {
      if (color.get(taskId) === WHITE) {
        if (hasCycleDFS(taskId)) {
          return true;
        }
      }
    }

    return false;
  }
}
