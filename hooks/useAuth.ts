import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { isInvalidRefreshTokenError, clearInvalidSession } from '@/lib/authHelpers';
import { queryClient } from '@/lib/queryClient';

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

    const check = async () => {
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
            router.push(redirectOnFail);
          }
          return;
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (cancelled) return;

        if (userError || !user) {
          if (userError && isInvalidRefreshTokenError(userError)) {
            await clearInvalidSession();
          }
          setState({ user: null, role: null, loading: false, error: userError as Error | null });
          if (requiredRoles?.length) router.push('/login');
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
          alert('접근 권한이 없습니다.');
          router.push(redirectOnFail);
        }
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
        if (requiredRoles?.length) router.push('/login');
      }
    };

    check();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
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
    });

    return () => {
      cancelled = true;
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
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
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
