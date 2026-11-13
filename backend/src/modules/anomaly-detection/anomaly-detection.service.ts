import { Injectable } from '@nestjs/common';

export interface AnomalyPoint {
  index: number;
  value: number;
  isAnomaly: boolean;
  direction: 'above' | 'below' | null;
  zScore: number | null;
  severity: 'low' | 'medium' | 'high';
}

export interface AnomalyDetectionResult {
  method: 'zscore' | 'iqr';
  totalPoints: number;
  anomalyCount: number;
  anomalies: AnomalyPoint[];
  bounds: {
    mean: number | null;
    stdDev: number | null;
    lower: number | null;
    upper: number | null;
    q1: number | null;
    q3: number | null;
    iqrLower: number | null;
    iqrUpper: number | null;
  };
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

@Injectable()
export class AnomalyDetectionService {
  detect(values: number[], thresholdMultiplier = 2): AnomalyPoint[] {
    const n = values.length;
    if (n === 0) {
      return [];
    }
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance =
      n > 1
        ? values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1)
        : 0;
    const stdDev = Math.sqrt(variance);
    const threshold = Math.max(thresholdMultiplier, 1);

    return values.map((value, index) => {
      const z = stdDev === 0 ? 0 : (value - mean) / stdDev;
      const isAnomaly = Math.abs(z) >= threshold;
      return {
        index,
        value,
        isAnomaly,
        direction: isAnomaly ? (z > 0 ? 'above' : 'below') : null,
        zScore: round(z),
        severity: isAnomaly
          ? Math.abs(z) >= threshold * 1.5
            ? 'high'
            : 'medium'
          : 'low',
      };
    });
  }

  detectIQR(values: number[], multiplier = 1.5): AnomalyPoint[] {
    if (values.length === 0) {
      return [];
    }
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = this.quantile(sorted, 0.25);
    const q3 = this.quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const lower = q1 - multiplier * iqr;
    const upper = q3 + multiplier * iqr;

    return values.map((value, index) => {
      const isAnomaly = value < lower || value > upper;
      const zRange = upper - lower || 1;
      const direction = isAnomaly ? (value > upper ? 'above' : 'below') : null;
      const distance = isAnomaly
        ? value > upper
          ? value - upper
          : lower - value
        : 0;
      return {
        index,
        value,
        isAnomaly,
        direction,
        zScore: null,
        severity: isAnomaly ? (distance / zRange > 0.5 ? 'high' : 'medium') : 'low',
      };
    });
  }

  analyze(values: number[], method: 'zscore' | 'iqr' = 'zscore'): AnomalyDetectionResult {
    const points =
      method === 'iqr' ? this.detectIQR(values) : this.detect(values);

    const sorted = [...values].sort((a, b) => a - b);
    const n = values.length;
    const mean = n ? values.reduce((a, b) => a + b, 0) / n : null;
    const variance = n > 1 ? values.reduce((acc, v) => acc + (v - mean!) ** 2, 0) / (n - 1) : 0;
    const stdDev = n ? Math.sqrt(variance) : null;
    const threshold = 2;
    const q1 = n ? this.quantile(sorted, 0.25) : null;
    const q3 = n ? this.quantile(sorted, 0.75) : null;

    return {
      method,
      totalPoints: n,
      anomalyCount: points.filter((p) => p.isAnomaly).length,
      anomalies: points,
      bounds: {
        mean: mean === null ? null : round(mean),
        stdDev: stdDev === null ? null : round(stdDev),
        lower: stdDev !== null && mean !== null ? round(mean - threshold * stdDev) : null,
        upper: stdDev !== null && mean !== null ? round(mean + threshold * stdDev) : null,
        q1: q1 === null ? null : round(q1),
        q3: q3 === null ? null : round(q3),
        iqrLower: q1 !== null && q3 !== null ? round(q1 - 1.5 * (q3 - q1)) : null,
        iqrUpper: q1 !== null && q3 !== null ? round(q3 + 1.5 * (q3 - q1)) : null,
      },
    };
  }

  private quantile(sorted: number[], q: number): number {
    const n = sorted.length;
    if (n === 0) {
      return 0;
    }
    const pos = (n - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (base + 1 < n) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    }
    return sorted[base];
  }
}
