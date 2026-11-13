import { Module } from '@nestjs/common';
import { AnomalyDetectionService } from './anomaly-detection.service.js';
import { AnomalyDetectionController } from './anomaly-detection.controller.js';

@Module({
  controllers: [AnomalyDetectionController],
  providers: [AnomalyDetectionService],
  exports: [AnomalyDetectionService],
})
export class AnomalyDetectionModule {}
