export type IPaginatedData<T = any> = {
  name: string;
  size: number;
  pageCount: number;
  limit: number;
  page: number;
  previousPage: number | null;
  nextPage: number | null;
  totalItems: number;
  records: T[];
};
export type IPaginationOption = {
  page: string | number;
  limit?: string | number;
};
