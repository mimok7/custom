import type { Metadata } from 'next';
import '@/styles/globals.css';
import QueryProvider from '@/components/providers/QueryProvider';
import AlertProvider from '@/components/providers/AlertProvider';
import Header from '@/components/layout/Header';

export const metadata: Metadata = {
  title: 'SHT Custom',
  description: '스테이 하롱 트레블 - 고객 예약 시스템',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <QueryProvider>
          <AlertProvider>
            <div className="min-h-screen flex flex-col">
              <Header />
              <main className="flex-1">{children}</main>
            </div>
          </AlertProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
