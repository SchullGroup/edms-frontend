'use client';

import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useState } from 'react';
import { useUIStore } from '@/store/useUIStore';

// How many consecutive infrastructure-level query failures — across *any*
// query, not one specific endpoint — before we stop showing N separate
// broken widgets and show one clear "service unavailable" message instead
// (`ServiceUnavailableOverlay`). Deliberately not counting ordinary 4xx
// errors (403/404/422…) here: those are a working backend saying "no", which
// each query's own error state already handles — only "the backend didn't
// answer at all, or answered with a 5xx" counts as evidence it's actually down.
const INFRA_FAILURE_THRESHOLD = 3;

function isInfrastructureFailure(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | undefined)?.response?.status;
  return status === undefined || status >= 500;
}

export default function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    let consecutiveInfraFailures = 0;

    return new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000, // 1 minute
          refetchOnWindowFocus: false,
          retry: 1,
        },
      },
      queryCache: new QueryCache({
        onError: (error) => {
          if (!isInfrastructureFailure(error)) return;
          consecutiveInfraFailures += 1;
          if (consecutiveInfraFailures >= INFRA_FAILURE_THRESHOLD) {
            useUIStore.getState().setServiceUnavailable(true);
          }
        },
        onSuccess: () => {
          if (consecutiveInfraFailures === 0) return;
          consecutiveInfraFailures = 0;
          useUIStore.getState().setServiceUnavailable(false);
        },
      }),
    });
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
