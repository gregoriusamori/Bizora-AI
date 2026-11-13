import { Injectable } from '@nestjs/common';

export interface TextToSqlResult {
  sql: string;
  columns: string[];
}

@Injectable()
export class TextToSqlService {
  async generate(columns: Array<{ name: string; type: string }>, question: string): Promise<TextToSqlResult> {
    const columnNames = columns.map((c) => c.name);
    const columnList = columnNames.length ? columnNames.join(', ') : '*';
    const sql = `SELECT ${columnList} FROM dataset WHERE dataset_id = :datasetId LIMIT 100`;
    return { sql, columns: columnNames };
  }
}
