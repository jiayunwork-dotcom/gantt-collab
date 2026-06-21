import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { CollaboratorRole } from './collaborator.entity';

@Entity('invitations')
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @ManyToOne(() => Project, (p) => p.invitations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ unique: true })
  token: string;

  @Column({
    type: 'enum',
    enum: CollaboratorRole,
    default: CollaboratorRole.VIEWER,
  })
  role: CollaboratorRole;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date;

  @Column({ default: false })
  used: boolean;

  @Column({ nullable: true })
  invitedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
