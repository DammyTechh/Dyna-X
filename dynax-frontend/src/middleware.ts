import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Cookie names mirror tokenStore in src/lib/api.ts
const TOKEN_COOKIE = 'dynax_access_token';
const ROLE_COOKIE = 'dynax_role';

const PROFESSIONAL_ROLES = [
  'physiotherapist', 'prosthetist', 'orthotist',
  'occupational_therapist', 'speech_therapist', 'mental_health_clinician',
];

function loginUrlFor(pathname: string): string {
  // Send people to the portal that matches the area they were trying to reach.
  if (pathname.startsWith('/dashboard/admin')) return '/admin';
  if (pathname.startsWith('/dashboard/professional') || pathname.startsWith('/editor')) {
    return '/prosthetist-orthotist';
  }
  return '/auth/login';
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const role = req.cookies.get(ROLE_COOKIE)?.value;

  // ── Not authenticated → bounce to the right sign-in ──────────────────────
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = loginUrlFor(pathname);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // ── Role-based guards ────────────────────────────────────────────────────
  // Admin area: admins only.
  if (pathname.startsWith('/dashboard/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard/patient', req.url));
  }

  // Professional area: professionals (and admins) only.
  if (
    pathname.startsWith('/dashboard/professional') &&
    role !== 'admin' &&
    !PROFESSIONAL_ROLES.includes(role || '')
  ) {
    return NextResponse.redirect(new URL('/dashboard/patient', req.url));
  }

  // Patient area: patients (and admins, for support) only.
  if (
    pathname.startsWith('/dashboard/patient') &&
    role !== 'patient' &&
    role !== 'admin'
  ) {
    return NextResponse.redirect(new URL('/dashboard/professional', req.url));
  }

  // 3D editor: Prosthetists & Orthotists only (admins allowed for oversight).
  if (
    pathname.startsWith('/editor') &&
    role !== 'admin' &&
    role !== 'prosthetist' &&
    role !== 'orthotist'
  ) {
    return NextResponse.redirect(new URL('/dashboard/professional', req.url));
  }

  return NextResponse.next();
}

// Only run middleware on protected areas. Public marketing pages, the portals
// themselves, and /auth/* stay open. Share links (/share/:token) stay public.
export const config = {
  matcher: ['/dashboard/:path*', '/editor', '/editor/:path*'],
};
