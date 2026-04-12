'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageWrapper from '@/components/layout/PageWrapper';
import SectionBox from '@/components/layout/SectionBox';
import Spinner from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import supabase from '@/lib/supabase';
import { formatKst } from '@/lib/kstDateTime';
import { ArrowLeft } from 'lucide-react';

const SERVICE_LABELS: Record<string, string> = {
  cruise: '크루즈', airport: '공항 이동', hotel: '호텔',
  tour: '투어', rentcar: '렌터카', ticket: '티켓', package: '패키지',
};

const STATUS_MAP: Record<string, { bg: string; label: string }> = {
  pending: { bg: 'bg-yellow-50 text-yellow-700', label: '대기중' },
  confirmed: { bg: 'bg-green-50 text-green-700', label: '확정됨' },
  processing: { bg: 'bg-blue-50 text-blue-700', label: '처리중' },
  cancelled: { bg: 'bg-red-50 text-red-700', label: '취소됨' },
  completed: { bg: 'bg-purple-50 text-purple-700', label: '완료' },
};

type DetailRow = Record<string, unknown>;
type Reservation = Record<string, unknown>;

const DETAIL_TABLE: Record<string, string> = {
  cruise: 'reservation_cruise',
  airport: 'reservation_airport',
  hotel: 'reservation_hotel',
  tour: 'reservation_tour',
  rentcar: 'reservation_rentcar',
  ticket: 'reservation_tour',
  package: 'reservation_package',
};

const FIELD_LABELS: Record<string, Record<string, string>> = {
  cruise: {
    room_price_code: '객실 코드', checkin: '체크인', guest_count: '인원',
    adult_count: '성인', child_count: '아동', infant_count: '유아',
    room_count: '객실 수', room_total_price: '총 가격', request_note: '요청사항',
    connecting_room: '커넥팅 룸', birthday_event: '생일 이벤트',
  },
  airport: {
    way_type: '편도/왕복', ra_airport_location: '공항', ra_flight_number: '항공편',
    ra_datetime: '일시', ra_passenger_count: '인원', ra_luggage_count: '수하물',
    accommodation_info: '숙소 정보', unit_price: '단가', total_price: '총 가격',
  },
  hotel: {
    hotel_price_code: '호텔 코드', schedule: '일정', checkin_date: '체크인',
    room_count: '객실 수', guest_count: '인원', unit_price: '단가',
    total_price: '총 가격', request_note: '요청사항',
  },
  tour: {
    tour_price_code: '투어 코드', usage_date: '투어 날짜', tour_capacity: '인원',
    pickup_location: '픽업', dropoff_location: '드롭', unit_price: '단가',
    total_price: '총 가격', request_note: '요청사항',
  },
  rentcar: {
    way_type: '유형', pickup_datetime: '출발 일시', pickup_location: '출발지',
    destination: '목적지', via_location: '경유지', car_count: '대수',
    passenger_count: '인원', unit_price: '단가', total_price: '총 가격',
    request_note: '요청사항',
  },
  ticket: {
    tour_price_code: '티켓 코드', usage_date: '이용 날짜', tour_capacity: '수량',
    pickup_location: '픽업', unit_price: '단가', total_price: '총 가격',
    request_note: '상세',
  },
  package: {
    package_id: '패키지', adult_count: '성인', child_extra_bed: '아동(엑스트라)',
    child_no_extra_bed: '아동(미사용)', infant_free: '유아(무료)',
    total_price: '총 가격', additional_requests: '요청사항',
  },
};

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? '✅ 예' : '❌ 아니오';
  if (typeof value === 'number') {
    if (key.includes('price') || key.includes('total') || key === 'unit_price')
      return `${value.toLocaleString()} VND`;
    return String(value);
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return formatKst(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value))
      return new Date(value).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  }
  return String(value);
}

export default function ReservationViewPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [details, setDetails] = useState<DetailRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    const load = async () => {
      try {
        const { data: res } = await supabase
          .from('reservation')
          .select('*')
          .eq('re_id', id)
          .eq('re_user_id', user.id)
          .single();

        if (!res) { setLoading(false); return; }
        setReservation(res);

        const table = DETAIL_TABLE[res.re_type as string];
        if (table) {
          const { data: det } = await supabase
            .from(table)
            .select('*')
            .eq('reservation_id', id);
          if (det) setDetails(det);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user]);

  if (authLoading || loading) return <Spinner className="h-72" />;
  if (!user) { router.replace('/login'); return null; }
  if (!reservation) return <PageWrapper title="예약 없음"><p className="text-gray-500">해당 예약을 찾을 수 없습니다.</p></PageWrapper>;

  const serviceType = reservation.re_type as string;
  const status = STATUS_MAP[reservation.re_status as string] ?? STATUS_MAP.pending;
  const fieldLabels = FIELD_LABELS[serviceType] ?? FIELD_LABELS[serviceType === 'ticket' ? 'ticket' : 'cruise'];

  return (
    <PageWrapper title={`${SERVICE_LABELS[serviceType] ?? serviceType} 예약 상세`}
      actions={<button className="btn btn-secondary text-xs" onClick={() => router.push('/mypage/reservations/list')}><ArrowLeft className="w-3.5 h-3.5 mr-1" />목록</button>}>

      {/* 기본 정보 */}
      <SectionBox title="예약 정보">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">예약 ID</span><p className="font-mono text-xs">{id}</p></div>
          <div><span className="text-gray-500">상태</span><p><span className={`badge ${status.bg}`}>{status.label}</span></p></div>
          <div><span className="text-gray-500">서비스</span><p>{SERVICE_LABELS[serviceType]}</p></div>
          <div><span className="text-gray-500">생성일</span><p>{formatKst(reservation.re_created_at as string)}</p></div>
        </div>
      </SectionBox>

      {/* 서비스 상세 */}
      {details.map((detail, idx) => (
        <SectionBox key={idx} title={`서비스 상세${details.length > 1 ? ` #${idx + 1}` : ''}`}>
          <div className="space-y-2 text-sm">
            {Object.entries(fieldLabels).map(([key, label]) => {
              const val = detail[key];
              if (val === null || val === undefined || val === '') return null;
              return (
                <div key={key} className="flex justify-between py-1 border-b border-gray-100 last:border-0">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-900 text-right max-w-[60%] break-words">{formatValue(key, val)}</span>
                </div>
              );
            })}
          </div>
        </SectionBox>
      ))}

      {/* price_breakdown */}
      {reservation.price_breakdown && (
        <SectionBox title="가격 상세">
          <pre className="text-xs text-gray-600 overflow-x-auto bg-gray-50 p-3 rounded">
            {JSON.stringify(reservation.price_breakdown, null, 2)}
          </pre>
        </SectionBox>
      )}
    </PageWrapper>
  );
}
