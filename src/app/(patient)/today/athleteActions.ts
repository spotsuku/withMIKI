'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';

export interface AthleteState {
  error?: string;
  ok?: boolean;
}

function num(fd: FormData, k: string): number | null {
  const v = fd.get(k);
  if (v === null || String(v).trim() === '') return null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}
function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** アスリートの当日デイリーを保存（daily_record + athlete_daily） */
export async function saveAthleteDaily(_prev: AthleteState, formData: FormData): Promise<AthleteState> {
  const ctx = await getPatientContext();
  if (!ctx?.patient) return { error: 'アカウントが患者にひも付いていません。' };
  const recordDate = str(formData, 'record_date') ?? new Date().toISOString().slice(0, 10);
  const supabase = createClient();
  const patientId = ctx.patient.id;

  const common = {
    tenant_id: ctx.patient.tenant_id,
    patient_id: patientId,
    record_date: recordDate,
    source: 'patient',
    weight: num(formData, 'weight'),
    body_fat: num(formData, 'body_fat'),
    muscle_mass: num(formData, 'muscle_mass'),
    hr: num(formData, 'hr'),
    sleep_hours: num(formData, 'sleep_hours'),
    condition: str(formData, 'condition'),
    memo: str(formData, 'memo'),
  };
  const athlete = {
    injury: str(formData, 'injury'),
    condition_score: num(formData, 'condition_score'),
  };

  const { data: existing } = await supabase
    .from('daily_record')
    .select('id')
    .eq('patient_id', patientId)
    .eq('record_date', recordDate)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  let dailyId: string;
  if (existing) {
    dailyId = (existing as { id: string }).id;
    const { error } = await supabase.from('daily_record').update(common).eq('id', dailyId);
    if (error) return { error: '保存に失敗しました：' + error.message };
  } else {
    const { data, error } = await supabase.from('daily_record').insert(common).select('id').single();
    if (error || !data) return { error: '保存に失敗しました：' + (error?.message ?? '') };
    dailyId = (data as { id: string }).id;
  }

  const { error: aErr } = await supabase
    .from('athlete_daily')
    .upsert({ daily_record_id: dailyId, ...athlete }, { onConflict: 'daily_record_id' });
  if (aErr) return { error: '記録の保存に失敗しました：' + aErr.message };

  revalidatePath('/today');
  return { ok: true };
}

/** トレーニングを1件追加 */
export async function addTraining(_prev: AthleteState, formData: FormData): Promise<AthleteState> {
  const ctx = await getPatientContext();
  if (!ctx?.patient) return { error: 'アカウントが患者にひも付いていません。' };
  const supabase = createClient();

  const type = str(formData, 'train_type');
  const duration = num(formData, 'train_duration');
  const memo = str(formData, 'train_memo');
  if (!type && !duration && !memo) return { error: '内容を入力してください。' };

  const { error } = await supabase.from('training_session').insert({
    tenant_id: ctx.patient.tenant_id,
    patient_id: ctx.patient.id,
    session_date: str(formData, 'record_date') ?? new Date().toISOString().slice(0, 10),
    type,
    duration_min: duration,
    intensity: str(formData, 'train_intensity'),
    memo,
  });
  if (error) return { error: 'トレーニングの保存に失敗しました：' + error.message };

  revalidatePath('/today');
  return { ok: true };
}
