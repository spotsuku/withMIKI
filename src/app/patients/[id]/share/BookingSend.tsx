'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { sendBookingLink, type SendBookingState } from './sendBooking';

function Btn() {
  const { pending } = useFormStatus();
  return <button className="btn secondary" type="submit" disabled={pending}>{pending ? '送信中…' : '予約リンクを送る'}</button>;
}

export function BookingSend({ patientId }: { patientId: string }) {
  const [state, formAction] = useFormState<SendBookingState, FormData>(sendBookingLink, {});
  const [copied, setCopied] = useState(false);
  const fullUrl = state.url && typeof window !== 'undefined' ? `${window.location.origin}${state.url}` : state.url ?? '';

  return (
    <div style={{ marginTop: 10 }}>
      <form action={formAction}>
        <input type="hidden" name="patientId" value={patientId} />
        <Btn />
      </form>
      {state.ok && !state.url ? <p className="meta">✅ LINEで予約リンクを送信しました。</p> : null}
      {state.ok && state.url ? (
        <div style={{ marginTop: 6 }}>
          <p className="meta">LINE未連携のため、このURLをお渡しください：</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input readOnly value={fullUrl} style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12 }} />
            <button type="button" className="btn secondary" style={{ padding: '4px 10px' }}
              onClick={() => { navigator.clipboard?.writeText(fullUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              {copied ? 'コピー済' : 'コピー'}
            </button>
          </div>
        </div>
      ) : null}
      {state.error ? <p className="error">{state.error}</p> : null}
    </div>
  );
}
