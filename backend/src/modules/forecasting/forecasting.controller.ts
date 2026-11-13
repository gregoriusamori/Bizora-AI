import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ValidationPipe } from '@nestjs/common';
import { ForecastingService } from './forecasting.service.js';
import { RunForecastDto } from './dto/run-forecast.dto.js';

@Controller('forecasting')
@UseGuards(AuthGuard('jwt'))
export class ForecastingController {
  constructor(private readonly forecastingService: ForecastingService) {}

  @Post('run')
  async run(@Body(new ValidationPipe()) dto: RunForecastDto) {
    return this.forecastingService.runForecast(dto);
  }
}
