import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Collaborator } from './collaborator.entity';
import { Task } from './task.entity';
import { Resource } from './resource.entity';
import { Baseline } from './baseline.entity';
import { Invitation } from './invitation.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column()
  ownerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ type: 'date', nullable: true })
  startDate: string;

  @Column({ type: 'date', nullable: true })
  endDate: string;

  @OneToMany(() => Collaborator, (c) => c.project, { cascade: true })
  collaborators: Collaborator[];

  @OneToMany(() => Task, (t) => t.project, { cascade: true })
  tasks: Task[];

  @OneToMany(() => Resource, (r) => r.project, { cascade: true })
  resources: Resource[];

  @OneToMany(() => Baseline, (b) => b.project, { cascade: true })
  baselines: Baseline[];

  @OneToMany(() => Invitation, (i) => i.project, { cascade: true })
  invitations: Invitation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
