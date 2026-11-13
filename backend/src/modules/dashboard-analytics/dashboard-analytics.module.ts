import { Module } from '@nestjs/common';
import { DashboardAnalyticsController } from './dashboard-analytics.controller.js';
import { DashboardAnalyticsService } from './dashboard-analytics.service.js';

@Module({
  controllers: [DashboardAnalyticsController],
  providers: [DashboardAnalyticsService],
})
export class DashboardAnalyticsModule {}
