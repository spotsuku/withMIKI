'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';

export interface FoodState { error?: string; ok?: boolean }

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

/** 食事を1件記録（患者本人） */
export async function addFood(_prev: FoodState, formData: FormData): Promise<FoodState> {
  const ctx = await getPatientContext();
  if (!ctx?.patient) return { error: 'アカウントが患者にひも付いていません。' };
  const supabase = createClient();

  let analysis: unknown = null;
  const raw = str(formData, 'ai_analysis');
  if (raw) { try { analysis = JSON.parse(raw); } catch { analysis = null; } }

  const { error } = await supabase.from('food_entry').insert({
    tenant_id: ctx.patient.tenant_id,
    patient_id: ctx.patient.id,
    entry_date: str(formData, 'entry_date') ?? new Date().toISOString().slice(0, 10),
    meal: str(formData, 'meal'),
    memo: str(formData, 'memo'),
    calories: num(formData, 'calories'),
    protein: num(formData, 'protein'),
    carbs: num(formData, 'carbs'),
    fat: num(formData, 'fat'),
    ai_analysis: analysis,
  });
  if (error) return { error: '食事の保存に失敗しました：' + error.message };

  revalidatePath('/food');
  return { ok: true };
}
