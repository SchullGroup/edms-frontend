import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/apis/services/auth.service';
import { useUIStore } from '@/store/useUIStore';

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

/** After any change to the user's two-step sign-in. */
function useRefetchMfa() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: authKeys.me });
    queryClient.invalidateQueries({ queryKey: authKeys.mfaSettings });
  };
}

// The enrolment mutations leave errors to the page, which shows them inline.
export function useSetupMfa() {
  return useMutation({ mutationFn: authService.setupMfa });
}

export function useEnableMfa() {
  const refetch = useRefetchMfa();
  return useMutation({ mutationFn: authService.enableMfa, onSuccess: refetch });
}

export function useStartEmailMfa() {
  return useMutation({ mutationFn: authService.startEmailMfa });
}

export function useEnableEmailMfa() {
  const refetch = useRefetchMfa();
  return useMutation({ mutationFn: authService.enableEmailMfa, onSuccess: refetch });
}

export function useRequestCurrentMethodOtp() {
  return useMutation({ mutationFn: authService.requestCurrentMethodOtp });
}

export function useStartMfaMethodChange() {
  return useMutation({ mutationFn: authService.startMfaMethodChange });
}

export function useRequestNewMethodOtp() {
  return useMutation({ mutationFn: authService.requestNewMethodOtp });
}

export function useConfirmMfaMethodChange() {
  const refetch = useRefetchMfa();
  return useMutation({ mutationFn: authService.confirmMfaMethodChange, onSuccess: refetch });
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
