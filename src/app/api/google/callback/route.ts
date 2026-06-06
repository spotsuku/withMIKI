import { NextResponse, type NextRequest } from 'next/server';
import { getUserContext } from '@/lib/auth';
import { exchangeCode, saveToken } from '@/lib/google';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return NextResponse.redirect(new URL('/login', request.url));

  const code = request.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/appointments?google=error', request.url));

  const token = await exchangeCode(code);
  if (!token) return NextResponse.redirect(new URL('/appointments?google=error', request.url));

  // セキュリティ: state を信用せず、ログイン中テナントに保存
  await saveToken(ctx.appUser.tenant_id, token);
  return NextResponse.redirect(new URL('/appointments?google=connected', request.url));
}
