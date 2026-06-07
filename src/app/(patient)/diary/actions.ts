'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';
import { addDiary, setDiaryShare, deleteDiary } from '@/lib/diaryCore';

export interface DiaryState { ok?: boolean; error?: string }

export async function addDiaryEntry(_p: DiaryState, fd: FormData): Promise<DiaryState> {
  const ctx = await getPatientContext();
  if (!ctx?.patient) return { error: 'アカウントが患者にひも付いていません。' };
  const r = await addDiary(createClient(), ctx.patient, fd);
  if (r.error) return { error: r.error };
  revalidatePath('/diary');
  return { ok: true };
}

export async function toggleDiaryShare(id: string, isShared: boolean): Promise<DiaryState> {
  const ctx = await getPatientContext();
  if (!ctx?.patient) return { error: 'アカウントが患者にひも付いていません。' };
  const r = await setDiaryShare(createClient(), ctx.patient.id, id, isShared);
  if (r.error) return { error: r.error };
  revalidatePath('/diary');
  return { ok: true };
}

export async function removeDiaryEntry(id: string): Promise<DiaryState> {
  const ctx = await getPatientContext();
  if (!ctx?.patient) return { error: 'アカウントが患者にひも付いていません。' };
  const r = await deleteDiary(createClient(), ctx.patient.id, id);
  if (r.error) return { error: r.error };
  revalidatePath('/diary');
  return { ok: true };
}
