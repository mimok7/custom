import supabase from './supabase';

function extractUserFromStoredValue(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    const candidates = [
      parsed,
      parsed?.currentSession,
      parsed?.session,
      parsed?.data?.session,
      parsed?.value?.session,
      parsed?.value,
    ];
    for (const candidate of candidates) {
      const user = candidate?.user;
      if (user?.id) return user as Record<string, unknown>;
    }
  } catch {
    // ignore malformed storage
  }
  return null;
}

function getStoredSessionUser(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const authCache = sessionStorage.getItem('app:auth:cache');
    if (authCache) {
      const parsed = JSON.parse(authCache);
      if (parsed?.user?.id) return parsed.user as Record<string, unknown>;
    }
  } catch {
    // ignore
  }
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const user = extractUserFromStoredValue(raw);
      if (user?.id) return user;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * 현재 로그인된 사용자 조회.
 *
 * 핵심:
 *  - supabase.auth.getSession()은 로컬 캐시만 읽음 → 네트워크/타임아웃 불필요
 *  - 실패 시 sessionStorage / localStorage 백업에서 복구 시도
 *  - timeoutMs 인자는 하위 호환을 위해 유지하지만 실제 사용하지 않음
 */
export async function getSessionUser(
  _timeoutMs?: number,
): Promise<{ user: Record<string, unknown> | null; error: unknown }> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (session?.user) {
      return { user: session.user as Record<string, unknown>, error: null };
    }
    const fallbackUser = getStoredSessionUser();
    if (fallbackUser) return { user: fallbackUser, error: null };
    return { user: null, error };
  } catch (err) {
    const fallbackUser = getStoredSessionUser();
    if (fallbackUser) return { user: fallbackUser, error: null };
    return { user: null, error: err };
  }
}

/**
 * 폼 제출 직전 호출. Supabase autoRefreshToken이 백그라운드에서 토큰을
 * 갱신하므로 단순히 현재 세션 사용자를 반환만 한다.
 * (이전엔 5분 미만 만료 시 강제 refreshSession을 호출했으나 중복 갱신/
 *  네트워크 지연으로 오히려 제출이 실패하는 경우가 있어 단순화)
 */
export async function refreshAuthBeforeSubmit(
  _timeoutMs?: number,
): Promise<{ user: Record<string, unknown> | null; error?: unknown }> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (session?.user) return { user: session.user as Record<string, unknown>, error: null };
    const fallbackUser = getStoredSessionUser();
    if (fallbackUser) return { user: fallbackUser, error: null };
    return { user: null, error: error || new Error('No active session') };
  } catch (err) {
    const fallbackUser = getStoredSessionUser();
    if (fallbackUser) return { user: fallbackUser, error: null };
    return { user: null, error: err };
  }
}

/** Invalid Refresh Token 감지 */
export function isInvalidRefreshTokenError(error: unknown): boolean {
  const message =
    (error as { message?: string } | null)?.message ||
    (typeof error === 'string' ? error : '');
  return /Invalid Refresh Token|Refresh Token Not Found|refresh token/i.test(message);
}

/** 무효 세션 정리 (로컬스토리지에서 Supabase 토큰 삭제) */
export async function clearInvalidSession(): Promise<void> {
  try {
    await (supabase.auth as unknown as { signOut: (opts: { scope: string }) => Promise<void> }).signOut({ scope: 'local' });
  } catch {
    try {
      await supabase.auth.signOut();
    } catch {
      // no-op
    }
  }
  if (typeof window === 'undefined') return;
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // no-op
  }
}
