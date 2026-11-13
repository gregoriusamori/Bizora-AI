import { Module } from '@nestjs/common';
import { ClusteringService } from './clustering.service.js';
import { SegmentationService } from './segmentation.service.js';
import { ClusteringController } from './clustering.controller.js';
import { PrismaService } from '../../common/prisma.service.js';

@Module({
  controllers: [ClusteringController],
  providers: [ClusteringService, SegmentationService, PrismaService],
  exports: [ClusteringService, SegmentationService],
})
export class ClusteringModule {}
