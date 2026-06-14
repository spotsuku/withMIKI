import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** カレンダーのGoogle予定を非同期取得（週送りを即時化するため、ページ描画とは分離） */
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from') ?? '';
  const to = req.nextUrl.searchParams.get('to') ?? '';
  if (!from || !to) return NextResponse.json({ events: [] });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ events: [] }, { status: 401 });

  const { data: gset } = await supabase.from('tenant_settings').select('tenant_id, google_token').maybeSingle();
  const row = gset as { tenant_id: string; google_token: unknown } | null;
  if (!row?.google_token || !row.tenant_id) return NextResponse.json({ events: [] });

  let events: { id: string; title: string; start_at: string; end_at: string }[] = [];
  try {
    const { listGoogleEvents } = await import('@/lib/google');
    events = await listGoogleEvents(row.tenant_id, from, to);
  } catch { return NextResponse.json({ events: [] }); }

  // アプリが作成しGoogleへ同期した予定は重複表示を抑制
  const [{ data: appts }, { data: slots }] = await Promise.all([
    supabase.from('appointments').select('google_event_id').gte('start_at', from).lte('start_at', to),
    supabase.from('appointment_slots').select('google_event_id').gte('start_at', from).lte('start_at', to),
  ]);
  const used = new Set<string>();
  for (const a of (appts ?? []) as { google_event_id?: string | null }[]) if (a.google_event_id) used.add(a.google_event_id);
  for (const s of (slots ?? []) as { google_event_id?: string | null }[]) if (s.google_event_id) used.add(s.google_event_id);

  return NextResponse.json({ events: events.filter((e) => !used.has(e.id)) });
}
