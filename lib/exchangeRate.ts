import type { ExchangeRate } from './types';

/**
 * 서버 DB에 저장된 관리자 설정 환율을 조회합니다.
 * rate_to_krw = 100 VND 당 KRW (관리자 입력값)
 * 변환 공식: KRW = VND × rate_to_krw × 0.01
 */
export async function getExchangeRate(
  currency = 'VND',
): Promise<ExchangeRate | null> {
  try {
    if (typeof window === 'undefined') return null;
    const resp = await fetch(
      `/api/exchange-rate?currency=${encodeURIComponent(currency)}`,
    );
    if (!resp.ok) return null;
    const json = await resp.json();
    if (!json?.success || !json.data) return null;

    const d = json.data;
    const rateNum = Number(d.rate_to_krw || 0);
    return {
      currency_code: d.currency_code || currency,
      rate_to_krw: isFinite(rateNum) ? rateNum : 0,
      last_updated: d.last_updated || new Date().toISOString(),
      source: d.source || 'db',
    };
  } catch (e) {
    console.error('getExchangeRate failed', e);
    return null;
  }
}

/** VND → KRW 변환 (100원 단위 반올림) */
export function vndToKrw(vnd: number, rateToKrw: number): number {
  const raw = vnd * rateToKrw * 0.01;
  return Math.round(raw / 100) * 100;
}

/** KRW → VND 역변환 */
export function krwToVnd(krw: number, rateToKrw: number): number {
  if (rateToKrw === 0) return 0;
  return Math.round(krw / (rateToKrw * 0.01));
}
