'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import Spinner from '@/components/ui/Spinner';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        router.replace(session?.user ? '/mypage' : '/login');
      } catch {
        if (!cancelled) router.replace('/login');
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return <Spinner />;
}
