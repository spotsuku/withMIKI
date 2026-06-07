'use server';

import { randomBytes } from 'node:crypto';
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
