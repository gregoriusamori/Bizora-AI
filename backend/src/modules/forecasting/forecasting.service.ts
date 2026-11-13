import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import {
  buildTimeSeries,
  Granularity,
  TimeSeriesPoint,
} from './time-series.util.js';
import { RunForecastDto } from './dto/run-forecast.dto.js';

export const MIN_POINTS_FOR_FORECAST = 8;

export interface ForecastPoint {
  period: string;
  value: number;
  lower: number;
  upper: number;
  isForecast: boolean;
}

export interface ForecastResult {
  datasetId: string;
  dateColumn: string;
  metricColumn: string;
  granularity: Granularity;
  method: string;
  adequate: boolean;
  message?: string;
  dataPoints: number;
  history: TimeSeriesPoint[];
  forecast: ForecastPoint[];
  metrics: {
    rmse: number | null;
    mape: number | null;
  };
  limitations: string[];
}

interface FittedModel {
  method: string;
  fitted: number[];
  params: Record<string, number>;
  extend: (horizon: number) => number[];
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

@Injectable()
export class ForecastingService {
  movingAverage(values: number[], window = 3): number[] {
    if (values.length === 0) {
      return [];
    }
    const w = Math.max(1, Math.min(window, values.length));
    const result: number[] = [];
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - w + 1);
      const slice = values.slice(start, i + 1);
      result.push(mean(slice));
    }
    return result;
  }

  exponentialSmoothing(values: number[], alpha = 0.5): number[] {
    if (values.length === 0) {
      return [];
    }
    const a = Math.min(1, Math.max(0.01, alpha));
    const result: number[] = [];
    let level = values[0];
    let trend = values.length > 1 ? values[1] - values[0] : 0;
    result.push(level);
    for (let i = 1; i < values.length; i++) {
      const prevLevel = level;
      level = a * values[i] + (1 - a) * (level + trend);
      trend = 0.8 * (level - prevLevel) + 0.2 * trend;
      result.push(level);
    }
    return result;
  }

  private holtModel(values: number[], alpha = 0.5, beta = 0.3): FittedModel {
    const fitted = this.exponentialSmoothing(values, alpha);
    let level = fitted[fitted.length - 1];
    let trend = values.length > 1 ? values[1] - values[0] : 0;
    if (fitted.length > 1) {
      trend = fitted[fitted.length - 1] - fitted[fitted.length - 2];
    }
    level = fitted[fitted.length - 1] ?? values[0];
    return {
      method: 'exponential_smoothing',
      fitted,
      params: { alpha, beta },
      extend: (horizon: number) =>
        Array.from({ length: horizon }, (_, h) => level + trend * (h + 1)),
    };
  }

  linearRegression(values: number[]): { slope: number; intercept: number; r2: number } {
    const n = values.length;
    if (n < 2) {
      return { slope: 0, intercept: n === 1 ? values[0] : 0, r2: 0 };
    }
    const xs = Array.from({ length: n }, (_, i) => i);
    const xMean = mean(xs);
    const yMean = mean(values);
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - xMean) * (values[i] - yMean);
      den += (xs[i] - xMean) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = yMean - slope * xMean;
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
      const predicted = slope * xs[i] + intercept;
      ssRes += (values[i] - predicted) ** 2;
      ssTot += (values[i] - yMean) ** 2;
    }
    const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
    return { slope, intercept, r2 };
  }

  private linearModel(values: number[]): FittedModel {
    const { slope, intercept } = this.linearRegression(values);
    const fitted = values.map((_, i) => slope * i + intercept);
    return {
      method: 'linear_regression',
      fitted,
      params: { slope, intercept },
      extend: (horizon: number) =>
        Array.from({ length: horizon }, (_, h) => {
          const x = values.length + h;
          return slope * x + intercept;
        }),
    };
  }

  private movingAverageModel(values: number[], window = 3): FittedModel {
    const fitted = this.movingAverage(values, window);
    const last = fitted[fitted.length - 1] ?? mean(values);
    return {
      method: 'moving_average',
      fitted,
      params: { window },
      extend: (horizon: number) => Array.from({ length: horizon }, () => last),
    };
  }

  private selectModel(values: number[]): FittedModel {
    const holdout = Math.min(3, Math.floor(values.length * 0.25));
    if (holdout < 2) {
      return this.holtModel(values);
    }
    const train = values.slice(0, values.length - holdout);
    const test = values.slice(values.length - holdout);
    if (train.length < 2) {
      return this.holtModel(values);
    }
    const candidates = [
      this.movingAverageModel(values, 3),
      this.holtModel(values),
      this.linearModel(values),
    ];
    let best: FittedModel | null = null;
    let bestError = Infinity;
    for (const candidate of candidates) {
      let errorSum = 0;
      let valid = true;
      for (let h = 1; h <= test.length; h++) {
        const history = values.slice(0, values.length - test.length + h - 1);
        const refit = this.refit(candidate.method, history, candidate.params);
        const predicted = refit.extend(1)[0];
        const actual = test[h - 1];
        if (!Number.isFinite(predicted)) {
          valid = false;
          break;
        }
        errorSum += (predicted - actual) ** 2;
      }
      if (!valid) {
        continue;
      }
      const rmse = Math.sqrt(errorSum / test.length);
      if (rmse < bestError) {
        bestError = rmse;
        best = candidate;
      }
    }
    return best ?? this.holtModel(values);
  }

  private refit(
    method: string,
    values: number[],
    params: Record<string, number>,
  ): FittedModel {
    if (method === 'linear_regression') {
      return this.linearModel(values);
    }
    if (method === 'exponential_smoothing') {
      return this.holtModel(values, params['alpha'] ?? 0.5);
    }
    return this.movingAverageModel(values, Math.round(params['window'] ?? 3));
  }

  private nextPeriods(lastPeriod: string, granularity: Granularity, horizon: number): string[] {
    const periods: string[] = [];
    if (granularity === 'quarterly') {
      const [y, q] = lastPeriod.split('-Q');
      let year = Number(y);
      let quarter = Number(q);
      for (let i = 0; i < horizon; i++) {
        quarter += 1;
        if (quarter > 4) {
          quarter = 1;
          year += 1;
        }
        periods.push(`${year}-Q${quarter}`);
      }
      return periods;
    }
    if (granularity === 'yearly') {
      const y = Number(lastPeriod);
      for (let i = 1; i <= horizon; i++) {
        periods.push(`${y + i}`);
      }
      return periods;
    }
    const parts = lastPeriod.split('-').map(Number);
    let date: Date;
    if (granularity === 'daily' && parts.length >= 3) {
      date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    } else if (granularity === 'weekly' && parts.length >= 3) {
      date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    } else if (parts.length >= 2) {
      date = new Date(Date.UTC(parts[0], parts[1] - 1, 1));
    } else {
      date = new Date(Date.UTC(parts[0] ?? 2000, 0, 1));
    }
    const step =
      granularity === 'daily' ? 1 : granularity === 'weekly' ? 7 : 0;
    for (let i = 0; i < horizon; i++) {
      if (granularity === 'daily' || granularity === 'weekly') {
        date = new Date(date.getTime() + step * 24 * 60 * 60 * 1000);
      } else {
        date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
      }
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      periods.push(granularity === 'monthly' ? `${y}-${m}` : `${y}-${m}-${d}`);
    }
    return periods;
  }

  async runForecast(dto: RunForecastDto): Promise<ForecastResult> {
    const dataset = await this.prisma.dataset.findUnique({
      where: { id: dto.datasetId },
    });
    if (!dataset) {
      throw new NotFoundException('Dataset not found');
    }

    const where = {
      datasetId: dto.datasetId,
      ...(dto.startDate || dto.endDate
        ? {
            createdAt: {
              ...(dto.startDate ? { gte: new Date(dto.startDate) } : {}),
              ...(dto.endDate ? { lte: new Date(dto.endDate) } : {}),
            },
          }
        : {}),
    };
    const data = await this.prisma.datasetData.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    const rows = data.map((d) => d.rowData as Record<string, unknown>);
    const filtered = rows.filter((row) => {
      if (!dto.startDate && !dto.endDate) {
        return true;
      }
      const raw = row[dto.dateColumn];
      if (raw === null || raw === undefined) {
        return false;
      }
      const date = raw instanceof Date ? raw : new Date(String(raw));
      if (Number.isNaN(date.getTime())) {
        return false;
      }
      if (dto.startDate && date < new Date(dto.startDate)) {
        return false;
      }
      if (dto.endDate && date > new Date(dto.endDate)) {
        return false;
      }
      return true;
    });

    const series = buildTimeSeries(
      filtered,
      dto.dateColumn,
      dto.metricColumn,
      dto.granularity,
      dto.aggregation ?? 'sum',
    );

    const limitations: string[] = [
      'Forecasting assumes historical patterns continue in the future.',
      'Predictions are statistical estimates, not guarantees.',
      'External factors (market changes, campaigns, seasonality) are not modeled.',
    ];

    if (series.length < MIN_POINTS_FOR_FORECAST) {
      return {
        datasetId: dto.datasetId,
        dateColumn: dto.dateColumn,
        metricColumn: dto.metricColumn,
        granularity: dto.granularity,
        method: dto.method ?? 'auto',
        adequate: false,
        message: `Data tidak memadai untuk forecasting. Minimal ${MIN_POINTS_FOR_FORECAST} titik data periode diperlukan, dataset hanya memiliki ${series.length}.`,
        dataPoints: series.length,
        history: series,
        forecast: [],
        metrics: { rmse: null, mape: null },
        limitations,
      };
    }

    const values = series.map((p) => p.value);
    const model =
      dto.method && dto.method !== 'auto'
        ? dto.method === 'linear_regression'
          ? this.linearModel(values)
          : dto.method === 'exponential_smoothing'
            ? this.holtModel(values)
            : this.movingAverageModel(values)
        : this.selectModel(values);

    const fitted = model.fitted;
    let errorSum = 0;
    let mapeSum = 0;
    let mapeCount = 0;
    for (let i = 0; i < values.length; i++) {
      const residual = values[i] - fitted[i];
      errorSum += residual ** 2;
      if (values[i] !== 0) {
        mapeSum += Math.abs(residual / values[i]);
        mapeCount++;
      }
    }
    const rmse = Math.sqrt(errorSum / values.length);
    const mape = mapeCount > 0 ? (mapeSum / mapeCount) * 100 : null;

    const horizon = Math.max(1, Math.min(dto.horizon ?? 6, 24));
    const forecastValues = model.extend(horizon);
    const periods = this.nextPeriods(
      series[series.length - 1].period,
      dto.granularity,
      horizon,
    );

    const forecast: ForecastPoint[] = forecastValues.map((value, i) => ({
      period: periods[i],
      value: round(Math.max(0, value)),
      lower: round(Math.max(0, value - 1.96 * rmse)),
      upper: round(value + 1.96 * rmse),
      isForecast: true,
    }));

    return {
      datasetId: dto.datasetId,
      dateColumn: dto.dateColumn,
      metricColumn: dto.metricColumn,
      granularity: dto.granularity,
      method: model.method,
      adequate: true,
      dataPoints: series.length,
      history: series,
      forecast,
      metrics: {
        rmse: round(rmse),
        mape: mape === null ? null : round(mape),
      },
      limitations,
    };
  }

  constructor(private readonly prisma: PrismaService) {}
}
