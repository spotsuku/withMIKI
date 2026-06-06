'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth';
import { jstToIso, addMinutesIso } from '@/lib/datetime';

export interface ApptState { error?: string }

function s(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v === null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

/** 予約を作成（先生） */
export async function createAppointment(_p: ApptState, fd: FormData): Promise<ApptState> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: 'アカウントが未設定です。' };
  const date = s(fd, 'date'); const time = s(fd, 'time');
  if (!date || !time) return { error: '日付と時刻を入力してください。' };
  const dur = parseInt(String(fd.get('duration') ?? '30'), 10) || 30;
  const start = jstToIso(date, time);
  const supabase = createClient();
  const { error } = await supabase.from('appointments').insert({
    tenant_id: ctx.appUser.tenant_id,
    patient_id: s(fd, 'patient_id'),
    title: s(fd, 'title'),
    start_at: start,
    end_at: addMinutesIso(start, dur),
    status: s(fd, 'status') ?? 'confirmed',
    notes: s(fd, 'notes'),
    booking_token: randomBytes(24).toString('hex'),
    created_by: ctx.appUser.id,
  });
  if (error) return { error: '予約の作成に失敗しました：' + error.message };
  revalidatePath('/appointments');
  redirect('/appointments');
}

/** 予約のステータス変更（確定/キャンセル） */
export async function setAppointmentStatus(fd: FormData): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return;
  const id = s(fd, 'id'); const status = s(fd, 'status');
  if (!id || !status) return;
  const supabase = createClient();
  const patch: Record<string, unknown> = { status };
  if (status === 'cancelled') patch.cancelled_at = new Date().toISOString();
  await supabase.from('appointments').update(patch).eq('id', id);
  // 確定時に Google Calendar へ反映（設定済みなら）
  if (status === 'confirmed') {
    try { const { syncAppointmentToGoogle } = await import('@/lib/google'); await syncAppointmentToGoogle(ctx.appUser.tenant_id, id); } catch { /* 未設定なら無視 */ }
  }
  revalidatePath('/appointments');
}

/** 空き枠を作成（先生） */
export async function createSlot(_p: ApptState, fd: FormData): Promise<ApptState> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: 'アカウントが未設定です。' };
  const date = s(fd, 'date'); const start = s(fd, 'start'); const end = s(fd, 'end');
  if (!date || !start || !end) return { error: '日付・開始・終了を入力してください。' };
  const supabase = createClient();
  const { error } = await supabase.from('appointment_slots').insert({
    tenant_id: ctx.appUser.tenant_id,
    start_at: jstToIso(date, start),
    end_at: jstToIso(date, end),
    is_blocked: false,
  });
  if (error) return { error: '枠の作成に失敗しました：' + error.message };
  revalidatePath('/appointments/slots');
  redirect('/appointments/slots');
}

/** 枠のブロック切替・削除 */
export async function toggleSlot(fd: FormData): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return;
  const id = s(fd, 'id'); const blocked = s(fd, 'blocked');
  if (!id) return;
  const supabase = createClient();
  await supabase.from('appointment_slots').update({ is_blocked: blocked === '1' }).eq('id', id);
  revalidatePath('/appointments/slots');
}
export async function deleteSlot(fd: FormData): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return;
  const id = s(fd, 'id'); if (!id) return;
  const supabase = createClient();
  await supabase.from('appointment_slots').delete().eq('id', id);
  revalidatePath('/appointments/slots');
}

/** 公開予約リンク用トークンを発行（無ければ作成） */
export async function ensureBookingToken(): Promise<string | null> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return null;
  const supabase = createClient();
  const { data } = await supabase.from('tenant_settings').select('booking_token').eq('tenant_id', ctx.appUser.tenant_id).maybeSingle();
  let token = (data as { booking_token: string | null } | null)?.booking_token ?? null;
  if (!token) {
    token = randomBytes(16).toString('hex');
    await supabase.from('tenant_settings').upsert({ tenant_id: ctx.appUser.tenant_id, booking_token: token }, { onConflict: 'tenant_id' });
  }
  return token;
}

export async function regenerateBookingToken(): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return;
  const supabase = createClient();
  const token = randomBytes(16).toString('hex');
  await supabase.from('tenant_settings').upsert({ tenant_id: ctx.appUser.tenant_id, booking_token: token }, { onConflict: 'tenant_id' });
  revalidatePath('/appointments');
}
