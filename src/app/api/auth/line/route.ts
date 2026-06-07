import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * LINE の idToken を検証し、ひも付く患者の Supabase ログイン用 OTP を発行する。
 * 事前条件:
 *  - line_account(line_user_id) が患者にひも付いていること（先生が登録）
 *  - その患者が patient_user で Supabase Auth ユーザーにひも付いていること
 * 必要 env: LINE_LOGIN_CHANNEL_ID, SUPABASE_SERVICE_ROLE_KEY
 */
export async function POST(req: NextRequest) {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const admin = createAdminClient();
  if (!channelId || !admin) {
    return NextResponse.json({ error: 'LINEログインが未設定です（サーバー設定）。' }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { idToken?: string } | null;
  if (!body?.idToken) return NextResponse.json({ error: 'idToken がありません' }, { status: 400 });

  // 1) LINE で idToken を検証
  const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: body.idToken, client_id: channelId }),
  });
  if (!verifyRes.ok) {
    const detail = (await verifyRes.json().catch(() => ({}))) as { error?: string; error_description?: string };
    const expired = /expire/i.test(detail.error_description || detail.error || '');
    return NextResponse.json({
      expired,
      error: expired
        ? 'LINEのログイン情報が期限切れでした。再取得します。'
        : 'LINE認証に失敗しました（' + (detail.error_description || detail.error || 'verify失敗') + '）。サーバーの LINE_LOGIN_CHANNEL_ID が、LIFFを含むLINEログインチャネルのIDと一致しているか確認してください。',
    }, { status: 401 });
  }
  const profile = (await verifyRes.json()) as { sub?: string; picture?: string };
  const lineUserId = profile.sub;
  if (!lineUserId) return NextResponse.json({ error: 'LINEユーザーを特定できません' }, { status: 401 });
  const picture = profile.picture || null;

  // 2) 先生（app_user）に LINE がひも付いていれば、そのアカウントでログイン
  const { data: staff } = await admin.from('app_user').select('id, auth_user_id').eq('line_user_id', lineUserId).maybeSingle();
  const staffRow = staff as { id: string; auth_user_id: string | null } | null;
  if (staffRow?.auth_user_id) {
    if (picture) await admin.from('app_user').update({ avatar_url: picture }).eq('id', staffRow.id);
    const otpRes = await issueOtp(admin, staffRow.auth_user_id);
    if ('error' in otpRes) return NextResponse.json({ error: otpRes.error }, { status: 500 });
    return NextResponse.json({ email: otpRes.email, otp: otpRes.otp, role: 'staff' });
  }

  // 3) line_account → patient → patient_user → auth ユーザー
  const { data: la } = await admin.from('line_account').select('patient_id').eq('line_user_id', lineUserId).maybeSingle();
  const patientId = (la as { patient_id: string } | null)?.patient_id;
  if (!patientId) return NextResponse.json({ error: 'この LINE はまだアカウントにひも付いていません。招待URLから登録するか、先生にご連絡ください。' }, { status: 404 });
  if (picture) await admin.from('patient').update({ avatar_url: picture }).eq('id', patientId);

  const { data: pu } = await admin.from('patient_user').select('auth_user_id').eq('patient_id', patientId).maybeSingle();
  const authUserId = (pu as { auth_user_id: string } | null)?.auth_user_id;
  if (!authUserId) return NextResponse.json({ error: 'ログインアカウントが未設定です。先生にご連絡ください。' }, { status: 404 });

  const otpRes = await issueOtp(admin, authUserId);
  if ('error' in otpRes) return NextResponse.json({ error: otpRes.error }, { status: 500 });
  return NextResponse.json({ email: otpRes.email, otp: otpRes.otp, role: 'patient' });
}

/** auth_user_id からメール＆マジックリンクOTPを発行 */
async function issueOtp(admin: NonNullable<ReturnType<typeof createAdminClient>>, authUserId: string) {
  const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(authUserId);
  const email = userRes?.user?.email;
  if (userErr || !email) return { error: 'アカウントの取得に失敗しました' };
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const otp = link?.properties?.email_otp;
  if (linkErr || !otp) return { error: 'ログイントークンの発行に失敗しました' };
  return { email, otp };
}
