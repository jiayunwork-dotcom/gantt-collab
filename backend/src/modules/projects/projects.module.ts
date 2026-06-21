import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../../entities/project.entity';
import { Collaborator } from '../../entities/collaborator.entity';
import { Invitation } from '../../entities/invitation.entity';
import { User } from '../../entities/user.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Collaborator, Invitation, User]),
    forwardRef(() => ActivityLogsModule),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
