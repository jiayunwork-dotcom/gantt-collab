import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { ActivityLogsService } from './activity-logs.service';
import { UndoService, UndoError } from './undo.service';
import { ActionType } from '../../entities/activity-log.entity';
import { ProjectsService } from '../projects/projects.service';
import { CollaboratorRole } from '../../entities/collaborator.entity';

interface UndoRequest {
  force?: boolean;
}

interface UndoErrorResponse {
  code: string;
  message: string;
  conflictFields?: string[];
}

@Controller('projects/:projectId/activity-logs')
@UseGuards(JwtAuthGuard)
export class ActivityLogsController {
  constructor(
    private readonly activityLogsService: ActivityLogsService,
    private readonly undoService: UndoService,
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

  @Post(':logId/undo')
  async undoLog(
    @Param('projectId') projectId: string,
    @Param('logId') logId: string,
    @CurrentUser() user: User,
    @Body() body: UndoRequest = {},
  ): Promise<{ success: boolean }> {
    await this.projectsService.checkPermission(projectId, user.id, CollaboratorRole.EDITOR);

    try {
      await this.undoService.undoLog(projectId, logId, user.id, body.force ?? false);
      return { success: true };
    } catch (err) {
      if (err instanceof UndoError) {
        const response: UndoErrorResponse = {
          code: err.code,
          message: err.message,
        };
        if (err.conflictFields) {
          response.conflictFields = err.conflictFields;
        }
        throw new HttpException(response, HttpStatus.CONFLICT);
      }
      throw err;
    }
  }
}
