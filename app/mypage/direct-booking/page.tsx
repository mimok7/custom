'use client';

import { useRouter } from 'next/navigation';
import PageWrapper from '@/components/layout/PageWrapper';
import { useAuth } from '@/hooks/useAuth';
import Spinner from '@/components/ui/Spinner';
import { useReservations } from '@/hooks/useQueries';
import {
  Ship, Plane, Hotel, MapPin, Car, Ticket, Package,
} from 'lucide-react';

const SERVICES = [
  { key: 'cruise',  label: '크루즈',     icon: Ship,    color: 'bg-blue-50 text-blue-600',   desc: '하롱베이 크루즈 예약' },
  { key: 'airport', label: '공항 이동',  icon: Plane,   color: 'bg-green-50 text-green-600',  desc: '공항 픽업 / 샌딩' },
  { key: 'hotel',   label: '호텔',       icon: Hotel,   color: 'bg-purple-50 text-purple-600', desc: '호텔 객실 예약' },
  { key: 'tour',    label: '투어',       icon: MapPin,  color: 'bg-orange-50 text-orange-600', desc: '당일 투어 예약' },
  { key: 'rentcar', label: '렌터카',     icon: Car,     color: 'bg-red-50 text-red-600',      desc: '렌터카 / 차량 예약' },
  { key: 'ticket',  label: '티켓',       icon: Ticket,  color: 'bg-teal-50 text-teal-600',    desc: '드래곤펄 / 기타 티켓' },
  { key: 'package', label: '패키지',     icon: Package, color: 'bg-indigo-50 text-indigo-600', desc: '패키지 상품 예약' },
] as const;

export default function DirectBookingPage() {
  const { user, loading } = useAuth(undefined, '/login', true);
  const router = useRouter();
  const { data: reservations = [], isLoading: reservationsLoading } = useReservations(user?.id);

  // 서비스별 완료 예약 확인
  const completedServices = new Set(
    reservations
      .filter((res) => res.re_status === 'completed')
      .map((res) => res.re_type),
  );

  if (loading || reservationsLoading) return <Spinner className="h-72" />;
  if (!user) return null;

  return (
    <PageWrapper title="직접 예약" description="원하는 서비스를 선택하세요">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SERVICES.map(({ key, label, icon: Icon, color, desc }) => {
          const isCompleted = completedServices.has(key);
          return (
            <button
              key={key}
              onClick={() => router.push(`/mypage/direct-booking/${key}`)}
              className="card flex items-start gap-4 text-left hover:shadow-md transition-shadow relative"
            >
              {isCompleted && (
                <div className="absolute -top-2 -right-2 w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 transform rotate-45 shadow-lg flex items-center justify-center">
                  <div className="transform -rotate-45 text-white font-bold text-xs whitespace-nowrap">
                    완료
                  </div>
                </div>
              )}
              <div className={`p-3 rounded-lg ${color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{label}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </PageWrapper>
  );
}
