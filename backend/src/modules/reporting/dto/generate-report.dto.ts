import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import type { Granularity } from '../../forecasting/time-series.util.js';

export const REPORT_TYPES = [
  'sales_report',
  'profit_report',
  'product_performance_report',
  'branch_performance_report',
  'customer_analysis_report',
  'monthly_business_report',
  'executive_summary',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export class GenerateReportDto {
  @IsUUID()
  datasetId: string;

  @IsIn(REPORT_TYPES)
  reportType: ReportType;

  @IsIn(['pdf', 'xlsx', 'csv'])
  format: 'pdf' | 'xlsx' | 'csv';

  @IsString()
  dateColumn: string;

  @IsString()
  metricColumn: string;

  @IsString()
  @IsOptional()
  costColumn?: string;

  @IsString()
  @IsOptional()
  groupColumn?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
  @IsOptional()
  granularity: Granularity = 'monthly';

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
