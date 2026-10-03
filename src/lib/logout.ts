import type { QueryClient } from '@tanstack/react-query';
import type { useRouter } from 'next/navigation';
import { authService } from '@/apis/services/auth.service';
import { useStore } from '@/store/useStore';

/**
 * The one full teardown sequence — extracted from `Sidebar`'s "Sign out"
 * handler so `SessionExpiredModal` does exactly the same thing, not a
 * partial version of it. `authService.logout()` clears the `accessToken`
 * cookie synchronously and fires the backend revoke call in the background;
 * we don't wait for it before finishing the rest of the teardown.
 */
export function performLogout(
  queryClient: QueryClient,
  router: ReturnType<typeof useRouter>,
): void {
  authService.logout();
  queryClient.clear();
  useStore.getState().setCurrentUser(null);
  router.replace('/');
}
