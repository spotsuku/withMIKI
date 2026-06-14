/**
 * 通知（メール=Resend / LINE=Messaging API push）。サーバー専用。
 * env: RESEND_API_KEY, RESEND_FROM / LINE_CHANNEL_ACCESS_TOKEN（別名 LINE_MESSAGING_ACCESS_TOKEN 可）/ APP_BASE_URL
 * いずれも未設定なら no-op（本処理を止めない）。
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { fmtJst, fmtTimeJst } from '@/lib/datetime';

/** Messaging API のチャネルアクセストークン（どちらの環境変数名でも可） */
function lineToken(): string | undefined {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN || process.env.LINE_MESSAGING_ACCESS_TOKEN;
}

export function emailEnabled(): boolean { return Boolean(process.env.RESEND_API_KEY); }
export function lineEnabled(): boolean { return Boolean(lineToken()); }

export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL || '').replace(/\/$/, '');
}

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (!emailEnabled() || !to) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.RESEND_FROM || 'WithMIKI <onboarding@resend.dev>', to, subject, text }),
    });
  } catch { /* ignore */ }
}

export async function linePush(to: string, text: string): Promise<void> {
  if (!lineEnabled() || !to) return;
  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { authorization: `Bearer ${lineToken()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
    });
  } catch { /* ignore */ }
}

interface ApptInfo {
  start_at: string; end_at: string; title: string | null; status: string;
  guest_name: string | null; guest_email: string | null; patient_id: string | null; booking_token: string;
  tenant: { name: string } | { name: string }[] | null;
}

/** 予約に関する通知（confirmed/booked/cancelled）。宛先はゲストメール＋（患者の)LINE/メール。 */
export async function notifyAppointment(appointmentId: string, kind: 'booked' | 'confirmed' | 'cancelled'): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const { data } = await admin
    .from('appointments')
    .select('start_at, end_at, title, status, guest_name, guest_email, patient_id, booking_token, tenant:tenant_id(name)')
    .eq('id', appointmentId)
    .maybeSingle();
  const a = data as ApptInfo | null;
  if (!a) return;
  const tenantName = (Array.isArray(a.tenant) ? a.tenant[0]?.name : a.tenant?.name) ?? '';
  const when = `${fmtJst(a.start_at)}〜${fmtTimeJst(a.end_at)}`;
  const manageUrl = appBaseUrl() ? `${appBaseUrl()}/appointment/${a.booking_token}` : '';

  const head = kind === 'confirmed' ? '【予約確定】' : kind === 'cancelled' ? '【予約キャンセル】' : '【予約受付】';
  const body =
    `${head}\n${tenantName}\n日時: ${when}\n` +
    (a.title ? `内容: ${a.title}\n` : '') +
    (kind === 'booked' ? '内容を確認のうえ、院から確定のご連絡をいたします。\n' : '') +
    (manageUrl ? `確認・キャンセル: ${manageUrl}\n` : '');

  // メール（ゲスト＋患者）
  const emails = new Set<string>();
  if (a.guest_email) emails.add(a.guest_email);
  if (a.patient_id) {
    const { data: pat } = await admin.from('patient').select('email').eq('id', a.patient_id).maybeSingle();
    const e = (pat as { email: string | null } | null)?.email;
    if (e) emails.add(e);
  }
  for (const e of emails) await sendEmail(e, `${head}${tenantName}`, body);

  // LINE（患者がひも付いている場合）
  if (a.patient_id) {
    const { data: la } = await admin.from('line_account').select('line_user_id').eq('patient_id', a.patient_id).maybeSingle();
    const lid = (la as { line_user_id: string } | null)?.line_user_id;
    if (lid) await linePush(lid, body);
  }
}

/** 予約が入った/キャンセルされた時に、テナントのスタッフ（LINE連携済み）へ通知 */
export async function notifyStaffOfBooking(appointmentId: string, kind: 'booked' | 'cancelled' = 'booked'): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const { data } = await admin
    .from('appointments')
    .select('tenant_id, start_at, end_at, title, guest_name, patient_id')
    .eq('id', appointmentId)
    .maybeSingle();
  const a = data as { tenant_id: string; start_at: string; end_at: string; title: string | null; guest_name: string | null; patient_id: string | null } | null;
  if (!a) return;

  let who = a.guest_name ?? '';
  if (!who && a.patient_id) {
    const { data: p } = await admin.from('patient').select('name').eq('id', a.patient_id).maybeSingle();
    who = (p as { name: string } | null)?.name ?? '';
  }
  const when = `${fmtJst(a.start_at)}〜${fmtTimeJst(a.end_at)}`;
  const head = kind === 'cancelled' ? '【予約キャンセル】' : '【新規予約】';
  const url = appBaseUrl() ? `${appBaseUrl()}/appointments?view=calendar` : '';
  const body = `${head}\n` + (who ? `${who} 様\n` : '') + `日時: ${when}\n` + (a.title ? `内容: ${a.title}\n` : '') + (url ? `カレンダー: ${url}` : '');

  const { data: staff } = await admin
    .from('app_user').select('line_user_id')
    .eq('tenant_id', a.tenant_id)
    .not('line_user_id', 'is', null);
  for (const s of (staff ?? []) as { line_user_id: string | null }[]) {
    if (s.line_user_id) await linePush(s.line_user_id, body);
  }
}

/** 予約リンク（公開ページ）を患者へ LINE で送る */
export async function sendBookingLinkToPatient(patientId: string, bookingToken: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data: la } = await admin.from('line_account').select('line_user_id').eq('patient_id', patientId).maybeSingle();
  const lid = (la as { line_user_id: string } | null)?.line_user_id;
  if (!lid) return false;
  const url = appBaseUrl() ? `${appBaseUrl()}/book/${bookingToken}` : `/book/${bookingToken}`;
  await linePush(lid, `ご予約はこちらからどうぞ：\n${url}`);
  return true;
}
