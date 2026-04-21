import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { isInvalidRefreshTokenError, clearInvalidSession, getSessionUser } from '@/lib/authHelpers';
import { queryClient } from '@/lib/queryClient';
import { showToast } from '@/lib/toast';

interface AuthState {
  user: Record<string, unknown> | null;
  role: string | null;
  loading: boolean;
  error: Error | null;
}

// 인메모리 + sessionStorage 이중 캐시
let authCache: {
  user: Record<string, unknown> | null;
  role: string | null;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5분
const AUTH_CACHE_KEY = 'app:auth:cache';

function restoreCache() {
  if (authCache) return;
  try {
    const stored = sessionStorage.getItem(AUTH_CACHE_KEY);
    if (!stored) return;
    const parsed = JSON.parse(stored);
    if (Date.now() - parsed.timestamp < CACHE_DURATION) {
      authCache = parsed;
    } else {
      sessionStorage.removeItem(AUTH_CACHE_KEY);
    }
  } catch {
    /* SSR safe */
  }
}

function persistCache() {
  if (!authCache) return;
  try {
    sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(authCache));
  } catch {
    /* SSR safe */
  }
}

/**
 * 인증 및 권한 확인 훅
 * @param requiredRoles 필요 역할 배열 (예: ['member', 'manager'])
 * @param redirectOnFail 권한 없을 시 리다이렉트 경로
 */
export function useAuth(
  requiredRoles?: string[],
  redirectOnFail = '/login',
  loginRequired = false,
) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let checking = false;

    // 워치독 타이머: 12초 후에도 로딩 중이면 강제 해제 (무한 로딩 방지)
    const watchdogId = setTimeout(() => {
      if (cancelled) return;
      setState((prev) => {
        if (!prev.loading) return prev;
        showToast({
          message: '인증 확인 시간이 초과되었습니다. 페이지를 새로고침해 주세요.',
          type: 'warning',
          duration: 0,
          onRetry: () => window.location.reload(),
        });
        return { ...prev, loading: false, error: new Error('AUTH_LOADING_TIMEOUT') };
      });
    }, 12000);

    const check = async (forceRefresh = false) => {
      if (checking) return;
      checking = true;

      if (forceRefresh) {
        authCache = null;
        try {
          sessionStorage.removeItem(AUTH_CACHE_KEY);
        } catch {
          /* SSR safe */
        }
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: true }));
        }
      }

      try {
        restoreCache();

        const now = Date.now();
        if (authCache && now - authCache.timestamp < CACHE_DURATION) {
          if (!cancelled) {
            setState({
              user: authCache.user,
              role: authCache.role,
              loading: false,
              error: null,
            });
          }
          if (
            requiredRoles &&
            authCache.role &&
            !requiredRoles.includes(authCache.role)
          ) {
            if (!cancelled) {
              setState({ user: null, role: null, loading: false, error: null });
            }
            router.replace(redirectOnFail);
          }
          return;
        }

        const { user, error: userError } = await getSessionUser(12000);
        if (cancelled) return;

        if (userError || !user) {
          if (userError && isInvalidRefreshTokenError(userError)) {
            await clearInvalidSession();
          }
          setState({ user: null, role: null, loading: false, error: userError as Error | null });
          if (requiredRoles?.length || loginRequired) router.replace('/login');
          return;
        }

        const { data: userData, error: roleError } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;

        let userRole = 'guest';
        if (!roleError && userData?.role) {
          userRole = userData.role as string;
        }

        authCache = { user: user as unknown as Record<string, unknown>, role: userRole, timestamp: now };
        persistCache();

        if (!cancelled) {
          setState({ user: user as unknown as Record<string, unknown>, role: userRole, loading: false, error: null });
        }

        if (requiredRoles && !requiredRoles.includes(userRole)) {
          if (!cancelled) {
            setState({ user: null, role: null, loading: false, error: null });
          }
          alert('접근 권한이 없습니다.');
          router.replace(redirectOnFail);
          return;
      } catch (error) {
        if (isInvalidRefreshTokenError(error)) {
          await clearInvalidSession();
        }
        if (!cancelled) {
          setState({
            user: null,
            role: null,
            loading: false,
            error: error as Error,
          });
        }
        if (requiredRoles?.length || loginRequired) router.replace('/login');
      } finally {
        checking = false;
      }
    };

    check();

    const handleFocus = () => {
      void check(true);
    };

    const handleOnline = () => {
      void check(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void check(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === 'SIGNED_OUT') {
          authCache = null;
          try {
            sessionStorage.removeItem(AUTH_CACHE_KEY);
          } catch {
            /* SSR safe */
          }
          queryClient.clear();
          if (!cancelled) {
            setState({ user: null, role: null, loading: false, error: null });
          }
          return;
        }

        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session?.user) {
          authCache = null;
          try {
            sessionStorage.removeItem(AUTH_CACHE_KEY);
          } catch {
            /* SSR safe */
          }
          queryClient.clear();

          const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();

          const userRole = (userData?.role as string) || 'guest';
          authCache = {
            user: session.user as unknown as Record<string, unknown>,
            role: userRole,
            timestamp: Date.now(),
          };
          persistCache();

          if (!cancelled) {
            setState({
              user: session.user as unknown as Record<string, unknown>,
              role: userRole,
              loading: false,
              error: null,
            });
          }
        }
      } catch (error) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: error as Error,
          }));
        }
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(watchdogId);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = async () => {
    authCache = null;
    try {
      sessionStorage.removeItem(AUTH_CACHE_KEY);
    } catch {
      /* SSR safe */
    }
    setState((prev) => ({ ...prev, loading: true }));

    try {
      const { user, error: userError } = await getSessionUser(12000);
      if (userError || !user) {
        if (userError && isInvalidRefreshTokenError(userError)) {
          await clearInvalidSession();
        }
        setState({ user: null, role: null, loading: false, error: userError as Error | null });
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const userRole = (userData?.role as string) || 'guest';
      authCache = { user: user as unknown as Record<string, unknown>, role: userRole, timestamp: Date.now() };
      persistCache();
      setState({ user: user as unknown as Record<string, unknown>, role: userRole, loading: false, error: null });
    } catch (error) {
      if (isInvalidRefreshTokenError(error)) {
        await clearInvalidSession();
      }
      setState({
        user: null,
        role: null,
        loading: false,
        error: error as Error,
      });
    }
  };

  return {
    ...state,
    isAuthenticated: !!state.user,
    isManager: state.role === 'manager' || state.role === 'admin',
    isAdmin: state.role === 'admin',
    isMember: state.role === 'member',
    isGuest: state.role === 'guest',
    refetch,
  };
}

export function clearAuthCache() {
  authCache = null;
  try {
    sessionStorage.removeItem(AUTH_CACHE_KEY);
  } catch {
    /* SSR safe */
  }
}
