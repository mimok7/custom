'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PageWrapper from '@/components/layout/PageWrapper';
import SectionBox from '@/components/layout/SectionBox';
import Spinner from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import supabase from '@/lib/supabase';
import { submitReservation } from '@/lib/submitReservation';
import { refreshAuthBeforeSubmit } from '@/lib/authHelpers';
import { Car, Plus, Trash2 } from 'lucide-react';

interface RentcarPrice {
  rent_code: string;
  car_category_code: string;
  route: string;
  vehicle_type: string;
  price: number;
  way_type: string;
}

interface VehicleData {
  id: string;
  wayType: string;
  route: string;
  carType: string;
  rentcar: RentcarPrice | null;
  pickup_datetime: string;
  pickup_location: string;
  destination: string;
  via_location: string;
  via_waiting: string;
  return_datetime: string;
  return_pickup_location: string;
  return_destination: string;
  return_via_location: string;
  return_via_waiting: string;
  luggage_count: number;
  passenger_count: number;
  car_count: number;
}

const WAY_TYPES = ['편도', '당일왕복', '다른날왕복', '시내당일렌트'] as const;
const ROUND_TRIP = ['당일왕복', '다른날왕복'];

function hasKorean(text: string): boolean {
  return /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text);
}

const EMPTY_VEHICLE = (): VehicleData => ({
  id: crypto.randomUUID(),
  wayType: '편도',
  route: '',
  carType: '',
  rentcar: null,
  pickup_datetime: '',
  pickup_location: '',
  destination: '',
  via_location: '',
  via_waiting: '',
  return_datetime: '',
  return_pickup_location: '',
  return_destination: '',
  return_via_location: '',
  return_via_waiting: '',
  luggage_count: 0,
  passenger_count: 1,
  car_count: 1,
});

export default function RentcarBookingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<VehicleData[]>([EMPTY_VEHICLE()]);
  const [requestNote, setRequestNote] = useState('');
  const [allPrices, setAllPrices] = useState<RentcarPrice[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [locationError, setLocationError] = useState('');

  /* ── 가격 데이터 로드 ── */
  useEffect(() => {
    supabase
      .from('rentcar_price')
      .select('rent_code, car_category_code, route, vehicle_type, price, way_type')
      .then(({ data }) => {
        if (data) setAllPrices(data);
      });
  }, []);

  /* ── 차량 CRUD ── */
  const updateVehicle = (idx: number, patch: Partial<VehicleData>) => {
    setVehicles((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  };
  const addVehicle = () => setVehicles((prev) => [...prev, EMPTY_VEHICLE()]);
  const removeVehicle = (idx: number) =>
    setVehicles((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  /* ── 옵션 필터 ── */
  const getRoutes = useCallback(
    (wayType: string) => [...new Set(allPrices.filter((p) => p.way_type === wayType).map((p) => p.route))],
    [allPrices],
  );
  const getCarTypes = useCallback(
    (wayType: string, route: string) =>
      [...new Set(allPrices.filter((p) => p.way_type === wayType && p.route === route).map((p) => p.vehicle_type))],
    [allPrices],
  );
  const findPrice = useCallback(
    (wayType: string, route: string, carType: string) =>
      allPrices.find((p) => p.way_type === wayType && p.route === route && p.vehicle_type === carType) ?? null,
    [allPrices],
  );

  /* ── 영문 검증 ── */
  useEffect(() => {
    const hasErr = vehicles.some(
      (v) => hasKorean(v.pickup_location) || hasKorean(v.destination) || hasKorean(v.via_location),
    );
    setLocationError(hasErr ? '위치는 영문으로 입력하세요.' : '');
  }, [vehicles]);

  /* ── 총 가격 ── */
  const totalPrice = vehicles.reduce((sum, v) => sum + (v.rentcar?.price ?? 0) * v.car_count, 0);

  /* ── 제출 ── */
  const handleSubmit = async () => {
    if (!user) return;
    if (locationError) { alert(locationError); return; }
    if (!vehicles.some((v) => v.pickup_datetime && v.pickup_location)) {
      alert('차량 정보를 입력하세요.');
      return;
    }

    setSubmitting(true);
    try {
      await refreshAuthBeforeSubmit();
      const { error } = await submitReservation('rentcar', { vehicles, requestNote });
      if (error) { alert(`예약 오류: ${error}`); return; }
      alert('렌터카 예약이 완료되었습니다! 다른 서비스를 계속 예약할 수 있습니다.');
      router.push('/mypage/direct-booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <Spinner className="h-72" />;
  if (!user) { router.replace('/login'); return null; }

  return (
    <PageWrapper title="렌터카 예약" description="차량을 예약하세요"
      actions={<button className="btn btn-secondary text-xs" onClick={addVehicle}><Plus className="w-3.5 h-3.5 mr-1" />차량 추가</button>}>
      {vehicles.map((v, idx) => {
        const routes = getRoutes(v.wayType);
        const carTypes = getCarTypes(v.wayType, v.route);
        const isRound = ROUND_TRIP.includes(v.wayType);

        return (
          <SectionBox key={v.id} title={`차량 ${idx + 1}`}
            actions={vehicles.length > 1 ? <button className="text-red-400 hover:text-red-600" onClick={() => removeVehicle(idx)}><Trash2 className="w-4 h-4" /></button> : undefined}>

            {/* 유형/노선/차종 */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="text-sm text-gray-600">유형</label>
                <select value={v.wayType} onChange={(e) => updateVehicle(idx, { wayType: e.target.value, route: '', carType: '', rentcar: null })}>
                  {WAY_TYPES.map((w) => <option key={w}>{w}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">노선</label>
                <select value={v.route} onChange={(e) => updateVehicle(idx, { route: e.target.value, carType: '', rentcar: null })}>
                  <option value="">선택</option>
                  {routes.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">차종</label>
                <select value={v.carType} onChange={(e) => {
                  const price = findPrice(v.wayType, v.route, e.target.value);
                  updateVehicle(idx, { carType: e.target.value, rentcar: price });
                }}>
                  <option value="">선택</option>
                  {carTypes.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">대수</label>
                <input type="number" min={1} value={v.car_count || ''} onChange={(e) => updateVehicle(idx, { car_count: e.target.value === '' ? 0 : Number(e.target.value) })} />
              </div>
            </div>

            {/* 편도/당일 정보 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-sm text-gray-600">출발 일시</label>
                <input type="datetime-local" value={v.pickup_datetime} onChange={(e) => updateVehicle(idx, { pickup_datetime: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-600">탑승 인원</label>
                <input type="number" min={1} value={v.passenger_count || ''} onChange={(e) => updateVehicle(idx, { passenger_count: e.target.value === '' ? 0 : Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm text-gray-600">출발 장소 (영문)</label>
                <input value={v.pickup_location} onChange={(e) => updateVehicle(idx, { pickup_location: e.target.value })} placeholder="Pickup location" />
              </div>
              <div>
                <label className="text-sm text-gray-600">목적지 (영문)</label>
                <input value={v.destination} onChange={(e) => updateVehicle(idx, { destination: e.target.value })} placeholder="Destination" />
              </div>
              <div>
                <label className="text-sm text-gray-600">경유지 (영문, 선택)</label>
                <input value={v.via_location} onChange={(e) => updateVehicle(idx, { via_location: e.target.value })} placeholder="Via location" />
              </div>
              <div>
                <label className="text-sm text-gray-600">경유 대기 (분)</label>
                <input value={v.via_waiting} onChange={(e) => updateVehicle(idx, { via_waiting: e.target.value })} placeholder="예: 30" />
              </div>
            </div>

            {/* 왕복 정보 */}
            {isRound && (
              <div className="border-t pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 text-sm font-medium text-gray-700">복귀 정보</div>
                <div>
                  <label className="text-sm text-gray-600">복귀 일시</label>
                  <input type="datetime-local" value={v.return_datetime} onChange={(e) => updateVehicle(idx, { return_datetime: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-gray-600">수하물 수</label>
                  <input type="number" min={0} value={v.luggage_count || ''} onChange={(e) => updateVehicle(idx, { luggage_count: e.target.value === '' ? 0 : Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-sm text-gray-600">복귀 출발지</label>
                  <input value={v.return_pickup_location} onChange={(e) => updateVehicle(idx, { return_pickup_location: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-gray-600">복귀 목적지</label>
                  <input value={v.return_destination} onChange={(e) => updateVehicle(idx, { return_destination: e.target.value })} />
                </div>
              </div>
            )}

            {v.rentcar && (
              <div className="mt-3 text-sm text-right text-gray-600">
                단가: {v.rentcar.price.toLocaleString()} VND × {v.car_count}대 = <span className="font-semibold text-blue-600">{(v.rentcar.price * v.car_count).toLocaleString()} VND</span>
              </div>
            )}
          </SectionBox>
        );
      })}

      {locationError && <p className="text-sm text-red-500">{locationError}</p>}

      <SectionBox title="요청 사항">
        <textarea rows={3} value={requestNote} onChange={(e) => setRequestNote(e.target.value)} placeholder="추가 요청사항을 입력하세요" />
      </SectionBox>



      <div className="flex justify-end gap-3 mt-4">
        <button className="btn btn-secondary" onClick={() => router.back()}>취소</button>
        <button className="btn btn-primary" disabled={submitting} onClick={handleSubmit}>
          {submitting ? <Spinner size="sm" /> : <><Car className="w-4 h-4 mr-1" />예약하기</>}
        </button>
      </div>
    </PageWrapper>
  );
}
