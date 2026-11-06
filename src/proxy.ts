import { NextRequest, NextResponse } from 'next/server';
import { legacyAiRoutesEnabled } from './lib/ai/paidExecution';

/**
 * Temporary: only the email-only login check is reachable in production.
 * Every other /api/admin/* route stays hidden until verified authentication exists.
 */
export function proxy(request: NextRequest) {
  // No paid execution until verified sessions, ownership and atomic spending reservations exist.
  // LEGACY_AI_ROUTES=enabled is an explicit deployment decision to restore the old public AI routes.
  if (request.nextUrl.pathname.startsWith('/api/ai/') && !legacyAiRoutesEnabled() &&
      !['/api/ai/staged-rehearsal', '/api/ai/scene/edit-staged'].includes(request.nextUrl.pathname)) {
    return NextResponse.json({error: 'Paid AI execution is disabled pending secure access and spending controls.'},
      {status: 403, headers: {'Cache-Control': 'no-store'}});
  }
  // Admin learning/research routes also spend credits and have no reserved-call authority.
  if(request.nextUrl.pathname.startsWith('/api/admin/')&&request.nextUrl.pathname!=='/api/admin/check'){
    return new NextResponse(null,{status:404,headers:{'Cache-Control':'no-store'}});
  }
  return NextResponse.next();
}

export const config = { matcher: ['/api/admin/:path*', '/api/ai/:path*'] };
