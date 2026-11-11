import { useQuery } from '@tanstack/react-query';
import {
  documentViewsService,
  type DocumentViewReportRange,
} from '@/apis/services/documentViews.service';

export const documentViewKeys = {
  all: ['document-views'] as const,
  report: (documentId: string, range: DocumentViewReportRange) =>
    [...documentViewKeys.all, 'report', documentId, range] as const,
};

/** `GET /document-views/report`: time spent on a document, per viewer. Needs `audit:view`. */
export function useDocumentViewReport(
  documentId: string,
  range: DocumentViewReportRange = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: documentViewKeys.report(documentId, range),
    queryFn: () => documentViewsService.report(documentId, range),
    enabled: !!documentId && (options?.enabled ?? true),
  });
}
