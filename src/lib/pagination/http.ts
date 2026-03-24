import type { PaginatedResponse } from "@/lib/pagination/types";

export async function fetchPaginatedJson<T, M = Record<string, never>>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<PaginatedResponse<T, M>> {
  const response = await fetch(input, init);

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as PaginatedResponse<T, M>;
}

