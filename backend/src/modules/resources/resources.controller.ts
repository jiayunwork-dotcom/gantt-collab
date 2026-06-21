import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProjectEditorGuard } from '../../common/guards/project-editor.guard';

@Controller('projects/:projectId/resources')
@UseGuards(JwtAuthGuard)
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Post()
  @UseGuards(ProjectEditorGuard)
  create(
    @Param('projectId') projectId: string,
    @Body() createResourceDto: CreateResourceDto,
  ) {
    return this.resourcesService.create(projectId, createResourceDto);
  }

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.resourcesService.findAll(projectId);
  }

  @Get('workload')
  computeWorkload(@Param('projectId') projectId: string) {
    return this.resourcesService.computeWorkload(projectId);
  }

  @Get(':resourceId')
  findOne(
    @Param('projectId') projectId: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.resourcesService.findOne(projectId, resourceId);
  }

  @Patch(':resourceId')
  @UseGuards(ProjectEditorGuard)
  update(
    @Param('projectId') projectId: string,
    @Param('resourceId') resourceId: string,
    @Body() updateResourceDto: UpdateResourceDto,
  ) {
    return this.resourcesService.update(projectId, resourceId, updateResourceDto);
  }

  @Delete(':resourceId')
  @UseGuards(ProjectEditorGuard)
  remove(
    @Param('projectId') projectId: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.resourcesService.remove(projectId, resourceId);
  }
}
