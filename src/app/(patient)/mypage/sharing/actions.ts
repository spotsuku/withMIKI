'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';
import { SHARE_SECTIONS } from '@/lib/sections';

export interface ShareState { ok?: boolean; error?: string }

/** 項目ごとの公開/非公開を保存（チェック=公開） */
export async function saveSharing(_p: ShareState, fd: FormData): Promise<ShareState> {
  const ctx = await getPatientContext();
  if (!ctx?.patient) return { error: 'アカウントが患者にひも付いていません。' };
  const supabase = createClient();

  const rows = SHARE_SECTIONS.map((s) => ({
    tenant_id: ctx.patient!.tenant_id,
    patient_id: ctx.patient!.id,
    section: s.key,
    is_shared: fd.get(`share_${s.key}`) === 'on',
  }));
  const { error } = await supabase
    .from('patient_share_settings')
    .upsert(rows, { onConflict: 'patient_id,section' });
  if (error) return { error: '保存に失敗しました：' + error.message };

  revalidatePath('/mypage/sharing');
  return { ok: true };
}
