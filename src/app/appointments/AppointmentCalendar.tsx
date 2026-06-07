import Link from 'next/link';

export interface CalAppt {
  id: string; start_at: string; end_at: string; status: string; title: string | null; name: string; location?: string | null;
}

const START_HOUR = 8;
const END_HOUR = 21;
const ROW = 48;
const WD = ['月', '火', '水', '木', '金', '土', '日'];

function jstParts(iso: string): { date: string; minutes: number } {
  const d = new Date(iso);
  const date = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const hm = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
  const [h, m] = hm.split(':').map(Number);
  return { date, minutes: h * 60 + m };
}

/** 予約の週カレンダー（閲覧・クリックで編集） */
export function AppointmentCalendar({ week, appts }: { week: string[]; appts: CalAppt[] }) {
  const byDate: Record<string, CalAppt[]> = {};
  for (const a of appts) {
    if (a.status === 'cancelled') continue;
    const { date } = jstParts(a.start_at);
    (byDate[date] ??= []).push(a);
  }
  const dayHeight = (END_HOUR - START_HOUR) * ROW;

  return (
    <div className="card">
      <div className="cal-wrap">
        <div className="cal">
          <div className="cal-head" />
          {week.map((d, i) => (
            <div key={d} className="cal-head">{Number(d.slice(8))}<br />{WD[i]}</div>
          ))}
          <div className="cal-timeaxis">
            {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
              <div key={i} className="cal-hourlabel">{START_HOUR + i}:00</div>
            ))}
          </div>
          {week.map((d) => (
            <div key={d} className="cal-day" style={{ height: dayHeight, cursor: 'default' }}>
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => <div key={i} className="cal-hourline" />)}
              {(byDate[d] ?? []).map((a) => {
                const st = jstParts(a.start_at).minutes;
                const en = jstParts(a.end_at).minutes;
                const top = ((st - START_HOUR * 60) / 60) * ROW;
                const height = Math.max(18, ((en - st) / 60) * ROW - 2);
                return (
                  <Link key={a.id} href={`/appointments/${a.id}/edit`} className="cal-slot appt" style={{ top, height }}>
                    {String(Math.floor(st / 60)).padStart(2, '0')}:{String(st % 60).padStart(2, '0')} {a.name}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
