import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * 招待トークン＋LINE idToken でアカウントを受け取り、line_account / patient_user を連携。
 * メール不要。LINE の sub から擬似メールを生成して Auth ユーザーを作成する。
 * 必要 env: LINE_LOGIN_CHANNEL_ID, SUPABASE_SERVICE_ROLE_KEY
 */
export async function POST(req: NextRequest) {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const admin = createAdminClient();
  if (!channelId || !admin) return NextResponse.json({ error: 'LINEログインが未設定です（サーバー設定）。' }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { token?: string; idToken?: string } | null;
  const token = body?.token?.trim();
  if (!token || !body?.idToken) return NextResponse.json({ error: 'パラメータが不足しています。' }, { status: 400 });

  // 1) LINE idToken 検証
  const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: body.idToken, client_id: channelId }),
  });
  if (!verifyRes.ok) return NextResponse.json({ error: 'LINE認証に失敗しました' }, { status: 401 });
  const profile = (await verifyRes.json()) as { sub?: string; email?: string };
  const lineUserId = profile.sub;
  if (!lineUserId) return NextResponse.json({ error: 'LINEユーザーを特定できません' }, { status: 401 });

  // 2) 招待トークン検証
  const { data: invData } = await admin.from('patient_invite').select('tenant_id, patient_id, expires_at, used_at').eq('token', token).maybeSingle();
  const inv = invData as { tenant_id: string; patient_id: string; expires_at: string; used_at: string | null } | null;
  if (!inv) return NextResponse.json({ error: '招待リンクが無効です。' }, { status: 404 });
  if (inv.used_at) return NextResponse.json({ error: 'この招待は使用済みです。' }, { status: 409 });
  if (new Date(inv.expires_at) < new Date()) return NextResponse.json({ error: '招待リンクの有効期限が切れています。' }, { status: 410 });

  // 3) 既に連携済みなら拒否
  const { data: linked } = await admin.from('patient_user').select('id').eq('patient_id', inv.patient_id).maybeSingle();
  if (linked) return NextResponse.json({ error: '既に連携済みです。LINEログインからご利用ください。' }, { status: 409 });

  // 4) Auth ユーザー作成（LINE の email があれば利用、無ければ擬似メール）
  const email = profile.email || `line_${lineUserId}@line.withmiki.local`;
  let authId: string | null = null;
  const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { line_user_id: lineUserId } });
  if (created.data?.user) {
    authId = created.data.user.id;
  } else {
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const u = list.data?.users?.find((x) => (x.email || '').toLowerCase() === email.toLowerCase());
    if (u) authId = u.id;
  }
  if (!authId) return NextResponse.json({ error: 'アカウント作成に失敗しました：' + (created.error?.message ?? '') }, { status: 500 });

  // 5) 連携（line_account / patient_user）
  await admin.from('line_account').upsert({ tenant_id: inv.tenant_id, patient_id: inv.patient_id, line_user_id: lineUserId }, { onConflict: 'line_user_id' });
  const { error: linkErr } = await admin.from('patient_user').insert({ tenant_id: inv.tenant_id, patient_id: inv.patient_id, auth_user_id: authId });
  if (linkErr) return NextResponse.json({ error: '連携に失敗しました：' + linkErr.message }, { status: 500 });
  await admin.from('patient_invite').update({ used_at: new Date().toISOString() }).eq('token', token);

  // 6) ログイン用 OTP
  const { data: link, error: linkGenErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const otp = link?.properties?.email_otp;
  if (linkGenErr || !otp) return NextResponse.json({ error: 'ログイントークンの発行に失敗しました' }, { status: 500 });
  return NextResponse.json({ email, otp });
}
