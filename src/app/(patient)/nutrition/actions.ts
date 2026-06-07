'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';

export interface NutriState { error?: string }

function num(fd: FormData, k: string): number | null {
  const v = fd.get(k);
  if (v === null || String(v).trim() === '') return null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export async function saveNutritionGoal(_prev: NutriState, formData: FormData): Promise<NutriState> {
  const ctx = await getPatientContext();
  if (!ctx?.patient) return { error: 'アカウントが患者にひも付いていません。' };
  const supabase = createClient();
  const { error } = await supabase.from('nutrition_goal').upsert({
    patient_id: ctx.patient.id,
    tenant_id: ctx.patient.tenant_id,
    calories: num(formData, 'calories'),
    protein: num(formData, 'protein'),
    carbs: num(formData, 'carbs'),
    fat: num(formData, 'fat'),
    target_weight: num(formData, 'target_weight'),
  }, { onConflict: 'patient_id' });
  if (error) return { error: '保存に失敗しました：' + error.message };
  revalidatePath('/food');
  redirect('/food');
}
