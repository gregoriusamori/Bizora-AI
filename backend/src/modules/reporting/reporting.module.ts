import { Module } from '@nestjs/common';
import { ReportingService } from './reporting.service.js';
import { ReportingController } from './reporting.controller.js';
import { ReportBuilderService } from './report-builder.service.js';

@Module({
  controllers: [ReportingController],
  providers: [ReportingService, ReportBuilderService],
  exports: [ReportingService],
})
export class ReportingModule {}
