import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { ActivityLogsService } from './activity-logs.service';
import { ActionType } from '../../entities/activity-log.entity';
import { ProjectsService } from '../projects/projects.service';
import { CollaboratorRole } from '../../entities/collaborator.entity';

@Controller('projects/:projectId/activity-logs')
@UseGuards(JwtAuthGuard)
export class ActivityLogsController {
  constructor(
    private readonly activityLogsService: ActivityLogsService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Get()
  async findLogs(
    @Param('projectId') projectId: string,
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('actionType') actionType?: ActionType,
  ) {
    await this.projectsService.checkPermission(projectId, user.id, CollaboratorRole.VIEWER);
    return this.activityLogsService.findByProject(
      projectId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      actionType,
    );
  }
}
