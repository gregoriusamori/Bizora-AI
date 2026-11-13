import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { DashboardAnalyticsService } from './dashboard-analytics.service.js';
import type { PrismaService } from '../../common/prisma.service.js';
import type { AnalyzeDto } from './dto/analyze.dto.js';

const rows = [
  { date: '2024-01-05', revenue: 1000, cost: 400, product: 'Produk A' },
  { date: '2024-01-20', revenue: 500, cost: 200, product: 'Produk A' },
  { date: '2024-02-10', revenue: 800, cost: 500, product: 'Produk B' },
  { date: '2024-02-25', revenue: 1200, cost: 600, product: 'Produk B' },
];

function makeService(datasetName = 'Dataset Uji'): DashboardAnalyticsService {
  const prisma = {
    dataset: {
      findUnique: vi.fn().mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
        name: datasetName,
        columns: [
          { columnName: 'date' },
          { columnName: 'revenue' },
          { columnName: 'cost' },
          { columnName: 'product' },
        ],
      }),
    },
    datasetData: {
      findMany: vi.fn().mockResolvedValue(rows.map((row) => ({ rowData: row }))),
    },
  } as unknown as PrismaService;
  return new DashboardAnalyticsService(prisma);
}

const base: AnalyzeDto = {
  datasetId: '00000000-0000-0000-0000-000000000001',
  dateColumn: 'date',
  revenueColumn: 'revenue',
};

describe('DashboardAnalyticsService', () => {
  it('overview menghitung KPI revenue dan pertumbuhan', async () => {
    const result = await makeService().overview(base);
    const revenueKpi = result.kpis.find((k) => k.label === 'Total Revenue');
    expect(revenueKpi?.value).toBe('3.500');
    expect(result.trend).toHaveLength(2);
    expect(result.trend[0].revenue).toBe(1500);
    expect(result.trend[1].revenue).toBe(2000);
    const last = result.growth[result.growth.length - 1];
    expect(last.growthPercent).toBeCloseTo(33.33, 1);
    expect(result.dataRange).toBe('2024-01-05 s/d 2024-02-25');
  });

  it('overview menghitung profit saat costColumn diberikan', async () => {
    const result = await makeService().overview({ ...base, costColumn: 'cost' });
    const profitKpi = result.kpis.find((k) => k.label === 'Total Profit');
    expect(profitKpi?.value).toBe('1.800');
    const marginKpi = result.kpis.find((k) => k.label === 'Profit Margin');
    expect(marginKpi?.value).toBe('51,43%');
  });

  it('profit menolak tanpa costColumn', async () => {
    await expect(makeService().profit(base)).rejects.toThrow(BadRequestException);
  });

  it('profit menghitung trend profit per periode', async () => {
    const result = await makeService().profit({ ...base, costColumn: 'cost' });
    expect(result.trend[1].profit).toBe(900);
    expect(result.insights.some((i) => i.startsWith('Fakta:'))).toBe(true);
    expect(result.insights.some((i) => i.startsWith('Saran:'))).toBe(true);
  });

  it('productOrBranch mengurutkan produk berdasarkan revenue', async () => {
    const result = await makeService().productOrBranch(
      { ...base, groupColumn: 'product', topN: 10 },
      'product',
    );
    expect(result.items[0].label).toBe('Produk B');
    expect(result.items[0].revenue).toBe(2000);
    expect(result.items[0].sharePercent).toBeCloseTo(57.14, 1);
  });

  it('productOrBranch menolak tanpa groupColumn', async () => {
    await expect(makeService().productOrBranch(base, 'product')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('menolak kolom yang tidak ada di dataset', async () => {
    await expect(
      makeService().overview({ ...base, dateColumn: 'kolom_aneh' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('menolak saat filter periode tidak menyisakan data', async () => {
    const service = makeService();
    await expect(
      service.overview({ ...base, startDate: '2030-01-01', endDate: '2030-12-31' }),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});
