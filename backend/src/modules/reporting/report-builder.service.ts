import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { buildTimeSeries, Granularity } from '../forecasting/time-series.util.js';
import { ReportType } from './dto/generate-report.dto.js';

export interface ReportKpi {
  label: string;
  value: string;
}

export interface ReportData {
  title: string;
  reportType: string;
  period: string;
  generatedAt: string;
  datasetName: string;
  dataRange: string;
  kpis: ReportKpi[];
  table: { columns: string[]; rows: Array<Array<string | number>> };
  insights: string[];
  recommendations: string[];
  limitations: string[];
}

const REPORT_TITLES: Record<ReportType, string> = {
  sales_report: 'Sales Report',
  profit_report: 'Profit Report',
  product_performance_report: 'Product Performance Report',
  branch_performance_report: 'Branch Performance Report',
  customer_analysis_report: 'Customer Analysis Report',
  monthly_business_report: 'Monthly Business Report',
  executive_summary: 'Executive Summary',
};

function toNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmt(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
  }).format(Math.round(value * 100) / 100);
}

@Injectable()
export class ReportBuilderService {
  buildReport(
    reportType: ReportType,
    rows: Array<Record<string, unknown>>,
    datasetName: string,
    dateColumn: string,
    metricColumn: string,
    granularity: Granularity = 'monthly',
    costColumn?: string,
    groupColumn?: string,
    startDate?: string,
    endDate?: string,
    title?: string,
  ): ReportData {
    const filtered = rows.filter((row) => {
      if (!startDate && !endDate) {
        return true;
      }
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

    const revenues = filtered.map((row) => toNumber(row[metricColumn]));
    const validRevenue = revenues.filter((v): v is number => v !== null);

    if (validRevenue.length === 0) {
      throw new UnprocessableEntityException(
        `Tidak ada nilai numerik valid pada kolom "${metricColumn}". Periksa pemetaan kolom dataset.`,
      );
    }

    const totalRevenue = validRevenue.reduce((a, b) => a + b, 0);
    const transactionCount = validRevenue.length;
    const avgTransaction = totalRevenue / transactionCount;

    let totalCost: number | null = null;
    let totalProfit: number | null = null;
    let margin: number | null = null;
    if (costColumn) {
      const costs = filtered
        .map((row) => toNumber(row[costColumn]))
        .filter((v): v is number => v !== null);
      if (costs.length > 0) {
        totalCost = costs.reduce((a, b) => a + b, 0);
        totalProfit = totalRevenue - totalCost;
        margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null;
      }
    }

    const series = buildTimeSeries(
      filtered,
      dateColumn,
      metricColumn,
      granularity,
      'sum',
    );

    let growth: number | null = null;
    let currentPeriod = '';
    let previousPeriod = '';
    let previousValue: number | null = null;
    let currentValue: number | null = null;
    if (series.length >= 2) {
      currentValue = series[series.length - 1].value;
      previousValue = series[series.length - 2].value;
      currentPeriod = series[series.length - 1].period;
      previousPeriod = series[series.length - 2].period;
      if (previousValue !== 0) {
        growth = ((currentValue - previousValue) / previousValue) * 100;
      }
    }

    let grouped: Array<{ label: string; revenue: number; profit: number | null }> = [];
    if (groupColumn) {
      const map = new Map<string, { revenue: number; cost: number; hasCost: boolean }>();
      for (const row of filtered) {
        const rawLabel = row[groupColumn];
        if (rawLabel === null || rawLabel === undefined || String(rawLabel).trim() === '') {
          continue;
        }
        const label = String(rawLabel);
        const revenue = toNumber(row[metricColumn]);
        if (revenue === null) {
          continue;
        }
        const entry = map.get(label) ?? { revenue: 0, cost: 0, hasCost: Boolean(costColumn) };
        entry.revenue += revenue;
        if (costColumn) {
          const cost = toNumber(row[costColumn]);
          if (cost !== null) {
            entry.cost += cost;
          }
        }
        map.set(label, entry);
      }
      grouped = Array.from(map.entries())
        .map(([label, e]) => ({
          label,
          revenue: e.revenue,
          profit: costColumn && e.hasCost ? e.revenue - e.cost : null,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
    }

    const periodLabel = this.describePeriod(startDate, endDate, series);
    const dataRange = this.describeDataRange(filtered, dateColumn);

    const kpis: ReportKpi[] = [
      { label: 'Total Revenue', value: fmt(totalRevenue) },
      { label: 'Jumlah Transaksi', value: fmt(transactionCount) },
      { label: 'Rata-rata Nilai Transaksi', value: fmt(avgTransaction) },
    ];
    if (totalProfit !== null && margin !== null) {
      kpis.push(
        { label: 'Total Cost', value: fmt(totalCost ?? 0) },
        { label: 'Total Profit', value: fmt(totalProfit) },
        { label: 'Profit Margin', value: `${fmt(margin)}%` },
      );
    }
    if (growth !== null) {
      kpis.push({
        label: `Pertumbuhan (${previousPeriod} → ${currentPeriod})`,
        value: `${growth > 0 ? '+' : ''}${fmt(growth)}%`,
      });
    }

    const { columns, rows: tableRows } = this.buildTable(
      reportType,
      series,
      grouped,
      granularity,
    );

    const insights = this.buildInsights(
      reportType,
      totalRevenue,
      totalProfit,
      margin,
      growth,
      currentPeriod,
      previousPeriod,
      series,
      grouped,
      groupColumn,
    );
    const recommendations = this.buildRecommendations(
      totalProfit,
      margin,
      growth,
      grouped,
      groupColumn,
    );

    const limitations: string[] = [
      'Laporan dihitung dari data aktual dataset yang dipilih.',
      'Periode terakhir pada data berkelanjutan dapat belum lengkap (data parsial).',
    ];
    if (!costColumn) {
      limitations.push(
        'Kolom biaya tidak ditentukan, sehingga laporan profit tidak dihitung untuk dataset ini.',
      );
    }

    return {
      title: title ?? REPORT_TITLES[reportType],
      reportType,
      period: periodLabel,
      generatedAt: new Date().toISOString(),
      datasetName,
      dataRange,
      kpis,
      table: { columns, rows: tableRows },
      insights,
      recommendations,
      limitations,
    };
  }

  private describePeriod(startDate?: string, endDate?: string, series: Array<{ period: string }> = []): string {
    if (startDate || endDate) {
      const from = startDate ? new Date(startDate).toISOString().slice(0, 10) : 'awal data';
      const to = endDate ? new Date(endDate).toISOString().slice(0, 10) : 'akhir data';
      return `${from} s/d ${to}`;
    }
    if (series.length > 0) {
      return `${series[0].period} s/d ${series[series.length - 1].period}`;
    }
    return 'Seluruh data';
  }

  private describeDataRange(
    rows: Array<Record<string, unknown>>,
    dateColumn: string,
  ): string {
    let min: Date | null = null;
    let max: Date | null = null;
    for (const row of rows) {
      const raw = row[dateColumn];
      if (raw === null || raw === undefined) {
        continue;
      }
      const date = raw instanceof Date ? raw : new Date(String(raw));
      if (Number.isNaN(date.getTime())) {
        continue;
      }
      if (!min || date < min) {
        min = date;
      }
      if (!max || date > max) {
        max = date;
      }
    }
    if (!min || !max) {
      return '-';
    }
    return `${min.toISOString().slice(0, 10)} s/d ${max.toISOString().slice(0, 10)}`;
  }

  private buildTable(
    reportType: ReportType,
    series: Array<{ period: string; value: number }>,
    grouped: Array<{ label: string; revenue: number; profit: number | null }>,
    granularity: Granularity,
  ): { columns: string[]; rows: Array<Array<string | number>> } {
    const granularityLabel: Record<Granularity, string> = {
      daily: 'Harian',
      weekly: 'Mingguan',
      monthly: 'Bulanan',
      quarterly: 'Triwulanan',
      yearly: 'Tahunan',
    };

    if (
      reportType === 'product_performance_report' ||
      reportType === 'branch_performance_report' ||
      reportType === 'customer_analysis_report'
    ) {
      if (grouped.length > 0) {
        const columns = ['Kategori', 'Revenue'];
        const rows: Array<Array<string | number>> = grouped.map((g) => [g.label, g.revenue]);
        return { columns, rows };
      }
    }

    if (reportType === 'executive_summary' && grouped.length > 0) {
      const columns = ['Kategori', 'Revenue'];
      const rows: Array<Array<string | number>> = grouped.map((g) => [g.label, g.revenue]);
      return { columns, rows };
    }

    const columns = [`Periode (${granularityLabel[granularity]})`, 'Revenue'];
    const rows: Array<Array<string | number>> = series.map((p) => [p.period, p.value]);
    return { columns, rows };
  }

  private buildInsights(
    reportType: ReportType,
    totalRevenue: number,
    totalProfit: number | null,
    margin: number | null,
    growth: number | null,
    currentPeriod: string,
    previousPeriod: string,
    series: Array<{ period: string; value: number }>,
    grouped: Array<{ label: string; revenue: number; profit: number | null }>,
    groupColumn: string | undefined,
  ): string[] {
    const insights: string[] = [];

    insights.push(
      `Fakta: total revenue pada periode laporan sebesar ${fmt(totalRevenue)} dari data aktual.`,
    );

    if (totalProfit !== null && margin !== null) {
      insights.push(
        `Fakta: total profit ${fmt(totalProfit)} dengan profit margin ${fmt(margin)}%.`,
      );
    }

    if (growth !== null) {
      const direction = growth > 0 ? 'naik' : growth < 0 ? 'turun' : 'stabil';
      insights.push(
        `Fakta: revenue periode ${currentPeriod} ${direction} ${fmt(Math.abs(growth))}% dibanding ${previousPeriod}.`,
      );
    }

    const peak = series.reduce((max, p) => (p.value > max.value ? p : max), series[0]);
    if (peak) {
      insights.push(`Fakta: periode dengan revenue tertinggi adalah ${peak.period} (${fmt(peak.value)}).`);
    }

    if (groupColumn && grouped.length > 0) {
      const top = grouped[0];
      insights.push(
        `Fakta: "${top.label}" merupakan kontributor revenue terbesar dengan ${fmt(top.revenue)} (${fmt((top.revenue / totalRevenue) * 100)}% dari total).`,
      );
    }

    if (reportType === 'executive_summary' && series.length >= 6) {
      const half = Math.floor(series.length / 2);
      const firstHalf = series.slice(0, half).reduce((a, b) => a + b.value, 0);
      const secondHalf = series.slice(half).reduce((a, b) => a + b.value, 0);
      if (firstHalf > 0) {
        const change = ((secondHalf - firstHalf) / firstHalf) * 100;
        insights.push(
          `Fakta: paruh kedua periode ${change >= 0 ? 'lebih tinggi' : 'lebih rendah'} ${fmt(Math.abs(change))}% dibanding paruh pertama.`,
        );
      }
    }

    return insights;
  }

  private buildRecommendations(
    totalProfit: number | null,
    margin: number | null,
    growth: number | null,
    grouped: Array<{ label: string; revenue: number; profit: number | null }>,
    groupColumn: string | undefined,
  ): string[] {
    const recommendations: string[] = [];

    if (growth !== null && growth < -10) {
      recommendations.push(
        `Saran (bukan kesimpulan sebab-akibat): penurunan ${fmt(Math.abs(growth))}% terdeteksi — evaluasi faktor eksternal dan internal pada periode terakhir sebelum mengambil tindakan.`,
      );
    }

    if (margin !== null && margin < 10) {
      recommendations.push(
        'Saran: profit margin tergolong rendah berdasarkan data — tinjau struktur biaya atau strategi harga.',
      );
    }

    if (groupColumn && grouped.length >= 2) {
      const top = grouped[0];
      const last = grouped[grouped.length - 1];
      recommendations.push(
        `Saran: pertahankan dan kembangkan performa "${top.label}" yang paling berkontribusi pada revenue.`,
      );
      if (last.revenue < top.revenue * 0.2) {
        recommendations.push(
          `Saran: evaluasi "${last.label}" yang berkontribusi jauh di bawah kontributor utama.`,
        );
      }
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'Saran: gunakan filter periode dan kolom kelompok yang lebih spesifik untuk menghasilkan rekomendasi yang lebih terarah.',
      );
    }

    if (totalProfit === null) {
      recommendations.push(
        'Saran: tambahkan kolom biaya (harga pokok) pada konfigurasi laporan agar analisis profit dapat dihitung.',
      );
    }

    return recommendations;
  }
}
