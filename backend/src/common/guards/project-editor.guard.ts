import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Collaborator, CollaboratorRole } from '../../entities/collaborator.entity';
import { Project } from '../../entities/project.entity';

@Injectable()
export class ProjectEditorGuard implements CanActivate {
  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(Collaborator)
    private collaboratorRepository: Repository<Collaborator>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const projectId = request.params.projectId || request.body.projectId;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!projectId) {
      throw new ForbiddenException('Project ID not provided');
    }

    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId === user.id) {
      return true;
    }

    const collaborator = await this.collaboratorRepository.findOne({
      where: { projectId, userId: user.id },
    });

    if (!collaborator) {
      throw new ForbiddenException('You are not a member of this project');
    }

    if (
      collaborator.role !== CollaboratorRole.OWNER &&
      collaborator.role !== CollaboratorRole.EDITOR
    ) {
      throw new ForbiddenException('You do not have editor permissions for this project');
    }

    return true;
  }
}
