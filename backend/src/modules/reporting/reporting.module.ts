import { Module } from '@nestjs/common';
import { ReportingService } from './reporting.service.js';
import { ReportingController } from './reporting.controller.js';
import { ReportBuilderService } from './report-builder.service.js';
import { PrismaService } from '../../common/prisma.service.js';

@Module({
  controllers: [ReportingController],
  providers: [ReportingService, ReportBuilderService, PrismaService],
  exports: [ReportingService],
})
export class ReportingModule {}
