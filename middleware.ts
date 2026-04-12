import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PATHS = ['/mypage'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // Cache control for auth-sensitive pages
  if (
    PROTECTED_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname === '/login' ||
    pathname === '/signup'
  ) {
    response.headers.set(
      'Cache-Control',
      'private, no-store, no-cache, must-revalidate',
    );
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/).*)'],
};
