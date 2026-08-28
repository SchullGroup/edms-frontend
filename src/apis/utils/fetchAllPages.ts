import { PaginatedResponse } from '@/types/models';

const MAX_PAGE_LIMIT = 100; // the backend rejects limit > 100

/**
 * INTERIM STOPGAP — not a substitute for real server-side aggregation.
 *
 * Walks every page of a paginated list endpoint and concatenates the results,
 * because the backend has no aggregation/reporting endpoints yet (see the
 * management-role API gap analysis handed to the backend dev). This exists
 * only so the management dashboards can compute department/month rollups
 * client-side against *today's* small dataset.
 *
 * It does not scale: an org with thousands of documents means dozens of
 * sequential requests here, reconstructing in the browser what a single
 * SQL aggregate query would do on the server. Replace call sites with real
 * aggregation endpoints once the backend adds them, and delete this file.
 */
export async function fetchAllPages<T, P extends Record<string, any>>(
  fetchPage: (params: P & { page?: number; limit?: number }) => Promise<PaginatedResponse<T>>,
  baseParams: P,
  maxPages = 50, // circuit breaker against a runaway loop, not a real data cap
): Promise<T[]> {
  const first = await fetchPage({ ...baseParams, page: 1, limit: MAX_PAGE_LIMIT });
  const all = [...first.data];
  const totalPages = first.pagination?.totalPages ?? 1;

  for (let page = 2; page <= Math.min(totalPages, maxPages); page++) {
    const next = await fetchPage({ ...baseParams, page, limit: MAX_PAGE_LIMIT });
    all.push(...next.data);
  }

  return all;
}
