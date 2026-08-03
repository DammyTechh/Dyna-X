import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Cookie names mirror tokenStore in src/lib/api.ts
const TOKEN_COOKIE = 'dynax_access_token';
const ROLE_COOKIE = 'dynax_role';

const PROFESSIONAL_ROLES = [
  'physiotherapist', 'prosthetist', 'orthotist',
  'occupational_therapist', 'speech_therapist', 'mental_health_clinician',
];

// The product subdomains rewrite "/" onto a dashboard route, and rewrites run
// after middleware — so at this point the path is still "/" and the guards have
// to key off the Host header instead.
const SUBDOMAIN_APPS: Record<
  string,
  { login: string; allows: (role: string) => boolean; denyTo: string }
> = {
  'pro.dynax.app': {
    login: 'https://dynax.app/prosthetist-orthotist',
    allows: (role) => role === 'admin' || PROFESSIONAL_ROLES.includes(role),
    denyTo: 'https://dynax.app/auth/login',
  },
  'care.dynax.app': {
    login: 'https://dynax.app/auth/login',
    allows: (role) => role === 'admin' || role === 'patient',
    denyTo: 'https://dynax.app/prosthetist-orthotist',
  },
  'physio.dynax.app': {
    login: 'https://dynax.app/physiotherapy',
    allows: (role) => role === 'admin' || role === 'physiotherapist',
    denyTo: 'https://dynax.app/auth/login',
  },
};

function subdomainAppFor(req: NextRequest, pathname: string) {
  if (pathname !== '/') return null; // only the rewritten root is host-scoped
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase();
  return SUBDOMAIN_APPS[host] || null;
}

// Every redirect here is decided from the auth cookie, so none of them may be
// cached: a stored 307 would pin a signed-out user to a dashboard, or keep
// bouncing a signed-in user back to the login page.
function noStoreRedirect(url: string | URL): NextResponse {
  const response = NextResponse.redirect(url);
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  return response;
}

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
  const subdomainApp = subdomainAppFor(req, pathname);

  // ── Not authenticated → bounce to the right sign-in ──────────────────────
  if (!token) {
    // Subdomain roots go to absolute apex URLs: the portal and auth routes are
    // only meaningful on dynax.app, and cloning the request URL would keep the
    // subdomain as the host.
    if (subdomainApp) return noStoreRedirect(subdomainApp.login);

    const url = req.nextUrl.clone();
    url.pathname = loginUrlFor(pathname);
    url.searchParams.set('redirect', pathname);
    return noStoreRedirect(url);
  }

  // ── Subdomain roots: the path is still "/", so the path guards below can't
  //    see them. Check the host's own role rules first. ─────────────────────
  if (subdomainApp && !subdomainApp.allows(role || '')) {
    return noStoreRedirect(subdomainApp.denyTo);
  }

  // ── Role-based guards ────────────────────────────────────────────────────
  // Admin area: admins only.
  if (pathname.startsWith('/dashboard/admin') && role !== 'admin') {
    return noStoreRedirect(new URL('/dashboard/patient', req.url));
  }

  // Professional area: professionals (and admins) only.
  if (
    pathname.startsWith('/dashboard/professional') &&
    role !== 'admin' &&
    !PROFESSIONAL_ROLES.includes(role || '')
  ) {
    return noStoreRedirect(new URL('/dashboard/patient', req.url));
  }

  // Patient area: patients (and admins, for support) only.
  if (
    pathname.startsWith('/dashboard/patient') &&
    role !== 'patient' &&
    role !== 'admin'
  ) {
    return noStoreRedirect(new URL('/dashboard/professional', req.url));
  }

  // 3D editor: Prosthetists & Orthotists only (admins allowed for oversight).
  if (
    pathname.startsWith('/editor') &&
    role !== 'admin' &&
    role !== 'prosthetist' &&
    role !== 'orthotist'
  ) {
    return noStoreRedirect(new URL('/dashboard/professional', req.url));
  }

  return NextResponse.next();
}

// Only run middleware on protected areas. Public marketing pages, the portals
// themselves, and /auth/* stay open. Share links (/share/:token) stay public.
//
// The product subdomains rewrite "/" onto a dashboard route, and rewrites run
// after middleware — so the bare "/" of each host is matched explicitly here,
// otherwise those dashboards would render without the edge auth check.
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/editor',
    '/editor/:path*',
    { source: '/', has: [{ type: 'host', value: 'pro.dynax.app' }] },
    { source: '/', has: [{ type: 'host', value: 'care.dynax.app' }] },
    { source: '/', has: [{ type: 'host', value: 'physio.dynax.app' }] },
  ],
};
