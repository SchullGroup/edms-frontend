import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/apis/services/auth.service';
import { useUIStore } from '@/store/useUIStore';
import { userKeys } from '@/apis/hooks/useUsers';

export const authKeys = {
  me: ['auth', 'me'] as const,
  mfaSettings: ['auth', 'mfa', 'settings'] as const,
};

/** `GET /auth/me`, fresh. */
export function useMe() {
  return useQuery({ queryKey: authKeys.me, queryFn: authService.me });
}

/** `GET /auth/mfa/settings`: on/off, the current method and which methods the server offers. */
export function useMfaSettings() {
  return useQuery({ queryKey: authKeys.mfaSettings, queryFn: authService.getMfaSettings });
}

/** `DELETE /auth/mfa/users/:userId` (global `user:edit`). */
export function useResetUserMfa() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();
  return useMutation({
    mutationFn: (user: { id: string; name: string; mfaRequired?: boolean }) =>
      authService.resetUserMfa(user.id),
    onSuccess: (_data, user) => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      addToast(
        user.mfaRequired
          ? `Two-step sign-in reset for ${user.name}. They'll set it up again at their next sign-in.`
          : `Two-step sign-in reset for ${user.name}. They'll need only their password.`,
        'success',
      );
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to reset two-step sign-in', 'error');
    },
  });
}
