'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { bookSlot, type BookState } from './actions';

export interface SlotOpt { id: string; label: string }

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending} style={{ width: '100%' }}>{pending ? '予約中…' : 'この内容で予約する'}</button>;
}

export function BookingForm({ pageToken, slots }: { pageToken: string; slots: SlotOpt[] }) {
  const [state, formAction] = useFormState<BookState, FormData>(bookSlot, {});
  const [slotId, setSlotId] = useState('');

  return (
    <form action={formAction}>
      <input type="hidden" name="pageToken" value={pageToken} />
      <input type="hidden" name="slot_id" value={slotId} />
      <div className="card">
        <h2>希望の日時を選択</h2>
        {slots.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {slots.map((s) => (
              <button type="button" key={s.id}
                className={'chip' + (slotId === s.id ? ' on' : '')}
                style={{ textAlign: 'left' }}
                onClick={() => setSlotId(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        ) : <div className="empty">現在予約できる枠がありません。</div>}
      </div>

      {slots.length ? (
        <div className="card">
          <h2>お客様情報</h2>
          <div className="field"><label htmlFor="name">お名前 *</label><input id="name" name="name" required /></div>
          <div className="field"><label htmlFor="email">メールアドレス</label><input id="email" name="email" type="email" /></div>
          {state?.error ? <p className="error">{state.error}</p> : null}
          {!slotId ? <p className="meta">※ 上から希望枠を選んでください。</p> : null}
          <Submit />
        </div>
      ) : null}
    </form>
  );
}
