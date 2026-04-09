'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import PageWrapper from '@/components/PageWrapper';
import SectionBox from '@/components/SectionBox';
import { useReservations, useReservationAdditionalData } from '../../../../hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';

interface Reservation {
  re_id: string;
  re_type: string;
  re_status: string;
  re_created_at: string;
  re_quote_id: string | null;
}

export default function MyReservationsListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | undefined>(undefined);

  // 사용자 정보 로드
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);
    });
  }, [router]);

  // React Query 훅 사용
  const { data: reservationsData = [], isLoading: isReservationsLoading } = useReservations(userId);
  const reservations = reservationsData as Reservation[];

  const { data: additionalData, isLoading: isAdditionalLoading } = useReservationAdditionalData(reservations);

  // 추가 데이터 구조 분해
  const {
    quotesById = {},
    cruiseMeta = {},
    amountsByReservation = {},
    paymentStatusByReservation = {}
  } = additionalData || {};

  const loading = isReservationsLoading || isAdditionalLoading;

  // UI 상태



  const statusText = (s: string) => (
    s === 'pending' ? '대기중' :
      s === 'confirmed' ? '확정됨' :
        s === 'processing' ? '처리중' :
          s === 'cancelled' ? '취소됨' :
            s === 'completed' ? '완료됨' : s
  );

  const statusBadgeClass = (s: string) => (
    s === 'pending' ? 'bg-yellow-50 text-yellow-700' :
      s === 'confirmed' ? 'bg-green-50 text-green-700' :
        s === 'processing' ? 'bg-blue-50 text-blue-700' :
          s === 'cancelled' ? 'bg-red-50 text-red-700 line-through' :
            s === 'completed' ? 'bg-purple-50 text-purple-700' : 'bg-gray-50 text-gray-600'
  );

  const typeName = (t: string) => (
    t === 'cruise' ? '크루즈' :
      t === 'airport' ? '공항' :
        t === 'hotel' ? '호텔' :
          t === 'tour' ? '투어' :
            t === 'rentcar' ? '렌터카' :
              t === 'car' ? '크루즈 차량' :
                t === 'cruise_car' ? '크루즈 차량' :
                  t === 'sht_car' || t === 'sht' ? '스하차량' : t
  );

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('ko-KR');
  };

  const cruiseTitle = (r: Reservation) => {
    const meta = cruiseMeta[r.re_id];
    if (!meta) return formatDate(r.re_created_at);
    const date = meta.checkin ? formatDate(meta.checkin) : '날짜 미정';
    // 성인/아동/유아 상세 표시
    const parts: string[] = [];
    if (meta.adult_count > 0) parts.push(`성인${meta.adult_count}`);
    if (meta.child_count > 0) parts.push(`아동${meta.child_count}`);
    if (meta.infant_count > 0) parts.push(`유아${meta.infant_count}`);
    const paxLabel = parts.length > 0 ? parts.join(' ') : `${meta.guest_count || 0}명`;
    return `${date} · ${paxLabel}`;
  };





  if (loading) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-72">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400" />
          <p className="mt-4 text-sm text-gray-600">예약 정보를 로딩 중...</p>
        </div>
      </PageWrapper>
    );
  }

  // 그룹화 (견적 기준)
  const groups = reservations.reduce((acc, r) => {
    const key = r.re_quote_id || 'no-quote';
    (acc[key] ||= []).push(r);
    return acc;
  }, {} as Record<string, Reservation[]>);
  const groupEntries = Object.entries(groups).sort(([, a], [, b]) => {
    const ta = Math.max(...a.map(x => new Date(x.re_created_at).getTime()));
    const tb = Math.max(...b.map(x => new Date(x.re_created_at).getTime()));
    return tb - ta;
  });

  return (
    <PageWrapper>
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="rounded-xl bg-gradient-to-r from-sky-100 via-blue-50 to-indigo-50 border border-sky-200 px-6 py-6 mb-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-800">📋 예약 정보</h1>
            <button
              onClick={() => router.push('/mypage')}
              className="px-3 py-1.5 rounded-md bg-sky-500 text-white text-xs font-medium hover:bg-sky-600 transition-colors"
            >홈으로</button>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex flex-col">
              <span className="text-gray-500">총 예약</span>
              <span className="font-semibold text-gray-900">{reservations.length}건</span>
            </div>

          </div>
        </div>

        {/* 내용 */}
        <SectionBox>
          {reservations.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center">
              <div className="text-5xl mb-4">🗂️</div>
              <p className="text-gray-500 text-sm">등록된 예약이 없습니다.</p>
            </div>
          )}
          {groupEntries.map(([qid, list]) => {
            const title = qid === 'no-quote' ? '견적 연결 없음' : (quotesById[qid]?.title || '제목 없음');
            return (
              <div key={qid} className="mb-8">
                {/* 그룹 헤더(견적 제목/견적 보기/서비스 배지) 제거됨 */}
                <div className="space-y-2">
                  {list.sort((a, b) => {
                    const typeOrder: Record<string, number> = {
                      cruise: 1,
                      cruise_car: 2,
                      car: 2,
                      airport: 3,
                      tour: 4,
                      rentcar: 5,
                      hotel: 6,
                      sht_car: 7,
                      sht: 7
                    };
                    const orderA = typeOrder[a.re_type] || 99;
                    const orderB = typeOrder[b.re_type] || 99;
                    if (orderA !== orderB) return orderA - orderB;
                    return new Date(b.re_created_at).getTime() - new Date(a.re_created_at).getTime();
                  }).map(r => {
                    const amount = amountsByReservation[r.re_id] || 0;
                    const pay = paymentStatusByReservation[r.re_id];
                    const completed = pay?.hasCompleted;
                    const dateLabel = r.re_type === 'cruise' ? cruiseTitle(r) : formatDate(r.re_created_at);
                    return (
                      <div
                        key={r.re_id}
                        className="group border rounded-lg px-4 py-3 bg-white/70 backdrop-blur-sm flex items-center justify-between hover:shadow-sm transition"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{typeName(r.re_type)}</span>
                            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${statusBadgeClass(r.re_status)}`}>{statusText(r.re_status)}</span>
                            {completed && <span className="px-2 py-0.5 rounded text-[11px] bg-green-600 text-white">결제완료</span>}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-3">
                            <span>{dateLabel}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/mypage/reservations/${r.re_id}/view`)}
                            className="px-3 py-1.5 rounded-md bg-blue-500 text-white text-xs font-medium hover:bg-blue-600"
                          >상세</button>
                          {/* 확인서 버튼 삭제됨 */}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </SectionBox>


      </div>
    </PageWrapper>
  );
}
