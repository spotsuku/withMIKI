'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth';

export interface PatientFormState {
  error?: string;
}

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** 患者の新規登録 / 基本情報の更新 */
export async function savePatient(
  _prev: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  const ctx = await getUserContext();
  if (!ctx) return { error: 'ログインが必要です。' };
  if (!ctx.appUser) {
    return { error: 'アカウントがテナントにひも付いていません（app_user）。docs/setup/supabase-setup.md §4 を参照。' };
  }

  const name = str(formData, 'name');
  if (!name) return { error: '氏名を入力してください。' };

  const patientId = str(formData, 'patientId'); // 空なら新規
  const tenant = ctx.appUser.tenant_id;
  const supabase = createClient();

  const payload = {
    name,
    kana: str(formData, 'kana'),
    code: str(formData, 'code'),
    dob: str(formData, 'dob'),
    sex: str(formData, 'sex'),
    blood_type: str(formData, 'blood_type'),
    tel: str(formData, 'tel'),
    email: str(formData, 'email'),
    address: str(formData, 'address'),
    job: str(formData, 'job'),
    first_visit_date: str(formData, 'first_visit_date'),
    hospital: str(formData, 'hospital'),
    avatar: str(formData, 'avatar'),
  };

  let savedId = patientId;

  if (patientId) {
    const { error } = await supabase
      .from('patient')
      .update({ ...payload, updated_by: ctx.appUser.id })
      .eq('id', patientId);
    if (error) return { error: '更新に失敗しました：' + error.message };
  } else {
    const { data, error } = await supabase
      .from('patient')
      .insert({ ...payload, tenant_id: tenant, created_by: ctx.appUser.id })
      .select('id')
      .single();
    if (error || !data) return { error: '登録に失敗しました：' + (error?.message ?? '') };
    savedId = (data as { id: string }).id;
  }

  // ケアプログラム（婦人科/アスリート/総合）の割当（主プログラムを1つに置換）
  const program = str(formData, 'program');
  if (program && savedId) {
    const { data: cp } = await supabase
      .from('care_program')
      .select('id')
      .eq('code', program)
      .is('tenant_id', null)
      .maybeSingle();
    if (cp) {
      await supabase.from('patient_program').delete().eq('patient_id', savedId);
      await supabase.from('patient_program').insert({
        tenant_id: tenant,
        patient_id: savedId,
        care_program_id: (cp as { id: string }).id,
        is_primary: true,
      });
    }
  }

  revalidatePath('/patients');
  revalidatePath(`/patients/${savedId}`);
  redirect(`/patients/${savedId}`);
}
