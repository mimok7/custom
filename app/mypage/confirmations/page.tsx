'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageWrapper from '@/components/layout/PageWrapper';
import SectionBox from '@/components/layout/SectionBox';
import Spinner from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import supabase from '@/lib/supabase';
import { Download, ArrowLeft } from 'lucide-react';

interface Confirmation {
  id: string;
  re_id: string;
  re_type: string;
  re_status: string;
  created_at: string;
  updated_at: string;
}

export default function ConfirmationsPage() {
  const { user, loading } = useAuth(undefined, '/login', true);
  const router = useRouter();
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchConfirmations = async () => {
      try {
        const { data, error } = await supabase
          .from('reservation')
          .select('*')
          .eq('re_user_id', user.id)
          .eq('re_status', 'confirmed')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('예약 확인서 조회 실패:', error);
          setConfirmations([]);
        } else {
          setConfirmations(data || []);
        }
      } catch (err) {
        console.error('예약 확인서 로드 중 오류:', err);
        setConfirmations([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfirmations();
  }, [user]);

  if (loading || isLoading) return <Spinner className="h-72" />;
  if (!user) return null;

  return (
    <PageWrapper title="예약 확인서" description="확정된 예약의 확인서를 다운로드할 수 있습니다">
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium">
        <ArrowLeft className="w-4 h-4" />
        돌아가기
      </button>

      <SectionBox>
        {confirmations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">다운로드할 수 있는 확인서가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {confirmations.map((confirmation) => (
              <div
                key={confirmation.re_id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                <div>
                  <p className="font-medium text-gray-900">
                    {confirmation.re_type === 'cruise' && '크루즈'}
                    {confirmation.re_type === 'airport' && '공항이용'}
                    {confirmation.re_type === 'hotel' && '숙소'}
                    {confirmation.re_type === 'tour' && '투어'}
                    {confirmation.re_type === 'rentcar' && '렌터카'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(confirmation.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    // PDF 다운로드 기능 추가 예정
                    alert('곧 지원될 기능입니다.');
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Download className="w-4 h-4" />
                  다운로드
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionBox>
    </PageWrapper>
  );
}
