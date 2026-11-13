import { Injectable } from '@nestjs/common';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../common/prisma.service.js';
import * as PrismaGenerated from '../../../generated/prisma/client.js';

export interface ParsedDataset {
  columns: Array<{ name: string; type?: string }>;
  rows: Array<Record<string, unknown>>;
  rowsCount: number;
}

@Injectable()
export class DatasetsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row ?? {})) {
      cleaned[key] = typeof value === 'string' ? value.trim() : value;
    }
    return cleaned;
  }

  private clean(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    const seen = new Set<string>();
    const result: Array<Record<string, unknown>> = [];
    for (const row of rows) {
      const trimmed = this.normalizeRow(row);
      const key = JSON.stringify(trimmed);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(trimmed);
    }
    return result;
  }

  async list() {
    return this.prisma.dataset.findMany({
      orderBy: { createdAt: 'desc' },
      include: { columns: true },
    });
  }

  async detail(id: string) {
    const dataset = await this.prisma.dataset.findUnique({
      where: { id },
      include: { columns: true },
    });
    if (!dataset) {
      throw new Error('Dataset not found');
    }
    return dataset;
  }

  async parse(
    file: { mimetype: string; buffer?: Buffer; originalname: string },
  ): Promise<ParsedDataset> {
    const buffer = file.buffer;
    if (!buffer) {
      return { columns: [], rows: [], rowsCount: 0 };
    }

    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      const parsed = Papa.parse(buffer.toString('utf8'), { header: true, skipEmptyLines: true });
      const columns = Array.isArray(parsed.meta.fields)
        ? parsed.meta.fields.map((field) => ({ name: field }))
        : [];
      const rows = ((parsed.data ?? []) as Array<Record<string, unknown>>).map((row) =>
        this.normalizeRow(row),
      );
      return { columns, rows, rowsCount: rows.length };
    }

    if (file.mimetype === 'application/json' || file.originalname.toLowerCase().endsWith('.json')) {
      const json = JSON.parse(buffer.toString('utf8'));
      const arr = Array.isArray(json) ? json : [json];
      const columns = arr.length ? Object.keys(arr[0] as object) : [];
      const rows = arr.map((row: Record<string, unknown>) => this.normalizeRow(row));
      return { columns: columns.map((name) => ({ name })), rows, rowsCount: rows.length };
    }

    if (
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.toLowerCase().endsWith('.xlsx')
    ) {
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: null });
      const columns = json.length ? Object.keys(json[0] as object) : [];
      const rows = (json as Array<Record<string, unknown>>).map((row) =>
        this.normalizeRow(row as Record<string, unknown>),
      );
      return { columns: columns.map((name) => ({ name })), rows, rowsCount: rows.length };
    }

    return { columns: [], rows: [], rowsCount: 0 };
  }

  async upload(file: { originalname: string; mimetype: string; buffer?: Buffer }) {
    const parsed = await this.parse(file);
    const rows = this.clean(parsed.rows);

    const dataset = await this.prisma.dataset.create({
      data: {
        name: file.originalname,
        sourceType: file.mimetype ?? 'unknown',
        description: 'Uploaded dataset',
      },
    });

    const version = await this.prisma.datasetVersion.create({
      data: {
        datasetId: dataset.id,
        version: 1,
      },
    });

    for (const column of parsed.columns) {
      await this.prisma.datasetColumn.create({
        data: {
          datasetId: dataset.id,
          columnName: column.name,
          dataType: column.type ?? 'string',
          isNullable: true,
        },
      });
    }

    for (const row of rows) {
      await this.prisma.datasetData.create({
        data: {
          datasetId: dataset.id,
          rowData: row as PrismaGenerated.Prisma.InputJsonValue,
        },
      });
    }

    return { dataset, version, ...parsed, cleanedRows: rows.length };
  }

  async createSemanticModel(datasetId: string, name: string, description?: string) {
    const dataset = await this.prisma.dataset.findUnique({ where: { id: datasetId } });
    if (!dataset) {
      throw new Error('Dataset not found');
    }
    return this.prisma.semanticModel.create({
      data: { datasetId, name, description },
    });
  }

  async addSemanticMapping(
    semanticModelId: string,
    sourceColumn: string,
    targetColumn: string,
    meaning: string,
  ) {
    const semanticModel = await this.prisma.semanticModel.findUnique({
      where: { id: semanticModelId },
    });
    if (!semanticModel) {
      throw new Error('Semantic model not found');
    }
    return this.prisma.semanticMapping.create({
      data: { semanticModelId, sourceColumn, targetColumn, meaning },
    });
  }

  async createMetric(semanticModelId: string, name: string, expression?: string) {
    const semanticModel = await this.prisma.semanticModel.findUnique({
      where: { id: semanticModelId },
    });
    if (!semanticModel) {
      throw new Error('Semantic model not found');
    }
    return this.prisma.metricDefinition.create({
      data: { semanticModelId, name, expression },
    });
  }
}


