'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionUser } from '@/lib/authHelpers';
import Spinner from '@/components/ui/Spinner';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const { user } = await getSessionUser(8000);
        if (cancelled) return;
        router.replace(user ? '/mypage' : '/login');
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
