import { IsUUID, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { DependencyType } from '../../../entities/dependency.entity';

export class CreateDependencyDto {
  @IsUUID()
  sourceTaskId: string;

  @IsUUID()
  targetTaskId: string;

  @IsOptional()
  @IsEnum(DependencyType)
  type?: DependencyType;

  @IsOptional()
  @IsInt()
  @Min(0)
  lag?: number;
}
