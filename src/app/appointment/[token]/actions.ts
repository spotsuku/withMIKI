'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

/** 公開：予約のキャンセル（booking_token 本人確認） */
export async function cancelBooking(fd: FormData): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const token = String(fd.get('token') ?? '');
  if (!token) return;
  const { data: appt } = await admin.from('appointments').select('id, start_at, tenant_id').eq('booking_token', token).maybeSingle();
  const a = appt as { id: string; start_at: string; tenant_id: string } | null;
  if (!a) return;
  await admin.from('appointments').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', a.id);
  // 枠を再開放（時間一致の枠を受付可へ戻す）
  await admin.from('appointment_slots').update({ is_blocked: false }).eq('tenant_id', a.tenant_id).eq('start_at', a.start_at);
  // 管理者へLINE通知（キャンセル）
  try { const { notifyStaffOfBooking } = await import('@/lib/notify'); await notifyStaffOfBooking(a.id, 'cancelled'); } catch { /* ignore */ }
  revalidatePath(`/appointment/${token}`);
}
