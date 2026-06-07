'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { invitePatient, type InviteState } from './invite';

function Btn() {
  const { pending } = useFormStatus();
  return <button className="btn secondary" type="submit" disabled={pending}>{pending ? '発行中…' : '🔑 ログイン招待を発行'}</button>;
}

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn secondary" style={{ padding: '2px 8px', fontSize: 12 }}
      onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); }}>
      {done ? 'コピー済' : label}
    </button>
  );
}

export function InviteButton({ patientId }: { patientId: string }) {
  const [state, formAction] = useFormState<InviteState, FormData>(invitePatient, {});

  return (
    <div style={{ marginTop: 8 }}>
      <form action={formAction}>
        <input type="hidden" name="patientId" value={patientId} />
        <Btn />
      </form>

      {state.existing ? <p className="meta">✅ この患者は既にログイン連携済みです（{state.email}）。</p> : null}

      {state.ok && state.password ? (
        <div className="card" style={{ marginTop: 8, background: 'var(--accent-soft)' }}>
          <p className="meta" style={{ marginTop: 0 }}>ログインアカウントを発行しました。患者さんへお伝えください（初回ログイン後の変更を推奨）。</p>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 6, alignItems: 'center' }}>
            <span className="meta">メール</span><code>{state.email}</code><Copy text={state.email ?? ''} label="コピー" />
            <span className="meta">初期PW</span><code>{state.password}</code><Copy text={state.password} label="コピー" />
            {state.url ? (<><span className="meta">URL</span><code style={{ wordBreak: 'break-all' }}>{state.url}</code><Copy text={state.url} label="コピー" /></>) : null}
          </div>
        </div>
      ) : null}

      {state.ok && state.linkedExisting ? (
        <p className="meta">✅ 既存のログインアカウント（{state.email}）を連携しました。患者さんは既存のパスワードでログインできます。</p>
      ) : null}

      {state.error ? <p className="error">{state.error}</p> : null}
    </div>
  );
}
