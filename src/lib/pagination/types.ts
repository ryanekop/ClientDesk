export type PaginatedQueryState = {
  page: number;
  perPage: number;
  totalItems: number;
  isLoading: boolean;
  isRefreshing: boolean;
};

export type PaginatedResponse<T, M = Record<string, never>> = {
  items: T[];
  totalItems: number;
  metadata?: M;
};

