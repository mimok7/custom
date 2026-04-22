'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageWrapper from '@/components/layout/PageWrapper';
import SectionBox from '@/components/layout/SectionBox';
import Spinner from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import supabase from '@/lib/supabase';
import { Home } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string | null;
  name: string | null;
  phone_number?: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth(undefined, '/login', true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    init();
  }, [user]);

  const init = async () => {
    try {
      // users 테이블에서 프로필 로드
      const { data: urow, error: uerr } = await supabase
        .from('users')
        .select('id, email, name, phone_number')
        .eq('id', user!.id)
        .maybeSingle();

      if (uerr) {
        console.warn('users 조회 실패:', uerr?.message);
        setProfile({
          id: user!.id,
          email: user!.email ?? null,
          name: null,
          phone_number: null,
        });
      } else if (urow) {
        setProfile({
          ...urow,
          phone_number: formatPhoneNumber(urow.phone_number),
        });
      } else {
        setProfile({
          id: user!.id,
          email: user!.email ?? null,
          name: null,
          phone_number: null,
        });
      }
    } catch (e) {
      console.error('프로필 초기화 오류:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (value?: string | null) => {
    const digits = (value || '').replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    setSaving(true);
    try {
      const payload: any = {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        phone_number: formatPhoneNumber(profile.phone_number),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('users')
        .upsert(payload, { onConflict: 'id' });

      if (error) throw error;

      alert('프로필이 저장되었습니다.');
      router.push('/mypage');
    } catch (e: any) {
      console.error('프로필 저장 오류:', e);
      alert(`저장 실패: ${e?.message || '알 수 없는 오류'}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPwError(null);
    const { current, next, confirm } = pwForm;
    if (!current) {
      setPwError('기존 비밀번호를 입력해 주세요.');
      return;
    }
    if (!next || next.length < 6) {
      setPwError('새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (next !== confirm) {
      setPwError('새 비밀번호와 확인이 일치하지 않습니다.');
      return;
    }

    setPwSaving(true);
    try {
      const email = profile?.email || user?.email;
      if (!email) throw new Error('이메일 정보를 찾을 수 없습니다.');

      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: current });
      if (signInErr) {
        setPwError('기존 비밀번호가 올바르지 않습니다.');
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({ password: next });
      if (updateErr) throw updateErr;

      alert('비밀번호가 변경되었습니다.');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (e: any) {
      setPwError(e?.message || '비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setPwSaving(false);
    }
  };

  if (authLoading || loading || !profile) {
    return <Spinner className="h-72" />;
  }

  if (!user) return null;

  return (
    <PageWrapper
      title="내 정보"
      description="개인 정보를 관리하세요"
    >
      <div className="space-y-6">
        {/* 안내 메시지 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">
            💡 <strong>환영합니다!</strong> 아래 정보를 입력하시면 더 편리하게 서비스를 이용하실 수 있습니다.
          </p>
        </div>

        {/* 기본 정보 */}
        <SectionBox title="기본 정보">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일
              </label>
              <input
                type="email"
                value={profile.email ?? ''}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이름
              </label>
              <input
                type="text"
                value={profile.name ?? ''}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                휴대폰 번호
              </label>
              <input
                type="tel"
                value={profile.phone_number ?? ''}
                onChange={(e) => setProfile({ ...profile, phone_number: formatPhoneNumber(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="010-0000-0000"
                inputMode="numeric"
              />
            </div>
          </div>
        </SectionBox>

        {/* 비밀번호 변경 */}
        <SectionBox title="비밀번호 변경">
          <div className="space-y-4">
            {pwError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {pwError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                기존 비밀번호
              </label>
              <input
                type="password"
                value={pwForm.current}
                onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="현재 비밀번호 입력"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                새 비밀번호
              </label>
              <input
                type="password"
                value={pwForm.next}
                onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="새 비밀번호 (6자 이상)"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                새 비밀번호 확인
              </label>
              <input
                type="password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="새 비밀번호 다시 입력"
                autoComplete="new-password"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handlePasswordChange}
                disabled={pwSaving}
                className={`px-6 py-2 rounded-lg text-white font-medium transition-colors ${
                  pwSaving
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {pwSaving ? '변경 중...' : '비밀번호 변경'}
              </button>
            </div>
          </div>
        </SectionBox>

        {/* 저장 버튼 */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push('/mypage')}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-2 rounded-lg text-white font-medium transition-colors ${
              saving
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>
    </PageWrapper>
  );
}
