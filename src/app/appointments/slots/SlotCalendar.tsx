'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { removeSlotById, setSlotBlocked } from '../actions';

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
function hhmm(min: number) { return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`; }

/** 空き枠カレンダー（表示・既存枠のタップ操作のみ。作成は手動フォームで） */
export function SlotCalendar({ week, slots }: { week: string[]; slots: SlotItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
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

  return (
    <div className="card">
      <h2>空き枠カレンダー（{week[0]} 〜 {week[6]}）</h2>
      <p className="meta">表示用です。枠タップで受付可/不可・×で削除。追加は上の「空き枠を追加」から。{pending ? ' 反映中…' : ''}</p>
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
            <div key={d} className="cal-day" style={{ height: dayHeight, cursor: 'default' }}>
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => <div key={i} className="cal-hourline" />)}
              {(byDate[d] ?? []).map((slot) => {
                const st = jstParts(slot.start_at).minutes;
                const en = jstParts(slot.end_at).minutes;
                const top = ((st - START_HOUR * 60) / 60) * ROW;
                const height = Math.max(16, ((en - st) / 60) * ROW - 2);
                return (
                  <div key={slot.id}
                    className={'cal-slot ' + (slot.is_blocked ? 'blocked' : 'open')}
                    style={{ top, height }}
                    onClick={() => run(() => setSlotBlocked(slot.id, !slot.is_blocked))}
                  >
                    <span className="x" onClick={(e) => { e.stopPropagation(); run(() => removeSlotById(slot.id)); }}>×</span>
                    {hhmm(st)}
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
