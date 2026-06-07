import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** 招待トークン＋メール/パスワードでアカウントを受け取り、patient_user へ連携。 */
export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'サーバー設定が未完了です。' }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { token?: string; email?: string; password?: string } | null;
  const token = body?.token?.trim();
  const email = body?.email?.trim();
  const password = body?.password ?? '';
  if (!token || !email || password.length < 6) {
    return NextResponse.json({ error: 'メールアドレスと6文字以上のパスワードを入力してください。' }, { status: 400 });
  }

  const inv = await loadInvite(admin, token);
  if ('error' in inv) return NextResponse.json({ error: inv.error }, { status: inv.status });

  // 既に連携済みなら拒否
  const { data: linked } = await admin.from('patient_user').select('id').eq('patient_id', inv.patient_id).maybeSingle();
  if (linked) return NextResponse.json({ error: '既に連携済みです。ログイン画面からログインしてください。' }, { status: 409 });

  // Auth ユーザー作成（既存メールなら検索して連携）
  let authId: string | null = null;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.data?.user) {
    authId = created.data.user.id;
  } else {
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const u = list.data?.users?.find((x) => (x.email || '').toLowerCase() === email.toLowerCase());
    if (u) { authId = u.id; await admin.auth.admin.updateUserById(u.id, { password }); }
  }
  if (!authId) return NextResponse.json({ error: 'アカウント作成に失敗しました：' + (created.error?.message ?? '') }, { status: 500 });

  const { error: linkErr } = await admin.from('patient_user').insert({
    tenant_id: inv.tenant_id, patient_id: inv.patient_id, auth_user_id: authId,
  });
  if (linkErr) return NextResponse.json({ error: '連携に失敗しました：' + linkErr.message }, { status: 500 });

  await admin.from('patient_invite').update({ used_at: new Date().toISOString() }).eq('token', token);
  return NextResponse.json({ ok: true });
}

async function loadInvite(admin: NonNullable<ReturnType<typeof createAdminClient>>, token: string) {
  const { data } = await admin.from('patient_invite').select('tenant_id, patient_id, expires_at, used_at').eq('token', token).maybeSingle();
  const inv = data as { tenant_id: string; patient_id: string; expires_at: string; used_at: string | null } | null;
  if (!inv) return { error: '招待リンクが無効です。', status: 404 as const };
  if (inv.used_at) return { error: 'この招待は使用済みです。', status: 409 as const };
  if (new Date(inv.expires_at) < new Date()) return { error: '招待リンクの有効期限が切れています。', status: 410 as const };
  return inv;
}
