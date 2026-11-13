import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ValidationPipe } from '@nestjs/common';
import type { Request } from 'express';
import { DashboardAnalyticsService } from './dashboard-analytics.service.js';
import { AnalyzeDto } from './dto/analyze.dto.js';
import type { JwtPayload } from '../auth/jwt.strategy.js';

@Controller('analytics')
@UseGuards(AuthGuard('jwt'))
export class DashboardAnalyticsController {
  constructor(private readonly analytics: DashboardAnalyticsService) {}

  private userId(req: Request): string {
    return (req.user as JwtPayload).sub;
  }

  @Post('overview')
  overview(@Req() req: Request, @Body(new ValidationPipe()) dto: AnalyzeDto) {
    return this.analytics.overview(dto);
  }

  @Post('sales')
  sales(@Req() req: Request, @Body(new ValidationPipe()) dto: AnalyzeDto) {
    return this.analytics.sales(dto);
  }

  @Post('profit')
  profit(@Req() req: Request, @Body(new ValidationPipe()) dto: AnalyzeDto) {
    return this.analytics.profit(dto);
  }

  @Post('products')
  products(@Req() req: Request, @Body(new ValidationPipe()) dto: AnalyzeDto) {
    return this.analytics.productOrBranch(dto, 'product');
  }

  @Post('branches')
  branches(@Req() req: Request, @Body(new ValidationPipe()) dto: AnalyzeDto) {
    return this.analytics.productOrBranch(dto, 'branch');
  }
}
