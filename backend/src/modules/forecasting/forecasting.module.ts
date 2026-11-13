import { Module } from '@nestjs/common';
import { ForecastingService } from './forecasting.service.js';
import { ForecastingController } from './forecasting.controller.js';

@Module({
  controllers: [ForecastingController],
  providers: [ForecastingService],
  exports: [ForecastingService],
})
export class ForecastingModule {}
