import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { TasksService } from './tasks.service';
import { DependenciesService } from './dependencies.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateDependencyDto } from './dto/create-dependency.dto';
import { ReorderTaskDto } from './dto/reorder-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';

@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly dependenciesService: DependenciesService,
  ) {}

  @Get('tasks')
  async findAllTasks(
    @Param('projectId') projectId: string,
    @CurrentUser() user: User,
  ) {
    await this.tasksService.checkPermission(projectId, user.id);
    return this.tasksService.findAll(projectId);
  }

  @Post('tasks')
  async createTask(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: User,
  ) {
    await this.tasksService.checkPermission(projectId, user.id);
    return this.tasksService.create(projectId, dto, user.id);
  }

  @Get('tasks/:taskId')
  async findOneTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: User,
  ) {
    await this.tasksService.checkPermission(projectId, user.id);
    return this.tasksService.findOne(projectId, taskId);
  }

  @Patch('tasks/:taskId')
  async updateTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: User,
  ) {
    await this.tasksService.checkPermission(projectId, user.id);
    return this.tasksService.update(projectId, taskId, dto, user.id);
  }

  @Delete('tasks/:taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: User,
  ) {
    await this.tasksService.checkPermission(projectId, user.id);
    await this.tasksService.remove(projectId, taskId, user.id);
  }

  @Post('tasks/:taskId/reorder')
  async reorderTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: ReorderTaskDto,
    @CurrentUser() user: User,
  ) {
    await this.tasksService.checkPermission(projectId, user.id);
    return this.tasksService.reorder(projectId, taskId, dto.newSortOrder, dto.parentId);
  }

  @Post('tasks/:taskId/move')
  async moveTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: MoveTaskDto,
    @CurrentUser() user: User,
  ) {
    await this.tasksService.checkPermission(projectId, user.id);
    return this.tasksService.move(projectId, taskId, dto.newParentId, user.id);
  }

  @Get('dependencies')
  async findAllDependencies(
    @Param('projectId') projectId: string,
    @CurrentUser() user: User,
  ) {
    await this.tasksService.checkPermission(projectId, user.id);
    return this.dependenciesService.findAll(projectId);
  }

  @Post('dependencies')
  async createDependency(
    @Param('projectId') projectId: string,
    @Body() dto: CreateDependencyDto,
    @CurrentUser() user: User,
  ) {
    await this.tasksService.checkPermission(projectId, user.id);
    return this.dependenciesService.create(projectId, dto, user.id);
  }

  @Delete('dependencies/:dependencyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDependency(
    @Param('projectId') projectId: string,
    @Param('dependencyId') dependencyId: string,
    @CurrentUser() user: User,
  ) {
    await this.tasksService.checkPermission(projectId, user.id);
    await this.dependenciesService.remove(projectId, dependencyId, user.id);
  }
}
