import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';

@Injectable()
export class BusinessAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDatasetRows(datasetId: string, limit = 1000) {
    const dataset = await this.prisma.dataset.findUnique({ where: { id: datasetId } });
    if (!dataset) {
      throw new Error('Dataset not found');
    }

    const data = await this.prisma.datasetData.findMany({
      where: { datasetId },
      take: limit,
    });

    return data.map((d) => d.rowData as Record<string, unknown>);
  }

  aggregate(
    rows: Array<Record<string, unknown>>,
    metricColumn: string,
    fn: 'sum' | 'avg' | 'count' = 'sum',
  ) {
    const values = rows
      .map((row) => row[metricColumn])
      .filter((v) => typeof v === 'number')
      .map((v) => v as number);

    if (values.length === 0) {
      return 0;
    }

    if (fn === 'count') {
      return values.length;
    }
    if (fn === 'avg') {
      return values.reduce((acc, v) => acc + v, 0) / values.length;
    }
    return values.reduce((acc, v) => acc + v, 0);
  }

  revenue(rows: Array<Record<string, unknown>>, column = 'sales_amount'): number {
    return this.aggregate(rows, column, 'sum');
  }

  profit(rows: Array<Record<string, unknown>>, revenueColumn = 'sales_amount', costColumn = 'cost_amount'): number {
    const totalRevenue = this.revenue(rows, revenueColumn);
    const totalCost = this.aggregate(rows, costColumn, 'sum');
    return totalRevenue - totalCost;
  }

  profitMargin(
    rows: Array<Record<string, unknown>>,
    revenueColumn = 'sales_amount',
    costColumn = 'cost_amount',
  ): number {
    const totalRevenue = this.revenue(rows, revenueColumn);
    const totalCost = this.aggregate(rows, costColumn, 'sum');
    if (totalRevenue === 0) {
      return 0;
    }
    return ((totalRevenue - totalCost) / totalRevenue) * 100;
  }

  salesGrowth(currentPeriod: number, previousPeriod: number): number {
    if (previousPeriod === 0) {
      return 0;
    }
    return ((currentPeriod - previousPeriod) / previousPeriod) * 100;
  }
}
