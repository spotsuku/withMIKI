import { createClient } from '@/lib/supabase/server';

export interface PatientContext {
  user: { id: string; email?: string | null };
  patient: { id: string; tenant_id: string; name: string; avatar_url?: string | null } | null;
}

/**
 * ログイン中の Auth ユーザーと、ひも付く patient（patient_user 経由）を取得。
 * 未ひも付けの場合 patient=null（docs/setup/supabase-setup.md / 0005_patient_portal.sql）。
 */
export async function getPatientContext(): Promise<PatientContext | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: link } = await supabase
    .from('patient_user')
    .select('patient_id, tenant_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!link) return { user, patient: null };

  const l = link as { patient_id: string; tenant_id: string };
  const { data: pat } = await supabase
    .from('patient')
    .select('id, name, avatar_url')
    .eq('id', l.patient_id)
    .maybeSingle();

  const p = pat as { id: string; name: string; avatar_url: string | null } | null;
  return {
    user,
    patient: p
      ? { id: p.id, tenant_id: l.tenant_id, name: p.name, avatar_url: p.avatar_url }
      : { id: l.patient_id, tenant_id: l.tenant_id, name: '' },
  };
}
