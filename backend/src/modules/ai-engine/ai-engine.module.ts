import { Module } from '@nestjs/common';
import { AiEngineService } from './ai-engine.service.js';
import { LlmProviderService } from './llm-provider.service.js';
import { TextToSqlService } from './text-to-sql.service.js';
import { SqlValidationService } from './sql-validator.service.js';
import { BusinessAnalyticsModule } from '../business-analytics/business-analytics.module.js';

@Module({
  imports: [BusinessAnalyticsModule],
  providers: [AiEngineService, LlmProviderService, TextToSqlService, SqlValidationService],
})
export class AiEngineModule {}
