import supabase from './supabase';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    }),
  ]);
}

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

let sessionUserPromise: Promise<{ user: Record<string, unknown> | null; error: unknown }> | null = null;
let refreshSessionPromise: Promise<{ user: Record<string, unknown> | null; error?: unknown }> | null = null;

/** 로컬 세션에서 사용자 조회 (네트워크 타임아웃 10초) */
export async function getSessionUser(
  timeoutMs = 10000,
): Promise<{ user: Record<string, unknown> | null; error: unknown }> {
  if (!sessionUserPromise) {
    sessionUserPromise = (async () => {
      try {
        const { data: { session }, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          timeoutMs,
          `Auth session check timed out (${timeoutMs}ms)`,
        );

        if (sessionError) {
          const fallbackUser = getStoredSessionUser();
          if (fallbackUser) {
            return { user: fallbackUser, error: null };
          }
          return { user: null, error: sessionError };
        }

        if (session?.user) {
          return { user: session.user as Record<string, unknown>, error: null };
        }

        const userResult = await withTimeout(
          supabase.auth.getUser(),
          timeoutMs,
          `Auth user check timed out (${timeoutMs}ms)`,
        );

        if (userResult.error) {
          const fallbackUser = getStoredSessionUser();
          if (fallbackUser) {
            return { user: fallbackUser, error: null };
          }
        }

        return {
          user: userResult.data.user as Record<string, unknown> | null,
          error: userResult.error,
        };
      } catch (err) {
        const fallbackUser = getStoredSessionUser();
        if (fallbackUser) {
          return { user: fallbackUser, error: null };
        }
        return { user: null, error: err };
      } finally {
        sessionUserPromise = null;
      }
    })();
  }

  try {
    return await withTimeout(
      sessionUserPromise,
      timeoutMs,
      `Auth session check timed out (${timeoutMs}ms)`,
    );
  } catch (err) {
    const fallbackUser = getStoredSessionUser();
    if (fallbackUser) {
      return { user: fallbackUser, error: null };
    }
    return { user: null, error: err };
  }
}

/** 토큰 만료 임박 시 세션 갱신 (제출 직전 호출) */
export async function refreshAuthBeforeSubmit(
  timeoutMs = 8000,
): Promise<{ user: Record<string, unknown> | null; error?: unknown }> {
  if (!refreshSessionPromise) {
    refreshSessionPromise = (async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error || !session) {
          return { user: null, error: error || new Error('No active session') };
        }

        const expiresAt = session.expires_at;
        const now = Math.floor(Date.now() / 1000);

        if (expiresAt && expiresAt - now < 300) {
          const result = await supabase.auth.refreshSession();
          if (result.error || !result.data.session) {
            return { user: null, error: result.error || new Error('Session refresh failed') };
          }
          return { user: result.data.session.user as Record<string, unknown>, error: null };
        }

        return { user: session.user as Record<string, unknown>, error: null };
      } catch (err) {
        return { user: null, error: err };
      } finally {
        refreshSessionPromise = null;
      }
    })();
  }

  return withTimeout(
    refreshSessionPromise,
    timeoutMs,
    'Session refresh timed out',
  );
}

/** Invalid Refresh Token 감지 */
export function isInvalidRefreshTokenError(error: unknown): boolean {
  const message =
    (error as { message?: string } | null)?.message ||
    (typeof error === 'string' ? error : '');
  return /Invalid Refresh Token|Refresh Token Not Found|refresh token/i.test(
    message,
  );
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
