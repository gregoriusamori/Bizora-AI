import { IsIn, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import type { Granularity } from '../../forecasting/time-series.util.js';

export class RunAnomalyDetectionDto {
  @IsUUID()
  datasetId: string;

  @IsString()
  dateColumn: string;

  @IsString()
  metricColumn: string;

  @IsIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
  @IsOptional()
  granularity: Granularity = 'monthly';

  @IsIn(['sum', 'avg', 'count'])
  @IsOptional()
  aggregation: 'sum' | 'avg' | 'count' = 'sum';

  @IsIn(['zscore', 'iqr'])
  @IsOptional()
  method: 'zscore' | 'iqr' = 'zscore';
}
