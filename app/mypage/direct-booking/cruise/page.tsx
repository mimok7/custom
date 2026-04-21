'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PageWrapper from '@/components/layout/PageWrapper';
import SectionBox from '@/components/layout/SectionBox';
import Spinner from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import supabase from '@/lib/supabase';
import {
  getCruiseNames,
  getRoomTypes,
  getTourOptions,
  getRateCardInclusions,
  calculateCruisePrice,
  formatVND,
  type CruiseRateCard,
  type CruiseTourOption,
  type SelectedTourOption,
  type CruisePriceResult,
} from '@/lib/cruisePriceCalculator';
import { submitReservation } from '@/lib/submitReservation';
import { ChevronDown, Plus, Trash2, Ship, Car, AlertCircle } from 'lucide-react';

interface RoomSelection {
  localId: string;
  rateCardId: string;
  room_type: string;
  adult_count: number;
  child_count: number;
  child_extra_bed_count: number;
  infant_count: number;
  extra_bed_count: number;
  single_count: number;
  room_count: number;
}

const EMPTY_ROOM = (): RoomSelection => ({
  localId: crypto.randomUUID(),
  rateCardId: '',
  room_type: '',
  adult_count: 2,
  child_count: 0,
  child_extra_bed_count: 0,
  infant_count: 0,
  extra_bed_count: 0,
  single_count: 0,
  room_count: 1,
});

const SCHEDULES = ['1박2일', '2박3일', '당일'] as const;

export default function CruiseBookingPage() {
  const { user, loading: authLoading } = useAuth(undefined, '/login', true);
  const router = useRouter();

  /* ── 폼 상태 ── */
  const [checkin, setCheckin] = useState('');
  const [schedule, setSchedule] = useState<string>('1박2일');
  const [cruiseName, setCruiseName] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [connectingRoom, setConnectingRoom] = useState(false);
  const [birthdayEvent, setBirthdayEvent] = useState(false);
  const [birthdayName, setBirthdayName] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropLocation, setDropLocation] = useState('');

  /* ── 차량 예약 상태 ── */
  const [addCar, setAddCar] = useState(false);
  const [carCategory, setCarCategory] = useState('');
  const [carRoute, setCarRoute] = useState('');
  const [carType, setCarType] = useState('');
  const [carCount, setCarCount] = useState(1);
  const [routeOptions, setRouteOptions] = useState<string[]>([]);
  const [carTypeOptions, setCarTypeOptions] = useState<string[]>([]);
  const [carCode, setCarCode] = useState('');

  /* ── 이용방식 (일정에 따라 필터) ── */
  const carCategories = useMemo(() => {
    const base = ['편도', '당일왕복', '다른날왕복'];
    if (['1박2일', '2박3일'].includes(schedule)) return base.filter((c) => c !== '당일왕복');
    return base;
  }, [schedule]);

  /* ── 옵션 데이터 ── */
  const [cruiseOptions, setCruiseOptions] = useState<string[]>([]);
  const [roomTypeCards, setRoomTypeCards] = useState<CruiseRateCard[]>([]);
  const [tourOptions, setTourOptions] = useState<CruiseTourOption[]>([]);
  const [inclusions, setInclusions] = useState<Record<string, string[]>>({});

  /* ── 객실 선택 ── */
  const [roomSelections, setRoomSelections] = useState<RoomSelection[]>([EMPTY_ROOM()]);
  const [selectedTourOpts, setSelectedTourOpts] = useState<SelectedTourOption[]>([]);

  /* ── 가격 결과 ── */
  const [priceResults, setPriceResults] = useState<(CruisePriceResult | null)[]>([]);

  /* ── UI 상태 ── */
  const [submitting, setSubmitting] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  /* ── 크루즈 목록 로드 ── */
  useEffect(() => {
    if (!checkin || !schedule) { setCruiseOptions([]); return; }
    setDataLoading(true);
    getCruiseNames({ schedule, checkin_date: checkin })
      .then((names) => {
        setCruiseOptions(names);
        if (names.length && !names.includes(cruiseName)) setCruiseName(names[0]);
      })
      .finally(() => setDataLoading(false));
  }, [checkin, schedule]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 객실 타입 로드 ── */
  useEffect(() => {
    if (!cruiseName || !checkin || !schedule) { setRoomTypeCards([]); return; }
    setDataLoading(true);
    getRoomTypes({ schedule, checkin_date: checkin, cruise_name: cruiseName })
      .then(async (cards) => {
        setRoomTypeCards(cards);
        const ids = cards.map((c) => c.id);
        const incl = await getRateCardInclusions(ids);
        setInclusions(incl);
      })
      .finally(() => setDataLoading(false));
  }, [cruiseName, checkin, schedule]);

  /* ── 투어 옵션 로드 ── */
  useEffect(() => {
    if (schedule !== '당일' || !cruiseName) { setTourOptions([]); return; }
    getTourOptions(cruiseName, schedule).then(setTourOptions);
  }, [cruiseName, schedule]);

  /* ── 가격 계산 ── */
  const recalculate = useCallback(async () => {
    const validRooms = roomSelections.filter((r) => r.room_type);
    if (!validRooms.length || !cruiseName || !checkin) {
      setPriceResults([]);
      return;
    }
    const results = await Promise.all(
      validRooms.map((r) =>
        calculateCruisePrice({
          cruise_name: cruiseName,
          schedule,
          room_type: r.room_type,
          checkin_date: checkin,
          adult_count: r.adult_count,
          child_count: r.child_count,
          child_extra_bed_count: r.child_extra_bed_count,
          infant_count: r.infant_count,
          extra_bed_count: r.extra_bed_count,
          single_count: r.single_count,
          room_count: r.room_count,
          tour_options: selectedTourOpts,
        }),
      ),
    );
    setPriceResults(results);
  }, [roomSelections, cruiseName, checkin, schedule, selectedTourOpts]);

  useEffect(() => { recalculate(); }, [recalculate]);

  /* ── 차량 경로 로드 ── */
  useEffect(() => {
    if (!carCategory) { setRouteOptions([]); setCarTypeOptions([]); return; }
    (async () => {
      const { data } = await supabase
        .from('rentcar_price')
        .select('route')
        .eq('way_type', carCategory)
        .like('route', '%하롱베이%');
      const routes = [...new Set((data ?? []).map((d: Record<string, unknown>) => d.route as string))];
      setRouteOptions(routes);
      setCarRoute('');
      setCarType('');
      setCarCode('');
      setDropLocation('');
    })();
  }, [carCategory]);

  /* ── 차량 타입 로드 ── */
  useEffect(() => {
    if (!carCategory || !carRoute) { setCarTypeOptions([]); return; }
    (async () => {
      const { data } = await supabase
        .from('rentcar_price')
        .select('vehicle_type')
        .eq('way_type', carCategory)
        .eq('route', carRoute);
      const types = [...new Set((data ?? []).map((d: Record<string, unknown>) => d.vehicle_type as string))];
      setCarTypeOptions(types);
      setCarType('');
      setCarCode('');
      setDropLocation('');
    })();
  }, [carCategory, carRoute]);

  /* ── 차량 코드 로드 ── */
  useEffect(() => {
    if (!carCategory || !carRoute || !carType) { setCarCode(''); return; }
    (async () => {
      const { data } = await supabase
        .from('rentcar_price')
        .select('rent_code')
        .eq('way_type', carCategory)
        .eq('route', carRoute)
        .eq('vehicle_type', carType)
        .limit(1)
        .maybeSingle();
      setCarCode((data as Record<string, unknown>)?.rent_code as string ?? '');
    })();
  }, [carCategory, carRoute, carType]);

  /* ── 객실 CRUD ── */
  const updateRoom = (idx: number, patch: Partial<RoomSelection>) => {
    setRoomSelections((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const addRoom = () => setRoomSelections((prev) => [...prev, EMPTY_ROOM()]);
  const removeRoom = (idx: number) =>
    setRoomSelections((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  /* ── 총합 ── */
  const grandTotal = useMemo(
    () => priceResults.reduce((s, r) => s + (r?.grand_total ?? 0), 0),
    [priceResults],
  );

  /* ── 제출 ── */
  const handleSubmit = async () => {
    if (!user) return;
    if (!cruiseName || !checkin) { alert('크루즈 / 체크인 날짜를 선택하세요.'); return; }
    if (!roomSelections.some((r) => r.room_type)) { alert('객실을 선택하세요.'); return; }

    setSubmitting(true);
    try {
      const { error } = await submitReservation('cruise', {
        form: { checkin, schedule, cruise_name: cruiseName, room_request_note: requestNote, connecting_room: connectingRoom, birthday_event: birthdayEvent, birthday_name: birthdayName, pickup_location: pickupLocation },
        roomSelections,
        priceResult: priceResults[0] ?? {},
        selectedTourOptions: selectedTourOpts,
        carData: addCar && carCode ? { car_category: carCategory, car_route: carRoute, car_type: carType, car_code: carCode, car_count: carCount, pickup_location: pickupLocation, drop_location: dropLocation } : null,
      });
      if (error) { alert(`예약 오류: ${error}`); return; }
      alert('크루즈 예약이 완료되었습니다! 다른 서비스를 계속 예약할 수 있습니다.');
      router.push('/mypage/direct-booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <Spinner className="h-72" />;
  if (!user) return null;

  return (
    <PageWrapper title="크루즈 예약" description="하롱베이 크루즈를 예약하세요">
      {/* 기본 정보 */}
      <SectionBox title="기본 정보">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">체크인 날짜</label>
            <input type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">일정</label>
            <select value={schedule} onChange={(e) => setSchedule(e.target.value)}>
              {SCHEDULES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">크루즈</label>
            <select value={cruiseName} onChange={(e) => setCruiseName(e.target.value)} disabled={!cruiseOptions.length}>
              <option value="">선택</option>
              {cruiseOptions.map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </SectionBox>

      {dataLoading && <Spinner className="h-24" />}

      {/* 객실 선택 */}
      {roomTypeCards.length > 0 && (
        <SectionBox title="객실 선택" actions={<button className="btn btn-secondary text-xs" onClick={addRoom}><Plus className="w-3.5 h-3.5 mr-1" />객실 추가</button>}>
          {roomSelections.map((room, idx) => (
            <div key={room.localId} className="border rounded-lg p-4 mb-3 last:mb-0 relative">
              {roomSelections.length > 1 && (
                <button className="absolute top-2 right-2 text-red-400 hover:text-red-600" onClick={() => removeRoom(idx)}><Trash2 className="w-4 h-4" /></button>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <div className="col-span-2 sm:col-span-4">
                  <label className="text-sm text-gray-600">객실 타입</label>
                  <select value={room.room_type} onChange={(e) => updateRoom(idx, { room_type: e.target.value, rateCardId: roomTypeCards.find((c) => c.room_type === e.target.value)?.id ?? '' })}>
                    <option value="">선택</option>
                    {roomTypeCards.map((c) => (
                      <option key={c.id} value={c.room_type}>{c.room_type} ({formatVND(c.price_adult)}/인)</option>
                    ))}
                  </select>
                </div>
                {(['adult_count', 'child_count', 'child_extra_bed_count', 'infant_count', 'extra_bed_count', 'single_count', 'room_count'] as const).map((field) => (
                  <div key={field}>
                    <label className="text-xs text-gray-500">{({ adult_count: '성인', child_count: '아동', child_extra_bed_count: '아동(엑스트라)', infant_count: '유아', extra_bed_count: '엑스트라 베드', single_count: '싱글 차지', room_count: '객실 수' })[field]}</label>
                    <input type="number" min={field === 'room_count' ? 1 : 0} value={room[field] || ''} onChange={(e) => updateRoom(idx, { [field]: e.target.value === '' ? 0 : Number(e.target.value) })} />
                  </div>
                ))}
              </div>
              {/* 포함사항 */}
              {inclusions[room.rateCardId]?.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-blue-600 flex items-center gap-1"><ChevronDown className="w-3.5 h-3.5" />포함사항</summary>
                  <ul className="mt-1 ml-4 list-disc text-gray-600">
                    {inclusions[room.rateCardId].map((txt, i) => <li key={i}>{txt}</li>)}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </SectionBox>
      )}

      {/* 추가 옵션 */}
      <SectionBox title="추가 옵션">
        <div className="space-y-4">
          {/* 크루즈 차량 추가 */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <label className="flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-2">
                <Car className="w-4 h-4 text-gray-600" />크루즈 차량 예약 추가
              </span>
              <input type="checkbox" checked={addCar} onChange={(e) => setAddCar(e.target.checked)} className="w-4 h-4" />
            </label>
          </div>

          {/* 커넥팅룸 */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <label className="flex items-center justify-between text-sm font-medium mb-2">
              <span>커넥팅 룸</span>
              <input type="checkbox" checked={connectingRoom} onChange={(e) => setConnectingRoom(e.target.checked)} className="w-4 h-4" />
            </label>
            {connectingRoom && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-gray-700">
                <p>* 침대 타입은 더블 + 트윈으로 고정됨.</p>
                <p>* 커넥팅 룸 수량은 한정적이기 때문에, 매진인 경우 옆 객실이나 마주보는 객실 등 가까운 객실로 배정됨.</p>
              </div>
            )}
          </div>

          {/* 생일축하 */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <label className="flex items-center justify-between text-sm font-medium mb-2">
              <span>생일 축하 이벤트</span>
              <input type="checkbox" checked={birthdayEvent} onChange={(e) => setBirthdayEvent(e.target.checked)} className="w-4 h-4" />
            </label>
            {birthdayEvent && (
              <>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-gray-700 mb-3">
                  <p>* 100만동의 유료 서비스입니다.</p>
                </div>
                <input value={birthdayName} onChange={(e) => setBirthdayName(e.target.value)} placeholder="생일자 이름" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </>
            )}
          </div>

          {/* 요청 사항 */}
          <div>
            <label className="text-sm text-gray-700 block mb-2">요청 사항</label>
            <textarea rows={3} value={requestNote} onChange={(e) => setRequestNote(e.target.value)} placeholder="추가 요청사항을 입력하세요" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>
      </SectionBox>

      {/* 당일 투어 옵션 */}
      {tourOptions.length > 0 && schedule === '당일' && (
        <SectionBox title="당일 투어 옵션">
          {tourOptions.map((opt) => {
            const sel = selectedTourOpts.find((s) => s.option_id === opt.option_id);
            return (
              <div key={opt.option_id} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm">{opt.option_name} ({formatVND(opt.option_price)})</span>
                <input type="number" min={0} className="w-20" value={sel?.quantity || ''}
                  onChange={(e) => {
                    const qty = Number(e.target.value) || 0;
                    setSelectedTourOpts((prev) => {
                      const filtered = prev.filter((s) => s.option_id !== opt.option_id);
                      return qty > 0 ? [...filtered, { option_id: opt.option_id, option_name: opt.option_name, option_price: opt.option_price, quantity: qty }] : filtered;
                    });
                  }}
                />
              </div>
            );
          })}
        </SectionBox>
      )}

      {/* 차량 예약 */}
      {addCar && (
        <SectionBox title="크루즈 차량 예약">
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">이용방식</label>
                <select 
                  value={carCategory} 
                  onChange={(e) => setCarCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">선택</option>
                  {carCategories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              {carCategory && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">경로</label>
                  <select 
                    value={carRoute} 
                    onChange={(e) => setCarRoute(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">경로 선택</option>
                    {routeOptions.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
              )}
              {carRoute && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">차량 타입</label>
                  <select 
                    value={carType} 
                    onChange={(e) => setCarType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">차량 선택</option>
                    {carTypeOptions.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              )}
            </div>
            {carCategory && carRoute && carType && (
              <div className="pt-3 border-t border-blue-200 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">{carType.includes('셔틀') && !carType.includes('단독') ? '인원수' : '차량 대수'}</label>
                  <input 
                    type="number" 
                    min={1} 
                    value={carCount || ''} 
                    onChange={(e) => setCarCount(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">픽업 장소 (영문)</label>
                  <input 
                    value={pickupLocation} 
                    onChange={(e) => setPickupLocation(e.target.value)}
                    placeholder="Hotel name or address in English"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                {(carCategory.includes('왕복')) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">드롭 장소 (영문)</label>
                    <input 
                      value={dropLocation}
                      onChange={(e) => setDropLocation(e.target.value)}
                      placeholder="Hotel name or address in English"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </SectionBox>
      )}



      {/* 제출 */}
      <div className="flex justify-end gap-3 mt-4">
        <button className="btn btn-secondary" onClick={() => router.back()}>취소</button>
        <button className="btn btn-primary" disabled={submitting || !cruiseName || !checkin} onClick={handleSubmit}>
          {submitting ? <Spinner size="sm" /> : <><Ship className="w-4 h-4 mr-1" />예약하기</>}
        </button>
      </div>
    </PageWrapper>
  );
}
