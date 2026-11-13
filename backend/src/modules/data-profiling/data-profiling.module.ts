import { Module } from '@nestjs/common';
import { DataProfilingService } from './data-profiling.service.js';

@Module({
  providers: [DataProfilingService],
})
export class DataProfilingModule {}
