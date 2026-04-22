'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageWrapper from '@/components/layout/PageWrapper';
import SectionBox from '@/components/layout/SectionBox';
import Spinner from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import supabase from '@/lib/supabase';
import { ClipboardList, Plus } from 'lucide-react';

export default function MyPage() {
  const { user, loading } = useAuth(undefined, '/login', true);
  const router = useRouter();
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
  }, [user]);

  if (loading) return <Spinner className="h-72" />;
  if (!user) return null;

  return (
    <PageWrapper title={`${customerName}님 환영합니다.`} description="예약 현황을 한눈에 확인하세요">
      {/* 빠른 링크 */}
      <SectionBox title="바로가기">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        </div>
      </SectionBox>
    </PageWrapper>
  );
}
