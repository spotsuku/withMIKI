/**
 * Google Calendar 連携（サーバー専用）。
 * トークンは tenant_settings.google_token に保存（クライアント非露出）。
 * env: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI
 */
import { createAdminClient } from '@/lib/supabase/admin';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPE = 'https://www.googleapis.com/auth/calendar';

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

/** 認可URL生成（state にテナントIDを載せる） */
export function googleAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? '',
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPE,
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

interface GoogleToken { access_token: string; refresh_token?: string; expiry?: number }

export async function exchangeCode(code: string): Promise<GoogleToken | null> {
  if (!googleConfigured()) return null;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  return { access_token: j.access_token, refresh_token: j.refresh_token, expiry: Date.now() + (j.expires_in ?? 3600) * 1000 };
}

async function refreshIfNeeded(token: GoogleToken): Promise<GoogleToken> {
  if (token.expiry && token.expiry > Date.now() + 60000) return token;
  if (!token.refresh_token || !googleConfigured()) return token;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: token.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return token;
  const j = (await res.json()) as { access_token: string; expires_in?: number };
  return { ...token, access_token: j.access_token, expiry: Date.now() + (j.expires_in ?? 3600) * 1000 };
}

/** テナント（院）単位で Google トークンを取得（院で1つの治療院カレンダー）。 */
async function getToken(tenantId: string): Promise<{ token: GoogleToken; calendarId: string; tenantId: string } | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from('tenant_settings').select('google_token, google_calendar_id').eq('tenant_id', tenantId).maybeSingle();
  const row = data as { google_token: GoogleToken | null; google_calendar_id: string | null } | null;
  if (!row?.google_token?.access_token) return null;
  const fresh = await refreshIfNeeded(row.google_token);
  if (fresh.access_token !== row.google_token.access_token) {
    await admin.from('tenant_settings').update({ google_token: fresh }).eq('tenant_id', tenantId);
  }
  return { token: fresh, calendarId: row.google_calendar_id || 'primary', tenantId };
}

export async function saveToken(tenantId: string, token: GoogleToken): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from('tenant_settings').upsert({ tenant_id: tenantId, google_token: token }, { onConflict: 'tenant_id' });
}

/** 確定予約を Google Calendar イベント化（未設定なら何もしない） */
export async function syncAppointmentToGoogle(tenantId: string, appointmentId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const auth = await getToken(tenantId);
  if (!auth) return;
  const { data: appt } = await admin.from('appointments').select('*').eq('id', appointmentId).maybeSingle();
  const a = appt as Record<string, unknown> | null;
  if (!a) return;

  const event = {
    summary: (a.title as string) || '予約',
    description: (a.notes as string) || '',
    location: (a.location as string) || undefined,
    start: { dateTime: a.start_at as string },
    end: { dateTime: a.end_at as string },
  };
  const existingId = a.google_event_id as string | null;
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events`;
  const url = existingId ? `${base}/${existingId}` : base;
  const res = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { authorization: `Bearer ${auth.token.access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (res.ok && !existingId) {
    const ev = (await res.json()) as { id?: string };
    if (ev.id) await admin.from('appointments').update({ google_event_id: ev.id }).eq('id', appointmentId);
  }
}

/** 予約枠を Google カレンダーへ作成/更新（google_event_id を枠に保存） */
export async function pushSlotToGoogle(tenantId: string, slotId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const auth = await getToken(tenantId);
  if (!auth) return;
  const { data } = await admin
    .from('appointment_slots')
    .select('start_at, end_at, is_blocked, google_event_id')
    .eq('id', slotId)
    .maybeSingle();
  const s = data as { start_at: string; end_at: string; is_blocked: boolean; google_event_id: string | null } | null;
  if (!s) return;

  const event = {
    summary: s.is_blocked ? 'WithMIKI 予約枠（受付不可）' : 'WithMIKI 予約枠（受付中）',
    description: 'WithMIKI で作成された予約枠',
    start: { dateTime: s.start_at },
    end: { dateTime: s.end_at },
  };
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events`;
  const url = s.google_event_id ? `${base}/${s.google_event_id}` : base;
  const res = await fetch(url, {
    method: s.google_event_id ? 'PATCH' : 'POST',
    headers: { authorization: `Bearer ${auth.token.access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (res.ok && !s.google_event_id) {
    const ev = (await res.json()) as { id?: string };
    if (ev.id) await admin.from('appointment_slots').update({ google_event_id: ev.id }).eq('id', slotId);
  }
}

/** 予約枠に対応する Google イベントを削除 */
export async function removeSlotFromGoogle(tenantId: string, slotId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const auth = await getToken(tenantId);
  if (!auth) return;
  const { data } = await admin.from('appointment_slots').select('google_event_id').eq('id', slotId).maybeSingle();
  const eventId = (data as { google_event_id: string | null } | null)?.google_event_id;
  if (!eventId) return;
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events/${eventId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${auth.token.access_token}` },
  });
}

export interface GCalEvent { id: string; title: string; start_at: string; end_at: string }

/** Google の既存予定を更新（タイトル・時間） */
export async function updateGoogleEvent(tenantId: string, eventId: string, summary: string, startIso: string, endIso: string): Promise<boolean> {
  const auth = await getToken(tenantId);
  if (!auth) return false;
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events/${eventId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${auth.token.access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ summary, start: { dateTime: startIso }, end: { dateTime: endIso } }),
  });
  return res.ok;
}

/** Google の既存予定を削除 */
export async function deleteGoogleEvent(tenantId: string, eventId: string): Promise<boolean> {
  const auth = await getToken(tenantId);
  if (!auth) return false;
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events/${eventId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${auth.token.access_token}` },
  });
  return res.ok || res.status === 410;
}

/** Google の予定をライブ取得（DBに保存しない・カレンダー表示用）。連携なしや時間指定なし予定は除外。 */
export async function listGoogleEvents(tenantId: string, fromIso: string, toIso: string): Promise<GCalEvent[]> {
  const auth = await getToken(tenantId);
  if (!auth) return [];
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events?timeMin=${encodeURIComponent(fromIso)}&timeMax=${encodeURIComponent(toIso)}&singleEvents=true&orderBy=startTime`;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 5000);
  let res: Response;
  try {
    res = await fetch(url, { headers: { authorization: `Bearer ${auth.token.access_token}` }, cache: 'no-store', signal: ctrl.signal });
  } catch { return []; } finally { clearTimeout(tid); }
  if (!res.ok) return [];
  const j = (await res.json()) as { items?: { id: string; summary?: string; start?: { dateTime?: string }; end?: { dateTime?: string } }[] };
  const out: GCalEvent[] = [];
  for (const ev of j.items ?? []) {
    if (!ev.start?.dateTime || !ev.end?.dateTime) continue; // 終日予定は除外
    const title = ev.summary || '予定';
    if (/^WithMIKI/.test(title)) continue; // 自分が作った枠/予約の重複表示を防ぐ
    out.push({ id: ev.id, title, start_at: ev.start.dateTime, end_at: ev.end.dateTime });
  }
  return out;
}

/** Google の予定を取得して appointment_slots にブロック枠として反映（空き枠検出） */
export async function syncBusyFromGoogle(tenantId: string, fromIso: string, toIso: string): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;
  const auth = await getToken(tenantId);
  if (!auth) return 0;
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events?timeMin=${encodeURIComponent(fromIso)}&timeMax=${encodeURIComponent(toIso)}&singleEvents=true&orderBy=startTime`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${auth.token.access_token}` } });
  if (!res.ok) return 0;
  const j = (await res.json()) as { items?: { id: string; start?: { dateTime?: string }; end?: { dateTime?: string } }[] };
  let n = 0;
  for (const ev of j.items ?? []) {
    if (!ev.start?.dateTime || !ev.end?.dateTime) continue;
    const { data: exist } = await admin.from('appointment_slots').select('id').eq('tenant_id', auth.tenantId).eq('google_event_id', ev.id).maybeSingle();
    if (exist) continue;
    await admin.from('appointment_slots').insert({
      tenant_id: auth.tenantId, start_at: ev.start.dateTime, end_at: ev.end.dateTime, is_blocked: true, google_event_id: ev.id,
    });
    n++;
  }
  return n;
}
