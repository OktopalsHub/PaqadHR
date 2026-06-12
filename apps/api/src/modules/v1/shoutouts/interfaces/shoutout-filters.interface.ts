export interface ShoutoutFilters {
  categoryIds?: string[];
  senderId?: string;
  recipientId?: string;
  page: number;
  limit: number;
}
