import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLog } from '../../entities/activity-log.entity';
import { Task } from '../../entities/task.entity';
import { Dependency } from '../../entities/dependency.entity';
import { Collaborator } from '../../entities/collaborator.entity';
import { ActivityLogsService } from './activity-logs.service';
import { UndoService } from './undo.service';
import { ActivityLogsController } from './activity-logs.controller';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ActivityLog, Task, Dependency, Collaborator]),
    CollaborationModule,
    forwardRef(() => ProjectsModule),
    forwardRef(() => TasksModule),
  ],
  providers: [ActivityLogsService, UndoService],
  controllers: [ActivityLogsController],
  exports: [ActivityLogsService, UndoService],
})
export class ActivityLogsModule {}
