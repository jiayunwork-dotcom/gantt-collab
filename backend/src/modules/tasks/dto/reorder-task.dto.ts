import { IsInt, IsOptional, IsUUID } from 'class-validator';

export class ReorderTaskDto {
  @IsInt()
  newSortOrder: number;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
