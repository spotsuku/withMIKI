'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';
import { GYNECO_CHIPS, GYNECO_EXTRA_CHIPS, SELFCARES, MEDS } from '@/lib/gyneco';

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
function arr(fd: FormData, k: string): string[] {
  const v = fd.get(k);
  if (!v) return [];
  try { const a = JSON.parse(String(v)); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
}

/** 患者本人のその日の婦人科デイリーを保存（daily_record + gyneco_daily を upsert 相当） */
export async function saveDaily(_prev: DailyState, formData: FormData): Promise<DailyState> {
  const ctx = await getPatientContext();
  if (!ctx) return { error: 'ログインが必要です。' };
  if (!ctx.patient) return { error: 'アカウントが患者にひも付いていません。先生にご連絡ください。' };

  const recordDate = str(formData, 'record_date') ?? new Date().toISOString().slice(0, 10);
  const supabase = createClient();
  const patientId = ctx.patient.id;

  // 追加チップ → payload
  const payload: Record<string, unknown> = {};
  for (const g of GYNECO_EXTRA_CHIPS) {
    if (g.type === 'single') { const v = str(formData, `s_${g.key}`); if (v) payload[g.key] = v; }
    else { const a = arr(formData, `m_${g.key}`); if (a.length) payload[g.key] = a; }
  }

  const common = {
    tenant_id: ctx.patient.tenant_id,
    patient_id: patientId,
    record_date: recordDate,
    source: 'patient',
    weight: num(formData, 'weight'),
    body_fat: num(formData, 'body_fat'),
    body_temp: num(formData, 'body_temp'),
    sleep_hours: num(formData, 'sleep_hours'),
    water: num(formData, 'water'),
    memo: str(formData, 'memo'),
    payload,
  };

  // gyneco_daily（型付き列）
  const gyneco: Record<string, unknown> = {
    bbt: num(formData, 'bbt'),
    pain: num(formData, 'pain'),
  };
  for (const g of GYNECO_CHIPS) {
    if (!g.col) continue;
    if (g.type === 'single') gyneco[g.col] = str(formData, `s_${g.key}`);
    else gyneco[g.col] = arr(formData, `m_${g.key}`);
  }

  // 既存当日レコード
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

  const { error: gErr } = await supabase
    .from('gyneco_daily')
    .upsert({ daily_record_id: dailyId, ...gyneco }, { onConflict: 'daily_record_id' });
  if (gErr) return { error: '記録の保存に失敗しました：' + gErr.message };

  // セルフケア（入れ替え）
  await supabase.from('selfcare_log').delete().eq('daily_record_id', dailyId);
  const scRows = SELFCARES.filter((sc) => formData.get(`sc_${sc.id}`) === 'on')
    .map((sc) => ({ daily_record_id: dailyId, selfcare_code: sc.id, done: true }));
  if (scRows.length) await supabase.from('selfcare_log').insert(scRows);

  // 服薬（medication マスタを用意し medication_log を入れ替え）
  const takenMeds = MEDS.filter((m) => formData.get(`med_${m}`) === 'on');
  await supabase.from('medication_log').delete().eq('daily_record_id', dailyId);
  for (const name of takenMeds) {
    const { data: med } = await supabase
      .from('medication')
      .upsert({ tenant_id: ctx.patient.tenant_id, patient_id: patientId, name }, { onConflict: 'patient_id,name' })
      .select('id')
      .single();
    if (med) {
      await supabase.from('medication_log').insert({
        daily_record_id: dailyId, medication_id: (med as { id: string }).id, taken: true,
      });
    }
  }

  revalidatePath('/today');
  return { ok: true };
}
