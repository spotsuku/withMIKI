'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createInviteLink, createRecordLink, type InviteState } from './invite';

function Btn() {
  const { pending } = useFormStatus();
  return <button className="btn secondary" type="submit" disabled={pending}>{pending ? '発行中…' : '🔑 ログイン招待URLを発行'}</button>;
}

function RecBtn() {
  const { pending } = useFormStatus();
  return <button className="btn secondary" type="submit" disabled={pending}>{pending ? '発行中…' : '🔓 ログイン不要の記録URL（PIN式）'}</button>;
}

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }}
      onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); }}>
      {done ? 'コピー済' : label}
    </button>
  );
}

export function InviteButton({ patientId }: { patientId: string }) {
  const [state, formAction] = useFormState<InviteState, FormData>(createInviteLink, {});
  const [recState, recAction] = useFormState<InviteState, FormData>(createRecordLink, {});

  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <form action={formAction}>
        <input type="hidden" name="patientId" value={patientId} />
        <Btn />
      </form>

      {state.existing ? <p className="meta">✅ この患者は既にログイン連携済みです。</p> : null}
      {state.ok && state.url ? (
        <div className="card" style={{ marginTop: 0, background: 'var(--accent-soft)' }}>
          <p className="meta" style={{ marginTop: 0 }}>
            招待URLを発行しました。LINEなどで送ってください。患者さんはこのURLを開き、<strong>LINEログイン</strong>か<strong>メール・パスワード</strong>でアカウントを受け取れます（有効期限14日）。
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <code style={{ wordBreak: 'break-all', flex: 1, minWidth: 0 }}>{state.url}</code>
            <Copy text={state.url} label="URLをコピー" />
          </div>
        </div>
      ) : null}
      {state.error ? <p className="error">{state.error}</p> : null}

      {/* ログイン不要・PIN式の記録URL */}
      <form action={recAction}>
        <input type="hidden" name="patientId" value={patientId} />
        <RecBtn />
      </form>
      {recState.ok && recState.url ? (
        <div className="card" style={{ marginTop: 0, background: 'var(--accent-soft)' }}>
          <p className="meta" style={{ marginTop: 0 }}>
            <strong>患者本人用</strong>のログイン不要URLを発行しました。患者さんはこのURLを開き、<strong>初回にPINを設定</strong>するだけで、基本カルテの閲覧・記録・公開設定ができます（アカウント作成不要）。途中で「LINEに切り替える」も可能です。
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <code style={{ wordBreak: 'break-all', flex: 1, minWidth: 0 }}>{recState.url}</code>
            <Copy text={recState.url} label="URLをコピー" />
          </div>
        </div>
      ) : null}
      {recState.error ? <p className="error">{recState.error}</p> : null}
    </div>
  );
}
