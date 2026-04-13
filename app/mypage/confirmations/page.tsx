'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PageWrapper from '@/components/layout/PageWrapper';
import SectionBox from '@/components/layout/SectionBox';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import supabase from '@/lib/supabase';
import { formatKst } from '@/lib/kstDateTime';
import { FileText, Download } from 'lucide-react';

interface ConfirmableReservation {
  re_id: string;
  re_type: string;
  re_status: string;
  re_created_at: string;
}

const SERVICE_LABELS: Record<string, string> = {
  cruise: '크루즈', airport: '공항 이동', hotel: '호텔',
  tour: '투어', rentcar: '렌터카', ticket: '티켓', package: '패키지',
};

const DETAIL_TABLE: Record<string, string> = {
  cruise: 'reservation_cruise', airport: 'reservation_airport',
  hotel: 'reservation_hotel', tour: 'reservation_tour',
  rentcar: 'reservation_rentcar', ticket: 'reservation_tour', package: 'reservation_package',
};

export default function ConfirmationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [reservations, setReservations] = useState<ConfirmableReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [printData, setPrintData] = useState<Record<string, unknown> | null>(null);

  /* ── 확정/처리완료 예약 로드 ── */
  useEffect(() => {
    if (!user) return;
    supabase
      .from('reservation')
      .select('re_id, re_type, re_status, re_created_at')
      .eq('re_user_id', user.id)
      .in('re_status', ['confirmed', 'completed', 'processing'])
      .order('re_created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setReservations(data);
        setLoading(false);
      });
  }, [user]);

  /* ── PDF 생성 ── */
  const generatePdf = useCallback(async (resId: string, resType: string) => {
    setGenerating(resId);
    try {
      // 상세 정보 로드
      const table = DETAIL_TABLE[resType];
      if (!table) return;

      const [resResult, detailResult, userResult] = await Promise.all([
        supabase.from('reservation').select('*').eq('re_id', resId).single(),
        supabase.from(table).select('*').eq('reservation_id', resId),
        supabase.from('users').select('name, email, phone').eq('id', user!.id).maybeSingle(),
      ]);

      const res = resResult.data;
      const details = detailResult.data ?? [];
      const userData = userResult.data;

      if (!res) return;

      setPrintData({ reservation: res, details, user: userData, serviceType: resType });

      // html2pdf 동적 로드
      await new Promise((r) => setTimeout(r, 100)); // DOM 업데이트 대기
      const html2pdf = (await import('html2pdf.js')).default;
      const element = printRef.current;
      if (!element) return;

      await html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: `예약확인서_${resId.slice(0, 8)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(element).save();
    } finally {
      setGenerating(null);
      setPrintData(null);
    }
  }, [user]);

  if (authLoading || loading) return <Spinner className="h-72" />;
  if (!user) { router.replace('/login'); return null; }

  return (
    <PageWrapper title="예약 확인서" description="확정된 예약의 확인서를 다운로드하세요">
      {reservations.length === 0 ? (
        <EmptyState message="확정된 예약이 없습니다" />
      ) : (
        <div className="space-y-3">
          {reservations.map((r) => (
            <div key={r.re_id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium text-gray-900">{SERVICE_LABELS[r.re_type] ?? r.re_type}</p>
                  <p className="text-sm text-gray-500">{formatKst(r.re_created_at)}</p>
                </div>
              </div>
              <button
                className="btn btn-primary text-xs"
                disabled={generating === r.re_id}
                onClick={() => generatePdf(r.re_id, r.re_type)}
              >
                {generating === r.re_id ? <Spinner size="sm" /> : <><Download className="w-3.5 h-3.5 mr-1" />PDF</>}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* PDF 렌더용 숨김 영역 */}
      {printData && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
          <div ref={printRef} style={{ width: '210mm', padding: '20mm', fontFamily: 'Pretendard, sans-serif', fontSize: '12px', color: '#111' }}>
            <ConfirmationContent data={printData} />
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

/* ── 확인서 내용 ── */
function ConfirmationContent({ data }: { data: Record<string, unknown> }) {
  const reservation = data.reservation as Record<string, unknown>;
  const details = data.details as Record<string, unknown>[];
  const userData = data.user as Record<string, unknown> | null;
  const serviceType = data.serviceType as string;

  return (
    <div>
      {/* 헤더 */}
      <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #2563eb', paddingBottom: '15px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e40af', margin: 0 }}>예약 확인서</h1>
        <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>BOOKING CONFIRMATION</p>
      </div>

      {/* 고객 정보 */}
      <table style={{ width: '100%', marginBottom: '15px', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={cellStyle}>예약자</td>
            <td style={valStyle}>{(userData?.name as string) ?? '-'}</td>
            <td style={cellStyle}>이메일</td>
            <td style={valStyle}>{(userData?.email as string) ?? '-'}</td>
          </tr>
          <tr>
            <td style={cellStyle}>연락처</td>
            <td style={valStyle}>{(userData?.phone as string) ?? '-'}</td>
            <td style={cellStyle}>예약일</td>
            <td style={valStyle}>{reservation.re_created_at ? formatKst(reservation.re_created_at as string) : '-'}</td>
          </tr>
        </tbody>
      </table>

      {/* 서비스 정보 */}
      <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1e40af' }}>
        {SERVICE_LABELS[serviceType] ?? serviceType} 상세
      </h3>
      {details.map((detail, idx) => {
        // === 크루즈 ===
        if (serviceType === 'cruise') {
          const checkin = detail.checkin || '-';
          const cruiseName = (detail.cruise_room_info || '').split(' ')[0] || '-';
          const roomName = (detail.cruise_room_info || '').split(' ').slice(1).join(' ') || '-';
          const guestCount = detail.guest_count || '-';
          const adultCount = detail.adult_count || '-';
          const roomCount = detail.room_count || '-';
          const unitPrice = Number(detail.unit_price) || 0;
          const childUnitPrice = Number(detail.child_unit_price) || 0;
          const adultCnt = Number(detail.adult_count) || 0;
          const childCnt = Number(detail.child_count) || 0;
          const totalPrice = detail.room_total_price || '-';

          const adultPrice = unitPrice * adultCnt * (Number(roomCount) || 1);
          const childPrice = childUnitPrice * childCnt * (Number(roomCount) || 1);

          return (
            <table key={idx} style={{ width: '100%', marginBottom: '10px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={cellStyle}>체크인</td>
                  <td style={valStyle}>{checkin}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>크루즈명</td>
                  <td style={valStyle}>{cruiseName}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>객실명</td>
                  <td style={valStyle}>{roomName}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>인원</td>
                  <td style={valStyle}>{guestCount}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>성인</td>
                  <td style={valStyle}>{adultCount}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>객실 수</td>
                  <td style={valStyle}>{roomCount}</td>
                </tr>
                {unitPrice > 0 && (
                  <tr>
                    <td style={cellStyle}>객실 단가</td>
                    <td style={valStyle}>성인({unitPrice.toLocaleString()} VND) × {adultCnt} = {adultPrice.toLocaleString()} VND</td>
                  </tr>
                )}
                {childPrice > 0 && (
                  <tr>
                    <td style={cellStyle}></td>
                    <td style={valStyle}>아동({childUnitPrice.toLocaleString()} VND) × {childCnt} = {childPrice.toLocaleString()} VND</td>
                  </tr>
                )}
                <tr>
                  <td style={cellStyle}>총 가격</td>
                  <td style={valStyle}>{totalPrice}</td>
                </tr>
              </tbody>
            </table>
          );
        }

        // === 호텔 ===
        if (serviceType === 'hotel') {
          const checkin = detail.checkin_date || '-';
          const roomCount = detail.room_count || '-';
          const guestCount = detail.guest_count || '-';
          const unitPrice = Number(detail.unit_price) || 0;
          const totalPrice = detail.total_price || '-';

          const totalCalc = unitPrice * (Number(guestCount) || 1) * (Number(roomCount) || 1);

          return (
            <table key={idx} style={{ width: '100%', marginBottom: '10px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={cellStyle}>체크인</td>
                  <td style={valStyle}>{checkin}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>인원</td>
                  <td style={valStyle}>{guestCount}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>객실 수</td>
                  <td style={valStyle}>{roomCount}</td>
                </tr>
                {unitPrice > 0 && (
                  <tr>
                    <td style={cellStyle}>객실 단가</td>
                    <td style={valStyle}>{unitPrice.toLocaleString()} VND × {guestCount} = {totalCalc.toLocaleString()} VND</td>
                  </tr>
                )}
                <tr>
                  <td style={cellStyle}>총 가격</td>
                  <td style={valStyle}>{totalPrice}</td>
                </tr>
              </tbody>
            </table>
          );
        }

        // === 공항 이동 ===
        if (serviceType === 'airport') {
          const wayType = detail.way_type || '-';
          const datetime = detail.ra_datetime || '-';
          const passengerCount = detail.ra_passenger_count || '-';
          const unitPrice = Number(detail.unit_price) || 0;
          const totalPrice = detail.total_price || '-';

          const totalCalc = unitPrice * (Number(passengerCount) || 1);

          return (
            <table key={idx} style={{ width: '100%', marginBottom: '10px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={cellStyle}>편도/왕복</td>
                  <td style={valStyle}>{wayType}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>일시</td>
                  <td style={valStyle}>{datetime}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>인원</td>
                  <td style={valStyle}>{passengerCount}</td>
                </tr>
                {unitPrice > 0 && (
                  <tr>
                    <td style={cellStyle}>단가</td>
                    <td style={valStyle}>{unitPrice.toLocaleString()} VND × {passengerCount} = {totalCalc.toLocaleString()} VND</td>
                  </tr>
                )}
                <tr>
                  <td style={cellStyle}>총 가격</td>
                  <td style={valStyle}>{totalPrice}</td>
                </tr>
              </tbody>
            </table>
          );
        }

        // === 투어 ===
        if (serviceType === 'tour') {
          const tourDate = detail.usage_date || '-';
          const tourCapacity = detail.tour_capacity || '-';
          const unitPrice = Number(detail.unit_price) || 0;
          const totalPrice = detail.total_price || '-';

          const totalCalc = unitPrice * (Number(tourCapacity) || 1);

          return (
            <table key={idx} style={{ width: '100%', marginBottom: '10px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={cellStyle}>투어 날짜</td>
                  <td style={valStyle}>{tourDate}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>인원</td>
                  <td style={valStyle}>{tourCapacity}</td>
                </tr>
                {unitPrice > 0 && (
                  <tr>
                    <td style={cellStyle}>단가</td>
                    <td style={valStyle}>{unitPrice.toLocaleString()} VND × {tourCapacity} = {totalCalc.toLocaleString()} VND</td>
                  </tr>
                )}
                <tr>
                  <td style={cellStyle}>총 가격</td>
                  <td style={valStyle}>{totalPrice}</td>
                </tr>
              </tbody>
            </table>
          );
        }

        // === 렌터카 ===
        if (serviceType === 'rentcar') {
          const wayType = detail.way_type || '-';
          const pickupDatetime = detail.pickup_datetime || '-';
          const returnDatetime = detail.return_datetime || '-';
          const carCount = detail.car_count || '-';
          const passengerCount = detail.passenger_count || '-';
          const unitPrice = Number(detail.unit_price) || 0;
          const totalPrice = detail.total_price || '-';

          const totalCalc = unitPrice * (Number(carCount) || 1);

          return (
            <table key={idx} style={{ width: '100%', marginBottom: '10px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={cellStyle}>유형</td>
                  <td style={valStyle}>{wayType}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>출발 일시</td>
                  <td style={valStyle}>{pickupDatetime}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>반환 일시</td>
                  <td style={valStyle}>{returnDatetime}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>인원</td>
                  <td style={valStyle}>{passengerCount}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>차량 대수</td>
                  <td style={valStyle}>{carCount}</td>
                </tr>
                {unitPrice > 0 && (
                  <tr>
                    <td style={cellStyle}>단가</td>
                    <td style={valStyle}>{unitPrice.toLocaleString()} VND × {carCount} = {totalCalc.toLocaleString()} VND</td>
                  </tr>
                )}
                <tr>
                  <td style={cellStyle}>총 가격</td>
                  <td style={valStyle}>{totalPrice}</td>
                </tr>
              </tbody>
            </table>
          );
        }

        // === 티켓 ===
        if (serviceType === 'ticket') {
          const usageDate = detail.usage_date || '-';
          const tourCapacity = detail.tour_capacity || '-';
          const unitPrice = Number(detail.unit_price) || 0;
          const totalPrice = detail.total_price || '-';

          const totalCalc = unitPrice * (Number(tourCapacity) || 1);

          return (
            <table key={idx} style={{ width: '100%', marginBottom: '10px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={cellStyle}>이용 날짜</td>
                  <td style={valStyle}>{usageDate}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>수량</td>
                  <td style={valStyle}>{tourCapacity}</td>
                </tr>
                {unitPrice > 0 && (
                  <tr>
                    <td style={cellStyle}>단가</td>
                    <td style={valStyle}>{unitPrice.toLocaleString()} VND × {tourCapacity} = {totalCalc.toLocaleString()} VND</td>
                  </tr>
                )}
                <tr>
                  <td style={cellStyle}>총 가격</td>
                  <td style={valStyle}>{totalPrice}</td>
                </tr>
              </tbody>
            </table>
          );
        }

        // === 패키지 ===
        if (serviceType === 'package') {
          const adultCount = detail.adult_count || '-';
          const childExtraBed = detail.child_extra_bed || '-';
          const childNoExtraBed = detail.child_no_extra_bed || '-';
          const infantFree = detail.infant_free || '-';
          const totalPrice = detail.total_price || '-';

          return (
            <table key={idx} style={{ width: '100%', marginBottom: '10px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={cellStyle}>성인</td>
                  <td style={valStyle}>{adultCount}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>아동 (엑스트라베드)</td>
                  <td style={valStyle}>{childExtraBed}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>아동 (베드 미사용)</td>
                  <td style={valStyle}>{childNoExtraBed}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>유아 (무료)</td>
                  <td style={valStyle}>{infantFree}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>총 가격</td>
                  <td style={valStyle}>{totalPrice}</td>
                </tr>
              </tbody>
            </table>
          );
        }

        // === 기타 (기본) ===
        return (
          <table key={idx} style={{ width: '100%', marginBottom: '10px', borderCollapse: 'collapse' }}>
            <tbody>
              {Object.entries(detail)
                .filter(([k]) => !['id', 'reservation_id', 'created_at', 'updated_at'].includes(k))
                .map(([key, val]) => (
                  <tr key={key}>
                    <td style={cellStyle}>{key}</td>
                    <td style={valStyle}>{val === null ? '-' : String(val)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        );
      })}

      {/* 푸터 */}
      <div style={{ marginTop: '30px', borderTop: '1px solid #e5e7eb', paddingTop: '10px', textAlign: 'center', fontSize: '10px', color: '#9ca3af' }}>
        <p>본 확인서는 예약 확인 목적으로 발행되었습니다.</p>
        <p>StayHalong Cruise Booking System</p>
      </div>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: '6px 10px', fontSize: '11px', color: '#6b7280',
  borderBottom: '1px solid #f3f4f6', width: '25%', verticalAlign: 'top',
};

const valStyle: React.CSSProperties = {
  padding: '6px 10px', fontSize: '12px', color: '#111827',
  borderBottom: '1px solid #f3f4f6', width: '25%',
};
