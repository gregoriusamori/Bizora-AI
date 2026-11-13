import { Module } from '@nestjs/common';
import { BusinessAnalyticsService } from './business-analytics.service.js';

@Module({
  providers: [BusinessAnalyticsService],
  exports: [BusinessAnalyticsService],
})
export class BusinessAnalyticsModule {}
