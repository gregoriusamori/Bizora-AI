import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { TextToSqlService } from './text-to-sql.service.js';
import type { PrismaService } from '../../common/prisma.service.js';

const service = new TextToSqlService({} as PrismaService);
const allowed = ['tanggal', 'produk', 'revenue', 'jumlah'];

describe('TextToSqlService.compile', () => {
  it('mengompilasi agregasi sederhana dengan parameter dataset_id', () => {
    const compiled = service.compile(
      {
        select: [{ column: 'revenue', agg: 'sum', alias: 'total' }],
      },
      allowed,
      '00000000-0000-0000-0000-000000000001',
    );
    expect(compiled.sql).toContain('SUM((row_data->>\'revenue\')::numeric) AS "total"');
    expect(compiled.sql).toContain('LIMIT 200');
    expect(compiled.params).toEqual(['00000000-0000-0000-0000-000000000001']);
  });

  it('menolak kolom di luar whitelist', () => {
    expect(() =>
      service.compile(
        { select: [{ column: 'hack', agg: 'sum' }] },
        allowed,
        '00000000-0000-0000-0000-000000000001',
      ),
    ).toThrow(BadRequestException);
  });

  it('menolak operator tidak diizinkan', () => {
    expect(() =>
      service.compile(
        {
          select: [{ column: 'revenue', agg: 'sum' }],
          where: { column: 'produk', op: 'LIKE', value: 'a' },
        },
        allowed,
        '00000000-0000-0000-0000-000000000001',
      ),
    ).toThrow(BadRequestException);
  });

  it('memvalidasi groupBy campuran agregat', () => {
    const compiled = service.compile(
      {
        select: [
          { column: 'produk' },
          { column: 'revenue', agg: 'sum', alias: 'total' },
        ],
        groupBy: ['produk'],
        orderBy: { column: 'total', dir: 'desc' },
      },
      allowed,
      '00000000-0000-0000-0000-000000000001',
    );
    expect(compiled.sql).toContain('GROUP BY row_data->>\'produk\'');
    expect(compiled.sql).toContain('ORDER BY "total" DESC');
  });

  it('menolak query campuran tanpa groupBy', () => {
    expect(() =>
      service.compile(
        {
          select: [{ column: 'produk' }, { column: 'revenue', agg: 'sum' }],
        },
        allowed,
        '00000000-0000-0000-0000-000000000001',
      ),
    ).toThrow(BadRequestException);
  });

  it('menolak orderBy di luar select', () => {
    expect(() =>
      service.compile(
        {
          select: [{ column: 'revenue', agg: 'sum' }],
          orderBy: { column: 'produk' },
        },
        allowed,
        '00000000-0000-0000-0000-000000000001',
      ),
    ).toThrow(BadRequestException);
  });

  it('membatasi limit maksimal 200', () => {
    const compiled = service.compile(
      { select: [{ column: 'produk' }], limit: 9999 },
      allowed,
      '00000000-0000-0000-0000-000000000001',
    );
    expect(compiled.sql).toContain('LIMIT 200');
  });
});
