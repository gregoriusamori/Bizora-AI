import { Module } from '@nestjs/common';
import { ForecastingService } from './forecasting.service.js';
import { ForecastingController } from './forecasting.controller.js';
import { PrismaService } from '../../common/prisma.service.js';

@Module({
  controllers: [ForecastingController],
  providers: [ForecastingService, PrismaService],
  exports: [ForecastingService],
})
export class ForecastingModule {}
