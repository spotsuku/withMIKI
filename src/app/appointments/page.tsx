import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { BookingLink } from './BookingLink';
import { type CalAppt } from './AppointmentCalendar';
import { SlotCalendar, type SlotItem } from './slots/SlotCalendar';
import { ensureBookingToken, setAppointmentStatus } from './actions';
import { jstToIso, fmtTimeJst, isoDateJst, weekDatesJst, STATUS_LABEL } from '@/lib/datetime';

export const dynamic = 'force-dynamic';

interface Appt {
  id: string; title: string | null; location: string | null; start_at: string; end_at: string; status: string;
  guest_name: string | null; patient: { name: string } | { name: string }[] | null;
}

const STATUS_BG: Record<string, string> = { confirmed: '#d3f9d8', pending: '#ffec99', cancelled: '#f1f3f5' };
const STATUS_FG: Record<string, string> = { confirmed: '#2b8a3e', pending: '#e67700', cancelled: '#868e96' };

export default async function AppointmentsPage({ searchParams }: { searchParams: { w?: string; view?: string } }) {
  if (!isSupabaseConfigured()) redirect('/patients');
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const view = searchParams.view === 'calendar' ? 'calendar' : 'list';
  const offset = parseInt(searchParams.w ?? '0', 10) || 0;
  const week = weekDatesJst(offset);
  const rangeStart = jstToIso(week[0], '00:00');
  const rangeEnd = jstToIso(week[6], '23:59');

  const { data } = await supabase
    .from('appointments')
    .select('id, title, location, start_at, end_at, status, guest_name, patient:patient_id(name)')
    .gte('start_at', rangeStart)
    .lte('start_at', rangeEnd)
    .order('start_at', { ascending: true });
  const appts = (data ?? []) as Appt[];
  const byDay: Record<string, Appt[]> = {};
  for (const a of appts) {
    const d = isoDateJst(a.start_at);
    (byDay[d] ??= []).push(a);
  }

  // 空き枠（カレンダーで直接追加できるように同ページで取得）
  const { data: slotData } = await supabase
    .from('appointment_slots')
    .select('id, start_at, end_at, is_blocked')
    .gte('start_at', rangeStart)
    .lte('start_at', rangeEnd)
    .order('start_at', { ascending: true });
  const slots = (slotData ?? []) as SlotItem[];
  const slotsByDay: Record<string, SlotItem[]> = {};
  for (const sl of slots) { const d = isoDateJst(sl.start_at); (slotsByDay[d] ??= []).push(sl); }
  const token = await ensureBookingToken();
  const { data: gset } = await supabase.from('tenant_settings').select('tenant_id, google_token').maybeSingle();
  const gsetRow = gset as { tenant_id: string; google_token: unknown } | null;
  const googleConnected = Boolean(gsetRow?.google_token);
  // Googleの予定をライブ取得（カレンダー表示時のみ・実質リアルタイム）
  let googleEvents: { id: string; title: string; start_at: string; end_at: string }[] = [];
  if (view === 'calendar' && googleConnected && gsetRow?.tenant_id) {
    try { const { listGoogleEvents } = await import('@/lib/google'); googleEvents = await listGoogleEvents(gsetRow.tenant_id, rangeStart, rangeEnd); } catch { /* ignore */ }
  }
  const { data: patData } = await supabase.from('patient').select('id, name').is('deleted_at', null).order('name');
  const patients = (patData ?? []) as { id: string; name: string }[];
  const wd = ['月', '火', '水', '木', '金', '土', '日'];
  const calAppts: CalAppt[] = appts.map((a) => {
    const pat = Array.isArray(a.patient) ? a.patient[0] : a.patient;
    return { id: a.id, start_at: a.start_at, end_at: a.end_at, status: a.status, title: a.title, location: a.location, name: pat?.name ?? a.guest_name ?? '（未設定）' };
  });

  return (
    <>
      <Topbar userEmail={user.email} />
      <div className="container">
        <div className="toolbar">
          <h1 style={{ fontSize: '1.3rem', margin: 0 }}>予約</h1>
          <span className="spacer" />
          <Link className="btn secondary" href="/appointments/slots">枠を設定</Link>
          <Link className="btn" href="/appointments/new">＋ 予約を追加</Link>
        </div>

        <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
          <Link className={'btn ' + (view === 'list' ? '' : 'secondary')} href={`/appointments?w=${offset}&view=list`}>リスト</Link>
          <Link className={'btn ' + (view === 'calendar' ? '' : 'secondary')} href={`/appointments?w=${offset}&view=calendar`}>カレンダー</Link>
        </div>

        <div className="weeknav" style={{ margin: '8px 0' }}>
          <Link className="btn secondary" href={`/appointments?w=${offset - 1}&view=${view}`}>‹ 前週</Link>
          <span className="range meta">{week[0]} 〜 {week[6]}</span>
          <Link className="btn secondary" href={`/appointments?w=${offset + 1}&view=${view}`}>翌週 ›</Link>
        </div>

        {view === 'calendar' ? <SlotCalendar week={week} slots={slots} appts={calAppts} googleEvents={googleEvents} patients={patients} /> : week.map((d, i) => (
          <div className="card" key={d} style={{ padding: '12px 14px' }}>
            <h2 style={{ margin: 0, fontSize: '1rem' }}>{d}（{wd[i]}）</h2>
            {byDay[d]?.length ? (
              <ul className="patient-list" style={{ marginTop: 8 }}>
                {byDay[d].map((a) => {
                  const pat = Array.isArray(a.patient) ? a.patient[0] : a.patient;
                  const name = pat?.name ?? a.guest_name ?? '（名称未設定）';
                  return (
                    <li key={a.id}>
                      <div style={{ padding: '10px 4px', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ minWidth: 0 }}>
                          <span className="status-badge" style={{ background: STATUS_BG[a.status] ?? '#eee', color: STATUS_FG[a.status] ?? '#555' }}>{STATUS_LABEL[a.status] ?? a.status}</span>
                          <strong style={{ marginLeft: 8 }}>{fmtTimeJst(a.start_at)}–{fmtTimeJst(a.end_at)}</strong>　{name}
                          {a.title ? <span className="meta">　{a.title}</span> : null}
                          {a.location ? <span className="tag" style={{ marginLeft: 8 }}>📍{a.location}</span> : null}
                        </span>
                        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {a.status !== 'confirmed' ? (
                            <form action={setAppointmentStatus}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="confirmed" /><button className="btn" style={{ padding: '6px 12px', fontSize: 13 }}>✅ 確定</button></form>
                          ) : null}
                          {a.status !== 'cancelled' ? (
                            <form action={setAppointmentStatus}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="cancelled" /><button className="btn secondary" style={{ padding: '6px 12px', fontSize: 13, borderColor: 'var(--danger)', color: 'var(--danger)' }}>キャンセル</button></form>
                          ) : null}
                          <Link className="btn secondary" style={{ padding: '6px 12px', fontSize: 13 }} href={`/appointments/${a.id}/edit`}>編集</Link>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {slotsByDay[d]?.length ? (
              <div style={{ marginTop: byDay[d]?.length ? 10 : 6 }}>
                <span className="meta">空き枠：</span>
                <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, marginLeft: 6 }}>
                  {slotsByDay[d].map((sl) => (
                    <span key={sl.id} className="tag" style={{ background: sl.is_blocked ? '#f1f3f5' : 'var(--accent-soft)', color: sl.is_blocked ? '#868e96' : 'var(--accent)' }}>
                      {fmtTimeJst(sl.start_at)}–{fmtTimeJst(sl.end_at)}{sl.is_blocked ? '（不可）' : ''}
                    </span>
                  ))}
                </span>
              </div>
            ) : null}
            {!byDay[d]?.length && !slotsByDay[d]?.length ? <div className="empty" style={{ padding: 8 }}>予約・空き枠なし</div> : null}
          </div>
        ))}

        <BookingLink token={token} />

        <div className="card">
          <h2>Google カレンダー連携</h2>
          {googleConnected ? (
            <>
              <p className="meta">✅ 連携済み。確定予約は自動でカレンダーに登録され、Googleの予定は空き枠ブロックに反映できます。</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <a className="btn secondary" href="/api/google/sync">Googleの予定を取り込む</a>
                <a className="btn secondary" href="/api/google/auth">再連携</a>
              </div>
            </>
          ) : (
            <>
              <p className="meta">連携すると、確定予約をGoogleカレンダーへ自動登録できます。</p>
              <a className="btn" href="/api/google/auth">Googleカレンダーと連携</a>
            </>
          )}
        </div>
      </div>
    </>
  );
}
