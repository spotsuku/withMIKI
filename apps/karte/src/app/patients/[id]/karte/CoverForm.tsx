'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { saveCover, type KarteFormState } from './actions';

export interface CoverInitial {
  purpose?: string | null;
  goal?: string | null;
  therapist?: string | null;
  diagnosis?: string | null;
  history?: string | null;
  treatment?: string | null;
  caution?: string | null;
  doctor?: string | null;
  start_date?: string | null;
  next_visit?: string | null;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? '保存中…' : '保存する'}
    </button>
  );
}

export function CoverForm({
  patientId,
  patientName,
  initial,
}: {
  patientId: string;
  patientName: string;
  initial?: CoverInitial | null;
}) {
  const [state, formAction] = useFormState<KarteFormState, FormData>(saveCover, {});
  const c = initial ?? {};

  return (
    <form action={formAction}>
      <input type="hidden" name="patientId" value={patientId} />
      <div className="card">
        <h2>ケアプランの編集　<span className="meta">{patientName}</span></h2>
        <div className="field">
          <label htmlFor="purpose">目的</label>
          <textarea id="purpose" name="purpose" rows={2} defaultValue={c.purpose ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="goal">目標</label>
          <textarea id="goal" name="goal" rows={2} defaultValue={c.goal ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="diagnosis">診断・見立て</label>
          <textarea id="diagnosis" name="diagnosis" rows={2} defaultValue={c.diagnosis ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="treatment">治療方針</label>
          <textarea id="treatment" name="treatment" rows={2} defaultValue={c.treatment ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="history">経過</label>
          <textarea id="history" name="history" rows={2} defaultValue={c.history ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="caution">注意事項</label>
          <textarea id="caution" name="caution" rows={2} defaultValue={c.caution ?? ''} />
        </div>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="therapist">担当者</label>
            <input id="therapist" name="therapist" defaultValue={c.therapist ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="doctor">主治医</label>
            <input id="doctor" name="doctor" defaultValue={c.doctor ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="start_date">開始日</label>
            <input id="start_date" name="start_date" type="date" defaultValue={c.start_date ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="next_visit">次回予定</label>
            <input id="next_visit" name="next_visit" type="date" defaultValue={c.next_visit ?? ''} />
          </div>
        </div>

        {state?.error ? <p className="error">{state.error}</p> : null}
        <div style={{ display: 'flex', gap: 10 }}>
          <SubmitButton />
          <Link className="btn secondary" href={`/patients/${patientId}`}>
            キャンセル
          </Link>
        </div>
      </div>
    </form>
  );
}
