import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Project } from './project.entity';

export enum TaskPriority {
  URGENT = 'urgent',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  projectId: string;

  @ManyToOne(() => Project, (p) => p.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ nullable: true })
  parentId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({
    type: 'enum',
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
  })
  priority: TaskPriority;

  @Column({ type: 'simple-array', default: '' })
  tags: string[];

  @Column({ nullable: true })
  assigneeId: string;

  @Column({ type: 'int', default: 8 })
  dailyHours: number;

  @Column({ type: 'boolean', default: false })
  isMilestone: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'int', nullable: true })
  duration: number;

  @Column({ type: 'float', nullable: true })
  earlyStart: number;

  @Column({ type: 'float', nullable: true })
  earlyFinish: number;

  @Column({ type: 'float', nullable: true })
  lateStart: number;

  @Column({ type: 'float', nullable: true })
  lateFinish: number;

  @Column({ type: 'float', nullable: true })
  totalFloat: number;

  @OneToMany(() => Task, (t) => t.parentId, { cascade: true })
  children: Task[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
