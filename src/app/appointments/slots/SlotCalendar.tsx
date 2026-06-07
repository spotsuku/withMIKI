'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addSlotAt, removeSlotById, setSlotBlocked } from '../actions';

export interface SlotItem { id: string; start_at: string; end_at: string; is_blocked: boolean }

const START_HOUR = 8;
const END_HOUR = 21;
const ROW = 48; // px / hour
const WD = ['月', '火', '水', '木', '金', '土', '日'];

function jstParts(iso: string): { date: string; minutes: number } {
  const d = new Date(iso);
  const date = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const hm = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
  const [h, m] = hm.split(':').map(Number);
  return { date, minutes: h * 60 + m };
}

export function SlotCalendar({ week, slots }: { week: string[]; slots: SlotItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [duration, setDuration] = useState(60);
  const [msg, setMsg] = useState<string | null>(null);

  const byDate: Record<string, SlotItem[]> = {};
  for (const s of slots) {
    const { date } = jstParts(s.start_at);
    (byDate[date] ??= []).push(s);
  }
  const dayHeight = (END_HOUR - START_HOUR) * ROW;

  function run(fn: () => Promise<{ error?: string }>) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (r?.error) setMsg(r.error);
      router.refresh();
    });
  }

  function onCellClick(date: string, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hour = START_HOUR + Math.floor(y / ROW);
    const time = `${String(hour).padStart(2, '0')}:00`;
    run(() => addSlotAt(date, time, duration));
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>空き枠カレンダー</h2>
        <label className="meta">
          追加する長さ：
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} style={{ marginLeft: 6 }}>
            {[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m}分</option>)}
          </select>
        </label>
      </div>
      <p className="meta">空白をタップで枠追加・枠タップで受付可/不可・×で削除（Google同期）。{pending ? ' 反映中…' : ''}</p>
      {msg ? <p className="error">{msg}</p> : null}

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
            <div key={d} className="cal-day" style={{ height: dayHeight }} onClick={(e) => onCellClick(d, e)}>
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => <div key={i} className="cal-hourline" />)}
              {(byDate[d] ?? []).map((s) => {
                const st = jstParts(s.start_at).minutes;
                const en = jstParts(s.end_at).minutes;
                const top = ((st - START_HOUR * 60) / 60) * ROW;
                const height = Math.max(16, ((en - st) / 60) * ROW - 2);
                return (
                  <div key={s.id}
                    className={'cal-slot ' + (s.is_blocked ? 'blocked' : 'open')}
                    style={{ top, height }}
                    onClick={(e) => { e.stopPropagation(); run(() => setSlotBlocked(s.id, !s.is_blocked)); }}
                  >
                    <span className="x" onClick={(e) => { e.stopPropagation(); run(() => removeSlotById(s.id)); }}>×</span>
                    {String(Math.floor(st / 60)).padStart(2, '0')}:{String(st % 60).padStart(2, '0')}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
