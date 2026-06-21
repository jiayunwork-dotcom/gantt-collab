import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { BaselinesService } from './baselines.service';
import { CreateBaselineDto } from './dto/create-baseline.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProjectEditorGuard } from '../../common/guards/project-editor.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';

@Controller('projects/:projectId/baselines')
@UseGuards(JwtAuthGuard)
export class BaselinesController {
  constructor(private readonly baselinesService: BaselinesService) {}

  @Post()
  @UseGuards(ProjectEditorGuard)
  create(
    @Param('projectId') projectId: string,
    @CurrentUser() user: User,
    @Body() createBaselineDto: CreateBaselineDto,
  ) {
    return this.baselinesService.create(projectId, user.id, createBaselineDto);
  }

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.baselinesService.findAll(projectId);
  }

  @Get(':baselineId')
  findOne(
    @Param('projectId') projectId: string,
    @Param('baselineId') baselineId: string,
  ) {
    return this.baselinesService.findOne(projectId, baselineId);
  }

  @Delete(':baselineId')
  @UseGuards(ProjectEditorGuard)
  remove(
    @Param('projectId') projectId: string,
    @Param('baselineId') baselineId: string,
    @CurrentUser() user: User,
  ) {
    return this.baselinesService.remove(projectId, baselineId, user.id);
  }
}
