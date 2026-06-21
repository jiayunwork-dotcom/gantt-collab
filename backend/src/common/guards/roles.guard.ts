import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CollaboratorRole } from '../../entities/collaborator.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ProjectsService } from '../../modules/projects/projects.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private projectsService: ProjectsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<CollaboratorRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    const projectId = request.params.id;
    if (!projectId) {
      return true;
    }
    return this.projectsService.checkPermission(
      projectId,
      userId,
      requiredRoles[0],
    );
  }
}
