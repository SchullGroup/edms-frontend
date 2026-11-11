import Cookies from 'js-cookie';
import { apiClient } from '@/lib/api-client';
import { ApiResponse } from '@/types/models';

/** `POST /document-views`: a view session, opened when someone opens a document. */
export interface DocumentViewSession {
  sessionId: string;
  documentId: string;
  startedAt: string;
}

/** One viewer's row in `GET /document-views/report`, longest total time first. */
export interface DocumentViewer {
  userId: string;
  sessions: number;
  totalSeconds: number;
  lastViewedAt: string | null;
  user: { id: string; name: string; email: string } | null;
}

export interface DocumentViewReport {
  documentId: string;
  uniqueViewers: number;
  totalSeconds: number;
  viewers: DocumentViewer[];
}

/** ISO instants; `to` is exclusive and filters on when each session started. */
export interface DocumentViewReportRange {
  from?: string;
  to?: string;
}

export const documentViewsService = {
  start: async (documentId: string): Promise<DocumentViewSession> => {
    const response = await apiClient.post<ApiResponse<DocumentViewSession>>('/document-views', {
      documentId,
    });
    return response.data.data;
  },

  /** Credits the time since the last beat, capped at 90 s by the API. */
  heartbeat: async (sessionId: string): Promise<void> => {
    await apiClient.post(`/document-views/${sessionId}/heartbeat`);
  },

  /** A last beat that survives the tab closing; `sendBeacon` can't carry the bearer. */
  finalHeartbeat: (sessionId: string): void => {
    const token = Cookies.get('accessToken');
    if (!token) return;
    fetch(`${apiClient.defaults.baseURL}/document-views/${sessionId}/heartbeat`, {
      method: 'POST',
      keepalive: true,
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  },

  /** Needs `audit:view`. */
  report: async (
    documentId: string,
    range: DocumentViewReportRange = {},
  ): Promise<DocumentViewReport> => {
    const response = await apiClient.get<ApiResponse<DocumentViewReport>>(
      '/document-views/report',
      {
        params: { documentId, ...range },
      },
    );
    return response.data.data;
  },
};
