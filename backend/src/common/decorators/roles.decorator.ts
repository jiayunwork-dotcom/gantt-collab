import { SetMetadata } from '@nestjs/common';
import { CollaboratorRole } from '../../entities/collaborator.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: CollaboratorRole[]) => SetMetadata(ROLES_KEY, roles);
