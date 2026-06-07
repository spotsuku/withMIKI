'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth';
import { KARTE_SECTIONS } from '@/lib/karteSections';

export interface VisState { ok?: boolean; error?: string }

/** 先生→患者の基本カルテ公開設定を保存（チェック=公開） */
export async function saveKarteVisibility(_p: VisState, fd: FormData): Promise<VisState> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: 'アカウントが未設定です。' };
  const patientId = String(fd.get('patientId') ?? '');
  if (!patientId) return { error: '患者IDがありません。' };

  const supabase = createClient();
  const { data: pat } = await supabase.from('patient').select('tenant_id').eq('id', patientId).maybeSingle();
  const tenantId = (pat as { tenant_id: string } | null)?.tenant_id;
  if (!tenantId) return { error: '患者が見つかりません。' };

  const rows = KARTE_SECTIONS.map((s) => ({
    tenant_id: tenantId, patient_id: patientId, section: s.key,
    visible: fd.get(`vis_${s.key}`) === 'on',
  }));
  const { error } = await supabase.from('karte_visibility').upsert(rows, { onConflict: 'patient_id,section' });
  if (error) return { error: '保存に失敗しました：' + error.message };

  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
