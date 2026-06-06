import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyAppointment } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/**
 * 24時間前リマインダー。スケジューラ（Vercel Cron 等）から定期呼び出しする。
 * 認可: CRON_SECRET（?key= または Authorization: Bearer）。
 * 対象: confirmed で 23〜25時間後に開始、未リマインドの予約。
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key = request.nextUrl.searchParams.get('key') || request.headers.get('authorization')?.replace('Bearer ', '');
  const isVercelCron = request.headers.get('x-vercel-cron') !== null;
  if (secret && !isVercelCron && key !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'not configured' }, { status: 503 });

  const from = new Date(Date.now() + 23 * 3600000).toISOString();
  const to = new Date(Date.now() + 25 * 3600000).toISOString();
  const { data } = await admin
    .from('appointments')
    .select('id, notes')
    .eq('status', 'confirmed')
    .gte('start_at', from)
    .lte('start_at', to);
  const list = (data ?? []) as { id: string; notes: string | null }[];

  let sent = 0;
  for (const a of list) {
    if ((a.notes ?? '').includes('[reminded]')) continue;
    await notifyAppointment(a.id, 'confirmed');
    await admin.from('appointments').update({ notes: `${a.notes ?? ''} [reminded]`.trim() }).eq('id', a.id);
    sent++;
  }
  return NextResponse.json({ ok: true, sent });
}
