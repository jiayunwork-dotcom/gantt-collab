import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';
import { Project } from './project.entity';
import { User } from './user.entity';

export enum ActionType {
  TASK_CREATE = 'task_create',
  TASK_DELETE = 'task_delete',
  TASK_UPDATE = 'task_update',
  TASK_MOVE = 'task_move',
  DEPENDENCY_CREATE = 'dependency_create',
  DEPENDENCY_DELETE = 'dependency_delete',
  COLLABORATOR_ADD = 'collaborator_add',
  COLLABORATOR_REMOVE = 'collaborator_remove',
  COLLABORATOR_ROLE_CHANGE = 'collaborator_role_change',
  BASELINE_CREATE = 'baseline_create',
  BASELINE_DELETE = 'baseline_delete',
}

export enum TargetType {
  TASK = 'task',
  DEPENDENCY = 'dependency',
  COLLABORATOR = 'collaborator',
  BASELINE = 'baseline',
}

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: ActionType,
  })
  @Index()
  actionType: ActionType;

  @Column({
    type: 'enum',
    enum: TargetType,
  })
  targetType: TargetType;

  @Column()
  @Index()
  targetId: string;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, { old: any; new: any }> | Record<string, any>;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
