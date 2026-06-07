import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * 標準のLINEログイン（Web OAuth）開始。
 * mode=login（既存ユーザーのログイン）/ link（先生がLINE連携）/ invite（招待から患者登録）
 * コールバックは /api/auth/line/callback（LINEコンソールにこのURLのみ登録）。
 */
export async function GET(req: NextRequest) {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) {
    return NextResponse.redirect(new URL('/login?line=unconfigured', req.url));
  }
  const mode = req.nextUrl.searchParams.get('mode') || 'login';
  const token = req.nextUrl.searchParams.get('token') || '';
  const nonce = randomBytes(16).toString('hex');
  const redirectUri = `${req.nextUrl.origin}/api/auth/line/callback`;

  const p = new URLSearchParams({
    response_type: 'code',
    client_id: channelId,
    redirect_uri: redirectUri,
    state: nonce,
    scope: 'openid profile',
    nonce,
  });
  const res = NextResponse.redirect(`https://access.line.me/oauth2/v2.1/authorize?${p.toString()}`);
  // CSRF対策＋mode/token の持ち回り（httpOnly cookie。URLには nonce のみ）
  res.cookies.set('line_oauth', JSON.stringify({ nonce, mode, token }), {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600,
  });
  return res;
}
