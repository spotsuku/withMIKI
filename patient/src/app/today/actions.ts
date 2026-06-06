'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';

export interface DailyState {
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

/** 患者本人のその日のデイリーを保存（daily_record + gyneco_daily を upsert 相当） */
export async function saveDaily(_prev: DailyState, formData: FormData): Promise<DailyState> {
  const ctx = await getPatientContext();
  if (!ctx) return { error: 'ログインが必要です。' };
  if (!ctx.patient) return { error: 'アカウントが患者にひも付いていません。先生にご連絡ください。' };

  const recordDate = str(formData, 'record_date') ?? new Date().toISOString().slice(0, 10);
  const supabase = createClient();
  const patientId = ctx.patient.id;

  const common = {
    tenant_id: ctx.patient.tenant_id,
    patient_id: patientId,
    record_date: recordDate,
    source: 'patient',
    weight: num(formData, 'weight'),
    body_temp: num(formData, 'body_temp'),
    sleep_hours: num(formData, 'sleep_hours'),
    memo: str(formData, 'memo'),
  };
  const gyneco = {
    bbt: num(formData, 'bbt'),
    menstrual: str(formData, 'menstrual'),
    flow: str(formData, 'flow'),
    pain: num(formData, 'pain'),
  };

  // 既存の当日レコードを検索
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

  // gyneco_daily upsert（PK = daily_record_id）
  const { error: gErr } = await supabase
    .from('gyneco_daily')
    .upsert({ daily_record_id: dailyId, ...gyneco }, { onConflict: 'daily_record_id' });
  if (gErr) return { error: '記録の保存に失敗しました：' + gErr.message };

  revalidatePath('/today');
  return { ok: true };
}
