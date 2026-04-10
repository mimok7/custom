import supabase from '@/lib/supabase';
import type { DraftEnvelope } from '@/lib/bookingDraftMapper';
import { buildReservationInsert } from '@/lib/bookingDraftMapper';

export interface SubmitAllResult {
  created: number;
  errors: string[];
}

async function ensureReservationSubmitUser(): Promise<string | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return '로그인 세션 확인에 실패했습니다.';
  }

  const authUser = authData.user;
  const now = new Date().toISOString();

  const { data: existingUser, error: existingUserError } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', authUser.id)
    .maybeSingle();

  if (existingUserError) {
    return `사용자 정보 확인 실패: ${existingUserError.message}`;
  }

  if (!existingUser) {
    const { error: insertUserError } = await supabase
      .from('users')
      .insert({
        id: authUser.id,
        email: authUser.email,
        role: 'member',
        created_at: now,
        updated_at: now,
      });

    if (insertUserError) {
      return `사용자 등록 실패: ${insertUserError.message}`;
    }

    return null;
  }

  if (!existingUser.role || existingUser.role === 'guest') {
    const { error: updateUserError } = await supabase
      .from('users')
      .update({
        role: 'member',
        updated_at: now,
      })
      .eq('id', authUser.id);

    if (updateUserError) {
      return `사용자 권한 갱신 실패: ${updateUserError.message}`;
    }
  }

  return null;
}

// Phase-1 안전버전: draft envelope 목록을 reservation 메인행으로만 저장한다.
// 서비스 상세 테이블 저장은 단계적 전환 시 이 함수에 추가한다.
export async function submitAllDraftReservations(envelopes: DraftEnvelope[]): Promise<SubmitAllResult> {
  const errors: string[] = [];
  let created = 0;

  const ensureUserError = await ensureReservationSubmitUser();
  if (ensureUserError) {
    return { created, errors: [ensureUserError] };
  }

  for (const envelope of envelopes) {
    const { error } = await supabase
      .from('reservation')
      .insert(buildReservationInsert(envelope));

    if (error) {
      errors.push(`${envelope.serviceType}: ${error.message}`);
      continue;
    }

    created += 1;
  }

  return { created, errors };
}
