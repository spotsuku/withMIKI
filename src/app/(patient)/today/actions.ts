'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';
import { persistDaily } from '@/lib/dailySave';

export interface DailyState {
  error?: string;
  ok?: boolean;
}

/** 患者本人（ログイン版）のその日の婦人科デイリーを保存 */
export async function saveDaily(_prev: DailyState, formData: FormData): Promise<DailyState> {
  const ctx = await getPatientContext();
  if (!ctx) return { error: 'ログインが必要です。' };
  if (!ctx.patient) return { error: 'アカウントが患者にひも付いていません。先生にご連絡ください。' };

  const supabase = createClient();
  const r = await persistDaily(supabase, ctx.patient, formData);
  if (r.error) return { error: r.error };
  revalidatePath('/today');
  return { ok: true };
}
