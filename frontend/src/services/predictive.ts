export interface DatasetColumn {
  id: string;
  columnName: string;
  dataType: string;
}

export interface Dataset {
  id: string;
  name: string;
  sourceType: string;
  columns: DatasetColumn[];
}

export interface ForecastPoint {
  period: string;
  value: number;
  lower: number;
  upper: number;
  isForecast: boolean;
}

export interface ForecastResult {
  adequate: boolean;
  message?: string;
  method: string;
  dataPoints: number;
  history: Array<{ period: string; value: number }>;
  forecast: ForecastPoint[];
  metrics: { rmse: number | null; mape: number | null };
  limitations: string[];
}

export interface SegmentationResult {
  adequate: boolean;
  message?: string;
  totalCustomers: number;
  segments: Array<{
    label: string;
    customers: number;
    sharePercent: number;
    avgRecencyDays: number;
    avgFrequency: number;
    avgMonetary: number;
  }>;
  customers: Array<{
    customer: string;
    recencyDays: number;
    frequency: number;
    monetary: number;
    segment: string;
  }>;
}

export interface AnomalyResult {
  adequate: boolean;
  message?: string;
  method: string;
  series: Array<{ period: string; value: number }>;
  totalPoints: number;
  anomalyCount: number;
  anomalies: Array<{
    index: number;
    period: string;
    value: number;
    isAnomaly: boolean;
    direction: 'above' | 'below' | null;
    severity: string;
  }>;
  bounds: {
    lower: number | null;
    upper: number | null;
  };
}

export interface ReportMeta {
  id: string;
  title: string;
  reportType: string;
  format: string;
  datasetId: string;
  datasetName: string;
  period: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}
