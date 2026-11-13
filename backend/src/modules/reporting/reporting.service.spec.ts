import { describe, expect, it } from 'vitest';
import { ReportBuilderService } from './report-builder.service.js';
import { renderReport } from './report-exporters.js';

const rows = [
  { date: '2024-01-05', revenue: 1000, cost: 400, product: 'A', branch: 'Jakarta', customer: 'C1' },
  { date: '2024-01-20', revenue: 500, cost: 200, product: 'A', branch: 'Jakarta', customer: 'C2' },
  { date: '2024-02-10', revenue: 800, cost: 500, product: 'B', branch: 'Bandung', customer: 'C1' },
  { date: '2024-02-25', revenue: 1200, cost: 600, product: 'B', branch: 'Jakarta', customer: 'C3' },
];

const builder = new ReportBuilderService();
const baseArgs = {
  datasetName: 'Test Dataset',
  dateColumn: 'date',
  metricColumn: 'revenue',
  granularity: 'monthly' as const,
};

describe('ReportBuilderService', () => {
  it('menghitung KPI sales report dengan benar', () => {
    const report = builder.buildReport('sales_report', rows, baseArgs.datasetName, baseArgs.dateColumn, baseArgs.metricColumn);
    expect(report.title).toBe('Sales Report');
    const revenueKpi = report.kpis.find((k) => k.label === 'Total Revenue');
    expect(revenueKpi?.value).toBe('3.500');
    const txKpi = report.kpis.find((k) => k.label === 'Jumlah Transaksi');
    expect(txKpi?.value).toBe('4');
    const avgKpi = report.kpis.find((k) => k.label === 'Rata-rata Nilai Transaksi');
    expect(avgKpi?.value).toBe('875');
    expect(report.kpis.some((k) => k.label === 'Total Profit')).toBe(false);
  });

  it('menghitung profit dan margin saat kolom biaya tersedia', () => {
    const report = builder.buildReport(
      'profit_report',
      rows,
      baseArgs.datasetName,
      baseArgs.dateColumn,
      baseArgs.metricColumn,
      baseArgs.granularity,
      'cost',
    );
    const profitKpi = report.kpis.find((k) => k.label === 'Total Profit');
    expect(profitKpi?.value).toBe('1.800');
    const marginKpi = report.kpis.find((k) => k.label === 'Profit Margin');
    expect(marginKpi?.value).toBe('51,43%');
  });

  it('menghitung pertumbuhan periode terakhir vs sebelumnya', () => {
    const report = builder.buildReport('sales_report', rows, baseArgs.datasetName, baseArgs.dateColumn, baseArgs.metricColumn);
    const growthKpi = report.kpis.find((k) => k.label?.includes('Pertumbuhan'));
    expect(growthKpi?.value).toBe('+33,33%');
  });

  it('membuat tabel breakdown per grup untuk product performance', () => {
    const report = builder.buildReport(
      'product_performance_report',
      rows,
      baseArgs.datasetName,
      baseArgs.dateColumn,
      baseArgs.metricColumn,
      baseArgs.granularity,
      undefined,
      'product',
    );
    expect(report.table.columns).toEqual(['Kategori', 'Revenue']);
    expect(report.table.rows[0][0]).toBe('B');
    expect(report.table.rows[0][1]).toBe(2000);
    expect(report.table.rows[1][0]).toBe('A');
    expect(report.table.rows[1][1]).toBe(1500);
  });

  it('menandai fakta dan saran secara terpisah', () => {
    const report = builder.buildReport(
      'sales_report',
      rows,
      baseArgs.datasetName,
      baseArgs.dateColumn,
      baseArgs.metricColumn,
      baseArgs.granularity,
      undefined,
      'product',
    );
    for (const insight of report.insights) {
      expect(insight.startsWith('Fakta:')).toBe(true);
    }
    for (const rec of report.recommendations) {
      expect(rec.startsWith('Saran')).toBe(true);
    }
    expect(report.limitations.some((l) => l.includes('biaya'))).toBe(true);
  });

  it('menolak laporan tanpa nilai numerik valid', () => {
    const badRows = [{ date: '2024-01-01', revenue: 'abc' }];
    expect(() =>
      builder.buildReport('sales_report', badRows, baseArgs.datasetName, baseArgs.dateColumn, baseArgs.metricColumn),
    ).toThrow(/kolom "revenue"/i);
  });

  it('menyaring baris berdasarkan rentang tanggal', () => {
    const report = builder.buildReport(
      'sales_report',
      rows,
      baseArgs.datasetName,
      baseArgs.dateColumn,
      baseArgs.metricColumn,
      baseArgs.granularity,
      undefined,
      undefined,
      '2024-01-01',
      '2024-01-31',
    );
    const revenueKpi = report.kpis.find((k) => k.label === 'Total Revenue');
    expect(revenueKpi?.value).toBe('1.500');
    expect(report.period).toContain('2024-01-01');
  });
});

describe('report exporters', () => {
  const report = builder.buildReport(
    'product_performance_report',
    rows,
    baseArgs.datasetName,
    baseArgs.dateColumn,
    baseArgs.metricColumn,
    baseArgs.granularity,
    'cost',
    'product',
  );

  it('CSV berisi KPI dan tabel', async () => {
    const { buffer, fileName } = await renderReport(report, '11111111-aaaa-bbbb-cccc-dddddddddddd', 'csv');
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    expect(fileName.endsWith('.csv')).toBe(true);
    expect(text).toContain('Total Revenue');
    expect(text).toContain('Kategori,Revenue');
    expect(text).toContain('"Fakta');
  });

  it('XLSX menghasilkan buffer valid', async () => {
    const { buffer, fileName } = await renderReport(report, '11111111-aaaa-bbbb-cccc-dddddddddddd', 'xlsx');
    expect(fileName.endsWith('.xlsx')).toBe(true);
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
  });

  it('PDF menghasilkan buffer valid', async () => {
    const { buffer, fileName } = await renderReport(report, '11111111-aaaa-bbbb-cccc-dddddddddddd', 'pdf');
    expect(fileName.endsWith('.pdf')).toBe(true);
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
