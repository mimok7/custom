const TIMEZONE_SUFFIX_RE = /[zZ]$|[+-]\d{2}:?\d{2}$/;

type DateTimeLike = string | null | undefined;

function hasTimezone(value: string): boolean {
  return TIMEZONE_SUFFIX_RE.test(value);
}

/** DB/서버 값 → input[type=datetime-local] value (KST) */
export function toInputDateTime(value?: DateTimeLike): string {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  if (!hasTimezone(raw)) {
    return raw.replace(' ', 'T').slice(0, 16);
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw.replace(' ', 'T').slice(0, 16);
  }

  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);

  const pick = (type: string) =>
    parts.find((p) => p.type === type)?.value || '';
  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}`;
}

/** input 값 → DB 저장용 (KST timezone suffix) */
export function toDbDateTimeKst(value?: DateTimeLike): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = raw.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
    return `${normalized}:00+09:00`;
  }
  return normalized;
}

/** DB 값 → 한국어 표시용 (예: 2026년 4월 12일 (토) 오후 3:00) */
export function formatKst(
  value?: DateTimeLike,
  includeWeekday = true,
): string {
  if (!value) return '-';
  const raw = String(value).trim();
  if (!raw) return '-';

  let parsedValue = raw;
  if (!hasTimezone(raw)) {
    const n = raw.replace(' ', 'T');
    if (/^\d{4}-\d{2}-\d{2}$/.test(n)) {
      parsedValue = `${n}T00:00:00+09:00`;
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(n)) {
      parsedValue = `${n}:00+09:00`;
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(n)) {
      parsedValue = `${n}+09:00`;
    } else {
      return raw;
    }
  }

  const date = new Date(parsedValue);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...(includeWeekday ? { weekday: 'short' } : {}),
  });
}
