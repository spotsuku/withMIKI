'use client';

import { useState } from 'react';
import { regenerateBookingToken } from './actions';

export function BookingLink({ token }: { token: string | null }) {
  const [copied, setCopied] = useState(false);
  const url = token && typeof window !== 'undefined' ? `${window.location.origin}/book/${token}` : token ? `/book/${token}` : '';
  return (
    <div className="card">
      <h2>公開予約リンク</h2>
      <p className="meta">このURLを患者さんに送ると、空き枠から予約できます（ログイン不要）。</p>
      {token ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <input readOnly value={url} style={{ flex: 1, minWidth: 220, padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12 }} />
          <button type="button" className="btn secondary" style={{ padding: '4px 10px' }}
            onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? 'コピー済' : 'コピー'}
          </button>
          <form action={regenerateBookingToken}>
            <button type="submit" className="btn secondary" style={{ padding: '4px 10px' }}>URL再発行</button>
          </form>
        </div>
      ) : <p className="meta">リンク未発行</p>}
    </div>
  );
}
