import { Injectable } from '@nestjs/common';

export interface KMeansResult {
  assignments: number[];
  centroids: number[][];
  inertia: number;
  iterations: number;
  clusterSizes: number[];
}

@Injectable()
export class ClusteringService {
  kMeans(
    data: number[][],
    clusterCountParam = 3,
    maxIterations = 100,
  ): KMeansResult {
    if (!data || data.length === 0) {
      return { assignments: [], centroids: [], inertia: 0, iterations: 0, clusterSizes: [] };
    }
    const k = Math.max(1, Math.min(clusterCountParam, data.length));
    const dim = data[0].length;
    let centroids = this.initCentroids(data, k);

    let assignments = Array.from({ length: data.length }, () => 0);
    let iterations = 0;

    for (let iter = 0; iter < maxIterations; iter++) {
      iterations = iter + 1;
      let changed = false;
      for (let i = 0; i < data.length; i++) {
        const best = this.nearestCentroid(data[i], centroids);
        if (assignments[i] !== best) {
          assignments[i] = best;
          changed = true;
        }
      }

      const sums = Array.from({ length: k }, () => Array.from({ length: dim }, () => 0));
      const counts = Array.from({ length: k }, () => 0);
      for (let i = 0; i < data.length; i++) {
        const c = assignments[i];
        counts[c]++;
        for (let d = 0; d < dim; d++) {
          sums[c][d] += data[i][d];
        }
      }
      centroids = centroids.map((c, ci) => {
        if (counts[ci] === 0) {
          return c;
        }
        return sums[ci].map((s) => s / counts[ci]);
      });

      if (!changed && iter > 0) {
        break;
      }
    }

    const clusterSizes = Array.from({ length: k }, () => 0);
    let inertia = 0;
    for (let i = 0; i < data.length; i++) {
      const c = assignments[i];
      clusterSizes[c]++;
      inertia += this.distanceSq(data[i], centroids[c]);
    }

    return {
      assignments,
      centroids,
      inertia: Math.round(inertia * 1e6) / 1e6,
      iterations,
      clusterSizes,
    };
  }

  standardize(data: number[][]): number[][] {
    if (!data || data.length === 0) {
      return [];
    }
    const dim = data[0].length;
    const means = new Array<number>(dim).fill(0);
    const stds = new Array<number>(dim).fill(0);
    for (const row of data) {
      for (let d = 0; d < dim; d++) {
        means[d] += row[d];
      }
    }
    for (let d = 0; d < dim; d++) {
      means[d] /= data.length;
    }
    for (const row of data) {
      for (let d = 0; d < dim; d++) {
        stds[d] += (row[d] - means[d]) ** 2;
      }
    }
    for (let d = 0; d < dim; d++) {
      stds[d] = Math.sqrt(stds[d] / data.length);
    }
    return data.map((row) =>
      row.map((v, d) => (stds[d] === 0 ? 0 : (v - means[d]) / stds[d])),
    );
  }

  private initCentroids(data: number[][], k: number): number[][] {
    const centroids: number[][] = [[...data[0]]];
    while (centroids.length < k) {
      const dists = data.map((point) => {
        let minDist = Infinity;
        for (const c of centroids) {
          minDist = Math.min(minDist, this.distanceSq(point, c));
        }
        return minDist;
      });
      const total = dists.reduce((acc, v) => acc + v, 0);
      if (total === 0) {
        centroids.push([...data[centroids.length % data.length]]);
        continue;
      }
      let target = Math.random() * total;
      let index = 0;
      for (let i = 0; i < dists.length; i++) {
        target -= dists[i];
        if (target <= 0) {
          index = i;
          break;
        }
        index = i;
      }
      centroids.push([...data[index]]);
    }
    return centroids;
  }

  private nearestCentroid(point: number[], centroids: number[][]): number {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < centroids.length; i++) {
      const dist = this.distanceSq(point, centroids[i]);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }

  private distanceSq(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    let sum = 0;
    for (let i = 0; i < len; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return sum;
  }

  private distance(a: number[], b: number[]): number {
    return Math.sqrt(this.distanceSq(a, b));
  }
}
