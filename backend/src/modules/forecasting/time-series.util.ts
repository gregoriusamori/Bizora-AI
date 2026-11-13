export type Granularity = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface TimeSeriesPoint {
  period: string;
  value: number;
}

function toISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function bucketKey(date: Date, granularity: Granularity): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  if (granularity === 'daily') {
    return toISODate(date);
  }
  if (granularity === 'weekly') {
    const day = date.getUTCDay();
    const diff = (day + 6) % 7;
    const monday = new Date(Date.UTC(y, m, date.getUTCDate() - diff));
    return toISODate(monday);
  }
  if (granularity === 'monthly') {
    return `${y}-${String(m + 1).padStart(2, '0')}`;
  }
  if (granularity === 'quarterly') {
    return `${y}-Q${Math.floor(m / 3) + 1}`;
  }
  return `${y}`;
}

function sortKey(key: string, granularity: Granularity): number {
  if (granularity === 'quarterly') {
    const [y, q] = key.split('-Q');
    return Number(y) * 4 + (Number(q) - 1);
  }
  if (granularity === 'yearly') {
    return Number(key);
  }
  const cleaned = key.replace(/-/g, '');
  const y = Number(cleaned.slice(0, 4));
  const rest = Number(cleaned.slice(4) || '0');
  return y * 10000 + rest;
}

export function buildTimeSeries(
  rows: Array<Record<string, unknown>>,
  dateColumn: string,
  metricColumn: string,
  granularity: Granularity = 'monthly',
  aggregation: 'sum' | 'avg' | 'count' = 'sum',
): TimeSeriesPoint[] {
  const buckets = new Map<string, { sum: number; count: number }>();

  for (const row of rows) {
    const rawDate = row[dateColumn];
    if (rawDate === null || rawDate === undefined) {
      continue;
    }
    const date = rawDate instanceof Date ? rawDate : new Date(String(rawDate));
    if (Number.isNaN(date.getTime())) {
      continue;
    }
    const rawValue = row[metricColumn];
    const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    if (!Number.isFinite(value)) {
      continue;
    }
    const key = bucketKey(date, granularity);
    const bucket = buckets.get(key) ?? { sum: 0, count: 0 };
    bucket.sum += value;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .sort((a, b) => sortKey(a[0], granularity) - sortKey(b[0], granularity))
    .map(([period, bucket]) => {
      let value: number;
      if (aggregation === 'count') {
        value = bucket.count;
      } else if (aggregation === 'avg') {
        value = bucket.count > 0 ? bucket.sum / bucket.count : 0;
      } else {
        value = bucket.sum;
      }
      return { period, value: Math.round(value * 1e6) / 1e6 };
    });
}
