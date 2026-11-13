import { describe, expect, it } from 'vitest';
import { SegmentationService } from './segmentation.service.js';
import { ClusteringService } from './clustering.service.js';

const prismaStub = {} as never;

describe('SegmentationService', () => {
  const service = new SegmentationService(prismaStub, new ClusteringService());

  const rows = [
    { customer: 'A', date: '2024-12-01', amount: 1000 },
    { customer: 'A', date: '2024-12-10', amount: 500 },
    { customer: 'B', date: '2024-06-01', amount: 300 },
    { customer: 'B', date: '2024-07-01', amount: 300 },
    { customer: 'C', date: '2024-12-15', amount: 5000 },
  ];

  it('menghitung RFM per pelanggan dengan benar', () => {
    const features = service.buildCustomerFeatures(
      rows,
      'customer',
      'date',
      'amount',
    );
    expect(features.length).toBe(3);

    const customerC = features.find((f) => f.customer === 'C');
    expect(customerC?.frequency).toBe(1);
    expect(customerC?.monetary).toBe(5000);
    expect(customerC?.recencyDays).toBe(0);

    const customerA = features.find((f) => f.customer === 'A');
    expect(customerA?.frequency).toBe(2);
    expect(customerA?.monetary).toBe(1500);
    expect(customerA?.recencyDays).toBe(5);

    const customerB = features.find((f) => f.customer === 'B');
    expect(customerB?.frequency).toBe(2);
    expect(customerB?.monetary).toBe(600);
    expect(customerB?.recencyDays).toBeGreaterThan(100);
  });

  it('recency dihitung relatif terhadap tanggal maksimum dataset', () => {
    const features = service.buildCustomerFeatures(
      rows,
      'customer',
      'date',
      'amount',
    );
    const customerA = features.find((f) => f.customer === 'A');
    const customerB = features.find((f) => f.customer === 'B');
    expect(customerB!.recencyDays).toBeGreaterThan(customerA!.recencyDays);
  });

  it('mengabaikan baris tanpa pelanggan atau tanggal valid', () => {
    const dirtyRows = [
      ...rows,
      { customer: '', date: '2024-12-20', amount: 100 },
      { customer: 'D', date: null, amount: 100 },
      { customer: 'D', date: 'not-a-date', amount: 100 },
      { customer: 'D', date: '2024-12-20', amount: 'invalid' },
    ];
    const features = service.buildCustomerFeatures(
      dirtyRows,
      'customer',
      'date',
      'amount',
    );
    expect(features.length).toBe(3);
  });
});
