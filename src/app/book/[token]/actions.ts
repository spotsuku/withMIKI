'use server';

import { randomBytes } from 'node:crypto';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';

export interface BookState { error?: string }

function s(fd: FormData, k: string): string | null {
  const v = fd.get(k); if (v === null) return null;
  const t = String(v).trim(); return t === '' ? null : t;
}

/** 公開予約：空き枠を予約（ログイン不要・サービスロールで実行） */
export async function bookSlot(_p: BookState, fd: FormData): Promise<BookState> {
  const admin = createAdminClient();
  if (!admin) return { error: '予約機能はサーバー未設定です。' };

  const bookingPageToken = s(fd, 'pageToken');
  const slotId = s(fd, 'slot_id');
  const name = s(fd, 'name');
  const email = s(fd, 'email');
  if (!bookingPageToken || !slotId || !name) return { error: 'お名前と希望枠を入力してください。' };

  // トークン→テナント
  const { data: ts } = await admin.from('tenant_settings').select('tenant_id').eq('booking_token', bookingPageToken).maybeSingle();
  const tenantId = (ts as { tenant_id: string } | null)?.tenant_id;
  if (!tenantId) return { error: '予約ページが見つかりません。' };

  // 枠の検証（同テナント・未ブロック）
  const { data: slot } = await admin.from('appointment_slots').select('id, tenant_id, start_at, end_at, is_blocked').eq('id', slotId).maybeSingle();
  const sl = slot as { tenant_id: string; start_at: string; end_at: string; is_blocked: boolean } | null;
  if (!sl || sl.tenant_id !== tenantId) return { error: 'この枠は予約できません。' };
  if (sl.is_blocked) return { error: 'この枠は既に埋まっています。別の枠をお選びください。' };

  const token = randomBytes(24).toString('hex');
  const { error } = await admin.from('appointments').insert({
    tenant_id: tenantId,
    title: 'オンライン予約',
    start_at: sl.start_at,
    end_at: sl.end_at,
    status: 'pending',
    guest_name: name,
    guest_email: email,
    booking_token: token,
    source: 'patient',
  });
  if (error) return { error: '予約に失敗しました：' + error.message };

  // 二重予約防止に枠をブロック
  await admin.from('appointment_slots').update({ is_blocked: true }).eq('id', slotId);

  redirect(`/appointment/${token}`);
}
