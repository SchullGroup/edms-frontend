import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/apis/services/auth.service';
import { useUIStore } from '@/store/useUIStore';

export const authKeys = {
  me: ['auth', 'me'] as const,
};

/** `GET /auth/me`, fresh: the only source of `mfaEnabled`. */
export function useMe() {
  return useQuery({ queryKey: authKeys.me, queryFn: authService.me });
}

// The enrolment mutations leave errors to the page, which shows them inline.
export function useSetupMfa() {
  return useMutation({ mutationFn: authService.setupMfa });
}

export function useEnableMfa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authService.enableMfa,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.me }),
  });
}

export function useDisableMfa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authService.disableMfa,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.me }),
  });
}

/** `DELETE /auth/mfa/users/:userId` (`user:edit`). */
export function useResetUserMfa() {
  const { addToast } = useUIStore.getState();
  return useMutation({
    mutationFn: (user: { id: string; name: string }) => authService.resetUserMfa(user.id),
    onSuccess: (_data, user) =>
      addToast(`Two-step sign-in reset for ${user.name}. They'll need only their password.`, 'success'),
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to reset two-step sign-in', 'error');
    },
  });
}
