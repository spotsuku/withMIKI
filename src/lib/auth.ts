import { createClient } from '@/lib/supabase/server';

export interface AppUser {
  id: string;
  tenant_id: string;
  name: string;
  role: string;
}

export interface UserContext {
  user: { id: string; email?: string | null };
  appUser: AppUser | null;
}

/**
 * ログイン中の Auth ユーザーと、ひも付く app_user（テナント文脈）を取得。
 * 書き込み時の tenant_id / created_by の解決に使う。
 * app_user 未ひも付けの場合 appUser=null（docs/setup/supabase-setup.md §4）。
 */
export async function getUserContext(): Promise<UserContext | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('app_user')
    .select('id, tenant_id, name, role')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return { user, appUser: (data as AppUser | null) ?? null };
}

/**
 * ログイン後の遷移先を、ロール（先生 or 患者）で判定する。
 * - app_user にひも付く → 先生 → /patients
 * - patient_user にひも付く → 患者 → /today
 * - どちらでもない → /login（連携待ち）
 */
export async function resolveHomePath(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return '/login';

  const { data: staff } = await supabase.from('app_user').select('id').eq('auth_user_id', user.id).maybeSingle();
  if (staff) return '/patients';

  const { data: patient } = await supabase.from('patient_user').select('id').eq('auth_user_id', user.id).maybeSingle();
  if (patient) return '/today';

  return '/login';
}
