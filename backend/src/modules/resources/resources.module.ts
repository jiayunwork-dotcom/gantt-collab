import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResourcesService } from './resources.service';
import { ResourcesController } from './resources.controller';
import { Resource } from '../../entities/resource.entity';
import { Task } from '../../entities/task.entity';
import { Project } from '../../entities/project.entity';
import { Collaborator } from '../../entities/collaborator.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Resource, Task, Project, Collaborator])],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
