import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ValidationPipe } from '@nestjs/common';
import { AnomalyDetectionService } from './anomaly-detection.service.js';
import { RunAnomalyDetectionDto } from './dto/run-anomaly.dto.js';
import { PrismaService } from '../../common/prisma.service.js';
import { buildTimeSeries } from '../forecasting/time-series.util.js';

@Controller('anomaly-detection')
@UseGuards(AuthGuard('jwt'))
export class AnomalyDetectionController {
  constructor(
    private readonly anomalyDetectionService: AnomalyDetectionService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('run')
  async run(@Body(new ValidationPipe()) dto: RunAnomalyDetectionDto) {
    const dataset = await this.prisma.dataset.findUnique({
      where: { id: dto.datasetId },
    });
    if (!dataset) {
      throw new Error('Dataset not found');
    }
    const data = await this.prisma.datasetData.findMany({
      where: { datasetId: dto.datasetId },
    });
    const rows = data.map((d) => d.rowData as Record<string, unknown>);

    const series = buildTimeSeries(
      rows,
      dto.dateColumn,
      dto.metricColumn,
      dto.granularity ?? 'monthly',
      dto.aggregation ?? 'sum',
    );

    if (series.length < 4) {
      return {
        adequate: false,
        message:
          'Data tidak memadai untuk deteksi anomali. Minimal 4 titik data periode diperlukan.',
        dataPoints: series.length,
        totalPoints: series.length,
        anomalyCount: 0,
        anomalies: [],
        bounds: {
          mean: null,
          stdDev: null,
          lower: null,
          upper: null,
          q1: null,
          q3: null,
          iqrLower: null,
          iqrUpper: null,
        },
        series,
      };
    }

    const values = series.map((p) => p.value);
    const result = this.anomalyDetectionService.analyze(values, dto.method ?? 'zscore');
    const periodAnomalies = result.anomalies.map((point, i) => ({
      ...point,
      period: series[i].period,
    }));

    return {
      adequate: true,
      dateColumn: dto.dateColumn,
      metricColumn: dto.metricColumn,
      granularity: dto.granularity ?? 'monthly',
      series,
      ...result,
      anomalies: periodAnomalies,
    };
  }
}
