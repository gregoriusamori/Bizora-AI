import { Injectable } from '@nestjs/common';
import { ParsedDataset } from '../datasets/datasets.service.js';

export interface ColumnProfile {
  column: string;
  type: string;
  nullCount: number;
  distinctCount: number;
  sampleValues: unknown[];
}

@Injectable()
export class DataProfilingService {
  profile(parsed: ParsedDataset, rows: Array<Record<string, unknown>> = []): ColumnProfile[] {
    return parsed.columns.map((column) => {
      const values = rows.map((row) => row[column.name]).filter((v) => v !== null && v !== undefined);
      const distinct = new Set(values.map((v) => String(v))).size;
      const nullCount = parsed.rowsCount - values.length;

      return {
        column: column.name,
        type: column.type ?? 'string',
        nullCount,
        distinctCount: distinct,
        sampleValues: values.slice(0, 5),
      };
    });
  }
}
