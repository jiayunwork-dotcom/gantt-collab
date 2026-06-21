import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resource } from '../../entities/resource.entity';
import { Task } from '../../entities/task.entity';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';

interface WorkloadDay {
  date: string;
  hours: number;
  isOverloaded: boolean;
}

interface ResourceWorkload {
  resourceId: string;
  name: string;
  role: string;
  dailyCapacity: number;
  workloads: WorkloadDay[];
}

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(Resource)
    private resourcesRepository: Repository<Resource>,
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
  ) {}

  async create(projectId: string, createResourceDto: CreateResourceDto): Promise<Resource> {
    const resource = this.resourcesRepository.create({
      projectId,
      ...createResourceDto,
    });
    return this.resourcesRepository.save(resource);
  }

  async findAll(projectId: string): Promise<Resource[]> {
    return this.resourcesRepository.find({
      where: { projectId },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(projectId: string, resourceId: string): Promise<Resource> {
    const resource = await this.resourcesRepository.findOne({
      where: { id: resourceId, projectId },
    });
    if (!resource) {
      throw new NotFoundException('Resource not found');
    }
    return resource;
  }

  async update(
    projectId: string,
    resourceId: string,
    updateResourceDto: UpdateResourceDto,
  ): Promise<Resource> {
    const resource = await this.findOne(projectId, resourceId);
    Object.assign(resource, updateResourceDto);
    return this.resourcesRepository.save(resource);
  }

  async remove(projectId: string, resourceId: string): Promise<void> {
    const resource = await this.findOne(projectId, resourceId);
    await this.resourcesRepository.remove(resource);
  }

  async computeWorkload(projectId: string): Promise<ResourceWorkload[]> {
    const resources = await this.findAll(projectId);
    const tasks = await this.tasksRepository.find({
      where: { projectId },
    });

    const dateMap: Map<string, Map<string, number>> = new Map();

    for (const task of tasks) {
      if (!task.assigneeId || !task.startDate || !task.endDate) {
        continue;
      }

      const dailyHours = task.dailyHours || 0;
      const start = new Date(task.startDate);
      const end = new Date(task.endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (!dateMap.has(task.assigneeId)) {
          dateMap.set(task.assigneeId, new Map());
        }
        const resourceMap = dateMap.get(task.assigneeId)!;
        resourceMap.set(dateStr, (resourceMap.get(dateStr) || 0) + dailyHours);
      }
    }

    const result: ResourceWorkload[] = [];

    for (const resource of resources) {
      const resourceWorkload: ResourceWorkload = {
        resourceId: resource.id,
        name: resource.name,
        role: resource.role || '',
        dailyCapacity: resource.dailyCapacity || 8,
        workloads: [],
      };

      const resourceMap = dateMap.get(resource.id);
      if (resourceMap) {
        const sortedDates = Array.from(resourceMap.entries()).sort((a, b) =>
          a[0].localeCompare(b[0]),
        );
        for (const [date, hours] of sortedDates) {
          resourceWorkload.workloads.push({
            date,
            hours,
            isOverloaded: hours > resourceWorkload.dailyCapacity,
          });
        }
      }

      result.push(resourceWorkload);
    }

    return result;
  }
}
