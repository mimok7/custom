import supabase from '@/lib/supabase';
import { getSessionUser } from '@/lib/authHelpers';

interface FastAuthResult {
  user: Record<string, unknown> | null;
  error: unknown;
}

export async function getFastAuthUser(timeoutMs = 5000): Promise<FastAuthResult> {
  const { user, error } = await getSessionUser(timeoutMs);
  return {
    user: user ?? null,
    error: error ?? null,
  };
}

export async function ensureMemberRole(user: Record<string, unknown> | null): Promise<string | null> {
  if (!user?.id) return '로그인 사용자 정보가 없습니다.';

  const userId = String(user.id);
  const userEmail = user.email ? String(user.email) : null;
  const now = new Date().toISOString();

  const { data: existingUser, error: fetchError } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle();

  if (fetchError) {
    return `사용자 역할 조회 실패: ${fetchError.message}`;
  }

  if (!existingUser || existingUser.role === 'guest') {
    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          id: userId,
          email: userEmail,
          role: 'member',
          updated_at: now,
        },
        { onConflict: 'id' },
      );

    if (upsertError) {
      return `사용자 역할 업데이트 실패: ${upsertError.message}`;
    }
  }

  return null;
}

export async function getFastAuthUserWithMemberRole(timeoutMs = 5000): Promise<FastAuthResult> {
  const { user, error } = await getFastAuthUser(timeoutMs);
  if (error || !user) {
    return {
      user: null,
      error: error ?? new Error('인증 사용자 없음'),
    };
  }

  const ensureError = await ensureMemberRole(user);
  if (ensureError) {
    return {
      user: null,
      error: new Error(ensureError),
    };
  }

  return { user, error: null };
}
