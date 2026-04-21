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
    // 역할 조회 실패는 예약 생성을 막지 않는다. 실제 insert 단계에서 FK/권한 오류를 노출한다.
    console.warn('사용자 역할 조회 실패(예약 계속 진행):', fetchError.message);
    return null;
  }

  if (!existingUser || existingUser.role === 'guest') {
    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          id: userId,
          email: userEmail,
          role: 'member',
          created_at: now,
          status: 'active',
          updated_at: now,
        },
        { onConflict: 'id' },
      );

    if (upsertError) {
      if (existingUser) {
        // 기존 사용자의 role 승급 실패는 치명적이지 않다.
        console.warn('사용자 role 승급 실패(예약 계속 진행):', upsertError.message);
        return null;
      }
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
