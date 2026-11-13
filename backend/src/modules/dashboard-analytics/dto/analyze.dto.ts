import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AnalyzeDto {
  @IsUUID()
  datasetId: string;

  @IsString()
  @MaxLength(120)
  dateColumn: string;

  @IsString()
  @MaxLength(120)
  revenueColumn: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  costColumn?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  groupColumn?: string;

  @IsIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
  @IsOptional()
  granularity?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

  @IsString()
  @IsOptional()
  @MaxLength(10)
  startDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  endDate?: string;

  @IsNumber()
  @Min(1)
  @Max(50)
  @IsOptional()
  topN?: number;
}
