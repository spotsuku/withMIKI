import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** 標準LINEログインのコールバック。code を交換し、mode に応じて連携／ログイン／招待登録を行う。 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const fail = (where: string, code = 'error') => NextResponse.redirect(new URL(`${where}?line=${code}`, origin));

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
  const admin = createAdminClient();
  if (!channelId || !channelSecret || !admin) return fail('/login', 'unconfigured');

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const raw = req.cookies.get('line_oauth')?.value;
  if (!code || !state || !raw) return fail('/login');
  let parsed: { nonce: string; mode: string; token: string };
  try { parsed = JSON.parse(raw); } catch { return fail('/login'); }
  if (parsed.nonce !== state) return fail('/login'); // CSRF
  const { mode, token } = parsed;

  // 1) code → トークン交換
  const redirectUri = `${origin}/api/auth/line/callback`;
  const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: redirectUri,
      client_id: channelId, client_secret: channelSecret,
    }),
  });
  if (!tokenRes.ok) return fail(mode === 'link' ? '/settings' : '/login');
  const tok = (await tokenRes.json()) as { id_token?: string };
  if (!tok.id_token) return fail('/login');

  // 2) id_token を検証して LINE ユーザーID(sub) を得る
  const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: tok.id_token, client_id: channelId }),
  });
  if (!verifyRes.ok) return fail('/login');
  const lineUserId = ((await verifyRes.json()) as { sub?: string }).sub;
  if (!lineUserId) return fail('/login');

  // 3) モード別処理
  if (mode === 'link') {
    const ctx = await getUserContext();
    if (!ctx?.appUser) return fail('/login');
    const { data: usedStaff } = await admin.from('app_user').select('id').eq('line_user_id', lineUserId).neq('id', ctx.appUser.id).maybeSingle();
    const { data: usedPatient } = await admin.from('line_account').select('id').eq('line_user_id', lineUserId).maybeSingle();
    if (usedStaff || usedPatient) return fail('/settings', 'inuse');
    await admin.from('app_user').update({ line_user_id: lineUserId }).eq('id', ctx.appUser.id);
    const res = NextResponse.redirect(new URL('/settings?line=linked', origin));
    res.cookies.delete('line_oauth');
    return res;
  }

  if (mode === 'invite') {
    const r = await claimInvite(admin, token, lineUserId);
    if ('error' in r) return fail('/login', r.code);
    return finishLogin(admin, r.authUserId, '/today', origin);
  }

  // login: 既存ユーザーのみ。先生→患者の順で解決
  const { data: staff } = await admin.from('app_user').select('auth_user_id').eq('line_user_id', lineUserId).maybeSingle();
  const staffAuthId = (staff as { auth_user_id: string | null } | null)?.auth_user_id;
  if (staffAuthId) return finishLogin(admin, staffAuthId, '/patients', origin);

  const { data: la } = await admin.from('line_account').select('patient_id').eq('line_user_id', lineUserId).maybeSingle();
  const patientId = (la as { patient_id: string } | null)?.patient_id;
  if (patientId) {
    const { data: pu } = await admin.from('patient_user').select('auth_user_id').eq('patient_id', patientId).maybeSingle();
    const authId = (pu as { auth_user_id: string } | null)?.auth_user_id;
    if (authId) return finishLogin(admin, authId, '/today', origin);
  }
  return fail('/login', 'notlinked');
}

/** 招待トークン＋LINEで患者アカウントを作成・連携 */
async function claimInvite(admin: Admin, token: string, lineUserId: string): Promise<{ authUserId: string } | { error: true; code: string }> {
  if (!token) return { error: true, code: 'notlinked' };
  const { data: invData } = await admin.from('patient_invite').select('tenant_id, patient_id, expires_at, used_at').eq('token', token).maybeSingle();
  const inv = invData as { tenant_id: string; patient_id: string; expires_at: string; used_at: string | null } | null;
  if (!inv || inv.used_at || new Date(inv.expires_at) < new Date()) return { error: true, code: 'invite' };

  // 管理者LINEや連携済みは弾く
  const { data: staffLine } = await admin.from('app_user').select('id').eq('line_user_id', lineUserId).maybeSingle();
  if (staffLine) return { error: true, code: 'inuse' };
  const { data: linked } = await admin.from('patient_user').select('id').eq('patient_id', inv.patient_id).maybeSingle();
  if (linked) return { error: true, code: 'used' };

  const email = `line_${lineUserId}@line.withmiki.local`;
  let authId: string | null = null;
  const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { line_user_id: lineUserId } });
  if (created.data?.user) authId = created.data.user.id;
  else {
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const u = list.data?.users?.find((x) => (x.email || '').toLowerCase() === email.toLowerCase());
    if (u) authId = u.id;
  }
  if (!authId) return { error: true, code: 'error' };
  const { data: staffUser } = await admin.from('app_user').select('id').eq('auth_user_id', authId).maybeSingle();
  if (staffUser) return { error: true, code: 'inuse' };

  await admin.from('line_account').upsert({ tenant_id: inv.tenant_id, patient_id: inv.patient_id, line_user_id: lineUserId }, { onConflict: 'line_user_id' });
  await admin.from('patient_user').insert({ tenant_id: inv.tenant_id, patient_id: inv.patient_id, auth_user_id: authId });
  await admin.from('patient_invite').update({ used_at: new Date().toISOString() }).eq('token', token);
  return { authUserId: authId };
}

/** 対象 Auth ユーザーで Supabase セッションを確立して遷移 */
async function finishLogin(admin: Admin, authUserId: string, dest: string, origin: string) {
  const { data: userRes } = await admin.auth.admin.getUserById(authUserId);
  const email = userRes?.user?.email;
  if (!email) return NextResponse.redirect(new URL('/login?line=error', origin));
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const otp = link?.properties?.email_otp;
  if (!otp) return NextResponse.redirect(new URL('/login?line=error', origin));

  const supabase = createClient(); // Cookie を書く SSR クライアント
  const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'magiclink' });
  if (error) return NextResponse.redirect(new URL('/login?line=error', origin));

  const res = NextResponse.redirect(new URL(dest, origin));
  res.cookies.delete('line_oauth');
  return res;
}
