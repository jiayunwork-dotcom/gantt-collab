import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateResourceDto {
  @IsOptional()
  @IsString()
  name?: string;

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
