import { Module } from '@nestjs/common';
import { LlmProviderService } from './llm-provider.service.js';
import { TextToSqlService } from './text-to-sql.service.js';
import { SqlValidationService } from './sql-validator.service.js';
import { AnalysisToolsService } from './analysis-tools.service.js';
import { ForecastingModule } from '../forecasting/forecasting.module.js';
import { ClusteringModule } from '../clustering/clustering.module.js';
import { AnomalyDetectionModule } from '../anomaly-detection/anomaly-detection.module.js';
import { BusinessAnalyticsModule } from '../business-analytics/business-analytics.module.js';

@Module({
  imports: [
    BusinessAnalyticsModule,
    ForecastingModule,
    ClusteringModule,
    AnomalyDetectionModule,
  ],
  providers: [LlmProviderService, TextToSqlService, SqlValidationService, AnalysisToolsService],
  exports: [LlmProviderService, TextToSqlService, AnalysisToolsService],
})
export class AiEngineModule {}
