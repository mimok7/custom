'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageWrapper from '@/components/layout/PageWrapper';
import SectionBox from '@/components/layout/SectionBox';
import Spinner from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import supabase from '@/lib/supabase';
import { submitReservation } from '@/lib/submitReservation';
import { refreshAuthBeforeSubmit } from '@/lib/authHelpers';
import { Ticket } from 'lucide-react';

interface Tour {
  tour_id: string;
  tour_code: string;
  tour_name: string;
}

function hasKorean(text: string): boolean {
  return /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text);
}

export default function TicketBookingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [ticketType, setTicketType] = useState<'dragon' | 'other'>('dragon');
  const [dragonTours, setDragonTours] = useState<Tour[]>([]);
  const [yokoTours, setYokoTours] = useState<Tour[]>([]);

  // 드래곤펄
  const [selectedTourId, setSelectedTourId] = useState('');
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [ticketDate, setTicketDate] = useState('');
  const [programSelection, setProgramSelection] = useState('');
  const [shuttleRequired, setShuttleRequired] = useState(false);
  const [pickupLocation, setPickleLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');

  // 기타 티켓
  const [otherTicketName, setOtherTicketName] = useState('');
  const [otherTicketDetails, setOtherTicketDetails] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [locationError, setLocationError] = useState('');

  /* ── 투어 데이터 로드 ── */
  useEffect(() => {
    Promise.all([
      supabase.from('tour').select('tour_id, tour_code, tour_name').eq('is_cruise_addon', true),
      supabase.from('tour').select('tour_id, tour_code, tour_name').like('tour_code', 'YOKO_ONSEN%'),
    ]).then(([dragonRes, yokoRes]) => {
      if (dragonRes.data) setDragonTours(dragonRes.data);
      if (yokoRes.data) setYokoTours(yokoRes.data);
    });
  }, []);

  /* ── 영문 검증 ── */
  useEffect(() => {
    const hasErr = hasKorean(pickupLocation) || hasKorean(dropoffLocation);
    setLocationError(hasErr ? '위치는 영문으로 입력하세요.' : '');
  }, [pickupLocation, dropoffLocation]);

  /* ── 제출 ── */
  const handleSubmit = async () => {
    if (!user) return;
    if (!ticketDate) { alert('이용 날짜를 선택하세요.'); return; }
    if (locationError) { alert(locationError); return; }

    const noteLines: string[] = [];
    if (ticketType === 'dragon') {
      const tourName = dragonTours.find((t) => t.tour_id === selectedTourId)?.tour_name ?? '';
      noteLines.push(`[티켓명] ${tourName}`);
      noteLines.push(`[수량] ${ticketQuantity}`);
      if (programSelection) noteLines.push(`[프로그램] ${programSelection}`);
      if (shuttleRequired) {
        noteLines.push(`[셔틀] 필요`);
        if (pickupLocation) noteLines.push(`[픽업] ${pickupLocation}`);
        if (dropoffLocation) noteLines.push(`[드롭] ${dropoffLocation}`);
      }
    } else {
      noteLines.push(`[티켓명] ${otherTicketName}`);
      noteLines.push(`[수량] ${ticketQuantity}`);
      if (otherTicketDetails) noteLines.push(`[상세내용] ${otherTicketDetails}`);
    }
    if (specialRequests) noteLines.push(`[요청사항] ${specialRequests}`);

    setSubmitting(true);
    try {
      await refreshAuthBeforeSubmit();
      const { error } = await submitReservation('ticket', {
        formData: { tour_date: ticketDate, pickup_location: pickupLocation, dropoff_location: dropoffLocation },
        matchedPricing: selectedTourId ? { pricing_id: selectedTourId } : null,
        guestCount: ticketQuantity,
        finalPrice: 0,
        totalPrice: 0,
        requestNote: noteLines.join('\n'),
      });
      if (error) { alert(`예약 오류: ${error}`); return; }
      alert('티켓 예약이 완료되었습니다!');
      router.push('/mypage/reservations/list');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <Spinner className="h-72" />;
  if (!user) { router.replace('/login'); return null; }

  return (
    <PageWrapper title="티켓 예약" description="드래곤펄 / 기타 티켓 예약">
      {/* 티켓 유형 */}
      <SectionBox title="티켓 유형">
        <div className="flex gap-2">
          <button className={`btn ${ticketType === 'dragon' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTicketType('dragon')}>드래곤펄</button>
          <button className={`btn ${ticketType === 'other' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTicketType('other')}>기타 티켓</button>
        </div>
      </SectionBox>

      {ticketType === 'dragon' ? (
        <>
          <SectionBox title="드래곤펄 선택">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">드래곤펄 티켓</label>
                <select value={selectedTourId} onChange={(e) => setSelectedTourId(e.target.value)}>
                  <option value="">선택</option>
                  {dragonTours.map((t) => <option key={t.tour_id} value={t.tour_id}>{t.tour_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">수량</label>
                <input type="number" min={1} value={ticketQuantity} onChange={(e) => setTicketQuantity(Number(e.target.value) || 1)} />
              </div>
            </div>
          </SectionBox>

          {yokoTours.length > 0 && (
            <SectionBox title="프로그램 선택 (요코온센)">
              <select value={programSelection} onChange={(e) => setProgramSelection(e.target.value)}>
                <option value="">선택 안함</option>
                {yokoTours.map((t) => <option key={t.tour_id} value={t.tour_name}>{t.tour_name}</option>)}
              </select>
            </SectionBox>
          )}

          <SectionBox title="셔틀 / 픽업">
            <label className="flex items-center gap-2 text-sm mb-3">
              <input type="checkbox" checked={shuttleRequired} onChange={(e) => setShuttleRequired(e.target.checked)} />
              셔틀 필요
            </label>
            {shuttleRequired && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600">픽업 장소 (영문)</label>
                  <input value={pickupLocation} onChange={(e) => setPickleLocation(e.target.value)} placeholder="Pickup location" />
                </div>
                <div>
                  <label className="text-sm text-gray-600">드롭 장소 (영문)</label>
                  <input value={dropoffLocation} onChange={(e) => setDropoffLocation(e.target.value)} placeholder="Drop-off location" />
                </div>
              </div>
            )}
            {locationError && <p className="text-sm text-red-500 mt-1">{locationError}</p>}
          </SectionBox>
        </>
      ) : (
        <SectionBox title="기타 티켓 정보">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">티켓명</label>
              <input value={otherTicketName} onChange={(e) => setOtherTicketName(e.target.value)} placeholder="티켓 이름" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">수량</label>
              <input type="number" min={1} value={ticketQuantity} onChange={(e) => setTicketQuantity(Number(e.target.value) || 1)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상세 내용</label>
              <textarea rows={3} value={otherTicketDetails} onChange={(e) => setOtherTicketDetails(e.target.value)} placeholder="티켓 상세 내용을 입력하세요" />
            </div>
          </div>
        </SectionBox>
      )}

      <SectionBox title="일정 / 요청사항">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이용 날짜</label>
            <input type="date" value={ticketDate} onChange={(e) => setTicketDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">요청사항</label>
            <textarea rows={2} value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="추가 요청사항" />
          </div>
        </div>
      </SectionBox>

      <div className="flex justify-end gap-3 mt-4">
        <button className="btn btn-secondary" onClick={() => router.back()}>취소</button>
        <button className="btn btn-primary" disabled={submitting} onClick={handleSubmit}>
          {submitting ? <Spinner size="sm" /> : <><Ticket className="w-4 h-4 mr-1" />예약하기</>}
        </button>
      </div>
    </PageWrapper>
  );
}
