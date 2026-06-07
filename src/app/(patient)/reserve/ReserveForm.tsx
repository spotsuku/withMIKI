'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { reserveSlot, type ReserveState } from './actions';

export interface SlotOpt { id: string; label: string }

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending} style={{ width: '100%' }}>{pending ? '予約中…' : 'この枠で予約する'}</button>;
}

export function ReserveForm({ slots }: { slots: SlotOpt[] }) {
  const [state, formAction] = useFormState<ReserveState, FormData>(reserveSlot, {});

  if (slots.length === 0) {
    return <div className="empty">現在、予約できる空き枠がありません。先生にご相談ください。</div>;
  }

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="slot_id">希望の日時</label>
        <select id="slot_id" name="slot_id" required defaultValue="">
          <option value="" disabled>選択してください</option>
          {slots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="note">ご要望（任意）</label>
        <textarea id="note" name="note" rows={2} placeholder="症状・ご希望など" />
      </div>
      {state?.error ? <p className="error">{state.error}</p> : null}
      <Submit />
    </form>
  );
}
