'use client';

import { useState } from 'react';
import { sendTestLine } from './test-notify';

export function TestLineButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ marginTop: 10 }}>
      <button
        className="btn secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true); setMsg(null);
          const r = await sendTestLine();
          setBusy(false);
          setMsg(r.ok ? '✅ テスト通知を送信しました。LINEをご確認ください。' : (r.error ?? '失敗しました。'));
        }}
      >
        {busy ? '送信中…' : '🔔 自分のLINEにテスト通知'}
      </button>
      {msg ? <p className={msg.startsWith('✅') ? 'meta' : 'error'} style={{ marginTop: 6 }}>{msg}</p> : null}
    </div>
  );
}
