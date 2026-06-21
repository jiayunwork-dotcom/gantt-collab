import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateResourceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  dailyCapacity?: number;

  @IsOptional()
  @IsString()
  userId?: string;
}
