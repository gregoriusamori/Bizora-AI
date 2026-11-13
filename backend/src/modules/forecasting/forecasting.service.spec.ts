import { describe, expect, it } from 'vitest';
import { ForecastingService } from './forecasting.service.js';
import { buildTimeSeries } from './time-series.util.js';

const prismaStub = {} as never;

describe('ForecastingService', () => {
  const service = new ForecastingService(prismaStub);

  it('menghitung moving average dengan benar', () => {
    const result = service.movingAverage([10, 20, 30], 2);
    expect(result).toEqual([10, 15, 25]);
  });

  it('menangani array kosong pada moving average', () => {
    expect(service.movingAverage([], 3)).toEqual([]);
  });

  it('moving average mengikuti tren linear', () => {
    const series = [100, 200, 300, 400, 500];
    const forecast = service.movingAverage(series, 3);
    expect(forecast[forecast.length - 1]).toBeCloseTo(400, 5);
  });

  it('exponential smoothing menghaluskan nilai dan konvergen ke rata-rata konstanta', () => {
    const constant = Array.from({ length: 50 }, () => 100);
    const smoothed = service.exponentialSmoothing(constant, 0.5);
    expect(smoothed[smoothed.length - 1]).toBeCloseTo(100, 5);
  });

  it('linear regression mengembalikan slope dan intercept yang tepat', () => {
    const { slope, intercept, r2 } = service.linearRegression([10, 20, 30, 40]);
    expect(slope).toBeCloseTo(10, 5);
    expect(intercept).toBeCloseTo(10, 5);
    expect(r2).toBeCloseTo(1, 5);
  });

  it('buildTimeSeries mengagregasi per bulan', () => {
    const rows = [
      { date: '2024-01-05', amount: 100 },
      { date: '2024-01-20', amount: 50 },
      { date: '2024-02-10', amount: 70 },
    ];
    const series = buildTimeSeries(rows, 'date', 'amount', 'monthly');
    expect(series).toEqual([
      { period: '2024-01', value: 150 },
      { period: '2024-02', value: 70 },
    ]);
  });

  it('buildTimeSeries mengabaikan baris tanpa tanggal atau nilai valid', () => {
    const rows = [
      { date: '2024-01-05', amount: 100 },
      { date: null, amount: 999 },
      { date: '2024-01-06', amount: 'abc' },
      { date: 'invalid-date', amount: 50 },
    ];
    const series = buildTimeSeries(rows, 'date', 'amount', 'monthly');
    expect(series).toEqual([{ period: '2024-01', value: 100 }]);
  });

  it('buildTimeSeries mengagregasi kuartalan', () => {
    const rows = [
      { date: '2024-01-05', amount: 100 },
      { date: '2024-03-20', amount: 50 },
      { date: '2024-04-10', amount: 70 },
    ];
    const series = buildTimeSeries(rows, 'date', 'amount', 'quarterly');
    expect(series).toEqual([
      { period: '2024-Q1', value: 150 },
      { period: '2024-Q2', value: 70 },
    ]);
  });
});
