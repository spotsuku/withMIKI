import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { BookingLink } from './BookingLink';
import { ensureBookingToken, setAppointmentStatus } from './actions';
import { jstToIso, fmtTimeJst, isoDateJst, weekDatesJst, STATUS_LABEL } from '@/lib/datetime';

export const dynamic = 'force-dynamic';

interface Appt {
  id: string; title: string | null; start_at: string; end_at: string; status: string;
  guest_name: string | null; patient: { name: string } | { name: string }[] | null;
}

export default async function AppointmentsPage({ searchParams }: { searchParams: { w?: string } }) {
  if (!isSupabaseConfigured()) redirect('/patients');
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const offset = parseInt(searchParams.w ?? '0', 10) || 0;
  const week = weekDatesJst(offset);
  const rangeStart = jstToIso(week[0], '00:00');
  const rangeEnd = jstToIso(week[6], '23:59');

  const { data } = await supabase
    .from('appointments')
    .select('id, title, start_at, end_at, status, guest_name, patient:patient_id(name)')
    .gte('start_at', rangeStart)
    .lte('start_at', rangeEnd)
    .order('start_at', { ascending: true });
  const appts = (data ?? []) as Appt[];
  const byDay: Record<string, Appt[]> = {};
  for (const a of appts) {
    const d = isoDateJst(a.start_at);
    (byDay[d] ??= []).push(a);
  }
  const token = await ensureBookingToken();
  const { data: gset } = await supabase.from('tenant_settings').select('google_token').maybeSingle();
  const googleConnected = Boolean((gset as { google_token: unknown } | null)?.google_token);
  const wd = ['月', '火', '水', '木', '金', '土', '日'];

  return (
    <>
      <Topbar userEmail={user.email} />
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.3rem' }}>予約</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link className="btn secondary" href="/appointments/slots">枠を設定</Link>
            <Link className="btn" href="/appointments/new">＋ 予約を追加</Link>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
          <Link className="btn secondary" href={`/appointments?w=${offset - 1}`}>‹ 前週</Link>
          <span className="meta">{week[0]} 〜 {week[6]}</span>
          <Link className="btn secondary" href={`/appointments?w=${offset + 1}`}>翌週 ›</Link>
        </div>

        {week.map((d, i) => (
          <div className="card" key={d} style={{ padding: '12px 14px' }}>
            <h2 style={{ margin: 0, fontSize: '1rem' }}>{d}（{wd[i]}）</h2>
            {byDay[d]?.length ? (
              <ul className="patient-list" style={{ marginTop: 8 }}>
                {byDay[d].map((a) => {
                  const pat = Array.isArray(a.patient) ? a.patient[0] : a.patient;
                  const name = pat?.name ?? a.guest_name ?? '（名称未設定）';
                  return (
                    <li key={a.id}>
                      <div style={{ padding: '8px 4px', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span>
                          <strong>{fmtTimeJst(a.start_at)}–{fmtTimeJst(a.end_at)}</strong>　{name}
                          {a.title ? <span className="meta">　{a.title}</span> : null}
                          <span className="tag" style={{ marginLeft: 8 }}>{STATUS_LABEL[a.status] ?? a.status}</span>
                        </span>
                        <span style={{ display: 'flex', gap: 6 }}>
                          <Link className="btn secondary" style={{ padding: '2px 8px', fontSize: 12 }} href={`/appointments/${a.id}/edit`}>変更</Link>
                          {a.status !== 'confirmed' ? (
                            <form action={setAppointmentStatus}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="confirmed" /><button className="btn secondary" style={{ padding: '2px 8px', fontSize: 12 }}>確定</button></form>
                          ) : null}
                          {a.status !== 'cancelled' ? (
                            <form action={setAppointmentStatus}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="cancelled" /><button className="btn secondary" style={{ padding: '2px 8px', fontSize: 12, borderColor: 'var(--danger)', color: 'var(--danger)' }}>取消</button></form>
                          ) : null}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <div className="empty" style={{ padding: 8 }}>予約なし</div>}
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
