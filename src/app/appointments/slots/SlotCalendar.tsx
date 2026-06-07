'use client';

import { useEffect, useState, useTransition } from 'react';
import { addSlotAt, addApptAt, removeSlotById, setSlotBlocked } from '../actions';

function Legend({ color, border, label }: { color: string; border: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 14, height: 14, borderRadius: 4, background: color, border: `1px solid ${border}`, display: 'inline-block' }} />
      {label}
    </span>
  );
}

export interface SlotItem { id: string; start_at: string; end_at: string; is_blocked: boolean }
export interface ApptBlock { id: string; start_at: string; end_at: string; status: string; name: string; title?: string | null; location?: string | null }
export interface GEvent { id: string; title: string; start_at: string; end_at: string }

const START_HOUR = 8;
const END_HOUR = 21;
const ROW = 48;
const SNAP = 15;
const WD = ['月', '火', '水', '木', '金', '土', '日'];

function jstParts(iso: string): { date: string; minutes: number } {
  const d = new Date(iso);
  const date = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const hm = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
  const [h, m] = hm.split(':').map(Number);
  return { date, minutes: h * 60 + m };
}
function hhmm(min: number) { return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`; }
function toMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function isoFromJst(date: string, min: number) { return new Date(`${date}T${hhmm(min)}:00+09:00`).toISOString(); }

export function SlotCalendar({ week, slots, appts, googleEvents, patients }: { week: string[]; slots: SlotItem[]; appts?: ApptBlock[]; googleEvents?: GEvent[]; patients?: { id: string; name: string }[] }) {
  const [, startTr] = useTransition();
  const [list, setList] = useState<SlotItem[]>(slots);
  useEffect(() => { setList(slots); }, [slots]);
  const [apptList, setApptList] = useState<ApptBlock[]>(appts ?? []);
  useEffect(() => { setApptList(appts ?? []); }, [appts]);

  const [duration, setDuration] = useState(60);
  const [msg, setMsg] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ date: string; a: number; b: number } | null>(null);
  const [modal, setModal] = useState<{ date: string } | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [apptModal, setApptModal] = useState<ApptBlock | null>(null);
  const [mStart, setMStart] = useState('10:00');
  const [mEnd, setMEnd] = useState('11:00');
  const [mType, setMType] = useState<'open' | 'blocked' | 'confirmed' | 'pending'>('open');
  const [mPatient, setMPatient] = useState('');
  const [mTitle, setMTitle] = useState('');

  // 空き枠は全幅の薄い背景、予約はその上に重なる全幅ブロック（Google風）
  const slotRight = '2px';
  const dayHeight = (END_HOUR - START_HOUR) * ROW;

  const byDate: Record<string, SlotItem[]> = {};
  for (const s of list) { const { date } = jstParts(s.start_at); (byDate[date] ??= []).push(s); }
  const apptByDate: Record<string, ApptBlock[]> = {};
  for (const a of apptList) { if (a.status === 'cancelled') continue; const { date } = jstParts(a.start_at); (apptByDate[date] ??= []).push(a); }
  const gByDate: Record<string, GEvent[]> = {};
  for (const g of googleEvents ?? []) { const { date } = jstParts(g.start_at); (gByDate[date] ??= []).push(g); }

  function changeApptStatus(id: string, status: string) {
    setApptList((p) => p.map((x) => (x.id === id ? { ...x, status } : x)));
    setApptModal(null);
    startTr(async () => {
      const { updateApptStatus } = await import('../actions');
      const r = await updateApptStatus(id, status);
      if (r.error) setMsg(r.error);
    });
  }

  function yToMin(rectTop: number, clientY: number): number {
    const y = Math.min(Math.max(0, clientY - rectTop), dayHeight);
    const snapped = Math.round((START_HOUR * 60 + (y / ROW) * 60) / SNAP) * SNAP;
    return Math.min(END_HOUR * 60, Math.max(START_HOUR * 60, snapped));
  }
  function onDown(date: string, e: React.PointerEvent<HTMLDivElement>) {
    if (e.button && e.button !== 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    const m = yToMin(e.currentTarget.getBoundingClientRect().top, e.clientY);
    setDrag({ date, a: m, b: m });
  }
  function onMove(date: string, e: React.PointerEvent<HTMLDivElement>) {
    if (!drag || drag.date !== date) return;
    const m = yToMin(e.currentTarget.getBoundingClientRect().top, e.clientY);
    setDrag((d) => (d && d.b !== m ? { ...d, b: m } : d));
  }
  function openModal(date: string) {
    if (!drag || drag.date !== date) { setDrag(null); return; }
    const s = Math.min(drag.a, drag.b);
    let en = Math.max(drag.a, drag.b);
    if (en - s < SNAP) en = Math.min(END_HOUR * 60, s + duration); // タップは既定長
    setDrag(null);
    setMStart(hhmm(s));
    setMEnd(hhmm(en));
    setMType('open'); setMPatient(''); setMTitle('');
    setModal({ date });
  }

  function create() {
    if (!modal) return;
    const date = modal.date;
    const s = toMin(mStart); const en = toMin(mEnd);
    if (en <= s) { setMsg('終了は開始より後にしてください。'); return; }
    const mins = en - s;
    setMsg(null);

    // 空き枠 / 受付不可
    if (mType === 'open' || mType === 'blocked') {
      const blocked = mType === 'blocked';
      const tmpId = 'tmp-' + Date.now();
      setList((p) => [...p, { id: tmpId, start_at: isoFromJst(date, s), end_at: isoFromJst(date, en), is_blocked: blocked }]);
      setModal(null);
      startTr(async () => {
        const r = await addSlotAt(date, mStart, mins, blocked);
        if (r.error) { setList((p) => p.filter((x) => x.id !== tmpId)); setMsg(r.error); }
        else if (r.id) setList((p) => p.map((x) => (x.id === tmpId ? { ...x, id: r.id! } : x)));
      });
      return;
    }

    // 確定予約 / 申込
    const status = mType;
    const patientName = patients?.find((p) => p.id === mPatient)?.name;
    const tmpId = 'tmp-' + Date.now();
    setApptList((p) => [...p, { id: tmpId, start_at: isoFromJst(date, s), end_at: isoFromJst(date, en), status, name: patientName ?? '（予約）', title: mTitle || null }]);
    setModal(null);
    startTr(async () => {
      const r = await addApptAt(date, mStart, mins, { patientId: mPatient || null, title: mTitle || null, status });
      if (r.error) { setApptList((p) => p.filter((x) => x.id !== tmpId)); setMsg(r.error); }
      else if (r.id) setApptList((p) => p.map((x) => (x.id === tmpId ? { ...x, id: r.id! } : x)));
    });
  }

  function remove(id: string) {
    const prev = list;
    setList((p) => p.filter((x) => x.id !== id)); // 即時反映
    startTr(async () => { const r = await removeSlotById(id); if (r.error) { setList(prev); setMsg(r.error); } });
  }
  function toggle(id: string, blocked: boolean) {
    setList((p) => p.map((x) => (x.id === id ? { ...x, is_blocked: blocked } : x)));
    startTr(async () => { const r = await setSlotBlocked(id, blocked); if (r.error) { setList((p) => p.map((x) => (x.id === id ? { ...x, is_blocked: !blocked } : x))); setMsg(r.error); } });
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
      <p className="meta">縦に<strong>ドラッグ</strong>（またはタップ）→確認画面で作成。枠タップで受付可/不可・×で削除。</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', margin: '4px 0 8px', fontSize: '.78rem' }}>
        <Legend color="var(--accent-soft)" border="var(--accent)" label="空き枠（受付中）" />
        <Legend color="#eee" border="#ccc" label="受付不可" />
        <Legend color="var(--accent)" border="var(--accent-dark)" label="確定予約" />
        <Legend color="#f59f00" border="#e8590c" label="申込（未確定）" />
        {googleEvents ? <Legend color="#5c7cfa" border="#3b5bdb" label="Google予定" /> : null}
      </div>
      {appts && Object.keys(apptByDate).length === 0 ? (
        <p className="meta">※ この週に予約はありません。予約はその日がある週に表示されます（「翌週」で移動／「リスト」表示も便利）。</p>
      ) : null}
      {msg ? <p className="error">{msg}</p> : null}

      <div className="cal-wrap">
        <div className="cal">
          <div className="cal-head" />
          {week.map((d, i) => (<div key={d} className="cal-head">{Number(d.slice(8))}<br />{WD[i]}</div>))}
          <div className="cal-timeaxis">
            {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (<div key={i} className="cal-hourlabel">{START_HOUR + i}:00</div>))}
          </div>
          {week.map((d) => (
            <div key={d} className="cal-day" style={{ height: dayHeight, touchAction: 'none' }}
              onPointerDown={(e) => onDown(d, e)} onPointerMove={(e) => onMove(d, e)}
              onPointerUp={() => openModal(d)} onPointerCancel={() => setDrag(null)} onLostPointerCapture={() => setDrag(null)}>
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => <div key={i} className="cal-hourline" />)}

              {drag && drag.date === d ? (() => {
                const s = Math.min(drag.a, drag.b); const en = Math.max(drag.a, drag.b);
                const top = ((s - START_HOUR * 60) / 60) * ROW; const height = Math.max(10, ((en - s) / 60) * ROW);
                return <div className="cal-slot preview" style={{ top, height, right: slotRight }}>{hhmm(s)}</div>;
              })() : null}

              {(byDate[d] ?? []).map((slot) => {
                const st = jstParts(slot.start_at).minutes; const en = jstParts(slot.end_at).minutes;
                const top = ((st - START_HOUR * 60) / 60) * ROW; const height = Math.max(16, ((en - st) / 60) * ROW - 2);
                return (
                  <div key={slot.id} className={'cal-slot ' + (slot.is_blocked ? 'blocked' : 'open')}
                    style={{ top, height, right: slotRight }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); toggle(slot.id, !slot.is_blocked); }}>
                    <span className="x" onClick={(e) => { e.stopPropagation(); setDelId(slot.id); }}>×</span>
                    <span className="slot-label">{slot.is_blocked ? '受付不可' : '空き枠'}</span>
                    <span className="slot-time">{hhmm(st)}</span>
                  </div>
                );
              })}

              {(apptByDate[d] ?? []).map((a) => {
                const st = jstParts(a.start_at).minutes; const en = jstParts(a.end_at).minutes;
                const top = ((st - START_HOUR * 60) / 60) * ROW; const height = Math.max(18, ((en - st) / 60) * ROW - 2);
                const sub = [a.title, a.location ? '📍' + a.location : null].filter(Boolean).join(' ・ ');
                return (
                  <div key={a.id}
                    className={'cal-slot appt' + (a.status === 'pending' ? ' pending' : '')}
                    style={{ top, height, left: '2px', right: '2px', zIndex: 2, cursor: 'pointer' }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); setApptModal(a); }}>
                    <span className="appt-time">{hhmm(st)}–{hhmm(en)}</span>
                    <span className="appt-name">{a.name}</span>
                    {sub ? <span className="appt-sub">{sub}</span> : null}
                  </div>
                );
              })}

              {(gByDate[d] ?? []).map((g) => {
                const st = jstParts(g.start_at).minutes; const en = jstParts(g.end_at).minutes;
                const top = ((st - START_HOUR * 60) / 60) * ROW; const height = Math.max(16, ((en - st) / 60) * ROW - 2);
                return (
                  <div key={g.id} className="cal-slot gcal" style={{ top, height, left: '2px', right: '2px', zIndex: 3 }}
                    title={g.title}>
                    <span className="appt-time">{hhmm(st)}–{hhmm(en)}</span>
                    <span className="appt-name">{g.title}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {modal ? (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>作成</h2>
            <p className="meta">{modal.date}</p>

            <div className="field">
              <label>種類</label>
              <div className="chips">
                {([['open', '空き枠'], ['blocked', '受付不可'], ['confirmed', '確定予約'], ['pending', '申込']] as const).map(([v, label]) => (
                  <button key={v} type="button" className={'chip' + (mType === v ? ' on' : '')} onClick={() => setMType(v)}>{label}</button>
                ))}
              </div>
            </div>

            <div className="grid cols-2">
              <div className="field"><label>開始</label><input type="time" value={mStart} onChange={(e) => setMStart(e.target.value)} /></div>
              <div className="field"><label>終了</label><input type="time" value={mEnd} onChange={(e) => setMEnd(e.target.value)} /></div>
            </div>

            {mType === 'confirmed' || mType === 'pending' ? (
              <>
                <div className="field">
                  <label>患者</label>
                  <select value={mPatient} onChange={(e) => setMPatient(e.target.value)}>
                    <option value="">（未選択）</option>
                    {(patients ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>メニュー・件名</label>
                  <input value={mTitle} onChange={(e) => setMTitle(e.target.value)} placeholder="例: 鍼灸施術" />
                </div>
              </>
            ) : null}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn secondary" onClick={() => setModal(null)}>キャンセル</button>
              <button className="btn" onClick={create}>作成</button>
            </div>
          </div>
        </div>
      ) : null}

      {delId ? (
        <div className="modal-overlay" onClick={() => setDelId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>空き枠の削除</h2>
            <p className="meta">この空き枠を削除しますか？</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn secondary" onClick={() => setDelId(null)}>キャンセル</button>
              <button className="btn" style={{ background: 'var(--danger)' }} onClick={() => { const id = delId; setDelId(null); remove(id); }}>削除する</button>
            </div>
          </div>
        </div>
      ) : null}

      {apptModal ? (
        <div className="modal-overlay" onClick={() => setApptModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>予約の操作</h2>
            <p style={{ margin: '4px 0', fontWeight: 700 }}>{apptModal.name}</p>
            <p className="meta" style={{ marginTop: 0 }}>
              {hhmm(jstParts(apptModal.start_at).minutes)}–{hhmm(jstParts(apptModal.end_at).minutes)}
              {apptModal.title ? ` ・ ${apptModal.title}` : ''}
              {apptModal.location ? ` ・ 📍${apptModal.location}` : ''}
            </p>
            <p className="meta">
              現在の状態：{apptModal.status === 'confirmed' ? '確定' : apptModal.status === 'pending' ? '申込（未確定）' : apptModal.status}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {apptModal.status !== 'confirmed' ? (
                <button className="btn" onClick={() => changeApptStatus(apptModal.id, 'confirmed')}>✅ 確定する</button>
              ) : null}
              {apptModal.status !== 'cancelled' ? (
                <button className="btn secondary" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => changeApptStatus(apptModal.id, 'cancelled')}>キャンセルにする</button>
              ) : null}
              <a className="btn secondary" href={`/appointments/${apptModal.id}/edit`}>編集</a>
              <button className="btn secondary" onClick={() => setApptModal(null)}>閉じる</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
