import { NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth';
import { googleAuthUrl, googleConfigured } from '@/lib/google';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return NextResponse.redirect(new URL('/login', request.url));
  if (!googleConfigured()) {
    return NextResponse.json({ error: 'Google連携が未設定です（GOOGLE_CLIENT_ID等）。' }, { status: 503 });
  }
  return NextResponse.redirect(googleAuthUrl(ctx.appUser.tenant_id));
}
