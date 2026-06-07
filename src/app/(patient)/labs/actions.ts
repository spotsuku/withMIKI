'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';

export interface LabState { error?: string }

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

export async function saveLab(_prev: LabState, formData: FormData): Promise<LabState> {
  const ctx = await getPatientContext();
  if (!ctx?.patient) return { error: 'アカウントが患者にひも付いていません。' };
  const takenDate = str(formData, 'taken_date');
  if (!takenDate) return { error: '採血日を入力してください。' };
  const supabase = createClient();

  const { data: catalog } = await supabase.from('lab_test_catalog').select('code');
  const codes = (catalog ?? []).map((c) => (c as { code: string }).code);

  const values: { test_code: string; value: number | null; value_text: string | null }[] = [];
  for (const code of codes) {
    const raw = str(formData, `lab_${code}`);
    if (raw === null) continue;
    const n = parseFloat(raw.replace(/,/g, ''));
    if (Number.isFinite(n) && /^[-+]?[\d.,]+$/.test(raw)) values.push({ test_code: code, value: n, value_text: null });
    else values.push({ test_code: code, value: null, value_text: raw });
  }

  const { data: lab, error } = await supabase
    .from('lab_result')
    .insert({ tenant_id: ctx.patient.tenant_id, patient_id: ctx.patient.id, taken_date: takenDate, source: 'manual', comment: str(formData, 'comment') })
    .select('id')
    .single();
  if (error || !lab) return { error: '保存に失敗しました：' + (error?.message ?? '') };
  if (values.length) {
    const { error: vErr } = await supabase.from('lab_value').insert(values.map((v) => ({ ...v, lab_result_id: (lab as { id: string }).id })));
    if (vErr) return { error: '検査値の保存に失敗しました：' + vErr.message };
  }
  revalidatePath('/labs');
  redirect('/today');
}
