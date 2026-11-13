import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { buildTimeSeries, Granularity } from '../forecasting/time-series.util.js';
import { ForecastingService } from '../forecasting/forecasting.service.js';
import { SegmentationService } from '../clustering/segmentation.service.js';
import { AnomalyDetectionService } from '../anomaly-detection/anomaly-detection.service.js';
import { TextToSqlService, QuerySpec } from '../ai-engine/text-to-sql.service.js';

export type ToolArgs = Record<string, unknown>;

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface DatasetContext {
  datasetId: string;
  datasetName: string;
  columns: Array<{ columnName: string; dataType: string }>;
  sampleRows: Array<Record<string, unknown>>;
  rowCount: number;
}

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class AnalysisToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forecastingEngine: ForecastingService,
    private readonly segmentationEngine: SegmentationService,
    private readonly anomalyEngine: AnomalyDetectionService,
    private readonly textToSqlEngine: TextToSqlService,
  ) {}

  async loadContext(datasetId: string): Promise<DatasetContext> {
    const dataset = await this.prisma.dataset.findUnique({
      where: { id: datasetId },
      include: { columns: true },
    });
    if (!dataset) {
      throw new NotFoundException('Dataset tidak ditemukan.');
    }
    const data = await this.prisma.datasetData.findMany({
      where: { datasetId },
      take: 5,
    });
    const rowCount = await this.prisma.datasetData.count({ where: { datasetId } });
    return {
      datasetId,
      datasetName: dataset.name,
      columns: dataset.columns.map((c) => ({
        columnName: c.columnName,
        dataType: c.dataType,
      })),
      sampleRows: data.map((d) => d.rowData as Record<string, unknown>),
      rowCount,
    };
  }

  private assertColumns(ctx: DatasetContext, requested: string[]): void {
    const available = new Set(ctx.columns.map((c) => c.columnName));
    const missing = requested.filter((c) => !available.has(c));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Kolom tidak tersedia pada dataset ini: ${missing.join(', ')}. Kolom yang tersedia: ${ctx.columns
          .map((c) => c.columnName)
          .join(', ')}.`,
      );
    }
  }

  private async loadRows(datasetId: string): Promise<Array<Record<string, unknown>>> {
    const data = await this.prisma.datasetData.findMany({
      where: { datasetId },
    });
    return data.map((d) => d.rowData as Record<string, unknown>);
  }

  private filterByDate(
    rows: Array<Record<string, unknown>>,
    dateColumn: string,
    startDate?: string,
    endDate?: string,
  ): Array<Record<string, unknown>> {
    if (!startDate && !endDate) {
      return rows;
    }
    return rows.filter((row) => {
      const raw = row[dateColumn];
      if (raw === null || raw === undefined) {
        return false;
      }
      const date = raw instanceof Date ? raw : new Date(String(raw));
      if (Number.isNaN(date.getTime())) {
        return false;
      }
      if (startDate && date < new Date(startDate)) {
        return false;
      }
      if (endDate && date > new Date(endDate)) {
        return false;
      }
      return true;
    });
  }

  datasetInfo(ctx: DatasetContext): DatasetContext {
    return ctx;
  }

  summaryKpi(
    ctx: DatasetContext,
    args: { metricColumn: string; dateColumn?: string; startDate?: string; endDate?: string },
  ) {
    const cols = [args.metricColumn, ...(args.dateColumn ? [args.dateColumn] : [])];
    this.assertColumns(ctx, cols);
    return this.loadRows(ctx.datasetId).then((all) => {
      const rows = args.dateColumn
        ? this.filterByDate(all, args.dateColumn, args.startDate, args.endDate)
        : all;
      const values = rows
        .map((r) => num(r[args.metricColumn]))
        .filter((v): v is number => v !== null);
      const total = values.reduce((a, b) => a + b, 0);
      return {
        metricColumn: args.metricColumn,
        rowCount: rows.length,
        total: round(total),
        average: values.length ? round(total / values.length) : 0,
        min: values.length ? round(Math.min(...values)) : null,
        max: values.length ? round(Math.max(...values)) : null,
      };
    });
  }

  groupBreakdown(
    ctx: DatasetContext,
    args: {
      groupColumn: string;
      metricColumn: string;
      dateColumn?: string;
      agg?: 'sum' | 'avg' | 'count';
      limit?: number;
      startDate?: string;
      endDate?: string;
    },
  ) {
    this.assertColumns(ctx, [
      args.groupColumn,
      args.metricColumn,
      ...(args.dateColumn ? [args.dateColumn] : []),
    ]);
    return this.loadRows(ctx.datasetId).then((all) => {
      const rows = args.dateColumn
        ? this.filterByDate(all, args.dateColumn, args.startDate, args.endDate)
        : all;
      const agg = args.agg ?? 'sum';
      const map = new Map<string, { sum: number; count: number }>();
      for (const row of rows) {
        const label = row[args.groupColumn];
        if (label === null || label === undefined || String(label).trim() === '') {
          continue;
        }
        const value = num(row[args.metricColumn]);
        if (value === null && agg !== 'count') {
          continue;
        }
        const key = String(label);
        const entry = map.get(key) ?? { sum: 0, count: 0 };
        entry.sum += value ?? 0;
        entry.count += 1;
        map.set(key, entry);
      }
      const limit = Math.min(Math.max(args.limit ?? 10, 1), 50);
      const result = Array.from(map.entries())
        .map(([label, e]) => ({
          label,
          value:
            agg === 'count'
              ? e.count
              : agg === 'avg'
                ? e.count
                  ? round(e.sum / e.count)
                  : 0
                : round(e.sum),
          count: e.count,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
      return { groupColumn: args.groupColumn, agg, items: result };
    });
  }

  trendSeries(
    ctx: DatasetContext,
    args: {
      dateColumn: string;
      metricColumn: string;
      granularity?: Granularity;
      aggregation?: 'sum' | 'avg' | 'count';
    },
  ) {
    this.assertColumns(ctx, [args.dateColumn, args.metricColumn]);
    return this.loadRows(ctx.datasetId).then((rows) => {
      const series = buildTimeSeries(
        rows,
        args.dateColumn,
        args.metricColumn,
        args.granularity ?? 'monthly',
        args.aggregation ?? 'sum',
      );
      return {
        granularity: args.granularity ?? 'monthly',
        dataPoints: series.length,
        series,
      };
    });
  }

  growth(
    ctx: DatasetContext,
    args: {
      dateColumn: string;
      metricColumn: string;
      granularity?: Granularity;
    },
  ) {
    this.assertColumns(ctx, [args.dateColumn, args.metricColumn]);
    return this.loadRows(ctx.datasetId).then((rows) => {
      const series = buildTimeSeries(
        rows,
        args.dateColumn,
        args.metricColumn,
        args.granularity ?? 'monthly',
        'sum',
      );
      if (series.length < 2) {
        return {
          growthPercent: null,
          message: `Data hanya memiliki ${series.length} periode; minimal 2 periode untuk menghitung pertumbuhan.`,
        };
      }
      const current = series[series.length - 1];
      const previous = series[series.length - 2];
      const growthPercent =
        previous.value !== 0
          ? round(((current.value - previous.value) / previous.value) * 100)
          : null;
      return {
        granularity: args.granularity ?? 'monthly',
        previousPeriod: previous.period,
        previousValue: previous.value,
        currentPeriod: current.period,
        currentValue: current.value,
        growthPercent,
        note: 'Periode terakhir mungkin belum lengkap (data parsial).',
      };
    });
  }

  async forecast(
    ctx: DatasetContext,
    args: {
      dateColumn: string;
      metricColumn: string;
      granularity?: Granularity;
      horizon?: number;
    },
  ) {
    this.assertColumns(ctx, [args.dateColumn, args.metricColumn]);
    return this.forecastingEngine.runForecast({
      datasetId: ctx.datasetId,
      dateColumn: args.dateColumn,
      metricColumn: args.metricColumn,
      granularity: args.granularity ?? 'monthly',
      aggregation: 'sum',
      method: 'auto',
      horizon: args.horizon ?? 6,
    });
  }

  async segmentation(
    ctx: DatasetContext,
    args: {
      customerColumn: string;
      dateColumn: string;
      revenueColumn?: string;
      segments?: number;
    },
  ) {
    this.assertColumns(ctx, [args.customerColumn, args.dateColumn]);
    if (args.revenueColumn) {
      this.assertColumns(ctx, [args.revenueColumn]);
    }
    return this.segmentationEngine.runSegmentation({
      datasetId: ctx.datasetId,
      customerColumn: args.customerColumn,
      dateColumn: args.dateColumn,
      revenueColumn: args.revenueColumn,
      segments: args.segments ?? 4,
    });
  }

  async anomaly(
    ctx: DatasetContext,
    args: {
      dateColumn: string;
      metricColumn: string;
      granularity?: Granularity;
      method?: 'zscore' | 'iqr';
    },
  ) {
    this.assertColumns(ctx, [args.dateColumn, args.metricColumn]);
    const rows = await this.loadRows(ctx.datasetId);
    const series = buildTimeSeries(
      rows,
      args.dateColumn,
      args.metricColumn,
      args.granularity ?? 'monthly',
      'sum',
    );
    if (series.length < 4) {
      return {
        adequate: false,
        message: `Data tidak memadai untuk deteksi anomali (hanya ${series.length} titik, minimal 4).`,
      };
    }
    const values = series.map((p) => p.value);
    const result = this.anomalyEngine.analyze(values, args.method ?? 'zscore');
    return {
      adequate: true,
      method: result.method,
      bounds: result.bounds,
      anomalies: result.anomalies
        .map((a, i) => ({ ...a, period: series[i].period }))
        .filter((a) => a.isAnomaly),
      series,
    };
  }

  async runSql(ctx: DatasetContext, spec: QuerySpec) {
    const allowed = ctx.columns.map((c) => c.columnName);
    const compiled = this.textToSqlEngine.compile(spec, allowed, ctx.datasetId);
    return this.textToSqlEngine.execute(compiled);
  }

  toolDefinitions(): ToolDefinition[] {
    const granularity = {
      type: 'string',
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
      description: 'Granularitas periode (default monthly)',
    };
    return [
      {
        name: 'dataset_info',
        description:
          'Melihat struktur dataset: daftar kolom, tipe, jumlah baris, dan contoh 5 baris. Panggil ini terlebih dahulu jika belum tahu nama kolom yang tepat.',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'summary_kpi',
        description: 'Ringkasan angka: total, rata-rata, min, max, dan jumlah baris untuk satu kolom metrik numerik.',
        parameters: {
          type: 'object',
          properties: {
            metricColumn: { type: 'string', description: 'Kolom numerik yang dihitung' },
            dateColumn: { type: 'string', description: 'Kolom tanggal (opsional, untuk filter periode)' },
            startDate: { type: 'string', description: 'Tanggal mulai filter (YYYY-MM-DD, opsional)' },
            endDate: { type: 'string', description: 'Tanggal akhir filter (YYYY-MM-DD, opsional)' },
          },
          required: ['metricColumn'],
        },
      },
      {
        name: 'group_breakdown',
        description: 'Rincian nilai per kategori/kelompok, mis. total penjualan per produk, per cabang, per kategori, atau per pelanggan.',
        parameters: {
          type: 'object',
          properties: {
            groupColumn: { type: 'string' },
            metricColumn: { type: 'string' },
            dateColumn: { type: 'string' },
            agg: { type: 'string', enum: ['sum', 'avg', 'count'] },
            limit: { type: 'number', description: 'Jumlah item teratas (default 10, maks 50)' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
          },
          required: ['groupColumn', 'metricColumn'],
        },
      },
      {
        name: 'trend_series',
        description: 'Deret waktu nilai per periode untuk analisis tren.',
        parameters: {
          type: 'object',
          properties: {
            dateColumn: { type: 'string' },
            metricColumn: { type: 'string' },
            granularity,
            aggregation: { type: 'string', enum: ['sum', 'avg', 'count'] },
          },
          required: ['dateColumn', 'metricColumn'],
        },
      },
      {
        name: 'growth',
        description: 'Pertumbuhan periode terakhir dibanding periode sebelumnya.',
        parameters: {
          type: 'object',
          properties: {
            dateColumn: { type: 'string' },
            metricColumn: { type: 'string' },
            granularity,
          },
          required: ['dateColumn', 'metricColumn'],
        },
      },
      {
        name: 'forecast',
        description: 'Prediksi nilai periode mendatang berdasarkan data historis (minimal 8 titik periode).',
        parameters: {
          type: 'object',
          properties: {
            dateColumn: { type: 'string' },
            metricColumn: { type: 'string' },
            granularity,
            horizon: { type: 'number', description: 'Jumlah periode yang diprediksi (1-24, default 6)' },
          },
          required: ['dateColumn', 'metricColumn'],
        },
      },
      {
        name: 'customer_segmentation',
        description: 'Segmentasi pelanggan berbasis RFM + K-Means (minimal 10 pelanggan unik).',
        parameters: {
          type: 'object',
          properties: {
            customerColumn: { type: 'string' },
            dateColumn: { type: 'string' },
            revenueColumn: { type: 'string', description: 'Kolom nilai transaksi (opsional)' },
            segments: { type: 'number', description: 'Jumlah segmen (2-6, default 4)' },
          },
          required: ['customerColumn', 'dateColumn'],
        },
      },
      {
        name: 'anomaly_detection',
        description: 'Deteksi periode dengan nilai abnormal (z-score atau IQR, minimal 4 titik).',
        parameters: {
          type: 'object',
          properties: {
            dateColumn: { type: 'string' },
            metricColumn: { type: 'string' },
            granularity,
            method: { type: 'string', enum: ['zscore', 'iqr'] },
          },
          required: ['dateColumn', 'metricColumn'],
        },
      },
      {
        name: 'run_sql',
        description:
          'Query SELECT read-only ke data dataset untuk pertanyaan spesifik yang tidak tercakup tool lain. Bukan SQL mentah — berikan spesifikasi query.',
        parameters: {
          type: 'object',
          properties: {
            select: {
              type: 'array',
              description: 'Kolom yang dipilih',
              items: {
                type: 'object',
                properties: {
                  column: { type: 'string' },
                  agg: { type: 'string', enum: ['sum', 'avg', 'count', 'min', 'max'] },
                  alias: { type: 'string' },
                },
                required: ['column'],
              },
            },
            groupBy: { type: 'array', items: { type: 'string' }, description: 'Kolom GROUP BY' },
            where: {
              type: 'object',
              description: 'Filter tunggal',
              properties: {
                column: { type: 'string' },
                op: { type: 'string', enum: ['=', '!=', '>', '<', '>=', '<='] },
                value: { description: 'Nilai pembanding (string/number)' },
              },
              required: ['column', 'op', 'value'],
            },
            dateFrom: {
              type: 'object',
              properties: { column: { type: 'string' }, value: { type: 'string' } },
              required: ['column', 'value'],
            },
            dateTo: {
              type: 'object',
              properties: { column: { type: 'string' }, value: { type: 'string' } },
              required: ['column', 'value'],
            },
            orderBy: {
              type: 'object',
              properties: {
                column: { type: 'string' },
                dir: { type: 'string', enum: ['asc', 'desc'] },
              },
            },
            limit: { type: 'number', description: 'Maksimal 200 baris' },
          },
          required: ['select'],
        },
      },
    ];
  }
}
