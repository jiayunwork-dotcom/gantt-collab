import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportExportService } from './import-export.service';
import { ImportExportController } from './import-export.controller';
import { Task } from '../../entities/task.entity';
import { Dependency } from '../../entities/dependency.entity';
import { Resource } from '../../entities/resource.entity';
import { Project } from '../../entities/project.entity';
import { Collaborator } from '../../entities/collaborator.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, Dependency, Resource, Project, Collaborator]),
  ],
  providers: [ImportExportService],
  controllers: [ImportExportController],
  exports: [ImportExportService],
})
export class ImportExportModule {}
