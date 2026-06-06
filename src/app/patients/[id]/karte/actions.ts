'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth';

export interface KarteFormState {
  error?: string;
}

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** 問診（patient_intake）の作成/更新（patient_id 単位で upsert） */
export async function saveIntake(
  _prev: KarteFormState,
  formData: FormData,
): Promise<KarteFormState> {
  const ctx = await getUserContext();
  if (!ctx) return { error: 'ログインが必要です。' };
  if (!ctx.appUser) return { error: 'アカウントがテナントにひも付いていません（app_user）。' };

  const patientId = str(formData, 'patientId');
  if (!patientId) return { error: '患者IDがありません。' };
  const supabase = createClient();

  // 問診チェックリスト（check_0.. → { "0": "はい", ... }）
  const checks: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith('check_')) {
      const val = String(v).trim();
      if (val) checks[k.slice('check_'.length)] = val;
    }
  }

  const payload = {
    patient_id: patientId,
    tenant_id: ctx.appUser.tenant_id,
    chief: str(formData, 'chief'),
    onset: str(formData, 'onset'),
    current: str(formData, 'current'),
    history: str(formData, 'history'),
    sleep: str(formData, 'sleep'),
    appetite: str(formData, 'appetite'),
    meds: str(formData, 'meds'),
    note: str(formData, 'note'),
    checks,
    updated_by: ctx.appUser.id,
  };

  const { error } = await supabase
    .from('patient_intake')
    .upsert(payload, { onConflict: 'patient_id' });
  if (error) return { error: '問診の保存に失敗しました：' + error.message };

  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}

/** ケアプラン表紙（karte_cover）の作成/更新（patient_id 単位で upsert） */
export async function saveCover(
  _prev: KarteFormState,
  formData: FormData,
): Promise<KarteFormState> {
  const ctx = await getUserContext();
  if (!ctx) return { error: 'ログインが必要です。' };
  if (!ctx.appUser) return { error: 'アカウントがテナントにひも付いていません（app_user）。' };

  const patientId = str(formData, 'patientId');
  if (!patientId) return { error: '患者IDがありません。' };
  const supabase = createClient();

  const payload = {
    patient_id: patientId,
    tenant_id: ctx.appUser.tenant_id,
    purpose: str(formData, 'purpose'),
    goal: str(formData, 'goal'),
    therapist: str(formData, 'therapist'),
    diagnosis: str(formData, 'diagnosis'),
    history: str(formData, 'history'),
    treatment: str(formData, 'treatment'),
    caution: str(formData, 'caution'),
    doctor: str(formData, 'doctor'),
    start_date: str(formData, 'start_date'),
    next_visit: str(formData, 'next_visit'),
  };

  const { error } = await supabase
    .from('karte_cover')
    .upsert(payload, { onConflict: 'patient_id' });
  if (error) return { error: 'ケアプランの保存に失敗しました：' + error.message };

  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}
