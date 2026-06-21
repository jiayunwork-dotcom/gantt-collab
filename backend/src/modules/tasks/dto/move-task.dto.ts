import { IsUUID } from 'class-validator';

export class MoveTaskDto {
  @IsUUID()
  newParentId: string;
}
