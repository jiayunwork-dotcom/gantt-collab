import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BaselinesService } from './baselines.service';
import { BaselinesController } from './baselines.controller';
import { Baseline } from '../../entities/baseline.entity';
import { Task } from '../../entities/task.entity';
import { Dependency } from '../../entities/dependency.entity';
import { Project } from '../../entities/project.entity';
import { Collaborator } from '../../entities/collaborator.entity';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Baseline, Task, Dependency, Project, Collaborator]),
    forwardRef(() => ActivityLogsModule),
  ],
  controllers: [BaselinesController],
  providers: [BaselinesService],
  exports: [BaselinesService],
})
export class BaselinesModule {}
