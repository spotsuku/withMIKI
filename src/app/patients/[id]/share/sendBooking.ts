'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth';
import { ensureBookingToken } from '@/app/appointments/actions';

export interface SendBookingState { ok?: boolean; error?: string; url?: string }

/** 患者へ予約リンクを LINE 送信（LINE未連携ならURLを返してコピー案内） */
export async function sendBookingLink(_p: SendBookingState, fd: FormData): Promise<SendBookingState> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: 'アカウントが未設定です。' };
  const patientId = String(fd.get('patientId') ?? '');
  if (!patientId) return { error: '患者IDがありません。' };

  const token = await ensureBookingToken();
  if (!token) return { error: '予約リンクを発行できませんでした。' };

  // LINE送信を試行
  let lineSent = false;
  try {
    const { sendBookingLinkToPatient } = await import('@/lib/notify');
    lineSent = await sendBookingLinkToPatient(patientId, token);
  } catch { /* ignore */ }

  const supabase = createClient();
  void supabase; // 予約済み（将来：送信ログ）
  revalidatePath(`/patients/${patientId}`);
  return lineSent ? { ok: true } : { ok: true, url: `/book/${token}` };
}
