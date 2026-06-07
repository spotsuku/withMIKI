'use server';

import { randomBytes } from 'node:crypto';
import { redirect } from 'next/navigation';
import { getPatientContext } from '@/lib/patient';
import { createAdminClient } from '@/lib/supabase/admin';

export interface ReserveState { error?: string }

/** 患者本人が空き枠を予約（ログイン必須・サービスロールで実行） */
export async function reserveSlot(_p: ReserveState, fd: FormData): Promise<ReserveState> {
  const ctx = await getPatientContext();
  if (!ctx?.patient) return { error: 'ログインが必要です。' };
  const admin = createAdminClient();
  if (!admin) return { error: '予約機能はサーバー未設定です。' };

  const slotId = String(fd.get('slot_id') ?? '').trim();
  const note = String(fd.get('note') ?? '').trim();
  if (!slotId) return { error: '希望の枠を選んでください。' };

  const tenantId = ctx.patient.tenant_id;
  // 枠の検証（同テナント・未ブロック・未来）
  const { data: slot } = await admin.from('appointment_slots').select('tenant_id, start_at, end_at, is_blocked').eq('id', slotId).maybeSingle();
  const sl = slot as { tenant_id: string; start_at: string; end_at: string; is_blocked: boolean } | null;
  if (!sl || sl.tenant_id !== tenantId) return { error: 'この枠は予約できません。' };
  if (sl.is_blocked) return { error: 'この枠は既に埋まっています。別の枠をお選びください。' };

  const token = randomBytes(24).toString('hex');
  const { data: created, error } = await admin.from('appointments').insert({
    tenant_id: tenantId,
    patient_id: ctx.patient.id,
    title: 'オンライン予約',
    start_at: sl.start_at,
    end_at: sl.end_at,
    status: 'pending',
    notes: note || null,
    booking_token: token,
    source: 'patient',
  }).select('id').single();
  if (error || !created) return { error: '予約に失敗しました：' + (error?.message ?? '') };

  // 二重予約防止に枠をブロック
  await admin.from('appointment_slots').update({ is_blocked: true }).eq('id', slotId);
  // 受付通知（先生へ。未設定なら no-op）
  try { const { notifyAppointment } = await import('@/lib/notify'); await notifyAppointment((created as { id: string }).id, 'booked'); } catch { /* ignore */ }

  redirect('/reserve?done=1');
}
