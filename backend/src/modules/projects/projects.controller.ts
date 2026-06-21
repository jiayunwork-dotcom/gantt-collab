import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CollaboratorRole } from '../../entities/collaborator.entity';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
} from 'class-validator';

class AddCollaboratorDto {
  @IsString()
  userId: string;

  @IsEnum(CollaboratorRole)
  role: CollaboratorRole;
}

class UpdateCollaboratorRoleDto {
  @IsEnum(CollaboratorRole)
  role: CollaboratorRole;
}

class CreateInvitationDto {
  @IsEnum(CollaboratorRole)
  role: CollaboratorRole;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}

class AcceptInvitationDto {
  @IsString()
  token: string;
}

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.projectsService.findAll(user.id);
  }

  @Get(':id')
  findOne(@Param('id') projectId: string, @CurrentUser() user: User) {
    return this.projectsService.findOne(projectId, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') projectId: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(projectId, user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') projectId: string, @CurrentUser() user: User) {
    return this.projectsService.remove(projectId, user.id);
  }

  @Get(':id/collaborators')
  getCollaborators(
    @Param('id') projectId: string,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.getCollaborators(projectId, user.id);
  }

  @Post(':id/collaborators')
  addCollaborator(
    @Param('id') projectId: string,
    @CurrentUser() user: User,
    @Body() dto: AddCollaboratorDto,
  ) {
    return this.projectsService.addCollaborator(
      projectId,
      user.id,
      dto.userId,
      dto.role,
    );
  }

  @Patch(':id/collaborators/:collaboratorId')
  updateCollaboratorRole(
    @Param('id') projectId: string,
    @Param('collaboratorId') collaboratorId: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateCollaboratorRoleDto,
  ) {
    return this.projectsService.updateCollaboratorRole(
      projectId,
      user.id,
      collaboratorId,
      dto.role,
    );
  }

  @Delete(':id/collaborators/:collaboratorId')
  removeCollaborator(
    @Param('id') projectId: string,
    @Param('collaboratorId') collaboratorId: string,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.removeCollaborator(
      projectId,
      user.id,
      collaboratorId,
    );
  }

  @Post(':id/invitations')
  createInvitation(
    @Param('id') projectId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.projectsService.createInvitation(
      projectId,
      user.id,
      dto.role,
      dto.expiresInDays,
    );
  }

  @Post('invitations/accept')
  acceptInvitation(
    @CurrentUser() user: User,
    @Body() dto: AcceptInvitationDto,
  ) {
    return this.projectsService.acceptInvitation(dto.token, user.id);
  }
}
