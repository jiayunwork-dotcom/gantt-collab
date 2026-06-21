import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Project } from '../../entities/project.entity';
import {
  Collaborator,
  CollaboratorRole,
} from '../../entities/collaborator.entity';
import { Invitation } from '../../entities/invitation.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

const ROLE_LEVEL: Record<CollaboratorRole, number> = {
  [CollaboratorRole.VIEWER]: 1,
  [CollaboratorRole.EDITOR]: 2,
  [CollaboratorRole.OWNER]: 3,
};

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Collaborator)
    private readonly collaboratorRepository: Repository<Collaborator>,
    @InjectRepository(Invitation)
    private readonly invitationRepository: Repository<Invitation>,
  ) {}

  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    const project = this.projectRepository.create({
      ...dto,
      ownerId: userId,
    });
    const savedProject = await this.projectRepository.save(project);
    const collaborator = this.collaboratorRepository.create({
      projectId: savedProject.id,
      userId,
      role: CollaboratorRole.OWNER,
    });
    await this.collaboratorRepository.save(collaborator);
    return savedProject;
  }

  async findAll(userId: string): Promise<Project[]> {
    const collaborators = await this.collaboratorRepository.find({
      where: { userId },
      relations: ['project'],
    });
    return collaborators.map((c) => c.project);
  }

  async findOne(projectId: string, userId: string): Promise<Project> {
    await this.checkPermission(projectId, userId, CollaboratorRole.VIEWER);
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: ['collaborators', 'collaborators.user'],
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async update(
    projectId: string,
    userId: string,
    dto: UpdateProjectDto,
  ): Promise<Project> {
    await this.checkPermission(projectId, userId, CollaboratorRole.EDITOR);
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    Object.assign(project, dto);
    return this.projectRepository.save(project);
  }

  async remove(projectId: string, userId: string): Promise<void> {
    await this.checkPermission(projectId, userId, CollaboratorRole.OWNER);
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.projectRepository.remove(project);
  }

  async getCollaborators(
    projectId: string,
    userId: string,
  ): Promise<Collaborator[]> {
    await this.checkPermission(projectId, userId, CollaboratorRole.VIEWER);
    return this.collaboratorRepository.find({
      where: { projectId },
      relations: ['user'],
    });
  }

  async addCollaborator(
    projectId: string,
    userId: string,
    targetUserId: string,
    role: CollaboratorRole,
  ): Promise<Collaborator> {
    await this.checkPermission(projectId, userId, CollaboratorRole.OWNER);
    const existing = await this.collaboratorRepository.findOne({
      where: { projectId, userId: targetUserId },
    });
    if (existing) {
      throw new BadRequestException('User is already a collaborator');
    }
    const collaborator = this.collaboratorRepository.create({
      projectId,
      userId: targetUserId,
      role,
    });
    return this.collaboratorRepository.save(collaborator);
  }

  async updateCollaboratorRole(
    projectId: string,
    userId: string,
    collaboratorId: string,
    role: CollaboratorRole,
  ): Promise<Collaborator> {
    await this.checkPermission(projectId, userId, CollaboratorRole.OWNER);
    const collaborator = await this.collaboratorRepository.findOne({
      where: { id: collaboratorId, projectId },
    });
    if (!collaborator) {
      throw new NotFoundException('Collaborator not found');
    }
    if (collaborator.role === CollaboratorRole.OWNER) {
      throw new BadRequestException('Cannot change owner role');
    }
    collaborator.role = role;
    return this.collaboratorRepository.save(collaborator);
  }

  async removeCollaborator(
    projectId: string,
    userId: string,
    collaboratorId: string,
  ): Promise<void> {
    await this.checkPermission(projectId, userId, CollaboratorRole.OWNER);
    const collaborator = await this.collaboratorRepository.findOne({
      where: { id: collaboratorId, projectId },
    });
    if (!collaborator) {
      throw new NotFoundException('Collaborator not found');
    }
    if (collaborator.role === CollaboratorRole.OWNER) {
      throw new BadRequestException('Cannot remove owner');
    }
    await this.collaboratorRepository.remove(collaborator);
  }

  async createInvitation(
    projectId: string,
    userId: string,
    role: CollaboratorRole,
    expiresInDays?: number,
  ): Promise<Invitation> {
    await this.checkPermission(projectId, userId, CollaboratorRole.OWNER);
    const invitation = this.invitationRepository.create({
      projectId,
      token: uuidv4(),
      role,
      invitedBy: userId,
      expiresAt: expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null,
    });
    return this.invitationRepository.save(invitation);
  }

  async acceptInvitation(token: string, userId: string): Promise<Collaborator> {
    const invitation = await this.invitationRepository.findOne({
      where: { token },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.used) {
      throw new BadRequestException('Invitation already used');
    }
    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
      throw new BadRequestException('Invitation expired');
    }
    const existing = await this.collaboratorRepository.findOne({
      where: { projectId: invitation.projectId, userId },
    });
    if (existing) {
      throw new BadRequestException('User is already a collaborator');
    }
    const collaborator = this.collaboratorRepository.create({
      projectId: invitation.projectId,
      userId,
      role: invitation.role,
    });
    invitation.used = true;
    await this.invitationRepository.save(invitation);
    return this.collaboratorRepository.save(collaborator);
  }

  async checkPermission(
    projectId: string,
    userId: string,
    minRole: CollaboratorRole,
  ): Promise<boolean> {
    const collaborator = await this.collaboratorRepository.findOne({
      where: { projectId, userId },
    });
    if (!collaborator) {
      throw new ForbiddenException('Access denied');
    }
    if (ROLE_LEVEL[collaborator.role] < ROLE_LEVEL[minRole]) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
