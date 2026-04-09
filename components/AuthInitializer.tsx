"use client";
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function AuthInitializer() {
    const pathname = usePathname();

    useEffect(() => {
        let unsub: any = null;
        const start = async () => {
            // Public pages: skip auth listener to reduce initial JS/network work.
            if (pathname === '/' || pathname === '/login') return;

            // 인증 리스너만 설정 (사용자 정보 조회는 필요할 때만)
            const { setupAuthListener } = await import('@/lib/userUtils');
            const subscription = setupAuthListener((user, userData) => {
                // no-op here; other components may also query getCurrentUserInfo when needed
                try { console.debug('AuthInitializer: onUserChange', !!user); } catch { }
            });
            unsub = subscription;
        };
        start();

        return () => {
            try { unsub?.unsubscribe?.(); } catch { }
        };
    }, []);

    return null;
}
