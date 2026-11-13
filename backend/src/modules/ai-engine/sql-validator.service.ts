import { Injectable } from '@nestjs/common';

export interface SqlValidationResult {
  valid: boolean;
  reason?: string;
}

@Injectable()
export class SqlValidationService {
  validate(sql: string): SqlValidationResult {
    const trimmed = (sql ?? '').trim().replace(/;+\s*$/, '');
    const forbiddenPattern =
      /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|ATTACH|DETACH|PRAGMA|COPY|REPLACE|EXECUTE|CALL|VACUUM|REINDEX|LOAD|SAVEPOINT|RELEASE|SET|USE|GRANT)\b/i;
    if (forbiddenPattern.test(trimmed)) {
      return { valid: false, reason: 'Statement type is not allowed' };
    }
    if (!/^\s*SELECT\b/i.test(trimmed)) {
      return { valid: false, reason: 'Only SELECT statements are allowed' };
    }
    if (trimmed.length > 2000) {
      return { valid: false, reason: 'Query exceeds maximum length' };
    }
    return { valid: true };
  }
}
