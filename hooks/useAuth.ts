import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';

interface AuthState {
  user: Record<string, unknown> | null;
  role: string | null;
  loading: boolean;
  error: Error | null;
}

// 인메모리 + sessionStorage 백업 캐시 (새로고침/탭 복귀 시 깜빡임 방지)
const AUTH_CACHE_KEY = 'app:auth:cache';
let authCache: { user: Record<string, unknown> | null; role: string | null; timestamp: number } | null = null;

function readSessionCache(): { user: Record<string, unknown> | null; role: string | null } | null {
  if (authCache?.user) return { user: authCache.user, role: authCache.role };
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.user) {
      authCache = parsed;
      return { user: parsed.user, role: parsed.role ?? null };
    }
  } catch {
    /* SSR 안전 */
  }
  return null;
}

function writeSessionCache(user: Record<string, unknown> | null, role: string | null = null) {
  authCache = { user, role, timestamp: Date.now() };
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(authCache));
    } else {
      sessionStorage.removeItem(AUTH_CACHE_KEY);
    }
  } catch {
    /* SSR 안전 */
  }
}

/** 잘못된 리프레시 토큰 등으로 세션이 무효화될 때 localStorage sb-* 키 강제 정리 */
function clearSupabaseStorageTokens() {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove = Object.keys(localStorage).filter(
      (k) => k.startsWith('sb-') && (k.endsWith('-auth-token') || k.endsWith('-auth-token-code-verifier'))
    );
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* SSR 안전 */
  }
}

export function primeAuthCache(user: Record<string, unknown> | null, role: string | null = 'guest') {
  writeSessionCache(user, role);
}

export function clearAuthCache() {
  authCache = null;
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(AUTH_CACHE_KEY); } catch { /* SSR 안전 */ }
}

/**
 * 인증/권한 확인 훅 (단순화 버전).
 *
 * 핵심 원칙(인증/세션 최소화):
 *  1) supabase.auth.getSession()은 로컬 캐시만 읽음 → 네트워크 호출 없음
 *  2) onAuthStateChange 리스너로 토큰 갱신/로그아웃 변경을 자동 반영
 *  3) 탭 전환/포커스/온라인 이벤트 별도 재확인 없음 (Supabase autoRefreshToken이 처리)
 *  4) 일시적 오류로 자동 로그아웃 시키지 않음 (캐시된 사용자 유지)
 *  5) watchdog 타임아웃 없음 → 잘못된 false negative 제거
 *
 * @param requiredRoles 필요 역할 배열 (지정 시 역할 미충족이면 redirectOnFail로 이동)
 * @param redirectOnFail 권한 없을 시 리다이렉트 경로
 * @param loginRequired 로그인 필수 여부 (true면 미로그인 시 /login 이동)
 */
export function useAuth(
  requiredRoles?: string[],
  redirectOnFail = '/login',
  loginRequired = false,
) {
  const router = useRouter();
  const cached = typeof window !== 'undefined' ? readSessionCache() : null;
  const [state, setState] = useState<AuthState>({
    user: cached?.user ?? null,
    role: cached?.role ?? null,
    loading: !cached, // 캐시가 있으면 즉시 사용 → 로딩 깜빡임 방지
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchRole = async (userId: string): Promise<string> => {
      try {
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .maybeSingle();
        return ((data?.role as string) || 'guest');
      } catch {
        return 'guest';
      }
    };

    const applyAuth = async (user: Record<string, unknown> | null) => {
      if (cancelled) return;

      if (!user) {
        if (!cached) {
          // 캐시도 없고 세션도 없을 때만 로그인 페이지로 이동
          writeSessionCache(null);
          setState({ user: null, role: null, loading: false, error: null });
          if (loginRequired || requiredRoles?.length) {
            router.replace(redirectOnFail);
          }
        } else {
          // 캐시는 있는데 세션이 잠시 없는 경우 → 캐시 유지 (강제 로그아웃 금지)
          setState((prev) => ({ ...prev, loading: false }));
        }
        return;
      }

      // 사용자 있음 → 역할 조회 (요구된 경우에만)
      let role: string | null = cached?.role ?? null;
      if (requiredRoles?.length || !role) {
        role = await fetchRole(user.id as string);
      }
      if (cancelled) return;

      writeSessionCache(user, role);

      // 권한 검사
      if (requiredRoles?.length && role && !requiredRoles.includes(role)) {
        setState({ user: null, role: null, loading: false, error: null });
        router.replace(redirectOnFail);
        return;
      }

      setState({ user, role, loading: false, error: null });
    };

    const checkOnce = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await applyAuth((session?.user ?? null) as Record<string, unknown> | null);
      } catch (err) {
        if (cancelled) return;
        // Invalid Refresh Token 에러: 즉시 스토리지 정리 후 로그인으로 이동
        const msg = (err as Error)?.message ?? '';
        if (msg.includes('Invalid Refresh Token') || msg.includes('Refresh Token Not Found')) {
          clearSupabaseStorageTokens();
          writeSessionCache(null);
          setState({ user: null, role: null, loading: false, error: null });
          router.replace(redirectOnFail);
          return;
        }
        // 그 외 일시적 오류 → 캐시된 사용자 유지 (강제 로그아웃 금지)
        setState((prev) => ({ ...prev, loading: false, error: err as Error }));
      }
    };

    checkOnce();

    // Supabase auth 상태 변경 리스너 - 토큰 갱신/로그아웃 자동 반영
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'SIGNED_OUT') {
        // 잘못된 리프레시 토큰 포함 모든 Supabase 토큰 강제 정리
        clearSupabaseStorageTokens();
        writeSessionCache(null);
        setState({ user: null, role: null, loading: false, error: null });
        // customer3는 전체 인증 필요 앱 → 항상 로그인 페이지로 이동
        router.replace(redirectOnFail);
        return;
      }
      if (session?.user) {
        // TOKEN_REFRESHED: 사용자 정보만 갱신, 역할은 기존 값 유지
        if (event === 'TOKEN_REFRESHED') {
          writeSessionCache(session.user as Record<string, unknown>, authCache?.role ?? null);
          setState((prev) => ({
            ...prev,
            user: session.user as Record<string, unknown>,
            loading: false,
          }));
          return;
        }
        // SIGNED_IN / USER_UPDATED: 역할 재조회
        void applyAuth(session.user as Record<string, unknown>);
      }
    });

    return () => {
      cancelled = true;
      try { subscription?.unsubscribe?.(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetch = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();
        const role = ((userData?.role as string) || 'guest');
        writeSessionCache(session.user as Record<string, unknown>, role);
        setState({ user: session.user as Record<string, unknown>, role, loading: false, error: null });
      } else {
        writeSessionCache(null);
        setState({ user: null, role: null, loading: false, error: null });
      }
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false, error: err as Error }));
    }
  };

  return {
    ...state,
    isAuthenticated: !!state.user,
    refetch,
  };
}
