'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PageWrapper from '@/components/layout/PageWrapper';
import SectionBox from '@/components/layout/SectionBox';
import Spinner from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import supabase from '@/lib/supabase';
import { submitReservation } from '@/lib/submitReservation';
import { Plane } from 'lucide-react';

interface AirportPrice {
  id: string;
  service_type: string;
  route: string;
  vehicle_type: string;
  price: number;
}

const SERVICE_TYPES = [
  { value: 'both', label: '픽업 + 샌딩' },
  { value: 'pickup', label: '픽업 (공항→숙소)' },
  { value: 'sending', label: '샌딩 (숙소→공항)' },
] as const;

function hasKorean(text: string): boolean {
  return /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text);
}

export default function AirportBookingPage() {
  const { user, loading: authLoading } = useAuth(undefined, '/login', true);
  const router = useRouter();

  const [serviceType, setServiceType] = useState<string>('both');
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
  const [pickupAirportLocation, setPickupAirportLocation] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [pickupDatetime, setPickupDatetime] = useState('');
  const [pickupFlight, setPickupFlight] = useState('');
  const [sendingAirportLocation, setSendingAirportLocation] = useState('');
  const [sendingLocation, setSendingLocation] = useState('');
  const [sendingDatetime, setSendingDatetime] = useState('');
  const [sendingFlight, setSendingFlight] = useState('');
  const [passengerCount, setPassengerCount] = useState(1);
  const [luggageCount, setLuggageCount] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [airportLocationOptions, setAirportLocationOptions] = useState<string[]>([]);

  /* ── 공항 위치 로드 (airport_name 테이블) ── */
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('airport_name')
        .select('airport_name')
        .order('airport_name');
      if (data) setAirportLocationOptions([...new Set(data.map((r) => r.airport_name as string))]);
    })();
  }, []);

  /* ── 카테고리 로드 ── */
  useEffect(() => {
    supabase
      .from('airport_price')
      .select('service_type')
      .then(({ data }) => {
        if (data) setCategoryOptions([...new Set(data.map((r) => r.service_type))]);
      });
  }, []);

  /* ── 서비스 타입에 따라 카테고리 자동 설정 ── */
  useEffect(() => {
    if (serviceType === 'pickup') {
      setCategory('픽업');
      setRoute('');
      setVehicleType('');
      setRoute2('');
      setVehicleType2('');
    } else if (serviceType === 'sending') {
      setCategory('샌딩');
      setRoute('');
      setVehicleType('');
      setRoute2('');
      setVehicleType2('');
    } else if (serviceType === 'both') {
      setCategory('픽업');
      setRoute('');
      setVehicleType('');
      setRoute2('');
      setVehicleType2('');
    }
  }, [serviceType]);

  /* ── 노선 로드 (카테고리별) ── */
  const loadRoutes = useCallback(async (cat: string, setter: (v: string[]) => void) => {
    const { data } = await supabase
      .from('airport_price')
      .select('route')
      .eq('service_type', cat)
      .order('route');
    if (data) setter([...new Set(data.map((r) => r.route as string))]);
  }, []);

  useEffect(() => {
    if (category === '픽업') {
      loadRoutes('픽업', setRouteOptions);
    } else if (category === '샌딩') {
      loadRoutes('샌딩', setRouteOptions);
    }
  }, [category, loadRoutes]);

  /* ── 샌딩 노선 로드 (both 선택 시) ── */
  useEffect(() => {
    if (serviceType === 'both') {
      loadRoutes('샌딩', setRouteOptions2);
    }
  }, [serviceType, loadRoutes]);

/* ── 차종 로드 + 가격 (카테고리 + 노선) ── */
  const loadVehiclesAndPrice = useCallback(
    async (cat: string, rt: string, setVehicles: (v: string[]) => void, setPrice: (p: number) => void) => {
      const { data } = await supabase
        .from('airport_price')
        .select('vehicle_type, price')
        .eq('service_type', cat)
        .eq('route', rt)
        .order('vehicle_type');
      if (data) {
        setVehicles([...new Set(data.map((r) => r.vehicle_type as string))]);
        if (data.length === 1) setPrice(data[0].price);
      }
    },
    [],
  );

  useEffect(() => {
    if (category && route) loadVehiclesAndPrice(category, route, setVehicleOptions, setPrice1);
  }, [category, route, loadVehiclesAndPrice]);

  /* ── 샌딩 차종 로드 + 가격 ── */
  useEffect(() => {
    if (route2 && serviceType === 'both') loadVehiclesAndPrice('샌딩', route2, setVehicleOptions2, setPrice2);
  }, [route2, serviceType, loadVehiclesAndPrice]);

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

    if (needPickup && (!pickupAirportLocation || !pickupDatetime || !pickupLocation)) { alert('픽업 정보를 모두 입력하세요.'); return; }
    if (needSending && (!sendingAirportLocation || !sendingDatetime || !sendingLocation)) { alert('샌딩 정보를 모두 입력하세요.'); return; }

    setSubmitting(true);
    try {
      const { error } = await submitReservation('airport', {
        form: {
          serviceType,
          category,
          route,
          vehicleType,
          pickupAirportLocation: needPickup ? pickupAirportLocation : undefined,
          pickupLocation: needPickup ? pickupLocation : undefined,
          pickupDatetime: needPickup ? pickupDatetime : undefined,
          pickupFlightNumber: needPickup ? pickupFlight : undefined,
          sendingAirportLocation: needSending ? sendingAirportLocation : undefined,
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
      alert('공항 이동 예약이 완료되었습니다! 다른 서비스를 계속 예약할 수 있습니다.');
      router.push('/mypage/direct-booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <Spinner className="h-72" />;
  if (!user) return null;

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

      {/* 카테고리 (숨김) */}
      <input type="hidden" value={category} />

      {/* 차량 선택 */}
      <SectionBox title="차량 선택">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <input type="number" min={1} value={passengerCount || ''} onChange={(e) => setPassengerCount(e.target.value === '' ? 0 : Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">수하물 수</label>
              <input type="number" min={0} value={luggageCount || ''} onChange={(e) => setLuggageCount(e.target.value === '' ? 0 : Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>

          {needPickup && (
            <div className="space-y-3 p-3 bg-green-50 rounded-lg">
              <h4 className="text-sm font-semibold text-green-800">픽업 정보</h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">공항 위치 *</label>
                <select value={pickupAirportLocation} onChange={(e) => setPickupAirportLocation(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="">선택</option>
                  {airportLocationOptions.map((loc) => <option key={loc}>{loc}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">픽업 시간 *</label>
                <input type="datetime-local" value={pickupDatetime} onChange={(e) => setPickupDatetime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                <p className="mt-2 rounded-md bg-yellow-100 px-3 py-2 text-xs text-yellow-800">시간 미정시 입력후 시간만 삭제 하세요</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">픽업 장소 (영문)</label>
                <input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} placeholder="Hotel name or address" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">항공편명</label>
                <input value={pickupFlight} onChange={(e) => setPickupFlight(e.target.value)} placeholder="예: VN123" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
            </div>
          )}

          {needSending && (
            <div className="space-y-3 p-3 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-800">샌딩 정보</h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">공항 위치 *</label>
                <select value={sendingAirportLocation} onChange={(e) => setSendingAirportLocation(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="">선택</option>
                  {airportLocationOptions.map((loc) => <option key={loc}>{loc}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">샌딩 시간 *</label>
                <input type="datetime-local" value={sendingDatetime} onChange={(e) => setSendingDatetime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                <p className="mt-2 rounded-md bg-yellow-100 px-3 py-2 text-xs text-yellow-800">시간 미정시 입력후 시간만 삭제 하세요</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">샌딩 출발지 (영문)</label>
                <input value={sendingLocation} onChange={(e) => setSendingLocation(e.target.value)} placeholder="Hotel name or address" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">항공편명</label>
                <input value={sendingFlight} onChange={(e) => setSendingFlight(e.target.value)} placeholder="예: VN456" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
            </div>
          )}

          {locationError && <p className="text-sm text-red-500">{locationError}</p>}
        </div>
      </SectionBox>



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
