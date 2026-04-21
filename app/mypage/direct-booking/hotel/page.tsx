'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PageWrapper from '@/components/layout/PageWrapper';
import SectionBox from '@/components/layout/SectionBox';
import Spinner from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import supabase from '@/lib/supabase';
import { submitReservation } from '@/lib/submitReservation';
import { Hotel } from 'lucide-react';

interface HotelPriceRow {
  hotel_price_code: string;
  hotel_name: string;
  room_name: string;
  base_price: number;
  weekday: string;
  valid_from: string;
  valid_to: string;
}

function calculateNights(checkin: string, checkout: string): number {
  if (!checkin || !checkout) return 0;
  const diff = new Date(checkout).getTime() - new Date(checkin).getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

export default function HotelBookingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [hotelPrices, setHotelPrices] = useState<HotelPriceRow[]>([]);
  const [hotelNames, setHotelNames] = useState<string[]>([]);
  const [selectedHotel, setSelectedHotel] = useState('');
  const [roomNames, setRoomNames] = useState<string[]>([]);
  const [selectedRoom, setSelectedRoom] = useState('');

  const [checkinDate, setCheckinDate] = useState('');
  const [checkoutDate, setCheckoutDate] = useState('');
  const [roomCount, setRoomCount] = useState(1);
  const [adultCount, setAdultCount] = useState(2);
  const [childCount, setChildCount] = useState(0);
  const [specialRequests, setSpecialRequests] = useState('');

  const [submitting, setSubmitting] = useState(false);

  /* ── 호텔 가격 로드 ── */
  useEffect(() => {
    supabase
      .from('hotel_price')
      .select('hotel_price_code, hotel_name, room_name, base_price, weekday, valid_from, valid_to')
      .then(({ data }) => {
        if (data) {
          setHotelPrices(data);
          setHotelNames([...new Set(data.map((r) => r.hotel_name))]);
        }
      });
  }, []);

  /* ── 호텔 선택 시 객실 필터 ── */
  useEffect(() => {
    if (!selectedHotel) { setRoomNames([]); setSelectedRoom(''); return; }
    const rooms = [...new Set(hotelPrices.filter((r) => r.hotel_name === selectedHotel).map((r) => r.room_name))];
    setRoomNames(rooms);
    if (rooms.length && !rooms.includes(selectedRoom)) setSelectedRoom(rooms[0]);
  }, [selectedHotel, hotelPrices]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 가격 매칭 ── */
  const matchedPrice = useMemo(() => {
    if (!selectedHotel || !selectedRoom || !checkinDate) return null;
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(checkinDate).getDay()];
    return hotelPrices.find(
      (r) =>
        r.hotel_name === selectedHotel &&
        r.room_name === selectedRoom &&
        r.weekday === weekday &&
        r.valid_from <= checkinDate &&
        r.valid_to >= checkinDate,
    ) ?? hotelPrices.find(
      (r) => r.hotel_name === selectedHotel && r.room_name === selectedRoom,
    ) ?? null;
  }, [selectedHotel, selectedRoom, checkinDate, hotelPrices]);

  const nights = calculateNights(checkinDate, checkoutDate);
  const totalPrice = (matchedPrice?.base_price ?? 0) * roomCount * nights;
  const schedule = nights > 0 ? `${nights}박${nights + 1}일` : '';

  /* ── 제출 ── */
  const handleSubmit = async () => {
    if (!user) return;
    if (!selectedHotel || !selectedRoom) { alert('호텔 / 객실을 선택하세요.'); return; }
    if (!checkinDate || !checkoutDate) { alert('체크인/아웃 날짜를 입력하세요.'); return; }
    if (nights <= 0) { alert('체크아웃은 체크인 이후여야 합니다.'); return; }

    setSubmitting(true);
    try {
      const { error } = await submitReservation('hotel', {
        formData: { checkin_date: checkinDate, checkout_date: checkoutDate, room_count: roomCount, adult_count: adultCount, child_count: childCount, special_requests: specialRequests },
        selectedHotel: matchedPrice ?? { hotel_name: selectedHotel, room_name: selectedRoom, hotel_price_code: '', base_price: 0 },
        nights,
        schedule,
      });
      if (error) { alert(`예약 오류: ${error}`); return; }
      alert('호텔 예약이 완료되었습니다! 다른 서비스를 계속 예약할 수 있습니다.');
      router.push('/mypage/direct-booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <Spinner className="h-72" />;
  if (!user) { router.replace('/login'); return null; }

  return (
    <PageWrapper title="호텔 예약" description="호텔 객실을 예약하세요">
      <SectionBox title="호텔 선택">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">호텔</label>
            <select value={selectedHotel} onChange={(e) => setSelectedHotel(e.target.value)}>
              <option value="">선택</option>
              {hotelNames.map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">객실 타입</label>
            <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} disabled={!roomNames.length}>
              <option value="">선택</option>
              {roomNames.map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </SectionBox>

      <SectionBox title="일정">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">체크인</label>
            <input type="date" value={checkinDate} onChange={(e) => setCheckinDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">체크아웃</label>
            <input type="date" value={checkoutDate} onChange={(e) => setCheckoutDate(e.target.value)} min={checkinDate} />
          </div>
        </div>
        {schedule && <p className="mt-2 text-sm text-gray-500">{schedule}</p>}
      </SectionBox>

      <SectionBox title="인원">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">객실 수</label>
            <input type="number" min={1} value={roomCount || ''} onChange={(e) => setRoomCount(e.target.value === '' ? 0 : Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">성인</label>
            <input type="number" min={1} value={adultCount || ''} onChange={(e) => setAdultCount(e.target.value === '' ? 0 : Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">아동</label>
            <input type="number" min={0} value={childCount || ''} onChange={(e) => setChildCount(e.target.value === '' ? 0 : Number(e.target.value))} />
          </div>
        </div>
      </SectionBox>

      <SectionBox title="요청 사항">
        <textarea rows={3} value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="특별 요청사항 (예: 늦은 체크인, 조식 추가 등)" />
      </SectionBox>



      <div className="flex justify-end gap-3 mt-4">
        <button className="btn btn-secondary" onClick={() => router.back()}>취소</button>
        <button className="btn btn-primary" disabled={submitting} onClick={handleSubmit}>
          {submitting ? <Spinner size="sm" /> : <><Hotel className="w-4 h-4 mr-1" />예약하기</>}
        </button>
      </div>
    </PageWrapper>
  );
}
