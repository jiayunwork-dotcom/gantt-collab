import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '../../entities/task.entity';
import { Dependency } from '../../entities/dependency.entity';
import { Project } from '../../entities/project.entity';
import { Collaborator } from '../../entities/collaborator.entity';
import { TasksService } from './tasks.service';
import { DependenciesService } from './dependencies.service';
import { TasksController } from './tasks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Dependency, Project, Collaborator])],
  providers: [TasksService, DependenciesService],
  controllers: [TasksController],
  exports: [TasksService, DependenciesService],
})
export class TasksModule {}
