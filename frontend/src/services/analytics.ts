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
  granularity: string;
  kpis: Kpi[];
  trend: TrendPoint[];
  growth: GrowthPoint[];
  items: GroupItem[];
  insights: string[];
  limitations: string[];
}

export type AnalyticsView = 'overview' | 'sales' | 'profit' | 'products' | 'branches';

export interface AnalyzePayload {
  datasetId: string;
  dateColumn: string;
  revenueColumn: string;
  costColumn?: string;
  groupColumn?: string;
  granularity?: string;
  startDate?: string;
  endDate?: string;
  topN?: number;
}

export function autoDetect(
  columns: Array<{ columnName: string; dataType: string }>,
): { date: string; revenue: string; cost: string; group: string } {
  const find = (patterns: RegExp[], numericOnly = false): string => {
    for (const p of patterns) {
      const hit = columns.find(
        (c) =>
          p.test(c.columnName) &&
          (!numericOnly || /^(numeric|decimal|float|double|integer|int|bigint)/i.test(c.dataType)),
      );
      if (hit) return hit.columnName;
    }
    return '';
  };
  return {
    date: find([/(transaction_?date|order_?date|date|tanggal|waktu)/i]),
    revenue: find([/(sales_?amount|revenue|omzet|penjualan|net_?amount|total_?amount|amount)/i], true),
    cost: find([/(cost|cogs|hpp|biaya|expense)/i], true),
    group:
      find([/(product|produk|item|sku)/i]) ||
      find([/(branch|cabang|store|toko|outlet|region|wilayah|kota)/i]),
  };
}
