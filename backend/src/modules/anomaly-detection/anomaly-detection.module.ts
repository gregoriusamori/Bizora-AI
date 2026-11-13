import { Module } from '@nestjs/common';
import { AnomalyDetectionService } from './anomaly-detection.service.js';
import { AnomalyDetectionController } from './anomaly-detection.controller.js';
import { PrismaService } from '../../common/prisma.service.js';

@Module({
  controllers: [AnomalyDetectionController],
  providers: [AnomalyDetectionService, PrismaService],
  exports: [AnomalyDetectionService],
})
export class AnomalyDetectionModule {}
