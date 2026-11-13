import { Injectable } from '@nestjs/common';
import { BusinessAnalyticsService } from '../business-analytics/business-analytics.service.js';
import { TextToSqlService } from './text-to-sql.service.js';
import { SqlValidationService } from './sql-validator.service.js';

@Injectable()
export class AiEngineService {
  constructor(
    private readonly businessAnalytics: BusinessAnalyticsService,
    private readonly textToSql: TextToSqlService,
    private readonly sqlValidation: SqlValidationService,
  ) {}

  async analyze(rows: Array<Record<string, unknown>>, question: string) {
    const sqlResult = await this.textToSql.generate(
      Object.keys(rows[0] ?? {}).map((name) => ({ name, type: 'string' })),
      question,
    );
    const validation = this.sqlValidation.validate(sqlResult.sql);

    const revenue = this.businessAnalytics.revenue(rows);
    const profit = this.businessAnalytics.profit(rows);
    const margin = this.businessAnalytics.profitMargin(rows);

    const insight = `Analisis: revenue=${revenue}, profit=${profit}, margin=${margin}% untuk pertanyaan "${question}"`;

    const recommendation = 'Rekomendasi: optimalkan margin dengan mengevaluasi cost pada produk berkinerja rendah.';

    return { insight, recommendation, sql: sqlResult.sql, valid: validation.valid };
  }
}
