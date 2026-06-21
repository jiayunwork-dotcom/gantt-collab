import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ResourcesModule } from './modules/resources/resources.module';
import { BaselinesModule } from './modules/baselines/baselines.module';
import { ImportExportModule } from './modules/import-export/import-export.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { RedisModule } from './modules/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: parseInt(config.get('DB_PORT', '5432'), 10),
        username: config.get('DB_USER', 'gantt'),
        password: config.get('DB_PASSWORD', 'gantt123'),
        database: config.get('DB_NAME', 'gantt_collab'),
        autoLoadEntities: true,
        synchronize: true,
        logging: false,
      }),
    }),
    RedisModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    ResourcesModule,
    BaselinesModule,
    ImportExportModule,
    CollaborationModule,
  ],
})
export class AppModule {}
