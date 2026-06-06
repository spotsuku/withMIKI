'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { createAppointment, type ApptState } from './actions';

function Save() {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending}>{pending ? '保存中…' : '予約を作成'}</button>;
}

export function AppointmentForm({
  patients,
  defaultPatientId,
}: {
  patients: { id: string; name: string }[];
  defaultPatientId?: string;
}) {
  const [state, formAction] = useFormState<ApptState, FormData>(createAppointment, {});
  return (
    <form action={formAction}>
      <div className="card">
        <h2>予約を追加</h2>
        <div className="field">
          <label htmlFor="patient_id">患者</label>
          <select id="patient_id" name="patient_id" defaultValue={defaultPatientId ?? ''}>
            <option value="">（未選択）</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="title">メニュー・件名</label>
          <input id="title" name="title" placeholder="例: 鍼灸施術 / 初診" />
        </div>
        <div className="grid cols-2">
          <div className="field"><label htmlFor="date">日付 *</label><input id="date" name="date" type="date" required /></div>
          <div className="field"><label htmlFor="time">開始時刻 *</label><input id="time" name="time" type="time" required /></div>
          <div className="field">
            <label htmlFor="duration">所要時間（分）</label>
            <select id="duration" name="duration" defaultValue="60">
              {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m}分</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="status">状態</label>
            <select id="status" name="status" defaultValue="confirmed">
              <option value="confirmed">確定</option>
              <option value="pending">申込</option>
            </select>
          </div>
        </div>
        <div className="field"><label htmlFor="notes">メモ</label><textarea id="notes" name="notes" rows={2} /></div>
        {state?.error ? <p className="error">{state.error}</p> : null}
        <div style={{ display: 'flex', gap: 10 }}>
          <Save />
          <Link className="btn secondary" href="/appointments">キャンセル</Link>
        </div>
      </div>
    </form>
  );
}
