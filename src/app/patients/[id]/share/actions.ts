'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth';

export interface ShareState { error?: string }

/** 基本カルテの共有リンクを発行 */
export async function createShare(_prev: ShareState, formData: FormData): Promise<ShareState> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: 'アカウントがテナントにひも付いていません。' };
  const patientId = String(formData.get('patientId') ?? '');
  if (!patientId) return { error: '患者IDがありません。' };

  const label = (formData.get('label') as string | null)?.trim() || null;
  const days = parseInt(String(formData.get('expires_days') ?? ''), 10);
  const expires_at = Number.isFinite(days) && days > 0
    ? new Date(Date.now() + days * 86400000).toISOString()
    : null;
  const token = randomBytes(24).toString('hex'); // 48文字の推測困難トークン

  const supabase = createClient();
  const { error } = await supabase.from('karte_share').insert({
    tenant_id: ctx.appUser.tenant_id,
    patient_id: patientId,
    token,
    scope: 'basic',
    label,
    expires_at,
    created_by: ctx.appUser.id,
  });
  if (error) return { error: 'リンク発行に失敗しました：' + error.message };
  revalidatePath(`/patients/${patientId}`);
  return {};
}

/** 共有リンクを失効 */
export async function revokeShare(formData: FormData): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return;
  const patientId = String(formData.get('patientId') ?? '');
  const shareId = String(formData.get('shareId') ?? '');
  if (!shareId) return;
  const supabase = createClient();
  await supabase.from('karte_share').update({ revoked_at: new Date().toISOString() }).eq('id', shareId);
  revalidatePath(`/patients/${patientId}`);
}
