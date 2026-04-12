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
import { Plane } from 'lucide-react';

interface AirportPrice {
  id: string;
  service_type: string;
  route: string;
  vehicle_type: string;
  price: number;
}

const SERVICE_TYPES = [
  { value: 'pickup', label: '픽업 (공항→숙소)' },
  { value: 'sending', label: '샌딩 (숙소→공항)' },
  { value: 'both', label: '픽업 + 샌딩' },
] as const;

function hasKorean(text: string): boolean {
  return /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text);
}

export default function AirportBookingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [serviceType, setServiceType] = useState<string>('pickup');
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [routeOptions, setRouteOptions] = useState<string[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [route, setRoute] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [price1, setPrice1] = useState(0);

  // 양방향(both)에서 샌딩용 별도 필드
  const [routeOptions2, setRouteOptions2] = useState<string[]>([]);
  const [vehicleOptions2, setVehicleOptions2] = useState<string[]>([]);
  const [route2, setRoute2] = useState('');
  const [vehicleType2, setVehicleType2] = useState('');
  const [price2, setPrice2] = useState(0);

  // 상세
  const [pickupLocation, setPickupLocation] = useState('');
  const [pickupDatetime, setPickupDatetime] = useState('');
  const [pickupFlight, setPickupFlight] = useState('');
  const [sendingLocation, setSendingLocation] = useState('');
  const [sendingDatetime, setSendingDatetime] = useState('');
  const [sendingFlight, setSendingFlight] = useState('');
  const [passengerCount, setPassengerCount] = useState(1);
  const [luggageCount, setLuggageCount] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [locationError, setLocationError] = useState('');

  /* ── 카테고리 로드 ── */
  useEffect(() => {
    supabase
      .from('airport_price')
      .select('service_type')
      .then(({ data }) => {
        if (data) setCategoryOptions([...new Set(data.map((r) => r.service_type))]);
      });
  }, []);

  /* ── 노선 로드 ── */
  const loadRoutes = useCallback(async (cat: string, setter: (v: string[]) => void) => {
    const { data } = await supabase
      .from('airport_price')
      .select('route')
      .eq('service_type', cat);
    if (data) setter([...new Set(data.map((r) => r.route))]);
  }, []);

  useEffect(() => {
    if (category) {
      loadRoutes(category, setRouteOptions);
      if (serviceType === 'both') loadRoutes(category, setRouteOptions2);
    }
  }, [category, serviceType, loadRoutes]);

  /* ── 차종 로드 + 가격 ── */
  const loadVehiclesAndPrice = useCallback(
    async (cat: string, rt: string, setVehicles: (v: string[]) => void, setPrice: (p: number) => void) => {
      const { data } = await supabase
        .from('airport_price')
        .select('vehicle_type, price')
        .eq('service_type', cat)
        .eq('route', rt);
      if (data) {
        setVehicles([...new Set(data.map((r) => r.vehicle_type))]);
        if (data.length === 1) setPrice(data[0].price);
      }
    },
    [],
  );

  useEffect(() => {
    if (category && route) loadVehiclesAndPrice(category, route, setVehicleOptions, setPrice1);
  }, [category, route, loadVehiclesAndPrice]);

  useEffect(() => {
    if (category && route2 && serviceType === 'both')
      loadVehiclesAndPrice(category, route2, setVehicleOptions2, setPrice2);
  }, [category, route2, serviceType, loadVehiclesAndPrice]);

  /* ── 차종 선택 시 가격 조회 ── */
  const lookupPrice = useCallback(async (cat: string, rt: string, vt: string): Promise<number> => {
    const { data } = await supabase
      .from('airport_price')
      .select('price')
      .eq('service_type', cat)
      .eq('route', rt)
      .eq('vehicle_type', vt)
      .limit(1)
      .maybeSingle();
    return data?.price ?? 0;
  }, []);

  useEffect(() => {
    if (vehicleType && route && category)
      lookupPrice(category, route, vehicleType).then(setPrice1);
  }, [vehicleType, route, category, lookupPrice]);

  useEffect(() => {
    if (vehicleType2 && route2 && category && serviceType === 'both')
      lookupPrice(category, route2, vehicleType2).then(setPrice2);
  }, [vehicleType2, route2, category, serviceType, lookupPrice]);

  /* ── 영문 검증 ── */
  useEffect(() => {
    const hasErr = hasKorean(pickupLocation) || hasKorean(sendingLocation);
    setLocationError(hasErr ? '위치는 영문으로 입력하세요.' : '');
  }, [pickupLocation, sendingLocation]);

  /* ── 제출 ── */
  const handleSubmit = async () => {
    if (!user) return;
    if (locationError) { alert(locationError); return; }

    const needPickup = serviceType === 'pickup' || serviceType === 'both';
    const needSending = serviceType === 'sending' || serviceType === 'both';

    if (needPickup && (!pickupDatetime || !pickupLocation)) { alert('픽업 정보를 입력하세요.'); return; }
    if (needSending && (!sendingDatetime || !sendingLocation)) { alert('샌딩 정보를 입력하세요.'); return; }

    setSubmitting(true);
    try {
      await refreshAuthBeforeSubmit();
      const { error } = await submitReservation('airport', {
        form: {
          serviceType,
          category,
          route,
          vehicleType,
          pickupLocation: needPickup ? pickupLocation : undefined,
          pickupDatetime: needPickup ? pickupDatetime : undefined,
          pickupFlightNumber: needPickup ? pickupFlight : undefined,
          sendingLocation: needSending ? sendingLocation : undefined,
          sendingDatetime: needSending ? sendingDatetime : undefined,
          sendingFlightNumber: needSending ? sendingFlight : undefined,
          passengerCount,
          luggageCount,
          airportCode1: category ? `${category}_${route}_${vehicleType}` : null,
          airportCode2: serviceType === 'both' ? `${category}_${route2}_${vehicleType2}` : null,
        },
        price1,
        price2,
      });
      if (error) { alert(`예약 오류: ${error}`); return; }
      alert('공항 이동 예약이 완료되었습니다!');
      router.push('/mypage/reservations/list');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <Spinner className="h-72" />;
  if (!user) { router.replace('/login'); return null; }

  const needPickup = serviceType === 'pickup' || serviceType === 'both';
  const needSending = serviceType === 'sending' || serviceType === 'both';
  const totalPrice = serviceType === 'both' ? price1 + price2 : price1;

  return (
    <PageWrapper title="공항 이동 예약" description="공항 픽업 / 샌딩 서비스">
      {/* 서비스 타입 */}
      <SectionBox title="서비스 유형">
        <div className="flex gap-2 flex-wrap">
          {SERVICE_TYPES.map(({ value, label }) => (
            <button key={value}
              className={`btn ${serviceType === value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setServiceType(value)}>{label}</button>
          ))}
        </div>
      </SectionBox>

      {/* 카테고리/노선/차종 */}
      <SectionBox title="차량 선택">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
            <select value={category} onChange={(e) => { setCategory(e.target.value); setRoute(''); setVehicleType(''); }}>
              <option value="">선택</option>
              {categoryOptions.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">노선 {serviceType === 'both' ? '(픽업)' : ''}</label>
            <select value={route} onChange={(e) => { setRoute(e.target.value); setVehicleType(''); }}>
              <option value="">선택</option>
              {routeOptions.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">차종 {serviceType === 'both' ? '(픽업)' : ''}</label>
            <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              <option value="">선택</option>
              {vehicleOptions.map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
        </div>

        {serviceType === 'both' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t">
            <div className="sm:col-start-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">노선 (샌딩)</label>
              <select value={route2} onChange={(e) => { setRoute2(e.target.value); setVehicleType2(''); }}>
                <option value="">선택</option>
                {routeOptions2.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">차종 (샌딩)</label>
              <select value={vehicleType2} onChange={(e) => setVehicleType2(e.target.value)}>
                <option value="">선택</option>
                {vehicleOptions2.map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
        )}
      </SectionBox>

      {/* 상세 정보 */}
      <SectionBox title="상세 정보">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">탑승 인원</label>
              <input type="number" min={1} value={passengerCount} onChange={(e) => setPassengerCount(Number(e.target.value) || 1)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">수하물 수</label>
              <input type="number" min={0} value={luggageCount} onChange={(e) => setLuggageCount(Number(e.target.value) || 0)} />
            </div>
          </div>

          {needPickup && (
            <div className="space-y-3 p-3 bg-green-50 rounded-lg">
              <h4 className="text-sm font-semibold text-green-800">픽업 정보</h4>
              <input type="datetime-local" value={pickupDatetime} onChange={(e) => setPickupDatetime(e.target.value)} />
              <input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} placeholder="픽업 장소 (영문)" />
              <input value={pickupFlight} onChange={(e) => setPickupFlight(e.target.value)} placeholder="항공편명 (예: VN123)" />
            </div>
          )}

          {needSending && (
            <div className="space-y-3 p-3 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-800">샌딩 정보</h4>
              <input type="datetime-local" value={sendingDatetime} onChange={(e) => setSendingDatetime(e.target.value)} />
              <input value={sendingLocation} onChange={(e) => setSendingLocation(e.target.value)} placeholder="샌딩 출발지 (영문)" />
              <input value={sendingFlight} onChange={(e) => setSendingFlight(e.target.value)} placeholder="항공편명 (예: VN456)" />
            </div>
          )}

          {locationError && <p className="text-sm text-red-500">{locationError}</p>}
        </div>
      </SectionBox>

      {/* 가격 */}
      {totalPrice > 0 && (
        <SectionBox title="가격">
          <div className="text-right text-lg font-semibold text-blue-600">
            {totalPrice.toLocaleString()} VND
          </div>
        </SectionBox>
      )}

      {/* 제출 */}
      <div className="flex justify-end gap-3 mt-4">
        <button className="btn btn-secondary" onClick={() => router.back()}>취소</button>
        <button className="btn btn-primary" disabled={submitting} onClick={handleSubmit}>
          {submitting ? <Spinner size="sm" /> : <><Plane className="w-4 h-4 mr-1" />예약하기</>}
        </button>
      </div>
    </PageWrapper>
  );
}
