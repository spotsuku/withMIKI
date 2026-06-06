'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createShare, revokeShare, type ShareState } from './actions';

export interface ShareRow {
  id: string;
  token: string;
  label: string | null;
  expires_at: string | null;
}

function CreateBtn() {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending}>{pending ? '発行中…' : 'リンクを発行'}</button>;
}

function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? `${window.location.origin}/share/${token}` : `/share/${token}`;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input readOnly value={url} style={{ flex: 1, minWidth: 200, padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12 }} />
      <button type="button" className="btn secondary" style={{ padding: '4px 10px' }}
        onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
        {copied ? 'コピー済' : 'コピー'}
      </button>
    </div>
  );
}

export function ShareLinks({ patientId, shares }: { patientId: string; shares: ShareRow[] }) {
  const [state, formAction] = useFormState<ShareState, FormData>(createShare, {});

  return (
    <div className="card">
      <h2>基本カルテの共有リンク</h2>
      <p className="meta">発行したURLを送ると、相手はログイン不要で基本カルテ（基本情報・問診・ケアプラン・問題リスト）を閲覧できます。</p>

      <form action={formAction} style={{ marginTop: 8 }}>
        <input type="hidden" name="patientId" value={patientId} />
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="label">送付先メモ（任意）</label>
            <input id="label" name="label" placeholder="例: ○○クリニック 紹介用" />
          </div>
          <div className="field">
            <label htmlFor="expires_days">有効期限</label>
            <select id="expires_days" name="expires_days" defaultValue="14">
              <option value="7">7日</option>
              <option value="14">14日</option>
              <option value="30">30日</option>
              <option value="0">無期限</option>
            </select>
          </div>
        </div>
        {state?.error ? <p className="error">{state.error}</p> : null}
        <CreateBtn />
      </form>

      {shares.length > 0 ? (
        <ul className="patient-list" style={{ marginTop: 12 }}>
          {shares.map((s) => (
            <li key={s.id}>
              <div style={{ padding: '10px 4px', width: '100%' }}>
                <div className="meta" style={{ marginBottom: 4 }}>
                  {s.label ?? '共有リンク'}
                  {s.expires_at ? `　期限: ${s.expires_at.slice(0, 10)}` : '　無期限'}
                </div>
                <CopyLink token={s.token} />
                <form action={revokeShare} style={{ marginTop: 6 }}>
                  <input type="hidden" name="patientId" value={patientId} />
                  <input type="hidden" name="shareId" value={s.id} />
                  <button type="submit" className="btn secondary" style={{ padding: '2px 10px', fontSize: 12, borderColor: 'var(--danger)', color: 'var(--danger)' }}>失効</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : <div className="empty">有効なリンクはありません</div>}
    </div>
  );
}
