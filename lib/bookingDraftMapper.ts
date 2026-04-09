export type DraftServiceType = 'cruise' | 'airport' | 'hotel' | 'rentcar' | 'tour';

export interface DraftEnvelope<T = unknown> {
  quoteId: string;
  userId: string;
  serviceType: DraftServiceType;
  payload: T;
  updatedAt: string;
}

export interface ReservationInsert {
  re_user_id: string;
  re_quote_id: string;
  re_type: DraftServiceType;
  re_status: 'pending';
  re_created_at?: string;
}

export function buildReservationInsert(envelope: DraftEnvelope): ReservationInsert {
  return {
    re_user_id: envelope.userId,
    re_quote_id: envelope.quoteId,
    re_type: envelope.serviceType,
    re_status: 'pending',
    re_created_at: new Date().toISOString(),
  };
}

export function getDraftStorageKey(quoteId: string, serviceType: DraftServiceType): string {
  return `direct_booking_draft:${quoteId}:${serviceType}`;
}
