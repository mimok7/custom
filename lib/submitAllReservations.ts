import supabase from '@/lib/supabase';
import type { DraftEnvelope } from '@/lib/bookingDraftMapper';
import { buildReservationInsert } from '@/lib/bookingDraftMapper';

export interface SubmitAllResult {
  created: number;
  errors: string[];
}

// Phase-1 안전버전: draft envelope 목록을 reservation 메인행으로만 저장한다.
// 서비스 상세 테이블 저장은 단계적 전환 시 이 함수에 추가한다.
export async function submitAllDraftReservations(envelopes: DraftEnvelope[]): Promise<SubmitAllResult> {
  const errors: string[] = [];
  let created = 0;

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
