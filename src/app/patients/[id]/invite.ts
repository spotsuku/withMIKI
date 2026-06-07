'use server';

import { randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export interface InviteState {
  ok?: boolean;
  error?: string;
  email?: string;
  password?: string;   // 新規作成時の初期パスワード
  existing?: boolean;  // 既に連携済み
  linkedExisting?: boolean; // 既存Authアカウントを今回連携
  url?: string;
}

/** 患者ログイン招待URLを発行（メール不要・LINEなどで送付）。 */
export async function createInviteLink(_p: InviteState, fd: FormData): Promise<InviteState> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: 'アカウントが未設定です。' };
  const patientId = String(fd.get('patientId') ?? '');
  if (!patientId) return { error: '患者IDがありません。' };

  // 招待URLのベース。明示env優先 → 実アクセス中のドメイン(host) → 本番ドメイン。
  // VERCEL_URL（デプロイ個別＝プレビュー/認証保護）は使わない。
  const h = headers();
  const reqHost = h.get('x-forwarded-host') || h.get('host');
  const reqProto = h.get('x-forwarded-proto') || 'https';
  // 本番ドメインを最優先（プレビュー用デプロイURLで開いていても本番URLにする）
  const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const base = (
    process.env.PATIENT_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (prodHost ? `https://${prodHost}` : '') ||
    (reqHost ? `${reqProto}://${reqHost}` : '')
  ).replace(/\/$/, '');
  if (!base) return { error: 'サイトURLを特定できませんでした。' };

  const supabase = createClient();
  const { data: pat } = await supabase.from('patient').select('tenant_id').eq('id', patientId).maybeSingle();
  const p = pat as { tenant_id: string } | null;
  if (!p) return { error: '患者が見つかりません。' };

  // 既に連携済みなら、その旨を表示
  const admin = createAdminClient();
  if (admin) {
    const { data: linked } = await admin.from('patient_user').select('id').eq('patient_id', patientId).maybeSingle();
    if (linked) return { ok: true, existing: true };
  }

  // 未使用・未期限切れのトークンがあれば再利用、無ければ発行
  const { data: ex } = await supabase
    .from('patient_invite')
    .select('token, expires_at, used_at')
    .eq('patient_id', patientId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  let token = (ex as { token: string } | null)?.token ?? null;
  if (!token) {
    token = randomBytes(24).toString('hex');
    const { error } = await supabase.from('patient_invite').insert({
      tenant_id: p.tenant_id, patient_id: patientId, token,
    });
    if (error) return { error: '招待の発行に失敗しました：' + error.message };
  }
  return { ok: true, url: `${base}/invite/${token}` };
}

/** ログイン不要の記録URL（トークン+PIN方式）を発行 */
export async function createRecordLink(_p: InviteState, fd: FormData): Promise<InviteState> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: 'アカウントが未設定です。' };
  const patientId = String(fd.get('patientId') ?? '');
  if (!patientId) return { error: '患者IDがありません。' };

  const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const h = headers();
  const reqHost = h.get('x-forwarded-host') || h.get('host');
  const reqProto = h.get('x-forwarded-proto') || 'https';
  const base = (process.env.PATIENT_APP_URL || process.env.NEXT_PUBLIC_SITE_URL ||
    (prodHost ? `https://${prodHost}` : '') || (reqHost ? `${reqProto}://${reqHost}` : '')).replace(/\/$/, '');
  if (!base) return { error: 'サイトURLを特定できませんでした。' };

  const supabase = createClient();
  const { data: pat } = await supabase.from('patient').select('tenant_id').eq('id', patientId).maybeSingle();
  const p = pat as { tenant_id: string } | null;
  if (!p) return { error: '患者が見つかりません。' };

  // 既存トークンを再利用、無ければ発行
  const { data: ex } = await supabase.from('patient_record_token').select('token').eq('patient_id', patientId).eq('revoked', false).order('created_at', { ascending: false }).limit(1).maybeSingle();
  let token = (ex as { token: string } | null)?.token ?? null;
  if (!token) {
    token = randomBytes(24).toString('hex');
    const { error } = await supabase.from('patient_record_token').insert({ tenant_id: p.tenant_id, patient_id: patientId, token });
    if (error) return { error: '発行に失敗しました：' + error.message };
  }
  return { ok: true, url: `${base}/r/${token}` };
}

/** 患者にログインアカウントを発行し patient_user へ連携（招待） */
export async function invitePatient(_p: InviteState, fd: FormData): Promise<InviteState> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: 'アカウントが未設定です。' };
  const patientId = String(fd.get('patientId') ?? '');
  if (!patientId) return { error: '患者IDがありません。' };

  const admin = createAdminClient();
  if (!admin) return { error: '招待には SUPABASE_SERVICE_ROLE_KEY（サーバー設定）が必要です。' };

  // 患者（自テナント）を取得
  const supabase = createClient();
  const { data: pat } = await supabase.from('patient').select('email, name, tenant_id').eq('id', patientId).maybeSingle();
  const p = pat as { email: string | null; name: string | null; tenant_id: string } | null;
  if (!p) return { error: '患者が見つかりません。' };
  if (!p.email) return { error: '先に患者の基本情報にメールアドレスを登録してください。' };

  // 既に連携済みか
  const { data: existing } = await admin.from('patient_user').select('id').eq('patient_id', patientId).maybeSingle();
  if (existing) return { ok: true, existing: true, email: p.email };

  // Auth ユーザーを作成（無ければ）／既存なら検索
  let authId: string | null = null;
  let password: string | null = null;
  const temp = randomBytes(6).toString('hex'); // 12文字
  const created = await admin.auth.admin.createUser({
    email: p.email, password: temp, email_confirm: true, user_metadata: { name: p.name },
  });
  if (created.data?.user) {
    authId = created.data.user.id;
    password = temp;
  } else {
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const u = list.data?.users?.find((x) => (x.email || '').toLowerCase() === p.email!.toLowerCase());
    if (u) authId = u.id;
  }
  if (!authId) return { error: 'ログインユーザーの作成に失敗しました：' + (created.error?.message ?? '') };

  const { error: linkErr } = await admin.from('patient_user').insert({
    tenant_id: p.tenant_id, patient_id: patientId, auth_user_id: authId,
  });
  if (linkErr) return { error: '連携に失敗しました：' + linkErr.message };

  revalidatePath(`/patients/${patientId}`);
  const url = (process.env.PATIENT_APP_URL || '').replace(/\/$/, '') || undefined;
  return password
    ? { ok: true, email: p.email, password, url }
    : { ok: true, email: p.email, linkedExisting: true, url };
}
