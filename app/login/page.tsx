'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { primeAuthCache } from '@/hooks/useAuth';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(
          authError.message === 'Invalid login credentials'
            ? '이메일 또는 비밀번호가 올바르지 않습니다.'
            : authError.message,
        );
        return;
      }

      if (data.user) {
        // 로그인 직후 보호 페이지가 먼저 마운트되더라도 동일 사용자로 인증 상태를 읽게 한다.
        primeAuthCache(data.user as unknown as Record<string, unknown>);
      }

      router.replace('/mypage');
    } catch {
      setError('로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
            스테이 하롱 트레블
          </h1>
          <p className="text-center text-gray-500 text-sm mb-8">
            고객 예약 시스템
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
                이메일
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="이메일 주소"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="비밀번호"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            계정이 없으신가요?{' '}
            <Link href="/signup" className="text-blue-600 hover:underline">
              신규 예약
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
