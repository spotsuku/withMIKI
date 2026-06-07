import { NextResponse, type NextRequest } from 'next/server';
import { getUserContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * ログイン中の先生（app_user）に LINE アカウントを連携する。
 * これ以降、その先生は /liff から LINE ログインできる。
 * 必要 env: LINE_LOGIN_CHANNEL_ID, SUPABASE_SERVICE_ROLE_KEY
 */
export async function POST(req: NextRequest) {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return NextResponse.json({ error: '権限がありません' }, { status: 401 });

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const admin = createAdminClient();
  if (!channelId || !admin) return NextResponse.json({ error: 'LINEログインが未設定です（サーバー設定）。' }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { idToken?: string } | null;
  if (!body?.idToken) return NextResponse.json({ error: 'idToken がありません' }, { status: 400 });

  const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: body.idToken, client_id: channelId }),
  });
  if (!verifyRes.ok) {
    const d = (await verifyRes.json().catch(() => ({}))) as { error?: string; error_description?: string };
    const expired = /expire/i.test(d.error_description || d.error || '');
    return NextResponse.json({ expired, error: expired ? 'ログイン情報が期限切れでした。再取得します。' : 'LINE認証に失敗しました' }, { status: 401 });
  }
  const profile = (await verifyRes.json()) as { sub?: string; picture?: string };
  const lineUserId = profile.sub;
  if (!lineUserId) return NextResponse.json({ error: 'LINEユーザーを特定できません' }, { status: 401 });

  // 既に他アカウントで使われていないか
  const { data: usedStaff } = await admin.from('app_user').select('id').eq('line_user_id', lineUserId).neq('id', ctx.appUser.id).maybeSingle();
  const { data: usedPatient } = await admin.from('line_account').select('id').eq('line_user_id', lineUserId).maybeSingle();
  if (usedStaff || usedPatient) return NextResponse.json({ error: 'このLINEアカウントは既に別の利用者に連携されています。' }, { status: 409 });

  const { error } = await admin.from('app_user').update({ line_user_id: lineUserId, avatar_url: profile.picture || null }).eq('id', ctx.appUser.id);
  if (error) return NextResponse.json({ error: '連携に失敗しました：' + error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
