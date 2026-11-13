import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ValidationPipe } from '@nestjs/common';
import type { Response } from 'express';
import { ReportingService } from './reporting.service.js';
import { GenerateReportDto } from './dto/generate-report.dto.js';

@Controller('reports')
@UseGuards(AuthGuard('jwt'))
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Post('generate')
  async generate(@Body(new ValidationPipe()) dto: GenerateReportDto) {
    return this.reportingService.generate(dto);
  }

  @Get()
  async list() {
    return this.reportingService.list();
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const { filePath, meta } = await this.reportingService.getDownload(id);
    res.download(filePath, meta.fileName);
  }
}
