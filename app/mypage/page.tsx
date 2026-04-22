'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageWrapper from '@/components/layout/PageWrapper';
import SectionBox from '@/components/layout/SectionBox';
import Spinner from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import supabase from '@/lib/supabase';
import { Ship, ClipboardList, FileText, Plus } from 'lucide-react';

interface Stats {
  total: number;
  pending: number;
  confirmed: number;
}

export default function MyPage() {
  const { user, loading } = useAuth(undefined, '/login', true);
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, confirmed: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [customerName, setCustomerName] = useState('고객');

  useEffect(() => {
    if (!user) return;
    const metadataName = (user.user_metadata as Record<string, unknown> | undefined)?.name;
    if (typeof metadataName === 'string' && metadataName.trim()) {
      setCustomerName(metadataName.trim());
    }

    supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (typeof data?.name === 'string' && data.name.trim()) {
          setCustomerName(data.name.trim());
        }
      });

    supabase
      .from('reservation')
      .select('re_status')
      .eq('re_user_id', user.id)
      .then(({ data }) => {
        if (data) {
          setStats({
            total: data.length,
            pending: data.filter((r) => r.re_status === 'pending').length,
            confirmed: data.filter((r) => ['confirmed', 'completed'].includes(r.re_status)).length,
          });
        }
        setStatsLoading(false);
      });
  }, [user]);

  if (loading) return <Spinner className="h-72" />;
  if (!user) return null;

  return (
    <PageWrapper title={`${customerName}님 환영합니다.`} description="예약 현황을 한눈에 확인하세요">
      {/* 통계 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: '전체 예약', value: stats.total, color: 'text-gray-900' },
          { label: '대기중', value: stats.pending, color: 'text-yellow-600' },
          { label: '확정됨', value: stats.confirmed, color: 'text-green-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card text-center">
            {statsLoading ? <Spinner size="sm" /> : <p className={`text-2xl font-bold ${color}`}>{value}</p>}
            <p className="text-sm text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* 빠른 링크 */}
      <SectionBox title="바로가기">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button className="card flex items-center gap-3 hover:shadow-md transition-shadow text-left"
            onClick={() => router.push('/mypage/direct-booking')}>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><Plus className="w-5 h-5" /></div>
            <div>
              <p className="font-medium text-gray-900">새 예약</p>
              <p className="text-xs text-gray-500">예약하기</p>
            </div>
          </button>
          <button className="card flex items-center gap-3 hover:shadow-md transition-shadow text-left"
            onClick={() => router.push('/mypage/reservations/list')}>
            <div className="p-2 rounded-lg bg-green-50 text-green-600"><ClipboardList className="w-5 h-5" /></div>
            <div>
              <p className="font-medium text-gray-900">예약 내역</p>
              <p className="text-xs text-gray-500">예약 목록 보기</p>
            </div>
          </button>
          <button className="card flex items-center gap-3 hover:shadow-md transition-shadow text-left"
            onClick={() => router.push('/mypage/confirmations')}>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600"><FileText className="w-5 h-5" /></div>
            <div>
              <p className="font-medium text-gray-900">예약 확인서</p>
              <p className="text-xs text-gray-500">PDF 다운로드</p>
            </div>
          </button>
        </div>
      </SectionBox>
    </PageWrapper>
  );
}
