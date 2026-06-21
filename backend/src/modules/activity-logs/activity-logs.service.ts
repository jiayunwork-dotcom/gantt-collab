import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog, ActionType, TargetType } from '../../entities/activity-log.entity';
import { CollaborationService } from '../collaboration/collaboration.service';

export interface CreateLogDto {
  projectId: string;
  userId: string;
  actionType: ActionType;
  targetType: TargetType;
  targetId: string;
  changes?: Record<string, { old: any; new: any }> | Record<string, any>;
}

export interface PaginatedLogs {
  items: ActivityLog[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

@Injectable()
export class ActivityLogsService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly logsRepository: Repository<ActivityLog>,
    private readonly collabService: CollaborationService,
  ) {}

  async create(dto: CreateLogDto): Promise<ActivityLog> {
    const log = this.logsRepository.create(dto);
    const saved = await this.logsRepository.save(log);

    const populated = await this.logsRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });

    if (populated) {
      await this.collabService.publish(dto.projectId, 'activity:new', populated);
    }

    return saved;
  }

  async findByProject(
    projectId: string,
    page: number = 1,
    pageSize: number = 20,
    actionType?: ActionType,
  ): Promise<PaginatedLogs> {
    const skip = (page - 1) * pageSize;
    const where: any = { projectId };
    if (actionType) {
      where.actionType = actionType;
    }

    const [items, total] = await this.logsRepository.findAndCount({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip,
      take: pageSize,
    });

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: skip + items.length < total,
    };
  }
}
