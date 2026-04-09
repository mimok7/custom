'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import PageWrapper from '@/components/PageWrapper';
import SectionBox from '@/components/SectionBox';
import Link from 'next/link';
import { clearCachedUser } from '@/lib/authCache';

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error || !user) {
        router.push('/login');
        return;
      }
      setUser(user);
      
      // 사용자 프로필 조회
      supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setUserProfile(data);
          }
        })
        .catch((err) => console.warn('프로필 조회 실패:', err));

      setLoading(false);
    });
  }, [router]);

  const handleLogout = async () => {
    clearCachedUser();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-72">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <PageWrapper title="마이페이지">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* 환영 인사 */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold">
            {userProfile?.name || user?.email?.split('@')[0]} 님 환영합니다! 👋
          </h2>
          <p className="text-blue-100 mt-2">스테이하롱 예약 시스템에 오셨습니다.</p>
        </div>

        <SectionBox title="메뉴">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href="/mypage/direct-booking" className="block p-4 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition">
              <div className="text-lg font-semibold text-blue-800">직접 예약</div>
              <p className="text-sm text-blue-600 mt-1">크루즈, 공항, 호텔, 투어, 렌터카 예약</p>
            </Link>
            <Link href="/mypage/reservations/list" className="block p-4 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 transition">
              <div className="text-lg font-semibold text-green-800">예약 확인</div>
              <p className="text-sm text-green-600 mt-1">예약 내역 조회 및 상세 보기</p>
            </Link>
            <Link href="/mypage/confirmations" className="block p-4 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 transition">
              <div className="text-lg font-semibold text-purple-800">예약확인서</div>
              <p className="text-sm text-purple-600 mt-1">결제 완료된 예약 확인서 보기</p>
            </Link>
          </div>
        </SectionBox>
        <div className="text-center mt-6">
          <button onClick={handleLogout} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">
            로그아웃
          </button>
        </div>
      </div>
    </PageWrapper>
  );
}
