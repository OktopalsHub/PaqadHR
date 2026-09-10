import { Injectable, Logger } from '@nestjs/common';
/**
 * @deprecated SECURITY.md §3 — Do not rely on blocklist checks as primary SQL injection defense.
 * Real protection is TypeORM parameterized queries (createQueryBuilder ... where :tenantId).
 * This service is kept for audit logging only; use ESLint rule `no-string-interpolation-in-query` instead.
 * L-1: Blocklist is not a guarantee — will be removed in next major.
 */
@Injectable()
export class QuerySecurityService {
  private readonly logger = new Logger(QuerySecurityService.name);
  validateQueryParameters(params: Record<string, unknown>): boolean {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        // L-1: Heuristic only — parameterized queries are the actual defense
        if (value.includes('SELECT') || value.includes('DROP') || value.includes('--')) {
          this.logger.warn(`Suspicious parameter detected (heuristic, not blocking): ${key}`);
          // Do not block — return true to avoid false positives; rely on param queries
        }
      }
    }
    return true;
  }
  validateQueryBuilder(query: string, parameters: unknown[] = []): boolean {
    const hasPlaceholders = query.includes('$1') || query.includes('?') || query.includes(':');
    const hasParameters = parameters.length > 0;
    if (hasPlaceholders && !hasParameters) {
      this.logger.warn('Query has placeholders but no parameters provided');
      return false;
    }
    if (
      query.toUpperCase().includes('DROP TABLE') ||
      query.toUpperCase().includes('TRUNCATE TABLE')
    ) {
      this.logger.error('Dangerous SQL operation detected (heuristic)');
      return false;
    }
    return true;
  }
  getAuditStatistics(): {
    totalQueriesAudited: number;
    suspiciousPatterns: number;
    topSuspiciousQueries: Array<{ hash: string; count: number }>;
  } {
    return {
      totalQueriesAudited: 0,
      suspiciousPatterns: 0,
      topSuspiciousQueries: [],
    };
  }
  clearAuditData(): void {}
}
