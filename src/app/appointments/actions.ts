'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth';
import { jstToIso, addMinutesIso } from '@/lib/datetime';
import { DEFAULT_TEMPLATES, type SlotTemplate } from '@/lib/slotTemplates';

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
  const status = s(fd, 'status') ?? 'confirmed';
  const { data: created, error } = await supabase.from('appointments').insert({
    tenant_id: ctx.appUser.tenant_id,
    patient_id: s(fd, 'patient_id'),
    title: s(fd, 'title'),
    location: s(fd, 'location'),
    start_at: start,
    end_at: addMinutesIso(start, dur),
    status,
    notes: s(fd, 'notes'),
    booking_token: randomBytes(24).toString('hex'),
    created_by: ctx.appUser.id,
  }).select('id').single();
  if (error || !created) return { error: '予約の作成に失敗しました：' + (error?.message ?? '') };
  // 確定予約は Google カレンダーへ反映（連携済みなら）
  if (status === 'confirmed') {
    try { const { syncAppointmentToGoogle } = await import('@/lib/google'); await syncAppointmentToGoogle(ctx.appUser.tenant_id, (created as { id: string }).id); } catch { /* 未設定なら無視 */ }
  }
  revalidatePath('/appointments');
  redirect('/appointments');
}

/** 予約の変更（リスケ・内容更新） */
export async function updateAppointment(_p: ApptState, fd: FormData): Promise<ApptState> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: 'アカウントが未設定です。' };
  const id = s(fd, 'id');
  if (!id) return { error: '対象がありません。' };
  const date = s(fd, 'date'); const time = s(fd, 'time');
  if (!date || !time) return { error: '日付と時刻を入力してください。' };
  const dur = parseInt(String(fd.get('duration') ?? '60'), 10) || 60;
  const start = jstToIso(date, time);
  const supabase = createClient();
  const { error } = await supabase.from('appointments').update({
    patient_id: s(fd, 'patient_id'),
    title: s(fd, 'title'),
    location: s(fd, 'location'),
    start_at: start,
    end_at: addMinutesIso(start, dur),
    status: s(fd, 'status') ?? 'confirmed',
    notes: s(fd, 'notes'),
  }).eq('id', id);
  if (error) return { error: '予約の更新に失敗しました：' + error.message };
  // Google イベントへ反映（連携済みなら）
  try { const { syncAppointmentToGoogle } = await import('@/lib/google'); await syncAppointmentToGoogle(ctx.appUser.tenant_id, id); } catch { /* ignore */ }
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
  // 通知（確定/キャンセル。未設定なら no-op）
  if (status === 'confirmed' || status === 'cancelled') {
    try { const { notifyAppointment } = await import('@/lib/notify'); await notifyAppointment(id, status); } catch { /* ignore */ }
  }
  revalidatePath('/appointments');
}

/** 予約のステータス変更（ID指定・カレンダー用）。Google同期＋通知あり。 */
export async function updateApptStatus(id: string, status: string): Promise<ApptState> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: '権限がありません。' };
  if (!id || !status) return { error: '対象が不正です。' };
  const supabase = createClient();
  const patch: Record<string, unknown> = { status };
  if (status === 'cancelled') patch.cancelled_at = new Date().toISOString();
  const { error } = await supabase.from('appointments').update(patch).eq('id', id);
  if (error) return { error: '更新に失敗しました：' + error.message };
  if (status === 'confirmed') {
    try { const { syncAppointmentToGoogle } = await import('@/lib/google'); await syncAppointmentToGoogle(ctx.appUser.tenant_id, id); } catch { /* ignore */ }
  }
  if (status === 'confirmed' || status === 'cancelled') {
    try { const { notifyAppointment } = await import('@/lib/notify'); await notifyAppointment(id, status); } catch { /* ignore */ }
  }
  revalidatePath('/appointments');
  return {};
}

/** 空き枠を作成（先生） */
export async function createSlot(_p: ApptState, fd: FormData): Promise<ApptState> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: 'アカウントが未設定です。' };
  const date = s(fd, 'date'); const start = s(fd, 'start'); const end = s(fd, 'end');
  if (!date || !start || !end) return { error: '日付・開始・終了を入力してください。' };
  const supabase = createClient();
  const { data: slot, error } = await supabase.from('appointment_slots').insert({
    tenant_id: ctx.appUser.tenant_id,
    start_at: jstToIso(date, start),
    end_at: jstToIso(date, end),
    is_blocked: false,
  }).select('id').single();
  if (error || !slot) return { error: '枠の作成に失敗しました：' + (error?.message ?? '') };
  // Googleカレンダーへ同期（連携済みなら）
  try { const { pushSlotToGoogle } = await import('@/lib/google'); await pushSlotToGoogle(ctx.appUser.tenant_id, (slot as { id: string }).id); } catch { /* 未設定なら無視 */ }
  revalidatePath('/appointments/slots');
  redirect('/appointments/slots');
}

/** 営業時間から空き枠を一括生成（曜日・時間帯・間隔） */
export async function generateSlots(_p: ApptState, fd: FormData): Promise<ApptState> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: 'アカウントが未設定です。' };
  const from = s(fd, 'date_from'); const to = s(fd, 'date_to');
  const start = s(fd, 'start'); const end = s(fd, 'end');
  const interval = parseInt(String(fd.get('interval') ?? '60'), 10) || 60;
  const weekdays = fd.getAll('wd').map((x) => parseInt(String(x), 10)); // 0=日..6=土
  if (!from || !to || !start || !end || weekdays.length === 0) return { error: '期間・曜日・時間帯を入力してください。' };

  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  const sMin = toMin(start); const eMin = toMin(end);
  if (eMin <= sMin) return { error: '終了は開始より後にしてください。' };

  const rows: { tenant_id: string; start_at: string; end_at: string; is_blocked: boolean }[] = [];
  const cur = new Date(`${from}T12:00:00+09:00`);
  const last = new Date(`${to}T12:00:00+09:00`);
  let guard = 0;
  while (cur <= last && guard < 400) {
    guard++;
    const dateStr = cur.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
    if (weekdays.includes(cur.getUTCDay())) {
      for (let m = sMin; m + interval <= eMin; m += interval) {
        const st = jstToIso(dateStr, hhmm(m));
        rows.push({ tenant_id: ctx.appUser.tenant_id, start_at: st, end_at: addMinutesIso(st, interval), is_blocked: false });
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
  if (rows.length === 0) return { error: '生成対象がありませんでした。' };
  if (rows.length > 500) return { error: `生成枠が多すぎます（${rows.length}）。期間を短くしてください。` };

  const supabase = createClient();
  const { data, error } = await supabase.from('appointment_slots').insert(rows).select('id');
  if (error) return { error: '一括生成に失敗しました：' + error.message };
  // Googleへ同期（連携済みなら）
  try {
    const { pushSlotToGoogle } = await import('@/lib/google');
    for (const r of (data ?? []) as { id: string }[]) await pushSlotToGoogle(ctx.appUser.tenant_id, r.id);
  } catch { /* ignore */ }

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
  // Google側の表記（受付中/受付不可）も更新
  try { const { pushSlotToGoogle } = await import('@/lib/google'); await pushSlotToGoogle(ctx.appUser.tenant_id, id); } catch { /* ignore */ }
  revalidatePath('/appointments/slots');
}
export async function deleteSlot(fd: FormData): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return;
  const id = s(fd, 'id'); if (!id) return;
  const supabase = createClient();
  // 先に Google イベントを削除（枠の google_event_id を読むため delete 前に実行）
  try { const { removeSlotFromGoogle } = await import('@/lib/google'); await removeSlotFromGoogle(ctx.appUser.tenant_id, id); } catch { /* ignore */ }
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

// ===== カレンダーUI（クライアントから直接呼ぶ引数ベースのアクション） =====

/** 指定日時に空き枠を作成（Google同期）。作成IDを返す（楽観更新の確定用） */
export async function addSlotAt(date: string, time: string, minutes: number): Promise<{ id?: string; error?: string }> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: 'アカウントが未設定です。' };
  if (!date || !time) return { error: '日時が不正です。' };
  const start = jstToIso(date, time);
  const supabase = createClient();
  const { data: slot, error } = await supabase.from('appointment_slots').insert({
    tenant_id: ctx.appUser.tenant_id, start_at: start, end_at: addMinutesIso(start, minutes || 60), is_blocked: false,
  }).select('id').single();
  if (error || !slot) return { error: '枠の作成に失敗しました：' + (error?.message ?? '') };
  const id = (slot as { id: string }).id;
  try { const { pushSlotToGoogle } = await import('@/lib/google'); await pushSlotToGoogle(ctx.appUser.tenant_id, id); } catch { /* ignore */ }
  revalidatePath('/appointments/slots');
  revalidatePath('/appointments');
  return { id };
}

/** 枠を削除（Google同期）。カレンダーの×用 */
export async function removeSlotById(id: string): Promise<ApptState> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: 'アカウントが未設定です。' };
  if (!id) return { error: '対象がありません。' };
  const supabase = createClient();
  try { const { removeSlotFromGoogle } = await import('@/lib/google'); await removeSlotFromGoogle(ctx.appUser.tenant_id, id); } catch { /* ignore */ }
  const { error } = await supabase.from('appointment_slots').delete().eq('id', id);
  if (error) return { error: '削除に失敗しました：' + error.message };
  revalidatePath('/appointments/slots');
  return {};
}

/** 枠の受付可/不可を切替（Google同期）。カレンダークリック用 */
export async function setSlotBlocked(id: string, blocked: boolean): Promise<ApptState> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: 'アカウントが未設定です。' };
  if (!id) return { error: '対象がありません。' };
  const supabase = createClient();
  const { error } = await supabase.from('appointment_slots').update({ is_blocked: blocked }).eq('id', id);
  if (error) return { error: '更新に失敗しました：' + error.message };
  try { const { pushSlotToGoogle } = await import('@/lib/google'); await pushSlotToGoogle(ctx.appUser.tenant_id, id); } catch { /* ignore */ }
  revalidatePath('/appointments/slots');
  return {};
}

// ===== 空き枠テンプレート（tenant_settings.settings.slot_templates に保存） =====

async function readSettings(): Promise<Record<string, unknown>> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return {};
  const supabase = createClient();
  const { data } = await supabase.from('tenant_settings').select('settings').eq('tenant_id', ctx.appUser.tenant_id).maybeSingle();
  return ((data as { settings: Record<string, unknown> } | null)?.settings) ?? {};
}

/** テンプレ一覧（未登録なら既定テンプレを返す） */
export async function listTemplates(): Promise<SlotTemplate[]> {
  const settings = await readSettings();
  const tpls = settings.slot_templates as SlotTemplate[] | undefined;
  if (tpls && tpls.length) return tpls;
  return DEFAULT_TEMPLATES;
}

/** テンプレを保存 */
export async function saveTemplate(_p: ApptState, fd: FormData): Promise<ApptState> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: 'アカウントが未設定です。' };
  const name = s(fd, 'name'); const start = s(fd, 'start'); const end = s(fd, 'end');
  const interval = parseInt(String(fd.get('interval') ?? '60'), 10) || 60;
  const weekdays = fd.getAll('wd').map((x) => parseInt(String(x), 10));
  if (!name || !start || !end || weekdays.length === 0) return { error: '名称・曜日・時間帯を入力してください。' };
  const settings = await readSettings();
  const tpls = (settings.slot_templates as SlotTemplate[] | undefined) ?? [...DEFAULT_TEMPLATES];
  tpls.push({ name, weekdays, start, end, interval });
  const supabase = createClient();
  await supabase.from('tenant_settings').upsert({ tenant_id: ctx.appUser.tenant_id, settings: { ...settings, slot_templates: tpls } }, { onConflict: 'tenant_id' });
  revalidatePath('/appointments/slots');
  return {};
}

/** テンプレを削除 */
export async function deleteTemplate(fd: FormData): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return;
  const idx = parseInt(String(fd.get('idx') ?? '-1'), 10);
  const settings = await readSettings();
  const tpls = (settings.slot_templates as SlotTemplate[] | undefined) ?? [...DEFAULT_TEMPLATES];
  if (idx < 0 || idx >= tpls.length) return;
  tpls.splice(idx, 1);
  const supabase = createClient();
  await supabase.from('tenant_settings').upsert({ tenant_id: ctx.appUser.tenant_id, settings: { ...settings, slot_templates: tpls } }, { onConflict: 'tenant_id' });
  revalidatePath('/appointments/slots');
}

/** テンプレを期間に適用（generateSlots を内部呼び出し相当） */
export async function applyTemplate(_p: ApptState, fd: FormData): Promise<ApptState> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: 'アカウントが未設定です。' };
  const from = s(fd, 'date_from'); const to = s(fd, 'date_to');
  const tpls = await listTemplates();
  const idx = parseInt(String(fd.get('idx') ?? '-1'), 10);
  const tpl = tpls[idx];
  if (!from || !to || !tpl) return { error: '期間とテンプレを指定してください。' };

  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  const sMin = toMin(tpl.start); const eMin = toMin(tpl.end);
  const rows: { tenant_id: string; start_at: string; end_at: string; is_blocked: boolean }[] = [];
  const cur = new Date(`${from}T12:00:00+09:00`); const last = new Date(`${to}T12:00:00+09:00`); let guard = 0;
  while (cur <= last && guard < 400) {
    guard++;
    const dateStr = cur.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
    if (tpl.weekdays.includes(cur.getUTCDay())) {
      for (let m = sMin; m + tpl.interval <= eMin; m += tpl.interval) {
        const st = jstToIso(dateStr, hhmm(m));
        rows.push({ tenant_id: ctx.appUser.tenant_id, start_at: st, end_at: addMinutesIso(st, tpl.interval), is_blocked: false });
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
  if (!rows.length) return { error: '生成対象がありませんでした。' };
  if (rows.length > 500) return { error: `生成枠が多すぎます（${rows.length}）。期間を短くしてください。` };
  const supabase = createClient();
  const { data, error } = await supabase.from('appointment_slots').insert(rows).select('id');
  if (error) return { error: '適用に失敗しました：' + error.message };
  try { const { pushSlotToGoogle } = await import('@/lib/google'); for (const r of (data ?? []) as { id: string }[]) await pushSlotToGoogle(ctx.appUser.tenant_id, r.id); } catch { /* ignore */ }
  revalidatePath('/appointments/slots');
  return {};
}

// ===== 施術場所テンプレート（tenant_settings.settings.location_templates に保存） =====

const DEFAULT_LOCATIONS = ['院内', 'オンライン', '出張'];

/** 施術場所の候補一覧（未登録なら既定値） */
export async function listLocations(): Promise<string[]> {
  const settings = await readSettings();
  const locs = settings.location_templates as string[] | undefined;
  if (locs && locs.length) return locs;
  return DEFAULT_LOCATIONS;
}

/** 施術場所テンプレを追加 */
export async function addLocation(_p: ApptState, fd: FormData): Promise<ApptState> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: 'アカウントが未設定です。' };
  const name = s(fd, 'name');
  if (!name) return { error: '場所名を入力してください。' };
  const settings = await readSettings();
  const locs = (settings.location_templates as string[] | undefined) ?? [...DEFAULT_LOCATIONS];
  if (locs.includes(name)) return { error: 'すでに登録済みです。' };
  locs.push(name);
  const supabase = createClient();
  await supabase.from('tenant_settings').upsert({ tenant_id: ctx.appUser.tenant_id, settings: { ...settings, location_templates: locs } }, { onConflict: 'tenant_id' });
  revalidatePath('/appointments/slots');
  return {};
}

/** 施術場所テンプレを削除 */
export async function deleteLocation(fd: FormData): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return;
  const name = s(fd, 'name');
  if (!name) return;
  const settings = await readSettings();
  const locs = (settings.location_templates as string[] | undefined) ?? [...DEFAULT_LOCATIONS];
  const next = locs.filter((l) => l !== name);
  const supabase = createClient();
  await supabase.from('tenant_settings').upsert({ tenant_id: ctx.appUser.tenant_id, settings: { ...settings, location_templates: next } }, { onConflict: 'tenant_id' });
  revalidatePath('/appointments/slots');
}
