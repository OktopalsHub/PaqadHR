import type { IPaginatedData, IPaginationOption } from '../interfaces/pagination.interface';

export const PAGINATION_DEFAULT_LIMIT = 10;
export const PAGINATION_MAX_LIMIT = 100;

export function normalizePaginationLimit(limit?: string | number): number {
  const parsed = parseInt(String(limit), 10);
  if (!parsed || parsed < 1) return PAGINATION_DEFAULT_LIMIT;
  return Math.min(parsed, PAGINATION_MAX_LIMIT);
}

export async function getPaginationSummary(
  records: unknown[],
  totalItems: number,
  options: IPaginationOption,
  name?: string,
): Promise<IPaginatedData> {
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

  
  static parsePaginationOptions(query: Record<string, any>): { page: number; limit: number } {
    const page = parseInt(String(query.page ?? ''), 10) || 1;
    const limit = normalizePaginationLimit(query.limit);
    return { page, limit };
  }

  
  static parsePaginationOptionsWithTenantSettings(
    query: Record<string, any>,
    tenantSettings?: { general?: { paginationLimit?: number } },
  ): { page: number; limit: number } {
    const tenantDefault = tenantSettings?.general?.paginationLimit ?? PAGINATION_DEFAULT_LIMIT;
    const page = parseInt(String(query.page ?? ''), 10) || 1;
    const limit = normalizePaginationLimit(query.limit ?? tenantDefault);
    return { page, limit };
  }
}
