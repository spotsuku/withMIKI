import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { SlotCalendar, type SlotItem } from './SlotCalendar';
import { TemplatePanel } from './TemplatePanel';
import { listTemplates } from '../actions';
import { jstToIso, weekDatesJst } from '@/lib/datetime';

export const dynamic = 'force-dynamic';

export default async function SlotsPage({ searchParams }: { searchParams: { w?: string } }) {
  if (!isSupabaseConfigured()) redirect('/patients');
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const offset = parseInt(searchParams.w ?? '0', 10) || 0;
  const week = weekDatesJst(offset);
  const rangeStart = jstToIso(week[0], '00:00');
  const rangeEnd = jstToIso(week[6], '23:59');

  const { data } = await supabase
    .from('appointment_slots')
    .select('id, start_at, end_at, is_blocked')
    .gte('start_at', rangeStart)
    .lte('start_at', rangeEnd)
    .order('start_at', { ascending: true });
  const slots = (data ?? []) as SlotItem[];
  const templates = await listTemplates();

  return (
    <>
      <Topbar userEmail={user.email} />
      <div className="container">
        <p className="meta"><Link href="/appointments">‹ 予約一覧</Link></p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
          <Link className="btn secondary" href={`/appointments/slots?w=${offset - 1}`}>‹ 前週</Link>
          <span className="meta">{week[0]} 〜 {week[6]}</span>
          <Link className="btn secondary" href={`/appointments/slots?w=${offset + 1}`}>翌週 ›</Link>
        </div>

        <SlotCalendar week={week} slots={slots} />
        <TemplatePanel templates={templates} />
      </div>
    </>
  );
}
