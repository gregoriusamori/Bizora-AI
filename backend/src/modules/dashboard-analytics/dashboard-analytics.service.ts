import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { buildTimeSeries, type Granularity } from '../forecasting/time-series.util.js';
import type { AnalyzeDto } from './dto/analyze.dto.js';
import * as PrismaGenerated from '../../../generated/prisma/client.js';

export interface Kpi {
  label: string;
  value: string;
}

export interface TrendPoint {
  period: string;
  revenue: number;
  cost: number | null;
  profit: number | null;
}

export interface GrowthPoint {
  period: string;
  revenue: number;
  growthPercent: number | null;
}

export interface GroupItem {
  label: string;
  revenue: number;
  sharePercent: number;
  profit: number | null;
}

export interface AnalysisResult {
  datasetName: string;
  rowCount: number;
  dataRange: string;
  granularity: Granularity;
  kpis: Kpi[];
  trend: TrendPoint[];
  growth: GrowthPoint[];
  items: GroupItem[];
  insights: string[];
  limitations: string[];
}

type Row = Record<string, unknown>;

const MAX_ROWS = 50000;

function toNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmt(value: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(
    Math.round(value * 100) / 100,
  );
}

function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

@Injectable()
export class DashboardAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(dto: AnalyzeDto): Promise<AnalysisResult> {
    const { rows, dataset, columnNames } = await this.load(dto);
    this.assertColumns(dto, columnNames);

    const granularity = dto.granularity ?? 'monthly';
    const revenueSeries = buildTimeSeries(rows, dto.dateColumn, dto.revenueColumn, granularity, 'sum');

    let costSeries: Array<{ period: string; value: number }> = [];
    if (dto.costColumn) {
      costSeries = buildTimeSeries(rows, dto.dateColumn, dto.costColumn, granularity, 'sum');
    }

    const totalRevenue = revenueSeries.reduce((a, b) => a + b.value, 0);
    const transactionCount = rows.filter(
      (r) => toNumber(r[dto.revenueColumn]) !== null,
    ).length;
    const avgTransaction = transactionCount > 0 ? totalRevenue / transactionCount : 0;

    const trend: TrendPoint[] = revenueSeries.map((p) => ({
      period: p.period,
      revenue: p.value,
      cost: costSeries.find((c) => c.period === p.period)?.value ?? null,
      profit:
        dto.costColumn
          ? p.value - (costSeries.find((c) => c.period === p.period)?.value ?? 0)
          : null,
    }));

    const growth = this.buildGrowth(revenueSeries);

    const kpis: Kpi[] = [
      { label: 'Total Revenue', value: fmt(totalRevenue) },
      { label: 'Jumlah Transaksi', value: fmt(transactionCount) },
      { label: 'Rata-rata Nilai Transaksi', value: fmt(avgTransaction) },
    ];

    const { totalProfit, margin } = this.profitSummary(rows, dto);
    if (totalProfit !== null && margin !== null) {
      kpis.push(
        { label: 'Total Profit', value: fmt(totalProfit) },
        { label: 'Profit Margin', value: `${fmt(margin)}%` },
      );
    }

    const last = growth[growth.length - 1];
    if (last?.growthPercent !== undefined && last.growthPercent !== null) {
      kpis.push({
        label: `Pertumbuhan periode terakhir (${last.period})`,
        value: `${last.growthPercent > 0 ? '+' : ''}${fmt(last.growthPercent)}%`,
      });
    }

    return this.buildResult(dataset, rows.length, granularity, kpis, trend, growth, [], rows, dto);
  }

  async sales(dto: AnalyzeDto): Promise<AnalysisResult> {
    const result = await this.overview(dto);
    const insights = this.salesInsights(result, dto);
    return { ...result, insights };
  }

  async profit(dto: AnalyzeDto): Promise<AnalysisResult> {
    if (!dto.costColumn) {
      throw new BadRequestException(
        'Analisis profit memerlukan kolom biaya (costColumn). Pilih kolom biaya pada dataset Anda.',
      );
    }
    const { rows, dataset, columnNames } = await this.load(dto);
    this.assertColumns(dto, columnNames);

    const granularity = dto.granularity ?? 'monthly';
    const revenueSeries = buildTimeSeries(rows, dto.dateColumn, dto.revenueColumn, granularity, 'sum');
    const costSeries = buildTimeSeries(rows, dto.dateColumn, dto.costColumn, granularity, 'sum');

    const trend: TrendPoint[] = revenueSeries.map((p) => {
      const cost = costSeries.find((c) => c.period === p.period)?.value ?? 0;
      return { period: p.period, revenue: p.value, cost, profit: p.value - cost };
    });

    const totalRevenue = revenueSeries.reduce((a, b) => a + b.value, 0);
    const totalCost = costSeries.reduce((a, b) => a + b.value, 0);
    const totalProfit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null;

    const kpis: Kpi[] = [
      { label: 'Total Revenue', value: fmt(totalRevenue) },
      { label: 'Total Cost', value: fmt(totalCost) },
      { label: 'Total Profit', value: fmt(totalProfit) },
      ...(margin !== null ? [{ label: 'Profit Margin', value: `${fmt(margin)}%` }] : []),
    ];

    const profitability = trend
      .filter((p) => p.revenue > 0)
      .map((p) => ({ period: p.period, margin: (p.profit ?? 0) / p.revenue }))
      .sort((a, b) => b.margin - a.margin);

    const insights: string[] = [
      `Fakta: total profit ${fmt(totalProfit)} dengan margin ${margin !== null ? `${fmt(margin)}%` : 'tidak terdefinisi'} dari data aktual.`,
    ];
    if (profitability.length > 0) {
      const best = profitability[0];
      const worst = profitability[profitability.length - 1];
      insights.push(
        `Fakta: periode dengan margin tertinggi adalah ${best.period} (${fmt(best.margin * 100)}%), terendah ${worst.period} (${fmt(worst.margin * 100)}%).`,
      );
      if (worst.margin < 0) {
        insights.push(
          `Fakta: periode ${worst.period} mencatat biaya melebihi revenue (margin negatif).`,
        );
      }
    }
    insights.push(
      `Saran: ${margin !== null && margin < 10 ? 'margin tergolong rendah — tinjau struktur biaya atau strategi harga.' : 'pertahankan efisiensi biaya yang telah dicapai.'}`,
    );

    const limitations = [
      'Profit dihitung sebagai revenue dikurangi biaya dari kolom yang Anda tentukan.',
      'Kolom biaya yang tidak terisi pada sebagian baris akan diabaikan dalam perhitungan.',
    ];

    return this.buildResult(dataset, rows.length, granularity, kpis, trend, this.buildGrowth(revenueSeries), [], rows, dto, insights, limitations);
  }

  async productOrBranch(dto: AnalyzeDto, kind: 'product' | 'branch'): Promise<AnalysisResult> {
    if (!dto.groupColumn) {
      throw new BadRequestException(
        `Analisis ${kind === 'product' ? 'produk' : 'cabang'} memerlukan kolom kelompok (groupColumn).`,
      );
    }
    const { rows, dataset, columnNames } = await this.load(dto);
    this.assertColumns(dto, columnNames);

    const granularity = dto.granularity ?? 'monthly';
    const topN = dto.topN ?? 10;
    const map = new Map<string, { revenue: number; cost: number; hasCost: boolean; count: number }>();
    for (const row of rows) {
      const rawLabel = row[dto.groupColumn];
      if (rawLabel === null || rawLabel === undefined || String(rawLabel).trim() === '') continue;
      const revenue = toNumber(row[dto.revenueColumn]);
      if (revenue === null) continue;
      const label = String(rawLabel).trim();
      const entry = map.get(label) ?? { revenue: 0, cost: 0, hasCost: Boolean(dto.costColumn), count: 0 };
      entry.revenue += revenue;
      entry.count += 1;
      if (dto.costColumn) {
        const cost = toNumber(row[dto.costColumn]);
        if (cost !== null) entry.cost += cost;
      }
      map.set(label, entry);
    }

    if (map.size === 0) {
      throw new UnprocessableEntityException(
        `Tidak ada data valid untuk kolom "${dto.groupColumn}" dan "${dto.revenueColumn}". Periksa pemetaan kolom.`,
      );
    }

    const totalRevenue = Array.from(map.values()).reduce((a, b) => a + b.revenue, 0);
    const sorted = Array.from(map.entries())
      .map(([label, e]) => ({
        label,
        revenue: e.revenue,
        count: e.count,
        profit: dto.costColumn && e.hasCost ? e.revenue - e.cost : null,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const top = sorted.slice(0, topN).map((item) => ({
      label: item.label,
      revenue: item.revenue,
      sharePercent: totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0,
      profit: item.profit,
    }));

    const trend = buildTimeSeries(rows, dto.dateColumn, dto.revenueColumn, granularity, 'sum').map(
      (p) => ({ period: p.period, revenue: p.value, cost: null, profit: null }),
    );

    const kpis: Kpi[] = [
      { label: kind === 'product' ? 'Jumlah Produk' : 'Jumlah Cabang', value: fmt(map.size) },
      { label: 'Total Revenue', value: fmt(totalRevenue) },
      {
        label: kind === 'product' ? 'Produk Teratas' : 'Cabang Teratas',
        value: top.length > 0 ? top[0].label : '-',
      },
    ];
    if (top.length > 0) {
      kpis.push({
        label: 'Kontribusi Teratas',
        value: `${fmt(top[0].sharePercent)}%`,
      });
    }

    const kindLabel = kind === 'product' ? 'produk' : 'cabang';
    const insights: string[] = [
      `Fakta: "${top[0].label}" adalah ${kindLabel} dengan revenue terbesar ${fmt(top[0].revenue)} (${fmt(top[0].sharePercent)}% dari total).`,
    ];
    if (top.length >= 3) {
      const top3Share = top.slice(0, 3).reduce((a, b) => a + b.sharePercent, 0);
      insights.push(
        `Fakta: 3 ${kindLabel} teratas menyumbang ${fmt(top3Share)}% dari total revenue.`,
      );
    }
    const tail = top[top.length - 1];
    if (tail && top.length > 1 && tail.revenue < top[0].revenue * 0.2) {
      insights.push(
        `Fakta: "${tail.label}" berkontribusi jauh di bawah ${kindLabel} teratas (${fmt(tail.sharePercent)}%).`,
      );
    }
    insights.push(
      `Saran: fokuskan stok dan promosi pada ${kindLabel} dengan kontribusi terbesar, dan evaluasi ${kindLabel} dengan kontribusi sangat rendah.`,
    );

    const limitations = [
      `Peringkat dihitung dari data aktual; menampilkan ${top.length} dari ${map.size} ${kindLabel}.`,
    ];
    if (!dto.costColumn) {
      limitations.push('Kolom biaya tidak ditentukan sehingga profit per kelompok tidak dihitung.');
    }

    return this.buildResult(
      dataset,
      rows.length,
      granularity,
      kpis,
      trend,
      this.buildGrowth(buildTimeSeries(rows, dto.dateColumn, dto.revenueColumn, granularity, 'sum')),
      top,
      rows,
      dto,
      insights,
      limitations,
    );
  }

  private async load(dto: AnalyzeDto): Promise<{
    rows: Row[];
    dataset: PrismaGenerated.Dataset;
    columnNames: string[];
  }> {
    const dataset = await this.prisma.dataset.findUnique({
      where: { id: dto.datasetId },
      include: { columns: true },
    });
    if (!dataset) {
      throw new NotFoundException('Dataset tidak ditemukan.');
    }
    const columnNames = dataset.columns.map((c) => c.columnName);
    const data = await this.prisma.datasetData.findMany({
      where: { datasetId: dataset.id },
      take: MAX_ROWS,
    });
    let rows = data.map((d) => (d.rowData ?? {}) as Row);
    if (dto.startDate || dto.endDate) {
      rows = rows.filter((row) => {
        const date = parseDate(row[dto.dateColumn]);
        if (!date) return false;
        if (dto.startDate && date < new Date(dto.startDate)) return false;
        if (dto.endDate && date > new Date(dto.endDate)) return false;
        return true;
      });
    }
    if (rows.length === 0) {
      throw new UnprocessableEntityException(
        'Tidak ada baris data pada rentang yang dipilih. Periksa filter periode atau data dataset.',
      );
    }
    return { rows, dataset, columnNames };
  }

  private assertColumns(dto: AnalyzeDto, available: string[]): void {
    const missing = [dto.dateColumn, dto.revenueColumn, dto.costColumn, dto.groupColumn]
      .filter((c): c is string => Boolean(c))
      .filter((c) => !available.includes(c));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Kolom tidak ditemukan: ${missing.join(', ')}. Kolom tersedia: ${available.join(', ')}.`,
      );
    }
  }

  private profitSummary(
    rows: Row[],
    dto: AnalyzeDto,
  ): { totalProfit: number | null; margin: number | null } {
    if (!dto.costColumn) return { totalProfit: null, margin: null };
    let revenue = 0;
    let cost = 0;
    let hasCost = false;
    for (const row of rows) {
      const r = toNumber(row[dto.revenueColumn]);
      if (r !== null) revenue += r;
      const c = toNumber(row[dto.costColumn]);
      if (c !== null) {
        cost += c;
        hasCost = true;
      }
    }
    if (!hasCost) return { totalProfit: null, margin: null };
    const totalProfit = revenue - cost;
    const margin = revenue > 0 ? (totalProfit / revenue) * 100 : null;
    return { totalProfit, margin };
  }

  private buildGrowth(series: Array<{ period: string; value: number }>): GrowthPoint[] {
    return series.map((p, i) => {
      if (i === 0) return { period: p.period, revenue: p.value, growthPercent: null };
      const prev = series[i - 1].value;
      return {
        period: p.period,
        revenue: p.value,
        growthPercent: prev !== 0 ? ((p.value - prev) / prev) * 100 : null,
      };
    });
  }

  private salesInsights(result: AnalysisResult, dto: AnalyzeDto): string[] {
    const insights: string[] = [];
    const totalRevenue = result.trend.reduce((a, b) => a + b.revenue, 0);
    insights.push(
      `Fakta: total revenue seluruh periode sebesar ${fmt(totalRevenue)} dari data aktual.`,
    );
    const last = result.growth[result.growth.length - 1];
    const prev = result.growth[result.growth.length - 2];
    if (last && prev && last.growthPercent !== null) {
      const direction = last.growthPercent > 0 ? 'naik' : last.growthPercent < 0 ? 'turun' : 'stabil';
      insights.push(
        `Fakta: revenue periode ${last.period} ${direction} ${fmt(Math.abs(last.growthPercent))}% dibanding ${prev.period}.`,
      );
    }
    if (result.trend.length > 0) {
      const peak = result.trend.reduce((max, p) => (p.revenue > max.revenue ? p : max), result.trend[0]);
      insights.push(
        `Fakta: periode dengan revenue tertinggi adalah ${peak.period} (${fmt(peak.revenue)}).`,
      );
      const low = result.trend.reduce((min, p) => (p.revenue < min.revenue ? p : min), result.trend[0]);
      if (low.period !== peak.period) {
        insights.push(
          `Fakta: periode dengan revenue terendah adalah ${low.period} (${fmt(low.revenue)}).`,
        );
      }
    }
    const rising = result.growth.filter((g) => g.growthPercent !== null && g.growthPercent > 0).length;
    const falling = result.growth.filter((g) => g.growthPercent !== null && g.growthPercent < 0).length;
    if (rising + falling > 0) {
      insights.push(
        `Fakta: ${rising} periode mengalami kenaikan dan ${falling} periode penurunan dibanding periode sebelumnya.`,
      );
    }
    insights.push(
      `Saran: gunakan pola musiman ini sebagai acuan perencanaan — periode puncak dapat dijadikan target promosi utama${
        dto.groupColumn ? ', lalu lanjutkan analisis per kelompok produk/cabang' : ''
      }.`,
    );
    return insights;
  }

  private buildResult(
    dataset: PrismaGenerated.Dataset,
    rowCount: number,
    granularity: Granularity,
    kpis: Kpi[],
    trend: TrendPoint[],
    growth: GrowthPoint[],
    items: GroupItem[],
    rows: Row[],
    dto: AnalyzeDto,
    insights?: string[],
    limitations?: string[],
  ): AnalysisResult {
    let min: Date | null = null;
    let max: Date | null = null;
    for (const row of rows) {
      const date = parseDate(row[dto.dateColumn]);
      if (!date) continue;
      if (!min || date < min) min = date;
      if (!max || date > max) max = date;
    }
    return {
      datasetName: dataset.name,
      rowCount,
      dataRange:
        min && max
          ? `${min.toISOString().slice(0, 10)} s/d ${max.toISOString().slice(0, 10)}`
          : '-',
      granularity,
      kpis,
      trend,
      growth,
      items,
      insights: insights ?? [],
      limitations:
        limitations ?? [
          'Hasil dihitung langsung dari data aktual dataset yang dipilih.',
          'Periode terakhir dapat berupa data parsial (belum lengkap).',
        ],
    };
  }
}
