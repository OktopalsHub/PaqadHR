import type { IPaginatedData, IPaginationOption } from '../interfaces/pagination.interface';

export const PAGINATION_DEFAULT_LIMIT = 10;
export const PAGINATION_MAX_LIMIT = 100;

export function normalizePaginationLimit(limit?: string | number): number {
  const parsed = parseInt(String(limit), 10);
  if (!parsed || parsed < 1) return PAGINATION_DEFAULT_LIMIT;
  return Math.min(parsed, PAGINATION_MAX_LIMIT);
}

export async function getPaginationSummary<T>(
  records: T[],
  totalItems: number,
  options: IPaginationOption,
  name?: string,
): Promise<IPaginatedData<T>> {
  const limit = normalizePaginationLimit(options.limit);
  const page = Math.max(parseInt(String(options.page), 10) || 1, 1);
  const pageCount = Math.ceil(totalItems / limit) || 1;

  return {
    name: name || 'Unknown',
    size: records.length,
    limit,
    pageCount,
    page,
    previousPage: page > 1 ? Math.min(page - 1, pageCount) : null,
    nextPage: page < pageCount ? page + 1 : null,
    totalItems,
    records,
  };
}

export class PaginationUtil {
  static async toPaginatedData<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
    name: string = 'records',
  ): Promise<IPaginatedData<T>> {
    const options: IPaginationOption = { page, limit };
    return getPaginationSummary(data, total, options, name);
  }

  static async fromRepositoryResult<T>(
    result: {
      data: T[];
      total: number;
      page: number;
      limit: number;
      totalPages?: number;
    },
    name: string = 'records',
  ): Promise<IPaginatedData<T>> {
    const options: IPaginationOption = {
      page: result.page,
      limit: result.limit,
    };
    return getPaginationSummary(result.data, result.total, options, name);
  }

  static parsePaginationOptions(query: object): { page: number; limit: number } {
    const q = query as Record<string, unknown>;
    const page = parseInt(String(q.page ?? ''), 10) || 1;
    const limit = normalizePaginationLimit(q.limit as string | number | undefined);
    return { page, limit };
  }

  static parsePaginationOptionsWithTenantSettings(
    query: object,
    tenantSettings?: { general?: { paginationLimit?: number } },
  ): { page: number; limit: number } {
    const q = query as Record<string, unknown>;
    const tenantDefault = tenantSettings?.general?.paginationLimit ?? PAGINATION_DEFAULT_LIMIT;
    const page = parseInt(String(q.page ?? ''), 10) || 1;
    const limit = normalizePaginationLimit(
      q.limit !== undefined && q.limit !== null ? (q.limit as string | number) : tenantDefault,
    );
    return { page, limit };
  }
}
