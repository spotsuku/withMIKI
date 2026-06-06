import { NextResponse, type NextRequest } from 'next/server';
import { getUserContext } from '@/lib/auth';
import { syncBusyFromGoogle } from '@/lib/google';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return NextResponse.redirect(new URL('/login', request.url));
  const from = new Date().toISOString();
  const to = new Date(Date.now() + 28 * 86400000).toISOString();
  const n = await syncBusyFromGoogle(ctx.appUser.tenant_id, from, to);
  return NextResponse.redirect(new URL(`/appointments/slots?synced=${n}`, request.url));
}
