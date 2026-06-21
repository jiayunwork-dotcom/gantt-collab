import { IsString } from 'class-validator';

export class CreateBaselineDto {
  @IsString()
  name: string;
}
