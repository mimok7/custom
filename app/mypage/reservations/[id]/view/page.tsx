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
  tour: '투어', rentcar: '렌터카', ticket: '티켓', package: '패키지', car: '크루즈 차량',
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
  car: 'reservation_cruise_car',
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

  /* ─── 타입 ─── */
  type ServiceType = 'cruise' | 'airport' | 'hotel' | 'rentcar' | 'tour' | 'sht_car' | 'sht' | 'car' | 'package' | 'ticket';

  interface ReservationRow {
    re_id: string;
    re_type: ServiceType;
    re_status: string;
    re_created_at: string;
    re_quote_id: string | null;
    re_user_id: string;
    package_id?: string | null;
    pax_count?: number | null;
    re_adult_count?: number | null;
    re_child_count?: number | null;
    re_infant_count?: number | null;
    total_amount?: number | null;
    manager_note?: string | null;
  }

  type DetailRow = Record<string, unknown>;

  /* ─── 상수 ─── */
  const SERVICE_LABELS: Record<string, string> = {
    cruise: '크루즈', airport: '공항 이동', hotel: '호텔',
    tour: '투어', rentcar: '렌터카', ticket: '티켓', package: '패키지', car: '크루즈 차량',
    sht_car: '스하차량', sht: '스하차량',
  };

  const SERVICE_ICON: Record<string, string> = {
    cruise: '🚢', airport: '✈️', hotel: '🏨', tour: '🎫',
    rentcar: '🚗', ticket: '🎟️', package: '📦', car: '🚙',
    sht_car: '🚙', sht: '🚙',
  };

  const STATUS_MAP: Record<string, { bg: string; label: string }> = {
    pending:    { bg: 'bg-yellow-50 text-yellow-700', label: '대기중' },
    confirmed:  { bg: 'bg-green-50 text-green-700',   label: '확정됨' },
    processing: { bg: 'bg-blue-50 text-blue-700',     label: '처리중' },
    cancelled:  { bg: 'bg-red-50 text-red-700',       label: '취소됨' },
    completed:  { bg: 'bg-purple-50 text-purple-700', label: '완료' },
  };

  const DETAIL_TABLE: Record<string, string> = {
    cruise:  'reservation_cruise',
    car:     'reservation_cruise_car',
    airport: 'reservation_airport',
    hotel:   'reservation_hotel',
    tour:    'reservation_tour',
    rentcar: 'reservation_rentcar',
    ticket:  'reservation_tour',
    package: 'reservation_package',
    sht_car: 'reservation_car_sht',
    sht:     'reservation_car_sht',
  };

  /* ─── 포맷 유틸 ─── */
  function fmtVal(key: string, value: unknown): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'boolean') return value ? '✅ 예' : null;
    if (typeof value === 'number') {
      if (value === 0) return null;
      if (key.includes('price') || key.includes('total') || key === 'unit_price')
        return `${value.toLocaleString()} VND`;
      return String(value);
    }
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return formatKst(value);
      if (/^\d{4}-\d{2}-\d{2}$/.test(value))
        return new Date(value + 'T00:00:00').toLocaleDateString('ko-KR', {
          year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
        });
    }
    return String(value);
  }

  function sanitizeNote(value: unknown): string {
    if (!value) return '';
    return String(value)
      .split(/\r?\n/)
      .filter(line => {
        const t = line.trim();
        if (!t) return false;
        if (/(?:\[(?:객실|구성)\s*\d+\]|(?:객실|구성)\s*\d+\b)/.test(t) && /(성인|아동|유아|싱글|엑베)/.test(t)) return false;
        if (/\|\s*성인\s*\d+/.test(t) && /(아동\s*\d+|유아\s*\d+|싱글\s*\d+|엑베)/.test(t)) return false;
        return true;
      })
      .join('\n')
      .trim();
  }

  /* ─── 라벨맵 ─── */
  const LABEL_MAP: Record<string, Record<string, string>> = {
    cruise: { request_note: '📝 요청사항' },
    airport: {
      route: '🛣️ 경로', vehicle_type: '🚗 차량 타입',
      ra_airport_location: '📍 장소', ra_flight_number: '✈️ 항공편',
      ra_datetime: '🕐 일시', ra_stopover_location: '🔄 경유지',
      ra_stopover_wait_minutes: '⏱️ 경유 대기(분)',
      ra_car_count: '🚗 차량 수', ra_passenger_count: '👥 승객 수',
      ra_luggage_count: '🧳 수하물 수', dispatch_code: '📦 차량번호',
      request_note: '📝 요청사항',
    },
    hotel: {
      hotel_name: '🏨 호텔명', room_name: '🚪 객실명',
      checkin_date: '📅 체크인', guest_count: '👥 총 인원',
      schedule: '📅 숙박일정', breakfast_service: '🍳 조식',
      hotel_category: '⭐ 호텔 등급', assignment_code: '🏛️ 호텔 코드',
      request_note: '📝 요청사항',
    },
    rentcar: {
      way_type: '🛣️ 이용방식', route: '🛣️ 경로', vehicle_type: '🚗 차종',
      pickup_datetime: '🕐 픽업 시간', pickup_location: '📍 승차 위치',
      destination: '🎯 하차 위치', via_location: '🔄 경유지',
      via_waiting: '⏱️ 경유 대기', car_count: '🚗 차량 수',
      passenger_count: '👥 승객 수', luggage_count: '🧳 수하물',
      dispatch_code: '📦 차량번호', request_note: '📝 요청사항',
    },
    tour: {
      tour_name: '🏞️ 투어명', tour_vehicle: '🚙 차량',
      tour_type: '🎫 투어 타입', usage_date: '📅 투어 날짜',
      tour_capacity: '👥 정원', pickup_location: '📍 픽업 장소',
      dropoff_location: '🎯 하차 장소', request_note: '📝 요청사항',
    },
    car: {
      way_type: '🛣️ 이용방식', route: '🛣️ 경로', vehicle_type: '🚗 차종',
      pickup_datetime: '🕐 픽업 시간', pickup_location: '📍 승차 위치',
      dropoff_location: '🎯 하차 위치',
      car_count: '🚗 차량 수', passenger_count: '👥 탑승 인원',
      dispatch_code: '📦 차량번호', request_note: '📝 요청사항',
    },
    sht_car: {
      vehicle_number: '🔢 차량번호', seat_number: '💺 좌석번호',
      car_type: '🚙 차종', usage_date: '📅 사용일',
      pickup_location: '📍 승차 위치', dropoff_location: '🎯 하차 위치',
      passenger_count: '👥 승객 수', request_note: '📝 요청사항',
    },
    sht: {
      vehicle_number: '🔢 차량번호', seat_number: '💺 좌석번호',
      car_type: '🚙 차종', usage_date: '📅 사용일',
      pickup_location: '📍 승차 위치', dropoff_location: '🎯 하차 위치',
      passenger_count: '👥 승객 수', request_note: '📝 요청사항',
    },
    ticket: {
      tour_name: '🏞️ 티켓명', usage_date: '📅 이용 날짜',
      tour_capacity: '👥 수량', pickup_location: '📍 픽업',
      unit_price: '💰 단가', total_price: '💰 총 가격', request_note: '📝 상세',
    },
  };

  const ALLOWED_FIELDS: Record<string, string[]> = {
    cruise:  ['request_note'],
    airport: ['route', 'vehicle_type', 'ra_airport_location', 'ra_flight_number', 'ra_datetime', 'ra_stopover_location', 'ra_stopover_wait_minutes', 'ra_car_count', 'ra_passenger_count', 'ra_luggage_count', 'dispatch_code', 'request_note'],
    hotel:   ['hotel_name', 'room_name', 'checkin_date', 'guest_count', 'schedule', 'breakfast_service', 'hotel_category', 'assignment_code', 'request_note'],
    rentcar: ['way_type', 'route', 'vehicle_type', 'pickup_datetime', 'pickup_location', 'destination', 'via_location', 'via_waiting', 'car_count', 'passenger_count', 'luggage_count', 'dispatch_code', 'request_note'],
    tour:    ['tour_name', 'tour_vehicle', 'tour_type', 'usage_date', 'tour_capacity', 'pickup_location', 'dropoff_location', 'request_note'],
    car:     ['way_type', 'route', 'vehicle_type', 'pickup_datetime', 'pickup_location', 'dropoff_location', 'car_count', 'passenger_count', 'dispatch_code', 'request_note'],
    sht_car: ['vehicle_number', 'seat_number', 'car_type', 'usage_date', 'pickup_location', 'dropoff_location', 'passenger_count', 'request_note'],
    sht:     ['vehicle_number', 'seat_number', 'car_type', 'usage_date', 'pickup_location', 'dropoff_location', 'passenger_count', 'request_note'],
    ticket:  ['tour_name', 'usage_date', 'tour_capacity', 'pickup_location', 'unit_price', 'total_price', 'request_note'],
  };

  /* ─── 필드 그리드 렌더링 ─── */
  function FieldGrid({ obj, type }: { obj: DetailRow; type: string }) {
    const allowedFields = ALLOWED_FIELDS[type] ?? [];
    const labels = LABEL_MAP[type] ?? {};

    const fields = (type === 'airport' ? allowedFields.filter(k => k !== 'ra_datetime') : allowedFields)
      .map(key => {
        const raw = obj[key];
        const val = key.includes('note') ? sanitizeNote(raw) : raw;
        return { key, val, label: labels[key] ?? key };
      })
      .filter(({ val }) => val !== null && val !== undefined && val !== '');

    if (fields.length === 0) return <p className="text-sm text-gray-500">상세 정보가 없습니다.</p>;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
        {fields.map(({ key, val, label }) => {
          const isNote = key.includes('note') || key === 'request_note';
          if (isNote) {
            return (
              <div key={key} className="col-span-full mt-2 pt-2 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-500 block mb-1">{label}</span>
                <div className="text-sm text-gray-900 bg-yellow-50 p-2 rounded border border-yellow-200 whitespace-pre-wrap">
                  {fmtVal(key, val) ?? String(val)}
                </div>
              </div>
            );
          }
          return (
            <div key={key} className="flex items-start gap-2">
              <span className="text-xs font-bold text-blue-600 shrink-0 mt-0.5">{label}:</span>
              <span className="text-sm text-gray-900">{fmtVal(key, val) ?? String(val)}</span>
            </div>
          );
        })}
      </div>
    );
  }

  /* ─── 메인 컴포넌트 ─── */
  export default function ReservationViewPage() {
    const params = useParams();
    const id = params?.id as string;
    const { user, loading: authLoading } = useAuth(undefined, '/login', true);
    const router = useRouter();

    const [reservation, setReservation] = useState<ReservationRow | null>(null);
    const [details, setDetails] = useState<DetailRow[]>([]);
    const [cruiseDetails, setCruiseDetails] = useState<{
      cruise_name: string; schedule: string; checkin: string | null;
      total_guest_count: number;
      rooms: { idx: number; room_type: string; guest_count: number; price_rows: { label: string; count: number; unitPrice: number; subtotal: number }[]; room_total_price: number; request_note: string; boarding_code: string }[];
    } | null>(null);
    const [carDetails, setCarDetails] = useState<DetailRow[]>([]);
    const [packageMasterName, setPackageMasterName] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      if (!id || !user) return;
      const load = async () => {
        setLoading(true);
        try {
          const { data: res } = await supabase
            .from('reservation')
            .select('*')
            .eq('re_id', id)
            .eq('re_user_id', user.id)
            .single();

          if (!res) { setLoading(false); return; }
          setReservation(res as ReservationRow);

          const type = res.re_type as ServiceType;
          const table = DETAIL_TABLE[type];
          let enriched: DetailRow[] = [];
          if (table) {
            const { data: det } = await supabase.from(table).select('*').eq('reservation_id', id);
            enriched = (det ?? []) as DetailRow[];
          }

          /* 서비스별 가격 테이블 조인 */
          if (type === 'airport' && enriched.length > 0) {
            enriched = await Promise.all(enriched.map(async (item) => {
              if (item.airport_price_code) {
                const { data: p } = await supabase
                  .from('airport_price')
                  .select('service_type, route, vehicle_type')
                  .eq('airport_code', item.airport_price_code)
                  .maybeSingle();
                if (p) return { ...item, ...p };
              }
              return item;
            }));
            enriched.sort((a, b) => {
              const t = (x: DetailRow) => { const v = x.ra_datetime || x.pickup_datetime || x.usage_date; const n = v ? new Date(String(v)).getTime() : 0; return isNaN(n) ? 0 : n; };
              return t(a) - t(b);
            });
          }

          if (type === 'hotel' && enriched.length > 0) {
            enriched = await Promise.all(enriched.map(async (item) => {
              if (item.hotel_price_code) {
                const { data: p } = await supabase
                  .from('hotel_price')
                  .select('hotel_name, room_name, room_category')
                  .eq('hotel_price_code', item.hotel_price_code)
                  .maybeSingle();
                if (p) return { ...item, hotel_name: p.hotel_name, room_name: p.room_name, hotel_category: p.room_category };
              }
              return item;
            }));
          }

          if (type === 'rentcar' && enriched.length > 0) {
            enriched = await Promise.all(enriched.map(async (item) => {
              if (item.rentcar_price_code) {
                const { data: p } = await supabase
                  .from('rentcar_price')
                  .select('way_type, route, vehicle_type, capacity')
                  .eq('rent_code', item.rentcar_price_code)
                  .maybeSingle();
                if (p) return { ...item, way_type: item.way_type || p.way_type, route: item.route || p.route, vehicle_type: item.vehicle_type || p.vehicle_type };
              }
              return item;
            }));
          }

          if (type === 'tour' && enriched.length > 0) {
            enriched = await Promise.all(enriched.map(async (item) => {
              if (item.tour_price_code) {
                const { data: p } = await supabase
                  .from('tour_pricing')
                  .select('pricing_id, vehicle_type, tour:tour_id(tour_name)')
                  .eq('pricing_id', item.tour_price_code)
                  .maybeSingle();
                if (p) {
                  const tourName = (p.tour as Record<string, unknown> | null)?.tour_name;
                  return { ...item, tour_name: tourName, tour_vehicle: p.vehicle_type };
                }
              }
              return item;
            }));
          }

          if ((type === 'sht_car' || type === 'sht') && enriched.length > 0) {
            enriched = await Promise.all(enriched.map(async (item) => {
              const code = (item.car_price_code || item.rentcar_price_code) as string | undefined;
              if (code) {
                const { data: p } = await supabase
                  .from('rentcar_price')
                  .select('way_type, route, vehicle_type, capacity')
                  .eq('rent_code', code)
                  .maybeSingle();
                if (p) return { ...item, ...p };
              }
              return item;
            }));
          }

          setDetails(enriched);

          /* 크루즈: cruise_rate_card 조인 */
          if (type === 'cruise' && enriched.length > 0) {
            const codes = enriched.map(e => e.room_price_code).filter(Boolean) as string[];
            const { data: rateCards } = codes.length > 0
              ? await supabase.from('cruise_rate_card').select('id, cruise_name, room_type, schedule_type, price_adult, price_child, price_infant, price_child_extra_bed, price_extra_bed, price_single').in('id', codes)
              : { data: [] };
            const rcMap = new Map((rateCards ?? []).map((rc: Record<string, unknown>) => [rc.id, rc]));

            let cruiseName = '', schedule = '', checkin: string | null = null, totalGuests = 0;
            type RoomRow = { idx: number; room_type: string; guest_count: number; price_rows: { label: string; count: number; unitPrice: number; subtotal: number }[]; room_total_price: number; request_note: string; boarding_code: string };
            const rooms: RoomRow[] = [];

            enriched.forEach((item, idx) => {
              const rc = rcMap.get(item.room_price_code as string) as Record<string, unknown> | undefined;
              totalGuests += Number(item.guest_count) || 0;
              if (!checkin) checkin = (item.checkin as string) || null;
              if (rc) {
                if (!cruiseName) cruiseName = String(rc.cruise_name || '');
                if (!schedule) schedule = String(rc.schedule_type || '');
                const makeRows = [
                  { label: '성인', count: Number(item.adult_count) || 0, up: Number(rc.price_adult) || 0 },
                  { label: '아동', count: Number(item.child_count) || 0, up: Number(rc.price_child) || 0 },
                  { label: '유아', count: Number(item.infant_count) || 0, up: Number(rc.price_infant) || 0 },
                  { label: '아동(엑스트라베드)', count: Number(item.child_extra_bed_count) || 0, up: Number(rc.price_child_extra_bed) || 0 },
                  { label: '엑스트라베드', count: Number(item.extra_bed_count) || 0, up: Number(rc.price_extra_bed) || 0 },
                  { label: '싱글', count: Number(item.single_count) || 0, up: Number(rc.price_single) || 0 },
                ].filter(r => r.count > 0).map(r => ({ label: r.label, count: r.count, unitPrice: r.up, subtotal: r.count * r.up }));
                const calc = makeRows.reduce((s, r) => s + r.subtotal, 0);
                rooms.push({
                  idx, room_type: String(rc.room_type || '객실'),
                  guest_count: Number(item.guest_count) || 0,
                  price_rows: makeRows,
                  room_total_price: Number(item.room_total_price) || calc,
                  request_note: sanitizeNote(item.request_note),
                  boarding_code: String(item.boarding_code || ''),
                });
              }
            });
            setCruiseDetails({ cruise_name: cruiseName, schedule, checkin, total_guest_count: totalGuests, rooms });

            /* cruise_car 조회 */
            const { data: directCar } = await supabase.from('reservation_cruise_car').select('*').eq('reservation_id', id);
            let carData: DetailRow[] = directCar && directCar.length > 0 ? (directCar as DetailRow[]) : [];
            if (carData.length === 0 && res.re_quote_id) {
              const { data: carRes } = await supabase.from('reservation').select('re_id').eq('re_user_id', res.re_user_id).eq('re_quote_id', res.re_quote_id).in('re_type', ['car']);
              if (carRes && carRes.length > 0) {
                const ids = (carRes as Record<string, unknown>[]).map(r => r.re_id);
                const { data: linked } = await supabase.from('reservation_cruise_car').select('*').in('reservation_id', ids);
                if (linked) carData = linked as DetailRow[];
              }
            }
            if (carData.length > 0) {
              carData = await Promise.all(carData.map(async (item) => {
                const code = (item.rentcar_price_code || item.car_price_code) as string | undefined;
                if (code) {
                  const { data: p } = await supabase.from('rentcar_price').select('way_type, route, vehicle_type').eq('rent_code', code).maybeSingle();
                  if (p) return { ...item, vehicle_type: item.vehicle_type || p.vehicle_type, way_type: item.way_type || p.way_type, route: item.route || p.route };
                }
                return item;
              }));
            }
            setCarDetails(carData);
          }

          /* 패키지 마스터 */
          if (type === 'package' && res.package_id) {
            const { data: pkg } = await supabase.from('package_master').select('name').eq('id', res.package_id).maybeSingle();
            if (pkg) setPackageMasterName(String((pkg as Record<string, unknown>).name || ''));
          }
        } finally {
          setLoading(false);
        }
      };
      load();
    }, [id, user]);

    if (authLoading || loading) return <Spinner className="h-72" />;
    if (!user) return null;
    if (!reservation) return (
      <PageWrapper title="예약 없음">
        <p className="text-gray-500">해당 예약을 찾을 수 없습니다.</p>
      </PageWrapper>
    );

    const serviceType = reservation.re_type;
    const status = STATUS_MAP[reservation.re_status] ?? STATUS_MAP.pending;
    const backBtn = (
      <button className="btn btn-secondary text-xs" onClick={() => router.push('/mypage/reservations/list')}>
        <ArrowLeft className="w-3.5 h-3.5 mr-1" />목록
      </button>
    );

    return (
      <PageWrapper
        title={`${SERVICE_ICON[serviceType] ?? '📋'} ${SERVICE_LABELS[serviceType] ?? serviceType} 예약 상세`}
        actions={backBtn}
      >
        {/* 예약 기본 정보 */}
        <SectionBox title="예약 정보">
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="font-semibold text-blue-600">상태</span>:{' '}
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${status.bg}`}>{status.label}</span>
            </div>
            <div>
              <span className="font-semibold text-blue-600">예약일</span>: {formatKst(reservation.re_created_at)}
            </div>
          </div>
        </SectionBox>

        {/* ─── 크루즈 ─── */}
        {serviceType === 'cruise' && cruiseDetails && (
          <>
            <SectionBox title="크루즈 기본 정보">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-blue-600 shrink-0">🚢 크루즈명:</span>
                  <span>{cruiseDetails.cruise_name || '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-blue-600 shrink-0">📅 스케줄:</span>
                  <span>{cruiseDetails.schedule || '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-blue-600 shrink-0">🗓️ 승선일:</span>
                  <span>{cruiseDetails.checkin ? (fmtVal('checkin', cruiseDetails.checkin) ?? '-') : '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-blue-600 shrink-0">👥 총 인원:</span>
                  <span>{cruiseDetails.total_guest_count ? `${cruiseDetails.total_guest_count}명` : '-'}</span>
                </div>
              </div>
            </SectionBox>

            {cruiseDetails.rooms.map((room, i) => (
              <SectionBox key={i} title={`객실 ${i + 1} — ${room.room_type}`}>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-blue-600">인원:</span>
                    <span>{room.guest_count}명</span>
                  </div>
                  {room.price_rows.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1 border border-gray-100">
                      {room.price_rows.map((pr, j) => (
                        <div key={j} className="flex justify-between">
                          <span className="text-gray-700">{pr.label} × {pr.count}</span>
                          <span className="text-blue-700 font-medium">{pr.subtotal.toLocaleString()} VND</span>
                        </div>
                      ))}
                      <div className="flex justify-between pt-1 border-t border-gray-200 font-semibold">
                        <span>합계</span>
                        <span className="text-blue-600">{room.room_total_price.toLocaleString()} VND</span>
                      </div>
                    </div>
                  )}
                  {room.boarding_code && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-blue-600">🎫 승선 코드:</span>
                      <span>{room.boarding_code}</span>
                    </div>
                  )}
                  {room.request_note && (
                    <div>
                      <span className="font-semibold text-blue-600 block mb-1">📝 요청사항</span>
                      <div className="text-sm bg-yellow-50 p-2 rounded border border-yellow-200 whitespace-pre-wrap">{room.request_note}</div>
                    </div>
                  )}
                </div>
              </SectionBox>
            ))}

            {carDetails.length > 0 && (
              <SectionBox title="🚗 연결 차량 정보">
                <div className="space-y-4">
                  {carDetails.map((car, idx) => (
                    <div key={idx} className={carDetails.length > 1 ? 'pb-4 border-b border-gray-100 last:border-0 last:pb-0' : ''}>
                      {carDetails.length > 1 && <div className="text-xs font-bold text-green-700 mb-2">차량 {idx + 1}</div>}
                      <FieldGrid obj={car} type="car" />
                    </div>
                  ))}
                </div>
              </SectionBox>
            )}
          </>
        )}

        {/* ─── 공항 ─── */}
        {serviceType === 'airport' && details.length > 0 && (
          <SectionBox title="공항 서비스 상세">
            <div className="space-y-6">
              {details.map((svc, idx) => {
                const wayType = String(svc.way_type || svc.service_type || '');
                const isSending = wayType === 'sending' || wayType === '샌딩';
                const datetime = svc.ra_datetime || svc.pickup_datetime || svc.usage_date;
                return (
                  <div key={idx} className={details.length > 1 ? 'pb-6 border-b border-gray-100 last:border-0 last:pb-0' : ''}>
                    {details.length > 1 && (
                      <div className="text-sm font-bold text-blue-700 mb-3">
                        {idx + 1}. {isSending ? '✈️ 샌딩' : '✈️ 픽업'}
                      </div>
                    )}
                    {datetime && (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 text-sm mb-1">
                          <span className="font-semibold text-blue-600">🕐 일시:</span>
                          <span>{formatKst(String(datetime))}</span>
                        </div>
                        {isSending && (
                          <div className="p-2 bg-red-50 rounded border border-red-200 text-xs text-red-700">
                            * 샌딩 일시는 비행기 시간이 아닌 차량 승차 시간입니다.
                          </div>
                        )}
                      </div>
                    )}
                    <FieldGrid obj={svc} type="airport" />
                  </div>
                );
              })}
            </div>
          </SectionBox>
        )}

        {/* ─── 호텔 ─── */}
        {serviceType === 'hotel' && details.length > 0 && (
          <SectionBox title="호텔 상세 정보">
            <div className="space-y-4">
              {details.map((svc, idx) => <div key={idx}><FieldGrid obj={svc} type="hotel" /></div>)}
            </div>
          </SectionBox>
        )}

        {/* ─── 렌터카 ─── */}
        {serviceType === 'rentcar' && details.length > 0 && (
          <SectionBox title="렌터카 상세 정보">
            <div className="space-y-6">
              {details.map((it, idx) => {
                const showPickup = !!(it.pickup_datetime || it.pickup_location);
                const showReturn = !!(it.return_datetime);
                return (
                  <div key={idx} className={details.length > 1 ? 'pb-6 border-b border-gray-100 last:border-0 last:pb-0' : ''}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-3">
                      {it.route && <div className="flex gap-2"><span className="font-semibold text-blue-600 shrink-0">🛣️ 경로:</span><span>{String(it.route)}</span></div>}
                      {it.vehicle_type && <div className="flex gap-2"><span className="font-semibold text-blue-600 shrink-0">🚗 차종:</span><span>{String(it.vehicle_type)}</span></div>}
                      {it.car_count != null && <div className="flex gap-2"><span className="font-semibold text-blue-600 shrink-0">🚗 차량 수:</span><span>{String(it.car_count)}대</span></div>}
                      {it.passenger_count != null && <div className="flex gap-2"><span className="font-semibold text-blue-600 shrink-0">👥 탑승 인원:</span><span>{String(it.passenger_count)}명</span></div>}
                      {it.luggage_count != null && Number(it.luggage_count) !== 0 && <div className="flex gap-2"><span className="font-semibold text-blue-600 shrink-0">🧳 수하물:</span><span>{String(it.luggage_count)}개</span></div>}
                      {it.dispatch_code && <div className="flex gap-2"><span className="font-semibold text-blue-600 shrink-0">📦 차량번호:</span><span>{String(it.dispatch_code)}</span></div>}
                    </div>
                    {showPickup && (
                      <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="text-xs font-bold text-blue-700 mb-2">Ⅰ 📍 픽업 정보</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          {it.pickup_datetime && <div className="flex gap-2"><span className="font-semibold text-blue-600 shrink-0">🕐 픽업 시간:</span><span>{formatKst(String(it.pickup_datetime))}</span></div>}
                          {it.pickup_location && <div className="flex gap-2"><span className="font-semibold text-blue-600 shrink-0">📍 승차 위치:</span><span>{String(it.pickup_location)}</span></div>}
                          {it.destination && <div className="flex gap-2"><span className="font-semibold text-blue-600 shrink-0">🎯 하차 위치:</span><span>{String(it.destination)}</span></div>}
                        </div>
                      </div>
                    )}
                    {(it.via_location || it.via_waiting) && (
                      <div className="mb-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                        <div className="text-xs font-bold text-yellow-700 mb-2">🔄 픽업 경유</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          {it.via_location && <div className="flex gap-2"><span className="font-semibold text-yellow-700 shrink-0">🔄 경유지:</span><span>{String(it.via_location)}</span></div>}
                          {it.via_waiting && <div className="flex gap-2"><span className="font-semibold text-yellow-700 shrink-0">⏱️ 대기:</span><span>{String(it.via_waiting)}</span></div>}
                        </div>
                      </div>
                    )}
                    {showReturn && (
                      <div className="mb-3 p-3 bg-cyan-50 rounded-lg border border-cyan-100">
                        <div className="text-xs font-bold text-cyan-700 mb-2">Ⅱ 📍 드롭 정보</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          {it.return_datetime && <div className="flex gap-2"><span className="font-semibold text-cyan-600 shrink-0">🕐 드롭 시간:</span><span>{formatKst(String(it.return_datetime))}</span></div>}
                          {it.return_pickup_location && <div className="flex gap-2"><span className="font-semibold text-cyan-600 shrink-0">📍 승차 위치:</span><span>{String(it.return_pickup_location)}</span></div>}
                          {it.return_destination && <div className="flex gap-2"><span className="font-semibold text-cyan-600 shrink-0">🎯 하차 위치:</span><span>{String(it.return_destination)}</span></div>}
                        </div>
                      </div>
                    )}
                    {it.request_note && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <span className="text-xs font-bold text-gray-500 block mb-1">📝 요청사항</span>
                        <div className="text-sm bg-yellow-50 p-2 rounded border border-yellow-200 whitespace-pre-wrap">{String(it.request_note)}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionBox>
        )}

        {/* ─── 투어 / 티켓 ─── */}
        {(serviceType === 'tour' || serviceType === 'ticket') && details.length > 0 && (
          <SectionBox title={serviceType === 'ticket' ? '티켓 상세 정보' : '투어 상세 정보'}>
            <div className="space-y-4">
              {details.map((svc, idx) => <div key={idx}><FieldGrid obj={svc} type={serviceType} /></div>)}
            </div>
          </SectionBox>
        )}

        {/* ─── 패키지 ─── */}
        {serviceType === 'package' && (
          <SectionBox title="패키지 상세">
            <div className="space-y-3 text-sm">
              {packageMasterName && (
                <div className="flex gap-2">
                  <span className="font-semibold text-blue-600">📦 패키지명:</span>
                  <span>{packageMasterName}</span>
                </div>
              )}
              {reservation.pax_count && (
                <div className="flex gap-2">
                  <span className="font-semibold text-blue-600">👥 총 인원:</span>
                  <span>{reservation.pax_count}명</span>
                </div>
              )}
              {reservation.manager_note && (
                <div>
                  <span className="font-semibold text-blue-600 block mb-1">🚗 배차 및 일정</span>
                  <div className="bg-green-50 p-3 rounded border border-green-200 whitespace-pre-wrap">{reservation.manager_note}</div>
                </div>
              )}
            </div>
          </SectionBox>
        )}

        {/* ─── sht/sht_car ─── */}
        {(serviceType === 'sht_car' || serviceType === 'sht') && details.length > 0 && (
          <SectionBox title="스하차량 상세">
            <div className="space-y-6">
              {[...details].sort((a, b) => {
                const cat = (x: DetailRow) => String(x.sht_category || x.car_category || '').toLowerCase().includes('pickup') ? 0 : 1;
                return cat(a) - cat(b);
              }).map((svc, idx) => (
                <div key={idx} className={details.length > 1 ? 'pb-4 border-b border-gray-100 last:border-0 last:pb-0' : ''}>
                  {details.length > 1 && (
                    <div className="text-xs font-bold text-blue-700 mb-2">
                      {String(svc.sht_category || svc.car_category || '').toLowerCase().includes('pickup') ? '픽업' : '드롭'}
                    </div>
                  )}
                  <FieldGrid obj={svc} type="sht_car" />
                </div>
              ))}
            </div>
          </SectionBox>
        )}

      </PageWrapper>
    );
  }
