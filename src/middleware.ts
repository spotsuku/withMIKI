import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // 静的アセット・画像・manifest 以外の全ルートに適用
    // （manifest はCookie無しで取得されるため除外しないと/loginへ飛んでJSON崩れになる）
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest|ico|txt)$).*)',
  ],
};
