import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import type { ReportData } from './report-builder.service.js';

export type ReportFormat = 'pdf' | 'xlsx' | 'csv';

function extensionFor(format: ReportFormat): string {
  return format === 'pdf' ? 'pdf' : format === 'xlsx' ? 'xlsx' : 'csv';
}

function buildFileName(report: ReportData, id: string, format: ReportFormat): string {
  const safeTitle = report.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const date = report.generatedAt.slice(0, 10);
  return `${safeTitle}_${date}_${id.slice(0, 8)}.${extensionFor(format)}`;
}

function toCsv(report: ReportData): Buffer {
  const lines: string[] = [];
  lines.push(escapeCsv(report.title));
  lines.push(`Periode,${report.period}`);
  lines.push(`Dataset,${report.datasetName}`);
  lines.push(`Dibuat,${report.generatedAt}`);
  lines.push('');
  lines.push('KPI,Nilai');
  for (const kpi of report.kpis) {
    lines.push(`${escapeCsv(kpi.label)},${escapeCsv(kpi.value)}`);
  }
  lines.push('');
  lines.push(report.table.columns.map(escapeCsv).join(','));
  for (const row of report.table.rows) {
    lines.push(row.map(escapeCsv).join(','));
  }
  lines.push('');
  lines.push('Insight');
  for (const i of report.insights) {
    lines.push(escapeCsv(i));
  }
  lines.push('');
  lines.push('Rekomendasi');
  for (const r of report.recommendations) {
    lines.push(escapeCsv(r));
  }
  lines.push('');
  lines.push('Keterbatasan');
  for (const l of report.limitations) {
    lines.push(escapeCsv(l));
  }
  return Buffer.from(`\uFEFF${lines.join('\n')}`, 'utf8');
}

function escapeCsv(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toXlsx(report: ReportData): Buffer {
  const wb = XLSX.utils.book_new();

  const summaryRows: Array<Array<string>> = [
    [report.title],
    [`Periode: ${report.period}`],
    [`Dataset: ${report.datasetName}`],
    [`Rentang data: ${report.dataRange}`],
    [`Dibuat: ${report.generatedAt}`],
    [],
    ['KPI', 'Nilai'],
    ...report.kpis.map((k) => [k.label, k.value]),
    [],
    ['Insight'],
    ...report.insights.map((i) => [i]),
    [],
    ['Rekomendasi'],
    ...report.recommendations.map((r) => [r]),
    [],
    ['Keterbatasan'],
    ...report.limitations.map((l) => [l]),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Ringkasan');

  const tableRows: Array<Array<string | number>> = [report.table.columns, ...report.table.rows];
  const tableSheet = XLSX.utils.aoa_to_sheet(tableRows);
  XLSX.utils.book_append_sheet(wb, tableSheet, 'Tabel Analisis');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

async function toPdf(report: ReportData): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  doc.font('Helvetica-Bold').fontSize(18).text(report.title, { align: 'left' });
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(10).fillColor('#555');
  doc.text(`Periode: ${report.period}`);
  doc.text(`Dataset: ${report.datasetName}`);
  doc.text(`Rentang data: ${report.dataRange}`);
  doc.text(`Dibuat: ${report.generatedAt}`);
  doc.fillColor('#000').moveDown(1);

  doc.font('Helvetica-Bold').fontSize(13).text('Ringkasan KPI');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10);
  for (const kpi of report.kpis) {
    doc.text(`- ${kpi.label}: ${kpi.value}`);
  }
  doc.moveDown(0.8);

  doc.font('Helvetica-Bold').fontSize(13).text('Tabel Analisis');
  doc.moveDown(0.3);

  const columns = report.table.columns;
  const colWidth = (doc.page.width - 96) / Math.max(columns.length, 1);
  const startY = doc.y;
  doc.font('Helvetica-Bold').fontSize(9);
  columns.forEach((col, i) => {
    doc.text(String(col), 48 + i * colWidth, startY, { width: colWidth - 8, lineBreak: false });
  });
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(9);
  for (const row of report.table.rows) {
    const y = doc.y;
    row.forEach((cell, i) => {
      doc.text(String(cell ?? ''), 48 + i * colWidth, y, {
        width: colWidth - 8,
        lineBreak: false,
      });
    });
    doc.moveDown(0.4);
    if (doc.y > doc.page.height - 96) {
      doc.addPage();
    }
  }
  doc.moveDown(0.6);

  const section = (heading: string, items: string[]) => {
    if (items.length === 0) {
      return;
    }
    if (doc.y > doc.page.height - 140) {
      doc.addPage();
    }
    doc.font('Helvetica-Bold').fontSize(13).text(heading);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10);
    for (const item of items) {
      doc.text(`- ${item}`, { lineGap: 2 });
    }
    doc.moveDown(0.6);
  };

  section('Insight', report.insights);
  section('Rekomendasi', report.recommendations);
  section('Keterbatasan', report.limitations);

  doc.font('Helvetica').fontSize(8).fillColor('#999');
  doc.text('Dibuat otomatis oleh AI Business Intelligence Platform.', 48, doc.page.height - 56);
  doc.end();
  return done;
}

export async function renderReport(
  report: ReportData,
  id: string,
  format: ReportFormat,
): Promise<{ buffer: Buffer; fileName: string }> {
  let buffer: Buffer;
  if (format === 'pdf') {
    buffer = await toPdf(report);
  } else if (format === 'xlsx') {
    buffer = toXlsx(report);
  } else {
    buffer = toCsv(report);
  }
  return { buffer, fileName: buildFileName(report, id, format) };
}
