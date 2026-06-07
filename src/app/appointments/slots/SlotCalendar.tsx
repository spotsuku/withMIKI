'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addSlotAt, removeSlotById, setSlotBlocked } from '../actions';

export interface SlotItem { id: string; start_at: string; end_at: string; is_blocked: boolean }

const START_HOUR = 8;
const END_HOUR = 21;
const ROW = 48; // px / hour
const SNAP = 15; // 分
const WD = ['月', '火', '水', '木', '金', '土', '日'];

function jstParts(iso: string): { date: string; minutes: number } {
  const d = new Date(iso);
  const date = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const hm = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
  const [h, m] = hm.split(':').map(Number);
  return { date, minutes: h * 60 + m };
}
function hhmm(min: number) { return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`; }

export function SlotCalendar({ week, slots }: { week: string[]; slots: SlotItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [duration, setDuration] = useState(60);
  const [msg, setMsg] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ date: string; a: number; b: number } | null>(null);

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

  function yToMin(e: React.PointerEvent<HTMLDivElement>): number {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = Math.min(Math.max(0, e.clientY - rect.top), dayHeight);
    const raw = START_HOUR * 60 + (y / ROW) * 60;
    const snapped = Math.round(raw / SNAP) * SNAP;
    return Math.min(END_HOUR * 60, Math.max(START_HOUR * 60, snapped));
  }

  function onDown(date: string, e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const m = yToMin(e);
    setDrag({ date, a: m, b: m + SNAP });
  }
  function onMove(date: string, e: React.PointerEvent<HTMLDivElement>) {
    if (!drag || drag.date !== date) return;
    const m = yToMin(e);
    setDrag((d) => (d ? { ...d, b: m } : d));
  }
  function onUp(date: string, e: React.PointerEvent<HTMLDivElement>) {
    if (!drag || drag.date !== date) { setDrag(null); return; }
    const s = Math.min(drag.a, drag.b);
    const en = Math.max(drag.a, drag.b);
    const mins = en - s;
    setDrag(null);
    run(() => addSlotAt(date, hhmm(s), mins >= SNAP ? mins : duration));
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>空き枠カレンダー</h2>
        <label className="meta">
          タップ時の長さ：
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} style={{ marginLeft: 6 }}>
            {[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m}分</option>)}
          </select>
        </label>
      </div>
      <p className="meta">縦に<strong>ドラッグ</strong>で時間幅を指定して枠作成・タップでも作成。枠タップで受付可/不可・×で削除（Google同期）。{pending ? ' 反映中…' : ''}</p>
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
            <div
              key={d}
              className="cal-day"
              style={{ height: dayHeight, touchAction: 'none' }}
              onPointerDown={(e) => onDown(d, e)}
              onPointerMove={(e) => onMove(d, e)}
              onPointerUp={(e) => onUp(d, e)}
            >
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => <div key={i} className="cal-hourline" />)}

              {/* ドラッグ中プレビュー */}
              {drag && drag.date === d ? (() => {
                const s = Math.min(drag.a, drag.b); const en = Math.max(drag.a, drag.b);
                const top = ((s - START_HOUR * 60) / 60) * ROW;
                const height = Math.max(10, ((en - s) / 60) * ROW);
                return <div className="cal-slot preview" style={{ top, height }}>{hhmm(s)}–{hhmm(en)}</div>;
              })() : null}

              {(byDate[d] ?? []).map((slot) => {
                const st = jstParts(slot.start_at).minutes;
                const en = jstParts(slot.end_at).minutes;
                const top = ((st - START_HOUR * 60) / 60) * ROW;
                const height = Math.max(16, ((en - st) / 60) * ROW - 2);
                return (
                  <div key={slot.id}
                    className={'cal-slot ' + (slot.is_blocked ? 'blocked' : 'open')}
                    style={{ top, height }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); run(() => setSlotBlocked(slot.id, !slot.is_blocked)); }}
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
