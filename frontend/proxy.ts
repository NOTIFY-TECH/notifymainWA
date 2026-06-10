import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/register', '/reset-password'];
const DASHBOARD_PREFIX = '/dashboard';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const refreshToken = request.cookies.get('refresh_token')?.value;
  const isAuthenticated = Boolean(refreshToken);
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));
  const isDashboardRoute = pathname.startsWith(DASHBOARD_PREFIX);

  if (isDashboardRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublicRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register', '/reset-password'],
};
