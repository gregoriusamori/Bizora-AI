import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { DatasetsModule } from './modules/datasets/datasets.module.js';
import { DataProfilingModule } from './modules/data-profiling/data-profiling.module.js';
import { BusinessAnalyticsModule } from './modules/business-analytics/business-analytics.module.js';
import { AiEngineModule } from './modules/ai-engine/ai-engine.module.js';
import { ForecastingModule } from './modules/forecasting/forecasting.module.js';
import { ClusteringModule } from './modules/clustering/clustering.module.js';
import { AnomalyDetectionModule } from './modules/anomaly-detection/anomaly-detection.module.js';
import { ReportingModule } from './modules/reporting/reporting.module.js';
import { ConversationsModule } from './modules/conversations/conversations.module.js';
import { DashboardAnalyticsModule } from './modules/dashboard-analytics/dashboard-analytics.module.js';
import { HealthController } from './common/health.controller.js';
import { HealthService } from './common/health.service.js';
import { PrismaModule } from './common/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env'],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    DatasetsModule,
    DataProfilingModule,
    BusinessAnalyticsModule,
    AiEngineModule,
    ForecastingModule,
    ClusteringModule,
    AnomalyDetectionModule,
    ReportingModule,
    ConversationsModule,
    DashboardAnalyticsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, HealthService],
})
export class AppModule {}
