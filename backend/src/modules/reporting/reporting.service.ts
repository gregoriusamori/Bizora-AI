import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PrismaService } from '../../common/prisma.service.js';
import { ReportBuilderService, ReportData } from './report-builder.service.js';
import { renderReport, ReportFormat } from './report-exporters.js';
import { GenerateReportDto, ReportType } from './dto/generate-report.dto.js';
import { randomUUID } from 'node:crypto';

export interface ReportMeta {
  id: string;
  title: string;
  reportType: string;
  format: ReportFormat;
  datasetId: string;
  datasetName: string;
  period: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

@Injectable()
export class ReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportBuilder: ReportBuilderService,
  ) {}

  private storageDir(): string {
    return (
      process.env.REPORT_STORAGE_DIR ??
      path.resolve(process.cwd(), '..', 'storage', 'reports')
    );
  }

  private indexPath(): string {
    return path.join(this.storageDir(), 'index.json');
  }

  async generate(dto: GenerateReportDto): Promise<ReportMeta> {
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

    if (rows.length === 0) {
      throw new UnprocessableEntityException(
        'Dataset tidak memiliki data baris untuk dilaporkan.',
      );
    }

    let report: ReportData;
    try {
      report = this.reportBuilder.buildReport(
        dto.reportType as ReportType,
        rows,
        dataset.name,
        dto.dateColumn,
        dto.metricColumn,
        dto.granularity ?? 'monthly',
        dto.costColumn,
        dto.groupColumn,
        dto.startDate,
        dto.endDate,
        dto.title,
      );
    } catch (e) {
      if (e instanceof UnprocessableEntityException) {
        throw e;
      }
      throw new UnprocessableEntityException(
        'Gagal menyusun laporan: ' + String((e as Error).message),
      );
    }

    const id = randomUUID();
    const { buffer, fileName } = await renderReport(
      report,
      id,
      dto.format as ReportFormat,
    );

    const dir = this.storageDir();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, fileName), buffer);

    const meta: ReportMeta = {
      id,
      title: report.title,
      reportType: dto.reportType,
      format: dto.format as ReportFormat,
      datasetId: dto.datasetId,
      datasetName: dataset.name,
      period: report.period,
      fileName,
      sizeBytes: buffer.length,
      createdAt: report.generatedAt,
    };

    const list = await this.readIndex();
    list.push(meta);
    await this.writeIndex(list);

    return meta;
  }

  async list(): Promise<ReportMeta[]> {
    const list = await this.readIndex();
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getDownload(id: string): Promise<{ filePath: string; meta: ReportMeta }> {
    const list = await this.readIndex();
    const meta = list.find((r) => r.id === id);
    if (!meta) {
      throw new NotFoundException('Report not found');
    }
    const filePath = path.join(this.storageDir(), meta.fileName);
    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException('File laporan tidak ditemukan di penyimpanan.');
    }
    return { filePath, meta };
  }

  private async readIndex(): Promise<ReportMeta[]> {
    try {
      const raw = await fs.readFile(this.indexPath(), 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ReportMeta[]) : [];
    } catch {
      return [];
    }
  }

  private async writeIndex(list: ReportMeta[]): Promise<void> {
    await fs.mkdir(this.storageDir(), { recursive: true });
    await fs.writeFile(this.indexPath(), JSON.stringify(list, null, 2), 'utf8');
  }
}
