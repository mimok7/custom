'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PageWrapper from '@/components/layout/PageWrapper';
import SectionBox from '@/components/layout/SectionBox';
import Spinner from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import supabase from '@/lib/supabase';
import { submitReservation } from '@/lib/submitReservation';
import { Ticket, Info, Calendar } from 'lucide-react';

interface Tour {
  tour_id: string;
  tour_code: string;
  tour_name: string;
}

export default function TicketBookingPage() {
  const { user, loading: authLoading } = useAuth(undefined, '/login', true);
  const router = useRouter();

  const [ticketType, setTicketType] = useState<'dragon' | 'other'>('dragon');
  const [dragonTours, setDragonTours] = useState<Tour[]>([]);
  const [yokoTours, setYokoTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);

  // 드래곤펄
  const [selectedTourId, setSelectedTourId] = useState('');
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [ticketDate, setTicketDate] = useState('');
  const [programSelection, setProgramSelection] = useState('');
  const [shuttleRequired, setShuttleRequired] = useState(false);
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');

  // 기타 티켓
  const [otherTicketName, setOtherTicketName] = useState('');
  const [otherTicketDetails, setOtherTicketDetails] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [locationError, setLocationError] = useState('');

  const validateLocation = useCallback((location: string): boolean => {
    return /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(location);
  }, []);

  /* ── 투어 데이터 로드 ── */
  useEffect(() => {
    const loadTours = async () => {
      try {
        const [dragonRes, yokoRes] = await Promise.all([
          supabase
            .from('tour')
            .select('tour_id, tour_code, tour_name')
            .eq('is_cruise_addon', true)
            .eq('is_active', true),
          supabase
            .from('tour')
            .select('tour_id, tour_code, tour_name')
            .like('tour_code', 'YOKO_ONSEN%')
            .eq('is_active', true),
        ]);

        if (dragonRes.data) setDragonTours(dragonRes.data);
        if (yokoRes.data) setYokoTours(yokoRes.data);
      } finally {
        setLoading(false);
      }
    };

    loadTours();
  }, []);

  /* ── 영문 검증 ── */
  useEffect(() => {
    const hasErr = validateLocation(pickupLocation) || validateLocation(dropoffLocation);
    setLocationError(hasErr ? '위치는 영문으로 입력하세요.' : '');
  }, [pickupLocation, dropoffLocation, validateLocation]);

  /* ── 제출 ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    // 공통 검증
    if (!ticketDate) {
      alert('이용 날짜를 선택해주세요.');
      return;
    }

    // 드래곤펄 검증
    if (ticketType === 'dragon') {
      if (!selectedTourId) {
        alert('드래곤펄 티켓을 선택해주세요.');
        return;
      }
      if (shuttleRequired && locationError) {
        alert(locationError);
        return;
      }
      if (shuttleRequired && !pickupLocation) {
        alert('픽업 위치를 입력해주세요.');
        return;
      }
      if (shuttleRequired && !dropoffLocation) {
        alert('드롭 위치를 입력해주세요.');
        return;
      }
    }

    // 기타 티켓 검증
    if (ticketType === 'other') {
      if (!otherTicketName) {
        alert('티켓명을 입력해주세요.');
        return;
      }
      if (!programSelection) {
        alert('프로그램을 선택해주세요.');
        return;
      }
    }

    if (ticketQuantity < 1) {
      alert('수량은 1 이상이어야 합니다.');
      return;
    }

    setSubmitting(true);
    try {
      const noteLines: string[] = [];

      if (ticketType === 'dragon') {
        const tourName = dragonTours.find((t) => t.tour_id === selectedTourId)?.tour_name ?? '';
        noteLines.push(`[티켓명] ${tourName}`);
        noteLines.push(`[수량] ${ticketQuantity}`);
        if (programSelection) noteLines.push(`[프로그램] ${programSelection}`);
        if (shuttleRequired) {
          noteLines.push(`[셔틀] 신청함`);
          if (pickupLocation) noteLines.push(`[픽업] ${pickupLocation}`);
          if (dropoffLocation) noteLines.push(`[드롭] ${dropoffLocation}`);
        }
      } else {
        noteLines.push(`[티켓명] ${otherTicketName}`);
        noteLines.push(`[수량] ${ticketQuantity}`);
        noteLines.push(`[프로그램] ${programSelection}`);
        if (otherTicketDetails) noteLines.push(`[상세내용] ${otherTicketDetails}`);
      }

      if (specialRequests) noteLines.push(`[요청사항] ${specialRequests}`);

      const { error } = await submitReservation('ticket', {
        formData: {
          tour_date: ticketDate,
          pickup_location: pickupLocation || null,
          dropoff_location: dropoffLocation || null,
        },
        matchedPricing: selectedTourId ? { pricing_id: selectedTourId } : null,
        guestCount: ticketQuantity,
        finalPrice: 0,
        totalPrice: 0,
        requestNote: noteLines.join('\n'),
      });

      if (error) {
        alert(`예약 오류: ${error}`);
        return;
      }

      alert('티켓 예약이 완료되었습니다! 다른 서비스를 계속 예약할 수 있습니다.');
      router.push('/mypage/direct-booking?completed=ticket');
    } catch (err: any) {
      console.error('티켓 예약 오류:', err);
      alert(`오류가 발생했습니다: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) return <Spinner className="h-72" />;
  if (!user) return null;

  return (
    <PageWrapper
      title="티켓 예약"
      description="드래곤펄 또는 기타 티켓을 예약하세요"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 티켓 유형 선택 */}
        <SectionBox title={<><Ticket className="w-5 h-5 inline mr-2" />티켓 유형</>}>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTicketType('dragon')}
              className={`px-4 py-3 rounded-lg font-semibold transition-all border-2 ${
                ticketType === 'dragon'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-600 hover:border-blue-300'
              }`}
            >
              🐉 드래곤펄
            </button>
            <button
              type="button"
              onClick={() => setTicketType('other')}
              className={`px-4 py-3 rounded-lg font-semibold transition-all border-2 ${
                ticketType === 'other'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-600 hover:border-blue-300'
              }`}
            >
              🎫 기타 티켓
            </button>
          </div>
        </SectionBox>

        {ticketType === 'dragon' ? (
          <>
            {/* 드래곤펄 선택 */}
            <SectionBox title="드래곤펄 선택">
              {dragonTours.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Info className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p>사용 가능한 드래곤펄 티켓이 없습니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      드래곤펄 티켓 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedTourId}
                      onChange={(e) => setSelectedTourId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">선택해주세요</option>
                      {dragonTours.map((t) => (
                        <option key={t.tour_id} value={t.tour_id}>
                          {t.tour_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      수량 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={ticketQuantity}
                      onChange={(e) => setTicketQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </SectionBox>

            {/* 요코온센 프로그램 */}
            {yokoTours.length > 0 && (
              <SectionBox title="프로그램 선택 (선택사항)">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    요코온센 프로그램
                  </label>
                  <select
                    value={programSelection}
                    onChange={(e) => setProgramSelection(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">선택 안함</option>
                    {yokoTours.map((t) => (
                      <option key={t.tour_id} value={t.tour_name}>
                        {t.tour_name}
                      </option>
                    ))}
                  </select>
                </div>
              </SectionBox>
            )}

            {/* 셔틀 / 픽업 */}
            <SectionBox title="셔틀 차량 / 픽업 정보">
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shuttleRequired}
                    onChange={(e) => setShuttleRequired(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    셔틀 차량 필요 (1인당 약 25만동)
                  </span>
                </label>

                {shuttleRequired && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 p-3 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        픽업 위치 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={pickupLocation}
                        onChange={(e) => setPickupLocation(e.target.value.toUpperCase())}
                        placeholder="영문으로 입력 (예: HANOI)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        드롭 위치 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={dropoffLocation}
                        onChange={(e) => setDropoffLocation(e.target.value.toUpperCase())}
                        placeholder="영문으로 입력 (예: HOTEL ABC)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {locationError && (
                  <p className="text-sm text-red-500 mt-2">{locationError}</p>
                )}
              </div>
            </SectionBox>
          </>
        ) : (
          <>
            {/* 기타 티켓 정보 */}
            <SectionBox title="기타 티켓 정보">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    티켓명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={otherTicketName}
                    onChange={(e) => setOtherTicketName(e.target.value)}
                    placeholder="예: 빈펄랜드 입장권"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      수량 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={ticketQuantity}
                      onChange={(e) => setTicketQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      프로그램 선택 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={programSelection}
                      onChange={(e) => setProgramSelection(e.target.value)}
                      placeholder="예: 성인 입장권"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    상세 내용 (선택사항)
                  </label>
                  <textarea
                    rows={3}
                    value={otherTicketDetails}
                    onChange={(e) => setOtherTicketDetails(e.target.value)}
                    placeholder="티켓 상세 내용을 입력하세요"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
            </SectionBox>
          </>
        )}

        {/* 일정 / 요청사항 */}
        <SectionBox title={<><Calendar className="w-5 h-5 inline mr-2" />일정 / 요청사항</>}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이용 날짜 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={ticketDate}
                onChange={(e) => setTicketDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                추가 요청사항 (선택사항)
              </label>
              <textarea
                rows={3}
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="특별히 요청하실 내용을 입력하세요"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        </SectionBox>

        {/* 버튼 */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <>
                <Spinner size="sm" /> 예약 중...
              </>
            ) : (
              <>
                <Ticket className="w-4 h-4" /> 예약하기
              </>
            )}
          </button>
        </div>
      </form>
    </PageWrapper>
  );
}

