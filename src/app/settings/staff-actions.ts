'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export interface StaffRow { id: string; name: string; email: string; role: string; status: string; linked: boolean }
export interface StaffState { ok?: boolean; error?: string; email?: string; password?: string }

const ROLES = ['owner', 'practitioner', 'staff'];

/** 院名（テナント名）を更新 */
export async function updateClinicName(_p: StaffState, fd: FormData): Promise<StaffState> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: '権限がありません。' };
  const name = String(fd.get('clinic_name') ?? '').trim();
  if (!name) return { error: '院名を入力してください。' };
  const admin = createAdminClient();
  if (!admin) return { error: 'サーバー設定が必要です（SUPABASE_SERVICE_ROLE_KEY）。' };
  const { error } = await admin.from('tenant').update({ name }).eq('id', ctx.appUser.tenant_id);
  if (error) return { error: '更新に失敗しました：' + error.message };
  revalidatePath('/settings');
  return { ok: true };
}

/** 自テナントのスタッフ一覧 */
export async function listStaff(): Promise<StaffRow[]> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from('app_user')
    .select('id, name, email, role, status, auth_user_id')
    .eq('tenant_id', ctx.appUser.tenant_id)
    .order('created_at', { ascending: true });
  return ((data ?? []) as { id: string; name: string; email: string; role: string; status: string; auth_user_id: string | null }[])
    .map((r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, status: r.status, linked: Boolean(r.auth_user_id) }));
}

/** スタッフ（管理者）を追加し、ログインアカウントを発行する */
export async function createStaff(_p: StaffState, fd: FormData): Promise<StaffState> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: '権限がありません。' };

  const name = String(fd.get('name') ?? '').trim();
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const role = String(fd.get('role') ?? 'practitioner');
  if (!name || !email) return { error: '名前とメールアドレスを入力してください。' };
  if (!ROLES.includes(role)) return { error: '権限の指定が不正です。' };

  const admin = createAdminClient();
  if (!admin) return { error: 'スタッフ追加には SUPABASE_SERVICE_ROLE_KEY（サーバー設定）が必要です。' };

  // 同テナントに同じメールが既にいないか
  const supabase = createClient();
  const { data: dup } = await supabase.from('app_user').select('id').eq('tenant_id', ctx.appUser.tenant_id).eq('email', email).maybeSingle();
  if (dup) return { error: 'このメールアドレスのスタッフは既に登録されています。' };

  // Auth ユーザーを新規作成（既存メールは乗っ取り防止のため拒否）
  const password = randomBytes(6).toString('hex'); // 12文字
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  if (created.error || !created.data?.user) {
    return { error: 'このメールアドレスは使用できません（既に登録済みの可能性があります）。別のメールでお試しください。' };
  }
  const authId = created.data.user.id;

  const { error: insErr } = await admin.from('app_user').insert({
    tenant_id: ctx.appUser.tenant_id, email, name, role, status: 'active', auth_user_id: authId,
  });
  if (insErr) {
    // 後始末（Authユーザーは作られたがapp_user登録に失敗）
    await admin.auth.admin.deleteUser(authId).catch(() => {});
    return { error: 'スタッフ登録に失敗しました：' + insErr.message };
  }

  revalidatePath('/settings');
  return { ok: true, email, password };
}
