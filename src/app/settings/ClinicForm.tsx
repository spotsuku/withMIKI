'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateClinicName, type StaffState } from './staff-actions';

function Save() {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending}>{pending ? '保存中…' : '保存'}</button>;
}

export function ClinicForm({ name }: { name: string }) {
  const [state, formAction] = useFormState<StaffState, FormData>(updateClinicName, {});
  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="clinic_name">院名（予約ページ・通知に表示）</label>
        <input id="clinic_name" name="clinic_name" defaultValue={name} required placeholder="例: WithMIKI (三木鍼灸治療院)" />
      </div>
      {state?.error ? <p className="error">{state.error}</p> : null}
      {state?.ok ? <p className="meta">✅ 保存しました。</p> : null}
      <Save />
    </form>
  );
}
