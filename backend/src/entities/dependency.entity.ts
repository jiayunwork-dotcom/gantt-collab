import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum DependencyType {
  FS = 'FS',
  FF = 'FF',
  SS = 'SS',
  SF = 'SF',
}

@Entity('dependencies')
@Index(['projectId', 'sourceTaskId', 'targetTaskId'], { unique: true })
export class Dependency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column()
  sourceTaskId: string;

  @Column()
  targetTaskId: string;

  @Column({
    type: 'enum',
    enum: DependencyType,
    default: DependencyType.FS,
  })
  type: DependencyType;

  @Column({ type: 'int', default: 0 })
  lag: number;

  @CreateDateColumn()
  createdAt: Date;
}
