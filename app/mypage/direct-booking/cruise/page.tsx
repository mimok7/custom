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
import { refreshAuthBeforeSubmit } from '@/lib/authHelpers';
import { ChevronDown, Plus, Trash2, Ship } from 'lucide-react';

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
  const { user, loading: authLoading } = useAuth();
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
      await refreshAuthBeforeSubmit();
      const { error } = await submitReservation('cruise', {
        form: { checkin, schedule, cruise_name: cruiseName, room_request_note: requestNote, connecting_room: connectingRoom, birthday_event: birthdayEvent, birthday_name: birthdayName, pickup_location: pickupLocation },
        roomSelections,
        priceResult: priceResults[0] ?? {},
        selectedTourOptions: selectedTourOpts,
      });
      if (error) { alert(`예약 오류: ${error}`); return; }
      alert('크루즈 예약이 완료되었습니다!');
      router.push('/mypage/reservations/list');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <Spinner className="h-72" />;
  if (!user) { router.replace('/login'); return null; }

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
                    <input type="number" min={field === 'room_count' ? 1 : 0} value={room[field]} onChange={(e) => updateRoom(idx, { [field]: Number(e.target.value) || 0 })} />
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

      {/* 당일 투어 옵션 */}
      {tourOptions.length > 0 && schedule === '당일' && (
        <SectionBox title="당일 투어 옵션">
          {tourOptions.map((opt) => {
            const sel = selectedTourOpts.find((s) => s.option_id === opt.option_id);
            return (
              <div key={opt.option_id} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm">{opt.option_name} ({formatVND(opt.option_price)})</span>
                <input type="number" min={0} className="w-20" value={sel?.quantity ?? 0}
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

      {/* 추가 옵션 */}
      <SectionBox title="추가 옵션">
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-700">픽업 장소 (영문)</label>
            <input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} placeholder="Hotel name or address in English" />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={connectingRoom} onChange={(e) => setConnectingRoom(e.target.checked)} />커넥팅 룸
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={birthdayEvent} onChange={(e) => setBirthdayEvent(e.target.checked)} />생일 이벤트
            </label>
          </div>
          {birthdayEvent && (
            <input value={birthdayName} onChange={(e) => setBirthdayName(e.target.value)} placeholder="생일자 이름" />
          )}
          <div>
            <label className="text-sm text-gray-700">요청 사항</label>
            <textarea rows={3} value={requestNote} onChange={(e) => setRequestNote(e.target.value)} placeholder="추가 요청사항을 입력하세요" />
          </div>
        </div>
      </SectionBox>

      {/* 가격 요약 */}
      {grandTotal > 0 && (
        <SectionBox title="가격 요약">
          {priceResults.map((result, idx) => result && (
            <div key={idx} className="mb-3 last:mb-0">
              <h4 className="text-sm font-medium text-gray-700 mb-1">{roomSelections[idx]?.room_type || `객실 ${idx + 1}`}</h4>
              <div className="text-sm text-gray-600 space-y-0.5">
                {result.line_items.map((li, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{li.label} × {li.count}</span>
                    <span>{formatVND(li.subtotal)}</span>
                  </div>
                ))}
                {result.surcharge_items.map((si, i) => (
                  <div key={`s${i}`} className="flex justify-between text-orange-600">
                    <span>{si.label} ({si.date}){!si.is_confirmed && ' (미확정)'}</span>
                    <span>{formatVND(si.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="border-t pt-3 mt-3 flex justify-between text-base font-semibold">
            <span>총 합계</span>
            <span className="text-blue-600">{formatVND(grandTotal)}</span>
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
