import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import type { Granularity } from '../time-series.util.js';

export class RunForecastDto {
  @IsUUID()
  datasetId: string;

  @IsString()
  dateColumn: string;

  @IsString()
  metricColumn: string;

  @IsIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
  granularity: Granularity = 'monthly';

  @IsIn(['sum', 'avg', 'count'])
  @IsOptional()
  aggregation: 'sum' | 'avg' | 'count' = 'sum';

  @IsIn(['moving_average', 'exponential_smoothing', 'linear_regression', 'auto'])
  @IsOptional()
  method: 'moving_average' | 'exponential_smoothing' | 'linear_regression' | 'auto' =
    'auto';

  @Min(1)
  @IsOptional()
  horizon: number = 6;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
