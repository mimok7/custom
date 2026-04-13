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
    cruise_room_info: '객실', checkin: '체크인', guest_count: '인원',
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
    schedule: '일정', checkin_date: '체크인',
    room_count: '객실 수', guest_count: '인원', unit_price: '단가',
    total_price: '총 가격', request_note: '요청사항',
  },
  tour: {
    usage_date: '투어 날짜', tour_capacity: '인원',
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
    usage_date: '이용 날짜', tour_capacity: '수량',
    pickup_location: '픽업', unit_price: '단가', total_price: '총 가격',
    request_note: '상세',
  },
  package: {
    adult_count: '성인', child_extra_bed: '아동(엑스트라)',
    child_no_extra_bed: '아동(미사용)', infant_free: '유아(무료)',
    total_price: '총 가격', additional_requests: '요청사항',
  },
};

function formatValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? '✅ 예' : null; // false(아니오) 숨김
  if (typeof value === 'number') {
    if (value === 0) return null; // 0 값 숨김
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
          
          if (det) {
            // 크루즈 예약인 경우 room_price_code로 크루즈명과 객실타입 조인
            if (res.re_type === 'cruise' && det[0]?.room_price_code) {
              const { data: roomPrices } = await supabase
                .from('room_price')
                .select('cruise_id, room_type(*)')
                .eq('room_price_code', det[0].room_price_code)
                .single();
              
              if (roomPrices) {
                const { data: cruiseInfo } = await supabase
                  .from('cruise_info')
                  .select('cruise_name')
                  .eq('cruise_id', roomPrices.cruise_id)
                  .single();
                
                det[0].cruise_room_info = `${cruiseInfo?.cruise_name || ''} ${roomPrices.room_type?.room_type_name || ''}`.trim();
              }
            }
            setDetails(det as DetailRow[]);
          }
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
        <div className="space-y-2 text-sm">
          <div><span className="font-semibold text-blue-600">상태</span><span className="ml-1">:</span> <span className={`badge ${status.bg}`}>{status.label}</span></div>
          <div><span className="font-semibold text-blue-600">생성일</span><span className="ml-1">:</span> <span>{formatKst(reservation.re_created_at as string)}</span></div>
        </div>
      </SectionBox>

      <div>
        {(details as DetailRow[]).map((detail, idx) => {
          if (serviceType === 'cruise') {
            // 크루즈명, 객실명, 단가, 인원 등 표시
            const checkin = formatValue('checkin', detail.checkin);
            const cruiseName = (detail.cruise_room_info || '').split(' ')[0] || '';
            const roomName = (detail.cruise_room_info || '').split(' ').slice(1).join(' ') || '';
            const guestCount = detail.guest_count;
            const adultCount = detail.adult_count || 0;
            const childCount = detail.child_count || 0;
            const roomCount = detail.room_count || 1;
            const unitPrice = detail.room_type?.room_type_price || detail.unit_price || 0;
            const childUnitPrice = detail.room_type?.room_type_child_price || detail.child_unit_price || 0;
            const totalPrice = detail.room_total_price || 0;

            // 단가 * 인원 계산
            const adultPrice = unitPrice * adultCount * roomCount;
            const childPrice = childUnitPrice * childCount * roomCount;

            return (
              <SectionBox key={idx} title="서비스 상세">
                <div className="flex flex-col gap-2 text-sm">
                  {checkin && <div><span className="font-semibold text-blue-600">체크인</span>: {checkin}</div>}
                  {cruiseName && <div><span className="font-semibold text-blue-600">크루즈명</span>: {cruiseName}</div>}
                  {roomName && <div><span className="font-semibold text-blue-600">객실명</span>: {roomName}</div>}
                  {guestCount && <div><span className="font-semibold text-blue-600">인원</span>: {guestCount}</div>}
                  {adultCount ? <div><span className="font-semibold text-blue-600">성인</span>: {adultCount}</div> : null}
                  {roomCount && <div><span className="font-semibold text-blue-600">객실 수</span>: {roomCount}</div>}
                  {unitPrice ? <div><span className="font-semibold text-blue-600">객실 단가 * 성인</span>: {unitPrice.toLocaleString()} VND × {adultCount} = {(adultPrice).toLocaleString()} VND</div> : null}
                  {childUnitPrice && childCount ? <div><span className="font-semibold text-blue-600">객실 단가 * 아동</span>: {childUnitPrice.toLocaleString()} VND × {childCount} = {(childPrice).toLocaleString()} VND</div> : null}
                  {totalPrice ? <div><span className="font-semibold text-blue-600">총 가격</span>: {totalPrice.toLocaleString()} VND</div> : null}
                </div>
              </SectionBox>
            );
          }
          // 기타 서비스는 기존 방식 유지
          return (
            <SectionBox key={idx} title={`서비스 상세${details.length > 1 ? ` #${idx + 1}` : ''}`}>
              <div className="space-y-3 text-sm">
                {Object.entries(fieldLabels).map(([key, label]) => {
                  const val = detail[key];
                  const formatted = formatValue(key, val);
                  if (formatted === null) return null;
                  return (
                    <div key={key} className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="font-semibold text-blue-600">{label}</span>
                      <span className="ml-0 sm:ml-1">:</span>
                      <span className="text-gray-900 break-words">{formatted}</span>
                    </div>
                  );
                })}
              </div>
            </SectionBox>
          );
        })}
      </div>

    </PageWrapper>
  );
}
