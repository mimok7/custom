'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PageWrapper from '@/components/layout/PageWrapper';
import SectionBox from '@/components/layout/SectionBox';
import Spinner from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import supabase from '@/lib/supabase';
import { submitReservation } from '@/lib/submitReservation';
import { refreshAuthBeforeSubmit } from '@/lib/authHelpers';
import { MapPin } from 'lucide-react';

interface Tour {
  tour_id: string;
  tour_code: string;
  tour_name: string;
}

interface TourPricing {
  pricing_id: string;
  tour_id: string;
  min_guests: number;
  max_guests: number;
  price_per_person: number;
  payment_currency: string;
}

function hasKorean(text: string): boolean {
  return /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text);
}

const LUNCH_OPTIONS = ['금잔디 식당(한식-추천)', '현지식당', '도시락', '없음'];
const TOUR_COURSES = ['호아루(추천)', '짱안', '닌빈시내', '기타'];
const NIGHT_TOUR_OPTIONS = ['선택안함', '하롱야시장투어', '하롱시내투어'];

export default function TourBookingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tours, setTours] = useState<Tour[]>([]);
  const [selectedTourId, setSelectedTourId] = useState('');
  const [pricingData, setPricingData] = useState<TourPricing[]>([]);
  const [guestCount, setGuestCount] = useState(2);

  const [tourDate, setTourDate] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [lunchOption, setLunchOption] = useState(LUNCH_OPTIONS[0]);
  const [tourCourse, setTourCourse] = useState(TOUR_COURSES[0]);
  const [nightTour, setNightTour] = useState(NIGHT_TOUR_OPTIONS[0]);
  const [specialRequests, setSpecialRequests] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [locationError, setLocationError] = useState('');

  /* ── 투어 목록 로드 (크루즈 부가 투어 제외) ── */
  useEffect(() => {
    supabase
      .from('tour')
      .select('tour_id, tour_code, tour_name')
      .neq('is_cruise_addon', true)
      .then(({ data }) => {
        if (data) setTours(data);
      });
  }, []);

  /* ── 투어 선택 시 가격 로드 ── */
  useEffect(() => {
    if (!selectedTourId) { setPricingData([]); return; }
    supabase
      .from('tour_pricing')
      .select('pricing_id, tour_id, min_guests, max_guests, price_per_person, payment_currency')
      .eq('tour_id', selectedTourId)
      .order('min_guests')
      .then(({ data }) => {
        if (data) setPricingData(data);
      });
  }, [selectedTourId]);

  /* ── 매칭 가격 ── */
  const matchedPricing = useMemo(() => {
    return pricingData.find(
      (p) => guestCount >= p.min_guests && guestCount <= (p.max_guests || 999),
    ) ?? pricingData[0] ?? null;
  }, [pricingData, guestCount]);

  const unitPrice = matchedPricing?.price_per_person ?? 0;
  const totalPrice = unitPrice * guestCount;

  /* ── 영문 검증 ── */
  useEffect(() => {
    const hasErr = hasKorean(pickupLocation) || hasKorean(dropoffLocation);
    setLocationError(hasErr ? '위치는 영문으로 입력하세요.' : '');
  }, [pickupLocation, dropoffLocation]);

  /* ── 제출 ── */
  const handleSubmit = async () => {
    if (!user) return;
    if (!selectedTourId) { alert('투어를 선택하세요.'); return; }
    if (!tourDate) { alert('투어 날짜를 선택하세요.'); return; }
    if (locationError) { alert(locationError); return; }

    const noteLines: string[] = [];
    noteLines.push(`[점심식사] ${lunchOption}`);
    noteLines.push(`[투어코스] ${tourCourse}`);
    if (nightTour !== '선택안함') noteLines.push(`[야간투어] ${nightTour}`);
    if (specialRequests) noteLines.push(`[요청사항] ${specialRequests}`);

    setSubmitting(true);
    try {
      await refreshAuthBeforeSubmit();
      const { error } = await submitReservation('tour', {
        formData: { tour_date: tourDate, pickup_location: pickupLocation, dropoff_location: dropoffLocation },
        matchedPricing,
        guestCount,
        finalPrice: unitPrice,
        totalPrice,
        requestNote: noteLines.join('\n'),
      });
      if (error) { alert(`예약 오류: ${error}`); return; }
      alert('투어 예약이 완료되었습니다! 다른 서비스를 계속 예약할 수 있습니다.');
      router.push('/mypage/direct-booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <Spinner className="h-72" />;
  if (!user) { router.replace('/login'); return null; }

  return (
    <PageWrapper title="투어 예약" description="당일 투어를 예약하세요">
      <SectionBox title="투어 선택">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">투어</label>
            <select value={selectedTourId} onChange={(e) => setSelectedTourId(e.target.value)}>
              <option value="">선택</option>
              {tours.map((t) => <option key={t.tour_id} value={t.tour_id}>{t.tour_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">인원</label>
            <input type="number" min={1} value={guestCount || ''} onChange={(e) => setGuestCount(e.target.value === '' ? 0 : Number(e.target.value))} />
          </div>
        </div>
      </SectionBox>

      <SectionBox title="일정">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">투어 날짜</label>
            <input type="date" value={tourDate} onChange={(e) => setTourDate(e.target.value)} />
          </div>
        </div>
      </SectionBox>

      <SectionBox title="픽업/드롭 정보">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">픽업 장소 (영문)</label>
            <input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} placeholder="Hotel name in English" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">드롭 장소 (영문)</label>
            <input value={dropoffLocation} onChange={(e) => setDropoffLocation(e.target.value)} placeholder="Drop-off location" />
          </div>
        </div>
        {locationError && <p className="text-sm text-red-500 mt-1">{locationError}</p>}
      </SectionBox>

      <SectionBox title="투어 옵션">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">점심 식사</label>
            <select value={lunchOption} onChange={(e) => setLunchOption(e.target.value)}>
              {LUNCH_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">투어 코스</label>
            <select value={tourCourse} onChange={(e) => setTourCourse(e.target.value)}>
              {TOUR_COURSES.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">야간 투어</label>
            <select value={nightTour} onChange={(e) => setNightTour(e.target.value)}>
              {NIGHT_TOUR_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </SectionBox>

      <SectionBox title="요청 사항">
        <textarea rows={3} value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="추가 요청사항을 입력하세요" />
      </SectionBox>



      <div className="flex justify-end gap-3 mt-4">
        <button className="btn btn-secondary" onClick={() => router.back()}>취소</button>
        <button className="btn btn-primary" disabled={submitting} onClick={handleSubmit}>
          {submitting ? <Spinner size="sm" /> : <><MapPin className="w-4 h-4 mr-1" />예약하기</>}
        </button>
      </div>
    </PageWrapper>
  );
}
