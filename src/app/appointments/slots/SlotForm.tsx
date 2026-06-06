'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createSlot, type ApptState } from '../actions';

function Save() {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending}>{pending ? '追加中…' : '空き枠を追加'}</button>;
}

export function SlotForm() {
  const [state, formAction] = useFormState<ApptState, FormData>(createSlot, {});
  return (
    <form action={formAction}>
      <div className="card">
        <h2>空き枠を追加</h2>
        <div className="grid cols-2">
          <div className="field"><label htmlFor="date">日付 *</label><input id="date" name="date" type="date" required /></div>
          <div className="field"><label htmlFor="start">開始 *</label><input id="start" name="start" type="time" required /></div>
          <div className="field"><label htmlFor="end">終了 *</label><input id="end" name="end" type="time" required /></div>
        </div>
        {state?.error ? <p className="error">{state.error}</p> : null}
        <Save />
      </div>
    </form>
  );
}
