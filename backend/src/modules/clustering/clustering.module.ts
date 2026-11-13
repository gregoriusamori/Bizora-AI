import { Module } from '@nestjs/common';
import { ClusteringService } from './clustering.service.js';
import { SegmentationService } from './segmentation.service.js';
import { ClusteringController } from './clustering.controller.js';

@Module({
  controllers: [ClusteringController],
  providers: [ClusteringService, SegmentationService],
  exports: [ClusteringService, SegmentationService],
})
export class ClusteringModule {}
