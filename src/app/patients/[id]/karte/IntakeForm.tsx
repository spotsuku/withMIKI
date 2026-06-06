'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { saveIntake, type KarteFormState } from './actions';
import { CHECK_ITEMS } from '@/lib/constants';

export interface IntakeInitial {
  chief?: string | null;
  onset?: string | null;
  current?: string | null;
  history?: string | null;
  sleep?: string | null;
  appetite?: string | null;
  meds?: string | null;
  note?: string | null;
  checks?: Record<string, string> | null;
}

const CHECK_OPTIONS = ['', 'はい', 'いいえ', '不明'];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? '保存中…' : '保存する'}
    </button>
  );
}

export function IntakeForm({
  patientId,
  patientName,
  initial,
}: {
  patientId: string;
  patientName: string;
  initial?: IntakeInitial | null;
}) {
  const [state, formAction] = useFormState<KarteFormState, FormData>(saveIntake, {});
  const i = initial ?? {};

  return (
    <form action={formAction}>
      <input type="hidden" name="patientId" value={patientId} />
      <div className="card">
        <h2>問診・基本情報の編集　<span className="meta">{patientName}</span></h2>
        <div className="field">
          <label htmlFor="chief">主訴</label>
          <textarea id="chief" name="chief" rows={2} defaultValue={i.chief ?? ''} />
        </div>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="onset">発症時期</label>
            <input id="onset" name="onset" defaultValue={i.onset ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="sleep">睡眠</label>
            <input id="sleep" name="sleep" defaultValue={i.sleep ?? ''} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="current">現病歴</label>
          <textarea id="current" name="current" rows={2} defaultValue={i.current ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="history">既往歴</label>
          <textarea id="history" name="history" rows={2} defaultValue={i.history ?? ''} />
        </div>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="appetite">食欲</label>
            <input id="appetite" name="appetite" defaultValue={i.appetite ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="meds">服薬</label>
            <input id="meds" name="meds" defaultValue={i.meds ?? ''} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="note">禁忌・備考</label>
          <textarea id="note" name="note" rows={2} defaultValue={i.note ?? ''} />
        </div>

        <h2 style={{ marginTop: 18 }}>問診チェック</h2>
        {CHECK_ITEMS.map((item, idx) => (
          <div className="field" key={idx}>
            <label htmlFor={`check_${idx}`}>{item}</label>
            <select id={`check_${idx}`} name={`check_${idx}`} defaultValue={i.checks?.[String(idx)] ?? ''}>
              {CHECK_OPTIONS.map((o) => (
                <option key={o} value={o}>{o === '' ? '—' : o}</option>
              ))}
            </select>
          </div>
        ))}

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
