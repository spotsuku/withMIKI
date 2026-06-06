'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { createAppointment, updateAppointment, type ApptState } from './actions';

export interface ApptInitial {
  id?: string;
  patient_id?: string | null;
  title?: string | null;
  date?: string;
  time?: string;
  duration?: number;
  status?: string;
  notes?: string | null;
}

function Save({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending}>{pending ? '保存中…' : isEdit ? '変更を保存' : '予約を作成'}</button>;
}

export function AppointmentForm({
  patients,
  defaultPatientId,
  initial,
}: {
  patients: { id: string; name: string }[];
  defaultPatientId?: string;
  initial?: ApptInitial;
}) {
  const isEdit = Boolean(initial?.id);
  const [state, formAction] = useFormState<ApptState, FormData>(isEdit ? updateAppointment : createAppointment, {});
  const patientId = initial?.patient_id ?? defaultPatientId ?? '';

  return (
    <form action={formAction}>
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="card">
        <h2>{isEdit ? '予約の変更' : '予約を追加'}</h2>
        <div className="field">
          <label htmlFor="patient_id">患者</label>
          <select id="patient_id" name="patient_id" defaultValue={patientId}>
            <option value="">（未選択）</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="title">メニュー・件名</label>
          <input id="title" name="title" defaultValue={initial?.title ?? ''} placeholder="例: 鍼灸施術 / 初診" />
        </div>
        <div className="grid cols-2">
          <div className="field"><label htmlFor="date">日付 *</label><input id="date" name="date" type="date" required defaultValue={initial?.date ?? ''} /></div>
          <div className="field"><label htmlFor="time">開始時刻 *</label><input id="time" name="time" type="time" required defaultValue={initial?.time ?? ''} /></div>
          <div className="field">
            <label htmlFor="duration">所要時間（分）</label>
            <select id="duration" name="duration" defaultValue={String(initial?.duration ?? 60)}>
              {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m}分</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="status">状態</label>
            <select id="status" name="status" defaultValue={initial?.status ?? 'confirmed'}>
              <option value="confirmed">確定</option>
              <option value="pending">申込</option>
              <option value="cancelled">キャンセル</option>
            </select>
          </div>
        </div>
        <div className="field"><label htmlFor="notes">メモ</label><textarea id="notes" name="notes" rows={2} defaultValue={initial?.notes ?? ''} /></div>
        {state?.error ? <p className="error">{state.error}</p> : null}
        <div style={{ display: 'flex', gap: 10 }}>
          <Save isEdit={isEdit} />
          <Link className="btn secondary" href="/appointments">キャンセル</Link>
        </div>
      </div>
    </form>
  );
}
