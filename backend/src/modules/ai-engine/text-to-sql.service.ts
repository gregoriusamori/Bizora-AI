import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';

export interface QuerySpecSelect {
  column: string;
  agg?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  alias?: string;
}

export interface QuerySpec {
  select: QuerySpecSelect[];
  groupBy?: string[];
  where?: { column: string; op: string; value: string | number };
  dateFrom?: { column: string; value: string };
  dateTo?: { column: string; value: string };
  orderBy?: { column: string; dir?: 'asc' | 'desc' };
  limit?: number;
}

export interface CompiledQuery {
  sql: string;
  params: unknown[];
}

const ALLOWED_OPS = new Set(['=', '!=', '<>', '>', '<', '>=', '<=']);
const AGG_FUNCTIONS: Record<string, string> = {
  sum: 'SUM',
  avg: 'AVG',
  count: 'COUNT',
  min: 'MIN',
  max: 'MAX',
};
const MAX_ROWS = 200;
const MAX_LIMIT = 5000;

export interface SqlExecutionResult {
  sql: string;
  params: unknown[];
  rowCount: number;
  rows: Array<Record<string, unknown>>;
  truncated: boolean;
  executionMs: number;
}

@Injectable()
export class TextToSqlService {
  constructor(private readonly prisma: PrismaService) {}

  compile(spec: QuerySpec, allowedColumns: string[], datasetId: string): CompiledQuery {
    if (!spec || !Array.isArray(spec.select) || spec.select.length === 0) {
      throw new BadRequestException('Spesifikasi query harus memiliki minimal satu kolom select.');
    }

    const allowed = new Set(allowedColumns);
    const params: unknown[] = [];
    const pushParam = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    const selectParts = spec.select.map((item) => {
      this.assertColumn(item.column, allowed);
      if (item.agg) {
        const fn = AGG_FUNCTIONS[item.agg];
        if (!fn) {
          throw new BadRequestException(`Agregasi tidak didukung: ${item.agg}`);
        }
        const casted = `(row_data->>'${this.escapeJsonKey(item.column)}')::numeric`;
        const alias = this.safeAlias(item.alias ?? `${item.agg}_${item.column}`);
        return `${fn}(${casted}) AS "${alias}"`;
      }
      const alias = this.safeAlias(item.alias ?? item.column);
      return `row_data->>'${this.escapeJsonKey(item.column)}' AS "${alias}"`;
    });

    let groupByClause = '';
    if (Array.isArray(spec.groupBy) && spec.groupBy.length > 0) {
      const groupCols = spec.groupBy.map((c) => {
        this.assertColumn(c, allowed);
        return `row_data->>'${this.escapeJsonKey(c)}'`;
      });
      groupByClause = ` GROUP BY ${groupCols.join(', ')}`;
    } else if (spec.select.some((s) => s.agg) && spec.select.some((s) => !s.agg)) {
      throw new BadRequestException(
        'Query campuran agregat dan kolom biasa memerlukan groupBy.',
      );
    }

    const whereParts: string[] = [`dataset_id = ${pushParam(datasetId)}::uuid`];

    if (spec.where) {
      this.assertColumn(spec.where.column, allowed);
      if (!ALLOWED_OPS.has(spec.where.op)) {
        throw new BadRequestException(`Operator tidak diizinkan: ${spec.where.op}`);
      }
      const op = spec.where.op === '<>' ? '!=' : spec.where.op;
      const casted = `(row_data->>'${this.escapeJsonKey(spec.where.column)}')::numeric`;
      const raw = `row_data->>'${this.escapeJsonKey(spec.where.column)}'`;
      const expr =
        typeof spec.where.value === 'number' ? casted : `LOWER(${raw})`;
      const value =
        typeof spec.where.value === 'number'
          ? spec.where.value
          : String(spec.where.value).toLowerCase();
      whereParts.push(`${expr} ${op} ${pushParam(value)}`);
    }

    if (spec.dateFrom) {
      this.assertColumn(spec.dateFrom.column, allowed);
      whereParts.push(
        `(row_data->>'${this.escapeJsonKey(spec.dateFrom.column)}')::timestamp >= ${pushParam(spec.dateFrom.value)}::timestamp`,
      );
    }
    if (spec.dateTo) {
      this.assertColumn(spec.dateTo.column, allowed);
      whereParts.push(
        `(row_data->>'${this.escapeJsonKey(spec.dateTo.column)}')::timestamp <= ${pushParam(spec.dateTo.value)}::timestamp`,
      );
    }

    let orderByClause = '';
    if (spec.orderBy?.column) {
      const orderAlias = spec.orderBy.column;
      const matchedSelect = spec.select.find(
        (s) => (s.alias ?? s.column) === orderAlias || s.column === orderAlias,
      );
      if (!matchedSelect) {
        throw new BadRequestException(
          `orderBy harus merujuk kolom yang ada di select: ${orderAlias}`,
        );
      }
      const dir = spec.orderBy.dir === 'asc' ? 'ASC' : 'DESC';
      orderByClause = ` ORDER BY "${this.safeAlias(matchedSelect.alias ?? matchedSelect.column)}" ${dir}`;
    }

    const limit = Math.min(Math.max(spec.limit ?? MAX_ROWS, 1), MAX_ROWS);

    const sql = `SELECT ${selectParts.join(', ')} FROM dataset_data WHERE ${whereParts.join(' AND ')}${groupByClause}${orderByClause} LIMIT ${limit}`;
    return { sql, params };
  }

  async execute(compiled: CompiledQuery): Promise<SqlExecutionResult> {
    const started = Date.now();
    const rows = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL statement_timeout = 5000');
      const result = await tx.$queryRawUnsafe(
        compiled.sql,
        ...compiled.params,
      );
      return result as Array<Record<string, unknown>>;
    });

    return {
      sql: compiled.sql,
      params: compiled.params,
      rowCount: rows.length,
      rows: rows.map((row) => this.normalizeRow(row)),
      truncated: rows.length >= MAX_ROWS,
      executionMs: Date.now() - started,
    };
  }

  private normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      clean[key] =
        typeof value === 'bigint'
          ? Number(value)
          : value instanceof Date
            ? value.toISOString()
            : value;
    }
    return clean;
  }

  private assertColumn(column: string, allowed: Set<string>): void {
    if (!column || typeof column !== 'string' || !allowed.has(column)) {
      throw new BadRequestException(
        `Kolom "${column}" tidak ada di dataset. Kolom yang tersedia: ${Array.from(allowed).join(', ')}.`,
      );
    }
  }

  private escapeJsonKey(key: string): string {
    return key.replace(/\\/g, '\\\\').replace(/'/g, "''");
  }

  private safeAlias(alias: string): string {
    return (alias ?? 'col').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 60) || 'col';
  }
}
