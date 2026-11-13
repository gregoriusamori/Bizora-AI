import { describe, expect, it } from 'vitest';
import { AnomalyDetectionService } from './anomaly-detection.service.js';

describe('AnomalyDetectionService', () => {
  const service = new AnomalyDetectionService();

  const baseSeries = [10, 11, 10, 12, 11, 10, 50, 11, 10];

  it('z-score mendeteksi nilai yang jauh di atas rata-rata', () => {
    const result = service.detect(baseSeries, 2);
    const anomalies = result.filter((p) => p.isAnomaly);
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].index).toBe(6);
    expect(anomalies[0].value).toBe(50);
    expect(anomalies[0].direction).toBe('above');
  });

  it('z-score mendeteksi nilai di bawah rata-rata', () => {
    const result = service.detect([-50, 10, 11, 10, 12, 11, 10, 12, 11], 2);
    const anomalies = result.filter((p) => p.isAnomaly);
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].direction).toBe('below');
  });

  it('tidak menandai anomali pada data seragam', () => {
    const result = service.detect([10, 10, 10, 10], 2);
    expect(result.every((p) => !p.isAnomaly)).toBe(true);
  });

  it('IQR mendeteksi outlier dengan kuartil', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 100];
    const result = service.detectIQR(values, 1.5);
    const anomalies = result.filter((p) => p.isAnomaly);
    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    expect(anomalies.some((a) => a.value === 100)).toBe(true);
  });

  it('analyze mengembalikan struktur hasil yang lengkap', () => {
    const result = service.analyze(baseSeries, 'zscore');
    expect(result.method).toBe('zscore');
    expect(result.totalPoints).toBe(baseSeries.length);
    expect(result.anomalyCount).toBe(1);
    expect(result.bounds.mean).not.toBeNull();
    expect(result.bounds.stdDev).not.toBeNull();
    expect(result.bounds.lower).not.toBeNull();
    expect(result.bounds.upper).not.toBeNull();
  });

  it('menangani array kosong', () => {
    const result = service.analyze([], 'zscore');
    expect(result.totalPoints).toBe(0);
    expect(result.anomalyCount).toBe(0);
    expect(result.bounds.mean).toBeNull();
  });
});
