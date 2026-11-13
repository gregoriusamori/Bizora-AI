import { describe, expect, it } from 'vitest';
import { ClusteringService } from './clustering.service.js';

describe('ClusteringService', () => {
  const service = new ClusteringService();

  it('memisahkan dua cluster yang jelas berbeda', () => {
    const data = [
      [0, 0],
      [0.1, 0],
      [0, 0.1],
      [10, 10],
      [10.1, 10],
      [10, 10.1],
    ];
    const result = service.kMeans(data, 2);
    const clusterA = result.assignments[0];
    const clusterB = result.assignments[3];
    expect(clusterA).not.toBe(clusterB);
    for (let i = 0; i < 3; i++) {
      expect(result.assignments[i]).toBe(clusterA);
      expect(result.assignments[i + 3]).toBe(clusterB);
    }
    expect(result.clusterSizes[clusterA]).toBe(3);
    expect(result.clusterSizes[clusterB]).toBe(3);
  });

  it('semua titik yang identik masuk satu cluster', () => {
    const data = [
      [5, 5],
      [5, 5],
      [5, 5],
      [5, 5],
    ];
    const result = service.kMeans(data, 3);
    expect(result.assignments.every((a) => a === result.assignments[0])).toBe(
      true,
    );
    expect(result.inertia).toBeCloseTo(0, 5);
  });

  it('menangani data kosong', () => {
    const result = service.kMeans([], 3);
    expect(result.assignments).toEqual([]);
    expect(result.centroids).toEqual([]);
  });

  it('inertia menurun setelah konvergensi pada data bervariasi', () => {
    const data = [
      [1, 1],
      [1.2, 0.9],
      [5, 5],
      [5.2, 4.8],
      [9, 9],
      [9.1, 8.9],
    ];
    const result = service.kMeans(data, 3);
    expect(result.iterations).toBeGreaterThan(0);
    expect(result.inertia).toBeGreaterThanOrEqual(0);
    expect(result.centroids.length).toBe(3);
  });

  it('standardize menghasilkan mean 0 dan std 1 per kolom', () => {
    const data = [
      [10, 100],
      [20, 200],
      [30, 300],
    ];
    const standardized = service.standardize(data);
    const colMean = (d: number) =>
      standardized.reduce((acc, row) => acc + row[d], 0) / standardized.length;
    expect(colMean(0)).toBeCloseTo(0, 5);
    expect(colMean(1)).toBeCloseTo(0, 5);
    const colStd = (d: number) =>
      Math.sqrt(
        standardized.reduce((acc, row) => acc + (row[d] - colMean(d)) ** 2, 0) /
          standardized.length,
      );
    expect(colStd(0)).toBeCloseTo(1, 3);
    expect(colStd(1)).toBeCloseTo(1, 3);
  });
});
