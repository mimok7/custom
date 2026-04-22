'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { clearAuthCache } from '@/hooks/useAuth';
import { queryClient } from '@/lib/queryClient';
import { Ship, Menu, X, LogOut, Home, Plus, ClipboardList, User } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/mypage', label: '홈', icon: Home },
  { href: '/mypage/direct-booking', label: '예약하기', icon: Plus },
  { href: '/mypage/reservations/list', label: '예약 내역', icon: ClipboardList },
  { href: '/mypage/profile', label: '내 정보', icon: User },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    setMobileOpen(false);
    await supabase.auth.signOut();
    clearAuthCache();
    queryClient.clear();
    router.replace('/login');
    router.refresh();
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* 로고 */}
        <Link href="/mypage" className="flex items-center gap-2 text-blue-600 font-bold text-lg">
          <Ship className="w-6 h-6" />
          <span className="hidden sm:inline">스테이하롱</span>
        </Link>

        {/* 데스크톱 네비 */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/mypage' && pathname?.startsWith(href));
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                <Icon className="w-4 h-4" />{label}
              </Link>
            );
          })}
          <button onClick={handleLogout} className="ml-2 p-2 text-gray-400 hover:text-red-500 transition-colors" title="로그아웃">
            <LogOut className="w-4 h-4" />
          </button>
        </nav>

        {/* 모바일 토글 */}
        <button className="md:hidden p-2 text-gray-600" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* 모바일 드로어 */}
      {mobileOpen && (
        <nav className="md:hidden border-t bg-white px-4 py-2 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/mypage' && pathname?.startsWith(href));
            return (
              <Link key={href} href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-md text-sm ${
                  isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600'
                }`}>
                <Icon className="w-4 h-4" />{label}
              </Link>
            );
          })}
          <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2.5 text-sm text-red-500 w-full">
            <LogOut className="w-4 h-4" />로그아웃
          </button>
        </nav>
      )}
    </header>
  );
}
