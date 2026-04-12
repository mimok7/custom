import supabase from './supabase';

/** 로컬 세션에서 사용자 조회 (네트워크 타임아웃 10초) */
export async function getSessionUser(
  timeoutMs = 10000,
): Promise<{ user: Record<string, unknown> | null; error: unknown }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) return { user: session.user, error: null };

    return await Promise.race<{
      user: Record<string, unknown> | null;
      error: unknown;
    }>([
      supabase.auth
        .getUser()
        .then((r) => ({ user: r.data.user as Record<string, unknown> | null, error: r.error })),
      new Promise((resolve) =>
        setTimeout(
          () => resolve({ user: null, error: new Error('Auth check timed out') }),
          timeoutMs,
        ),
      ),
    ]);
  } catch (err) {
    return { user: null, error: err };
  }
}

/** 토큰 만료 임박 시 세션 갱신 (제출 직전 호출) */
export async function refreshAuthBeforeSubmit(
  timeoutMs = 8000,
): Promise<{ user: Record<string, unknown> | null; error?: unknown }> {
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
      try {
        const result = await Promise.race([
          supabase.auth.refreshSession(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('Session refresh timed out')),
              timeoutMs,
            ),
          ),
        ]);
        if (result.error || !result.data.session) {
          return {
            user: null,
            error: result.error || new Error('Session refresh failed'),
          };
        }
        return { user: result.data.session.user as Record<string, unknown>, error: null };
      } catch (refreshErr) {
        return { user: null, error: refreshErr };
      }
    }

    return { user: session.user as Record<string, unknown>, error: null };
  } catch (err) {
    return { user: null, error: err };
  }
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
