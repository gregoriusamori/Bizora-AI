import { IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class RunClusteringDto {
  @IsUUID()
  datasetId: string;

  @IsString()
  featureColumn: string;

  @IsString()
  @IsOptional()
  secondFeatureColumn?: string;

  @Min(2)
  @IsOptional()
  clusters: number = 3;
}

export class RunSegmentationDto {
  @IsUUID()
  datasetId: string;

  @IsString()
  customerColumn: string;

  @IsString()
  dateColumn: string;

  @IsString()
  @IsOptional()
  revenueColumn?: string;

  @Min(2)
  @IsOptional()
  segments: number = 4;
}
