import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { ClusteringService, KMeansResult } from './clustering.service.js';
import {
  RunClusteringDto,
  RunSegmentationDto,
} from './dto/clustering.dto.js';

export const MIN_CUSTOMERS_FOR_SEGMENTATION = 10;

export interface CustomerFeature {
  customer: string;
  recencyDays: number;
  frequency: number;
  monetary: number;
}

export interface SegmentSummary {
  label: string;
  customers: number;
  sharePercent: number;
  avgRecencyDays: number;
  avgFrequency: number;
  avgMonetary: number;
}

export interface SegmentationResult {
  datasetId: string;
  customerColumn: string;
  dateColumn: string;
  revenueColumn: string | null;
  adequate: boolean;
  message?: string;
  totalCustomers: number;
  clusters: number;
  segments: SegmentSummary[];
  customers: Array<{
    customer: string;
    recencyDays: number;
    frequency: number;
    monetary: number;
    segment: string;
  }>;
  diagnostics: {
    inertia: number | null;
    iterations: number | null;
  };
}

const SEGMENT_LABELS_BY_RANK = [
  'Best Customers',
  'Loyal Customers',
  'Promising',
  'At Risk',
  'Low Value',
];

function rankLabel(index: number): string {
  if (index < SEGMENT_LABELS_BY_RANK.length) {
    return SEGMENT_LABELS_BY_RANK[index];
  }
  return `Segment ${index + 1}`;
}

@Injectable()
export class SegmentationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clustering: ClusteringService,
  ) {}

  async runSegmentation(dto: RunSegmentationDto): Promise<SegmentationResult> {
    const dataset = await this.prisma.dataset.findUnique({
      where: { id: dto.datasetId },
    });
    if (!dataset) {
      throw new NotFoundException('Dataset not found');
    }

    const data = await this.prisma.datasetData.findMany({
      where: { datasetId: dto.datasetId },
    });
    const rows = data.map((d) => d.rowData as Record<string, unknown>);

    const revenueColumn = dto.revenueColumn ?? 'sales_amount';
    const features = this.buildCustomerFeatures(
      rows,
      dto.customerColumn,
      dto.dateColumn,
      revenueColumn,
    );

    if (features.length < MIN_CUSTOMERS_FOR_SEGMENTATION) {
      return {
        datasetId: dto.datasetId,
        customerColumn: dto.customerColumn,
        dateColumn: dto.dateColumn,
        revenueColumn,
        adequate: false,
        message: `Data tidak memadai untuk segmentasi pelanggan. Minimal ${MIN_CUSTOMERS_FOR_SEGMENTATION} pelanggan unik diperlukan, dataset hanya memiliki ${features.length}.`,
        totalCustomers: features.length,
        clusters: dto.segments ?? 4,
        segments: [],
        customers: [],
        diagnostics: { inertia: null, iterations: null },
      };
    }

    const k = Math.min(dto.segments ?? 4, features.length);
    const featureMatrix = features.map((f) => [
      f.recencyDays,
      f.frequency,
      f.monetary,
    ]);
    const standardized = this.clustering.standardize(featureMatrix);
    const result = this.clustering.kMeans(standardized, k);

    const centroids = result.centroids;
    const order = centroids
      .map((c, i) => ({
        index: i,
        score: -c[0] + c[1] + c[2],
      }))
      .sort((a, b) => b.score - a.score)
      .map((entry, rank) => ({ ...entry, rank }));

    const clusterToRank = new Map<number, number>();
    for (const entry of order) {
      clusterToRank.set(entry.index, entry.rank);
    }

    const segmentAgg = new Map<number, { count: number; recency: number; frequency: number; monetary: number }>();
    const customers = features.map((f, i) => {
      const cluster = result.assignments[i];
      const agg = segmentAgg.get(cluster) ?? { count: 0, recency: 0, frequency: 0, monetary: 0 };
      agg.count++;
      agg.recency += f.recencyDays;
      agg.frequency += f.frequency;
      agg.monetary += f.monetary;
      segmentAgg.set(cluster, agg);
      return {
        customer: f.customer,
        recencyDays: f.recencyDays,
        frequency: f.frequency,
        monetary: Math.round(f.monetary * 100) / 100,
        segment: rankLabel(clusterToRank.get(cluster) ?? 0),
      };
    });

    const segments: SegmentSummary[] = Array.from(segmentAgg.entries())
      .map(([cluster, agg]) => ({
        label: rankLabel(clusterToRank.get(cluster) ?? 0),
        customers: agg.count,
        sharePercent: Math.round((agg.count / features.length) * 10000) / 100,
        avgRecencyDays: Math.round((agg.recency / agg.count) * 100) / 100,
        avgFrequency: Math.round((agg.frequency / agg.count) * 100) / 100,
        avgMonetary: Math.round((agg.monetary / agg.count) * 100) / 100,
      }))
      .sort((a, b) => {
        const rankA = SEGMENT_LABELS_BY_RANK.indexOf(a.label);
        const rankB = SEGMENT_LABELS_BY_RANK.indexOf(b.label);
        return (rankA === -1 ? 99 : rankA) - (rankB === -1 ? 99 : rankB);
      });

    return {
      datasetId: dto.datasetId,
      customerColumn: dto.customerColumn,
      dateColumn: dto.dateColumn,
      revenueColumn,
      adequate: true,
      totalCustomers: features.length,
      clusters: k,
      segments,
      customers,
      diagnostics: {
        inertia: result.inertia,
        iterations: result.iterations,
      },
    };
  }

  buildCustomerFeatures(
    rows: Array<Record<string, unknown>>,
    customerColumn: string,
    dateColumn: string,
    revenueColumn: string,
  ): CustomerFeature[] {
    const referenceDate = this.maxDate(rows, dateColumn);
    const map = new Map<
      string,
      { recencyDays: number; frequency: number; monetary: number }
    >();

    for (const row of rows) {
      const customer = row[customerColumn];
      if (customer === null || customer === undefined || String(customer).trim() === '') {
        continue;
      }
      const key = String(customer);
      const rawDate = row[dateColumn];
      if (rawDate === null || rawDate === undefined) {
        continue;
      }
      const date = rawDate instanceof Date ? rawDate : new Date(String(rawDate));
      if (Number.isNaN(date.getTime())) {
        continue;
      }
      const rawRevenue = row[revenueColumn];
      const revenue = typeof rawRevenue === 'number' ? rawRevenue : Number(rawRevenue);
      if (!Number.isFinite(revenue)) {
        continue;
      }

      const entry = map.get(key) ?? { recencyDays: Infinity, frequency: 0, monetary: 0 };
      entry.frequency += 1;
      entry.monetary += revenue;
      const diffDays = (referenceDate.getTime() - date.getTime()) / (24 * 60 * 60 * 1000);
      entry.recencyDays = Math.min(entry.recencyDays, Math.max(0, diffDays));
      map.set(key, entry);
    }

    return Array.from(map.entries())
      .map(([customer, f]) => ({
        customer,
        recencyDays: Math.round(f.recencyDays * 100) / 100,
        frequency: f.frequency,
        monetary: Math.round(f.monetary * 100) / 100,
      }))
      .sort((a, b) => b.monetary - a.monetary);
  }

  private maxDate(rows: Array<Record<string, unknown>>, dateColumn: string): Date {
    let max = new Date(0);
    for (const row of rows) {
      const raw = row[dateColumn];
      if (raw === null || raw === undefined) {
        continue;
      }
      const date = raw instanceof Date ? raw : new Date(String(raw));
      if (!Number.isNaN(date.getTime()) && date > max) {
        max = date;
      }
    }
    return max;
  }
}
