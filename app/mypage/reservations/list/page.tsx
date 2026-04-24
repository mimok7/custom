'use client';

import { useRouter } from 'next/navigation';
import PageWrapper from '@/components/layout/PageWrapper';
import SectionBox from '@/components/layout/SectionBox';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { useReservations, useReservationAdditionalData } from '@/hooks/useQueries';
import { formatKst } from '@/lib/kstDateTime';
import { Ship, Plane, Hotel, MapPin, Car, Ticket, Package, Eye } from 'lucide-react';

const SERVICE_META: Record<string, { icon: typeof Ship; label: string; color: string }> = {
  cruise:     { icon: Ship,    label: '크루즈',   color: 'bg-blue-50 text-blue-600' },
  car:        { icon: Car,     label: '크루즈 차량', color: 'bg-cyan-50 text-cyan-600' },
  airport:    { icon: Plane,   label: '공항',     color: 'bg-orange-50 text-orange-600' },
  hotel:      { icon: Hotel,   label: '호텔',     color: 'bg-purple-50 text-purple-600' },
  tour:       { icon: MapPin,  label: '투어',     color: 'bg-green-50 text-green-600' },
  rentcar:    { icon: Car,     label: '렌터카',   color: 'bg-red-50 text-red-600' },
  ticket:     { icon: Ticket,  label: '티켓',     color: 'bg-teal-50 text-teal-600' },
  package:    { icon: Package, label: '패키지',   color: 'bg-indigo-50 text-indigo-600' },
  sht_car:    { icon: Car,     label: '스하차량', color: 'bg-indigo-50 text-indigo-600' },
  sht:        { icon: Car,     label: '스하차량', color: 'bg-indigo-50 text-indigo-600' },
};

const STATUS_BADGE: Record<string, { bg: string; label: string }> = {
  pending:    { bg: 'bg-yellow-50 text-yellow-700', label: '대기중' },
  confirmed:  { bg: 'bg-green-50 text-green-700',   label: '확정됨' },
  processing: { bg: 'bg-blue-50 text-blue-700',     label: '처리중' },
  cancelled:  { bg: 'bg-red-50 text-red-700',       label: '취소됨' },
  completed:  { bg: 'bg-purple-50 text-purple-700',  label: '완료' },
};

export default function ReservationListPage() {
  const { user, loading: authLoading } = useAuth(undefined, '/login', true);
  const router = useRouter();

  const {
    data: reservations,
    isLoading,
    isError,
    error,
    refetch,
  } = useReservations((user?.id as string) ?? '');
  const { data: additionalData } = useReservationAdditionalData(reservations ?? []);

  const TYPE_ORDER: Record<string, number> = {
    cruise: 0, airport: 1, tour: 2, rentcar: 3, hotel: 4, package: 5, ticket: 6, car: 7, sht_car: 8, sht: 8,
  };

  // cruise_car / car 는 크루즈 상세보기에 포함되므로 목록에서 제외
  const allReservations = (reservations ?? []).filter(
    r => r.re_type !== 'cruise_car' && r.re_type !== 'car'
  );
  const quotesById = additionalData?.quotesById ?? {};

  // 견적별 그룹핑
  const groups: Array<{ quoteId: string | null; items: typeof allReservations }> = [];
  const groupMap = new Map<string, typeof allReservations>();
  allReservations.forEach(r => {
    const key = r.re_quote_id ?? '__none__';
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(r);
  });
  // 각 그룹을 타입 순서로 정렬, 그룹은 첫 번째 예약의 생성일 기준 최신순
  groupMap.forEach((items, key) => {
    items.sort((a, b) => (TYPE_ORDER[a.re_type] ?? 99) - (TYPE_ORDER[b.re_type] ?? 99));
    groups.push({ quoteId: key === '__none__' ? null : key, items });
  });
  groups.sort((a, b) => {
    const ta = a.items[0]?.re_created_at ? new Date(a.items[0].re_created_at).getTime() : 0;
    const tb = b.items[0]?.re_created_at ? new Date(b.items[0].re_created_at).getTime() : 0;
    return tb - ta;
  });

  if (authLoading || isLoading) return <Spinner className="h-72" />;
  if (!user) return null;

  if (isError) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : '예약 목록을 불러오지 못했습니다.';

    return (
      <PageWrapper title="예약 내역" description="예약 목록을 확인하세요">
        <SectionBox title="조회 실패">
          <div className="space-y-3">
            <p className="text-sm text-red-600">{message}</p>
            <button className="btn btn-primary text-xs" onClick={() => refetch()}>
              다시 시도
            </button>
          </div>
        </SectionBox>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="예약 내역" description="예약 목록을 확인하세요">
      {allReservations.length === 0 ? (
        <EmptyState message="예약 내역이 없습니다" />
      ) : (
        <div className="space-y-6">
          {groups.map(({ quoteId, items }) => {
            const quote = quoteId ? quotesById[quoteId] : null;
            return (
              <div key={quoteId ?? 'none'} className="space-y-2">
                {quote && (
                  <div className="text-xs font-semibold text-gray-500 px-1 pb-1 border-b border-gray-100">
                    📋 {quote.title}
                  </div>
                )}
                {items.map((r) => {
                  const meta = SERVICE_META[r.re_type] ?? SERVICE_META.cruise;
                  const status = STATUS_BADGE[r.re_status] ?? STATUS_BADGE.pending;
                  const Icon = meta.icon;
                  const cruiseMeta = additionalData?.cruiseMeta?.[r.re_id];
                  const amount = additionalData?.amountsByReservation?.[r.re_id];
                  const payment = additionalData?.paymentStatusByReservation?.[r.re_id];

                  return (
                    <button key={r.re_id}
                      className="card w-full text-left flex items-center gap-4 hover:shadow-md transition-shadow"
                      onClick={() => router.push(`/mypage/reservations/${r.re_id}/view`)}>
                      <div className={`p-2.5 rounded-lg ${meta.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">{meta.label}</span>
                          <span className={`badge ${status.bg}`}>{status.label}</span>
                          {payment?.hasCompleted && (
                            <span className="badge bg-emerald-50 text-emerald-700">💳 결제완료</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-0.5 truncate">
                          {cruiseMeta?.checkin
                            ? `${new Date(String(cruiseMeta.checkin)).toLocaleDateString('ko-KR')} · 성인${cruiseMeta.adult_count ?? 0}`
                            : formatKst(r.re_created_at)}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {amount ? (
                          <span className="text-sm font-semibold text-gray-700">{amount.toLocaleString()} VND</span>
                        ) : null}
                        <Eye className="w-4 h-4 text-gray-400 mt-1 ml-auto" />
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </PageWrapper>
  );
}
