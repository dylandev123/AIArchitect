import { NextResponse } from 'next/server';

/** Email-only admin access is development-only until verified authentication exists. */
export function proxy() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  return NextResponse.next();
}

export const config = { matcher: '/api/admin/:path*' };
