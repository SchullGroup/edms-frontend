import { useEffect } from 'react';
import { documentViewsService } from '@/apis/services/documentViews.service';

/** The API credits at most 90 s per beat, so 30 s leaves room for a slow request. */
const HEARTBEAT_MS = 30_000;
/** Skips React strict mode's throwaway mount and quick click-throughs. */
const START_DELAY_MS = 1_000;
/** Back within this, the session resumes; a longer absence starts a new one, so it isn't credited. */
const RESUME_WINDOW_MS = 10_000;

/** Records how long the document is open and visible (`/document-views`). Never shows errors. */
export function useDocumentViewSession(documentId: string | null | undefined) {
  useEffect(() => {
    if (!documentId) return;

    let active = true;
    let sessionId: string | null = null;
    let starting = false;
    let hiddenAt: number | null = null;
    let startTimer: ReturnType<typeof setTimeout> | undefined;
    let beatTimer: ReturnType<typeof setInterval> | undefined;

    const beat = () => {
      if (sessionId) documentViewsService.heartbeat(sessionId).catch(() => {});
    };

    const start = () => {
      if (starting) return;
      starting = true;
      sessionId = null;
      documentViewsService
        .start(documentId)
        .then((session) => {
          if (active) sessionId = session.sessionId;
        })
        .catch(() => {})
        .finally(() => {
          starting = false;
        });
    };

    const run = (fresh: boolean) => {
      clearTimeout(startTimer);
      if (fresh) startTimer = setTimeout(start, START_DELAY_MS);
      clearInterval(beatTimer);
      beatTimer = setInterval(beat, HEARTBEAT_MS);
    };

    const pause = () => {
      clearTimeout(startTimer);
      clearInterval(beatTimer);
      if (sessionId) documentViewsService.finalHeartbeat(sessionId);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        pause();
        return;
      }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      run((!sessionId && !starting) || away > RESUME_WINDOW_MS);
    };

    if (document.visibilityState === 'visible') run(true);
    else hiddenAt = Date.now();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (document.visibilityState === 'visible') pause();
      else {
        clearTimeout(startTimer);
        clearInterval(beatTimer);
      }
    };
  }, [documentId]);
}
